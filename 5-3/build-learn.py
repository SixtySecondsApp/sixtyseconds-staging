#!/usr/bin/env python3
"""Generate the local Learn pages (blog + guides listings, one page per article)
from ../learn-staging/. Content is verbatim from the live site (ported 20 Aug by
the porter agents); this script wraps it in the 5-3 chrome, styled to match the
live site's learn design (27 Aug round): blog articles get breadcrumb, tag
pills, author row, opening callout, sticky in-this-article TOC, author bio and
related posts; guides become an interactive chapter reader (sticky chapter nav,
progress bar, one chapter at a time). Tags/read-times/guide metadata were read
off the live listing pages and live here in META. Re-runnable: regenerates
every blog-*.html / guide-*.html plus blog.html and guides.html."""
import json, os, re, html

BASE = os.path.dirname(os.path.abspath(__file__))
STAGE = os.path.join(BASE, "..", "learn-staging")

src = open(os.path.join(BASE, "index.html")).read()
VERSION = re.search(r"shared\.css\?v=(\d+)", src).group(1)
NAV = src[src.find("<nav"):src.find("</nav>") + 6]
# index's nav drives the demo with a <button data-demo> handled in index.js.
# These pages have no #hero and never load index.js, so point that button at
# the real demo instead, exactly as examples/how-it-works/proof do.
NAV = re.sub(
    r'<button type="button" class="btn small" data-demo[^>]*>(.*?)</button>',
    r'<a class="btn small" href="index.html#hero">\1</a>',
    NAV, flags=re.S)
FOOT = src[src.find("<footer"):src.find("</footer>") + 9]

# ── Live-site metadata (read off sixtyseconds.ai/learn, 27 Aug 2026) ────────
BLOG_META = {
  "ai-sdr-what-it-means-small-teams": {"tags": ["AI", "SDR", "Outreach"], "min": 7,
    "excerpt": "AI SDRs hit $5.81B in 2026 and the data is clear: hybrid human+AI teams close 41% more deals. Here’s what the numbers mean for a 2-person team competing against 15-person outbound squads."},
  "pipeline-velocity-metric-nobody-tracks": {"tags": ["Pipeline", "Metrics", "Strategy"], "min": 6,
    "excerpt": "One formula, four inputs, and the single number that tells you more about your sales health than any pipeline report. Teams that track velocity weekly grow 3x faster. Most teams don’t track it at all."},
  "sales-stack-command-center-not-another-tool": {"tags": ["Tools", "Strategy", "Stack"], "min": 6,
    "excerpt": "You’re paying $2,600–$14,000 per user per year across 4–6 tools that don’t talk to each other. The fix isn’t another integration. It’s a command center that sees all your context and acts on it."},
  "why-checking-in-is-worst-sales-email": {"tags": ["Follow-Up", "Email"], "min": 4,
    "excerpt": "“Just checking in” tells the buyer you have nothing new to offer. Every follow-up needs one test: does this email give the buyer a reason to reply that didn’t exist yesterday?"},
  "48-hour-rule-deals-die-in-silence": {"tags": ["Follow-Up", "Pipeline"], "min": 4,
    "excerpt": "The 48 hours after a sales meeting are where most deals are won or lost. Not in the negotiation. In the silence. Speed and specificity matter more than perfection."},
  "bafta-director-sales-lessons": {"tags": ["Story", "Strategy"], "min": 11,
    "excerpt": "At 16, Thomas Cook offered me Spain. Halo Films offered £2.50 an hour. I went for the obvious choice. Five years working under BAFTA award-winner Peter Georgi taught me one principle that still shapes everything I do in sales."},
  "crm-lying-to-you": {"tags": ["CRM", "Pipeline"], "min": 4,
    "excerpt": "If your CRM says a deal is in “discovery” but the buyer’s already evaluating competitors, your pipeline forecast is fiction. Here’s how to fix the data problem."},
  "stop-buying-tools-wire-them-together": {"tags": ["Tools", "Stack"], "min": 4,
    "excerpt": "Most small sales teams have enough tools. They just don’t talk to each other. The data from your meetings doesn’t flow into your CRM, follow-ups, or prep. That gap is where deals die."},
  "started-as-apprentice-now-hire-them": {"tags": ["Career", "Leadership"], "min": 4,
    "excerpt": "I started my career as an apprentice with nothing on my CV. 12 years later, I run a company and hire apprentices. Here’s why it’s the best investment a small company can make."},
  "best-ai-sales-tools-small-teams": {"tags": ["Tools", "AI"], "min": 14,
    "excerpt": "We mapped the top AI sales tools to the 6 jobs every small team needs done. No affiliate links, no hype. One tool per job, honest takes on weaknesses, and the exact stack we’d start with today."},
  "sales-follow-up-email-templates": {"tags": ["Follow-Up", "Email"], "min": 12,
    "excerpt": "Copy-paste templates for every sales scenario — discovery, demo, budget, gone quiet, multi-stakeholder, dead deal, and the AI-assisted version. With timing data and the formula that separates replies from silence."},
}

