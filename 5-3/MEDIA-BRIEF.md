# Media generation brief — what would lift the video/demo sections

Everything below is generation work (HeyGen / screen capture / ffmpeg), not
HTML. Ordered by impact. The site works without all of it; each item replaces
a weaker stand-in that is currently doing the job.

## 1a. THE HERO MONTAGE — the highest-impact open item (spec, 21 Aug)

**The problem it solves.** Three cold readers independently refused the same
claim, and Andrew said the same thing from the other side:

- "I have no evidence the actual video content — the footage, the spoken
  script — changes at all." (brand reviewer)
- "That's a regex, not proof of a real pipeline." (SDR lead)
- "It's just the same video over and over again." (Andrew, walkthrough)

All three are one objection: **does one recording really become many
genuinely different videos?** A single render cannot answer it, however good
it is. That is why the hero video slot keeps feeling wrong — it is being
asked to prove a claim about *many* using *one*.

**The cut is the proof.** Hard-cutting between four brands while the
presenter's PiP stays constant in the corner states "one recording, many
videos" structurally. No copy has to make the claim.

### Spec

- **One Remotion composition**, not four videos stitched afterwards. Four
  brand segments in a single comp is less work and guarantees the cut rhythm.
- **Four segments, ~3s each, ~13s total**, loops seamlessly. Short enough to
  autoplay in a hero without asking for patience.
- **Each segment unmistakably a different company**: its own brand colour,
  wordmark, recipient name, and one line of on-screen message. Fictional
  names only, as PLACEMENT.md requires.
