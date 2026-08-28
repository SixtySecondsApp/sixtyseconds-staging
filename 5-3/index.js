/* index.html page behaviours — extracted from the inline <script> so it can
   be loaded with defer AFTER gsap/ScrollTrigger/lenis. Deferred scripts run in
   document order once parsing finishes, which is what makes the CDN defer safe:
   as an inline block this ran DURING parsing, before the deferred CDN scripts,
   so every `!window.gsap` guard bailed and the whole choreography died. */
/* ══ hero live demo build sequence — DOM built via createElement/textContent only, no innerHTML ══
   REAL INTEGRATION (2026-08-18) — see INTEGRATION-NOTES.md in this same folder for the full
   writeup. Summary of what changed and why:
   - A real (non-blank, contains "@") submission now calls Sixty Studio's live public API directly
     — POST https://demo.sixtyseconds.ai/api/v1/demo/capture — the exact endpoint the real
     demo.sixtyseconds.ai/demo hero itself calls (confirmed by reading sixty-video-platform's
     public/crown-demo.html, function wireEntryForm()).
   - deliveryMode is HARDCODED to the literal string 'test' below, with a fixed Sixty-controlled
     testEmail. This page never exposes a way to change either. This can NEVER trigger a live,
     prospect-facing email send:
       · sixty-video-platform src/app/api/v1/demo/capture/route.ts — a request that omits or sends
         deliveryMode:'test' is only ever honoured as 'test'; 'live' additionally requires the
         independent platform_settings master switch to already be live, checked server-side, and
         still cannot be forced by this page since we never send 'live'.
       · sixty-video-platform src/lib/pipeline/delivery.ts, function deliveryRecipient(): for the
         public_demo lane, `if (context.publicDemoDeliveryMode !== "live") return { to:
         validTestRecipient(context.publicDemoTestEmail) ?? testEmail, testMode: true }` — routes to
         the test inbox UNCONDITIONALLY, without even consulting the live/test master switch, for
         any request that isn't explicitly 'live'.
       · sixty-video-platform src/lib/pipeline/delivery.test.ts, test "routes an explicit test
         build to its saved test email even while the master gate is live" — proves this exact
         scenario at the test-suite level, including asserting the master-gate check is never even
         called.
     Verified live: the production capture route's own CORS preflight allows
     https://www.sixtyseconds.ai (the two are already paired — sixty-video-platform migration
     0054_public_demo_release_lane.sql registers both www.sixtyseconds.ai and demo.sixtyseconds.ai
     as this integration's allowed origins), so this call is expected to work once this page is
     served from www.sixtyseconds.ai. From file:// (or any other origin) the browser's own CORS
     policy blocks it, which this code treats exactly like any other capture failure — automatic,
     silent fallback to the original simulation, below, unchanged.
   - The real progress stream is same-origin-only server-side (no Access-Control-Allow-Origin on
     /api/v1/demo/stream/{id} — confirmed live via a direct header check) so a script on this page
     cannot read it. Instead, once a real build starts, its own live page (/demo/{jobId} — the same
     real-time choreography a direct visitor sees) is shown inline via an iframe: Studio's own CSP
     already allowlists https://www.sixtyseconds.ai in frame-ancestors (confirmed live), so this is
     expected to render there. This is the one respect in which this isn't a byte-for-byte "stream
     events into this page's own four-node row" (see INTEGRATION-NOTES.md for exactly what a
     same-origin CORS fix on the stream route would unlock instead).
   - A conversion signal fires on submit via fireConversion() below. It carries a stage string and
     nothing else — no address, no derived name or company — so it stays outside the claim below.
   - The typed address travels to exactly one place: the single capture fetch() below (direct to
     Studio's own database, like any other real demo.sixtyseconds.ai visitor). The DOMAIN alone
     (never the address) additionally goes to two lookups: a DNS-over-HTTPS MX check for the §5
     validity gate, and the public logo endpoints (icon.horse, unavatar.io) for the stage-1 brand scrape (fetchBrand). Rate limiting keeps a
     one-way HASH of the normalised address in localStorage (addrKey below); the address itself is
     never stored on this page and no cookie or analytics payload ever carries it. */