GUIDE_META = {
  "outreach-pillars-audience-offer-delivery": {"type": "Pillar Guide", "min": "18 min read",
    "sub": "Why most campaigns fail before they start — and the framework that fixes it",
    "desc": "Most outreach campaigns fail because one pillar is broken. Get the right audience, give them an offer they actually want, and reach them where they already are. A full framework plus a real case study: 2 years, £60k spent, 1,000+ calls booked, cost per lead halved.",
    "topics": ["Audience Targeting", "Offer Design", "Channel Strategy", "LinkedIn Ads", "Social Proof", "CPL Optimisation", "Multi-Channel"]},
  "small-team-ai-pipeline-playbook": {"type": "Playbook", "min": "25 min read",
    "sub": "From zero to predictable pipeline with AI tools, small budgets, and lean processes",
    "desc": "A 2-person team with the right AI stack produces the pipeline output of a 10-person team. This playbook covers ICP definition, research stacking, multi-channel outreach, follow-up automation, and the one metric that predicts revenue growth — step by step, tool by tool.",
    "topics": ["Pipeline", "AI Tools", "Small Teams", "ICP", "Outreach", "Automation"]},
  "ai-powered-sales-complete-guide": {"type": "Pillar Guide", "min": "20 min read",
    "sub": "From ICP to close, the definitive playbook for 2026",
    "desc": "Everything you need to know about AI-powered sales in 2026. Covers lead research, outreach automation, meeting prep, follow-up, pipeline management, and building a GTM motion that compounds.",
    "topics": ["ICP & Targeting", "Lead Research", "AI Outreach", "Meeting Prep", "Follow-up Automation", "Pipeline Intelligence", "GTM Velocity", "Measuring ROI"]},
  "sales-admin-audit": {"type": "Audit", "min": "10 min",
    "sub": "Find where your process is leaking revenue — 10 minutes, 30 questions, live scoring",
    "desc": "A 6-dimension scoring framework that reveals exactly where your sales process is leaking revenue. Score yourself across follow-up speed, CRM accuracy, meeting prep, post-meeting execution, pipeline visibility, and admin time ratio — with a live revenue leak calculator.",
    "topics": ["Follow-Up Speed", "CRM Accuracy", "Meeting Prep", "Post-Meeting", "Pipeline Visibility", "Admin Time", "Interactive"]},
  "recruitment-campaign-teardown": {"type": "Case Study", "min": "15 min read",
    "sub": "How a Manpower PEAK campaign generated leads at £1.13 each — and the 5 principles behind it",
    "desc": "A full teardown of the Manpower PEAK recruitment campaign that generated 4,300+ leads in 2 weeks at £1.13 per lead. Five tactics, the results, and the principles that apply to any high-volume sales or marketing motion.",
    "topics": ["Recruitment Marketing", "Campaign Strategy", "Social Ads", "Retargeting", "Friction Removal", "Lead Generation"]},
  "multi-channel-outreach-system": {"type": "Playbook", "min": "20 min read",
    "sub": "How to combine email and paid without spamming — and unlock the signals that reveal who’s ready to buy",
    "desc": "Most teams run email or paid ads as separate systems. The teams that win combine them into one engine where engagement signals from one channel trigger actions on another. Video watch duration, pricing page visits, return visits — the signals that tell you not just who’s interested, but how interested, in what, and when.",
    "topics": ["Email Outreach", "Paid Retargeting", "Video Watch Funnel", "Signal-Based Outreach", "Meta Ads", "LinkedIn Ads", "Engagement Scoring"]},
  "b2b-outreach-benchmarks-2026": {"type": "Benchmark Report", "min": "22 min read",
    "sub": "The definitive benchmark report — email, LinkedIn, phone, pipeline & AI stats from 100M+ data points",
    "desc": "Open rates, reply rates, LinkedIn acceptance, cold calling conversion, multichannel lift, sales cycle length, and AI impact — everything you need to know where your outreach stands in 2026, with benchmarks from billions of emails, 20M+ LinkedIn attempts, and 10M+ cold calls.",
    "topics": ["Cold Email", "Reply Rates", "LinkedIn Outreach", "Cold Calling", "Multichannel", "AI in Sales", "Buyer Behaviour"]},
  "post-meeting-sales-playbook": {"type": "Playbook", "min": "15 min read",
    "sub": "The 8-step system that closes the gap between good meetings and closed deals",
    "desc": "The exact post-meeting process top performers run after every sales call. Eight steps, clear time targets, and the follow-up system that ensures no deal falls through the cracks.",
    "topics": ["Raw Notes", "CRM Update", "Follow-Up Email", "Action Items", "Team Brief", "Follow-Up Cadence", "Automation"]},
}
GUIDE_ORDER = ["outreach-pillars-audience-offer-delivery", "small-team-ai-pipeline-playbook",
               "ai-powered-sales-complete-guide", "sales-admin-audit", "recruitment-campaign-teardown",
               "multi-channel-outreach-system", "b2b-outreach-benchmarks-2026", "post-meeting-sales-playbook"]

AUTHOR_BIO = ("Andrew Bryce is the founder and CEO of Sixty Seconds. Twelve years running "
              "go-to-market for high-growth B2B companies — now building personalised "
              "video outreach, made for one person at a time.")

BOOK_SVG = ('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>')

# ── Shared style blocks ─────────────────────────────────────────────────────
LISTING_CSS = """
.learn-wrap{max-width:1080px;margin:0 auto;padding:140px 28px 80px}
.lpill{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:rgb(var(--emerald-br));background:rgb(var(--emerald)/.08);border:1px solid rgb(var(--emerald)/.35);border-radius:99px;padding:7px 15px;margin-bottom:24px}
.learn-h1{font-family:'Cabinet';font-weight:800;font-size:clamp(44px,6vw,72px);letter-spacing:-.02em;margin:0 0 16px;line-height:1.02}
.learn-sub{font-size:clamp(16px,1.6vw,19px);color:rgb(var(--body));max-width:56ch;line-height:1.6;margin:0 0 54px}
.tagrow{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.tag{font-size:11.5px;font-weight:700;color:rgb(var(--emerald-br));border:1px solid rgb(var(--emerald)/.4);border-radius:99px;padding:4px 11px;display:inline-flex;align-items:center;gap:6px}
.tag.hot{background:rgb(var(--emerald)/.12)}
.learn-cta{margin-top:60px;padding:30px;border-radius:18px;text-align:center;background:rgb(var(--emerald)/.07);border:1px solid rgb(var(--emerald)/.3)}
.learn-cta p{margin:0 0 16px;color:rgb(var(--ink));font-weight:600}
"""

