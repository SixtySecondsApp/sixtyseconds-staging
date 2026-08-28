# ss53 example films — placement manifest

> ## IF YOU RE-RENDER ANY FILM, RUN THESE. THEY ARE NOT OPTIONAL.
>
> ```bash
> cd media/examples/ss53-build
> python3 checkbeats.py     # anchors exist and are in script order
> python3 align.py          # beat starts, forced-aligned to the NEW baked audio
> python3 vogate.py         # the audio actually says what the script says
> python3 emit.py           # regenerate ssExamplesData.ts
> node ../../5-3/.harness/ambwin.cjs --sheet   # re-pick the ambient windows, then LOOK
> ```
>
> Every defect this set has produced was a **cross-artefact** one: the film was
> fine, the script was fine, the manifest was fine — what was wrong was the
> relationship between two of them. A check that opens one artefact can never
> see it, and no screenshot ever will.
>
> - Skip `vogate.py` and the on-screen line silently stops matching the audio
>   underneath it. It has already caught a brand name read as "Colder and Vi"
>   and an offer video closing on "we really hope to see yes".
> - Skip `align.py` and every beat lands at the wrong moment, because the voice
>   reads at ~222 wpm, not the 176 in our notes.
> - Skip `ambwin.cjs` and the wall parks on a timestamp that points into the
>   previous render. Nothing in the harness compares a window to the film it
>   points into, so this one is invisible to every visual check we have.
>
> ### Rendering on this machine — read before you queue a pass
>
> **Concurrency 1 is the only working configuration, and the render cannot be
> sped up by settings.** Established by trying, not assumed:
>
> - Remotion's bundled Chrome cannot spawn at all: `spawn Unknown system error -88`.
> - System Chrome (`--browser-executable=/Applications/Google Chrome.app/...`)
>   works, but above `--concurrency=1` it fails with the bundle server
>   unreachable ("Visited http://localhost:3000/index.html but got no response").
>
> So a full eight-film pass takes as long as the box allows. Observed between
> 90 minutes and many hours on the same day, entirely dependent on what else is
> running. At one point the render was getting 21% CPU while other processes
> held 93%, 48% and 36% at load 12 on ten cores.
>
> A large part of that contention is **our own harness runs**, and the effect is
> not marginal. One Playwright sweep is ~120 page loads and will pin most of a
> core for minutes; three sessions looping them will starve a render.
>
> **Measured, same box, same concurrency, same code:** ~40 minutes per film with
> three sessions running sweeps, ~90 seconds per film with all sweeps paused.
> **Roughly 25x.** If a long render is queued, stop re-measuring things already
> known green — it is the single largest lever available and it costs nothing.

> ### What the automated checks CANNOT tell you
>
> `ss53-build/` verifies the page against **this manifest**, and `align.py` /
> `vogate.py` verify the beat timing and the spoken audio against **the film**.
> Nothing verifies the manifest against the film's **burned-in plate text**.
>
> So a check can report clean on a page that faithfully matches a manifest
> describing a film that no longer exists. That is not a hypothetical: it is the
> direction that has actually bitten this project, and a manifest-derived check
> cannot fail in it by construction.
>
> **The only thing that closes that loop is a person pulling frames and looking.**
> Do it on every re-render. Two known instances, both caught by eye and neither
> by a check: a brand name read aloud as "Colder and Vi", and a plate still
> reading "EXAMPLE, NOT A CUSTOMER" for hours after the page had been corrected
> to say "invented" — which a cold reader correctly diagnosed as captions
> patched without the films being re-rendered.

The eight per-outcome films on `redesign/5-3/examples.html`, built 2026-08-24.
They replace the six raw full-frame talking heads that MEDIA-BRIEF.md calls out
as "never the product", and they resolve the presenter-identity problem the old
manifest created.

## Read this before writing any copy about these films

**Presenter attribution is evidence here, not assertion.** The previous version of
this manifest attributed five renders to "Andrew clone" in two different looks.
A blind reader looking only at the rendered pages said the men were visibly
different people, and on inspection they were right — the old set reads as three
different men. Andrew has separately confirmed he does not know who the presenter
in `wave-ai-opt.mp4` is either. So this manifest records what was *verified through
the API at render time*, and nothing beyond it:

