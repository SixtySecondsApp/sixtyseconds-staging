import json, pathlib, subprocess, sys
BASE=pathlib.Path(__file__).parent
OUT=pathlib.Path("/Users/macbookpro/Desktop/Cursor Projects/60-wave-videos/video/out/ssex")
MEDIA=pathlib.Path("/Users/macbookpro/Desktop/Cursor Projects/sixtyseconds-redesign/redesign/media/examples")
brands={c["slug"]:c for c in json.load(open(BASE/"brands.json"))}
align=json.load(open(BASE/"align.json"))
ids=json.load(open(BASE/"ids.json"))
ORDER=["replies-cold","replies-enterprise","booked-calls","signed-proposals",
       "event-showups","ramped-reps","accepted-offers","investor-meetings"]
CUTS={"replies-enterprise":16.57,"booked-calls":13.97,"signed-proposals":14.15}

def sh(*a): subprocess.run(list(a),check=True,capture_output=True)
def probe(p,k="duration"):
    return subprocess.run(["ffprobe","-v","error","-show_entries",f"format={k}","-of","csv=p=0",str(p)],
        capture_output=True,text=True).stdout.strip()

rows=[]
missing=[]
for s in ORDER:
    mp4=OUT/f"{s}.mp4"; png=OUT/f"{s}-poster.png"
    if not mp4.exists() or not png.exists():
        missing.append(s); continue
    dst=MEDIA/f"ss53-{s}.mp4"
    # web-sane: faststart so the player can begin before the whole file lands
    sh("ffmpeg","-loglevel","error","-i",str(mp4),"-c","copy","-movflags","+faststart","-y",str(dst))
    sh("ffmpeg","-loglevel","error","-i",str(png),"-q:v","4","-y",str(MEDIA/f"ss53-{s}-poster.jpg"))
    if s in CUTS:
        # frame-identical cut from the shipped film: one source, one path
        sh("ffmpeg","-loglevel","error","-ss",str(CUTS[s]),"-i",str(dst),"-t","1.4",
           "-vf","scale=1280:720","-an","-c:v","libx264","-crf","20","-pix_fmt","yuv420p",
           "-movflags","+faststart","-y",str(MEDIA/f"cut-{s}.mp4"))
    rows.append((s,dst))
if missing: print("NOT YET RENDERED:", ", ".join(missing))
for s,dst in rows:
    d=float(probe(dst)); sz=int(probe(dst,"size"))/1e6
    print(f"{s:20s} {d:5.2f}s  {sz:4.1f}MB  {brands[s]['hue']}  {brands[s]['brand']} / {brands[s]['recipient']}")
