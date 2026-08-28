"""Gate: every beat anchor must exist in its script AND appear in beat order.
An out-of-order anchor silently drags later beats to the wrong timestamp, so
this runs before alignment, not after."""
import json, re, pathlib, sys
BASE=pathlib.Path(__file__).parent
brands={c["slug"]:c for c in json.load(open(BASE/"brands.json"))}
beats=json.load(open(BASE/"beats.json"))
norm=lambda s: re.sub(r"[^a-z0-9]","",s.lower())
bad=0
for slug,bs in beats.items():
    script=norm(brands[slug]["script"]); pos=-1; ok=True
    for i,b in enumerate(bs):
        a=norm(b["a"]); at=script.find(a, pos+1)
        if at<0:
            print(f"MISSING {slug} beat{i}: {b['a']!r}"); ok=False; bad+=1
        elif at<=pos:
            print(f"OUTOFORDER {slug} beat{i}: {b['a']!r}"); ok=False; bad+=1
        else: pos=at
    if ok: print(f"ok  {slug}")
sys.exit(1 if bad else 0)
