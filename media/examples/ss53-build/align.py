"""Forced-align each film's beat anchors against the render's OWN baked audio.

Beat starts must come from the audio that actually ships, not from a wpm
estimate. We take word-level timestamps from faster-whisper, then locate each
beat's anchor phrase by CHARACTER COVERAGE over the word stream rather than by
re-tokenising in lockstep -- the tokenisers disagree on contractions and
numbers, and lockstep drift lands later beats early (the documented trap).
"""
import json, re, sys, pathlib, subprocess
from faster_whisper import WhisperModel

BASE = pathlib.Path(__file__).parent
brands = {c["slug"]: c for c in json.load(open(BASE/"brands.json"))}
beats  = json.load(open(BASE/"beats.json"))

# whisper writes numerals where the script spells them out ("15" vs "fifteen"),
# so fold digits to words before comparing.
# TTS respellings: the script says "Vyne" so the voice says it right, but the
# transcript (and every caption) spells it "Vine". Fold them for matching.
ALIAS = {"vyne":"vine"}
NUM = {"1":"one","2":"two","3":"three","4":"four","5":"five","6":"six","7":"seven",
       "8":"eight","9":"nine","10":"ten","15":"fifteen","18":"eighteen","30":"thirty","40":"forty"}
def norm(s):
    s = s.lower()
    s = re.sub(r"\d+", lambda m: NUM.get(m.group(), m.group()), s)
    for k, v in ALIAS.items():
        s = s.replace(k, v)
    return re.sub(r"[^a-z0-9]", "", s)

model = WhisperModel("small.en", device="cpu", compute_type="int8")

def words_for(mp4):
    wav = mp4.with_suffix(".wav")
    subprocess.run(["ffmpeg","-loglevel","error","-i",str(mp4),"-ac","1","-ar","16000","-y",str(wav)],check=True)
    segs,_ = model.transcribe(str(wav), word_timestamps=True, vad_filter=False)
    out=[]
    for s in segs:
        for w in (s.words or []):
            out.append({"t": float(w.start), "w": w.word.strip()})
    return out

def locate(words, phrase, from_idx):
    """First index >= from_idx whose following words cover `phrase` exactly.

    Accumulate word text and require it to stay a PREFIX of the target; the
    moment coverage reaches the target length we have an exact character match.
    """
    target = norm(phrase)
    for i in range(from_idx, len(words)):
        acc = ""
        for j in range(i, min(i + 60, len(words))):
            acc += norm(words[j]["w"])
            if not target.startswith(acc):
                break
            if len(acc) >= len(target):
                return i
    return None

results={}
report=[]
for slug in sys.argv[1:] or list(brands):
    mp4 = BASE/"src"/f"{slug}-src.mp4"
    if not mp4.exists():
        report.append(f"SKIP {slug}: no render yet"); continue
    words = words_for(mp4)
    dur = float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
          "-of","csv=p=0",str(mp4)],capture_output=True,text=True).stdout.strip())
    bs = beats[slug]; starts=[]; ptr=0; bad=[]
    for k,b in enumerate(bs):
        idx = locate(words, b["a"], ptr)
        if idx is None:
            bad.append(b["a"]); starts.append(None); continue
        starts.append(round(words[idx]["t"],2)); ptr = idx+1
    # beat 0 always opens the film
    if starts and starts[0] is not None: starts[0]=0.0
    # any miss: fall back to proportional placement between its neighbours
    for i,s in enumerate(starts):
        if s is None:
            prev = next((starts[j] for j in range(i-1,-1,-1) if starts[j] is not None), 0.0)
            nxt  = next((starts[j] for j in range(i+1,len(starts)) if starts[j] is not None), dur)
            starts[i]=round(prev+(nxt-prev)/2,2)
    mono = all(starts[i] < starts[i+1] for i in range(len(starts)-1))
    edges = starts + [dur]
    gaps = [round(edges[i+1]-edges[i],2) for i in range(len(starts))]
    longest = max(gaps); tightest = min(gaps)
    results[slug]={"voLen":round(dur,3),"starts":starts,"unmatched":bad,"monotonic":mono,
                   "gaps":gaps,"transcript":" ".join(w["w"] for w in words)}
    flag = "OK " if (mono and not bad and longest <= 5.2 and tightest >= 0.8) else "CHK"
    report.append(f"{flag} {slug:20s} {dur:5.2f}s  beats={len(starts)}  gaps={gaps}  "
                  f"longest={longest}s tightest={tightest}s"
                  + (f"  UNMATCHED={bad}" if bad else "") + ("" if mono else "  NOT-MONOTONIC"))
prev = json.load(open(BASE/"align.json")) if (BASE/"align.json").exists() else {}
prev.update(results); json.dump(prev, open(BASE/"align.json","w"), indent=1)
print("\n".join(report))