BLOG_LIST_CSS = LISTING_CSS + """
.feat-post{display:block;padding:38px 40px;border-radius:var(--r3);background:linear-gradient(158deg,rgb(var(--s2)/.85),rgb(var(--s1)/.92));border:1px solid rgb(var(--line-br)/.5);text-decoration:none;margin-bottom:26px;position:relative;overflow:hidden;transition:border-color 200ms cubic-bezier(0.23,1,0.32,1)}
.feat-post:before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 80% 60% at 100% 0%,rgb(var(--emerald)/.08),transparent 65%)}
@media (hover:hover) and (pointer:fine){.feat-post:hover{border-color:rgb(var(--emerald-br)/.5)}}
.feat-post h2{font-family:'Cabinet';font-weight:800;font-size:clamp(24px,3vw,34px);color:rgb(var(--ink));margin:0 0 14px;letter-spacing:-.01em;line-height:1.15}
.feat-post p{font-size:15.5px;color:rgb(var(--body));line-height:1.65;margin:0 0 24px;max-width:72ch}
.postmeta{display:flex;align-items:center;gap:18px;font-size:13px;color:rgb(var(--muted));flex-wrap:wrap}
.postmeta .who{display:inline-flex;align-items:center;gap:9px;color:rgb(var(--ink));font-weight:600}
.postmeta .pfp{width:34px;height:34px;border-radius:50%;object-fit:cover;border:1px solid rgb(var(--line-br)/.5)}
.postmeta .spacer{flex:1}
.post-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
.post-card{display:flex;flex-direction:column;padding:26px 26px 22px;border-radius:var(--r3);background:rgb(255 255 255/.03);border:1px solid rgb(255 255 255/.09);text-decoration:none;transition:transform 200ms cubic-bezier(0.23,1,0.32,1),border-color 200ms cubic-bezier(0.23,1,0.32,1)}
@media (hover:hover) and (pointer:fine){.post-card:hover{transform:translateY(-3px);border-color:rgb(var(--emerald-br)/.45)}}
.post-card h3{font-family:'Cabinet';font-weight:800;font-size:19px;line-height:1.3;color:rgb(var(--ink));margin:0 0 10px;letter-spacing:-.01em}
.post-card p{font-size:13.5px;color:rgb(var(--muted));line-height:1.6;margin:0 0 18px}
.post-foot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:12.5px;color:rgb(var(--faint))}
.post-foot .read{color:rgb(var(--emerald-br));font-weight:700;white-space:nowrap}
@media (max-width:760px){.post-grid{grid-template-columns:1fr}.feat-post{padding:28px 24px}}
"""

GUIDE_LIST_CSS = LISTING_CSS + """
.gcard{display:grid;grid-template-columns:1fr 300px;border-radius:var(--r3);background:linear-gradient(158deg,rgb(var(--s2)/.85),rgb(var(--s1)/.92));border:1px solid rgb(var(--line-br)/.5);margin-bottom:24px;overflow:hidden;position:relative}
.gcard:before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 70% 60% at 0% 0%,rgb(var(--emerald)/.06),transparent 60%)}
.gmain{padding:36px 38px;position:relative}
.gpills{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
.gcard h2{font-family:'Cabinet';font-weight:800;font-size:clamp(22px,2.6vw,30px);margin:0 0 8px;color:rgb(var(--ink));letter-spacing:-.01em;line-height:1.15}
.gcard h2 a{color:inherit;text-decoration:none}
@media (hover:hover) and (pointer:fine){.gcard h2 a:hover{color:rgb(var(--emerald-br))}}
.gsub{font-size:14px;color:rgb(var(--muted));margin:0 0 16px;line-height:1.5}
.gdesc{font-size:14.5px;color:rgb(var(--body));line-height:1.65;margin:0 0 20px;max-width:70ch}
.gchips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:26px}
.topic{font-size:11.5px;color:rgb(var(--muted));background:rgb(255 255 255/.05);border:1px solid rgb(255 255 255/.08);border-radius:99px;padding:4px 11px}
.grail{border-left:1px solid rgb(var(--line)/.6);padding:36px 30px;background:rgb(255 255 255/.015);position:relative}
.grail h4{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgb(var(--faint));margin:0 0 16px;font-weight:800}
.grail ol{list-style:none;margin:0;padding:0}
.grail li{display:flex;gap:10px;font-size:12.5px;color:rgb(var(--muted));margin-bottom:10px;line-height:1.45;align-items:flex-start}
.grail li b{flex-shrink:0;width:19px;height:19px;border-radius:50%;border:1px solid rgb(var(--line-br)/.6);font-size:10px;display:flex;align-items:center;justify-content:center;color:rgb(var(--faint));font-weight:700;margin-top:1px}
.grail .jump{display:inline-block;margin-top:8px;font-size:12.5px;font-weight:700;color:rgb(var(--emerald-br));text-decoration:none}
@media (max-width:860px){.gcard{grid-template-columns:1fr}.grail{border-left:0;border-top:1px solid rgb(var(--line)/.6)}.gmain{padding:28px 24px}}
"""

