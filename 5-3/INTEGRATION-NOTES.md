# Hero demo → real Studio integration (2026-08-18)

`index.html`'s hero ("Type your email. Watch your video build itself.") now calls the real
Sixty Seconds Studio product (`https://demo.sixtyseconds.ai`) directly for any plausible (non-blank)
email, with an automatic, honestly-labelled fallback to the original simulation if anything about
the real call fails. This note records what level of integration was achieved, why, the safety
proof, and the one concrete change that would unlock a fuller integration later.

## What level this is

Not a clean "A", "B" or "C" against the original brief — it ended up as a hybrid, because live
testing turned up one thing the brief couldn't have anticipated:

- **The capture call is real, direct, Level A-style.** The hero's own `fetch()` calls
  `POST https://demo.sixtyseconds.ai/api/v1/demo/capture` directly, in the same tab, the moment the
  visitor submits — the exact endpoint `demo.sixtyseconds.ai/demo`'s own hero calls (confirmed by
  reading `sixty-video-platform`'s `public/crown-demo.html`, function `wireEntryForm()`). This
  creates one real, safely test-gated `video_jobs` row and kicks off the real pipeline.
- **The progress view is Level B-style, but tighter than the brief's literal wording.** The brief's
  Level B assumed opening `demo.sixtyseconds.ai/demo?email=...` in a new tab, which would trigger a
  *second*, duplicate capture. Instead, since we already have a real `jobId` from our own capture
  call, the result shell shows `https://demo.sixtyseconds.ai/demo/{jobId}` **inline, in an iframe**
  — the real product's own live SSE-driven build page, rejoining the exact job we just created (zero
  duplicate spend, zero second email address to coordinate).
- **The simulation is the automatic, labelled fallback**, exactly as specified, for any failure at
  any point (network, CORS, unexpected response, timeout).

### Why not the literal Level A (streaming real events into the hero's own four-node row)?

Verified live, not assumed: the real-time progress endpoint, `GET
/api/v1/demo/stream/{id}` (Server-Sent Events), sends **no `Access-Control-Allow-Origin` header at
all** — confirmed by curling it directly with `Origin: https://www.sixtyseconds.ai` (the exact,
already-whitelisted origin this page is meant to ship from) and seeing no CORS header on the
response, even though the sibling capture endpoint's own CORS preflight passes cleanly for that same
origin. A browser's `EventSource` cannot read a cross-origin response without that header, so a
script on this page can never subscribe to the real event stream and drive the hero's own
INPUT→SCRIPT→AVATAR→DELIVER row event-by-event — no code change on this page can work around that,
only a server-side one can.

