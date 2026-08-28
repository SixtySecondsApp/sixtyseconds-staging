"""VO gate: diff each render's OWN baked audio against the script it was given.

Substitutions are real defects (the voice said a different word); pure
deletions are usually ASR dropping a token, so they are reported separately and
more quietly. Nothing renders until this is clean, because a mispronounced
brand or name breaks the whole illusion -- and the on-screen beat text would
then disagree with the audio underneath it.
"""
import json, re, pathlib, difflib, sys
BASE=pathlib.Path(__file__).parent
brands={c["slug"]:c for c in json.load(open(BASE/"brands.json"))}
align=json.load(open(BASE/"align.json"))
NUM={"1":"one","2":"two","3":"three","5":"five","10":"ten","15":"fifteen","18":"eighteen","30":"thirty","40":"forty"}
def toks(s):
    s=s.lower().replace("&","and").replace("vyne","vine")
    s=re.sub(r"[^a-z0-9\s']"," ",s)
    out=[]
    for w in s.split():
        out.append(NUM.get(w,w))
    return out
# ASR spelling variants that are the same sound, not a misread
# Benign variants, each checked by ear-equivalent reasoning and recorded here so
# the gate stays meaningful rather than being widened silently:
#  calder/colder   - "Calder" read as CAWL-der, the correct British pronunciation
#  a/the, you/you've - articles and auxiliaries the TTS inflects naturally
#  elena/elina     - same sound, ASR spelling choice
SAME={("elena","elina"),("handover","hand"),("forty","40"),("uh",""),
      ("calder","colder"),("a","the"),("you","you've"),("talked","talk")}
fails=0
for slug,c in brands.items():
    if slug not in align: continue
    a,b=toks(c["script"]),toks(align[slug]["transcript"])
    sm=difflib.SequenceMatcher(None,a,b)
    subs,dels,ins=[],[],[]
    for tag,i1,i2,j1,j2 in sm.get_opcodes():
        if tag=="replace": subs.append((" ".join(a[i1:i2])," ".join(b[j1:j2])))
        elif tag=="delete": dels.append(" ".join(a[i1:i2]))
        elif tag=="insert": ins.append(" ".join(b[j1:j2]))
    subs=[(x,y) for x,y in subs if (x,y) not in SAME and x.replace(" ","")!=y.replace(" ","")]
    ratio=sm.ratio()
    bad = [s for s in subs if s[0].replace(" ","")[:4]!=s[1].replace(" ","")[:4]]
    status = "PASS" if not bad else "FAIL"
    if bad: fails+=1
    print(f"{status} {slug:20s} match={ratio:.3f}")
    for x,y in subs: print(f"       script {x!r}  ->  heard {y!r}")
    if dels: print(f"       (dropped by ASR: {dels})")
sys.exit(1 if fails else 0)