- **The PiP never changes.** Same Andrew crop, same position, same ring
  treatment, segment to segment. That constant is the entire argument.
  > **Amended 25 Aug 2026 (Andrew's decision, in-session):** the same-Andrew
  > half of this rule is superseded for the reel — the 24 Aug review named
  > face variety as the top visual ask, and Andrew approved generating reel
  > variants from the Raph clone and avatars ("yes do both"). Slide 5
  > (hero-brand-5, Raph over the fictional Halgrove) is the first. What
  > SURVIVES of this rule: same position, same diameter, same ring
  > treatment, one presenter per segment, and the per-presenter one-look
  > rule below (a presenter's segments must all be one session's take —
  > Raph's single segment trivially satisfies it; a second Raph segment
  > must match his grey-hoodie take or replace it wholesale).
- **Silent by design.** It autoplays muted in the hero, so it must read with
  the sound off: on-screen text does the work. No VO needed, which means no
  new HeyGen renders — only new Remotion scenes around PiP footage we
  already hold.
- **Graphics-heavy** (Andrew: "they all just need to be much more graphics
  heavy"). The reference is the 8s mark of the Priya render — brand plate,
  product UI cards, a headline mid-motion — not the sparse dark title cards
  the same film opens on.
- **No CTA inside the video.** The page carries the ask.

### Why not the alternatives

- *Three more full Wave renders, shown as a set*: same proof, several times
  the work, and needs VO and HeyGen time per brand.
- *A real screen capture of a live wave page* (item 1 below): proves "this is
  genuinely real", which is a different objection and one the case studies
  and the Google rating already partly answer. Worth having, second.
- *Reusing the other six example renders*: they are raw full-frame talking
  heads with no branding, motion graphics or PiP. Putting them beside the
  Priya render shows a worse output next to a better one, and the house rule
  is explicit that a raw talking head is never the product.

### STAND-IN IN PLACE (21 Aug) — must be replaced before this ships

`media/examples/hero-brand-1..4.mp4`: four clips of 1.4s, silent, 1280x720,
219KB the set, one file per brand. Built NEWEST FIRST from `60-wave-videos`,
because the recent films are the better template: Northbank (20 Aug),
Keningford (20 Aug), Tylt v2 (19 Aug), Pathway. It was a single baked
hero-reel.mp4 until 24 Aug; per-brand files are what let a brand be replaced
one at a time, and what let the carousel swipe in 3D rather than hard cut.

Northbank is the ONE clip in the whole library that is already fictional, so it
is the only one that could ship as is — and it is the opening cut. It is also
proof the fictional version looks no worse than the real ones.

All six are the SAME session — black tee, plain cream wall, no mic — verified
at full resolution. Judge shirt colour at full size, never on a thumbnail
crop: Takon Talent and Direct Staffing were briefly in the reel as "black tee"
off a low-res crop and are actually the light blue shirt. WizLeads and Marina
are black tee/hoodie but shot with a mic against a plant background, a visibly
different take, so they fail a rule that is about the session not the garment.
Keningford v1 has no PiP; **v2 does** — check the latest version of a film
before excluding it.

TWO OF THE SIX WERE THE WRONG RECORDING (found 24 Aug, cut). DevAssure and
Motif 54 are the LIGHT BLUE COLLARED SHIRT, not the black tee. Both had passed
as "black tee" off the same low-res crop that let Takon Talent and Direct
Staffing through, and both survived a second pass because the PiP is small and
the shirt is dark on the Motif 54 frame. At a 560px magnification of the
neckline the collar is unmistakable on both. The reel is down to FOUR: Northbank,
Keningford, Tylt v2, Pathway — which is the four-segment structure this spec
asked for in the first place.

Judge the neckline, not the garment, and judge it magnified. A dark collared
shirt at thumbnail size is indistinguishable from a black crew tee; the collar
edge is the only reliable tell.

Cutting those two also removed the three things five blind cold readers hit
hardest on 24 Aug: "Badri Varadarajan" and "Sid Mofya" burned under a face the
caption calls Andrew (three readers independently read it as a caught-out lie),
and "We built O2", a fourth-party brand asserted on our own homepage.

MASKING THE LOGOS DOES NOT WORK. Tried twice, both ways, 21 Aug.

*Flat boxes* (drawbox filled with each clip's own header colour): hides the
wordmark and the name label, but leaves a visible rectangle on every gradient
background, and it missed a "devassure test RUNNING" badge sitting mid-frame.

*delogo* (interpolate from surrounding pixels): worse. It smears the mark into
a vertical streak and the wordmark stays readable.

And the logo was never the real exposure. These films burn REAL PEOPLE'S NAMES
into the frame: "Sid Mofya · MOTIF 54", "Badri Varadarajan" on DevAssure, and
"MATT HODKINSON" on Tylt — that last one only surfaced while testing the
masking. Brand colour, typography and body copy identify each company anyway.

Do not retry this. The fix is fictional brands, not removal.

**Why it cannot ship as is.** Those are five REAL companies. The site's rule
is fictional names only, and real prospect and client brands in the homepage
hero imply a relationship and a permission we have not established — Tylt in
particular was a demo sent to a prospect, not a client.

**To ship:** rebuild the same 4x1.5s structure as one Remotion composition
with fictional brands, driven from a SINGLE PiP source so the one-look rule
holds by construction rather than by curation.

### Build notes

`Northbank.tsx` already exists in `60-wave-videos/video` — each additional
brand is a re-skin of it, not a new build.


## 1. A real wave landing page, screen-recorded (highest impact)
A 10-15s 1080p screen capture of an ACTUAL live wave page mid-watch: browser
chrome, the video talking, the watch-through bar filling. Would replace the
in-world Northbank/Priya mock in the index comparator and engine frames with
something provably real. Needs a page we are allowed to show (a demo-account
send, not a client's). One capture with Andrew as presenter is enough.

## 2. Hero film recut (already an open item with Andrew)
Trim to 15-30s, subtitles burned in, the cloned-voice line moved up from 61s.
Media work on the existing film.

## 3. Three missing example renders
examples.html has 5 real per-outcome renders (PLACEMENT.md) but the replies,
booked-calls and investor-meetings adjacent cards reuse generic wave clips.
Three more Avatar V renders via the same pipeline (same fictional-first-name
rule) would make all 8 cards true "this outcome, this script" examples.
Scripts to match the PLACEMENT.md pattern; ~25-35s each.

## 4. Better poster frames
Current posters are first frames (mouths mid-word on two of them). Either
re-extract at a chosen timestamp per clip (ffmpeg -ss, pick a mid-gesture
frame with eyes open), or generate designed personalised-thumbnail posters
(brand plate + name + PiP) matching the pthumb component.

## 5. Real notification captures for the engine satellites
The Slack ping and CRM flip are CSS mocks. A cropped screen capture of a real
Slack notification (demo workspace, fictional prospect name) would ground
stage 4.

## 6. Product screens for the outcome chooser
The chooser tiles on index are abstract shapes. Eight real product
screenshots (one per outcome page style) would replace them. Blocked on
which screens are cleared to show.

## Rules that bind all of it
- Fictional first names only, no real client names or numbers.
- One presenter per page stays law; index is Andrew.
- Every file lands in `media/` with an entry in a PLACEMENT-style manifest.
- No invented durations or stats on chrome around the media.

## 0. The Priya wave video — SHIPPED 20 Aug (media/examples/example-northbank-priya.mp4)
ONE in-world wave video for Priya Raman, Head of Ops at Northbank (fictional,
already in the explainer film's enrichment table). Sky-blue brand (#60C7FA
family), ~25-30s cold-outreach shape: recipient named on-screen, branded
Remotion scenes, Andrew as the circular PiP with a brand ring, CTA. Built
with the personalised-video skill on the Wave engine (60-wave-videos/video),
Andrew's locked voice + Avatar V. Output lands in media/examples/ with a
designed poster. It replaces the explainer film in BOTH index frames, and
the comparator then reverts to the cold-outbound premise (stat restored)
with Priya as the single recipient across the page. Built 20 Aug end to end: VO on the locked Andrew voice (pacing gate PASS,
0% dead air after per-gap tightening), HeyGen Avatar V black-tee look on
subscription credits, Northbank.tsx in 60-wave-videos/video (committed),
designed poster. 23.2s, 2.0MB, loudness -16 LUFS. Wired into the engine
strip, both comparator layers, the mobile build log and the hero's canned
sample; the comparator is back on its cold-outbound premise. Two noted
deviations: no music/SFX bed (the site plays it muted everywhere), and
the "Priya" pronunciation passed alignment but still needs one human
listen.

## 27 Aug — feedback round (Andrew)

1. **Hero reel avatar swaps — DONE (27 Aug, ffmpeg composite).** The real
   builds now carry the team's avatars in the presenter pip, each brand's
   own ring kept: hero-brand-2-raph, hero-brand-3-cynthia, hero-brand-4-cam
   (+ posters), with brand-7 (Vessel/Adam) as the fifth slide. Un-swapped
   originals stay on disk. A proper HeyGen re-render can replace these
   composites later if wanted. hero-brand-3 still burns "MATT HODKINSON"
   (unconverted prospect) — still awaiting Andrew's call.
2. **Comparator right lane.** "One list. Two sends." needs a stronger, more
   visual example render than example-northbank-priya.mp4 — a build with more
   obvious brand motion/personalisation beats. Page-side behaviour (auto
   sweep on reveal) already lands without interaction; this is a media task.