The fix, for whoever owns `sixty-video-platform`, is small and has a direct precedent already in the
same file family: `src/app/api/v1/demo/capture/route.ts` already builds CORS headers per-request
from the brand's `allowed_origins` (see its `buildCorsHeaders()`); `src/app/api/v1/demo/stream/[id]/route.ts`
would need the same treatment — read the brand for the video row, and if the request `Origin` is in
its `allowed_origins`, add `Access-Control-Allow-Origin: <origin>` (and `Vary: Origin`) to the
`Response` the SSE stream is built from. Once that's live, this page's hero could switch from the
iframe to a native `EventSource('https://demo.sixtyseconds.ai' + streamUrl)` and drive the four nodes
directly off the real `research_done` / `page_built` / `vo_ready` / `visuals_ready` / `avatar_ready` /
`qa_passed` / `page_published` / `email_sent` events (all confirmed present and named exactly this in
`public/crown-demo.html`'s own `startLiveStream()`), which is the literal Level A brief. Until then,
the iframe is the highest-fidelity real progress view actually reachable from a foreign origin (its
CSP `frame-ancestors` already explicitly allows `https://www.sixtyseconds.ai`, confirmed live).

## The safety proof (non-negotiable requirement: never a real send)

This page **hardcodes** `deliveryMode: 'test'` and a fixed Sixty-controlled `testEmail`
(`andrew@sixtyseconds.ai`, matching Studio's own `crown-demo.html` default test inbox) on every
single request. There is no UI control anywhere on this page that can change either value — not a
toggle, not a query param, nothing. Proof this can never reach a real prospect inbox, from the
server's own code and tests (`sixty-video-platform`, read at `origin/main`):

1. **`src/app/api/v1/demo/capture/route.ts`** — `deliveryMode` is optional; when omitted or `'test'`
   it's honoured as `'test'`. `'live'` additionally requires `getPublicDemoDeliveryState().effective
   === 'live'` (a *second*, independent, server-side, DB+env-backed master switch this page never
   touches and cannot force) or the route 409s. Since this page never sends `'live'`, that branch is
   simply never reached.
2. **`src/lib/pipeline/delivery.ts`, function `deliveryRecipient()`** — the decisive line:
   ```
   if (context?.deliveryLane === "public_demo" && context.brandSlug === "use60") {
     if (context.publicDemoDeliveryMode !== "live") {
       return { to: validTestRecipient(context.publicDemoTestEmail) ?? testEmail, testMode: true };
     }
     ...
   }
   ```
   Any `publicDemoDeliveryMode` other than the literal string `"live"` (i.e. `"test"`, or anything
   else) returns `testMode: true` and a test recipient **unconditionally — without even calling the
   master-switch check**. The literal SES `to:` address is swapped here, before the send, not just a
   label on an otherwise-real send.
3. **`src/lib/pipeline/delivery.test.ts`** — test *"routes an explicit test build to its saved test
   email even while the master gate is live"* proves this exact scenario at the suite level,
   including asserting the master-gate function is never even called for an explicit test request.
4. Live-verified, not assumed: `curl https://demo.sixtyseconds.ai/api/health/demo` on 2026-08-18
   returned `"deliveryMode":"test","readyForLiveVisitorDelivery":false` — i.e. even a request that
   *did* ask for live delivery would be refused today. This page's own safety does not depend on that
   remaining true, though — see point 2.
5. Belt-and-braces in this page's own code (`index.html`, function `attemptRealBuild`): the response
   is only ever trusted if `result.body.deliveryMode === 'test'`; anything else (including an
   unexpected `'live'` echo) aborts to the simulated fallback instead of proceeding. Covered by an
   automated test (see below).

Nothing on this page stores the typed email anywhere (no `localStorage`, no cookie, no analytics).
The one `fetch()` call is the only place it travels, direct to Studio's own database — identical to
what already happens for every real `demo.sixtyseconds.ai` visitor today.

## CORS origin — why this only works once shipped to www.sixtyseconds.ai

Verified live: the capture endpoint's CORS preflight (`OPTIONS`) returns
`Access-Control-Allow-Origin: https://www.sixtyseconds.ai` for that exact origin (pre-registered via
`sixty-video-platform` migration `0054_public_demo_release_lane.sql`, which also registers
`https://demo.sixtyseconds.ai`), but returns **no** CORS header at all for a `null`/file:// origin.
That means:
- From `file://` (opening this file directly, as for local review) the real call is always,
  correctly, CORS-blocked by the browser — the page falls back to the simulation automatically, and
  a Playwright test (below) confirms this path end-to-end, including asserting the expected browser
  CORS error is the *only* console error produced.
- Once this page is served from `https://www.sixtyseconds.ai`, the real call is expected to succeed.
  This has not been (and cannot be, from here) proven against that exact origin, since the file has
  not been deployed there — the strongest available proof is the live preflight check above.

## Testing

`node verify-mockup-integration.mjs` (written for this task; not checked in anywhere, lives in the
session scratchpad this task ran from) drives the page with Playwright, chromium, and covers:
1. Real `file://` origin → real fetch attempted → CORS-blocked → simulation fallback completes,
   labelled "Simulation preview…", zero unexpected console errors.
2. Blank-email submit → original, unlabelled simulated behaviour, unchanged.
3. Mocked successful capture response → asserts the *exact* request shape sent (method, URL, that
   `email` is the typed address but `testEmail` is the fixed Sixty inbox and is never equal to it,
   that `deliveryMode` is the literal string `'test'`, that no `brand` field is sent) and the exact
   resulting UI state (canned video hidden, real card shown, iframe `src` and "open full screen" link
   both pointing at `https://demo.sixtyseconds.ai/demo/{jobId}`).
4. Mocked response with an unexpected `deliveryMode:'live'` echo → proves the belt-and-braces check
   aborts to the simulated fallback rather than ever surfacing a "real" result in that case.
5. Visual/regression: all 4 hero nodes still present, the pinned engine scroll scene (a different,
   untouched part of this same file) still initialises and scrolls with zero JS errors, hero
   screenshot matches the approved design with no visible regression.

All 23 assertions across these 5 checks passed.

## What was NOT done, on purpose

- No inline raw `<video>` embed of the real film — the real deliverable is genuinely a page+video
  combo, and the confirmed `pageUrl`/`jobId` from the real API response is a robust way to link to
  it; the exact field carrying a standalone playable video URL was not confirmed, so a link/iframe to
  the real page was used instead of guessing a field name for an inline video source.
- No visible live/test toggle anywhere on this page — the real product has one (`#testModeToggle` in
  `crown-demo.html`, defaulting to checked/test), but exposing any way to flip delivery mode on a
  public marketing page would work directly against the "never a real send" requirement, so it was
  deliberately left out entirely rather than hidden-but-present.
- No attempt to poll `/api/health/demo` or any other endpoint from the browser for status — it
  carries no CORS headers either (same pattern as the stream route), so a client-side read would fail
  the same way; it was only useful to *this investigation* via `curl`, which isn't subject to CORS.

---

# Chooser: animated use-case explainers (24 Aug)

**What changed.** The journey rail in `#chooser` used to swap one 16:9 render per stage. A cold
reader who does not press play learned nothing from a paused plate, so each of the four stages now
runs a four-beat animated explainer of the mechanism, and the real render sits behind a
`How it works / Watch a real render` toggle under the frame.

**Beat spine** (identical across all four stages, so the second stage is understood faster than the
first): **In → Out → Lands → Back**. The wording is lifted from the outcome pages' own
"X in → Y out" lines rather than freshly drafted:

| Stage | In | Out |
| --- | --- | --- |
| Prospecting & outreach | Name + company | A video that says both, on their brand |
| Follow-up | Notes, transcript, or a "gone quiet" trigger | A forty-second recap, same day |
| Proposal | The call transcript | Video + proposal page + payment link + e-signature |
| Beyond the sale | Name, role, start date | A welcome video the moment the offer goes |

**Claims.** No new numbers were invented (MEDIA-BRIEF: "no invented durations or stats"). Everything
quantified on screen already exists elsewhere on the site: Priya at Northbank watching 87% in
`#sales-warm`, the proposal watch signal "Viewed pricing 3× · lingered 41s on page two", and
"Offer video watched twice by the candidate" in `#talent`. Names stay inside the PLACEMENT cast —
Priya (Northbank / the offer), Sarah (proposal), Tom (onboarding), James (events), Daniel (investors);
Maya, already on the index chooser card, carries the follow-up.

**Implementation.** `.ocx-*` in `shared.css`, all additive — no existing rule was edited. One 14s
cycle per scene, four 3.5s beats driven by `--i` and CSS `animation-delay`; only `transform` and
`opacity` animate. Inactive scenes are `display:none` so nothing animates off-screen, and swapping a
rail stop restarts the cycle at beat one by the same display swap. The plate takes its accent from
`--pl`: Northbank's sky blue for the cold send, the site's own a2/a4/a6 ramp where the plate is
"your brand".

- Reduced motion: the film freezes on beat one and the written four steps (`#ocxSteps`, otherwise a
  screen-reader-only list) become a visible numbered list under the frame.
- Under 620px the frame goes 4:3 so the explainer has height, and snaps back to 16:9 for the render.
- The MP4 now loads only when someone asks for a real render (`preload="none"`), which takes four
  videos off the initial chooser cost. The ambient roll waits on `loadeddata`, because `load()`
  resets the pipeline and an immediate `play()` no-ops silently.

**Verified** by scrubbing each scene to each beat in the browser at 1280 and 375 wide, plus the
toggle in both directions (source swap, caption swap, ambient roll starts, pauses on the way back).
Live playback timing could not be watched in the harness — the preview pane throttles the document
timeline when it is not fronted, so beats were checked by setting `currentTime` directly.

**Known, pre-existing:** the four real renders are different looks (black tee, orange shirt, blue
shirt), so toggling stage-by-stage shows Andrew changing clothes. That is the media set, not this
change, but it breaks the "one recording, one look" rule and is worth a re-render.

## Chooser explainers: what six rounds of blind readers changed

Twenty-two in-character cold readers across six rounds — a sales director,
a phone skimmer, a RevOps sceptic, a talent director, and a plain-English
editor — each given only rendered PNGs of the sixteen frames and forbidden
from reading the source. Rounds two onward were briefed to attack the
previous round rather than repeat it.

**Round one: all four failed on the same thing.** A company selling video had
shown them no video and no person; the presenter was an empty grey disc,
which the sceptic read not as a placeholder but as a synthetic likeness being
cropped out. The disc became the real PiP frame from the Priya render, named.

**What the rounds after that changed, in order of how much it mattered:**

1. The presenter, then the disclosure. "One recording of Andrew" → "An AI
   clone" → "Andrew is our founder. He filmed once; the AI rebuilds his face
   and voice for every video after that. On yours, it is your face and your
   voice." Each rewrite came from a reader saying the previous one hedged.
2. The illustration marker, because nobody could tell the mocked Slack lines
   and percentages from real results.
3. The outcome moved inside the frame. Three separate phone skimmers failed
   the section because the payoff was at beat four, ~11s in, and eight seconds
   buys two beats.
4. Contradictions between adjacent frames: "nothing to script, film or edit"
   against "he filmed once"; "no chasing" in one loop against "so you chase"
   in another; a caption promising every viewer over an artefact showing one.
5. Restatement. Eight of sixteen frames carried a sentence that appeared
   word-for-word in another frame; every beat-one caption transcribed the
   label above it.
6. Jargon: watch signal, trigger, thumbnail, reps, re-key, package, ramped,
   by reply, at scale, and the section's own "mechanism and tracking
   included".

**A harness bug that faked a defect.** Round four's sceptic reported, with
per-frame receipts, that the progress rail disagreed with "Step N of 4" on
all sixteen frames. It did not. The capture script froze animations with
`getAnimations()`, which does not reach pseudo-element animations, so the
rail kept running while everything else stopped. `{subtree:true}` fixed the
harness; the rail and the counter agree in every frame. Worth remembering
before "fixing" a defect that only exists in the screenshots.

**Where it landed.** Sales director and talent director pass. The phone
skimmer and the sceptic were still finding things at round six, but what they
find now are product questions rather than design ones:

- **Pay now / Sign here** are drawn as live controls with no processor, no
  e-sign provider and no amount. The sceptic will not believe them until one
  is named. Either name the rails or drop the two pills.
- **Whose brand.** The outreach loop brands the page to the prospect
  (`northbank.sixtyseconds.ai/priya`, "Made for · Northbank") and the other
  three brand it to the sender. Every sceptical reader noticed and none could
  find the rule. It needs a positioning answer, not a design one.
- **Is the recipient told the video is AI?** Both the talent director and the
  sceptic stopped there. The disclosure on the panel is addressed to the
  buyer; nothing says what the person receiving it sees.
- **[Outside this section]** the outcome-card grid repeats the panel's
  invented numbers with no marker — "watched 92%", "Module one WATCHED", and
  a fundraising sparkline with no axis, units or owner. Three sceptics in a
  row called that the least defensible artefact on the page.

**Harness.** `capture.js`, `fit.js`, `sync.js`, `contrast2.js` and `need.js`
in the session scratchpad render the frames, assert no beat overlaps the
header, counter or caption at 320–1440, check the rail against the counter,
and measure composited contrast (30/30 AA).

---

# index.html, video treatments (2026-08-24)

Companion pass to the chooser rounds above, on everything OUTSIDE `#chooser`.
That section was signed off and is untouched here — zero `ocx-`/`ocard` lines
in the diff.

## SHIPPING BLOCKER — three real brands were on the homepage hero

`hero-brand-2/3/4.mp4` are **Keningford Partners**, **Tylt** and **Pathway
Talent Partners**. All three are real companies and all three wordmarks are
legible at full size in the first frame. `hero-brand-3` additionally burns in
**"MATT HODKINSON"** — a named individual at a company that was a *prospect*,
not a client: that demo was sent to him and has not been answered.

`MEDIA-BRIEF.md` already recorded this in writing, said it "must be replaced
before this ships", and recorded that masking the wordmarks was attempted
twice, both ways, and fails ("the fix is fictional brands, not removal").

An earlier pass mitigated it by not *naming* the brands in the tick labels —
"the ticks count them without identifying them". That mitigated nothing: the
wordmarks are burned into the frames those ticks play. **A label is not a
mask.** The clips are now commented out at source; only Northbank, the one
already-fictional clip, still plays.

**To restore the four-brand reel** (which is the reel's whole argument — three
cold readers refused the "one recording becomes many videos" claim, and the
hard cut between brands is what answers them): three 1.4s silent clips,
fictional brands, one Andrew look. Build from `Northbank.tsx`, *not* from
`Keningford.tsx` / `Tylt.tsx` / `Pathway.tsx`. The eight fictional brands being
rendered for `examples.html` are the obvious source, and reusing three of them
makes the hero and the showreel one system.

## UNRESOLVED — who is the presenter in `wave-ai-opt.mp4`?

She is neither Andrew nor Raph. Nothing in the repo names her: not `README.md`,
not `PLACEMENT.md`, not `MEDIA-BRIEF.md`, not the git history. **Andrew was
asked directly on 24 Aug and does not know either.** So provenance is
unresolved at the top, not merely undocumented.

This matters because of what is asserted over her:
- `examples.html` hero: "Every one below is a real render, made with **our own
  team's** cloned faces and voices."
- `outcome-booked-calls.html`: badged "Real outreach video".

Neither claim can be made good while nobody can say who she is. Treat this as a
shipping blocker on those two pages, not a documentation tidy-up.

**And `gate.sh` will not catch it.** It enforces one presenter per page, but it
can only check WHICH FILE is on the page, never WHO IS IN IT. Since PLACEMENT
is demonstrably unreliable on identity (see below), a filename-based check goes
on passing pages whose disclosure is wrong. Presenter identity needs a human
look at a frame, not a gate.

**Worse, this is not confined to her.** PLACEMENT attributes four renders to
"Andrew clone" across two looks — "Man in light blue shirt" and "Person in
orange-brown shirt". Pulled frames from both: they are two visibly different
men (different face shape, hairline and beard), and neither is the man in
`poster-andrew.jpg`, who is in the Sixty Seconds studio in a black hoodie with
the 60 sign behind him. So identity is unverified on renders we thought we had
provenance for, not just on the one nobody could name. Verified independently
on 24 Aug after the outcome-pages session raised it.

Related, same asset family: `wave-andrew-opt`, `wave-raph-opt` and
`wave-ai-opt` are **the same 70–74s explainer film in three presenter
variants** — identical composition and identical on-screen copy ("One real
page." / "MERIDIAN WEALTH PARTNERS" / "Sarah, this one's for you.") at the same
timestamps. `examples.html` currently captions them as three different examples
in three different industries. A sceptic who plays two of them hears the same
script. (Being rebuilt by the examples pass.)

## Fixed in this pass

- **Two ownerless rates removed** from the `#engine` chip row: "60–75% average
  watch-through" and "2.3× pipeline attribution vs generic avatar videos".
  Neither was a product spec and neither sat inside anything marked as an
  example. The footnote that existed to own them — "Watch-through and
  attribution measured across our own client campaigns" — went with them: it
  asserts real client data with no client, no period and no sample size, which
  is the shape a sceptic reads as a number wearing a lab coat. Replaced with
  three things the product actually does.
- **"Example, not a customer"** now marks the engine strip and the comparator,
  in the chooser's exact words. Both markers cover the **mobile** lane as well:
  `.eng-stripwrap` and `.eng-tabs` are `display:none` under 980px, so before
  this the phone reader — the one most likely to skim, and the persona that
  failed four rounds running — met 87% and 212 pageviews with nothing beside
  them saying whose they were.
- **The hero plate** is a real render of an invented company and said only the
  first half. It says both now, and no longer opens on the same four words as
  the line above it.
- **Kill-list words** out of body copy: "reps" (×2), "thumbnail" (×1).

## Known, deliberately not changed

- **`#resultCanned` is the one player on the site using native `<video
  controls>`.** The rule elsewhere is that native controls are never enabled —
  they fight the overlay stack and make seeking unreliable. But `index.html`
  never calls `SIXTY.initVideoCards`, so this player has no custom bar and
  stripping `controls` would leave it dead. Making it consistent means turning
  it into a `.v-card` and initialising it, on the hero demo's result surface,
  which is the most heavily wired thing on the page. Left working; flagged.
- **"Cold outbound reply rates fell under 1% in 2026"** (comparator sub) is
  market context rather than a customer claim, and the caption sources it. It
  is the only unowned number left on the page, and it is deliberate.

**Verified** at 320/360/375/390/414/430/520/620/768/1024/1280/1440: no console
errors, no horizontal overflow, exactly one visible marker per breakpoint, and
every new text style passes AA against its **composited** background. All nine
pages still return 200 clean.

## The seven outcome pages — video treatments (24 Aug)

Same standard as the chooser section, applied to the pages a prospect actually
lands on. Two blind readers (a RevOps sceptic, a non-sales buyer) on rendered
screenshots only.

**What changed.** A disclosure line under every hero video; "Example, not a
customer" on both mocked chips per page; three benchmark-shaped payoff lines
rewritten; three unsourced comparative claims removed from the replies page;
four captions that described a page not on screen; the run-panel thumbnail,
which was the exact shape of an iOS toggle and read as an unlabelled live
control; a headline breaking after its hyphen.

**The badge.** "REAL OUTREACH VIDEO" sat on the artefact in green while
"cloned" sat under it in grey — the loud half of a split claim, on the thing
being claimed about. Both the sceptic and a peer session flagged the same
shape independently. The badge says "Cloned face and voice"; the line beneath
still says it is a genuine render, not a mock-up.

### Blockers — CLOSED 24 Aug, except one

1–4 below were closed by re-pointing all seven pages onto the eight ss53
renders. Kept for the record because the reasoning matters more than the
outcome. **Only the Femi face remains open, and it is cosmetic.**

- **Presenter identity — CLOSED.** `PLACEMENT-ss53.md` records the
  `get_avatar_look` result verbatim: all eight films are one look ("Black
  T-Shirt"), one voice, on Andrew's own account. That is evidence, where
  `PLACEMENT.md` was assertion. All seven pages now name him, in the same
  words as examples.html.
- **`wave-ai-opt.mp4` provenance — CLOSED.** The unattributable presenter is
  off the site.
- **Three pages playing the same film — CLOSED.** Replies, booked-calls and
  how-it-works no longer share one wave explainer.
- **Lipsync smear — CLOSED.** The two affected renders are retired. The new
  films were frame-checked at native scale by the Examples session.
- **OPEN: `femi` has no face** on the investor board. The generator's pool
  produced one suitable Black male face and it is already Daniel Okoro on
  index; reusing it breaks one-face-per-name, and renaming Femi to reach a
  face we do have would quietly whiten the cast. Needs either a second
  generated face or Andrew's call on the name. Not a shipping blocker.
- **OPEN, product not design: the Slack app and the CRM write-back.** Two
  sceptics have now said the same thing — "Example, not a customer" disclaims
  the customer and the number, not the *integration*. Naming which CRMs
  settles it. Same for Pay/Sign on the proposals page.

### Superseded — the original blocker list

1. **Presenter identity is unverified on every render.** PLACEMENT.md
   attributes example-signed-proposals, -investor-meetings, -event-showups and
   -accepted-offers to "Andrew clone" in two looks. The two looks render as two
   visibly different men, and neither matches the Andrew in the wave films
   (stack them side by side and it is not arguable). Raph checks out by eye on
   replies and new starters, but with the manifest unreliable no page names
   anyone. **Andrew needs to confirm the avatar groups per render.**
2. **wave-ai-opt.mp4 has no provenance at all.** A woman presents; she is named
   nowhere in PLACEMENT.md, MEDIA-BRIEF.md or git history, and Andrew has
   confirmed he does not know who she is. It is live on
   outcome-booked-calls.html. An unattributable human face on a page that sells
   cloned likenesses is a rights question, not a copy question.
3. **Three pages play the same film.** wave-andrew, wave-raph and wave-ai are
   one 70-74s film in three presenter variants — verified frame-identical at
   t=40s. outcome-replies, outcome-booked-calls and how-it-works all play it.
4. **Lipsync artefact in two renders.** example-accepted-offers.mp4 and
   example-event-showups.mp4 carry a pale blurred smear over the mouth, obvious
   at hero size. I sampled twelve frames across both and cut a new poster from a
   closed-mouth frame at 25.1s; the smear is in the render, not the frame, so I
   reverted the posters. Needs a re-render.

### Harness traps, both of which manufactured a defect

- `getAnimations()` does not reach pseudo-element animations. Without
  `{subtree:true}` the progress rails keep running while everything else
  freezes, and every screenshot shows a rail disagreeing with its counter.
- Element and full-page screenshots composite the `position:fixed` background
  layer once at the top, leaving a hard horizontal seam below the fold. Two
  readers reported that seam as a layout bug on the video card. It does not
  exist. `shotpage.js` takes viewport screenshots for this reason.

### Ownership while two sessions work the outcome pages (24 Aug)

Andrew: "surely we can have more differences on each page to show the different
use cases of it more." Measured before agreeing anything — six of seven share
the exact section sequence (ohero → run → loop → control → end; only
signed-proposals has #mechanism), and page **pairs run 45–54% identical
sentences**. booked-calls/replies is 54%. So it is not only structure; half the
prose is the same prose.

Split agreed with the Different Outcomes session:
- **They** take per-page differentiation — one artefact per page that could not
  appear on any other, committed page by page.
- **This session** keeps the hero video re-pointing onto the eight new renders,
  and starts once they land in `redesign/media/examples/`.
- Neither edits a file the other is mid-edit on; a page is handed over when it
  is committed.

Three constraints handed over with it:
1. Two of the proposed artefacts already exist elsewhere — a diary filling is
   the run panel on booked-calls *and* beat 3 of the Follow-up explainer on
   index; a message thread is beat 3 of the Prospecting explainer *and* the
   Replies card. Differentiate against what the reader has already met, not
   only against the other six pages.
2. Every page already carries two mocked artefacts (run panel, loop board)
   plus the hero chip. A new one is the fourth.
3. Every new artefact needs a marker **above** it. A blind sceptic called the
   marker "the heaviest credibility work on the page in the lightest typeface"
   when it sat underneath, and on a phone a tall artefact means the mock is met
   long before the marker.

   **Do not copy a phrase from this document into a page.** This line used to
   read `"Example, not a customer"`, which is a superseded wording, and an
   instruction carrying a literal string quietly reinstates whatever that
   string used to be. The marker must satisfy a PROPERTY: it names the fiction
   as **invented** rather than merely "not a customer" — the latter reads
   perfectly well as *real work for a firm that hasn't bought yet*, which is
   the reading that made the old wording fail. Take the current wording from a
   shipped page, not from here.

---

## examples.html — the eight films, and the gate that caught them (24 Aug)

The wall showed six raw full-frame talking heads in stock offices, plus three
copies of the same 70-73s film captioned as three different examples. All eight
are now Remotion brand films: recipient named on screen, the sender's page as an
inset panel, the presenter as a circular PiP with a brand-colour ring. The card's
`--accent` is the film's brand hue, so the wall reads as eight companies.

### The finding worth carrying to every other video page

**The script is not evidence about the audio.** Each film's own baked audio was
transcribed and diffed against the script it was given. Three of eight failed:

| script | spoken |
| --- | --- |
| "Calder and Vine" | "Colder and Vi" |
| "let another calendar invite do the talking" | "...invite you at the talking" |
| "We really hope it's a yes." | "We really hope to see yes." |

The last is the closing line of the offer video, directly beneath the CTA. Every
one of them passes a review that reads the script. All three were re-rendered and
all eight now pass. `media/examples/ss53-build/vogate.py` is the gate; run it
against any re-render.

Related: the voice reads at **~222 wpm**, not the 176 wpm in our notes. Beat
timing is forced-aligned to the baked audio; any wpm estimate drifts late.

### Decisions taken here that bind other pages

- **One look for all eight.** Same black-tee look, same voice, verified via
  `get_avatar_look` at render time (result recorded verbatim in
  `media/examples/PLACEMENT-ss53.md`). This settles the handover's "one
  recording, one look" open question by construction. Any page mixing these
  with an older render in a different shirt undoes it.
- **No presenter is named anywhere.** The old PLACEMENT's attribution is what
  misled everyone. The page carries the disclosure wording instead. When Andrew
  confirms the old renders, names can go back everywhere at once.
- **The old renders are kept, not deleted.** `example-accepted-offers.mp4` and
  `example-event-showups.mp4` are the only evidence of the baked-in lipsync
  smear, and the old set is the only way Andrew can settle who is on camera.
  Superseded, recorded as such, left in place. `example-northbank-priya.mp4` is
  NOT superseded and is untouched.

### Page changes and why

- **Featured card spans two of three columns.** Eight equal tiles gave the eye no
  entry point.
- **The format facet is gone.** Its three values returned visually identical
  cards, which taught the visitor the taxonomy was decorative.
- **"Example, not a customer" moved onto the frame**, and is burned into every
  film so it survives a screenshot.
- **`preload="none"`.** With `preload="metadata"` Chromium fetched all eight
  files — ~27 MB — on load, and painted frame 0 over the poster. Cards still load
  when they scroll into view and play ambiently, which is the designed behaviour.
- **16/9 not 16/10**, which was cropping brand furniture off the frame edge.

### A fourth harness-manufactured artefact, for the README

Freezing animations with `getAnimations({subtree:true})` across the whole tree —
not just the section under test — made rows two and three of the wall render
blank in the capture. There is no such defect on the live page. That joins the
pseudo-element rails, the fixed-background seam and the scrollIntoView clipping.
Every one of the four was a defect in the picture of the page, not the page.

### Open item

`~/.demo-engine/agents-sixty.env` holds rotated-out AWS credentials, so
`/agents-sixty/global/app` returns `UnrecognizedClientException` and no
ElevenLabs key can be read. These films use HeyGen's own Andrew clone — the same
pairing the previous example renders used — rather than substituting a different
voice. That is a deviation from the locked house recipe and is recorded in
`PLACEMENT-ss53.md`. Vault access is a real blocker for whoever needs ElevenLabs
next.

### Attribution repair: three changes that shipped under the wrong commit message

Two sessions were editing the same seven files. Three of the Different Outcomes
session's changes were staged inside commits of mine that describe other work,
so the log does not explain them. Recording what they were and why, because
"anyone can understand this later" is the point of the log:

- **`#sequence`, the whole event-showups artefact** — rode in `9b88e6e`
  ("Re-point all seven onto the verified films"). It is that page's
  one-of-a-kind artefact: invite → reminder → nudge → catch-up on a single
  through-line rule, so the page shows a *sequence* rather than another board.
- **"A 'gone quiet' trigger" → "A deal gone quiet"** — rode in `9ccef62`
  ("The wrong name was on screen"). "Trigger" is automation jargon and it was
  the odd chip out: the other two inputs are things you already have, that one
  was an event.
- **"Watch signal" → "How they read it"** (×4 on signed-proposals) and the
  removal of "data room" (×3 on investor-meetings) — also `9ccef62`. "Watch
  signal" is internal analytics vocabulary with no consumer meaning; "data
  room" is fundraising-insider shorthand.

**Cause, and why the obvious rule does not fix it.** The handover said "stage
explicit paths, never `-A`", and I was using explicit paths — `git add
redesign/5-3/outcome-*.html`. Staging a *file* stages every uncommitted change
in it, so explicit paths do nothing when two sessions are in the same file. A
directory path (`git add redesign/5-3/.harness`) also swept in the other
session's untracked screenshots. The only reliable fixes are single ownership
of a file, or hunk-level staging. We took single ownership.

---

# Per-page differentiation, 24 Aug (index session)

## The problem, measured

Andrew: *"surely we can have more differences on each page to show the
different use cases of it more."*

Measured before touching anything, because the complaint deserved evidence:

- **Six of the seven outcome pages ran the IDENTICAL five sections in the
  identical order** — `ohero`, `run`, `loop`, `control`, `end`. Only
  `signed-proposals` had a sixth (`mechanism`). Everything else that differed
  was copy and one accent variable.
- The outcome-pages session then diffed the prose sentence by sentence and
  found **page PAIRS running 45–54% identical sentences** (booked-calls and
  replies at 54%). So it was not only structure — half the prose was the same
  prose.

A reader who opened two of them in tabs saw the same page twice in different
colours. That is what he was reacting to.

## The rule applied

**Each page carries ONE artefact that could not sit on any other page**,
because it is the shape of that use case. Not a shared component with
different content — a shared component would simply have become an eighth
samey section.

| Page | Section | Why only this page can have it |
| --- | --- | --- |
| replies | `#opening` | The first three seconds. The h1 promises "their name and their company in the first three seconds" and nothing showed it. |
| booked-calls | `#fromcall` | Three facts from the call, highlighted, then found again in what the video says. Answers "that's a regex, not a pipeline". |
| signed-proposals | `#vspdf` | The PDF and the page side by side. The page's own wedge line, as objects. |
| event-showups | `#sequence` | Invite → reminder → nudge → catch-up. The only use case that is a SERIES to one person over time. |
| ramped-reps | `#matrix` | People × modules. The only TWO-DIMENSIONAL artefact on the site. |
| accepted-offers | `#one` | A single object in empty space. Hiring is the only audience of one; the emptiness is the argument. |
| investor-meetings | `#samerase` | Three funds, three openings, identical figures. The only case where the substance must NOT vary. |

## Three constraints that shaped it

These came from the outcome-pages session and each one changed a design:

1. **Differentiating the seven from each other is not enough — they must also
   differ from what the reader has already met.** Two of my first choices were
   already on the site: "a diary filling" is booked-calls' own run-panel output
   AND beat 3 of the Follow-up explainer on the homepage; "a message thread" is
   beat 3 of the Prospecting explainer AND the mock on the Replies card. Both
   were replaced.
2. **Every page already carries two or three mocked artefacts** (hero chip, run
   panel, loop board). A new one is a fourth, so check what the existing ones
   already say before building.
3. **The marker goes ABOVE the artefact, never under it.** A blind sceptic
   called it "the heaviest credibility work on the page in the lightest
   typeface" when it sat underneath. On a phone a tall artefact means the
   reader meets the mock a screen or more before the marker.

## Deliberately NOT done

- **No pay/sign controls drawn on `#vspdf`.** Those rails remain an open
  PRODUCT question (no named processor, no e-sign provider) and a sceptic reads
  a drawn button as shipped capability whether or not it is disclaimed. The
  column stops at "the one decision left: the start date" and says what is
  underneath in words. Draw them when Andrew names the rails.
- **Blog and guide pages keep "reps", "at scale", "trigger".** The kill list is
  a standard for marketing chrome around the media, not for three-thousand-word
  editorial where those are ordinary words. Scoped so nobody re-runs the scan
  and reports a regression.

## Verification standard used

Every section, at 320/390/768/1280/1440:
marker above the artefact · no horizontal overflow · no console errors · every
text-bearing element AA against its **composited** background.

Plus a whole-site sweep: **10 pages × 12 widths (320→1440) = 120 checks, 0
failures** — no console errors, no horizontal overflow, no asset 404s.

Two measurement traps hit and recorded, both the same shape as the one already
in this file:

- **A wrap that did not exist.** Two different DOM metrics reported the hero
  ticks wrapping to extra rows at 900–1440. Both were reading label-height
  variance under `align-items:flex-end`, not wrapping. Measuring the container
  height settles it honestly: 85px is two rows, 42px is one.
- **A "hidden" element that was not hidden.** `.estrip-row` computed to
  `visibility:hidden` in a capture — because the capture never scrolled its
  `.rv` reveal into view. It renders correctly with a real scroll pass.

Before fixing a defect that only appears in a capture, prove it on the live
page.

## Fixed here, found by the outcome-pages session

The engine strip paired **generated faces with FULL SURNAMES** beside watch
percentages — "Priya Raman · watched 87%", "James Fenwick", "Daniel Okoro".
`PLACEMENT-ss53.md` states the rule: a face next to a full surname is the line
that flips an illustrative record into an apparently real one. The block was
already marked, which made it the **marked-but-maximally-realistic** case — the
one that survives a fast read as a genuine customer list. First names only now,
and verified sitewide as zero faced rows carrying a surname.

---

# ⚠ FOR ANDREW — the blockers, grouped (24 Aug)

Three sessions worked this site today and every unresolved item turned out to
be **the same species**: *the page says one thing and the artefact behind it
says another.* They are listed together because fixing them one at a time will
keep producing the same class of defect.

None of these is a design decision. Each needs a call from you.

## 0. ⚠ HELD, NEEDS ONE WORD FROM ANDREW — a real person's name on the homepage

`hero-brand-3.mp4` is the Tylt film. It burns **"TYLT · MATT HODKINSON"** into
the frame, legible at 600px. That is a **named private individual** at a company
that was a PROSPECT — sent that demo, never replied, no relationship
established.

Andrew asked for the real client examples back on the hero and this is one of
them. Keningford's and Pathway's work is Sixty's to show. **His name is not**,
and he is the only person in this whole build who cannot consent and was never
asked.

**The slide is commented out.** Not a reversal of Andrew's decision — the safe
default while the question he has not yet answered stays open. The reel runs on
three.

Why it was held rather than merely documented: until this point the only thing
between that name and a public homepage was someone reading a code comment.
**A comment is a note to us; it is not a control.** Nothing in either session's
gate would have gone red, and the session that first disabled these clips had
it recorded as "resolved" — a stale prior that would have carried.

- **TO SHIP IT:** delete two comment markers in `index.html`, restore the
  Consulting tick. One line each.
- **TO DROP IT FOR GOOD:** `cut-signed-proposals.mp4` is a fictional 1.4s
  replacement already on disk.

`MEDIA-BRIEF.md` still reads "must be replaced before this ships" for these
clips. That note predates the decision to show real work and has not been
overridden for anything except this reel.

## 1. Nothing on the site is a real customer

Every proof surface is an invented example, correctly marked. Four blind
readers hit this independently and one put it best: *"a wall of craft with
nothing underneath it."* A hostile RevOps reader: *"the better it looks the
less I believe it."*

More disclosure cannot fix this — it makes it worse, because the markers
become the message. **One real send, with permission, would do more than every
disclosure change made today.** One real page for one real named prospect, or
one real tracking screenshot with the company visible.

**The ask:** is there a single client or prospect who would let us show their
actual page?

## 2. Is the recipient told the video is AI?

The disclosure on every page speaks **to the buyer**, explaining how the demo
was made. Nothing anywhere says what the person *receiving* a video is told.

A talent director read the hiring pages cold and stopped here:

> "The approval flow is all about protecting the sender. Three sign-off gates,
> all mine. Zero of them are the candidate's. The candidate is the only person
> in this transaction who cannot consent to anything."

She would not send a job-offer video without a stated candidate-facing
standard, and named the specific risks: disclosure at a contractual moment,
consent from the manager whose face is cloned (and revocation when they leave),
watch-tracking as a behavioural signal about a candidate, retention and DSAR,
and an offer video with no transcript as an accessibility failure.

**The ask:** does a generated video carry a visible line telling the recipient
it was personalised with AI? If yes, say so on the site — it is a selling
point. If no, hiring is arguably not a use case we should be marketing yet.

## 2b. EMPLOYEE MONITORING — the newest blocker, and the one that moves a buyer to "no"

A talent director at a 300-person consultancy read the hiring pages cold. Her
four consent questions (blocker 2) stop her at **"I need to ask"**. Two other
things move her toward **"no"**, and that distinction changes what is urgent:

**(i) The onboarding grid is a per-employee monitoring dashboard.** In her
words:

> "You can see who is stuck, and on what." Under that heading is a grid of my
> named employees with per-module completion bars. That is employee monitoring:
> it needs a lawful basis, a DPIA in the UK/EU, a retention period, an answer to
> *who can see that row* — their manager? their manager's manager? the whole
> talent team? — and it will come up with our works council.
>
> This is not the same objection as "does the candidate know the face is
> synthetic". It's larger, because it's continuous rather than one-off, it's
> about people who cannot decline without career consequence, and it's the exact
> feature the page is proudest of.

And on the Slack alert on the offers page — *"Offer video watched twice by the
candidate. Good sign."*:

> Behavioural surveillance of a candidate, broadcast to a channel, and
> interpreted for us. If that candidate later isn't hired and asks what data we
> held, that Slack message is disclosable. It's presented as a delight.

Her closing line: **"the most persuasive artefact on that page is also the one
my DPO would open first."**

**(ii) The clone rollout is unpriced and unmentioned.**

> Every hiring manager needs a cloned face and voice. That means a recording
> session and a signed consent per manager. I have roughly twenty-five people
> who make offers. Nowhere is there a word about how a clone gets made, how long
> it takes, or what happens when a manager leaves and their clone doesn't. That
> is a rollout programme, not a purchase, and I found out about it by inference.

**And a contradiction in the economics nobody had noticed:** the offers page
implies a script written per candidate by the hiring manager; the onboarding
page implies one script fanned out. *"Those are opposite economics and the site
doesn't notice. My hiring managers will not write forty bespoke scripts a
quarter."*

**Her verdict:** *ask* on the offer page, **walk, for now** on onboarding.

**The ask:** the softest honest fix is to stop the onboarding page selling the
monitoring view as its headline feature until we can describe its governance.
The grid is the strongest artefact on that page, which is exactly the problem.

**Worth protecting** — the one line she rated best on the whole site:
*"Written by the hiring manager. Spoken by their clone, from one recording."*
Her note: *"it beats every euphemism I've seen from vendors in this space."*

## 2c. The onboarding page's ROUTE NAME still says reps

The file and URL are `outcome-onboarding.html`. Her opening verdict was
**"Sales product with two hiring pages bolted on — and the file name told me
before the copy did."** The copy is fixed; the route is not. Renaming touches
every page's switcher, `examples.html` filters and `index.html` cards, so it was
not done unilaterally mid-flight while three sessions were live. It is a
ten-minute mechanical change once the tree is quiet.

## 3. Pay now / Sign here have no named rails

Drawn as live controls with no payment processor and no e-sign provider named.
A sceptic reads a drawn button as shipped capability regardless of any
disclaimer. `#vspdf` on the proposals page deliberately does NOT draw them
until this is answered.

**The ask:** name the processor and the e-sign provider, or we keep describing
them in words.

## 4. Whose brand does the page wear?

Cold outreach brands the page to the **prospect**
(`northbank.sixtyseconds.ai/priya`); every other use case brands it to the
**sender**. No line on the site states the rule and every sceptical reader
noticed. Andrew has said a wave carries the CLIENT's brand — which contradicts
what the cold-outreach artefacts show.

**The ask:** which is it, and can it be stated in one sentence on
how-it-works?

## 5. The live demo is a prospecting input

The hero asks for an email address before it says what the product does. Two
readers closed the page there. Worse for the non-sales buyer: a hiring or
onboarding visitor *browses as an equal and converts as a salesperson*.

**The ask:** does the demo need the email before it shows anything, or can it
show one built example first?

## 6. No price anywhere

A sales director with a £40k budget: *"booking a call IS the qualification
step — I'd be spending 30 minutes to find out what it costs. I've done that
twice this year with your competitors."*

**The ask:** publish a floor. "Pilots start at £X" is enough.

## 7. Presenter identity — partly closed, worth knowing

`wave-ai-opt.mp4` had a presenter nobody could name, **including Andrew**. It
is now off the site entirely, replaced by the ss53 renders whose avatar chain
is recorded in `PLACEMENT-ss53.md`. Closed — but the way it survived is the
lesson: `gate.sh` enforces one presenter per page and can only check WHICH FILE
is on a page, never WHO IS IN IT. A filename check will keep passing a page
whose disclosure is wrong.

## 8. Real brands on the hero — closed, do not reopen

`hero-brand-2/3/4` were Keningford Partners, Tylt and Pathway Talent Partners,
with **"MATT HODKINSON"** burned into one frame — a named individual at a
company that was a prospect, sent that demo, unanswered. All three are off the
site. `MEDIA-BRIEF.md` had said so in writing beforehand. A previous pass had
"fixed" it by removing the names from the tick LABELS while the wordmarks
stayed burned into the frames those labels played.

**A label is not a mask.** That is the sentence worth keeping.

---

## The ambient loop window — a defect class nothing else here can see (24 Aug)

Found by the examples-page session, checked and generalised here.

**The defect.** `initVideoCards` ambient-plays an in-view card from
`currentTime` 0. Frame 0 of all seven `ss53-*` films is the same shape: the
wordmark top-left, the recipient's first name at ~100px on a near-empty
background, the marker bottom-left. Nothing else. Stacked side by side the
seven are indistinguishable — a blind phone reader on `examples.html` said it
exactly: not eight films, one film with eight captions.

Worse than looking repetitive, that beat argues against us. It proves the cheap
half of the claim (one recording scales to many names) and disproves the
expensive half (that the recipient receives something built for them). On the
outcome pages there is only ONE hero per page, so it was not one weak frame
among eight — it was the only film a cold visitor met, under a headline
promising a personalised video.

**The fix.** `data-amb` / `data-amb-end` on the `<video>`, handled in
`shared.js`. While ambient the loop is constrained to that window and seeks into
it on entry. Every window lands on the same beat *type*: brand plate, headline,
the branded page with the recipient's name legible on it, presenter PiP — the
beat that proves both halves at once.

`examples.html` uses the same attributes; a page-local handler there was removed
in favour of the shared one.

**The hazard the fix introduced, and why it is worth writing down.** `commit()`
only reset `currentTime` when the video was paused — "a card already rolling
ambiently keeps its place". An ambient card is not paused. With a window at
18.5s of a 23s film, clicking play would have started the *sound* five seconds
from the end. A card with a window now always commits from 0. The same latent
bug existed in the examples-page handler and neither session's readers could
have found it, because no reader can click.

**Why this needs a tool and not a note.** The windows are timestamps into films
that other sessions re-render. When a film is re-cut the window is silently
wrong: the page still works, the loop still loops, the screenshot still looks
composed, and **nothing in the visual harness compares a timestamp to the film
it points into**. This is the one defect class here that no screenshot can
catch.

    node .harness/ambwin.cjs --sheet    # score all seven, render the picks together
    node .harness/ambwin.cjs --write    # patch the pages
    node .harness/amb.cjs               # assert in-window + commits from 0

Re-run after ANY re-render of `ss53-*.mp4`. The sheet is not optional: a
most-ink score peaks as happily on a busy cross-fade as on a legible beat, and
two of the first seven picks needed nudging by eye. The score proposes; the eye
decides.

**Known limitation, flagged rather than fixed.** The examples session is
re-rendering all eight films because two of their readers found that the browser
panel inside every film is the same page design recoloured — "five different
clients, five identical page designs", which contradicts the pitch that the film
sits on the recipient's *own* page. Four genuinely different layouts are coming.
The seven windows committed here were scored against the superseded renders and
**must be re-scored when the new films land**. Watch for one thing when doing
it: with four different layouts the richest beat may no longer be the most
probative one. If ink and probative-ness come apart, take probative-ness.

Which of the seven to distrust is known in advance. The layouts, per film:

| Film | New plate layout | Re-score risk |
| --- | --- | --- |
| `replies-cold` | split hero (copy left, player right) | normal |
| `booked-calls` | centred masthead, full-width player | normal |
| `signed-proposals` | split hero | normal |
| `event-showups` | centred masthead | normal |
| `ramped-reps` | dark left-rail sidebar | **high** |
| `accepted-offers` | full-colour band, player overlapping | **high** |
| `investor-meetings` | full-colour band | **high** |

On the sidebar layout the densest region is a navigation rail carrying no
recipient information at all; on the band layout the colour field scores high
and proves nothing. Expect to override those three by hand.

Second thing to check on the two band films: at hero size on a 390px phone the
heroes render ~340px wide. If the recipient's name sits inside the band with the
player overlapping it, confirm the name is still legible at that scale before
picking a window that depends on it. If it is not, the probative beat on those
two is whichever shows the name largest — not the one with the page panel.

## The harness was dead and nobody noticed (24 Aug)

A root `package.json` gained `"type":"module"`. Every script in `.harness/` then
failed on `require is not defined`. Two sessions hit it; one worked around it by
copying scripts to `.cjs` in a temp directory, which left the trap armed for
everyone else. `.harness/package.json` pins that directory to commonjs.

Worth stating plainly: for some unknown period, every "the harness passes" claim
about this section was made against a suite that could not run. The first thing
it caught once revived was a real 18px regression in the loop icon column.

### examples.html — the reader rounds, and what only words could fix (24 Aug)

Eleven in-character blind readers over four rounds, images only, no source, no
browser. Rounds two to four were briefed to attack the previous round rather
than confirm it.

**Round four's finding is the one to carry everywhere.** A hostile RevOps
sceptic passed the page on honesty, then found what three rounds of arguing
about placement and frequency had missed:

> "The badge disclaims a RELATIONSHIP — 'not a customer' — when the thing
> needing disclosure is EXISTENCE. Seventeen disclosures, and not one uses a
> word that means invented."

"Not a customer" reads perfectly well as *real work for a firm that hasn't
bought yet* — especially over convincing company chrome and named people. The
repetition was compensating for imprecision: each round made it louder instead
of accurate. Fixed by wording, not volume. Count went 18 → 9.

**The over-correction that caused it** is worth recording too. In round two a
plain-English editor said the hero's fiction sentence was bloated. It was, and
I deleted it — which is how the hero ended up declaring the *avatar* fiction
plainly while never declaring the *company* fiction at all. Tighten a flabby
disclosure; do not cut it.

**What the readers found that layout could fix, and did:**

| Round | Finding | Fix |
| --- | --- | --- |
| 1 | Headline named no product; "what machine?" | Names the product |
| 1 | "Eight companies. Eight people." implied real ones | Hero declares the fiction |
| 1 | Filters were outcome nouns over non-outcomes | Chips and kickers name the moment |
| 1 | Reading order said "sales only"; hiring 6th and 7th | Row one is sales + hiring |
| 2 | Cards rested on frame 0, the emptiest beat: "one film with eight captions" | Each parks on its own plate beat |
| 2 | Kickers restated their own titles; three disagreed with their chip | One phrase, matching the chip |
| 3 | Five clients, one page design recoloured | Four genuinely different layouts |
| 3 | Five of eight quotes shared one rhetorical move | Different verbatim line per card |
| 3 | Sixteen denials, no counterweight, and a Proof tab never pointed at | Wall ends by pointing at Proof |
| 4 | Founder paragraph sat where the proof should be | One line up top, mechanism below |

**What no layout change reaches, escalated to Andrew in `.sixty/pipeline.json`:**
no real customer anywhere, no price, every face is the founder's, the hiring
compliance questions, and a demo that only accepts an email address. Three
readers named "replace one card with a real send" as the single change that
would flip their verdict. MEDIA-BRIEF forbids inventing one.

**Four defects existed only in pictures of the page** — pseudo-element rails,
the fixed-background seam, scrollIntoView clipping, and a whole-tree
`getAnimations` freeze that blanked two rows. Every one was reported with
receipts. Prove it on the live page first.

---

# Round two: what attacking round one found (24 Aug)

Three fresh readers on re-rendered frames, briefed to **attack round one's
conclusions rather than repeat them**. That brief is what produced the value —
round two's best finding was that round one's *fix* was measured wrong.

## My uniqueness check was near-worthless

I certified "49 distinct people, zero overlap" from a scan of `initLoopList`
data. A reader found six collisions in copy the scan never read. Re-scanning
**rendered text** found **13 names and 4 brands on more than one page**: Ana a
cold prospect and a VC partner, Priya leading one page and named twice inside
another's transcript, Northbank a bank and a fund.

Worst, and entirely mine: the investor page's own bespoke section quoted Rosa,
Femi and Ana — none of whom were in that page's roster of seven partners 800px
below. **The page's cast did not match itself.**

**The rule now:** each film's recipient is authoritative (the name is burned
into the video) and leads their own page. Every person appears on exactly one
page. Verify by scanning rendered text, never config.

## The generator signature survived every rename

`initLoopList.target()` is deterministic in row count, so every board resolved
to the identical 2 / 1–2 / 2 shape. *"Five independent cohorts producing the
identical shape is not a coincidence a reader forgives."* Renaming could not
touch it because renaming touches labels, not data.

`opts.mix` now lets a page state its own distribution. Seven boards, seven
shapes, each true to its use case. **If a fix only changes labels, check
whether the thing you are fixing is in the data.**

## Two pages argued opposite things

Replies says name-slotted template videos fail. The investor artefact *is* one
variable line over an identical middle. *"The site says the competitor fails
because it slots one variable line, and we succeed because we slot one variable
line."* Now named rather than hidden.

## More disclosure made it worse

The disclosure reader's verdict: the site is **less** trustworthy than one with
no disclaimers and fewer fake artefacts, because

1. seven markers per page prove the team knew the artefacts read as claims;
2. the markers function as a distrust map pointing the wrong way — a reader
   infers the *unmarked* set is real, and the unmarked set is Knight Frank,
   £600k+, £595k, 535+ and three review badges;
3. the ratio of fabricated to real proof is unchanged. Disclosure annotated it.

**This is not a design problem and cannot be fixed by more labelling.** It is
blocker #1 in the list above. One real, permissioned send would resolve more
than every disclosure change made today.

## A method note that cost a reader

The phone reader could not do its job: full-page phone screenshots are
11,000–20,600px tall, and downscale to ~120px wide when read. Its layout
findings are unreliable and it said so. **Give phone readers cropped tiles at
native width, one per section** — not a full-page capture.

---

## Round three: five blind readers, and what they changed (24 Aug)

Phone skimmer, hostile RevOps sceptic, plain-English editor, non-sales talent
buyer, sales director. Each briefed to **attack round two's conclusions** rather
than repeat them. Round two's phone reader had said "no reason to care in
8 seconds" and copy was rewritten in response; round three's was told to be
suspicious of that fix.

### Acted on here

**The disclaimer disclaimed the wrong thing.** Every marker said "Example, not
a customer". A hostile reader on `examples.html` passed that page on honesty and
then found what three rounds of arguing about placement had missed: the phrase
disclaims a *relationship*. It reads perfectly happily as real work done for a
firm that has not bought yet — and these tiles carry convincing company chrome
and named people with plausible roles, which is exactly the condition that makes
that reading available. **Not one disclosure used a word meaning invented.**

The diagnosis is the durable half: *the repetition was compensating for
imprecision*. Nobody audited the words, so each round only made them louder.
Badges now read "Invented example"; the board note names the people and
companies as made up rather than describing only how the faces were produced.

**The doubled disclaimer.** Three readers independently called the stack
anxious. Measurement backed them: the `v-source` sentence sat 133–167px above a
chip marker saying the same thing. Cut from all seven. It was also plainly wrong
on two pages — a candidate is not a client, and neither is your own new starter.
Per the examples session's over-correction (they deleted a flabby disclosure
entirely and left the company fiction undeclared), the hero paragraph got the
existence claim back as one tight sentence rather than staying silent.

**The onboarding grid had no scroll cue.** It scrolls horizontally on a phone
and always did; nothing said so, so a reader logged it as a clipped table. Now
fades at the edge and says so in words under 700px.

### Three ways my own checks lied to me in one afternoon

Worth recording together, because they are the same mistake:

1. **`innerText` cannot see `::before`/`::after`.** Half the markers on these
   pages are pseudo-elements, so my count reported 2 per page when the true
   number is 4. Three readers counted correctly *by looking*, and I came close
   to telling them they were wrong.
2. **`loopcheck.js` asserted the literal string "Example, not a customer"** —
   the exact phrase that turned out to be the defect. A check pinned to the
   wording it audits can only ever confirm the status quo; it would have passed
   forever on a disclaimer that disclaims the wrong thing. It now requires a
   word meaning invented AND the faces declared generated, and fails on the old
   phrase.
3. **The whole `.harness` had been unrunnable** under a root `"type":"module"`.

Every one of these is a measurement quietly disagreeing with the artefact, with
the artefact right. That is also the shape of every real defect found today, and
the reason `ambwin.cjs`, `align.py` and `vogate.py` exist: **the tools worth
building are the ones that hold two artefacts up against each other. A check
that opens one artefact very carefully can never see this class of defect.**

### A methodology fix

Readers ran against screenshots taken at `e2461a7`. By the time their findings
came back, the peer session had committed twice, and two of the sceptic's top
findings ("Tom is a cold prospect on one page and a new starter on another",
"Priya is a prospect on one page and a colleague on another") were *real when
the frames were taken and already fixed when I went to act*. Establishing that
took a checkout and a grep. **Pin the commit hash into the shot directory
name** — a reader's finding is a claim about a specific revision, and without
the hash a fixed defect is indistinguishable from a false positive.

### Handed to the Different Outcomes session (copy, not structure)

The onboarding page reads as a sales-rep ramp page with a hiring headline —
"their patch", "your customer list", "rep roster", "three questions that open a
call", "first demo", "cohort". Four kickers that restate their own heading.
Three HOW boxes that restate the paragraph above them. `…sit on the page the
link opens` on three pages. Five of seven headlines opening with "More". A
factual contradiction on booked-calls: the hero says "sent the same day", the
run panel says "sent within the hour".

### Preserved on every reader's instruction

The replies `0:00/0:01/0:02` filmstrip, the booked-calls IN/OUT transcript pair,
the investor three-fund cards, and the ramped-reps grid *with its legend*. Four
different formats; all four demonstrate their heading rather than decorating it.

## ⚠ FOR ANDREW — two new product decisions from round three

Not invented answers. Both raised by a Talent Director persona reading cold.

**1. The onboarding progress grid is employee monitoring, and the page does not
say so.** "You can see who is stuck, and on what" renders named employees with
per-module completion. For a prospect, watch tracking is marketing analytics.
For your own staff it needs a lawful basis, a DPIA in the UK/EU, a retention
period, and an answer to *who can see a given person's row*. Her words: "the
most persuasive artefact on that page is also the one my DPO would open first."
This is not the same as the logged consent questions — it is continuous rather
than one-off, and it concerns people who cannot decline without career cost.

**2. Candidate watch-tracking piped to Slack.** "Offer video watched twice by
the candidate. Good sign." If that candidate is not hired and later asks what
data was held on them, that Slack message is disclosable. The page presents it
as a delight.

**Still open from earlier rounds, and now the deciding objection for two of five
readers:** the site cannot show one real customer, one real number with a sample
size, or a price band. Both buyer personas said they would flip from no to yes
on that alone. No amount of layout or copy reaches it.

---

## Round four, and the check that reaches inside the films (24 Aug)

Two blind readers — the phone skimmer and the hostile sceptic — briefed to
attack round three's fixes rather than confirm them.

### The finding that produced a new tool

The sceptic reported `"Wren & Bell"` on `outcome-event-showups` against the
offers film's burned-in `"WREN & FELL"`. Edit distance 1, and **`Wren & Fell`
appears in no HTML file on this site** — half the pair is inside an mp4.

That is the whole problem in one example. The films carry burned-in text — the
sender's brand, the recipient's name — that exists in no DOM, no stylesheet and
no string a grep can reach. Every check either session had written was
structurally incapable of seeing a page disagree with its own film.

`.harness/cross.cjs` reads `PLACEMENT-ss53.md` as the film's testimony and
asserts the page agrees: a film's recipient is not placed at a different
company, a recipient is named only on their own film's page, and no brand is a
near-miss of a film brand. Six live collisions on the first two runs, including
Elena at Loomis Health in the film and Harlow Reed on the board of the same
page — two artefacts on one page about two different people who happened to
share a name.

The fix taken was better than the finding asked for: **every board's row 1 now
matches its own film exactly**, so the payoff board continues the story the film
started.

Its known limit is in the file's header: it inherits any error in the manifest.
`PLACEMENT-ss53.md` has been wrong before — it once named the wrong presenter on
four pages — so re-derive from the frames before believing the check over the
page. The peer session did exactly that and found a sixth collision my own
role-exclusion had masked: the investor board's subs read "Partner, Tessellate",
so the whole string matched the role pattern and the row was skipped. A role and
an employer in one string is still an employer.

### Two reports chased and found NOT to be defects

**The sticky header eating body text**, reported by readers in two consecutive
rounds with per-screenshot detail. `nav` is translucent with an 18px backdrop
blur, and neither `index.html` nor any outcome page contains a single in-page
anchor, so nothing can land under it. Content passing under a fixed bar is
invisible in motion and looks like a hard cut in a still. **Fifth screenshot
artefact recorded on this work.**

**The status boards showing one word in two colours.** Real when the sceptic saw
it; `badge.cjs` now samples across the whole promotion cycle rather than at rest,
because two rows can hold the same word in different tiers mid-animation.

### The instrument failures, now at six

Recorded because the pattern is the actual lesson:

4. **My header checks never applied the `.rv` reveal that `shotpage.js` does.**
   Without it the document measured 844px tall — the entire page collapsed to
   viewport height — so `scrollY` stayed 0, nothing scrolled, and three
   successive checks confidently reported "no fixed header on this page" while
   a screenshot plainly showed one. This is the most alarming of the six: it did
   not mis-measure, it **silently changed the subject**. *A check that skips the
   page's own setup is measuring a different page.*
5. **A play-overlap check measured `.pt-name`'s bounding box** — a full-tile flex
   container with the glyphs pinned to the bottom — so it reported overlap with
   any control anywhere on the plate: 3364px before the fix and 2116px after,
   both meaningless. A `Range` over the text node gave the real answer.
6. **`badge.cjs` sampled a board that was never in view**, so the rows sat at
   tier 0 and it reported "every status word has one colour" — true, because
   only one word ever appeared.

Combined with the peer session's string-match for "fill the room" walking past
"The room fills", and its `loopcheck` going red on seven correct pages after a
comma changed the casing of a pinned phrase, the general rule is now:

> **Green-on-broken and red-on-correct are the same bug wearing different
> clothes.** "My checks are honest, they go red when something is wrong" is
> exactly the reasoning that makes a pinned check feel safe.

### Still unresolved, and not fixable in layout or copy

Both readers reached the same verdict for the same reason, independently and in
the same words as round three: there is not one real customer, one owned number,
or one price anywhere on the estate, and every artefact carries the vendor's own
label saying it is invented. The sceptic: *"A vendor who has run this for real
can show me one page they actually sent. This one shows me seven pretend ones."*
The disclaimer rewrite made this sharper rather than softer — correctly, since
it converted a suspect asset into an honest non-asset, but it leaves the page
with no evidence layer at all.

Also still open: every film uses the same Andrew take, so *"On your videos it is
your face and your voice"* is never once demonstrated with a face that is not
his — and on `outcome-accepted-offers` his face sits under the caption "the
hiring manager's cloned face and voice".

---

# The films are one animation (24 Aug, open — rebuild in flight)

Andrew, looking at the finished renders: *"all of the animations in the videos
are the same for all of them."* Verified independently by two sessions before
anyone acted.

**The evidence.** Take the frame at the same RELATIVE moment (55% of runtime)
from five films, greyscale, crush the contrast so only ink shows, stack them.
They are **geometrically identical**: wordmark top-left at the same x/y, the
two-line headline on the same baseline, the same rule at the same length
beneath it, the page panel in the same box top-right with the play disc in the
same spot, the PiP in the same circle, the marker bottom-left. Words and brand
hue are the only variables.

One Remotion composition with the nouns swapped.

**Why this outranked everything else open.** The homepage says, in its own
words, *"It doesn't look, sound or feel like a template."* The outcome pages
argue that template videos fail. **The films are the product.** A wave sends
two of these to the same company. That is not a craft nit — it is the page
being contradicted by its own primary artefact.

**It had already been reported and was under-read.** A blind phone reader said
*"I don't see eight films, I see one film with eight captions."* Both sessions
diagnosed that as a frame-0 problem and parked each card on a denser plate
beat. That fixed the **thumbnail**, so the finding appeared to go away. The
reader was describing the whole runtime.

**Third instance of the same mistake in one day** — the fix landing one level
above the generator. The boards' identical 2/1/2/2 shape, the alphabetically
clumped casts, and now this. See the memory note *fix at the generator, not
the instance*; the diagnostic that settles it in a minute is the
same-relative-moment stack above.

**The rebuild** (examples session): structure varies by USE CASE rather than
every film being cold outreach re-skinned — cold outreach keeps the current
statement-led shape; recaps and proposals accumulate numbered items rather than
replacing them; onboarding and event invites advance across time; hiring and
fundraising are single-focus with more air and a late panel.

**Two constraints on that rebuild:**
1. **The PiP geometry does not move** — same circle, corner, size, crop and
   ring treatment, only the hue changing. It is the entire argument of the hero
   reel and of "one recording", and it is the one thing that must survive a
   redesign whose whole purpose is that everything else stops matching.
2. **All four hero cuts are invalidated**, because all four source films
   change. They will be re-cut from the new films at settled plate beats and
   index re-pointed in one pass, not four.

**Acceptance for the rebuild: `.harness/filmstruct.py`.** The standard is now
executable rather than prose, so it can be run rather than argued about.

It samples every film at the same RELATIVE positions (18/35/55/72% — skipping
the hero open and the CTA tail, which are legitimately alike), reduces each
frame to a coarse 16x9 binary ink map, and compares every pair. Colour and copy
are *supposed* to differ, so it deliberately does not pixel-diff; the grid is
coarse enough to measure only where things sit. Two films built from one
composition put their ink in the same cells at the same relative moment
whatever the words say.

`>= 0.86` agreement fails. Exit code 1 on any failing pair.

**It is validated against a known failure, which matters more than the
threshold.** Run against the CURRENT eight films it reports:

```
replies-cold vs signed-proposals    0.955  FAIL
booked-calls vs signed-proposals    0.946  FAIL
booked-calls vs replies-cold        0.915  FAIL
event-showups vs investor-meetings  0.911  FAIL
...
worst pair 0.955   pairs failing: 7/28
VERDICT: SAME STRUCTURE — rebuild has not landed
```

A check that has never seen a real failure is untested, and would have passed
these eight all day. This one has. When the rebuild lands, a pass means
something.

---

## Round five: the chooser panel, read frame by frame (24 Aug)

One reader, a founder of a 40-person B2B company, given the section view plus
every beat of every stage as stills. The panel had not had a reader since round
two and had drifted out of the spotlight while the outcome pages were worked.

### Acted on

- **The section never named the product.** No "video" in the headline, subhead,
  four tab labels or panel. He reverse-engineered "personalised videos" from
  small print inside the cards and self-rated 45% confident. One noun in the
  subhead fixes it.
- **Beat 1's caption did not match beat 1's picture** — "You film once. After
  that, nothing to script, film or edit." over a contact list — and its "we
  build *them*" had no antecedent, because nothing had been named yet. The
  caption now describes the list step; the film-once fact moved to beat 2 where
  the video first appears, so it reads as a feature rather than a caveat
  arriving before the thing it excuses.
- **Short beats hung at the top of a fixed-height frame.** Beat 4 read as "a
  small box at the top, then roughly 450px of nothing" — he took it for a
  loading failure. The fix already existed, in a `@container (max-width:520px)`
  block, with a comment explaining why phones need it. The 720px desktop frame
  needs it for exactly the same reason and had been excluded for no recorded
  reason.
- **Beat 4's invented 87% and invented reply quote are gone.** Craft this high
  makes an invented number read worse rather than better.
- **"Four of these seven"** never said seven *what*, so he counted the cards.
- **The offer was set as fine print.** "You watch the first video and say yes
  before we build the rest" shared a grey 12pt paragraph with the illustration
  note, so a commercial term read as more caveat. Separated and given weight.

### A defect I created while fixing another

`.ocx-steps` is the screen-reader and reduced-motion copy of the four captions,
hand-duplicated. I rewrote the captions and left the list saying the old thing.

The two halves have **disjoint audiences** — nobody who reads the animation sees
the list, and nobody on reduced motion sees the captions — so they can disagree
indefinitely with no one on either side able to tell. `.harness/steps.cjs`
asserts they match exactly after normalising whitespace, dashes and case, on the
principle that "close enough" is how they drift.

### Open, and bigger than a copy fix

**The panel has no manufacturing beat.** Between "your dead list" and "a
finished video for Priya" there is no step. His words: *"Who writes the script?
How does it know anything about Northbank? How long does it take? How many can I
do? That is the mechanism, and the four steps skip it."* The spine — WHAT GOES
IN / WHAT COMES OUT / WHERE IT LANDS / WHAT COMES BACK — is good, but beats 1–3
are one idea at increasing resolution (a video with a name on it) rather than
four links in a chain. Making the build-and-approve step a *picture* rather than
a caption is the single largest available improvement to this panel, and it is a
design change, not an edit.

**He also found the cards beat the animation.** "The cards did more for me in ten
seconds than the animation did in four beats." Worth taking seriously about what
the panel is *for*: if the cards state the outcomes, the panel's only job is the
mechanism the cards cannot carry — which is the beat it is currently missing.

### Independent confirmation of a logged blocker

Without prompting, he hit the brand question and stopped on it:
`northbank.sixtyseconds.ai/priya` in stage 1 versus
`your-brand.sixtyseconds.ai/nadia` in stage 2, and "MADE FOR NORTHBANK" versus
"YOUR BRAND / YOUR LOGO". His verdict: *"Same product, two contradictory stories
about whose name is on the domain. I could not work out whose branding the page
carries, and that's a question I'd want answered before buying."*

This is the logged open question, now with a cold reader's evidence attached. It
is **not** invented into a fix here: the cold-outreach films genuinely brand the
page to the prospect, and every other use case brands it to the sender, so the
panel is faithfully reproducing a real inconsistency in the product story. Andrew
has to say which rule is true before the panel can be made to agree with itself.

And on the presenter: *"the product I'm being sold is my face — and every mock
shows your founder's face, with a paragraph of apology explaining why."* Same
blocker as the outcome pages, reached from a different direction.

---

## The film rebuild: two pages lost the beat that proved their claim (24 Aug)

The examples session re-rendered all eight films — Andrew had spotted that all
eight shared one animation, and the rebuild gave them four genuinely different
structures. Re-deriving the seven ambient windows against the new cuts turned up
a regression that no page check could see, because it is entirely inside the
mp4s.

**`ss53-accepted-offers.mp4` and `ss53-investor-meetings.mp4` no longer contain a
branded page panel at any point.** Sampled at 1.5-second resolution end to end,
18 frames each: brand plate, name card, a sequence of headline cards, PiP.
Nothing else. The other five kept theirs — Priya's page in replies, Elena's in
booked-calls, James's in event-showups, Tom's in onboarding, and an unnamed page
in signed-proposals.

This matters more than a missing element. The page panel is **the only beat that
proves the recipient gets something built for them**, which is the same half of
the claim the frame-0 fix existed to protect. `outcome-accepted-offers.html`
carries a subhead reading "the whole point is that she can tell it was made for
her", above a film that no longer shows her anything of her own.

Best-available windows are set and both are compromises, recorded as such in the
page markup:

| Page | Window | Why |
| --- | --- | --- |
| accepted-offers | 22.0–25.0 | "Sent to nobody else." — the only beat carrying that page's thesis |
| investor-meetings | 13.5–16.5 | "The deck, and the numbers." |

**Resolved the same afternoon, and the cause is worth more than the fix.** The
examples session had given the `single` shape's page plate a *blur*, to separate
it from a converging shape under a structural check that measures where each film
puts its ink. The reasoning was that blurring keeps the ink mass the check can
see while removing text that would compete with the film's own headline. It did
exactly that — and a blurred colour field is not a page. In their words: *"It
satisfied the check and destroyed the evidence."*

That is the page-fixes-the-check trap in its hardest form. Nobody gamed anything:
it was a defensible design decision, taken in the instrument's vocabulary, and
the artefact still *looked* like itself. The sharper statement of it:

> Once you start reasoning about an artefact in terms of what a check can see,
> you have quietly changed what the artefact is for.

Both films were re-rendered with a real, legible, centred panel and the windows
re-derived: **accepted-offers 15.0–18.0** (panel up 14.0–19.0, "Maya, we would
love a yes." on her own branded page) and **investor-meetings 14.5–17.5** (panel
up ~9–19, alongside "The deck, and the numbers."). Both spans measured, not
assumed. Both checked at a true 340px hero width — the size a phone actually
renders — because the entire value of these two windows is that the name is
*read*, not merely present. All seven now park on the same beat type for the
first time.

### The score got 4 of 7 wrong, and the look caught all four

Left to itself `ambwin.cjs` would have shipped **three heroes looping on a
closing CTA card** — "We hope it's a yes.", "Fifteen minutes?" and "Sign and
start." — all dense, all end-of-film, none showing a page, a name or anything
specific. The fourth was signed-proposals, where the score chose a page panel
carrying **no recipient name** over the itemised proposal beat (scope, three
regional teams, onboarding fortnight, the numbers, "One decision left. The start
date."), which is the most specific thing in that film.

The predicted trap was the new sidebar and colour-band layouts; the actual trap
was film *structure*. Either way the mitigation was the same and it is the whole
reason the tool refuses to be a one-liner: **the score proposes, the eye
decides.** Running `--write` on the score would have shipped all four.

### One film content point, escalated not fixed

`ss53-ramped-reps.mp4` carries the on-screen headline "Three questions that open
a call." at the beat where its page panel appears — a sales line on the one film
whose page is about new starters. It is the same complaint a talent director made
about that page in prose ("one real hiring page, one sales page wearing a
lanyard"), now surviving in the film after the page copy was cleaned. The film's
filename is also the last place the old `ramped-reps` framing survives, the route
having been renamed to `outcome-onboarding.html`.

### Confirmed good

The burned-in marker reads **INVENTED EXAMPLE** on every frame sampled across all
seven — the HTML badges and the films finally say the same thing. "Meetings
booked ahead of plan" replaced the "Three times the meetings we budgeted" claim.
All seven park in-window, silent, and commit from 0.