ART_CSS = """
.learn-wrap{max-width:1120px;margin:0 auto;padding:130px 28px 80px}
.crumb{font-size:12.5px;color:rgb(var(--muted));margin-bottom:22px}
.crumb a{color:inherit;text-decoration:none}
.crumb a:hover{color:rgb(var(--emerald-br))}
.tagrow{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
.tag{font-size:11.5px;font-weight:700;color:rgb(var(--emerald-br));border:1px solid rgb(var(--emerald)/.4);border-radius:99px;padding:4px 11px}
.learn-h1{font-family:'Cabinet';font-weight:800;font-size:clamp(30px,4.4vw,52px);line-height:1.08;letter-spacing:-.02em;margin:0 0 20px;max-width:24ch}
.byline{display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:13.5px;color:rgb(var(--muted));margin-bottom:40px}
.byline .avatar{width:52px;height:52px;border-radius:50%;object-fit:cover;border:1px solid rgb(var(--line-br)/.5)}
.byline b{display:block;color:rgb(var(--ink));font-size:14px;font-weight:700}
.byline .role{display:block;font-size:12px}
.byline .dot{color:rgb(var(--faint))}
.art-cols{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:56px;align-items:start}
.toc{position:sticky;top:100px;border:1px solid rgb(var(--line)/.6);border-radius:var(--r3);padding:22px 24px;background:rgb(255 255 255/.02)}
.toc h4{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgb(var(--faint));margin:0 0 14px;font-weight:800}
.toc a{display:block;font-size:13px;color:rgb(var(--muted));text-decoration:none;padding:5px 0;line-height:1.4;border-left:2px solid transparent;padding-left:12px;margin-left:-12px}
.toc a:hover{color:rgb(var(--ink))}
.toc a.on{color:rgb(var(--emerald-br));border-left-color:rgb(var(--emerald-br))}
.callout{border:1px solid rgb(var(--emerald)/.35);background:rgb(var(--emerald)/.06);border-radius:var(--r3);padding:20px 24px;margin:0 0 32px}
.callout h5{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgb(var(--emerald-br));margin:0 0 8px;font-weight:800}
.callout p{margin:0;font-size:15px;line-height:1.65;color:rgb(var(--ink))}
.art{font-size:16.5px;line-height:1.75;color:rgb(var(--body))}
.art h2{font-family:'Cabinet';font-weight:800;font-size:26px;color:rgb(var(--ink));margin:44px 0 14px;letter-spacing:-.01em;scroll-margin-top:100px}
.art h3{font-weight:700;font-size:19px;color:rgb(var(--ink));margin:32px 0 10px}
.art p{margin:0 0 18px}
.art ul,.art ol{margin:0 0 18px;padding-left:24px}
.art li{margin-bottom:8px}
.art a{color:rgb(var(--emerald-br))}
.art blockquote{border-left:3px solid rgb(var(--violet-br)/.7);margin:24px 0;padding:12px 20px;color:rgb(var(--ink));background:rgb(var(--violet)/.07);border-radius:0 12px 12px 0;font-style:italic}
.art table{width:100%;border-collapse:collapse;margin:24px 0;font-size:14px;display:block;overflow-x:auto}
.art th,.art td{border:1px solid rgb(var(--line-br)/.5);padding:9px 12px;text-align:left}
.art th{color:rgb(var(--ink));background:rgb(255 255 255/.04)}
.art em{color:rgb(var(--muted))}
.art-img{margin:28px 0}
.art-img img{width:100%;height:auto;border-radius:var(--r3);border:1px solid rgb(var(--line)/.5)}
.art-logo{margin:36px 0 -6px}
.art-logo img{width:48px;height:48px;border-radius:12px;border:1px solid rgb(var(--line)/.5);background:rgb(255 255 255/.05);padding:4px}
.bio{display:flex;gap:18px;align-items:flex-start;border:1px solid rgb(var(--line)/.6);border-radius:var(--r3);padding:26px 28px;margin-top:56px;background:rgb(255 255 255/.02)}
.bio .avatar{flex-shrink:0;width:64px;height:64px;border-radius:50%;object-fit:cover;border:1px solid rgb(var(--line-br)/.5)}
.bio b{display:block;font-size:15px;color:rgb(var(--ink));margin-bottom:2px}
.bio .role{font-size:12.5px;color:rgb(var(--muted));margin-bottom:10px}
.bio p{margin:0;font-size:14px;line-height:1.6;color:rgb(var(--body))}
.rel{margin-top:56px}
.rel h3{font-family:'Cabinet';font-weight:800;font-size:22px;margin:0 0 18px}
.rel-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
.rel-card{display:block;padding:20px 22px;border-radius:var(--r3);background:rgb(255 255 255/.03);border:1px solid rgb(255 255 255/.09);text-decoration:none;transition:transform 200ms cubic-bezier(0.23,1,0.32,1),border-color 200ms cubic-bezier(0.23,1,0.32,1)}
@media (hover:hover) and (pointer:fine){.rel-card:hover{transform:translateY(-3px);border-color:rgb(var(--emerald-br)/.45)}}
.rel-card .tagrow{margin-bottom:10px}
.rel-card b{display:block;font-family:'Cabinet';font-weight:800;font-size:16px;line-height:1.3;color:rgb(var(--ink));margin-bottom:8px}
.rel-card span{font-size:12.5px;font-weight:700;color:rgb(var(--emerald-br))}
.learn-cta{margin-top:60px;padding:30px;border-radius:18px;text-align:center;background:rgb(var(--emerald)/.07);border:1px solid rgb(var(--emerald)/.3)}
.learn-cta p{margin:0 0 16px;color:rgb(var(--ink));font-weight:600}
@media (max-width:900px){.art-cols{grid-template-columns:1fr}.toc{position:static;order:-1}.rel-grid{grid-template-columns:1fr}}
"""

