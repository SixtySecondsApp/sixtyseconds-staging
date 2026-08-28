# Handover: the videos on the rest of the 5.3 pages

Paste everything below the line into a fresh chat. It is written to be read
cold — it assumes no memory of the session that produced it.

---

## What you are picking up

The `#chooser` section on `redesign/5-3/index.html` was rebuilt and signed off:
its four use-case explainers now animate, and the seven outcome cards under
them were rewritten to the same standard. That work is done. **Your job is the
video treatments on every other page in `redesign/5-3/`**, which have not been
through the same pass.

Repo: `/Users/macbookpro/Desktop/Cursor Projects/sixtyseconds-redesign`
Branch: `redesign-local`. Serve it at `http://127.0.0.1:5179/5-3/<page>.html`
(a static server is already running on 5179; check before starting another).

**Do not touch `redesign/5-3/index.html`'s `#chooser` section** unless a fix
genuinely belongs there — another session may be in that file. Check
`git status` before you stage anything, and stage explicit paths, never `-A`.

## The pages and what is on them

| Page | Video | Player component |
| --- | --- | --- |
| `outcome-replies.html` | `media/wave-raph-opt.mp4` | `.video-shell.v-card` |
| `outcome-booked-calls.html` | `media/wave-ai-opt.mp4` | `.video-shell.v-card` |
| `outcome-signed-proposals.html` | `media/examples/example-signed-proposals.mp4` | `.video-shell.v-card` |
| `outcome-event-showups.html` | `media/examples/example-event-showups.mp4` | `.video-shell.v-card` |
| `outcome-onboarding.html` | `media/examples/example-ramped-reps.mp4` | `.video-shell.v-card` |
| `outcome-accepted-offers.html` | `media/examples/example-accepted-offers.mp4` | `.video-shell.v-card` |
| `outcome-investor-meetings.html` | `media/examples/example-investor-meetings.mp4` | `.video-shell.v-card` |
| `examples.html` | nine players, filterable | `.ex-card.v-card` |
| `how-it-works.html` | `media/wave-andrew-opt.mp4` | `.showcase-video.v-card` |

All of them share `SIXTY.initVideoCards()` in `shared.js`, which builds the
custom control bar (play/pause, draggable scrub, time, mute). Native
`<video controls>` is deliberately never enabled — it fought the overlay stack
and made seeking unreliable. Reduced motion gets a still poster and
click-to-play only.

`media/examples/PLACEMENT.md` is the manifest for the five example renders:
which avatar look, which voice, the HeyGen video id, the duration and the full
script for each. Read it before you write any copy about them — it is the
source of truth for who is on camera and what they say.

## The standards this section now holds itself to

These came out of twenty-five in-character blind readers over eight rounds.
Apply the same ones; do not re-derive them.

1. **Show the person.** A company selling video must not show a faceless
   placeholder. The cropped presenter still is
   `media/examples/presenter-andrew-pip.jpg` — 142px square lifted from inside
   the ring on the Priya poster at (1637,797). If you need another presenter
   crop, measure the circle first: crop a 360px region around it, find the
   centre and inner radius, then take an inscribed square. Getting this wrong
   by 15px leaves an arc of the source ring cutting across the face.

2. **Disclose the clone plainly, and lead with the reassurance.** The wording
   the readers accepted is: *"On your videos it is your face and your voice.
   Andrew is our founder: he filmed once, and the AI rebuilds his face and
   voice for every video after that."* Earlier drafts said "one recording of
   Andrew" and "an AI clone" — both were called euphemisms. Never bury the
   "it is your face" half behind the mechanism half.