```
GET avatar look 85c0137ce0c948328ae5cea7dc984fb8
  -> { name: "Black T-Shirt", avatar_type: "photo_avatar",
       group_id: "028ac9a26cf144bf9775f6fe9c295289",
       default_voice_id: "11cc0c2e497143dd989f42e051f831a9",
       supported_api_engines: ["avatar_v","avatar_iv","avatar_iii"],
       image_width: 768, image_height: 1376, status: "completed" }
Account: andrew.bryce@sixtyseconds.video (Pro plan)
```

All eight films use **that one look and that one voice**. Nothing else. That is
deliberate: it settles the "one recording, one look" open question by
construction rather than by curation, so the presenter cannot appear to change
clothes between two films playing near each other, on this page or any other.

**Even so, the pages do not name him.** `examples.html` carries the disclosure
wording rather than a per-card attribution:

> On your videos it is your face and your voice. Andrew is our founder: he filmed
> once, and the AI rebuilds his face and voice for every video after that.

Naming him on this page while the seven outcome pages name nobody would be worse
than neither. When Andrew confirms the older renders, the names can go back
everywhere at once.

**Recipients are fictional first names only.** Priya, Marcus, Elena, Sarah, James,
Tom, Maya, Daniel. The companies are invented. No face is ever paired with a full
surname anywhere on the page — a blind sceptic flagged that pairing as the line
that flips an illustrative record into an apparently real one.

## How they were built

- **Avatar:** HeyGen Avatar V, `9:16` native 1080p (never 1:1 or 16:9 — a portrait
  look rendered to a square crops the top of the head off, unrecoverably), motion
  prompt "subtle hand gestures, warm and confident".
- **Voice:** the look's own default cloned voice, `11cc0c2e497143dd989f42e051f831a9`.
  **Deviation to note:** the locked house recipe generates VO in ElevenLabs
  (`BSFB1VczHwwX8aBndAJH`) and feeds it to HeyGen as an audio asset for lip-sync.
  That path was unavailable — the AWS credentials in `~/.demo-engine/agents-sixty.env`
  are rotated out, so `/agents-sixty/global/app` returns `UnrecognizedClientException`
  and no ElevenLabs key can be read. Rather than substitute a different voice, these
  use HeyGen's own Andrew clone, which is the pairing the previous example renders
  already used. **Restoring vault access is an open item.**