GUIDE_ART_CSS = """
.learn-wrap{max-width:1160px;margin:0 auto;padding:120px 28px 80px}
.crumb{font-size:12.5px;color:rgb(var(--muted));margin-bottom:20px}
.crumb a{color:inherit;text-decoration:none}
.crumb a:hover{color:rgb(var(--emerald-br))}
.gpills{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.tag{font-size:11.5px;font-weight:700;color:rgb(var(--emerald-br));border:1px solid rgb(var(--emerald)/.4);border-radius:99px;padding:4px 11px}
.learn-h1{font-family:'Cabinet';font-weight:800;font-size:clamp(28px,3.8vw,44px);line-height:1.08;letter-spacing:-.02em;margin:0 0 22px}
.gprog{display:flex;align-items:center;gap:16px;margin-bottom:34px}
.gprog .glab{flex-shrink:0;font-size:12px;color:rgb(var(--muted));min-width:104px}
.gprog .track{flex:1;height:4px;border-radius:4px;background:rgb(255 255 255/.07);overflow:hidden}
.gprog .track i{display:block;height:100%;width:0;border-radius:4px;background:linear-gradient(90deg,rgb(var(--teal-br)),rgb(var(--violet-br)));transition:width 300ms cubic-bezier(0.23,1,0.32,1)}
.gprog .gpct{flex-shrink:0;font-size:12px;color:rgb(var(--faint));min-width:34px;text-align:right}
.gcols{display:grid;grid-template-columns:250px minmax(0,1fr);gap:48px;align-items:start}
.gnav{position:sticky;top:100px;border:1px solid rgb(var(--line)/.6);border-radius:var(--r3);padding:20px 18px;background:rgb(255 255 255/.02)}
.gnav h4{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgb(var(--faint));margin:0 0 12px;font-weight:800;padding-left:8px}
.gnav a{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;color:rgb(var(--muted));text-decoration:none;padding:8px;border-radius:10px;line-height:1.4}
.gnav a b{flex-shrink:0;width:19px;height:19px;border-radius:50%;border:1px solid rgb(var(--line-br)/.6);font-size:10px;display:flex;align-items:center;justify-content:center;color:rgb(var(--faint));font-weight:700;margin-top:1px}
.gnav a.on{background:rgb(var(--violet)/.12);color:rgb(var(--ink))}
.gnav a.on b{border-color:rgb(var(--violet-br)/.7);color:rgb(var(--violet-br))}
@media (hover:hover) and (pointer:fine){.gnav a:hover{color:rgb(var(--ink))}}
.gch{display:none}
.gch.on{display:block}
.no-js .gch{display:block}
.chlabel{font-size:13px;font-weight:700;color:rgb(var(--violet-br));margin-bottom:6px}
.art{font-size:16.5px;line-height:1.75;color:rgb(var(--body))}
.art h2{font-family:'Cabinet';font-weight:800;font-size:clamp(24px,2.8vw,32px);color:rgb(var(--ink));margin:0 0 18px;letter-spacing:-.01em}
.art h3{font-weight:700;font-size:19px;color:rgb(var(--ink));margin:32px 0 10px}
.art p{margin:0 0 18px}
.art ul,.art ol{margin:0 0 18px;padding-left:24px}
.art li{margin-bottom:8px}
.art a{color:rgb(var(--emerald-br))}
.art blockquote{border:1px solid rgb(var(--emerald)/.35);background:rgb(var(--emerald)/.06);margin:24px 0;padding:16px 22px;color:rgb(var(--ink));border-radius:var(--r3)}
.art table{width:100%;border-collapse:collapse;margin:24px 0;font-size:14px;display:block;overflow-x:auto}
.art th,.art td{border:1px solid rgb(var(--line-br)/.5);padding:9px 12px;text-align:left}
.art th{color:rgb(var(--ink));background:rgb(255 255 255/.04)}
.art em{color:rgb(var(--muted))}
.art-img{margin:28px 0}
.art-img img{width:100%;height:auto;border-radius:var(--r3);border:1px solid rgb(var(--line)/.5);background:rgb(255 255 255/.02)}
.art-svg{margin:28px 0;border-radius:var(--r3);border:1px solid rgb(var(--line)/.5);background:rgb(255 255 255/.02);padding:18px}
.art-svg svg{display:block;width:100%;height:auto}
.art-logo{margin:36px 0 -6px}
.art-logo img{width:48px;height:48px;border-radius:12px;border:1px solid rgb(var(--line)/.5);background:rgb(255 255 255/.05);padding:4px}
.gbtns{display:flex;justify-content:space-between;gap:14px;margin-top:44px}
.gbtns .btn.ghost[hidden]{visibility:hidden}
.learn-cta{margin-top:60px;padding:30px;border-radius:18px;text-align:center;background:rgb(var(--emerald)/.07);border:1px solid rgb(var(--emerald)/.3)}
.learn-cta p{margin:0 0 16px;color:rgb(var(--ink));font-weight:600}
@media (max-width:900px){.gcols{grid-template-columns:1fr}.gnav{position:static}}
"""

