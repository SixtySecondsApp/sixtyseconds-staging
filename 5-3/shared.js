/* ══════════════════════════════════════════════════════════════
   SIXTY SECONDS — concept 5.1 shared behaviours
   Nav condense, mobile drawer, entrance reveals, ambient parallax.
   Loaded by every page in /5-1/. Page-specific interactions
   (demo builder, outcome chooser, run panel, loop-list) stay inline.
   ══════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.SIXTY_REDUCE = reduce;

  /* nav condense on scroll */
  var navEl = document.getElementById('nav');
  function onScrollNav(){ if(navEl) navEl.classList.toggle('stuck', scrollY > 40); }
  addEventListener('scroll', onScrollNav, {passive:true});
  onScrollNav();

  /* mobile nav drawer — nav also gets a background whenever the drawer is open,
     not only when `.stuck` (scrolled). Without this, opening the drawer at
     scroll-top left a transparent nav row sitting directly above the drawer's
     own opaque panel: a visible two-tone seam across the header. */
  var navToggle = document.getElementById('navToggle'), navDrawer = document.getElementById('navDrawer');
  if(navToggle && navDrawer){
    function setDrawer(open){
      navDrawer.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if(navEl) navEl.classList.toggle('drawer-open', open);
    }
    navToggle.addEventListener('click', function(){
      setDrawer(!navDrawer.classList.contains('open'));
    });
    navDrawer.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ setDrawer(false); });
    });
    /* close drawer if viewport grows past the breakpoint while open */
    addEventListener('resize', function(){
      if(innerWidth > 860 && navDrawer.classList.contains('open')){
        setDrawer(false);
      }
    });
  }

  /* entrance reveals — IntersectionObserver, once each, no scroll-scrub */
  var revealEls = document.querySelectorAll('.rv');
  if(reduce || !('IntersectionObserver' in window)){
    revealEls.forEach(function(el){ el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function(entries, obs){
      entries.forEach(function(en){
        if(en.isIntersecting){
          en.target.classList.add('in');
          obs.unobserve(en.target);
        }
      });
    }, {threshold:.12, rootMargin:'0px 0px -6% 0px'});
    revealEls.forEach(function(el){ io.observe(el); });

    /* Safety net. A short section at the very end of the document can never
       reach the 12% threshold inside a root shrunk by -6%, so its contents
       stay invisible for good — readers reported the page "ending on a logo
       with nothing to click". Reveal anything still hidden once the viewer is
       near the bottom, and sweep once after load for whatever is on screen. */
    var sweep = function(){
      var nearBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 240;
      revealEls.forEach(function(el){
        if(el.classList.contains('in')) return;
        var r = el.getBoundingClientRect();
        if(nearBottom || (r.top < innerHeight && r.bottom > 0)){
          el.classList.add('in');
          io.unobserve(el);
        }
      });
    };
    addEventListener('scroll', sweep, {passive:true});
    addEventListener('load', function(){ setTimeout(sweep, 400); });
  }

  /* ambient field pointer parallax — light touch, desktop only */
  if(!reduce && matchMedia('(hover:hover)').matches){
    var tx=0, ty=0, cx=0, cy=0, field=document.getElementById('field');
    if(field){
      addEventListener('pointermove', function(e){
        tx = (e.clientX/innerWidth-.5)*36; ty = (e.clientY/innerHeight-.5)*36;
      }, {passive:true});
      (function loop(){
        cx += (tx-cx)*.045; cy += (ty-cy)*.045;
        field.style.transform = 'translate3d('+cx.toFixed(2)+'px,'+cy.toFixed(2)+'px,0)';
        requestAnimationFrame(loop);
      })();
    }
  }

  /* magnetic buttons — desktop hover only, cheap */
  if(!reduce && matchMedia('(hover:hover)').matches){
    document.querySelectorAll('.btn').forEach(function(b){
      b.addEventListener('pointermove', function(e){
        var r = b.getBoundingClientRect();
        var dx = (e.clientX-(r.left+r.width/2))/r.width;
        var dy = (e.clientY-(r.top+r.height/2))/r.height;
        b.style.transform = 'translate('+(dx*10).toFixed(1)+'px,'+(dy*7-2).toFixed(1)+'px) scale(1.03)';
      });
      b.addEventListener('pointerleave', function(){ b.style.transform=''; });
    });
  }

  /* wire up [data-book] to scroll to a page's #end section, if present */
  document.querySelectorAll('[data-book]').forEach(function(b){
    b.addEventListener('click', function(){
      var end = document.getElementById('end');
      if(end) end.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'start'});
    });
  });

  /* ══ SIXTY namespace — outcome-page component engines ══════════
     Both built with createElement/textContent/createElementNS only —
     no innerHTML anywhere, so no untrusted-content HTML injection risk
     even though every string here is a static, hardcoded copy value. */
  var SVG_NS='http://www.w3.org/2000/svg';
  function svgFromPaths(paths, opts){
    opts = opts || {};
    var svg=document.createElementNS(SVG_NS,'svg');
    svg.setAttribute('viewBox','0 0 24 24');
    svg.setAttribute('width', opts.size || 16); svg.setAttribute('height', opts.size || 16);
    svg.setAttribute('fill','none'); svg.setAttribute('stroke','currentColor');
    svg.setAttribute('stroke-width', opts.strokeWidth || '1.8');
    svg.setAttribute('stroke-linecap','round'); svg.setAttribute('stroke-linejoin','round');
    paths.forEach(function(p){
      var el=document.createElementNS(SVG_NS, p.tag || 'path');
      Object.keys(p.attrs).forEach(function(k){ el.setAttribute(k, p.attrs[k]); });
      svg.appendChild(el);
    });
    return svg;
  }
  window.SIXTY = window.SIXTY || {};
  window.SIXTY.svgFromPaths = svgFromPaths;

  /* ── run panel: click-driven IN chip → OUT + payoff, crossfade ── */
  window.SIXTY.initRunPanel = function(rootId, variants, defaultId){
    var root = document.getElementById(rootId);
    if(!root) return;
    var chips = root.querySelectorAll('[data-run-id]');
    var panel = root.querySelector('[data-run-panel]');
    var inEl = root.querySelector('[data-run-in]');
    var outEl = root.querySelector('[data-run-out]');
    var kickerEl = root.querySelector('[data-run-payoff-kicker]');
    var bodyEl = root.querySelector('[data-run-payoff-body]');
    var barWrap = root.querySelector('[data-run-payoff-bar]');

    function paint(id){
      var v = variants[id];
      if(!v) return;
      chips.forEach(function(c){ c.classList.toggle('active', c.dataset.runId===id); c.setAttribute('aria-pressed', c.dataset.runId===id ? 'true':'false'); });
      if(inEl) inEl.textContent = v.in;
      if(outEl) outEl.textContent = v.out;
      if(kickerEl) kickerEl.textContent = v.kicker;
      if(bodyEl){
        while(bodyEl.firstChild) bodyEl.removeChild(bodyEl.firstChild);
        (v.payoff||[]).forEach(function(seg){
          if(seg.bold){
            var b=document.createElement('b'); b.textContent=seg.text; bodyEl.appendChild(b);
          } else {
            bodyEl.appendChild(document.createTextNode(seg.text));
          }
        });
      }
      if(barWrap){
        if(v.bar!=null){
          barWrap.hidden=false;
          var i=barWrap.querySelector('i');
          if(i) i.style.width = v.bar+'%';
        } else {
          barWrap.hidden=true;
        }
      }
    }
    function swapTo(id){
      if(reduce || !panel){ paint(id); return; }
      panel.classList.add('swap-out');
      setTimeout(function(){ paint(id); panel.classList.remove('swap-out'); }, 180);
    }
    chips.forEach(function(c){
      c.setAttribute('role','button'); c.setAttribute('tabindex','0');
      c.addEventListener('click', function(){ swapTo(c.dataset.runId); });
      c.addEventListener('keydown', function(e){
        if(e.key==='Enter' || e.key===' '){ e.preventDefault(); swapTo(c.dataset.runId); }
      });
    });
    paint(defaultId);
  };

  /* ── loop-list board: signature "cold list sorts itself warm" piece.
     Time-driven (once triggered by IntersectionObserver) rather than
     scroll-scrubbed, so it can never feel janky regardless of scroll
     speed or device — this is a deliberate change from the earlier
     scroll-driven version the client flagged as unreliable elsewhere. ── */
  var MILESTONE_ICONS = {
    view: [{attrs:{cx:'12',cy:'12',r:'3'}, tag:'circle'},{attrs:{d:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z'}}],
    half: [{attrs:{cx:'12',cy:'12',r:'9'}, tag:'circle'},{attrs:{d:'M12 3a9 9 0 0 1 0 18Z', fill:'currentColor', stroke:'none'}}],
    full: [{attrs:{cx:'12',cy:'12',r:'9', fill:'currentColor', stroke:'none'}, tag:'circle'}],
    bell: [{attrs:{d:'M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z'}},{attrs:{d:'M9.5 19a2.5 2.5 0 0 0 5 0'}}],
    sync: [{attrs:{d:'M4 4v5h5'}},{attrs:{d:'M20 20v-5h-5'}},{attrs:{d:'M5.5 9A7 7 0 0 1 19 12M18.5 15A7 7 0 0 1 5 12'}}]
  };
  var MILESTONE_ORDER = ['view','half','full','bell','sync'];

  window.SIXTY.initLoopList = function(containerId, rows, opts){
    opts = opts || {};
    var board = document.getElementById(containerId);
    if(!board) return;
    var tierLabels = opts.tierLabels || ['Cold','Viewed','Warm','Hot'];
    var entries = [];

    rows.forEach(function(row, i){
      var el = document.createElement('div');
      el.className = 'loop-row tier-0';
      /* order must start in the SAME band setTier(entry,3-tier-index) would put a
         tier-0 row in (300+i), not the raw index i. setTier only recalculates order
         on an actual tier transition (guarded by `if(entry.tier===tier) return`) —
         a row that never gets promoted keeps this construction-time value forever.
         Leaving it at bare `i` (0–6) put permanently-cold rows in the SAME numeric
         band as fully-promoted hot rows (which also resolve to order 0+i), so cold
         rows sorted above warm/viewed rows and tied with hot ones. */
      el.style.order = 300 + i;

      /* The avatar takes a picture when the row has one and falls back to the
         initial when it does not, so a board can be half-populated without
         looking broken. The initial STAYS in the DOM underneath rather than
         being replaced: it is what shows if the file 404s or is still loading,
         and it is what a text-only reader gets. `alt` is empty because the
         name is already the next element — a screen reader announcing "Sarah,
         Sarah" is worse than silence.

         Rows that are companies rather than people (the fund board on
         outcome-investor-meetings) must not be given faces; they simply pass
         no pfp and keep the initial. */
      var av = document.createElement('div'); av.className='loop-avatar';
      av.textContent = row.name.charAt(0);
      if(row.pfp){
        var im = document.createElement('img');
        im.src = row.pfp; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
        im.addEventListener('error', function(){ if(im.parentNode) im.parentNode.removeChild(im); });
        av.appendChild(im);
        av.classList.add('has-pfp');
      }
      el.appendChild(av);

      var nameWrap = document.createElement('div'); nameWrap.className='loop-name';
      var b = document.createElement('b'); b.textContent = row.name;
      var span = document.createElement('span'); span.textContent = row.sub;
      nameWrap.appendChild(b); nameWrap.appendChild(span);
      el.appendChild(nameWrap);

      var iconsWrap = document.createElement('div'); iconsWrap.className='loop-icons';
      var iconEls = {};
      MILESTONE_ORDER.forEach(function(key){
        var span2 = document.createElement('span'); span2.className='loop-icon'; span2.dataset.m=key;
        span2.appendChild(window.SIXTY.svgFromPaths(MILESTONE_ICONS[key], {size:11, strokeWidth:2}));
        iconsWrap.appendChild(span2);
        iconEls[key]=span2;
      });
      el.appendChild(iconsWrap);

      var status = document.createElement('div'); status.className='loop-status';
      status.textContent = tierLabels[0];
      el.appendChild(status);

      board.appendChild(el);
      /* thresholds span 0.05–0.55, ramp window 0.4 (local=(p-thresh)/0.4), so
         every row's local progress still reaches 1 by p=1 regardless of rank —
         see the `target` cap below for why they don't all end up hot. */
      entries.push({el:el, status:status, icons:iconEls, tier:0,
        thresh: rows.length>1 ? 0.05 + i*(0.5/(rows.length-1)) : 0.05,
        /* target: the tier this row is ALLOWED to settle at. The client's
           reference (concept 4) sorts into a mixed board, not a wall of
           identical "hot" pills — top ~2/7 reach hot, next ~2/7 warm, ~1/7
           viewed, the remainder stay cold. Rank-proportional so this still
           behaves sensibly if a page ever passes a different row count. */
        /* opts.mix lets a page state its own distribution as [hot,warm,viewed].
           Without it every board on the site resolved to the identical
           2 / 1-2 / 2 shape, because this function is deterministic in n. An
           adversarial reader spotted exactly that: "five independent cohorts
           producing the identical shape is not a coincidence a reader
           forgives — it is the generator signature." Real outcomes do not
           land in the same ratio on every page, and a cold-outreach board
           should not look like an offer board. */
        target: (function(){
          var n = rows.length, mix = opts.mix;
          var hot    = mix ? mix[0] : Math.max(1, Math.round(n*2/7));
          var warm   = mix ? mix[1] : Math.max(1, Math.round(n*2/7));
          var viewed = mix ? mix[2] : Math.max(1, Math.round(n*1/7));
          if(i < hot) return 3;
          if(i < hot+warm) return 2;
          if(i < hot+warm+viewed) return 1;
          return 0;
        })()});
    });

    function flipReorder(container, mutate){
      var items=[].slice.call(container.children);
      /* a Map, not a plain object — `first[el] = ...` coerces every DOM element key
         to the same string ("[object HTMLDivElement]"), collapsing all seven rows'
         pre-mutation positions into one shared value, so every row FLIP-animated
         from the same origin and piled into a single band mid-transition. */
      var first = new Map();
      items.forEach(function(el){ first.set(el, el.getBoundingClientRect().top); });
      mutate();
      items.forEach(function(el){
        var before=first.get(el);
        var after=el.getBoundingClientRect().top;
        var delta=before-after;
        if(delta){
          el.style.transition='none';
          el.style.transform='translateY('+delta+'px)';
          requestAnimationFrame(function(){
            el.style.transition='transform .55s cubic-bezier(.16,1,.3,1)';
            el.style.transform='';
          });
        }
      });
    }
    function setTier(entry, tier){
      if(entry.tier===tier) return;
      entry.tier=tier;
      var order = tier===3?0: tier===2?1: tier===1?2:3;
      /* Fade the pill out before swapping its word, and back in once the new
         tier class is on. Without this the text changed on the same frame the
         class did, while the colour took 400ms to follow — so for a third of a
         second the badge read HOT in the previous tier's amber. In motion that
         is a crossfade nobody questions; in a screenshot it is two rows sharing
         a word in different colours, and it was reported as a defect. Guarded
         by .harness/badge.cjs, which samples across the whole cycle rather than
         at rest — checking a settled board sees nothing, because every word
         does map to exactly one tier. */
      var pill = entry.status;
      pill.classList.add('swapping');
      flipReorder(board, function(){
        entry.el.className='loop-row tier-'+tier;
        entry.el.style.order = order*100 + entries.indexOf(entry);
        entry.status.textContent = tierLabels[tier];
        requestAnimationFrame(function(){
          requestAnimationFrame(function(){ pill.classList.remove('swapping'); });
        });
        var shown = tier===3?['view','half','full','bell','sync']
          : tier===2?['view','half','full','bell']
          : tier===1?['view','half']:[];
        MILESTONE_ORDER.forEach(function(key){
          entry.icons[key].classList.toggle('on', shown.indexOf(key)>-1);
        });
      });
    }
    function updateProgress(p){
      entries.forEach(function(entry){
        var local=Math.min(1,Math.max(0,(p-entry.thresh)/0.4));
        var natural=0;
        if(local>0.82) natural=3; else if(local>0.52) natural=2; else if(local>0.16) natural=1;
        /* clamp to this row's target tier — this is what turns the sweep
           into a MIXED settled board (2 hot / 2 warm / 1 viewed / 2 cold)
           instead of every row eventually reaching hot. Rows with a lower
           target simply stop climbing once they reach it, while higher-target
           rows keep rising — so different rows visibly settle at different
           points during the same sweep, which is the point of the piece. */
        setTier(entry, Math.min(natural, entry.target));
      });
    }

    if(reduce){ updateProgress(1); return; }

    var started=false;
    function run(){
      if(started) return; started=true;
      var t0=performance.now(), dur=3200;
      (function step(now){
        var p=Math.min(1,(now-t0)/dur);
        updateProgress(p);
        if(p<1) requestAnimationFrame(step);
      })(t0);
    }
    if('IntersectionObserver' in window){
      var io=new IntersectionObserver(function(entriesIO, obs){
        entriesIO.forEach(function(en){ if(en.isIntersecting){ run(); obs.disconnect(); } });
      }, {threshold:.25});
      io.observe(board);
    } else run();
  };

  /* ── process timeline: accordion + scroll-filled spine ────────
     Ported behaviour from the live wave explainer. Steps open on
     click (one at a time), and the spine fills as the section
     scrolls, lighting each node as it is passed. Honours
     prefers-reduced-motion: the spine renders filled and the
     accordion still works, but nothing animates on scroll. */
  window.SIXTY.initTimeline = function(rootId){
    var root = document.getElementById(rootId);
    if(!root) return;
    var steps = [].slice.call(root.querySelectorAll('.step'));
    var fill  = root.querySelector('.spine-fill');
    if(!steps.length) return;

    steps.forEach(function(step, i){
      var card = step.querySelector('.card');
      var body = step.querySelector('.card-body');
      if(!card) return;
      // complete the disclosure pairing: button controls the region it reveals
      if(body){
        var bid = rootId + '-body-' + (i + 1);
        body.id = bid;
        body.setAttribute('role','region');
        card.setAttribute('aria-controls', bid);
      }
      card.setAttribute('aria-expanded', step.classList.contains('open') ? 'true' : 'false');
      card.addEventListener('click', function(){
        var wasOpen = step.classList.contains('open');
        steps.forEach(function(s){
          s.classList.remove('open');
          var c = s.querySelector('.card');
          if(c) c.setAttribute('aria-expanded','false');
        });
        if(!wasOpen){
          step.classList.add('open');
          card.setAttribute('aria-expanded','true');
        }
      });
    });

    if(reduce){
      if(fill) fill.style.height = '100%';
      steps.forEach(function(s){ s.classList.add('lit'); });
      return;
    }

    var ticking = false;
    function paint(){
      ticking = false;
      var r = root.getBoundingClientRect();
      // the fill tracks a line one-third down the viewport
      var marker = innerHeight * 0.34;
      var p = (marker - r.top) / r.height;
      p = Math.max(0, Math.min(1, p));
      if(fill) fill.style.height = (p * 100).toFixed(2) + '%';
      var lineY = r.top + r.height * p;
      steps.forEach(function(s){
        var d = s.querySelector('.dot');
        var y = d ? d.getBoundingClientRect().top : s.getBoundingClientRect().top;
        s.classList.toggle('lit', y <= lineY + 2);
      });
    }
    function onScroll(){
      if(ticking) return;
      ticking = true;
      requestAnimationFrame(paint);
    }
    addEventListener('scroll', onScroll, {passive:true});
    addEventListener('resize', onScroll);
    paint();
  };

  /* ── count-up stats ───────────────────────────────────────────
     Each [data-count] element counts from 0 to its target once it
     scrolls into view. Reduced motion jumps straight to the value. */
  window.SIXTY.initCounters = function(rootId){
    var root = rootId ? document.getElementById(rootId) : document;
    if(!root) return;
    var els = [].slice.call(root.querySelectorAll('[data-count]'));
    if(!els.length) return;

    function run(el){
      var target = parseFloat(el.getAttribute('data-count')) || 0;
      var suffix = el.getAttribute('data-count-suffix') || '';
      if(reduce){ el.textContent = target + suffix; return; }
      var t0 = performance.now(), dur = 1400;
      (function step(now){
        var p = Math.min(1, (now - t0) / dur);
        // ease-out — fast then settling, never ease-in
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * e) + suffix;
        if(p < 1) requestAnimationFrame(step);
      })(t0);
    }

    if(!('IntersectionObserver' in window)){ els.forEach(run); return; }
    var io = new IntersectionObserver(function(entries, obs){
      entries.forEach(function(en){
        if(en.isIntersecting){ run(en.target); obs.unobserve(en.target); }
      });
    }, {threshold:.4});
    els.forEach(function(el){ io.observe(el); });
  };


  /* ── video cards: ambient motion, then real playback ──────────
     Modelled on perspective.co, where every video is muted, looping
     and playing with no controls, so the page is always moving.
     Difference here: ours are megabytes each, so a card only starts
     once it scrolls into view and pauses again when it leaves,
     rather than all of them autoplaying on load. Clicking commits to
     sound and a CUSTOM control bar (play/pause, draggable scrub,
     time, mute) — native <video controls> fought the overlay stack
     and made seeking unreliable, so it is never enabled. Reduced
     motion gets a still poster and click-to-play only. */
  window.SIXTY.initVideoCards = function(sel){
    var cards = [].slice.call(document.querySelectorAll(sel || '.ex-card'));
    if(!cards.length) return;
    var playing = null;

    function fmt(s){
      s = Math.max(0, Math.floor(s||0));
      return Math.floor(s/60) + ':' + ('0'+(s%60)).slice(-2);
    }

    cards.forEach(function(card){
      var v = card.querySelector('video');
      var btn = card.querySelector('.v-play, .ex-play');
      if(!v) return;
      v.controls = false;
      var host = v.parentElement;

      /* custom control bar, built once per card */
      var ctl = document.createElement('div');
      ctl.className = 'v-ctl';
      ctl.innerHTML =
        '<button type="button" class="v-ctl-pp" aria-label="Pause"></button>' +
        '<div class="v-ctl-track" role="slider" aria-label="Seek" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
          '<i class="v-ctl-fill"></i><span class="v-ctl-knob"></span>' +
        '</div>' +
        '<span class="v-ctl-time">0:00</span>' +
        '<button type="button" class="v-ctl-mute" aria-label="Mute"></button>';
      host.appendChild(ctl);
      var pp = ctl.querySelector('.v-ctl-pp'),
          track = ctl.querySelector('.v-ctl-track'),
          fill = ctl.querySelector('.v-ctl-fill'),
          knob = ctl.querySelector('.v-ctl-knob'),
          time = ctl.querySelector('.v-ctl-time'),
          mute = ctl.querySelector('.v-ctl-mute');

      function paint(){
        var d = v.duration || 0, p = d ? (v.currentTime / d) * 100 : 0;
        fill.style.width = p + '%';
        knob.style.left = p + '%';
        track.setAttribute('aria-valuenow', String(Math.round(p)));
        time.textContent = fmt(v.currentTime) + (d ? ' / ' + fmt(d) : '');
        pp.classList.toggle('is-paused', v.paused);
        pp.setAttribute('aria-label', v.paused ? 'Play' : 'Pause');
        mute.classList.toggle('is-muted', v.muted);
        mute.setAttribute('aria-label', v.muted ? 'Unmute' : 'Mute');
      }
      v.addEventListener('timeupdate', paint);
      v.addEventListener('durationchange', paint);
      v.addEventListener('play', paint);
      v.addEventListener('pause', paint);
      v.addEventListener('volumechange', paint);

      pp.addEventListener('click', function(e){
        e.stopPropagation();
        if(v.paused){ var p=v.play(); if(p&&p.catch)p.catch(function(){}); } else v.pause();
      });
      mute.addEventListener('click', function(e){
        e.stopPropagation();
        v.muted = !v.muted;
      });

      /* click and drag anywhere on the track to seek */
      var scrubbing = false;
      function seekFrom(clientX){
        var r = track.getBoundingClientRect();
        var frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
        if(v.duration) v.currentTime = frac * v.duration;
        paint();
      }
      track.addEventListener('pointerdown', function(e){
        e.stopPropagation(); e.preventDefault();
        scrubbing = true;
        if(track.setPointerCapture){ try{ track.setPointerCapture(e.pointerId); }catch(err){} }
        seekFrom(e.clientX);
      });
      track.addEventListener('pointermove', function(e){ if(scrubbing) seekFrom(e.clientX); });
      track.addEventListener('pointerup', function(){ scrubbing = false; });
      track.addEventListener('pointercancel', function(){ scrubbing = false; });
      track.addEventListener('keydown', function(e){
        var step = (v.duration || 30) * 0.05;
        if(e.key === 'ArrowLeft'){ v.currentTime = Math.max(0, v.currentTime - step); e.preventDefault(); }
        else if(e.key === 'ArrowRight'){ v.currentTime = Math.min(v.duration || 0, v.currentTime + step); e.preventDefault(); }
        paint();
      });
      /* the bar itself must never bubble a click into the card/video */
      ctl.addEventListener('click', function(e){ e.stopPropagation(); });

      function demote(){
        card.classList.remove('playing');
        playing = null;
        v.muted = true; v.loop = true;
      }

      /* data-amb / data-amb-end park the SILENT loop on the film's strongest
         beat instead of letting it roll from 0.

         Every one of these films opens on the same shape: the recipient's
         first name, large, on a near-empty background. Seven cards all
         ambient-playing from frame 0 do not read as seven films — a blind
         phone reader on the examples page put it exactly right, "I don't see
         eight films, I see one film with eight captions". Worse, that opening
         beat proves the cheap half of the claim (one recording scales) and
         disproves the expensive half (that the recipient gets something built
         for them). The beat where the branded page appears with their name on
         it proves both, so that is the one a scroller should meet.

         Committing (click / play) still starts the film at 0 — the loop
         window is a shop window, not a trim. */
      var ambA = parseFloat(v.dataset.amb), ambB = parseFloat(v.dataset.ambEnd);
      var hasWindow = !isNaN(ambA) && !isNaN(ambB) && ambB > ambA;
      if(hasWindow){
        v.addEventListener('timeupdate', function(){
          /* only while ambient: a committed card plays the whole film */
          if(card.classList.contains('playing')) return;
          if(v.currentTime >= ambB || v.currentTime < ambA - 0.05){
            try { v.currentTime = ambA; } catch(e){}
          }
        });
      }

      function ambient(on){
        if(reduce || card.classList.contains('playing')) return;
        if(on){
          v.muted = true; v.loop = true;
          if(hasWindow && (v.currentTime < ambA || v.currentTime >= ambB)){
            try { v.currentTime = ambA; } catch(e){}
          }
          var p = v.play();
          if(p && p.catch) p.catch(function(){});
          card.classList.add('ambient');
        } else {
          v.pause();
          card.classList.remove('ambient');
        }
      }

      function commit(){
        if(card.classList.contains('playing')) return;
        if(playing && playing !== card){
          var pv = playing.querySelector('video');
          playing.classList.remove('playing');
          if(pv){ pv.muted = true; pv.loop = true; }
        }
        playing = card;
        card.classList.remove('ambient');
        card.classList.add('playing');
        v.loop = false; v.muted = false;
        /* Commit ALWAYS starts from 0 (24 Aug review, PRD-07 §1): "when I
           press play it shouldn't play from when I clicked on it". The old
           keeps-its-place branch existed for windowless cards whose silent
           loop had wandered, and it handed the visitor the film from
           wherever the loop happened to be — a person pressing play expects
           frame one. The ambient loop itself is untouched. */
        try { v.currentTime = 0; } catch(e){}
        var p = v.play();
        if(p && p.catch) p.catch(function(){});
        paint();
      }

      if(btn) btn.addEventListener('click', commit);
      v.addEventListener('click', function(e){
        if(!card.classList.contains('playing')){ e.preventDefault(); commit(); }
        else { if(v.paused){ var p=v.play(); if(p&&p.catch)p.catch(function(){}); } else v.pause(); }
      });
      v.addEventListener('ended', function(){
        /* stay on the committed card, paused at the end, ready to replay —
           snapping back to the silent ambient loop read as a glitch */
        v.pause();
        paint();
      });

      if(reduce) return;
      if('IntersectionObserver' in window){
        var io = new IntersectionObserver(function(entries){
          entries.forEach(function(en){
            if(card.classList.contains('playing')){
              if(!en.isIntersecting) v.pause();
              return;
            }
            ambient(en.isIntersecting);
          });
        }, {threshold:.35});
        io.observe(card);
      } else {
        ambient(true);
      }
    });
  };

})();