(function(){
  var demoForm=document.getElementById('demoForm'), buildBtn=document.getElementById('buildBtn'),
      emailIn=document.getElementById('dEmail'), consoleEl=document.getElementById('console'),
      consoleLines=document.getElementById('consoleLines'), progressFill=document.getElementById('progressFill'),
      resultShell=document.getElementById('resultShell'), resultFor=document.getElementById('resultFor'),
      resultTime=document.getElementById('resultTime'), consoleModeNote=document.getElementById('consoleModeNote'),
      resultCanned=document.getElementById('resultCanned'), resultRealWrap=document.getElementById('resultRealWrap'),
      resultRealFrame=document.getElementById('resultRealFrame'), resultRealLoading=document.getElementById('resultRealLoading'),
      resultRealOpenLink=document.getElementById('resultRealOpenLink'),
      resultForLabel=document.getElementById('resultForLabel');
  var reduce = window.SIXTY_REDUCE;

  // Real Studio API — see the file header above for the full safety proof (file:line citations).
  // Neither constant is ever derived from user input or made configurable by anything on this page.
  var DEMO_API_BASE = 'https://demo.sixtyseconds.ai';
  var DEMO_CAPTURE_URL = DEMO_API_BASE + '/api/v1/demo/capture';
  var DEMO_TEST_EMAIL = 'andrew@sixtyseconds.ai'; // matches Studio's own crown-demo.html default test inbox

  /* ── Cloudflare Turnstile (invisible bot check) ──────────────────────────
     Defeats VPN-rotating / email-list bots that per-IP and per-email caps
     cannot see. Cookie-free, so it sits outside the consent banner. Inactive
     until the sitekey is set; the server half (TURNSTILE_SECRET in Studio's
     capture route) enforces only when its secret is set, so page and server
     can deploy in either order. Token is fetched lazily on first field focus
     (keeps first paint clean) and refreshed per submit attempt. */
  var SS_TURNSTILE_SITEKEY = '0x4AAAAAAEfMR8MTo3FR-FSF';
  var ssTsToken = null, ssTsWidget = null, ssTsLoading = false;
  function ssTsEnsure(){
    if(!SS_TURNSTILE_SITEKEY || ssTsLoading || window.turnstile) return ssTsRender();
    ssTsLoading = true;
    var sc=document.createElement('script');
    sc.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    sc.async=true; sc.onload=ssTsRender;
    document.head.appendChild(sc);
  }
  function ssTsRender(){
    if(!SS_TURNSTILE_SITEKEY || !window.turnstile || ssTsWidget!==null) return;
    var host=document.createElement('div');
    host.style.position='fixed'; host.style.bottom='0'; host.style.left='-9999px';
    document.body.appendChild(host);
    ssTsWidget=window.turnstile.render(host,{
      sitekey:SS_TURNSTILE_SITEKEY,
      callback:function(t){ ssTsToken=t; },
      'error-callback':function(){ ssTsToken=null; },
      'expired-callback':function(){ ssTsToken=null; if(window.turnstile&&ssTsWidget!==null) window.turnstile.reset(ssTsWidget); }
    });
  }
  document.addEventListener('focusin', function(e){
    if(e.target && e.target.id==='dEmail') ssTsEnsure();
  });


  /* ── anti-spam + work-email handling (PRD-01 §§4-5, 24 Aug review) ──
     What a static page can enforce, it enforces here; per-IP limits need the
     server and belong to Studio's capture route (raised as the Studio-side
     half of this ticket — this browser-scoped limit is the client's
     contribution, not a substitute for it). */
  var FREE_EMAIL_PROVIDERS = ['gmail.com','googlemail.com','outlook.com','outlook.co.uk','hotmail.com',
    'hotmail.co.uk','yahoo.com','yahoo.co.uk','ymail.com','icloud.com','me.com','mac.com','proton.me',
    'protonmail.com','pm.me','aol.com','gmx.com','gmx.co.uk','gmx.de','live.com','live.co.uk','msn.com',
    'mail.com','mail.ru','yandex.com','yandex.ru','zoho.com','fastmail.com','hey.com','btinternet.com',
    'sky.com','talktalk.net','virginmedia.com','duck.com','tutanota.com','tuta.io'];
  /* Rate limits — the picked numbers (PRD-01 §5.2 says pick, name, record):
     one build per normalised address ever (a demo is a preview, not a toy to
     re-run), three builds per browser per day (enough to show a colleague,
     not enough to script against). Stored in localStorage, so a cleared
     browser resets them — the durable enforcement is Studio's. */
  var RATE_MAX_BUILDS_PER_ADDRESS = 1;
  var RATE_MAX_BUILDS_PER_DAY = 3;
  var RATE_STORE_KEY = 'sixty-demo-builds';
  /* §5.3 MX lookup: DNS-over-HTTPS against Google's resolver. Only the bare
     DOMAIN travels (never the address or the local part). Fails OPEN on
     network trouble — a resolver outage must not cost real conversions —
     and CLOSED on a definitive no-mail-server answer. */
  var MX_DOH_URL = 'https://dns.google/resolve';
  var MX_CHECK_TIMEOUT_MS = 2500;
  /* §7: below this, a derived name is never shown — company only */
  var NAME_CONFIDENCE_MIN = 0.6;
  var WORK_EMAIL_HELP = 'That looks like a personal address. A work email lets us build your demo around your company and its brand.';

  function emailDomain(v){
    v=(v||'').trim().toLowerCase();
    var at=v.indexOf('@');
    return at>0 ? v.slice(at+1) : '';
  }
  function isFreeProvider(domain){ return FREE_EMAIL_PROVIDERS.indexOf(domain)>-1; }
  /* §5.1 plus-address collapsing: zak+1@ and zak+2@ are one address for rate
     limiting, and gmail-style dot variants collapse too. */
  function normaliseEmail(v){
    v=(v||'').trim().toLowerCase();
    var at=v.indexOf('@');
    if(at<1) return v;
    var local=v.slice(0,at).split('+')[0], domain=v.slice(at+1);
    if(domain==='gmail.com'||domain==='googlemail.com') local=local.replace(/\./g,'');
    return local+'@'+domain;
  }
  /* the rate store keys addresses by a djb2 digest — not cryptographic,
     just enough that the address itself never lands in localStorage; see
     the file-header privacy note */
  function addrKey(normalised){
    var h=5381;
    for(var i=0;i<normalised.length;i++) h=((h*33)^normalised.charCodeAt(i))>>>0;
    return 'a'+h.toString(36);
  }
  function rateState(){
    var today=new Date().toISOString().slice(0,10), s=null;
    try{ s=JSON.parse(localStorage.getItem(RATE_STORE_KEY)); }catch(e){}
    if(!s || s.day!==today) s={day:today, count:0, addrs:{}};
    return s;
  }
  /* returns a clear message when over a limit, or null when clear to build —
     silence is exactly what §5's acceptance bars */
  function rateLimitMessage(normalised){
    var s=rateState();
    if((s.addrs[addrKey(normalised)]||0) >= RATE_MAX_BUILDS_PER_ADDRESS)
      return 'One preview per address is the limit. The real thing, pointed at your prospects, happens on a call.';
    if(s.count >= RATE_MAX_BUILDS_PER_DAY)
      return 'That is ' + RATE_MAX_BUILDS_PER_DAY + ' demos from this browser today, which is plenty to judge us by. Book a call for the real thing.';
    return null;
  }
  function recordBuild(normalised){
    var s=rateState(), k=addrKey(normalised);
    s.count++; s.addrs[k]=(s.addrs[k]||0)+1;
    try{ localStorage.setItem(RATE_STORE_KEY, JSON.stringify(s)); }catch(e){}
  }
  /* resolves true (has mail servers / could not check) or false (definitively
     none). Never rejects. */
  function mxCheck(domain){
    if(!window.fetch || !window.AbortController) return Promise.resolve(true);
    var ctrl=new AbortController();
    var t=setTimeout(function(){ ctrl.abort(); }, MX_CHECK_TIMEOUT_MS);
    return fetch(MX_DOH_URL+'?name='+encodeURIComponent(domain)+'&type=MX',
      {signal:ctrl.signal, headers:{accept:'application/dns-json'}})
      .then(function(r){ return r.json(); })
      .then(function(j){
        clearTimeout(t);
        if(j && j.Status===3) return false;                 // NXDOMAIN: no such domain
        if(j && j.Status===0) return !!(j.Answer && j.Answer.length); // NOERROR but no MX: no mail
        return true;                                        // resolver trouble: fail open
      })
      .catch(function(){ clearTimeout(t); return true; });
  }

  /* derive a first name + company from the email itself, ported from concept 5's
     parseEmail — previously the demo echoed the raw address back and ran four
     static build-step labels regardless of what was typed, which made the "live
     build" look staged rather than actually reading anything. Every value here
     only ever reaches the DOM via textContent (never innerHTML), so no HTML
     escaping is needed for safety — this is purely about deriving nicer text. */
  /* Conversion signal for paid traffic. Deliberately carries NO address and no derived name or
     company: the stage string is the entire payload, so nothing identifying leaves the page. Fires
     into whichever of fbq / dataLayer / a DOM event the host page happens to have wired, and is a
     no-op when none of them exist. */
  function fireConversion(stage){
    try{
      var detail={ event:'demo_build_started', stage:stage };
      if(window.fbq) window.fbq('trackCustom','DemoBuildStarted',{stage:stage});
      if(window.dataLayer && window.dataLayer.push) window.dataLayer.push(detail);
      document.dispatchEvent(new CustomEvent('sixty:demo-build',{detail:detail}));
    }catch(e){}
  }

  /* the live thumbnail beside the form. It reads the address as it is
     typed and shows the plate that would be built from it — the headline's
     promise, demonstrated instead of asserted. Purely local: parseEmail is
     the same derivation the build itself uses, and nothing here travels. */
  var dpName=document.getElementById('dpName'), dpCo=document.getElementById('dpCo'),
      dpPlate=document.querySelector('.demo-plate');
  function setPreview(name,company){
    if(!dpName||!dpCo) return;
    if(dpName.textContent===name && dpCo.textContent===company) return;
    if(dpPlate && !reduce){
      dpPlate.classList.add('swapping');
      setTimeout(function(){ dpPlate.classList.remove('swapping'); },200);
    }
    dpName.textContent=name; dpCo.textContent=company;
  }
  /* No live-typing preview. The 24 Aug room rejected the plate transforming
     as you type (PRD-01 §6): "maybe not live typing — keep it like that, and
     then when you build a video, it shows it piecing together." Nothing on
     the plate changes until Build is pressed; the whole transformation now
     lives in plateStages() below. */
  /* while the idle example is cycling, the caption must not claim the name
     on the plate is the reader's — it is Maya's, and they typed nothing */
  function setPlateCaption(isExample){
    var c=document.getElementById('demoPlateCap');
    if(!c || document.getElementById('demoPlate').classList.contains('playing')) return;
    c.innerHTML='';
    var lead=document.createElement('span');
    var b=document.createElement('b');
    if(isExample){ lead.textContent='Three real client builds, two invented \u00b7 '; b.textContent='five of the team, one recording each'; }
    else { lead.textContent='Yours \u00b7 '; b.textContent='press Build and we make it'; }
    c.appendChild(lead); c.appendChild(b);
  }

  /* press the disc, watch a real finished render. The plate proves the NAME
     is yours; this proves the OUTPUT is real — cold readers took the label
     swap on its own as evidence of a regex rather than a pipeline, and
     pointed out no video ever actually played anywhere on the page. */
  (function(){ var pl=document.getElementById('demoPlate'); if(pl) pl.classList.add('example'); })();
  setPlateCaption(true);
  /* THE SHOWREEL, as a 3D carousel rather than a baked reel.
     Andrew: the versions should swipe in, always from the same side, and the
     whole thing should be more interactive and clearer. So each brand is its
     own clip on a 3D stage: the next one flies in from the RIGHT with depth,
     the last one gives way to the left, and a tick per brand under the plate
     says how many there are, which is showing and how far through it is.

     Five blind cold readers then took it apart and the verdict was unanimous:
     the reel is the only real evidence on the page and the auto-rotate meant
     none of them ever looked at a single build. "It's on a timer, so I never
     actually looked at any of them." "Click a dot and it STAYS." "I'd never
     get to look at the one closest to my industry." So a click now HOLDS that
     brand and stops the rotation; clicking it again lets it run on. The reel
     still rotates for anyone who does nothing, which is what carries the
     proof, but it stops the moment someone wants to read.

     Advance is driven by the clip's own 'ended' event, not a timer, so the
     ticks can never drift out of sync with the picture, and pausing the video
     pauses everything by construction. */
  (function(){
    var plate=document.getElementById('demoPlate'),
        stage=document.getElementById('demoReel'),
        ticksEl=document.getElementById('demoReelTicks'),
        hint=document.getElementById('demoReelHint'),
        tag=plate?plate.querySelector('.demo-reeltag'):null;
    if(!plate||!stage||!ticksEl) return;
    var slides=[].slice.call(stage.querySelectorAll('.reel3d-slide')),
        ticks=[].slice.call(ticksEl.querySelectorAll('.reel-tick')),
        cur=0, visible=false, held=false, over=false, swiped=false, pinned=false, stopped=false,
        pending=false, picked=false, raf=0, parks={}, lightT=0, lastT=-1, lastAt=0;
    var reduce=window.SIXTY_REDUCE, fine=false;
    var TRAVEL=380, OUT_DELAY=45; /* must match the .reel3d-slide transition */
    var HINT_IDLE=hint?hint.innerHTML:'';
    /* Both of these were read once at load and never again, so toggling
       reduced motion with the page open left the CSS on its linear fade while
       the JS kept timing to the 3D curve — the mismatch of a previous round,
       restored by an OS setting. */
    function watchMQ(q, set){
      if(!window.matchMedia) return;
      var m=matchMedia(q); set(m.matches);
      if(m.addEventListener) m.addEventListener('change', function(e){ set(e.matches); render(); });
    }
    watchMQ('(prefers-reduced-motion: reduce)', function(v){ reduce=v; });
    var reel_unhover=null;
    watchMQ('(hover:hover) and (pointer:fine)', function(v){
      fine=v;
      if(!v && reel_unhover) reel_unhover();
    });

    function setFill(i,pct){ var bar=ticks[i].querySelector('i'); if(bar) bar.style.setProperty('--p',pct); }
    function play(v){ var p=v.play(); if(p&&p.catch) p.catch(function(){}); }
    /* Is the reel holding on this clip rather than rotating through it? A
       tick hold does that, and so does any pick under reduced motion, where
       there is no rotation to carry the reader on. Written out separately in
       three places until the watchdog was found carrying only half of it. */
    function holding(){ return pinned || (reduce && picked); }

    /* ONE function owns the chip, the hint and whether the clip is running.
       Every defect an adversarial reviewer found in this carousel was the same
       shape: something set one of the three without the other two. The chip
       claimed PLAYING over a clip that had stopped, then PAUSED over one that
       was running, because the 'ended' handler wrote the chip directly and the
       next recompute disagreed with it. Nothing writes the chip or the hint
       outside here, and nothing calls play() or pause() outside here either. */
    /* paint() only READS. render() decides, then paints. They are separate
       because the playing/pause listeners must re-paint the chip once the
       element settles, and calling the deciding half from a 'pause' event is a
       restart race: a clip reaching its end fires pause BEFORE ended, so
       render() saw `stopped` still false, called play() on a finished video,
       and the browser rewound it to zero. A held clip played itself twice.

       The chip reports the VIDEO, not the intention. Intention is four
       booleans; it does not know that iOS Low Power Mode refuses muted
       autoplay, and there the chip said Playing over a motionless poster with
       the fill pinned at 0% — the same lie in a new place. */
    function paint(){
      var v=slides[cur], hold = holding();
      /* SHOWREEL is the reel's name, but it was printed over a motionless
         poster as readily as over a running clip — the chip's third value
         hiding the same lie the other two had just been cured of. It only
         names the reel while the reel is actually running. */
      /* Three states, because there are three. Paused implies the reader
         stopped something and Showreel implies it is running; a reduced-motion
         reel at rest is neither — nothing was ever asked to run. */
      if(tag) tag.textContent = !v.paused ? (hold||held ? 'Playing' : 'Showreel')
        : (reduce && !hold && !held ? 'Stills' : 'Paused');
      if(!hint) return;
      if(hold) hint.innerHTML=(stopped?'Stopped on ':(v.paused?'Showing ':'Watching '))+
        '<b>brand '+(cur+1)+' of '+slides.length+'</b> &middot; '+
        (reduce ? 'pick another to watch that one' : 'pick it again to let the reel run on');
      else if(held) hint.innerHTML='Paused while you read it &middot; move away to carry on';
      else hint.innerHTML=HINT_IDLE;
    }
    function render(){
      /* Reduced motion means reduced motion, not no video. Nothing autoplays
         and nothing auto-advances, but a clip the reader has PICKED plays
         through: that is user-initiated, and it is the only way a
         reduced-motion reader ever sees the evidence the reel exists to carry.
         Before this the reel was a single still for them, under a hint
         inviting them to "watch it right through". */
      var v=slides[cur], want = visible && !held && !stopped && plate.classList.contains('example')
        && (!reduce || pinned || picked);
      if(want){ if(v.paused) play(v); } else if(!v.paused) v.pause();
      runFill(want);
      paint();
    }

    /* The reel advances on 'ended' and nothing else, so one 404, one stalled
       fetch or one browser that refuses muted autoplay (iOS Low Power Mode)
       stops it dead for good, with the hint still inviting the reader to watch
       it right through. If the clip we believe is running has not moved for
       three seconds, move on: a reel showing the next brand's still beats a
       reel showing one frame forever. */
    function frame(){
      raf=requestAnimationFrame(frame);
      var v=slides[cur], now=(window.performance&&performance.now)?performance.now():0;
      if(v.currentTime!==lastT){ lastT=v.currentTime; lastAt=now; }
      else if(now-lastAt>3000 && !held){
        lastAt=now;
        /* A clip the reader PICKED was exempt from this, so a 404 on it froze
           the reel for exactly the person who used the control, under a chip
           reading Paused as though they had done it. Their choice is not
           overridden — it stops honestly, and picking it again retries. */
        if(holding()){ v.pause(); stopped=true; render(); return; }
        go(cur+1,1); return;
      }
      if(!v.duration || !isFinite(v.duration)) return;
      /* don't fill a tick that has not lit yet, or the handoff shows the old
         tick complete and lit while the new one quietly fills underneath */
      if(!ticks[cur].classList.contains('is-on')) return;
      setFill(cur, Math.min(100, v.currentTime/v.duration*100).toFixed(1)+'%');
    }
    function runFill(on){
      if(raf){ cancelAnimationFrame(raf); raf=0; }
      if(on){ lastT=-1; lastAt=(window.performance&&performance.now)?performance.now():0; raf=requestAnimationFrame(frame); }
    }

    /* Park a card back on its rest position with the travel suppressed, so it
       does not fly backwards across the frame on the way. */
    function parkNow(v){
      if(v.classList.contains('is-on')) return;
      v.style.transition='none';
      v.classList.remove('is-out');
      void v.offsetWidth;
      v.style.transition='';
      v.pause();
      try{ v.currentTime=0; }catch(e){}
    }
    /* Each card parks itself when ITS OWN travel is done. An earlier version
       settled every pending park at the top of the next move instead, which
       teleported the card still on screen straight off to the right and left
       the bare stage showing behind the incoming one — a black void, worst on
       mobile, and it fired exactly when someone used the control the page tells
       them to use. Two cards on their way out at once is fine: both are dimmed,
       blurred and behind, and each leaves on its own schedule. */
    function schedulePark(i){
      clearTimeout(parks[i]);
      /* the outgoing card's real duration is its 45ms delay PLUS the travel;
         parking on TRAVEL+40 fired 5ms early and snapped it at 99% */
      parks[i]=setTimeout(function(){ parkNow(slides[i]); }, TRAVEL+OUT_DELAY+60);
    }

    function go(i,dir,byHand){
      i=(i+slides.length)%slides.length;
      var back=dir===-1, prev=slides[cur], prevIdx=cur, next=slides[i];
      clearTimeout(parks[i]);
      if(prev!==next){
        prev.style.setProperty('--to', back?'34%':'-34%');
        prev.style.setProperty('--to-rot', back?'-13deg':'13deg');
        prev.classList.remove('is-on');
        prev.classList.add('is-out');
        schedulePark(prevIdx);
      }
      cur=i;
      if(!byHand){ picked=false; swiped=false; }
      next.style.setProperty('--from', back?'-112%':'112%');
      next.style.setProperty('--from-rot', back?'19deg':'-19deg');
      next.style.transition='none';
      next.classList.remove('is-out');
      void next.offsetWidth;
      next.style.transition='';
      next.classList.add('is-on');
      try{ next.currentTime=0; }catch(e){}
      /* The tick lights when the picture has actually become that brand, not
         when the move starts. Lighting it instantly meant that for the whole
         380ms a reader saw the OLD brand filling the frame with the NEW tick
         lit, and two readers in two rounds concluded the bars did not match
         the content. A click still lights instantly: there the reader caused
         it and immediate feedback beats accuracy by a fifth of a second. */
      clearTimeout(lightT);
      function light(){
        ticks.forEach(function(t,n){
          t.classList.toggle('is-on', n===cur);
          if(n===cur) t.setAttribute('aria-current','true'); else t.removeAttribute('aria-current');
          setFill(n, '0%');
        });
      }
      /* Half the clock is not half the picture. cubic-bezier(.23,1,.32,1) is
         violently front-loaded: at 50% of the duration the card is already
         96.6% home, and it crosses the halfway point at 13.1% — 50ms of 380.
         Lighting at TRAVEL*0.5 did not remove the tick/picture mismatch, it
         inverted it: the OLD tick stayed lit over a picture that had already
         become the new brand. Solved the curve rather than guessing again. */
      if(byHand || prev===next) light();
      else lightT=setTimeout(light, reduce ? 100 : TRAVEL*0.131);
      /* Fetch two clips ahead in the direction of travel, never the whole set.
         EVERY slide carries a poster and must keep one. They were dropped once
         to save 60KB, on the reasoning that a poster is fetched eagerly even on
         preload="none" — true, and the wrong trade. Without them every path
         where a clip is not playing rendered an empty box, so "not playing"
         and "broken" became indistinguishable. */
      [1,2].forEach(function(n){
        var ahead=slides[(cur+(back?-n:n)+slides.length*2)%slides.length];
        if(ahead.preload!=='auto') ahead.preload='auto';
      });
      /* Holding plays the clip THROUGH once and stops on its last frame: it is
         'ended' that advances, and that is gated on holding(). Every slide keeps
         a poster, so a clip that is not playing still shows its own frame
         rather than an empty box, which is what any non-playing path rendered
         while the posters were dropped. */
      stopped=false; pending=false;
      render();
    }

    slides.forEach(function(v){
      /* play() is async and its rejection is swallowed, so the element is the
         only honest source of truth about whether anything is running */
      v.addEventListener('playing', function(){ if(v===slides[cur]) paint(); });
      v.addEventListener('pause', function(){ if(v===slides[cur]) paint(); });
      v.addEventListener('ended', function(){
        if(v!==slides[cur]) return;
        /* hover-hold was suspended for the swipe; the swiped clip has now had
           its run, so a pointer still resting on the plate holds again */
        if(swiped){ swiped=false; if(over && fine) held=true; }
        /* 25 Aug cold-reader round: a pinned 1.4s clip "ends" in a blink
           and froze on its last frame with a PAUSED chip — the founder
           persona clicked his own vertical and read the panel as broken.
           A held clip now LOOPS silently instead: the pick stays alive
           until the reader picks again or moves on. Reduced motion keeps
           the freeze (motion was the point of the complaint, not stillness
           — a still is what that reader asked for). */
        if(holding()){
          if(!reduce){ try{ v.currentTime=0; }catch(e){} var p=v.play(); if(p&&p.catch)p.catch(function(){}); setFill(cur,'0%'); render(); return; }
          stopped=true; setFill(cur,'100%'); render(); return;
        }
        /* A clip that ends in the same frame the pointer arrives used to set
           `stopped` with nothing able to clear it: the reel froze for good, on
           a chip still reading Showreel, with no affordance offered because
           the recovery text is gated on `pinned`. A hover defers the advance;
           it does not cancel it. */
        if(held){ pending=true; setFill(cur,'100%'); render(); return; }
        go(cur+1,1);
      });
    });

    /* A tick JUMPS to its brand and the reel carries on (Andrew, 27 Aug:
       "don't just get stuck on it — go to it and then carry on cycling").
       The picked clip plays through from its start, then 'ended' advances
       as normal. No pin: like the swipe, the click moves the reel rather
       than stopping it. Under reduced motion `picked` still holds, because
       there is no rotation to carry on to — that reader asked for stills. */
    ticks.forEach(function(t,i){
      t.addEventListener('click', function(){
        stopped=false; picked=true; pinned=false; held=false;
        if(i===cur){
          /* same tick: replay from the start rather than advancing off it */
          try{ slides[cur].currentTime=0; }catch(e){}
          render();
          return;
        }
        go(i, i<cur ? -1 : 1, true);
      });
    });

    /* Swipe. A phone reader said she would swipe before she would find the
       ticks, and she is right that a row of bars on a picture reads as a photo
       carousel. Dragging back animates back: same-side-every-time governs the
       automatic advance, not a gesture the reader just made. */
    (function(){
      var x0=null, y0=null;
      /* Without capture a fling that starts on the plate and releases outside
         it never delivers pointerup here and the gesture is silently lost —
         the other drag surface in this file already captures. */
      stage.addEventListener('pointerdown', function(e){
        x0=e.clientX; y0=e.clientY;
        if(stage.setPointerCapture) try{ stage.setPointerCapture(e.pointerId); }catch(err){}
      }, {passive:true});
      stage.addEventListener('pointerup', function(e){
        if(x0===null) return;
        var dx=e.clientX-x0, dy=e.clientY-y0;
        x0=null;
        var r=plate.getBoundingClientRect(), out = e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom,
            isSwipe = Math.abs(dx)>=40 && Math.abs(dx)>=Math.abs(dy);
        /* the gesture supersedes an advance deferred by the hover it started
           under: leave `pending` armed and the unwind below spends it, then the
           swipe spends its own, and one fling moves the reel two brands */
        if(isSwipe) pending=false;
        if(out && reel_unhover) reel_unhover();
        if(!isSwipe) return;
        /* A swipe MOVES the reel, it does not stop it. Pinning on swipe meant
           every phone reader who used the gesture this was built for silently
           killed the auto-advance — the thing that carries the proof — and was
           then told to "pick it again", pointing at a control they never
           touched. held is cleared because the pointer is still on the plate
           and the arriving card must actually play. */
        held=false; pinned=false; picked=true;
        go(cur+(dx<0?1:-1), dx<0?1:-1, true);
        swiped=true;
      }, {passive:true});
      stage.addEventListener('pointercancel', function(){ x0=null; }, {passive:true});
    })();

    /* Hover holds the reel where it is, so a reader who wants to read a frame
       can without committing to a click. Bound unconditionally and gated on
       `fine` at call time: binding inside `if(fine)` meant the matchMedia
       listener could flip `fine` true — plug in a mouse, dock a tablet — with
       no handlers there to honour it, so the listener updated a flag nothing
       could act on. */
    (function(){
      plate.addEventListener('pointerenter', function(){
        if(!fine || !plate.classList.contains('example')) return;
        over=true; swiped=false;
        /* Under reduced motion with nothing picked, nothing is running, so
           there is nothing to hold. Setting `held` anyway made the chip claim
           PAUSED over a still that had never played and promised it would
           carry on when the reader moved away, which it cannot: the Stills
           label was fixed and the sentence underneath it was not. */
        if(!(reduce && !holding())) held=true;
        render();
      });
      function unhover(){
        over=false; swiped=false; held=false;
        if(pending){ pending=false; go(cur+1,1); return; }
        render();
      }
      plate.addEventListener('pointerleave', unhover);
      reel_unhover=unhover;
    })();

    /* Typing an email swaps the plate out of showreel mode and hides the stage.
       Hidden is not paused: the clip kept decoding behind display:none. */
    if('MutationObserver' in window){
      new MutationObserver(function(){
        if(!plate.classList.contains('example')) slides.forEach(function(v){ v.pause(); });
        render();
      }).observe(plate,{attributes:true,attributeFilter:['class']});
    }

    /* Scrolling away pauses; scrolling back restores whatever the state says,
       including a pinned clip that was mid-play. It used to return early on
       pinned, leaving a stopped picture under a chip that still said Playing. */
    function enter(){ visible=true; render(); }
    function leave(){ visible=false; slides.forEach(function(v){ v.pause(); }); render(); }
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(es){
        es.forEach(function(en){ en.isIntersecting ? enter() : leave(); });
      },{threshold:.25}).observe(plate);
    } else enter();

    render();
  })();

  /* §7 name enrichment. The name comes from the address alone, with a
     confidence score; below NAME_CONFIDENCE_MIN the derivation is discarded
     and personalisation falls back to the company — a wrong name is worse
     than no name. The score rides on the parsed object for the build
     pipeline's use (the capture API has no field for it yet — flagged with
     the other Studio-side items); it is never printed at the visitor. */
  var GENERIC_LOCALS=['info','hello','hi','hey','admin','contact','contactus','sales','team','office',
    'support','enquiries','enquiry','inquiries','mail','email','hq','accounts','finance','marketing',
    'careers','jobs','press','media','help','reception','bookings','orders','billing','noreply',
    'no-reply','newsletter','partnerships','general','webmaster','postmaster'];
  /* a compact common-first-names list buys precision on bare `first@` locals:
     andrew@ personalises, abryce@ (an flast pattern this cannot split safely)
     falls back to the company rather than greeting "Abryce" */
  var COMMON_FIRST_NAMES=['aaron','adam','adrian','aisha','alan','alex','alexandra','alice','amanda','amy',
    'andrea','andrew','andy','anna','anne','anthony','ben','benjamin','beth','brian','callum','cameron',
    'carl','carol','caroline','catherine','charlie','charlotte','chris','christian','christine','claire',
    'colin','craig','dan','daniel','danielle','dave','david','dawn','dean','debbie','deborah','dennis',
    'diana','dominic','donna','duncan','ed','edward','elena','elizabeth','ella','emily','emma','erin',
    'ethan','fiona','frank','fred','gareth','gary','gavin','gemma','george','georgia','gillian','grace',
    'graham','grant','greg','hannah','harry','heather','helen','henry','holly','howard','ian','jack',
    'jacob','jake','james','jamie','jane','janet','jason','jay','jean','jenny','jennifer','jessica',
    'jim','jo','joanna','joanne','joe','joel','john','jon','jonathan','jordan','joseph','josh','joshua',
    'julia','julian','julie','karen','kate','katherine','katie','keith','kelly','kevin','kim','kirsty',
    'laura','lauren','lee','leo','lewis','liam','linda','lisa','louise','lucy','luke','lydia','maria',
    'mark','martin','mary','matt','matthew','max','maya','megan','melissa','michael','michelle','mike',
    'molly','naomi','natalie','nathan','neil','niall','nick','nicola','nicole','nigel','noah','oliver',
    'olivia','oscar','owen','patrick','paul','paula','pete','peter','phil','philip','priya','rachel',
    'raph','raphael','rebecca','richard','rob','robert','robin','rory','rosie','ross','ruth','ryan',
    'sally','sam','samantha','samuel','sara','sarah','scott','sean','sharon','simon','sophie','stephen',
    'steve','steven','stuart','susan','tanya','ted','theo','thomas','tim','timothy','toby','tom','tony',
    'tracey','vicky','victoria','will','william','zak','zoe'];
  function cap(w){ return w.replace(/^\w/,function(c){ return c.toUpperCase(); }); }
  function deriveName(local){
    local=(local||'').toLowerCase().replace(/[^a-z._-]/g,'');
    if(!local || GENERIC_LOCALS.indexOf(local)>-1) return {name:null, confidence:0};
    var toks=local.split(/[._-]+/).filter(Boolean);
    if(toks.length>=2){
      var a=toks[0], b=toks[toks.length-1];
      if(a.length>=2 && b.length>=2) return {name:cap(a)+' '+cap(b), confidence:.9}; // first.last
      if(a.length===1 && b.length>=2) return {name:a.toUpperCase()+' '+cap(b), confidence:.7}; // a.bryce
      if(a.length>=2 && b.length===1) return {name:cap(a)+' '+b.toUpperCase(), confidence:.7}; // andrew.b
      return {name:null, confidence:.2};
    }
    var w=toks[0]||'';
    if(COMMON_FIRST_NAMES.indexOf(w)>-1) return {name:cap(w), confidence:.75}; // first@
    return {name:null, confidence:.3}; // flast / firstl — unsplittable, never guess
  }
  /* the one line personalisation prints: name + company when the name earned
     its confidence, the company alone when it did not */
  /* Andrew, 27 Aug: the public demo personalises on the COMPANY, never the
     individual — anyone can type any local-part (he typed an obviously fake
     name and the page claimed it built for that person), and a company-level
     demo works for anyone from that company. The name derivation above stays
     for the enrichment pipeline; it is no longer shown on this page. The free
     lane has no company, so it stays name-or-you. */
  function personLabel(p){ return p.free ? (p.name || 'you') : p.company; }
  function parseEmail(v){
    v=(v||'').trim();
    var at=v.indexOf('@');
    if(!v || at<1) return {name:null, company:'your company', domain:'your work email', confidence:0, free:false};
    var fullDomain=v.slice(at+1).toLowerCase();
    var derived=deriveName(v.slice(0,at));
    var name=derived.confidence>=NAME_CONFIDENCE_MIN ? derived.name : null;
    var domPart=v.slice(at+1).split('.')[0]||'your company';
    /* A run-together domain stem rendered as one word ("Trefoilsearch") is a personalisation tell
       on a page whose whole promise is show-me-you-know-me, so split the trade words back out.
       camelCase splits first; a trailing trade word is only peeled off when a 3+ character stem
       survives, so "search.com" stays "Search" rather than becoming an empty string. */
    var TRADE_WORDS=['recruitment','recruiting','recruiters','consultancy','consulting','properties','logistics','insurance','financial','marketing','solutions','mortgage','advisory','ventures','partners','security','software','staffing','advisors','property','finance','talent','capital','search','studios','systems','digital','agency','events','health','realty','recruit','group','legal','media','works','studio','labs'];
    function splitTrade(w){
      var lower=w.toLowerCase();
      for(var i=0;i<TRADE_WORDS.length;i++){
        var t=TRADE_WORDS[i];
        if(lower.length>t.length+2 && lower.slice(-t.length)===t){
          return [w.slice(0,w.length-t.length), w.slice(w.length-t.length)];
        }
      }
      return [w];
    }
    var company=domPart.split(/[-_]+/).filter(Boolean)
      .reduce(function(a,w){ return a.concat(w.replace(/([a-z0-9])([A-Z])/g,'$1 $2').split(' ')); },[])
      .reduce(function(a,w){ return a.concat(splitTrade(w)); },[])
      .filter(Boolean)
      .map(function(w){return w.replace(/^\w/,function(c){return c.toUpperCase();});}).join(' ') || 'Your company';
    /* Brand-TLD domains ARE the brand name (final sim round, 28 Aug: a
       frame.io reader saw "SCRIPT FOR FRAME" and read it as the engine
       getting their name wrong). For the TLDs companies wear as part of the
       name, keep it: frame.io → Frame.io, not Frame. Only when the stem is
       a single word — "Acme Labs.io" would be worse than "Acme Labs". */
    var BRAND_TLDS=['io','ai','app','dev','so','gg','tv','fm','sh'];
    var tld=fullDomain.split('.').slice(1).join('.');
    if(BRAND_TLDS.indexOf(tld)>-1 && company.indexOf(' ')===-1 && company!=='Your company')
      company=company+'.'+tld;
    var free=isFreeProvider(fullDomain);
    /* "Zak at Gmail" is not a company — a consumer domain yields no company */
    if(free) company='your company';
    return {name:name, company:company, domain:fullDomain, confidence:derived.confidence, free:free};
  }
  function buildSteps(p){
    /* A consumer address has no company site to read and no brand to pull,
       and the funnel sim caught the console claiming both anyway ("Reading
       gmail.com…", a script "for your company"). On the free lane the
       narration only claims what the flow is actually doing: a sample. */
    if(p.free) return [
      {label:"Preparing a sample preview…", node:0},
      {label:"Writing a sample script…", node:1}, /* the artefact is the sample — never narrate it as theirs */
      {label:"Selecting the presenter clone, already recorded…", node:2},
      {label:"Compositing motion graphics, voiceover, music & SFX…", node:3}
    ];
    return [
      {label:"Reading "+p.domain+"…", node:0},
      {label:"Writing a script for "+personLabel(p)+"…", node:1},
      {label:"Selecting the presenter clone, already recorded…", node:2},
      {label:"Compositing motion graphics, voiceover, music & SFX for "+p.company+"…", node:3}
    ];
  }
  var SVG_NS='http://www.w3.org/2000/svg';
  function tickIcon(){
    var svg=document.createElementNS(SVG_NS,'svg');
    svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('width','16'); svg.setAttribute('height','16');
    svg.setAttribute('fill','none'); svg.setAttribute('stroke','rgb(120,236,194)');
    svg.setAttribute('stroke-width','3'); svg.setAttribute('stroke-linecap','round'); svg.setAttribute('stroke-linejoin','round');
    var path=document.createElementNS(SVG_NS,'path'); path.setAttribute('d','M20 6 9 17l-5-5');
    svg.appendChild(path);
    return svg;
  }
  /* shared console-line builder — extracted so the real-build status lines below render with the
     exact same tick+fade treatment as the simulated steps, instead of a second, drifting copy. */
  /* pending:true renders a hollow dot instead of a green tick — a step that
     has not succeeded yet must not look succeeded (round-2 adversary: the
     tick on "Contacting the live build engine" next to "engine was not
     reachable" was the one assertion the page still retracted). The returned
     line carries resolveLine(ok, newText) to settle it either way. */
  function appendConsoleLine(text, pending){
    var line=document.createElement('div');
    line.style.cssText='display:flex;align-items:center;gap:11px;font-size:14px;color:rgb(var(--body));opacity:0;transform:translateY(6px);transition:opacity .4s var(--ease),transform .4s var(--ease)';
    var tick=document.createElement('span');
    var label=document.createElement('span');
    function paint(state){
      while(tick.firstChild) tick.removeChild(tick.firstChild);
      if(state==='pending'){
        tick.style.cssText='width:16px;height:16px;border-radius:50%;flex-shrink:0;background:transparent;border:1.5px solid rgb(255 255 255/.35)';
      }else if(state==='fail'){
        tick.style.cssText='width:16px;height:16px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgb(var(--amber)/.16);border:1px solid rgb(var(--amber-br)/.6);color:rgb(var(--amber-br));font-size:11px;font-weight:800';
        tick.textContent='!';
      }else{
        tick.style.cssText='width:16px;height:16px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgba(52,211,153,.16);border:1px solid rgba(52,211,153,.5)';
        tick.appendChild(tickIcon());
      }
    }
    paint(pending ? 'pending' : 'ok');
    label.textContent=text;
    line.appendChild(tick); line.appendChild(label);
    line.resolveLine=function(ok, newText){
      paint(ok ? 'ok' : 'fail');
      if(newText) label.textContent=newText;
    };
    consoleLines.appendChild(line);
    /* the working ticker line always sits LAST (Andrew, 28 Aug: a tick
       landing after the pending line read as tick, un-ticked, tick) */
    if(typeof tickerLine!=='undefined' && tickerLine && tickerLine!==line && tickerLine.parentNode===consoleLines)
      consoleLines.appendChild(tickerLine);
    requestAnimationFrame(function(){ line.style.opacity=1; line.style.transform='none'; });
    trimConsole();
    return line;
  }
  /* Rolling window (Andrew, 28 Aug: "all of the steps here are just too much
     — keep all of those steps but only show like 4 at a time, the one it is
     working through bigger"). The newest line reads larger and full-bright,
     older visible lines recede, and anything beyond the window collapses
     into one counter line at the top. Every step still happens and is still
     announced; the page just never becomes a wall of ticks. */
  var CONSOLE_WINDOW=4;
  function trimConsole(){
    var kids=[].slice.call(consoleLines.children).filter(function(k){ return k.id!=='consoleDoneSummary'; });
    kids.forEach(function(k,i){
      var newest = i===kids.length-1;
      k.style.fontSize = newest ? '15.5px' : '13.5px';
      k.style.opacity = newest ? '1' : '.72';
    });
    var extra=kids.length-CONSOLE_WINDOW;
    if(extra>0){
      var sum=document.getElementById('consoleDoneSummary');
      if(!sum){
        sum=document.createElement('div');
        sum.id='consoleDoneSummary';
        sum.style.cssText='font-size:12px;font-weight:600;color:rgb(var(--muted));margin-bottom:2px';
        consoleLines.insertBefore(sum, consoleLines.firstChild);
      }
      for(var i=0,removed=0;i<kids.length && removed<extra;i++){
        if(kids[i].id==='consoleTicker') continue;
        if(kids[i].parentNode){ kids[i].parentNode.removeChild(kids[i]); removed++; }
      }
      sum.__n=(sum.__n||0)+extra;
      sum.textContent='✓ '+sum.__n+' earlier step'+(sum.__n===1?'':'s')+' done';
    }
  }

  /* the plate carries the build. It is the element the reader has been
     watching and the one their typing already changed, so it is where the
     consequence of pressing the button belongs — not only in a console
     further down the page. */
  function plateBuild(pct, stage){
    var plate=document.getElementById('demoPlate'), prog=document.getElementById('demoPlateProg'),
        st=document.getElementById('demoPlateStage');
    if(!plate) return;
    if(pct===null){
      plate.classList.remove('building');
      if(!plate.classList.contains('playing')) setPlateCaption(!(document.getElementById('dEmail').value||'').trim());
      return;
    }
    plate.classList.add('building');
    if(prog) prog.style.width=Math.max(0,Math.min(100,pct))+'%';
    if(st && stage) st.textContent=stage;
    /* while a build runs the caption must not invite a competing action */
    var c=document.getElementById('demoPlateCap');
    if(c) c.textContent='Building yours now';
  }
  /* ── the staged build on the plate (PRD-01 §6) ─────────────────────
     Three real states after the click, in the order the room asked for:
     1 their name (or company, per the §7 confidence fallback) lands on the
       thumbnail · 2 a script card assembles for them · 3 their brand colours
     come in (a tint derived from the domain — a stand-in until the real
     brand fetch, but a genuine state change, not a caption swap).
     Returns a cancel function; done() fires once stage 3 has had its beat. */
  var STAGE_NAME_MS=1000, STAGE_SCRIPT_MS=1300, STAGE_BRAND_MS=1300;
  /* ── the real brand scrape (Andrew, 27 Aug): the FIRST view after Build is
     their branding, genuinely pulled — the logo fetched live from a public
     logo endpoint (domain only, never the address; CORS-served so the
     pixels are readable) and the dominant colours read out of it on a
     canvas. Resolves {logoUrl, tint, swatches[]} or null; never rejects, and
     BRAND_FETCH_TIMEOUT_MS caps how long stage 1 will wait for it. */
  var BRAND_FETCH_TIMEOUT_MS=2600;
  /* logo sources in preference order. Clearbit's logo endpoint is DEAD
     (sunset post-HubSpot; verified erroring 27 Aug) — icon.horse and
     unavatar.io both serve the real favicon/logo WITH CORS headers, so the
     pixels are canvas-readable for the colour pull. Tried in order. */
  var BRAND_LOGO_SOURCES=[
    function(d){ return 'https://icon.horse/icon/'+encodeURIComponent(d); },
    function(d){ return 'https://unavatar.io/'+encodeURIComponent(d); }
  ];
  function fetchBrand(domain, srcIdx){
    srcIdx=srcIdx||0;
    if(srcIdx>=BRAND_LOGO_SOURCES.length) return Promise.resolve(null);
    return new Promise(function(resolve){
      var settled=false;
      function finish(v){ if(!settled){ settled=true; resolve(v); } }
      setTimeout(function(){ finish(null); }, BRAND_FETCH_TIMEOUT_MS);
      try{
        var img=new Image();
        img.crossOrigin='anonymous';
        img.onload=function(){
          try{
            var N=24, cv=document.createElement('canvas');
            cv.width=N; cv.height=N;
            var cx=cv.getContext('2d');
            cx.drawImage(img,0,0,N,N);
            var d=cx.getImageData(0,0,N,N).data, buckets={};
            for(var i=0;i<d.length;i+=4){
              var r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];
              if(a<200) continue;
              var mx=Math.max(r,g,b), mn=Math.min(r,g,b);
              if(mx>235 && mn>225) continue;             /* near-white */
              if(mx<28) continue;                        /* near-black */
              var k=(r>>5)+'-'+(g>>5)+'-'+(b>>5);        /* 3-bit buckets */
              (buckets[k]=buckets[k]||{n:0,r:0,g:0,b:0});
              buckets[k].n++; buckets[k].r+=r; buckets[k].g+=g; buckets[k].b+=b;
            }
            /* Saturation-first pick (Andrew's railway.com run: a mostly
               white-on-dark logo made the count-winner a murky neutral while
               the actual brand colour was the small saturated region). A
               bucket that is genuinely COLOURED outranks a bigger grey one;
               plain count only decides among the coloured, or when nothing
               is coloured at all. */
            var all=Object.keys(buckets).map(function(k){
              var v=buckets[k], rr=v.r/v.n, gg=v.g/v.n, bb=v.b/v.n;
              var mx=Math.max(rr,gg,bb), mn=Math.min(rr,gg,bb);
              return {n:v.n, r:rr, g:gg, b:bb, sat: mx===0?0:(mx-mn)/mx};
            });
            var coloured=all.filter(function(v){ return v.sat>=0.25 && v.n>=2; });
            var pool=(coloured.length?coloured:all).sort(function(a,b){return b.n-a.n;});
            var top=pool.slice(0,3)
              .map(function(v){return Math.round(v.r)+' '+Math.round(v.g)+' '+Math.round(v.b);});
            /* A blank/near-white image with no extractable colour is a
               placeholder, not a logo (Andrew's cloudcustom run: an empty
               white box where the brand should be). Treat it as a miss and
               try the next source rather than showing a blank. */
            if(!top.length){ if(!settled){ settled=true; resolve(fetchBrand(domain, srcIdx+1)); } return; }
            finish({logoUrl:img.src, tint:top[0], swatches:top});
          }catch(e){ finish({logoUrl:img.src, tint:null, swatches:[]}); } /* tainted canvas: logo yes, colours no */
        };
        img.onerror=function(){
          if(settled) return;
          settled=true;
          resolve(fetchBrand(domain, srcIdx+1)); /* next source */
        };
        img.src=BRAND_LOGO_SOURCES[srcIdx](domain);
      }catch(e){ finish(null); }
    });
  }
  function brandTint(domain){
    var h=0; domain=domain||'';
    for(var i=0;i<domain.length;i++) h=(h*31+domain.charCodeAt(i))>>>0;
    var hue=h%360, c=0.55, x=c*(1-Math.abs((hue/60)%2-1)), m=0.32, r,g,b;
    if(hue<60){r=c;g=x;b=0}else if(hue<120){r=x;g=c;b=0}else if(hue<180){r=0;g=c;b=x}
    else if(hue<240){r=0;g=x;b=c}else if(hue<300){r=x;g=0;b=c}else{r=c;g=0;b=x}
    return Math.round((r+m)*255)+' '+Math.round((g+m)*255)+' '+Math.round((b+m)*255);
  }
  /* Reworked 27 Aug on Andrew's two calls: (1) the reel NEVER leaves — "the
     showreel should just stay the same as it was, with the videos rotating
     round" — so the plate keeps .example and every stage lands on top of the
     playing clips as a card; (2) the FIRST view after Build is their branding,
     genuinely scraped (fetchBrand above), because a first view with no
     branding applied turns them off. Order: brand → name → script. */
  function plateStages(parsed, done){
    var plate=document.getElementById('demoPlate');
    if(!plate){ done(); return function(){}; }
    var T = reduce ? 0.12 : 1, timers=[];
    var who = parsed.name || parsed.company;
    plate.classList.remove('st-script','st-brand','st-brandcard','st-id');
    plate.removeAttribute('aria-disabled');
    plate.setAttribute('aria-label','Your video being assembled for '+personLabel(parsed));
    var brandP = parsed.free ? Promise.resolve(null) : fetchBrand(parsed.domain);
    /* stage 1 · the brand scrape. The caption only claims a brand once the
       scrape has actually returned one; a failed scrape falls back to the
       honest domain-hash tint with a claim-free caption. */
    plateBuild(12, parsed.free ? 'Setting up your preview' : 'Reading '+parsed.domain+'…');
    brandP.then(function(brand){
      var brandGot=!!(brand && brand.logoUrl);
      lastBrand = brandGot ? brand : null; /* the wait overlay themes itself with this */
      if(!parsed.free){
        var logo=document.getElementById('ptBrandLogo'), dom=document.getElementById('ptBrandDom'),
            lm=document.getElementById('ptBrandLm'),
            sws=[document.getElementById('ptSw1'),document.getElementById('ptSw2'),document.getElementById('ptSw3')];
        if(dom) dom.textContent=parsed.domain;
        if(brand && brand.logoUrl){
          if(logo){ logo.src=brand.logoUrl; logo.hidden=false; }
          if(lm) lm.hidden=true;
          brand.swatches.forEach(function(c,i){ if(sws[i]) sws[i].style.background='rgb('+c.split(' ').join(',')+')'; });
          plate.style.setProperty('--pt', brand.tint || brandTint(parsed.domain));
          plateBuild(24, 'Pulling your brand from '+parsed.domain);
        }else{
          /* no logo scraped — the card still carries the brand (Andrew,
             28 Aug: "branding has to be there"): a lettermark on the derived
             tint, three shades of it as swatches, the domain named. The
             caption stays claim-free: this tint is derived, not scraped. */
          var t=brandTint(parsed.domain);
          plate.style.setProperty('--pt', t);
          if(logo) logo.hidden=true;
          if(lm){ lm.textContent=(parsed.company||'?').charAt(0).toUpperCase(); lm.hidden=false; }
          var parts=t.split(' ').map(Number);
          [1,.72,.45].forEach(function(f,i){
            if(sws[i]) sws[i].style.background='rgb('+parts.map(function(v){return Math.round(v*f);}).join(',')+')';
          });
          plateBuild(24, 'Styling your page for '+parsed.company);
        }
        plate.classList.add('st-brandcard');
      }
      timers.push(setTimeout(function(){
        /* stage 2 · the company lands on the thumbnail. COMPANY, never the
           typed name (Andrew, 27 Aug) — see personLabel below. */
        var idN=document.getElementById('ptIdName'), idC=document.getElementById('ptIdCo');
        if(idN) idN.textContent=personLabel(parsed);
        if(idC) idC.textContent='';
        plate.classList.add('st-id');
        plateBuild(44, parsed.free ? 'Preparing your preview' : 'Placing your company on the thumbnail');
        timers.push(setTimeout(function(){
          /* stage 3 · the script card assembles. On the company lane REAL
             WORDS stream in, character by character — grey skeleton bars
             were read by a blind tester as "the universal symbol of fake
             loading". The line claims only what is true of the product. */
          var f=document.getElementById('ptScriptFor'), st=document.getElementById('ptScriptText');
          if(f) f.textContent = parsed.free ? 'Sample script' : 'Script for '+parsed.company;
          plate.classList.add('st-script');
          if(!parsed.free && st){
            plate.classList.add('st-scripttext');
            /* when the scrape genuinely returned their brand, the script says
               so — the one claim in this card the visitor can verify against
               the swatches sitting two cards away (round-2 reader: "one true
               thing about my business and I'd be sold") */
            /* Second person all the way through (Andrew, 28 Aug: the tone
               read wrong — it IS their website, speak to them): no
               third-person "this one is for X" pivoting into "your". */
            var line=brandGot
              ? parsed.company+', this one is for you. Sixty seconds, on a page in your brand colours, presented by a clone of our founder.'
              : parsed.company+', this one is for you. Sixty seconds, on a page of your own, presented by a clone of our founder.';
            st.textContent='';
            if(reduce){ st.textContent=line; }
            else {
              var ci=0, tick=setInterval(function(){
                ci+=2; st.textContent=line.slice(0,ci);
                if(ci>=line.length) clearInterval(tick);
              }, 28);
              timers.push({__iv:tick});
            }
          }
          plateBuild(70, parsed.free ? 'Writing a sample script' : 'Writing your script');
          timers.push(setTimeout(done, STAGE_SCRIPT_MS*T));
        }, STAGE_NAME_MS*T));
      }, STAGE_BRAND_MS*T));
    });
    return function(){ timers.forEach(function(t){ t && t.__iv ? clearInterval(t.__iv) : clearTimeout(t); }); };
  }

  /* ── the work-email hint (PRD-01 §4): after blur or on submit, never on a
     keystroke, and worded as help */
  var hintEl=document.getElementById('dEmailHint');
  function showEmailHint(msg, withEscape){
    if(!hintEl) return;
    hintEl.textContent=msg; hintEl.hidden=false;
    if(withEscape){
      /* the launch reader hit a dead end here: an MX fail (or rate limit)
         ended the journey with no road out. The escape is a STATIC anchor
         appended after the text — the message stays textContent, so the
         interpolated domain never reaches innerHTML. */
      var a=document.createElement('a');
      a.href='https://savvycal.com/sixtyseconds/U065T5J2M61';
      a.target='_blank'; a.rel='noopener noreferrer';
      a.textContent='Or skip the demo and book a call.';
      a.style.cssText='margin-left:6px;color:inherit;font-weight:600;text-decoration:underline';
      hintEl.appendChild(document.createTextNode(' '));
      hintEl.appendChild(a);
    }
  }
  function clearEmailHint(){ if(hintEl){ hintEl.hidden=true; hintEl.textContent=''; } }
  emailIn.addEventListener('blur', function(){
    if(isFreeProvider(emailDomain(emailIn.value))) showEmailHint(WORK_EMAIL_HELP);
  });
  emailIn.addEventListener('input', clearEmailHint);

  var building=false, staging=false, realJobId=null;
  /* keepPlate: the sim fallback (and the free lane) runs AFTER plateStages
     has already put the visitor's cards on the reel. Round-2 blind capture
     caught the full reset stripping them mid-replay — the foreign brands'
     names came back sharp over a "Frame" build, the exact identity collision
     round one condemned. The fallback keeps the plate; only a brand-new
     submit clears it. */
  function resetDemo(keepPlate){
    plateBuild(null);
    var pl=document.getElementById('demoPlate');
    if(pl && !keepPlate){
      pl.classList.remove('st-script','st-brand','st-brandcard','st-id','st-scripttext','built');
      var bl=document.getElementById('ptBrandLogo');
      if(bl){ bl.hidden=true; bl.removeAttribute('src'); }
      var blm=document.getElementById('ptBrandLm');
      if(blm){ blm.hidden=true; blm.textContent=''; }
      var stx=document.getElementById('ptScriptText');
      if(stx) stx.textContent='';
    }
    if(waitTick){ clearInterval(waitTick); waitTick=null; }
    if(typeof closeRealStream==='function') closeRealStream();
    var wl=document.getElementById('realWaitLogo');
    if(wl && wl.parentNode) wl.parentNode.removeChild(wl);
    if(resultRealLoading) resultRealLoading.style.backgroundImage='';
    var plateProg=document.getElementById('demoPlateProg');
    if(plateProg) plateProg.style.width='0%';
    while(consoleLines.firstChild) consoleLines.removeChild(consoleLines.firstChild);
    progressFill.style.width='0%';
    consoleEl.style.display='none';
    resultShell.style.display='none';
    if(consoleModeNote){ consoleModeNote.style.display='none'; consoleModeNote.textContent=''; }
    if(resultCanned) resultCanned.style.display='';
    if(resultRealWrap) resultRealWrap.style.display='none';
    if(resultRealFrame){ resultRealFrame.style.opacity='0'; resultRealFrame.src='about:blank'; }
    if(resultRealLoading) resultRealLoading.style.display='flex';
    if(resultRealOpenLink){ resultRealOpenLink.style.fontWeight=''; resultRealOpenLink.style.color=''; resultRealOpenLink.hidden=true; }
    realJobId=null;
    document.querySelectorAll('.node .ndot').forEach(function(n){
      n.style.background=''; n.style.borderColor=''; n.style.boxShadow=''; n.style.transform='';
    });
    document.querySelectorAll('.node span').forEach(function(s){ s.style.color=''; });
    document.querySelectorAll('.nline i').forEach(function(i){ i.style.width='0%'; });
  }
  function litNode(i){
    var node=document.querySelector('.node[data-n="'+i+'"]');
    if(node){
      var dot=node.querySelector('.ndot');
      dot.style.background='rgb(120,236,194)';
      dot.style.borderColor='rgb(120,236,194)';
      dot.style.boxShadow='0 0 0 6px rgba(52,211,153,.15),0 0 24px rgba(52,211,153,.85)';
      dot.style.transform='scale(1.15)';
      node.querySelector('span').style.color='rgb(120,236,234)';
    }
    var line=document.querySelector('.nline[data-l="'+i+'"] i');
    if(line) line.style.width='100%';
  }

  /* ---------- simulated build (unchanged sequence/timing) — the automatic fallback whenever the
     real call above can't be reached or fails. opts.simulationLabel marks the console accordingly;
     a direct blank/invalid-email submit still runs this unlabelled, exactly as before this change. */
  function runBuild(email, opts){
    if(building) return;
    building=true;
    resetDemo(opts && opts.keepPlate);
    buildBtn.disabled=true; buildBtn.textContent='Building…'; buildBtn.classList.remove('ghost');
    var nodeRow=document.getElementById('nodeRow');
    if(nodeRow) nodeRow.style.display='flex';
    consoleEl.style.display='block';
    if(consoleModeNote && opts && opts.simulationLabel){
      consoleModeNote.textContent='Replay of a real build. The live engine was not reachable just now';
      consoleModeNote.style.color='rgb(var(--amber-br))';
      consoleModeNote.style.fontSize='12.5px';
      consoleModeNote.style.display='block';
    }
    var t0=performance.now();
    var T = reduce ? 0.1 : 1;
    var parsed=parseEmail(email);
    var steps=buildSteps(parsed);
    steps.forEach(function(step,i){
      setTimeout(function(){
        appendConsoleLine(step.label);
        var pct=Math.round(((i+1)/steps.length)*100);
        progressFill.style.width=pct+'%';
        /* the plate's caption belongs to plateStages() (PRD-01 \u00a76) \u2014 the
           console narrates, the plate assembles; only the % is shared */
        plateBuild(pct);
        litNode(step.node);
        if(i===steps.length-1){
          setTimeout(function(){
            /* This branch plays a pre-rendered sample, so a stopwatch reading here invented a
               build time ~60-100x faster than the real engine's own stated 5-10 minutes, and set
               that expectation for every visitor who ever hits the fallback. Label, don't time. */
            /* Cold-reader sims, 21 Aug: this line used to read "built live for
               <you> at <your company>" over a video that is visibly Priya's,
               branded Northbank — the identical wording the genuinely-live
               path uses below. On a page whose whole argument is "this is
               really about you, not a template", being caught out on exactly
               that claim is the worst place to be loose. The fallback now
               names who the sample was actually built for. */
            /* the Deliver node lights while nothing is delivered anywhere,
               and a funnel tester reasonably waited for an email — close
               the gap in words before revealing the result */
            appendConsoleLine('Preview ready below. Nothing is sent to your inbox.');
            plateBuild(null);
            /* the visitor's cards stay on the plate: their input persisted */
            var pl=document.getElementById('demoPlate');
            if(pl) pl.classList.add('built');
            resultFor.textContent='Priya at Northbank, who is invented';
            resultForLabel.textContent='a finished render, built for ';
            resultTime.textContent='Sample, not yours';
            resultShell.style.display='block';
            resultShell.style.opacity=0; resultShell.style.transform='translateY(20px)';
            resultShell.style.transition='opacity .6s var(--ease),transform .6s var(--ease)';
            requestAnimationFrame(function(){
              requestAnimationFrame(function(){ resultShell.style.opacity=1; resultShell.style.transform='none'; });
            });
            buildBtn.disabled=false; buildBtn.textContent='Try another address'; buildBtn.classList.add('ghost');
            building=false;
            resultShell.scrollIntoView({behavior: reduce?'auto':'smooth', block:'nearest'});
          }, 450*T);
        }
      }, i*620*T);
    });
  }

  /* ---------- real build: calls Studio's live API, falls back to runBuild() on any failure ----------
     Reveals the real, live /demo/{jobId} page inline (iframe) once a real job exists — see the file
     header above for exactly why an iframe rather than streaming events into the node row above. */
  /* ── run persistence (Andrew, 27 Aug): he pressed Back off the page and
     his live run was gone. A real run now survives navigation for the
     session: jobId + the company label in sessionStorage (no address, no
     name — consistent with the privacy claim in the file header), restored
     by restoreRun() on load. */
  var RUN_KEY='demoRun', RUN_TTL_MS=60*60*1000;
  /* Only embed the live /demo/{id} page where Studio's frame-ancestors will
     actually allow it — anywhere else the refused frame renders as a grey
     broken-document slab under a "Genuinely live" badge (a blind reader
     called it "the product failing its own demo"). Off the allowed origins
     the direct link carries the result instead. */
  var EMBED_OK=/(^|\.)sixtyseconds\.ai$|(^|\.)sixtysecondsapp\.github\.io$/.test(location.hostname);
  /* the wait heartbeat: honest duration + elapsed ticker + a 25s escape to
     the direct link. Cleared the moment the frame loads or the demo resets. */
  var waitTick=null, lastBrand=null;
  function armWaitFeedback(jobUrl){
    var main=document.getElementById('realWaitMain'), sub=document.getElementById('realWaitSub');
    if(waitTick) clearInterval(waitTick);
    if(!main||!sub) return;
    /* the wait itself is branded to them (Andrew, 27 Aug: nothing unbranded
       is the first thing they see): the scraped tint washes the overlay and
       the scraped logo sits above the dots. All from fetchBrand — nothing
       new leaves the page. */
    var tint=document.getElementById('demoPlate') && document.getElementById('demoPlate').style.getPropertyValue('--pt');
    if(tint && resultRealLoading)
      resultRealLoading.style.backgroundImage='radial-gradient(460px 280px at 50% 0%, rgb('+tint.trim().split(' ').join(',')+' / .22), transparent 70%)';
    if(lastBrand && lastBrand.logoUrl && resultRealLoading && !document.getElementById('realWaitLogo')){
      var lg=document.createElement('img');
      lg.id='realWaitLogo'; lg.src=lastBrand.logoUrl; lg.alt='';
      lg.style.cssText='width:34px;height:34px;border-radius:8px;object-fit:contain;background:#fff;padding:3px;margin-bottom:2px';
      resultRealLoading.insertBefore(lg, resultRealLoading.firstChild);
    }
    var t0=Date.now(), escalated=false;
    function linkOut(prefix){
      main.textContent=prefix+' ';
      var a=document.createElement('a');
      a.href=jobUrl; a.target='_blank'; a.rel='noopener noreferrer';
      a.textContent='Open your live build ↗';
      a.style.cssText='color:rgb(var(--emerald-br));font-weight:700;text-decoration:underline';
      main.appendChild(a);
    }
    if(!EMBED_OK){ linkOut('Your build is running.'); return; }
    waitTick=setInterval(function(){
      if(!resultRealLoading || resultRealLoading.style.display==='none'){ clearInterval(waitTick); return; }
      var s=Math.round((Date.now()-t0)/1000);
      sub.textContent='Elapsed '+Math.floor(s/60)+':'+('0'+s%60).slice(-2)+' · scripting, avatar and compositing usually take 4 to 5 minutes.';
      if(s>=25 && !escalated){
        escalated=true;
        linkOut('Still connecting here. Your build is running either way —');
      }
    },1000);
  }
  function saveRun(label, jobId){
    try{ sessionStorage.setItem(RUN_KEY, JSON.stringify({j:jobId, l:label, t:Date.now()})); }catch(e){}
  }
  function loadRun(){
    try{
      var r=JSON.parse(sessionStorage.getItem(RUN_KEY)||'null');
      if(r && r.j && (Date.now()-r.t) < RUN_TTL_MS) return r;
    }catch(e){}
    return null;
  }
  function restoreRun(){
    var r=loadRun();
    if(!r || building) return;
    var jobUrl = DEMO_API_BASE + '/demo/' + encodeURIComponent(r.j);
    if(resultCanned) resultCanned.style.display='none';
    if(resultRealWrap){
      resultRealWrap.style.display='block';
      if(resultRealOpenLink) resultRealOpenLink.href=jobUrl;
      if(resultRealFrame && EMBED_OK){
        resultRealFrame.addEventListener('load', function onRestoredFrameLoad(){
          resultRealFrame.style.opacity='1';
          if(resultRealLoading) resultRealLoading.style.display='none';
          resultRealFrame.removeEventListener('load', onRestoredFrameLoad);
        });
        resultRealFrame.src=jobUrl;
      }
      armWaitFeedback(jobUrl);
      listenToRealBuild(r.j);
    }
    realJobId=r.j;
    /* the field must not read as forgotten while the shell below says
       "built live for Frame" (round-2 adversary, mini-D4) — the company
       label (never the address) fills the placeholder */
    if(emailIn && r.l) emailIn.placeholder='Your '+r.l+' build is below';
    resultFor.textContent=r.l;
    resultForLabel.textContent='built live for ';
    resultTime.textContent='Building now';
    resultShell.style.display='block';
    buildBtn.textContent='Try another address'; buildBtn.classList.add('ghost');
    /* restored quietly in place: no scroll, no animation — the visitor came
       back to the page, the page did not just finish something */
  }
  /* ── T3 live: the stream route now sends CORS for our origins, so the
     node rail and console run on the REAL engine's events (research_done →
     … → email_sent) instead of only the iframe. Full history replays first
     (the server marks it with __history_end), which is exactly right for a
     restored run: the rail fast-forwards to the truth. The iframe stays —
     this narrates, that shows. Any stream failure is silent: the iframe
     carries the experience alone, as it did before this existed. */
  var realStream=null;
  var STREAM_EVENTS={
    research_done:{node:0,line:'Research done. Real signals pulled from your site.'},
    page_built:{node:1,line:'Page built in your brand colours.'},
    vo_ready:{node:1,line:'Script written and voiced.'},
    visuals_ready:{node:1,line:'Cutting the scenes.'},
    avatar_ready:{node:2,line:'Presenter pass done.'},
    preview_film_ready:{node:2,line:'First cut rendered.'},
    film_ready:{node:2,line:'Film ready.'},
    qa_passed:{node:2,line:'Quality checks passed.'},
    page_published:{node:3,line:'Page published.'},
    email_sent:{node:3,line:'Delivered.'},
    ready_to_dm:{node:3,line:'Ready to send.'},
    delivery_skipped:{node:3,line:'Build finished.'}
  };
  function closeRealStream(){
    if(realStream){ try{ realStream.close(); }catch(e){} realStream=null; }
    stopTicker();
  }
  /* ── the console never freezes (Andrew, 28 Aug: "all of the different
     steps rolling around... so there are no moments where it freezes").
     Real events are minutes apart, so between them ONE pending line stays
     alive and cycles through honest descriptions of what the current stage
     is actually doing. It resolves to a tick when the real event lands and
     a new pending line opens for the next stage. Every cycled line
     describes the in-flight stage truthfully — nothing is claimed done. */
  var TICKER_PHASES=[
    { until:['research_done'], lines:['Reading your site…','Pulling real signals…','Choosing the angle…'] },
    { until:['page_built'], lines:['Capturing your brand…','Reading your colours…','Laying out your page…'] },
    { until:['vo_ready'], lines:['Writing your script…','Voicing it with the founder clone…','Timing the delivery…'] },
    { until:['visuals_ready','avatar_ready','preview_film_ready','film_ready'], lines:['Cutting the scenes…','Assembling the film…','Compositing motion graphics…'] },
    { until:['qa_passed','page_published','email_sent','ready_to_dm','delivery_skipped'], lines:['Running quality checks…','Publishing the page…','Preparing delivery…'] }
  ];
  var tickerIv=null, tickerLine=null, tickerPhase=0, tickerStep=0;
  function stopTicker(){
    if(tickerIv){ clearInterval(tickerIv); tickerIv=null; }
    if(tickerLine && tickerLine.parentNode) tickerLine.parentNode.removeChild(tickerLine);
    tickerLine=null;
  }
  function phaseOfEvent(name){
    for(var i=0;i<TICKER_PHASES.length;i++) if(TICKER_PHASES[i].until.indexOf(name)>-1) return i;
    return -1;
  }
  function openTicker(){
    if(tickerPhase>=TICKER_PHASES.length){ stopTicker(); return; }
    if(!tickerLine){
      tickerLine=appendConsoleLine(TICKER_PHASES[tickerPhase].lines[0], true);
      tickerLine.id='consoleTicker';
    }
    tickerStep=0;
    if(!tickerIv && !reduce){
      tickerIv=setInterval(function(){
        if(!tickerLine){ return; }
        var lines=TICKER_PHASES[tickerPhase].lines;
        tickerStep=(tickerStep+1)%lines.length;
        var label=tickerLine.lastChild;
        if(label) label.textContent=lines[tickerStep];
      }, 6000);
    }
  }
  function tickerOnEvent(name){
    var p=phaseOfEvent(name);
    if(p<0) return;
    if(p>=tickerPhase){
      /* the pending line becomes this event's tick via the caller; open the
         next stage's pending line so the console keeps moving */
      if(tickerLine && tickerLine.parentNode) tickerLine.parentNode.removeChild(tickerLine);
      tickerLine=null;
      tickerPhase=p+1;
      openTicker();
    }
  }
  /* "Try another address" mid-build read as an error affordance (final sim
     round). While the real build runs, the button stays a disabled
     "Building…"; it releases on the stream's terminal event, on stream
     failure, or on a 12-minute failsafe — whichever comes first. */
  var releaseTimer=null;
  function releaseBuildBtn(){
    if(releaseTimer){ clearTimeout(releaseTimer); releaseTimer=null; }
    building=false;
    buildBtn.disabled=false;
    buildBtn.textContent='Try another address';
    buildBtn.classList.add('ghost');
  }
  function holdBuildBtn(){
    buildBtn.disabled=true;
    buildBtn.textContent='Building…';
    buildBtn.classList.remove('ghost');
    if(releaseTimer) clearTimeout(releaseTimer);
    releaseTimer=setTimeout(releaseBuildBtn, 12*60*1000);
  }
  function listenToRealBuild(jobId){
    if(!window.EventSource) return;
    closeRealStream();
    var seen={};
    var es;
    try{ es=new EventSource(DEMO_API_BASE+'/api/v1/demo/stream/'+encodeURIComponent(jobId)); }catch(e){ return; }
    realStream=es;
    function ensureConsole(){
      if(consoleEl && consoleEl.style.display==='none') consoleEl.style.display='block';
      var nodeRow=document.getElementById('nodeRow');
      if(nodeRow) nodeRow.style.display='flex';
    }
    Object.keys(STREAM_EVENTS).forEach(function(name){
      es.addEventListener(name, function(ev){
        if(seen[name]) return; seen[name]=1;
        ensureConsole();
        var m=STREAM_EVENTS[name];
        litNode(m.node);
        var line=appendConsoleLine(m.line);
        /* the wait's reading material (Andrew, 28 Aug: "I'm bored now"):
           research_done carries the REAL facts the engine pulled — surface
           the first two as console lines. Genuine outputs, not padding. */
        if(name==='research_done'){
          try{
            var pd=JSON.parse(ev.data||'{}');
            (Array.isArray(pd.facts)?pd.facts:[]).slice(0,2).forEach(function(f){
              if(f && f.text) appendConsoleLine('Found: '+String(f.text).slice(0,140));
            });
          }catch(e){}
        }
        var pct=25*(m.node+1);
        if(progressFill) progressFill.style.width=Math.max(parseFloat(progressFill.style.width)||0,pct)+'%';
        /* avatar_ready says whether a presenter actually rendered
           (voiceOnly). "Presenter render ready" on a voice-led film was a
           false claim (Andrew, 28 Aug: "we're not doing a presenter render
           for this though are we?") — the line now states which it was. */
        if(name==='avatar_ready'){
          try{
            var ap=JSON.parse(ev.data||'{}');
            var lbl=line && line.lastChild;
            if(lbl) lbl.textContent = ap.voiceOnly ? 'Voice-led film. No on-screen presenter for this one.' : 'Presenter render ready.';
          }catch(e){}
        }
        tickerOnEvent(name);
        if(name==='email_sent'||name==='ready_to_dm'||name==='delivery_skipped'){ closeRealStream(); releaseBuildBtn(); }
      });
    });
    /* the rolling ticker starts once history has replayed, from whichever
       stage the build is genuinely in */
    es.addEventListener('__history_end', function(){
      var maxP=-1;
      Object.keys(seen).forEach(function(n){ var p=phaseOfEvent(n); if(p>maxP) maxP=p; });
      tickerPhase=maxP+1;
      if(tickerPhase<TICKER_PHASES.length){ ensureConsole(); openTicker(); }
    });
    es.addEventListener('stage_dead_letter', function(){
      ensureConsole();
      var line=appendConsoleLine('The build hit a problem. The page below has the detail.', true);
      if(line.resolveLine) line.resolveLine(false);
      closeRealStream();
      releaseBuildBtn();
    });
    es.addEventListener('__not_found', function(){ closeRealStream(); releaseBuildBtn(); });
    es.onerror=function(){ releaseBuildBtn(); /* the iframe carries the experience */ };
  }
  function revealRealResult(parsed, jobId){
    var jobUrl = DEMO_API_BASE + '/demo/' + encodeURIComponent(jobId);
    saveRun(personLabel(parsed), jobId);
    if(resultCanned) resultCanned.style.display='none';
    if(resultRealWrap){
      resultRealWrap.style.display='block';
      if(resultRealOpenLink) resultRealOpenLink.href=jobUrl;
      if(resultRealFrame && EMBED_OK){
        resultRealFrame.addEventListener('load', function onRealFrameLoad(){
          resultRealFrame.style.opacity='1';
          if(resultRealLoading) resultRealLoading.style.display='none';
          resultRealFrame.removeEventListener('load', onRealFrameLoad);
        });
        resultRealFrame.src=jobUrl;
      }
      armWaitFeedback(jobUrl);
      listenToRealBuild(jobId);
      // Resilience only, never a teardown: a real cold build can take a moment to respond, so just
      // make the always-real direct link easier to spot rather than assuming anything is broken.
      setTimeout(function(){
        if(resultRealLoading && resultRealLoading.style.display!=='none' && resultRealOpenLink){
          resultRealOpenLink.hidden=false; resultRealOpenLink.style.fontWeight='800';
          resultRealOpenLink.style.color='rgb(var(--emerald-br))';
        }
      }, 9000);
    }
    plateBuild(null);
    var plDone=document.getElementById('demoPlate');
    if(plDone) plDone.classList.add('built');
    resultFor.textContent=personLabel(parsed);
    resultForLabel.textContent='built live for ';
    resultTime.textContent='Building now';
    resultShell.style.display='block';
    resultShell.style.opacity=0; resultShell.style.transform='translateY(20px)';
    resultShell.style.transition='opacity .6s var(--ease),transform .6s var(--ease)';
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){ resultShell.style.opacity=1; resultShell.style.transform='none'; });
    });
    /* the button stays held while the real build runs; listenToRealBuild's
       terminal/error paths (or the 12-min failsafe) release it */
    if(window.EventSource) holdBuildBtn(); else releaseBuildBtn();
    building=false;
    resultShell.scrollIntoView({behavior: reduce?'auto':'smooth', block:'nearest'});
  }

  function attemptRealBuild(rawEmail, parsed, normalised){
    if(building) return;
    if(!window.fetch){ runBuild(rawEmail, {simulationLabel:true, keepPlate:true}); return; }
    building=true;
    resetDemo();
    buildBtn.disabled=true; buildBtn.textContent='Building…'; buildBtn.classList.remove('ghost');

    /* §5.3 MX gate runs FIRST, before any build UI. A blind funnel tester
       watched the earlier order — console open, plate transforming, then
       the whole thing retracting on a bad domain 1.5s later — and read the
       retraction as a glitch, not a validation. The check answers in well
       under its 2.5s cap, so the button's Building… state covers the wait;
       a failing domain is now told before anything visibly starts. */
    mxCheck(parsed.domain).then(function(hasMail){
      if(!hasMail){
        buildBtn.disabled=false; buildBtn.textContent='Build my free video'; buildBtn.classList.remove('ghost');
        building=false;
        showEmailHint('We could not find a mail server at '+parsed.domain+'. Double-check the address.', true);
        return;
      }
      consoleEl.style.display='block';
      litNode(0);
      progressFill.style.width='20%';
      var contactLine=appendConsoleLine('Contacting the live build engine…', true);

      /* the staged assembly (PRD-01 §6) runs on the plate while the capture
         call runs underneath it; nothing resolves on screen before the
         third stage has had its beat */
      var stagesDone=false, queued=null;
      plateStages(parsed, function(){
        stagesDone=true;
        if(queued){ var q=queued; queued=null; q(); }
      });
      function afterStages(fn){ if(stagesDone) fn(); else queued=fn; }

      var ctrl = window.AbortController ? new AbortController() : null;
      var settled = false;
      var timeoutId = setTimeout(function(){ if(ctrl) ctrl.abort(); }, 15000);

      function fallback(){
        if(settled) return; settled=true;
        clearTimeout(timeoutId);
        if(contactLine && contactLine.resolveLine)
          contactLine.resolveLine(false, 'Engine not reachable just now. Replaying a real build instead.');
        afterStages(function(){
          buildBtn.disabled=false; buildBtn.textContent='Build my free video'; buildBtn.classList.remove('ghost');
          building=false;
          runBuild(rawEmail, {simulationLabel:true, keepPlate:true});
        });
      }

      fireConversion('submit');
      recordBuild(normalised); // the build is now happening — it counts against §5's limits
      // SAFETY (non-negotiable — see the file header above for the full proof): deliveryMode is
      // always the literal string 'test' and testEmail is always the fixed Sixty inbox constant
      // above. Neither is ever derived from rawEmail or anything else user-controlled, so this call
      // can never address a real send at the visitor's own or any other external inbox.
      fetch(DEMO_CAPTURE_URL, {
        method:'POST',
        mode:'cors',
        credentials:'omit',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(ssTsToken ? { email: rawEmail, deliveryMode:'test', testEmail: DEMO_TEST_EMAIL, turnstileToken: ssTsToken } : { email: rawEmail, deliveryMode:'test', testEmail: DEMO_TEST_EMAIL }),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function(res){
        return res.json().catch(function(){ return {}; }).then(function(body){ return {ok:res.ok, body:body}; });
      }).then(function(result){
        if(settled) return;
        // Belt-and-braces: only ever proceed when the server itself echoes back the test mode this
        // page requested. Anything else (including an unexpected 'live') aborts to the simulated
        // fallback rather than trusting a single layer for something safety-critical.
        if(!result.ok || !result.body || !result.body.jobId || result.body.deliveryMode !== 'test'){
          fallback();
          return;
        }
        settled=true;
        clearTimeout(timeoutId);
        if(contactLine && contactLine.resolveLine) contactLine.resolveLine(true, 'Live build engine connected.');
        realJobId=result.body.jobId;
        afterStages(function(){
          appendConsoleLine('Real build started. Now watching it live below.');
          /* the sim lane says this; the real lane must too — a tester who
             typed her email reasonably waited for one */
          appendConsoleLine('It plays here. Nothing is sent to your inbox.');
          revealRealResult(parsed, realJobId);
        });
      }).catch(function(){ fallback(); });
    });
  }

  demoForm.addEventListener('submit', function(e){
    e.preventDefault();
    if(building || staging) return;
    var raw=emailIn.value.trim();
    /* the conversion signal fires when a build STARTS, not on every submit:
       rate-limited refusals and dead-domain rejections were counting as
       demo_build_started, so paid-traffic numbers overcounted builds */
    if(!raw || raw.indexOf('@')<1){
      fireConversion('preview');
      runBuild(raw); // no plausible email yet — same permissive preview as always, unlabelled
      return;
    }
    var parsed=parseEmail(raw), norm=normaliseEmail(raw);
    /* §5: over a limit, a clear message — never a silent failure and never
       another build. Plus-variants of one address land here after the first. */
    var limited=rateLimitMessage(norm);
    if(limited){
      showEmailHint(limited, true);
      if(resultShell.style.display!=='none')
        resultShell.scrollIntoView({behavior: reduce?'auto':'smooth', block:'nearest'});
      return;
    }
    clearEmailHint();
    if(parsed.free){
      /* §4: help, not refusal — the message explains what a work email buys,
         and the preview still runs, personalised by name only (a consumer
         domain has no company to read), on the simulated lane. */
      showEmailHint(WORK_EMAIL_HELP);
      fireConversion('free-preview');
      recordBuild(norm);
      staging=true;
      buildBtn.disabled=true; buildBtn.textContent='Building…'; buildBtn.classList.remove('ghost');
      plateStages(parsed, function(){ staging=false; runBuild(raw, {keepPlate:true}); });
      return;
    }
    attemptRealBuild(raw, parsed, norm);
  });

  restoreRun();

  document.querySelectorAll('[data-demo]').forEach(function(b){
    b.addEventListener('click', function(){
      document.getElementById('hero').scrollIntoView({behavior: reduce?'auto':'smooth', block:'start'});
      setTimeout(function(){ emailIn.focus(); }, reduce?0:450);
    });
  });

  /* ── ghost pass: the demo demonstrates itself while idle ─────────
     Until anyone touches the form, the placeholder types an in-world
     address and the four stages light through, then settle back. It
     only ever animates the PLACEHOLDER and the node row — the input's
     value is never faked, the console never opens, nothing is claimed.
     First real engagement (focus/input/submit) retires it for good. */
  (function(){
    if(reduce) return;
    var GHOST='e.g. maya@northbank.com', BASE='you@company.com';
    var engaged=false, visible=false, timer=null, seq=[];
    function clearSeq(){ seq.forEach(clearTimeout); seq=[]; }
    function ghostNodesOff(){
      document.querySelectorAll('.node .ndot').forEach(function(n){
        n.style.background=''; n.style.borderColor=''; n.style.boxShadow=''; n.style.transform='';
      });
      document.querySelectorAll('.node span').forEach(function(s){ s.style.color=''; });
      document.querySelectorAll('.nline i').forEach(function(i){ i.style.width='0%'; });
    }
    function retire(){
      if(engaged) return;
      engaged=true;
      clearSeq(); clearInterval(timer); timer=null;
      ghostNodesOff();
      emailIn.placeholder=BASE;
      emailIn.classList.remove('ghosting');
    }
    ['focus','input'].forEach(function(ev){ emailIn.addEventListener(ev, retire); });
    demoForm.addEventListener('submit', retire);

    function pass(){
      if(engaged || building || document.hidden || !visible || emailIn.value) return;
      clearSeq(); ghostNodesOff();
      emailIn.classList.add('ghosting');
      var at=0;
      setPreview('You','Your company');
      setPlateCaption(true);
      /* type the address into the placeholder */
      var atSign=GHOST.indexOf('@');
      for(var i=1;i<=GHOST.length;i++){
        (function(i){ seq.push(setTimeout(function(){ emailIn.placeholder=GHOST.slice(0,i); }, at)); })(i);
        /* the plate resolves in the same two beats a reader would: who,
           then where. GHOST carries an "e.g. " prefix that parseEmail would
           mangle, so the ghost's plate is stated rather than derived. */
        if(i===atSign) (function(){ seq.push(setTimeout(function(){ setPreview('Maya','Your company'); setPlateCaption(true); }, at)); })();
        if(i===GHOST.length) (function(){ seq.push(setTimeout(function(){ setPreview('Maya','Northbank'); }, at+260)); })();
        at+=52;
      }
      at+=420;
      for(var n=0;n<4;n++){
        (function(n){ seq.push(setTimeout(function(){ if(!engaged && !building && document.getElementById('nodeRow').style.display!=='none') litNode(n); }, at)); })(n);
        at+=620;
      }
      at+=1600;
      seq.push(setTimeout(function(){ if(!engaged && !building){ ghostNodesOff(); emailIn.placeholder=BASE; emailIn.classList.remove('ghosting'); setPreview('You','Your company'); setPlateCaption(true); } }, at));
    }

    if('IntersectionObserver' in window){
      var io=new IntersectionObserver(function(es){
        es.forEach(function(en){ visible=en.isIntersecting; });
      },{threshold:.4});
      io.observe(document.getElementById('demoShell'));
    } else { visible=true; }

    /* pass() is retained but never scheduled: see the note above. The field
       keeps its blinking caret and the button keeps its pulse, which is what
       actually says "this is a control", without the page appearing to
       operate itself. */
    void pass;
  })();
})();

