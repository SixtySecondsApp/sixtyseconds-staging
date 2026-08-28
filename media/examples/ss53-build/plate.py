import json, subprocess, os, pathlib
BASE = pathlib.Path(__file__).parent
brands = json.load(open(BASE/"brands.json"))

# what sits BELOW the video on each page — the thing the script promises
BELOW = {
 "replies-cold":       [("Why you, and not a list","Three new clients this quarter. Handover still manual."),("What we'd build","One video per client, your brand, their name."),("Book fifteen minutes","Thursday or Friday works")],
 "replies-enterprise": [("The account team","Who'd be on this, and what they've shipped"),("What it costs","Per seat, per month. No setup fee."),("Book a conversation","30 minutes, no deck")],
 "booked-calls":       [("Rollout across three sites","Phased, starting with Northgate"),("What clinicians see on day one","Two screens. No new login."),("The number your board asked about","Payback inside the first year")],
 "signed-proposals":   [("Scope","Rollout across three regional teams"),("Onboarding","First fortnight, named lead"),("Agreement and payment","Sign and start")],
 "event-showups":      [("Thursday, 2pm","Thirty minutes, live"),("What we'll cover","Outreach, follow-up, the numbers"),("Join, or get the recording","Both links below")],
 "ramped-reps":        [("Module one","How we position the product"),("Module two","Who we sell to"),("Module three","The three discovery questions")],
 "accepted-offers":    [("Your offer","Salary, options, start date"),("The team you'd join","A few honest words from each"),("Take your time","Ask us anything")],
 "investor-meetings":  [("The deck","Eighteen months of revenue"),("The numbers","Every one stands up to questioning"),("My calendar","Fifteen minutes this week")],
}

CSS = """
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,-apple-system,'Helvetica Neue',Arial,sans-serif;background:#F6F8FB;color:#121A27;width:1600px}
.nav{display:flex;align-items:center;justify-content:space-between;padding:26px 64px;background:#fff;border-bottom:1px solid #E6EBF2}
.wm{font-weight:800;font-size:22px;letter-spacing:.26em}
.navcta{background:var(--p);color:#fff;font-weight:700;font-size:15px;padding:11px 22px;border-radius:9px}
.hero{padding:56px 64px 40px;background:#fff}
.eyebrow{font-size:13px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--p);margin-bottom:16px}
h1{font-size:58px;line-height:1.06;letter-spacing:-.03em;font-weight:800;max-width:20ch}
h1 em{font-style:normal;color:var(--p)}
.sub{margin-top:20px;font-size:20px;line-height:1.55;color:#4A5568;max-width:52ch}
.player{margin:38px 64px 0;height:400px;border-radius:18px;background:linear-gradient(140deg,#0E1726,#1B2740);position:relative;box-shadow:0 30px 70px -30px rgba(18,26,39,.45);overflow:hidden}
.player:after{content:'';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:0;height:0;border-left:34px solid rgba(255,255,255,.95);border-top:21px solid transparent;border-bottom:21px solid transparent}
.pring{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:104px;height:104px;border-radius:50%;background:var(--p);opacity:.92}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;padding:44px 64px 60px}
.card{background:#fff;border:1px solid #E6EBF2;border-radius:14px;padding:26px 24px}
.num{width:32px;height:32px;border-radius:8px;background:var(--soft);color:var(--p);font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center;margin-bottom:16px}
.ct{font-weight:800;font-size:20px;letter-spacing:-.01em;margin-bottom:8px}
.cb{font-size:16px;line-height:1.5;color:#5A6678}
"""

HTML = """<!doctype html><meta charset=utf-8><style>{css}</style>
<body style="--p:{hue};--soft:{soft}">
<div class=nav><div class=wm>{wm}</div><div class=navcta>{cta}</div></div>
<div class=hero><div class=eyebrow>{eyebrow}</div><h1>{h1a}<em>{h1b}</em></h1><div class=sub>{sub}</div></div>
<div class=player><div class=pring></div></div>
<div class=cards>{cards}</div>
</body>"""

def wordmark(name):
    n = name.replace(" & "," &amp; ").upper()
    return n

HEADS = {
 "replies-cold":       ("Priya, this one is ","for you.","Not a list. One video, made for Northbank, with your clients' names on it.","Book fifteen minutes","For Priya"),
 "replies-enterprise": ("Marcus, built for ","Calder &amp; Vine.","Every person on your target list gets their own. Their name, your brand.","Book a conversation","For Marcus"),
 "booked-calls":       ("Elena, Tuesday in ","two minutes.","The rollout, what your clinicians see, and the number your board asked about.","Book the next call","For Elena"),
 "signed-proposals":   ("Sarah, the proposal, ","talked through.","The scope, the numbers from Tuesday, and the start date. That is the only decision left.","Sign and start","For Sarah"),
 "event-showups":      ("James, a personal ","invite.","Thursday, thirty minutes, live. Your seat is confirmed and the link is below.","Join Thursday","For James"),
 "ramped-reps":        ("Tom, welcome to ","module one.","First day to first demo, one short video at a time. Two weeks.","Start module one","For Tom"),
 "accepted-offers":    ("Maya, we would love ","a yes.","The panel came out of your final interview saying the same thing. That is the person.","Accept your offer","For Maya"),
 "investor-meetings":  ("Daniel, the raise in ","half a minute.","Two million to scale what is already working. Every number stands up to questioning.","Book fifteen minutes","For Daniel"),
}

def soften(hex_, a=0.12):
    h=hex_.lstrip('#'); r,g,b=(int(h[i:i+2],16) for i in (0,2,4))
    return f"rgba({r},{g},{b},{a})"

for c in brands:
    s=c['slug']; h1a,h1b,sub,cta,eyebrow = HEADS[s]
    cards="".join(
      f"<div class=card><div class=num>{i+1}</div><div class=ct>{t}</div><div class=cb>{b}</div></div>"
      for i,(t,b) in enumerate(BELOW[s]))
    html=HTML.format(css=CSS,hue=c['hue'],soft=soften(c['hue']),wm=wordmark(c['brand']),
                     cta=cta,eyebrow=eyebrow,h1a=h1a,h1b=h1b,sub=sub,cards=cards)
    p=BASE/"plates"/f"{s}.html"; p.write_text(html)
    subprocess.run(["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "--headless","--disable-gpu","--hide-scrollbars","--force-device-scale-factor=1",
      "--window-size=1600,1180",f"--screenshot={BASE}/plates/{s}.png",f"file://{p}"],
      check=True,capture_output=True)
    print("plate",s)