3. **Mark every illustration, in the artefact — and disclaim EXISTENCE, not
   the relationship.** The marker is **"Invented example"**. It used to read
   "Example, not a customer", and that wording was the defect: it disclaims a
   *relationship*, and reads perfectly happily as real work done for a firm
   that has not bought yet — which is exactly the available reading beside
   convincing company chrome and a named person with a plausible role. Not one
   disclosure on either page family used a word meaning invented. Three rounds
   argued about placement and frequency; nobody audited the words, so each
   round only made them louder. **The repetition was compensating for
   imprecision.**

   If a page has a mocked Slack line, a watch percentage, a diary, a CRM stage
   or a quoted reply, it needs a marker in the same place — beside the thing,
   not in a caption above it. A reader who lands mid-page must not meet an
   unmarked number. One marker per fabricated object; **never two within one
   scroll of each other** — a doubled disclaimer stops reading as honesty and
   starts reading as a company getting ahead of a doubt.

   Count them with `.harness/verify3.cjs`, never with `innerText`: half the
   markers are `::before`/`::after` pseudo-elements, which `innerText` cannot
   see, so an innerText count reports half the real number. That mistake nearly
   had me tell three readers they had miscounted when they had simply looked.

   And do not hard-code the phrase anywhere. Two harness checks asserted the
   literal string "Example, not a customer" and so went red the moment it was
   corrected — a check pinned to the wording it audits can only ever confirm
   the status quo. The peer session found the worse version in a card
   *generator*, which would have silently restored the old phrase on the next
   regeneration rather than going red. Grep assertions, generators, fixtures
   and templates alike.

4. **No ownerless numbers.** Every percentage, count or duration must either be
   a product spec (a forty-second recap, a 0:23 render length from PLACEMENT)
   or be inside something marked as an example. `outcome-investor-meetings.html`
   line 84 still has **"Partner watched 92% → flagged hot, meeting requested"**
   with no owner and no marker — that is a known outstanding defect, and it is
   the same class of thing three separate sceptics called the least defensible
   artefact on the page.

5. **On a thumbnail, the name is the thumbnail.** When a video card is rendered
   small, the recipient's name grows against the furniture rather than shrinking
   with it. Sub-lines come off; the brand chip, play mark and presenter step back.

6. **The art leads, the caption follows.** Never animate a caption in ahead of
   the thing it captions.

7. **Plain English, and every line earns its place.** Dead on arrival: watch
   signal, trigger, thumbnail, reps, re-key, package, ramped, at scale,
   prospecting-as-a-verb, data room, "closes itself", "fill the room". Cut any
   line that restates the label above it or a line on another card.

8. **One delivery model.** Things go in, *we* build them, *you* approve and
   send. Do not write copy that implies a self-serve tool in one place and an
   agency in another.

## How to verify (do not eyeball this)

`redesign/5-3/.harness/` holds Node + Playwright checks with a README. They are
written against the chooser section; **adapt the selectors** for the page you
are on rather than trusting a green run on the wrong element.

- `fit.js W H` — nothing overlaps the header, counter or caption
- `overlap.js W` — per card: label clears the pill, mock clears the title
- `contrast2.js` — every text style meets AA against its **composited**
  background (not the nearest semi-transparent layer — that measurement lies)
- `order.js` — art leads, caption follows
- `pip.js`, `thumb.js`, `gap.js` — presenter inset, thumbnail name size, gaps
- `pages.js` — every page still returns 200 with no console errors
- `capture.js W H tag` — renders frames into `shots/`

Widths to clear before shipping: **320, 360, 375, 390, 414, 430, 520, 620, 768,
1024, 1280, 1440**.

**A trap that cost a full round:** `capture.js` freezes animations with
`getAnimations({subtree:true})`. Without `{subtree:true}` the pseudo-element
animations (progress rails) keep running while everything else stops, and every
screenshot shows a rail disagreeing with its step counter. A reviewer reported
that as a defect with per-frame receipts and it did not exist. Before you fix a
defect that only appears in screenshots, prove it on the live page.

## How to review

Do not self-assess. Render the frames to PNG, then spawn in-character blind
readers who may only Read the images — explicitly forbid them from reading the
source or opening a browser. Give each a persona with a real job and a real
budget, and from the second round on, brief them to **attack the previous
round's conclusions rather than repeat them**. The personas that earned their
keep here:

- a sales director at a 40–60 person firm, on a laptop, sceptical but will read
  a mechanism
- a phone skimmer who gives the section eight seconds (this one failed four
  rounds running and was right every time)