/* ══ 5.3 — Lenis smooth scroll + ScrollTrigger sync, whole page ══
   Mirrors the wave page (landing-share/andrew/index.html) exactly: Lenis
   drives native scroll via rAF, ScrollTrigger.update stays in lockstep,
   GSAP's own lag smoothing is switched off so it never fights Lenis's. Only
   runs with real motion permitted — reduced-motion users get plain native
   scroll and every section still reveals via shared.js's IO-based .rv/.in. */
(function(){
  var reduce = window.SIXTY_REDUCE;
  if(reduce || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  if(window.Lenis){
    var lenis = window.__lenis = new Lenis({duration:1.15, easing:function(t){ return Math.min(1,1.001-Math.pow(2,-10*t)); }});
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function(t){ lenis.raf(t*1000); });
    gsap.ticker.lagSmoothing(0);
  }
  addEventListener('load', function(){ ScrollTrigger.refresh(); });
})();

/* ══ 5.3 — the drag-wipe comparator ══════════════════════════
   #compFrame holds two full-card layers (.comp-old under, .comp-new on top,
   clipped from its own left edge by --split%). The grip sits AT --split, so
   .comp-old is always what's left of it and .comp-new always what's right —
   true regardless of drag direction, so there's no "wrong way" to drag.
   Pointer Events cover mouse + touch + pen in one code path; arrow/Home/End
   on the focused grip cover keyboard. A one-off auto-hint sweep teaches the
   interaction on first reveal, and doubles as the moment the analytics
   "arm" (watch-bar fill, Slack ping, CRM flip) so the loop firing is always
   seen at least once even if a visitor never touches it themselves. */