- **Composition:** `60-wave-videos/video/src/SsExamples.tsx`, one generic film driven
  by `ssExamplesData.ts`, registered in the isolated entry `src/ssexamples-entry.tsx`
  so the shared `Root.tsx` (dirty with another session's work) is never touched.
  Render: `./node_modules/.bin/remotion render src/ssexamples-entry.tsx ex-<slug> ... --public-dir=ssexamples-public --concurrency=1`.
- **fps:** HeyGen's 25fps source resampled to 30 with `-vf fps=30` (duration-preserving),
  asserted equal to the source duration within 50ms. Never `-r 30`, which relabels
  frames and slides the lips off the voice.
- **Beat timing:** forced-aligned against each film's OWN baked audio with
  faster-whisper word timestamps, matched by character coverage rather than
  lockstep tokenisation. The voice reads at roughly **222 wpm**, well above the
  176 wpm in our notes, so any words-per-minute estimate would have drifted late.

## The VO gate — the most important thing on this page

Every film's baked audio was transcribed and diffed against the script it was
given. **Three of the eight failed on the first pass** and were re-rendered. The
worst was the closing line of the offer video, directly beneath the CTA:

> script: "We really hope it's a yes."  → spoken: "We really hope to see yes."

A review that reads the script instead of listening to the audio passes all three.
**The script is not evidence about the audio.** Re-run `vogate.py` against any
re-render before shipping it.

## The films


### Northbank — Priya (Replies · cold outbound)
- **Files:** `media/examples/ss53-replies-cold.mp4` (23.1s, 3.4 MB, 1920x1080, 30fps) + `ss53-replies-cold-poster.jpg` (designed, never a frame grab)
- **Brand colour:** `#60C7FA` — also the card's `--accent` and the PiP ring, so the wall reads as eight companies at a glance
- **Recipient:** Priya, Head of Ops (fictional)
- **Linked page:** `outcome-replies.html`
- **HeyGen video:** https://app.heygen.com/videos/f064c59a45934767a170b8ad418a1725 (`f064c59a45934767a170b8ad418a1725`)
- **VO gate:** PASS — audio-vs-script token match 0.981
- **Script (as spoken):** "Priya, this is not a list. I made this one for you, and only you. Your ops team has taken on three new clients this quarter, and the handover docs are still doing the talking. One short video, in your brand, with the client's name on it, gets there faster and it gets answered. Everything I'd normally bury in a long email is on the page below. Fifteen minutes this week and I'll show you what yours looks like."

### Calder & Vine — Marcus (Replies · enterprise accounts)
- **Files:** `media/examples/ss53-replies-enterprise.mp4` (23.6s, 3.3 MB, 1920x1080, 30fps) + `ss53-replies-enterprise-poster.jpg` (designed, never a frame grab)
- **Brand colour:** `#F5A65B` — also the card's `--accent` and the PiP ring, so the wall reads as eight companies at a glance
- **Recipient:** Marcus, Managing Partner (fictional)
- **Linked page:** `outcome-replies.html`
- **HeyGen video:** https://app.heygen.com/videos/58cf83efce8c4df58e6682fefd3550ff (`58cf83efce8c4df58e6682fefd3550ff`)
- **VO gate:** PASS — audio-vs-script token match 0.973
- **Superseded first render:** `10add1fc455640318da483c640eb5582` — "Calder and Vine" was spoken as "Colder and Vi". Respelled "Vyne" for TTS; the written spelling stays "Vine".
- **Script (as spoken):** "Marcus, an enterprise account doesn't move because somebody sent a clever email. So I'm not sending you one. This is a video made for you, on a page built for Calder and Vyne, and every person on your target list gets their own. Their name, your brand, one minute of me actually saying something. Who's behind it, and what it costs, are both below. If it's worth a conversation, my calendar is under that."
- **TTS note:** spoken 'Vyne', written 'Vine' (elevenlabs-phonetics rule)

### Loomis Health — Elena (Booked calls · post-demo recap)
- **Files:** `media/examples/ss53-booked-calls.mp4` (24.4s, 3.6 MB, 1920x1080, 30fps) + `ss53-booked-calls-poster.jpg` (designed, never a frame grab)
- **Brand colour:** `#34D399` — also the card's `--accent` and the PiP ring, so the wall reads as eight companies at a glance
- **Recipient:** Elena, Director of Clinical Ops (fictional)
- **Linked page:** `outcome-booked-calls.html`
- **HeyGen video:** https://app.heygen.com/videos/4f97cf226e0f48e6b9ec11327906a4ae (`4f97cf226e0f48e6b9ec11327906a4ae`)
- **VO gate:** PASS — audio-vs-script token match 1.000
- **Superseded first render:** `0dd12c344e2644b0a3ccbc397440be70` — "in the order we talked about it" and the closing "I'll go to them" both slurred. Rephrased.
- **Script (as spoken):** "Elena, thanks for the demo on Tuesday. Rather than send you notes you'll never open, here are the two minutes that matter. We covered the rollout across your three sites, what your clinicians see on day one, and the one number your board asked about. It's all written out below this video, in the order we covered it. If you want the next call, the calendar is underneath. If you'd rather I took this to your board, say the word and I will."

### Ardent Grove — Sarah (Signed proposals · the post-call close)
- **Files:** `media/examples/ss53-signed-proposals.mp4` (26.5s, 3.7 MB, 1920x1080, 30fps) + `ss53-signed-proposals-poster.jpg` (designed, never a frame grab)
- **Brand colour:** `#A78BFA` — also the card's `--accent` and the PiP ring, so the wall reads as eight companies at a glance
- **Recipient:** Sarah, Operations Director (fictional)
- **Linked page:** `outcome-signed-proposals.html`
- **HeyGen video:** https://app.heygen.com/videos/89af621d421040d691be13f7a11b136a (`89af621d421040d691be13f7a11b136a`)
- **VO gate:** PASS — audio-vs-script token match 1.000
- **Script (as spoken):** "Hi Sarah, thanks for Tuesday's call. Rather than send you a forty-page PDF, I thought I'd talk you through the proposal myself. Below this video you'll find the full scope, the rollout across your three regional teams, onboarding in the first fortnight, and the numbers exactly as we discussed them. The only decision left is the start date. When you're ready, the agreement and the payment link are just underneath. Any questions, reply here and I'll come straight back to you."

### Fieldnote — James (Event show-ups · the day-before nudge)
- **Files:** `media/examples/ss53-event-showups.mp4` (26.0s, 3.3 MB, 1920x1080, 30fps) + `ss53-event-showups-poster.jpg` (designed, never a frame grab)
- **Brand colour:** `#FB7185` — also the card's `--accent` and the PiP ring, so the wall reads as eight companies at a glance
- **Recipient:** James, Head of Growth (fictional)
- **Linked page:** `outcome-event-showups.html`
- **HeyGen video:** https://app.heygen.com/videos/a6470e76038e4818958d7ff27ea54c11 (`a6470e76038e4818958d7ff27ea54c11`)
- **VO gate:** PASS — audio-vs-script token match 0.988
- **Superseded first render:** `2200c46e49594f3bbea15b116464e84c` — "let another calendar invite do the talking" was spoken as "...invite you at the talking". Rephrased.
- **Script (as spoken):** "Hi James, a quick one before Thursday. You registered for our session on turning cold lists into booked meetings, and I wanted to invite you myself, instead of leaving it to another calendar invite. We're covering the whole playbook, the outreach, the follow up, and the numbers behind it, in thirty minutes, live, no waffle. Your seat is confirmed and the joining link is below. If Thursday goes sideways there's a link to grab the recording too. Either way, good to have you with us."

### Halcyon Labs — Tom (New starters · onboarding, one video at a time)
- **Files:** `media/examples/ss53-ramped-reps.mp4` (26.2s, 3.5 MB, 1920x1080, 30fps) + `ss53-ramped-reps-poster.jpg` (designed, never a frame grab)
- **Brand colour:** `#22D3EE` — also the card's `--accent` and the PiP ring, so the wall reads as eight companies at a glance
- **Recipient:** Tom, New Sales Hire (fictional)
- **Linked page:** `outcome-onboarding.html`
- **HeyGen video:** https://app.heygen.com/videos/74231d47d6b242d99ac16b6337f5f686 (`74231d47d6b242d99ac16b6337f5f686`)
- **VO gate:** PASS — audio-vs-script token match 1.000
- **Script (as spoken):** "Welcome aboard, Tom, and welcome to module one. Over the next two weeks this takes you from first day to first demo, one short video at a time. Today, how we position the product, who we sell to, and the three questions every good discovery call opens with. Each module ends with one thing to go and do. Do them in order and you'll be pitching by Friday week. Your manager sees where you've got to, so there's no chasing and no guesswork. Right, module one."

### Wren & Fell — Maya (Accepted offers · the offer video)
- **Files:** `media/examples/ss53-accepted-offers.mp4` (27.8s, 3.9 MB, 1920x1080, 30fps) + `ss53-accepted-offers-poster.jpg` (designed, never a frame grab)
- **Brand colour:** `#A3E635` — also the card's `--accent` and the PiP ring, so the wall reads as eight companies at a glance
- **Recipient:** Maya, Head of Customer Success (fictional)
- **Linked page:** `outcome-accepted-offers.html`
- **HeyGen video:** https://app.heygen.com/videos/ae639b5cc9c54b118a083202ff348935 (`ae639b5cc9c54b118a083202ff348935`)
- **VO gate:** PASS — audio-vs-script token match 1.000
- **Superseded first render:** `2ee5fe95f6594182a2494eb414fdeceb` — The closing line "We really hope it's a yes" was spoken as "We really hope to see yes". Rephrased to "We really hope you say yes".
- **Script (as spoken):** "Maya, I'll keep this short, because the paperwork below says it better. We would love you to join us as our new Head of Customer Success. The whole panel came out of your final interview saying the same thing, that's the person. Your full offer sits underneath this video, salary, options, start date, along with a few honest words from the team you'd be joining. Take the time you need, and ask us anything. But know this, we're not sending this video to anyone else. We really hope you say yes."

### Tessellate — Daniel (Investor meetings · the teaser that earns the meeting)
- **Files:** `media/examples/ss53-investor-meetings.mp4` (26.0s, 3.6 MB, 1920x1080, 30fps) + `ss53-investor-meetings-poster.jpg` (designed, never a frame grab)
- **Brand colour:** `#818CF8` — also the card's `--accent` and the PiP ring, so the wall reads as eight companies at a glance
- **Recipient:** Daniel, Partner (fictional)
- **Linked page:** `outcome-investor-meetings.html`
- **HeyGen video:** https://app.heygen.com/videos/e9bc039dd22b4e8e8d26ec16ed95dbd4 (`e9bc039dd22b4e8e8d26ec16ed95dbd4`)
- **VO gate:** PASS — audio-vs-script token match 1.000
- **Script (as spoken):** "Daniel, you asked for the short version, so here it is. We're raising two million to scale what's already working. Revenue up every month for eighteen straight, a sales motion that books meetings at three times what we budgeted, and a third of the round already committed. The full deck and the numbers behind it are below this video, and every one of them stands up to questioning. If it's interesting, my calendar is underneath. Fifteen minutes this week and I'll show you exactly where it's going."


## Hero showreel cuts

Three 1.4s silent 1280x720 cuts for the `index.html` hero montage, cut straight
out of the finished films with ffmpeg rather than rendered as separate
compositions — one source, one path, so the reel and the wall cannot drift apart
through a later re-render.

| file | from | in-point |
| --- | --- | --- |
| `cut-replies-enterprise.mp4` | ss53-replies-enterprise.mp4 | 16.57s |
| `cut-booked-calls.mp4` | ss53-booked-calls.mp4 | 13.97s |
| `cut-signed-proposals.mp4` | ss53-signed-proposals.mp4 | 14.15s |

All three are exactly 42 frames at 30fps (1.400s), matching hero-brand-1 frame for frame, and carry no audio stream. Each in-point sits on a settled page-plate beat, and each 1.4s window falls
wholly inside one beat so the on-screen copy never changes mid-cut. Plate beats
rather than the opening name beat, because the montage's argument is that the
presenter is constant while everything else changes — and a constant needs
something to be constant *against*.

## The superseded renders

`example-signed-proposals.mp4`, `example-event-showups.mp4`,
`example-ramped-reps.mp4`, `example-accepted-offers.mp4`,
`example-investor-meetings.mp4` and the three `wave-*-opt.mp4` files are
superseded but **deliberately not deleted**:

- `example-accepted-offers.mp4` and `example-event-showups.mp4` carry a lipsync
  smear over the mouth that is baked into the render, not the poster frame. They
  are the only evidence of it.
- They are the only way Andrew can settle who is actually on camera in the old
  set. A manifest line saying "Andrew clone" is exactly what misled everyone.
- The three `wave-*-opt.mp4` files are the same 70-73s film in three presenter
  variants, shown as three different examples in three different industries.

`example-northbank-priya.mp4` is **not** superseded. It is the reference standard,
`index.html` uses it, and it is untouched.

## Rebuild

Working files: `scratchpad/build/` — `brands.json` (brands, recipients, colours,
scripts), `beats.json` (on-screen beats + their anchor phrases), `checkbeats.py`
(gate: anchors exist and are in script order), `align.py` (forced alignment),
`vogate.py` (audio-vs-script diff), `emit.py` (writes `ssExamplesData.ts`),
`plate.py` (page plates), `finalise.py` (remux, posters, cuts).