GUIDE_JS = """
(function(){
  document.documentElement.classList.remove('no-js');
  var chs=[].slice.call(document.querySelectorAll('.gch'));
  var nav=[].slice.call(document.querySelectorAll('.gnav a'));
  var bar=document.querySelector('.gprog .track i');
  var lab=document.querySelector('.gprog .glab');
  var pct=document.querySelector('.gprog .gpct');
  var prev=document.getElementById('gprev'), next=document.getElementById('gnext');
  var titles=chs.map(function(c){return c.getAttribute('data-title')});
  var cur=0;
  function show(i,scroll){
    cur=Math.max(0,Math.min(chs.length-1,i));
    chs.forEach(function(c,k){c.classList.toggle('on',k===cur)});
    nav.forEach(function(n,k){n.classList.toggle('on',k===cur)});
    var p=Math.round((cur+1)/chs.length*100);
    bar.style.width=p+'%'; pct.textContent=p+'%';
    lab.textContent='Chapter '+(cur+1)+' of '+chs.length;
    prev.hidden=cur===0;
    if(cur<chs.length-1){next.hidden=false;next.textContent='Next: '+titles[cur+1]+' \\u2192';}
    else{next.hidden=true;}
    history.replaceState(null,'','#ch'+(cur+1));
    if(scroll!==false){window.scrollTo({top:0,behavior:'instant'})}
  }
  nav.forEach(function(n,k){n.addEventListener('click',function(e){e.preventDefault();show(k)})});
  prev.addEventListener('click',function(){show(cur-1)});
  next.addEventListener('click',function(){show(cur+1)});
  var m=(location.hash||'').match(/^#ch(\\d+)$/);
  show(m?parseInt(m[1],10)-1:0,false);
  /* a #chN link followed while already on the page only fires hashchange —
     without this the URL moved and the reader did not */
  window.addEventListener('hashchange',function(){
    var h=(location.hash||'').match(/^#ch(\\d+)$/);
    if(h){var i=parseInt(h[1],10)-1; if(i!==cur) show(i);}
  });
})();
"""

PAGE = """<!doctype html>
<html lang="en"{htmlcls}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{ptitle}</title>
<meta name="description" content="{desc}">
<meta property="og:type" content="{ogtype}">
<meta property="og:title" content="{ptitle}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="https://www.sixtyseconds.ai/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{ptitle}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="https://www.sixtyseconds.ai/og-image.png">
<link rel="canonical" href="{url}">
<meta property="og:url" content="{url}">
<meta property="og:site_name" content="Sixty Seconds">
<script defer data-domain="sixtyseconds.ai" src="https://plausible.io/js/script.js"></script>
<link rel="icon" type="image/png" sizes="32x32" href="../media/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="../media/favicon-16.png">
<link rel="apple-touch-icon" href="../media/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="shared.css?v={v}">
<style>{css}</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<span class="grid-tex" aria-hidden="true"></span>
{nav}
<main id="main">
<div class="learn-wrap">
{body}
<div class="learn-cta rv in">
  <p>From the team behind this guide: personalised video, built for one person at a time. Watch one get built for you.</p>
  <a class="btn big" href="index.html#hero">Try the live demo</a>
</div>
</div>
</main>
{foot}
<script src="shared.js?v={v}" defer></script>{extra_js}
</body>
</html>
"""

def esc(s):
    return html.escape(s or "", quote=True)

# Listing copy is ours (not ported article text), so the site's no-em-dash
# rule applies; gate.sh checks every non-article page.
def dash(s):
    return s.replace(" — ", " - ").replace("—", "-")

# Live-site article images, scraped 27 Aug (sixtyseconds.ai/images + logo.dev
# tool marks), stored at ../media/learn/. Keyed by the ported bodies'
# [image: ...] placeholder text. Placeholders with no live asset (the
# multi-channel funnel is an inline SVG animation on live) are dropped.
IMG = {
  "CRM with stale pipeline data": "blog-crm-lying.jpg",
  "Just checking in email visual": "blog-checking-in-email.jpg",
  "Buyer intent decay over time": "blog-48-hour-rule.jpg",
  "Filmmaking and sales - every scene must move the story": "blog-bafta-director.jpg",
  "Connected sales tool network": "blog-stop-buying-tools.jpg",
  "Career journey from apprentice to leader": "blog-apprentice.jpg",
  "AI sales tools visualization": "blog-ai-tools-hero.jpg",
  "HubSpot CRM": "logo-hubspot.png",
  "Apollo.io": "logo-apollo.png",
  "Fireflies.ai": "logo-fireflies.png",
  "60": "logo-60.png",
  "Clay": "logo-clay.png",
  "Gong": "logo-gong.png",
  "The three pillars of outreach flywheel": "pillar-flywheel.svg",
  "Audience targeting radar diagram": "pillar-audience.svg",
  "Offer magnetic pull diagram": "pillar-offer.svg",
  "Multi-channel convergence flow diagram": "pillar-channel.svg",
}
AVATAR = '../media/learn/avatar-andrew.jpg'

# The ported bodies carry the OLD site's plumbing: "Explore 60" points at
# use60.com (a different product site), "Book a call" at a /contact route
# this build does not have, and the two anchors sit back to back with no
# separator. Rewrite to this site's own destinations and space the pair.
BOOKING = "https://savvycal.com/sixtyseconds/U065T5J2M61"
def fix_links(body_html):
    body_html = re.sub(r'href="https?://(www\.)?use60\.com/?"', 'href="index.html"', body_html)
    body_html = body_html.replace('href="/contact"', f'href="{BOOKING}" target="_blank" rel="noopener noreferrer"')
    body_html = body_html.replace("</a><a ", "</a> &middot; <a ")
    # old-site internal routes -> this build's flat filenames
    body_html = re.sub(r'href="/learn/blog/([a-z0-9-]+)/?"', r'href="blog-\1.html"', body_html)
    body_html = re.sub(r'href="/learn/guides/([a-z0-9-]+)/?"', r'href="guide-\1.html"', body_html)
    return body_html

def replace_images(body_html):
    def sub(m):
        alt = m.group(1).strip()
        fn = IMG.get(alt)
        if not fn:
            return ""
        if fn.endswith(".svg"):
            # CSS-animated diagrams: inline them so the animations run
            # (they are inert inside an <img>)
            svg = open(os.path.join(BASE, "..", "media", "learn", fn)).read()
            svg = svg[svg.find("<svg"):]
            return f'<figure class="art-svg" role="img" aria-label="{esc(alt)}">{svg}</figure>'
        cls = "art-logo" if fn.startswith("logo-") else "art-img"
        return (f'<figure class="{cls}"><img src="../media/learn/{fn}" '
                f'alt="{esc(alt)}" loading="lazy"></figure>')
    return re.sub(r"<p><em>\[image:\s*([^\]]*)\]</em></p>", sub, body_html)