(function(){
  var frame=document.getElementById('compFrame'), handle=document.getElementById('compHandle');
  if(!frame||!handle) return;
  var reduce=window.SIXTY_REDUCE;
  var orbNew=document.getElementById('compOrbNew');
  var watchFill=document.getElementById('compWatchFill'), watchPct=document.getElementById('compWatchPct');
  var slack=document.getElementById('compSlack'), crm=document.getElementById('compCrm'), crmLabel=document.getElementById('compCrmLabel');
  var booked=document.getElementById('compBooked');
  var views=document.getElementById('compViews'), viewsN=document.getElementById('compViewsN');
  var thumb=document.getElementById('compThumb'), thumbPlay=document.getElementById('compThumbPlay');
  var cursor=document.getElementById('compCursor'), realframe=frame.querySelector('.comp-realframe');
  var video=frame.querySelector('.pv-live video');
  /* REST is 38, not the old 50: the new layer is clipped from its own left
     edge, so at 50 the frame's centre — where a play disc has to sit — fell
     exactly on the clip line and half the disc was never on screen. 38 still
     leaves the templated side wide enough to read its merge tags. */
  var REST=32;
  var split=REST, armed=false, dragging=false, hintTween=null, hintTimers=[];
  var VIEWS_FROM=198, VIEWS_TO=214, cascadeTimers=[];

  /* the cascade: the panel does not just "turn on", it plays the loop in
     the order it happens in the product — watched, then the alert, then
     the CRM, then the meeting. Beats are 90ms apart so it reads as one
     chain of consequences rather than four things arriving at once. */
  function beat(fn,ms){ cascadeTimers.push(setTimeout(fn,ms)); }
  /* 90ms between these read as one flash of three things arriving together.
     They are not simultaneous — they are consequences, each caused by the
     one before it, and the panel only tells that story if you can watch
     each one land. ~500ms apart is slow enough to follow and still quick
     enough that nobody is waiting. */
  function fireSignals(){
    slack.classList.add('armed');
    beat(function(){ crm.classList.add('armed'); crmLabel.textContent='Warm'; },520);
    beat(function(){ if(booked) booked.classList.add('armed'); },1080);
  }
  function bumpViews(n){
    if(!viewsN) return;
    viewsN.textContent=String(n);
    if(!views) return;
    views.classList.add('live');
    views.classList.remove('tick');
    void views.offsetWidth; // restart the pop on every increment
    views.classList.add('tick');
  }
  /* the click: a cursor arrives, presses the disc, and the render takes
     over from its first frame. Under reduced motion there is no cursor and
     no travel — the thumbnail simply gives way and the video plays. */
  function startPlayback(){
    if(thumb) thumb.classList.add('gone');
    if(realframe) realframe.classList.add('played');
    if(video){
      try{ video.currentTime=0; }catch(e){}
      var p=video.play(); if(p&&p.catch) p.catch(function(){});
    }
  }
  function playTheVideo(){
    if(reduce||!cursor||!thumbPlay){ startPlayback(); runTelemetry(); return; }
    cursor.classList.add('in');
    beat(function(){ cursor.classList.add('landed'); },120);
    beat(function(){ thumbPlay.classList.add('pressed'); },760);
    beat(function(){ thumbPlay.classList.remove('pressed'); },900);
    beat(function(){ startPlayback(); cursor.classList.remove('in'); },900);
    beat(runTelemetry,940);
  }
  function runTelemetry(){
    if(!reduce && window.gsap){
      var signalled=false;
      gsap.to({v:0},{v:87,duration:2.2,ease:'power1.out',onUpdate:function(){
        var n=Math.round(this.targets()[0].v);
        watchFill.style.width=n+'%'; watchPct.textContent=n+'%';
        /* the alert fires the moment the bar crosses the threshold the
           copy claims it fires on, not when the tween finishes */
        if(!signalled && n>=75){ signalled=true; fireSignals(); }
      },onComplete:function(){ if(!signalled) fireSignals(); }});
      gsap.to({v:VIEWS_FROM},{v:VIEWS_TO,duration:2.8,ease:'power1.out',onUpdate:function(){
        bumpViews(Math.round(this.targets()[0].v));
      }});
    } else {
      watchFill.style.width='87%'; watchPct.textContent='87%';
      bumpViews(VIEWS_TO);
      fireSignals();
    }
  }

  function setSplit(v){
    split=Math.max(0,Math.min(100,v));
    frame.style.setProperty('--split',split);
    handle.setAttribute('aria-valuenow',String(Math.round(split)));
    if(orbNew) orbNew.style.opacity=(0.18+(100-split)/100*0.62).toFixed(2);
    var revealedNew=100-split;
    if(!armed && revealedNew>=72){ armed=true; playTheVideo(); }
  }
  /* the markup ships armed (static and no-JS renders read as the success
     state); demote to cold here so the reveal still animates it live */
  slack.classList.remove('armed'); crm.classList.remove('armed');
  if(booked) booked.classList.remove('armed');
  crmLabel.textContent='Cold';
  watchFill.style.width='0%'; watchPct.textContent='0%';
  if(viewsN) viewsN.textContent=String(VIEWS_FROM);
  setSplit(REST);

  function splitFromClientX(clientX){
    var r=frame.getBoundingClientRect();
    return ((clientX-r.left)/r.width)*100;
  }
  function cancelHint(){
    if(hintTween){ hintTween.kill(); hintTween=null; }
    hintTimers.forEach(clearTimeout); hintTimers.length=0;
  }
  function startDrag(e){
    cancelHint(); // real input always wins over the auto-hint sweep
    dragging=true;
    frame.classList.add('dragging');
    handle.focus({preventScroll:true});
    setSplit(splitFromClientX(e.clientX));
    if(e.pointerId!=null && frame.setPointerCapture){ try{ frame.setPointerCapture(e.pointerId); }catch(err){} }
    e.preventDefault();
  }
  function onDrag(e){ if(dragging) setSplit(splitFromClientX(e.clientX)); }
  function endDrag(){ dragging=false; frame.classList.remove('dragging'); }
  frame.addEventListener('pointerdown', startDrag);
  frame.addEventListener('pointermove', onDrag);
  frame.addEventListener('pointerup', endDrag);
  frame.addEventListener('pointercancel', endDrag);

  handle.addEventListener('keydown', function(e){
    var step = e.shiftKey?15:5, handled=true;
    if(e.key==='ArrowLeft') setSplit(split-step);
    else if(e.key==='ArrowRight') setSplit(split+step);
    else if(e.key==='Home') setSplit(0);
    else if(e.key==='End') setSplit(100);
    else handled=false;
    if(handled){ cancelHint(); e.preventDefault(); }
  });

  /* PRD-04 §1: the section must read in one or two seconds with NO
     interaction. On scroll-into-view the comparator auto-plays its
     transition once — sweep to the personalised side, dwell there while
     the cascade (play, watch bar, alert, CRM, meeting) lands, then settle
     back to the rest split, which shows both sides. Drag remains as the
     enhancement, not the price of admission. */
  var hinted=false;
  function playIntro(){
    if(hinted) return;
    hinted=true;
    if(reduce){
      /* reduced motion: both states static — the new side rests already
         armed (bar filled, alert and CRM lit, meeting booked) instead of
         cold, so the difference is legible with nothing moving. `armed`
         stays false: a deliberate drag past the threshold still plays the
         render, which is user-initiated. */
      watchFill.style.width='87%'; watchPct.textContent='87%';
      bumpViews(VIEWS_TO);
      slack.classList.add('armed');
      crm.classList.add('armed'); crmLabel.textContent='Warm';
      if(booked) booked.classList.add('armed');
      return;
    }
    if(window.gsap){
      var pos={v:REST};
      hintTween=gsap.timeline({delay:.4})
        .to(pos,{v:8,duration:1.0,ease:'power2.inOut',onUpdate:function(){ setSplit(pos.v); }})
        .to(pos,{v:8,duration:1.7})   /* dwell while the cascade lands */
        .to(pos,{v:REST,duration:.9,ease:'power2.inOut',onUpdate:function(){ setSplit(pos.v); }});
    } else {
      hintTimers.push(setTimeout(function(){
        setSplit(8);
        hintTimers.push(setTimeout(function(){ setSplit(REST); },2700));
      },400));
    }
  }
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(es,o){
      es.forEach(function(en){ if(en.isIntersecting){ playIntro(); o.disconnect(); } });
    },{threshold:.4}).observe(frame);
  } else playIntro();
})();