/* ── pv-live frames: roll while on screen, pause off screen ───── */
(function(){
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function init(){
    var vids=[].slice.call(document.querySelectorAll('.pv-live video'));
    if(!vids.length || reduce) return;
    function play(v){ var p=v.play(); if(p&&p.catch)p.catch(function(){}); }
    /* data-loop-start/end constrain a long source to its strongest segment */
    vids.forEach(function(v){
      var a=parseFloat(v.dataset.loopStart), b=parseFloat(v.dataset.loopEnd);
      if(isNaN(a)||isNaN(b)||b<=a) return;
      v.addEventListener('timeupdate',function(){ if(v.currentTime>=b||v.currentTime<a-0.05) v.currentTime=a; });
    });
    if(!('IntersectionObserver' in window)){ vids.forEach(play); return; }
    var io=new IntersectionObserver(function(es){
      es.forEach(function(en){ en.isIntersecting ? play(en.target) : en.target.pause(); });
    },{threshold:.25});
    vids.forEach(function(v){ io.observe(v); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();

/* ── Learn dropdown disclosure (25 Aug cold-reader round) ──────────
   The toggle is a real <button>: Enter/Space opens instead of
   navigating (the old <a href="blog.html"> ate Enter and stranded
   keyboard users), aria-expanded tracks state, Escape closes and
   returns focus, and an outside click closes. Hover/:focus-within
   CSS still works with JS dead; this only adds the click path. */
(function(){
  document.querySelectorAll('.nav-drop').forEach(function(drop){
    var btn=drop.querySelector('.nd-toggle');
    if(!btn) return;
    function setOpen(on){
      drop.classList.toggle('is-open', on);
      btn.setAttribute('aria-expanded', on?'true':'false');
    }
    btn.addEventListener('click', function(){ setOpen(!drop.classList.contains('is-open')); });
    drop.addEventListener('keydown', function(e){
      if(e.key==='Escape'){ setOpen(false); btn.focus(); }
    });
    document.addEventListener('click', function(e){
      if(!drop.contains(e.target)) setOpen(false);
    });
  });
})();

/* ── marquee: infinite ALWAYS, glitch-free (25 Aug, r2) ────────────
   The CSS animates the track by -50%, seamless only when the track is
   two identical halves each at least as wide as the wall. v1 rebuilt
   the belt at DOMContentLoaded and on every resize, inside a live
   will-change:transform layer — the browser composited stale frames
   over the new layout (logos ghosting on top of each other). v2:
   - waits for every image to DECODE before measuring (no zero-width
     clones), so one build is correct instead of eventually-correct
   - rebuilds only when the wall's width actually changes
   - suspends the animation during a rebuild and restarts it after a
     forced reflow, so no stale texture survives
   Reduced motion keeps its CSS stop. */
(function(){
  var widths = new WeakMap();
  function build(track){
    var src = track.querySelector('.lw-set');
    if(!src) return;
    var wall = track.closest('.logo-wall');
    var wallW = wall ? wall.clientWidth : track.parentElement.clientWidth;
    if(widths.get(track) === wallW) return;   // nothing changed
    widths.set(track, wallW);
    // suspend the animation while the belt is rebuilt
    track.style.animation = 'none';
    [].slice.call(track.querySelectorAll('.lw-set')).forEach(function(s,i){ if(i>0) s.remove(); });
    /* Freeze each image to explicit pixels before measuring. Aspect-mapped
       max-width/max-height images inside nested max-content flex make the
       set's intrinsic box come out NARROWER than its content in Chrome —
       the last mark overflowed its set by ~31px and sat on top of the next
       set's first mark (the okko/capium collision, 25 Aug). Explicit sizes
       take intrinsic sizing out of the equation. Cleared first so a resize
       re-freeze picks up the current media-query caps. */
    [].slice.call(src.querySelectorAll('img')).forEach(function(im){
      im.style.width=''; im.style.height='';
    });
    void track.offsetWidth;
    [].slice.call(src.querySelectorAll('img')).forEach(function(im){
      var r = im.getBoundingClientRect();
      if(r.width > 0){ im.style.width = r.width+'px'; im.style.height = r.height+'px'; }
    });
    var w = src.scrollWidth || 1, group = 1;
    var frag = document.createDocumentFragment();
    while (w * group < wallW * 1.1 && group < 12){
      var c = src.cloneNode(true); c.setAttribute('aria-hidden','true');
      frag.appendChild(c); group++;
    }
    // mirror the whole group so the two halves are identical
    for (var i=0;i<group;i++){
      var m = (i===0 ? src : frag.children[i-1]).cloneNode(true);
      m.setAttribute('aria-hidden','true');
      frag.appendChild(m);
    }
    track.appendChild(frag);
    void track.offsetWidth;                    // flush layout
    track.style.animation = '';               // restart clean
  }
  function ready(track){
    var imgs = [].slice.call(track.querySelectorAll('.lw-set img'));
    imgs.forEach(function(i){ i.loading='eager'; });
    return Promise.all(imgs.map(function(i){
      return i.decode ? i.decode().catch(function(){}) : Promise.resolve();
    }));
  }
  function run(){
    [].slice.call(document.querySelectorAll('.logo-wall.is-marquee .lw-track')).forEach(function(t){
      ready(t).then(function(){ build(t); });
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', run); else run();
  var t; window.addEventListener('resize', function(){ clearTimeout(t); t=setTimeout(run,250); });
})();

/* ── Cookie consent + gated marketing trackers ─────────────────────────────
   Plausible is cookieless and always on; nothing below runs without consent.
   ICO-standard: Accept and Reject equally prominent, choice persisted, and a
   footer "Cookie preferences" link reopens the banner at any time.
   Pixel IDs live in SS_TRACKERS — empty string disables that tracker. */
(function(){
  'use strict';
  var KEY='ss-cookie-consent';
  var SS_TRACKERS={ ga4Id:'G-2LT5Q01642', googleAdsId:'', metaPixelId:'' };

  function getChoice(){ try{ var v=localStorage.getItem(KEY); return v==='accepted'||v==='rejected'?v:null; }catch(e){ return null; } }
  function setChoice(v){ try{ localStorage.setItem(KEY,v); }catch(e){} }

  function loadTrackers(){
    var gid=SS_TRACKERS.ga4Id||SS_TRACKERS.googleAdsId;
    if(gid){
      var g=document.createElement('script'); g.async=true;
      g.src='https://www.googletagmanager.com/gtag/js?id='+gid;
      document.head.appendChild(g);
      window.dataLayer=window.dataLayer||[];
      window.gtag=function(){ dataLayer.push(arguments); };
      gtag('js', new Date());
      if(SS_TRACKERS.ga4Id) gtag('config', SS_TRACKERS.ga4Id);
      if(SS_TRACKERS.googleAdsId) gtag('config', SS_TRACKERS.googleAdsId);
    }
    if(SS_TRACKERS.metaPixelId){
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
      document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', SS_TRACKERS.metaPixelId); fbq('track','PageView');
    }
  }

  function showBanner(){
    if(document.getElementById('ssCookie')) return;
    var el=document.createElement('div');
    el.id='ssCookie';
    el.setAttribute('role','dialog');
    el.setAttribute('aria-label','Cookie preferences');
    el.innerHTML='<p>We use cookies for advertising measurement once you accept. '+
      'Our analytics is cookieless. <a href="privacy.html">Privacy policy</a>.</p>'+
      '<div class="ssc-btns">'+
      '<button type="button" class="ssc-accept">Accept all</button>'+
      '<button type="button" class="ssc-reject">Reject all</button>'+
      '</div>';
    document.body.appendChild(el);
    el.querySelector('.ssc-accept').addEventListener('click',function(){ setChoice('accepted'); el.remove(); loadTrackers(); });
    el.querySelector('.ssc-reject').addEventListener('click',function(){ setChoice('rejected'); el.remove(); });
  }

  function init(){
    var c=getChoice();
    if(c===null) showBanner();
    else if(c==='accepted') loadTrackers();
    // Footer reopener on every page
    var legal=document.querySelector('.foot-legal');
    if(legal && !legal.querySelector('.ssc-open')){
      var sep=document.createTextNode(' · ');
      var a=document.createElement('a');
      a.href='#'; a.className='ssc-open'; a.textContent='Cookie preferences';
      a.addEventListener('click',function(e){ e.preventDefault(); showBanner(); });
      legal.appendChild(sep); legal.appendChild(a);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
