# Performance + Safari notes for index.html and how-it-works.html

> **Status (pass 2): all four items applied.**
>
> **Correction to item 1.** Adding `defer` to the three CDN tags alone would have
> broken the page. Deferred scripts run *after* parsing; the GSAP consumers were a
> plain inline `<script>` at the end of `<body>`, which runs *during* parsing, so
> `!window.gsap` would have been true for every guard and the entire choreography
> would have silently died. The note called this "a free, safe win" — it is not.
>
> What was actually done: the inline block was extracted to `index.js`, and
> `shared.js` + `index.js` are now deferred too. Deferred scripts execute in
> document order, so gsap → ScrollTrigger → lenis → shared.js → index.js, and every
> guard passes. Verified against the pre-change file: both render 1 ScrollTrigger,
> 1 pin and 13 tweens, with Lenis active.

Out of scope for this pass (owned by parallel agents) — logged here instead of touched,
per the brief. Everything below was found by reading the two files and cross-checking
against the shared.css / media fixes made in this pass.

## index.html

1. **Defer the three CDN scripts.** `gsap@3.12.5`, `ScrollTrigger.min.js` and
   `lenis@1.1.18` are all loaded in `<head>` (lines 12-14) with no `defer`/`async`,
   so they block parsing/first paint. Every consumer of them is an IIFE at the very
   end of `<body>` already guarded with `if(reduce || !window.gsap || !window.ScrollTrigger) return;`,
   so adding `defer` to all three tags is a free, safe win — no reordering risk.

2. **Point the hero result video at the compressed variant.** Line 120:
   `<source src="../media/wave-andrew-web.mp4">` → `../media/wave-andrew-opt.mp4`
   (now sitting in `../media/`, ~22% smaller, H.264 CRF 28 720p + faststart — see
   this pass's media table). Also worth considering: `preload="metadata"` on that
   `<video id="film">` (line 119) could become `preload="none"`, since `#resultShell`
   is `display:none` until the visitor submits the demo form — the video isn't just
   below the fold, it's not in the DOM's visible flow at all on first load.

3. **Lazy-load the below-fold poster images.** `<img src="../media/poster-raph.jpg">`
   appears 4 times (lines 165, 209, 260, 296 — the comparator's interactive frame,
   its stacked mobile fallback, the pinned engine assembly, and the engine's mobile
   build-log fallback), all below the hero. None currently have `loading="lazy"`.
   The footer logo `<img src="../logo.png">` is in the same boat. Zero `loading=`
   attributes exist anywhere in the file today.

4. **Two backdrop-filter gaps, both in index.html's own local `<style>` block**
   (not shared.css, so this pass's shared.css fix doesn't reach them):
   - Line 646 — `.comp-views{...backdrop-filter:blur(6px)}` (the pageviews pill on
     the comparator's "new" side)
   - Line 752 — `.eng-sat{...backdrop-filter:blur(8px)}` (the Slack/CRM/retargeting
     satellite cards on the pinned engine assembly)

   Same one-line fix used elsewhere in this pass: add `-webkit-backdrop-filter:blur(Npx);`
   immediately before the standard property on both rules.

5. Spot-checked in WebKit and found clean: the `clip-path` drag-wipe comparator,
   `aspect-ratio` on `.eng-vid`/`.comparator`, and the `rgb(r g b / a)` colour syntax
   used throughout. No other WebKit-specific issues found on this page.

## how-it-works.html

> Rebuilt in pass 2 on the wave-explainer spine; the note below predates that
> rewrite. Its footer logo now carries `loading="lazy"` along with every other
> below-fold image on the site.

Already light — no CDN scripts, no `<video>` elements, and none of its page-specific
classes (`.hiw-timeline`, `.hiw-step`, `.e-chip`, `.run-io`) use `backdrop-filter`. It
automatically inherits the nav / nav-drawer `-webkit-backdrop-filter` fix already made
to shared.css in this pass (shared.css is common to every page). The only outstanding
item:

1. Footer logo `<img src="../logo.png">` (line 154) → add `loading="lazy"`. (The nav
   brand logo at line 17 is above the fold — leave that one eager.)

That's the full list for this page.

## Media reference (already produced by this pass, sitting in `../media/`)

| file | before | after | notes |
|---|---|---|---|
| `wave-ai-web.mp4` → `wave-ai-opt.mp4` | 5.2M | 4.0M | H.264 CRF 28, 1280×720, faststart |
| `wave-andrew-web.mp4` → `wave-andrew-opt.mp4` | 4.9M | 3.8M | same settings |
| `wave-raph-web.mp4` → `wave-raph-opt.mp4` | 5.4M | 4.1M | same settings |

Originals were left untouched. All three `-opt.mp4` files are ready to reference —
index.html only needs the one swap noted in point 2 above.

## Capture warnings for anyone verifying this site (25 Aug 2026)

Three ways a capture tool lies about this build, each mistaken for a defect
at least once:

1. **Headless Chrome `--window-size` at phone widths** floors the layout at
   ~600px, so every section reads as right-clipped "overflow". The real
   renderer at 390px lays out clean (scrollWidth 390).
2. **Headless screenshots render video slots black** — the posters and the
   playing frames both. The product is video; judge those slots in a real
   browser.
3. **A hidden Browser-pane tab freezes rAF**, which freezes GSAP, Lenis,
   IntersectionObserver-driven reveals and the comparator's play-once intro
   — everything below the fold screenshots black and scroll-triggered
   behaviour "never fires". It fires; the pane just was not compositing.

For trustworthy captures use Playwright (`~/node_modules/playwright`) with a
real viewport (`{width:390,height:844,isMobile:true}` etc.) — it renders
video frames, honours phone widths, and runs rAF.
