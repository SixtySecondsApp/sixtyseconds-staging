#!/bin/bash
# Structure/claims/media gate for concept 5.3. Run after every change.
# Extend this rather than re-checking by hand.
cd "$(dirname "$0")"
fail=0
note(){ echo "FAIL: $1"; fail=1; }

# 1. Every <source src> and poster must point at a real file (no fake media).
grep -hoE '(src|poster)="\.\./media/[^"]+"' *.html | sed -E 's/^[a-z]+="//;s/"$//' | sort -u | while read -r p; do
  [ -f "$p" ] || echo "MISSING MEDIA: $p"
done | grep . && fail=1

# 2. Asset version strings must be identical everywhere (cache trap).
vers=$(grep -hoE '\?v=[0-9]+' *.html | sort -u)
[ "$(echo "$vers" | wc -l)" -eq 1 ] || note "mixed asset versions: $(echo $vers)"

# 3. Em dashes in user-facing copy (quoted material exempt — review hits by hand).
# strip HTML comments and CSS/JS blocks first; quotes are exempt.
hits=$(python3 -c "
import re,glob
for f in glob.glob('*.html'):
    # ported Learn articles (blog-*/guide-*) are the live site's own published
    # copy, exempt like quoted material; their listings stay checked
    if f.startswith(('blog-','guide-')): continue
    t=open(f).read()
    t=re.sub(r'<!--.*?-->','',t,flags=re.S)
    t=re.sub(r'<style.*?</style>','',t,flags=re.S)
    t=re.sub(r'<script.*?</script>','',t,flags=re.S)
    for i,l in enumerate(t.split('\n'),1):
        if ('—' in l or '&mdash;' in l) and 'blockquote' not in l and '&quot;' not in l and 'data-run-' not in l and 'story-quote' not in l and '\u201c' not in l and '&ldquo;' not in l:
            print(f+':'+str(i)+':'+l.strip()[:90])
")
[ -z "$hits" ] || { echo "$hits" | head; note "em dashes in copy (check quote exemption)"; }

# 4. One presenter per page: a page must not mix andrew + raph media.
#    Filename matching alone could not see this. The example-* renders carry
#    no presenter in their names (example-ramped-reps is Raph), and a render
#    swapped in from JS is invisible to a scan of the .html. Both let a Raph
#    render onto index, which is an Andrew page. Presenter now comes from
#    PLACEMENT.md, and each page is checked together with the JS it loads.
mixed=$(python3 - <<'PY'
import re, glob, os
pl = open(os.path.join('..','media','examples','PLACEMENT.md')).read()
who = {}
for blk in re.split(r'\n## ', pl)[1:]:
    n = re.search(r'`media/examples/(example-[a-z0-9\-]+)\.mp4`', blk)
    w = re.search(r'\*\*Avatar / voice:\*\*\s*(\w+)', blk)
    if n and w: who[n.group(1)] = w.group(1).lower()
def presenters(text):
    # Scan RENDERED markup only: HTML comments are notes, not the page
    # (check-the-right-representation). Without this, a comment naming a
    # source file trips the check while the visitor sees nothing.
    # NOTE 25 Aug: the hero reel now deliberately mixes presenters
    # (Andrew slides 1-4, Raph slide 5) — approved in the 24 Aug review
    # + by Andrew on 25 Aug. hero-brand-*.mp4 files carry no presenter
    # mapping, so the reel is outside this check by construction; the
    # check still guards every mapped example-* film and poster ref.
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    found = set()
    for m in re.findall(r'(?:poster|wave)-(andrew|raph)', text): found.add(m)
    for m in re.findall(r'(example-[a-z0-9\-]+)\.mp4', text):
        if m in who: found.add(who[m])
    return found
for f in sorted(glob.glob('*.html')):
    if f.startswith(('blog','guide')) or f == 'examples.html': continue
    text = open(f).read()
    for js in re.findall(r'<script[^>]*src="([a-z0-9\-]+\.js)', text):
        if os.path.exists(js): text += open(js).read()
    p = presenters(text)
    if len(p) > 1:
        print('MIXED PRESENTERS: %s (%s)' % (f, ' + '.join(sorted(p))))
PY
)
[ -z "$mixed" ] || { echo "$mixed"; fail=1; }

# 5. Every .v-card needs a video, a .v-play button, and a poster.
for f in *.html; do
  # token-match: 'iv-card' (investor info card) must not count as a video card
  n_card=$(grep -oE 'class="([^"]* )?v-card' "$f" | wc -l | tr -d ' '); n_play=$(grep -c 'class="v-play"' "$f")
  [ "$n_card" -eq "$n_play" ] || note "$f: $n_card v-cards vs $n_play v-play buttons"
done

# 6. JS must reference a selector that exists in markup (the dead .ex-play bug).
grep -q "querySelector('.v-play" shared.js || note "shared.js play-button selector regressed"

# 7. No href="#" dead links.
grep -n 'href="#"' *.html | grep -v 'resultRealOpenLink' | grep . && note 'dead href="#" links'

[ "$fail" -eq 0 ] && echo "GATE PASS" || echo "GATE FAIL"
exit $fail