def write_page(fn, title, desc, css, body, extra_js="", htmlcls="", brand_first=False, ogtype="article"):
    # Articles and guides lead with their own title so the SERP shows the
    # content, not 15 chars of brand; the two listing pages keep the site's
    # brand-first convention to match the hand-built pages.
    ptitle = ("Sixty Seconds · " + title) if brand_first else (title + " · Sixty Seconds")
    out = PAGE.format(ptitle=esc(ptitle), desc=esc(desc if len(desc)<=155 else desc[:155].rsplit(" ",1)[0]), v=VERSION, nav=NAV,
                      foot=FOOT, css=css, body=body, extra_js=extra_js, htmlcls=htmlcls,
                      ogtype=ogtype, url=f"https://www.sixtyseconds.ai/{fn.removesuffix('.html')}")
    open(os.path.join(BASE, fn), "w").write(out)

def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", re.sub(r"<[^>]+>", "", s).lower()).strip("-")

def tagpills(tags, hot=None):
    out = f'<span class="tag hot">{esc(hot)}</span>' if hot else ""
    return f'<div class="tagrow">{out}' + "".join(f'<span class="tag">{esc(t)}</span>' for t in tags) + "</div>"

# Detect the live site's opening callout: a short label <p> followed by the
# summary <p> ("Quick Take", "The Problem", "The Short Version"...).
def split_callout(body_html):
    m = re.match(r"\s*<p>([^<]{2,30})</p>\s*<p>(.*?)</p>", body_html, re.S)
    if m and not m.group(1).rstrip().endswith((".", "?", "!")):
        rest = body_html[m.end():]
        return m.group(1), m.group(2), rest
    return None, None, body_html

def heading_ids(body_html):
    toc = []
    def sub(m):
        text = m.group(1)
        hid = slugify(text)
        toc.append((hid, text))
        return f'<h2 id="{hid}">{text}</h2>'
    return re.sub(r"<h2[^>]*>(.*?)</h2>", sub, body_html), toc

def build_blog_article(j, idx_order):
    slug, meta = j["slug"], BLOG_META[j["slug"]]
    label, summary, rest = split_callout(replace_images(fix_links(j["body_html"])))
    body_html, toc = heading_ids(rest)
    callout = (f'<div class="callout"><h5>{esc(label)}</h5><p>{summary}</p></div>'
               if label else "")
    toc_html = ""
    if toc:
        links = "".join(f'<a href="#{h}">{t}</a>' for h, t in toc)
        toc_html = f'<aside class="toc"><h4>In this article</h4>{links}</aside>'
    related = [s for s in idx_order if s != slug and set(BLOG_META[s]["tags"]) & set(meta["tags"])][:2]
    if len(related) < 2:
        related += [s for s in idx_order if s != slug and s not in related][:2 - len(related)]
    rel_cards = "".join(
        f'<a class="rel-card" href="blog-{s}.html">{tagpills(BLOG_META[s]["tags"])}'
        f'<b>{esc(next(i["title"] for i in BLOG_IDX if i["slug"] == s))}</b>'
        f'<span>Read more →</span></a>' for s in related)
    body = (
        f'<div class="crumb"><a href="blog.html">‹ Blog</a> <span style="opacity:.4">/</span> {esc(j["title"])}</div>'
        + tagpills(meta["tags"])
        + f'<h1 class="learn-h1">{esc(j["title"])}</h1>'
        + f'<div class="byline"><img class="avatar" src="{AVATAR}" alt="Andrew Bryce" loading="lazy"><span><b>Andrew Bryce</b>'
          f'<span class="role">Founder &amp; CEO, Sixty Seconds</span></span>'
          f'<span class="dot">·</span><span>{esc(j.get("date") or "")}</span>'
          f'<span class="dot">·</span><span>{meta["min"]} min read</span></div>'
        + f'<div class="art-cols"><div>{callout}<article class="art">{body_html}</article>'
        + f'<div class="bio"><img class="avatar" src="{AVATAR}" alt="Andrew Bryce" loading="lazy"><div><b>Andrew Bryce</b>'
          f'<div class="role">Founder &amp; CEO, Sixty Seconds</div><p>{esc(AUTHOR_BIO)}</p></div></div>'
        + f'<div class="rel"><h3>Related articles</h3><div class="rel-grid">{rel_cards}</div></div>'
        + f'</div>{toc_html}</div>')
    write_page(f"blog-{slug}.html", j["title"], meta["excerpt"], ART_CSS, body)
    # TOC active-highlight
    return

