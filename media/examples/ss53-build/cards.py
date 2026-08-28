import json, pathlib, math
BASE=pathlib.Path(__file__).parent
brands={c["slug"]:c for c in json.load(open(BASE/"brands.json"))}
align=json.load(open(BASE/"align.json"))
TAIL=1.6
ORDER=["replies-cold","replies-enterprise","booked-calls","signed-proposals",
       "event-showups","ramped-reps","accepted-offers","investor-meetings"]
PAGE={"replies-cold":"outcome-replies.html","replies-enterprise":"outcome-replies.html",
 "booked-calls":"outcome-booked-calls.html","signed-proposals":"outcome-signed-proposals.html",
 "event-showups":"outcome-event-showups.html","ramped-reps":"outcome-onboarding.html",
 "accepted-offers":"outcome-accepted-offers.html","investor-meetings":"outcome-investor-meetings.html"}
# one line of the actual spoken script -- the most persuasive asset on the page
LINE={
"replies-cold":"Priya, this is not a list. I made this one for you, and only you.",
"replies-enterprise":"An enterprise account doesn't move because somebody sent a clever email. So I'm not sending you one.",
"booked-calls":"Rather than send you notes you'll never open, here are the two minutes that matter.",
"signed-proposals":"Rather than send you a forty-page PDF, I thought I'd talk you through the proposal myself.",
"event-showups":"I wanted to invite you myself, instead of leaving it to another calendar invite.",
"ramped-reps":"Over the next two weeks this takes you from first day to first demo, one short video at a time.",
"accepted-offers":"Know this. We're not sending this video to anyone else.",
"investor-meetings":"You asked for the short version, so here it is.",
}
def dur(s):
    t=align[s]["voLen"]+TAIL
    return f"{int(t//60)}:{int(round(t%60)):02d}"
out=[]
for i,s in enumerate(ORDER):
    c=brands[s]
    feat=" feat" if i==0 else ""
    out.append(f'''        <div class="ex-card v-card rv{feat}" data-outcome="{c['outcome']}" style="--accent:{c['hue']}" data-href="{PAGE[s]}">
          <div class="ex-frame">
            <span class="fdur">{dur(s)}</span>
            <video poster="../media/examples/ss53-{s}-poster.jpg" playsinline preload="metadata">
              <source src="../media/examples/ss53-{s}.mp4" type="video/mp4">
            </video>
            <button type="button" class="v-play" aria-label="Play {c['caption']}"></button>
            <span class="v-hint">Click for sound</span>
          </div>
          <div class="ex-body">
            <a class="ex-cap" href="{PAGE[s]}">{c['caption']}</a>
            <div class="ex-meta">{c['meta']}</div>
            <p class="ex-line">&ldquo;{LINE[s]}&rdquo;</p>
            <span class="ex-mark">Invented example</span>
          </div>
        </div>''')
pathlib.Path("cards.html").write_text("\n\n".join(out))
print("\n".join(f"{s:20s} {dur(s)}  {brands[s]['hue']}" for s in ORDER))