/* ══ 5.3 — engine screen strip: focus glides between four screens ══
   Perspective-style. CSS defaults to screen 0 focused; every screen is
   fully legible even with JS dead. The cycler advances focus every 4.2s,
   pauses while the pointer is over the strip, and a tab or screen click
   selects directly (and holds for 8s before resuming). Reduced motion
   never cycles and shows all four at full strength (CSS handles that). */
(function(){
  if(window.SIXTY_REDUCE) return;
  var strip=document.getElementById('engStrip');
  if(!strip) return;
  var tabs=[].slice.call(strip.querySelectorAll('.eng-tab'));
  var screens=[].slice.call(strip.querySelectorAll('.escr'));
  var cur=0, timer=null, holdUntil=0;

  function setStage(i){
    cur=i;
    tabs.forEach(function(t){
      var on=+t.dataset.stage===i;
      t.classList.toggle('is-on',on);
      t.setAttribute('aria-selected',on?'true':'false');
    });
    screens.forEach(function(s){ s.classList.toggle('is-on',+s.dataset.stage===i); });
  }
  function tick(){
    if(Date.now()<holdUntil || strip.matches(':hover')) return;
    setStage((cur+1)%screens.length);
  }
  function select(i){ setStage(i); holdUntil=Date.now()+8000; }

  tabs.forEach(function(t){ t.addEventListener('click',function(){ select(+t.dataset.stage); }); });
  screens.forEach(function(s){ s.addEventListener('click',function(){ select(+s.dataset.stage); }); });

  /* Dots are still tabs (PRD-05 §1): arrow keys walk the stages and move
     focus with the selection, Home/End jump. Without this a keyboard user
     lost the pill row's operability when the pills shrank to dots. */
  var tablist=document.getElementById('engTabs');
  if(tablist) tablist.addEventListener('keydown', function(e){
    var i=tabs.indexOf(document.activeElement), n=null;
    if(i<0) return;
    if(e.key==='ArrowRight'||e.key==='ArrowDown') n=(i+1)%tabs.length;
    else if(e.key==='ArrowLeft'||e.key==='ArrowUp') n=(i-1+tabs.length)%tabs.length;
    else if(e.key==='Home') n=0;
    else if(e.key==='End') n=tabs.length-1;
    if(n===null) return;
    e.preventDefault();
    tabs[n].focus();
    select(n);
  });

  /* only cycle while the strip is actually on screen */
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(en){
        if(en.isIntersecting){ if(!timer) timer=setInterval(tick,1900); }
        else { clearInterval(timer); timer=null; }
      });
    },{threshold:.3});
    io.observe(strip);
  } else {
    timer=setInterval(tick,1900);
  }
})();