def build_guide_article(j):
    slug, meta = j["slug"], GUIDE_META[j["slug"]]
    parts = re.split(r"(?=<h2)", replace_images(fix_links(j["body_html"])))
    parts = [p for p in parts if p.strip()]
    chapters = []
    for p in parts:
        m = re.match(r"<h2[^>]*>(.*?)</h2>", p, re.S)
        title = re.sub(r"<[^>]+>", "", m.group(1)) if m else "Introduction"
        chapters.append((title, p))
    n = len(chapters)
    navlinks = "".join(
        f'<a href="#ch{i+1}"><b>{i+1}</b>{esc(html.unescape(t))}</a>'
        for i, (t, _) in enumerate(chapters))
    sections = "".join(
        f'<section class="gch{" on" if i == 0 else ""}" data-title="{esc(html.unescape(t))}">'
        f'<div class="chlabel">Chapter {i+1}</div><article class="art">{p}</article></section>'
        for i, (t, p) in enumerate(chapters))
    pills = (f'<div class="gpills"><span class="tag">{esc(meta["type"])}</span>'
             f'<span class="tag">{n} chapters</span><span class="tag">{esc(meta["min"])}</span></div>')
    body = (
        f'<div class="crumb"><a href="guides.html">‹ Back to Guides</a></div>'
        + pills
        + f'<h1 class="learn-h1">{esc(j["title"])}</h1>'
        + f'<div class="gprog"><span class="glab">Chapter 1 of {n}</span>'
          f'<span class="track"><i style="width:{round(100/n)}%"></i></span>'
          f'<span class="gpct">{round(100/n)}%</span></div>'
        + f'<div class="gcols"><nav class="gnav"><h4>Chapters</h4>{navlinks}</nav>'
        + f'<div>{sections}'
        + f'<div class="gbtns"><button type="button" class="btn ghost" id="gprev" hidden>← Previous</button>'
          f'<button type="button" class="btn" id="gnext">Next chapter →</button></div>'
        + f'</div></div>')
    write_page(f"guide-{slug}.html", j["title"], meta["desc"], GUIDE_ART_CSS, body,
               extra_js=f"\n<script>{GUIDE_JS}</script>", htmlcls=' class="no-js"')

def build_blog_listing(idx):
    feat = idx[0]
    fm = BLOG_META[feat["slug"]]
    feat_html = (
        f'<a class="feat-post" href="blog-{feat["slug"]}.html">'
        + tagpills(fm["tags"], hot="Latest")
        + f'<h2>{esc(feat["title"])}</h2><p>{esc(dash(fm["excerpt"]))}</p>'
        + f'<div class="postmeta"><span class="who"><img class="pfp" src="{AVATAR}" alt="" loading="lazy">Andrew Bryce</span><span>{fm["min"]} min read</span>'
          f'<span>{esc(feat.get("date") or "")}</span><span class="spacer"></span>'
          f'<span class="btn small">Read article →</span></div></a>')
    cards = "".join(
        f'<a class="post-card" href="blog-{i["slug"]}.html">'
        + tagpills(BLOG_META[i["slug"]]["tags"])
        + f'<h3>{esc(i["title"])}</h3><p>{esc(dash(BLOG_META[i["slug"]]["excerpt"]))}</p>'
        + f'<div class="post-foot"><span>{BLOG_META[i["slug"]]["min"]} min read · {esc(i.get("date") or "")}</span>'
          f'<span class="read">Read →</span></div></a>'
        for i in idx[1:])
    body = (f'<div class="lpill">{BOOK_SVG}The Sixty Seconds Blog</div>'
            f'<h1 class="learn-h1">Blog</h1>'
            f'<p class="learn-sub">Practical thinking on AI-powered sales, GTM strategy, and building pipeline that converts.</p>'
            + feat_html + f'<div class="post-grid">{cards}</div>')
    write_page("blog.html", "Blog", "Practical thinking on AI-powered sales, GTM strategy, and building pipeline that converts.",
               BLOG_LIST_CSS, body, brand_first=True, ogtype="website")

def build_guide_listing(guides):
    cards = ""
    for j in guides:
        slug, meta = j["slug"], GUIDE_META[j["slug"]]
        h2s = re.findall(r"<h2[^>]*>(.*?)</h2>", j["body_html"])
        chs = "".join(f'<li><b>{i+1}</b>{re.sub(r"<[^>]+>", "", t)}</li>' for i, t in enumerate(h2s))
        topics = "".join(f'<span class="topic">{esc(t)}</span>' for t in meta["topics"])
        cards += (
            f'<div class="gcard"><div class="gmain">'
            f'<div class="gpills"><span class="tag">{esc(meta["type"])}</span>'
            f'<span class="tag">{len(h2s)} chapters</span><span class="tag">{esc(meta["min"])}</span></div>'
            f'<h2><a href="guide-{slug}.html">{esc(j["title"])}</a></h2>'
            f'<p class="gsub">{esc(dash(meta["sub"]))}</p><p class="gdesc">{esc(dash(meta["desc"]))}</p>'
            f'<div class="gchips">{topics}</div>'
            f'<a class="btn small" href="guide-{slug}.html">Start reading →</a></div>'
            f'<div class="grail"><h4>Chapters</h4><ol>{chs}</ol>'
            f'<a class="jump" href="guide-{slug}.html">Jump to any chapter →</a></div></div>')
    body = (f'<div class="lpill">{BOOK_SVG}In-Depth Guides</div>'
            f'<h1 class="learn-h1">Guides</h1>'
            f'<p class="learn-sub">Structured playbooks for building AI-powered sales motions. Start to finish, no shortcuts skipped.</p>'
            + cards)
    write_page("guides.html", "Guides", "Structured playbooks for building AI-powered sales motions. Start to finish, no shortcuts skipped.",
               GUIDE_LIST_CSS, body, brand_first=True, ogtype="website")

# ── run ─────────────────────────────────────────────────────────────────────
BLOG_IDX = json.load(open(os.path.join(STAGE, "blog", "index.json")))
blog_order = [i["slug"] for i in BLOG_IDX]
for item in BLOG_IDX:
    j = json.load(open(os.path.join(STAGE, "blog", item["slug"] + ".json")))
    build_blog_article(j, blog_order)
build_blog_listing(BLOG_IDX)
print("blog built:", len(BLOG_IDX), "articles + listing")

guide_docs = []
for slug in GUIDE_ORDER:
    j = json.load(open(os.path.join(STAGE, "guides", slug + ".json")))
    guide_docs.append(j)
    build_guide_article(j)
build_guide_listing(guide_docs)
print("guides built:", len(guide_docs), "guides + listing")