- a hostile RevOps sceptic with a written allergy list
- a non-sales buyer — talent, ops — who has to find their own use case
- a plain-English editor whose only job is to transcribe every line and mark it
  KEEP / CUT / REWRITE

Expect the first round to fail on something structural. Fix, re-render,
re-run with fresh readers, and record what each round actually changed.

## Open questions that are product decisions, not design ones

Do not invent answers to these. Ask Andrew, or leave them and flag them.

- **Pay now / Sign here** are drawn as live controls with no named payment
  processor and no e-sign provider. A sceptic will not believe them.
- **Whose brand.** Cold outreach brands the page to the *prospect*
  (`northbank.sixtyseconds.ai/priya`); every other use case brands it to the
  *sender*. No line on the site states the rule, and every sceptical reader
  noticed.
- **Is the recipient told the video is AI?** The disclosure speaks to the buyer.
  Nothing says what the person receiving it sees. Both a talent director and a
  RevOps sceptic stopped there.
- **One recording, one look.** The example renders are three different Andrew
  looks (black tee, orange shirt, blue shirt) plus Raph. Anywhere two play near
  each other, he appears to change clothes between them.

## Ground rules

- Commit each page as you finish it, staging explicit paths.
- Never stage a file another session is mid-edit on — check `git status` first.
- Read `MEDIA-BRIEF.md` and `PLACEMENT.md` before writing copy about any render.
  Both bind you: fictional first names only, no real client names or numbers, no
  invented durations or stats on the chrome around the media.
- `INTEGRATION-NOTES.md` records what the chooser rounds changed and why. Add
  yours to it as you go.


---

## Added after round three (24 Aug)

**9. The ambient loop must park on the beat that proves the claim.**
`initVideoCards` ambient-plays an in-view card from `currentTime` 0, and frame
0 of every film is the same shape — the recipient's first name, large, on a
near-empty background. Side by side the films are indistinguishable ("not eight
films, one film with eight captions"), and worse, that beat proves the cheap
half of the claim (one recording scales) while disproving the expensive half
(that the recipient gets something built for them).

Use `data-amb` / `data-amb-end` on the `<video>`. Pick the window with
`.harness/ambwin.cjs --sheet`, **look at the contact sheet**, then `--write`,
then `node .harness/amb.cjs`. The score proposes; the eye decides — a most-ink
score peaks as happily on a busy cross-fade, a dark sidebar rail or a flat
colour band as on a legible beat. Where ink and probative-ness come apart, take
probative-ness.

**Re-run it after ANY re-render.** A window is a timestamp into a film other
sessions re-cut. When the film changes the window is silently wrong — the page
works, the loop loops, the screenshot looks composed. **Nothing in the visual
harness compares a timestamp to the film it points into.**

**10. Name shot directories after the commit they were captured at.**
`shots/r4-<short-hash>/`. Round three's readers ran against frames from a
revision that had moved twice by the time their findings came back; two real
findings were indistinguishable from false positives until the hash was checked
out. A reader's finding is a claim about a specific revision. See
`.harness/README-shots.md`.

**11. The defects that matter are cross-artefact, and no single-artefact check
can see them.** Everything real found on this work has this shape: the film
matches the script, the window points at the beat, the name matches the page,
the manifest describes the render, the caption describes what the video
actually shows. Each artefact is individually fine; the *relationship* between
two of them is wrong.

So the tools worth building hold two artefacts up against each other —
`ambwin.cjs`, `align.py`, `vogate.py`. Screenshot checks do the opposite: they
open one artefact very carefully, which is why they manufactured four false
defects in a day while missing every real one.

The corollary, learned four separate times in one afternoon: **when your
measurement disagrees with the artefact, suspect the measurement.**
`innerText` could not see pseudo-element markers. A play-overlap check measured
a full-tile flex container instead of the glyph box and reported 3364px of
overlap both before and after the fix. Two checks asserted the phrase they were
auditing. And a string-match for "fill the room" walked straight past "The room
fills". In every case a blind reader looking at the rendered page was right and
the instrument was wrong.