/* ══ journey rail: animated use-case explainer per stage ══
   Was one 16:9 render per stage, which taught a cold reader who will
   not press play precisely nothing. Each stage now runs a four-beat
   animated explainer of the mechanism instead — In, Out, Lands, Back —
   and the real renders live on the outcome pages and /examples.
   Rail clicks swap the scene; the display swap restarts its CSS cycle
   from beat one, so a stage always opens on "In". */
(function(){
  var rail=document.getElementById('ocRail'),
      live=document.getElementById('ocLive'),
      stage=document.getElementById('ocxStage'),
      steps=document.getElementById('ocxSteps'),
      cap=document.getElementById('ocxOut');
  if(!rail||!live||!stage) return;

  var STAGES=[
    {cap:'More replies, from lists that went cold.',
     steps:["What goes in: a list you already have. We write and build each video; you approve them before any of it sends.",
            "What comes out: one video per person, each one naming them and their company. You film once; your face and voice are rebuilt for every one after that.",
            "Where it lands: you send one link. It opens on a page of her own.",
            "What comes back: you see who watched, and how far, so you know who is worth a call."]},
    {cap:'More booked calls, out of quiet deals.',
     steps:["What goes in: nothing to write, nothing to prepare.",
            "What comes out: a forty-second recap, sent the same day.",
            "Where it lands: she watches, then books from the same page. No chasing.",
            "What comes back: \u201cLet\u2019s circle back\u201d becomes a date in the diary."]},
    {cap:'Proposals that answer the questions a second call would.',
     steps:["What goes in: we pull out the scope, the numbers and the objections.",
            "What comes out: you, walking her through it, page by page.",
            "Where it lands: pitch, paperwork and payment, all on one page.",
            "What comes back: every viewer, and how far each one got."]},
    {cap:'Offers accepted before the counter-offer.',
     steps:["What goes in: three fields, and the offer video is ready to approve.",
            "What comes out: a welcome video the moment the offer goes, not a PDF a lawyer wrote.",
            "Where it lands: everything sits under the video, on a page only she has.",
            "What comes back: you know she watched before you know she accepted."]}
  ];

  var scenes=[].slice.call(stage.querySelectorAll('.ocx-scene'));
  var stops=[].slice.call(rail.querySelectorAll('.oc-stop'));

  stops.forEach(function(s,i){
    s.addEventListener('click',function(){
      stops.forEach(function(o){var on=o===s;o.classList.toggle('is-on',on);o.setAttribute('aria-selected',on?'true':'false');});
      var n=+s.dataset.live, st=STAGES[n];
      scenes.forEach(function(sc,k){sc.classList.toggle('is-on',k===n);});
      if(steps) steps.innerHTML=st.steps.map(function(t){return '<li>'+t+'</li>';}).join('');
      if(cap) cap.textContent=st.cap;
    });
  });
})();

/* ══ 5.3 — control band: the three gates light in order on scroll ══
   (Andrew, 27 Aug). Dimmed by .js-seq only after JS proves it is here,
   so a no-JS render shows all three at full strength. Reduced motion
   lights the row at once: the sequence is the motion, not the meaning. */
(function(){
  var grid=document.querySelector('#control .gl-flow');
  if(!grid) return;
  var pills=[].slice.call(grid.querySelectorAll('.pill'));
  function all(){ pills.forEach(function(p){ p.classList.add('lit'); }); }
  if(window.SIXTY_REDUCE || !('IntersectionObserver' in window)){ grid.classList.add('js-seq'); all(); return; }
  grid.classList.add('js-seq');
  new IntersectionObserver(function(es,o){
    es.forEach(function(en){
      if(!en.isIntersecting) return;
      o.disconnect();
      pills.forEach(function(p,i){ setTimeout(function(){ p.classList.add('lit'); }, 300+i*550); });
    });
  },{threshold:.45}).observe(grid);
})();
