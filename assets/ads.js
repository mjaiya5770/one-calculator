/* One Calculator — Adsterra banner loader: serialized seat queue +
   non-destructive fill watchdog (NN-ADS-V2 standard). Adsterra website
   registration for onecalculator.site is PENDING — until real keys are
   issued, every seat carries the zero key and the watchdog paints the
   house promo. AdSense loader is live on every page. */
/* NN-ADS-V2: seats load one at a time (queue) so concurrent invokes cannot race on the shared atOptions global;
   the house fallback waits ~30s and never wipes a seat — a MutationObserver lets a late real iframe replace the promo. */
(function () {
  /* NN-SHELL-GATE (Nov 10, 2026 — Capacitor app route, muni order via main
     chat): inside the native shell, AdMob is the ONLY ad stack and every web
     ad layer stays OFF. The native bridge (window.Capacitor) exists only in
     the shell — browsers and installed PWAs/TWAs never see it — so this gate
     is inert on the web. ads.js is the FIRST shared script on every page
     type that carries ads (verified Nov 10, 2026 — index, calculators,
     tools, guides, embed, creator hub; the NN-APP-MODE block in track.js
     runs after it), so detection here provably precedes NN-ADS-V2
     initialization: in shell mode the loader never initializes (no Adsterra
     invokes, no hero chain, no house promos, no adsbygoogle pushes,
     __nnLoadSeat is never defined), and the .nn-shell class on <html>
     collapses every seat via assets/style.css. window.__nnShell is the flag
     assets/nn-tools.js reads to gate NN-MODAL and emit the 'nn:calculated'
     signal the shell's AdMob interstitial keys off. */
  var NN_SHELL = false;
  try { NN_SHELL = !!window.Capacitor; } catch (e) { NN_SHELL = false; }
  if (NN_SHELL) {
    try { document.documentElement.classList.add('nn-shell'); } catch (e) {}
  }
  window.__nnShell = NN_SHELL;
  if (NN_SHELL) return; /* NN-SHELL-GATE: all web ad layers stay OFF in the shell */
  if (/[?&]embed=1(&|$)/.test(window.location.search)) return; /* NN-EMBED: ads off inside embeds */
  /* NN-MODAL-V2: every seat load — page queue and modal alike — goes through
     ONE serialized lock, so two invokes can never race on the atOptions
     global. The modal seat loads with priority (front of the pending queue)
     because it is the highest-value seat on the page; page seats still load
     in order behind it, none are dropped. */
  var nnLockBusy = false, nnPending = [];
  function nnEnqueue(el, done, priority) {
    var job = { el: el, done: done || function () {} };
    if (nnLockBusy) { if (priority) nnPending.unshift(job); else nnPending.push(job); return; }
    nnLockBusy = true; nnRunJob(job);
  }
  function nnRunJob(job) {
    loadBanner(job.el, function () {
      job.done();
      var nxt = nnPending.shift();
      if (nxt) nnRunJob(nxt); else nnLockBusy = false;
    });
  }
  window.__nnLoadSeat = function (el, done) { nnEnqueue(el, done, false); }; /* NN-MODAL: fresh single-seat loads (result interstitial) reuse this loader */
  window.__nnLoadSeatPriority = function (el, done) { nnEnqueue(el, done, true); };
  var HOST = 'https://bauval.org/22/';
  var SEAT_SETTLE_MS = 15000; /* per-seat wait for an iframe before the queue starts the next seat */
  var WATCHDOG_MS = 30000;    /* house promo only if the seat still has no iframe by now */
  var OBSERVE_MS = 60000;     /* keep watching for a late fill until now */

  function houseHTML() {
    var deep = /\/(tools|guides)\//.test(location.pathname);
    return '<a class="nn-house" href="' + (deep ? '../' : '') + 'calculators.html">' +
      '<strong>One Calculator — one tool per job, done properly</strong><span>176 single-purpose calculators. No signup, ever →</span></a>';
  }

  function watchSeat(el, startedAt) {
    /* per-seat override (the modal seat uses ~6s so its fallback paints inside the modal's lifetime) */
    var wd = parseInt(el.getAttribute('data-watchdog'), 10);
    var watchdogMs = wd > 0 ? wd : WATCHDOG_MS;
    /* a real iframe always wins over the house promo, whenever it arrives */
    function promote() {
      var house = el.querySelector('.nn-house');
      if (house && el.querySelector('iframe')) {
        house.parentNode.removeChild(house);
        el.removeAttribute('data-house');
      }
    }
    var obs = null;
    if (window.MutationObserver) {
      obs = new MutationObserver(promote);
      obs.observe(el, { childList: true, subtree: true });
    }
    var iv = setInterval(function () {
      promote();
      if (Date.now() - startedAt > OBSERVE_MS) {
        if (obs) obs.disconnect();
        clearInterval(iv);
      }
    }, 1000);
    setTimeout(function () {
      /* non-destructive: append the promo alongside the (unfilled) seat scripts, never innerHTML-wipe */
      if (!el.querySelector('iframe') && !el.querySelector('.nn-house')) {
        var wrap = document.createElement('div');
        wrap.innerHTML = houseHTML();
        el.appendChild(wrap.firstChild);
        el.setAttribute('data-house', '1');
      }
    }, Math.max(0, startedAt + watchdogMs - Date.now()));
  }

  function loadBanner(el, done) {
    var key = el.getAttribute('data-key');
    var w = parseInt(el.getAttribute('data-w'), 10), h = parseInt(el.getAttribute('data-h'), 10);
    /* NN-HOUSE-PRELOAD: zero-key (dormant) seats can never fill — the house
       promo is preloaded in the markup; make sure it is present and SKIP
       the pointless network invoke entirely (no 15s settle burn, no
       30s blank window). */
    if (key && /^0+$/.test(key)) {
      if (!el.querySelector('.nn-house')) {
        var zw = document.createElement('div');
        zw.innerHTML = houseHTML();
        el.appendChild(zw.firstChild);
      }
      el.setAttribute('data-house', '1');
      done(); return;
    }
    if (!key || !w || !h || el.getAttribute('data-loaded')) { watchSeat(el, Date.now()); done(); return; } /* NN-KEYLESS-WATCHDOG: a keyless seat still gets the house fallback — never a blank seat */
    el.setAttribute('data-loaded', '1');
    var startedAt = Date.now();
    var s1 = document.createElement('script');
    s1.textContent = "atOptions = {'key':'" + key + "','format':'iframe','height':" + h + ",'width':" + w + ",'params':{}};";
    el.appendChild(s1);
    var s2 = document.createElement('script');
    s2.src = HOST + key; s2.async = false;
    el.appendChild(s2);
    watchSeat(el, startedAt);
    /* settle: iframe present or per-seat timeout — then the queue starts the next seat */
    var iv = setInterval(function () {
      if (el.querySelector('iframe') || Date.now() - startedAt > SEAT_SETTLE_MS) {
        clearInterval(iv);
        done();
      }
    }, 400);
  }

  function pick(el) {
    var wide = (window.innerWidth || 1024) >= 760;
    var key = wide ? el.getAttribute('data-k728') : el.getAttribute('data-k320');
    if (key) { el.setAttribute('data-key', key); el.setAttribute('data-w', wide ? '728' : '320'); el.setAttribute('data-h', wide ? '90' : '50'); }
  }


  /* NN-HERO-SEAT: the homepage hero prime seat runs its own fill chain on top
     of NN-ADS-V2. The house promo is preloaded in the markup as the floor (the
     seat is never blank); the AdSense hero unit (slot
     6671053734, loader already in <head>) gets first claim; a ~3s watchdog
     checks for a real fill and otherwise falls back to Adsterra through the
     SAME serialized loader + pick() (this site's own 728/320 keys); a filled
     AdSense unit is terminal — the backfill never runs over it and the sweep
     below only ever removes the floor promo, never a filled unit. */
  var HERO_WATCHDOG_MS = 3000; /* AdSense fill check before the Adsterra backfill */

  function adsenseFilled(ins) {
    /* NN-HERO-FIX: Google's own data-ad-status is the ONLY fill signal.
       An iframe's size proves nothing — a live probe (Nov 9, 2026) caught
       the UNFILLED responsive unit carrying a fully sized 728x280 iframe
       that landed seconds BEFORE data-ad-status="unfilled" was set; the
       old size heuristic declared that blank unit "filled", locked the
       chain on 'adsense', the backfill never ran, and the seat ended
       blank. Status 'filled' is set by Google on a genuine fill only. */
    if (!ins) return false;
    return ins.getAttribute('data-ad-status') === 'filled';
  }

  function heroChain(el) {
    var stage = el.querySelector('.nn-hero-stage') || el;
    var ins = el.querySelector('ins.adsbygoogle');
    var startedAt = Date.now();
    var resolved = false;
    function floorHouse() {
      for (var i = 0; i < stage.children.length; i++) {
        var c = stage.children[i];
        if (c.classList && c.classList.contains('nn-house')) return c;
      }
      return null;
    }
    /* NN-HERO-FIX2: only a GENUINE fill displaces the floor promo — a
       filled AdSense unit (its status attribute), a backfill iframe with a
       real size and a real ad URL, or an Adsterra banner. A genuine
       Adsterra banner IS an about:blank iframe: the invoke writes the
       creative into the iframe's own document (live probe, Nov 9, 2026 —
       src="about:blank" at full size with the document populated: 3 body
       children, ~9KB of markup, an <img> and an <a>; the filled mid-page
       seat on the same page load carried the identical shape). The
       NN-HERO-FIX src test rejected every such banner as "empty", and the
       20s guard then re-layered the floor over it — heroes ended on the
       house promo despite a filled banner sitting in the stage. What
       separates a banner from an empty shell is the DOCUMENT, not the
       src: a populated same-origin document is a fill; an empty one (a
       withheld render, the stub shape) is not, and never displaces. */
    function genuineFill() {
      if (adsenseFilled(stage.querySelector('ins.adsbygoogle'))) return true;
      var fill = stage.querySelector('.nn-hero-fill');
      if (fill) {
        var f = fill.querySelector('iframe');
        if (f && f.offsetWidth > 0 && f.offsetHeight > 0) {
          var src = f.getAttribute('src') || '';
          if (src && src !== 'about:blank') return true;
          try {
            var d = f.contentDocument;
            if (d && d.body && (d.body.childElementCount > 0 || (d.body.innerHTML || '').length > 0)) return true;
          } catch (e) {}
        }
      }
      return false;
    }
    function sweep() {
      if (!genuineFill()) return;
      var fh = floorHouse();
      if (fh) fh.parentNode.removeChild(fh);
    }
    /* NN-HERO-FIX terminal guard: whatever the chain did — unfilled unit,
       empty backfill iframe, no iframe at all — the seat must never END
       blank. If no genuine fill is present and no house promo is showing,
       the floor is restored on top of whatever remnants remain (appended
       last in the stage, it paints above them). The first pass only
       pre-empts the remnant case nothing else can fix (watchSeat's own
       fallback stays out when an iframe exists); the final pass at
       OBSERVE_MS is unconditional. A genuine fill arriving later still
       displaces the restored floor via sweep(). */
    function guard(finalPass) {
      dedupeFloor();
      if (genuineFill()) return;
      var house = stage.querySelector('.nn-house');
      if (house) {
        /* a floor that never left can still sit UNDER a later-appended
           backfill layer (both are absolutely positioned in the stage, so
           DOM order paints) — re-append it above any empty remnant */
        if (house.parentNode === stage &&
            stage.children[stage.children.length - 1] !== house) {
          stage.appendChild(house);
        }
        return;
      }
      if (!finalPass && !stage.querySelector('iframe')) return;
      var wrap = document.createElement('div');
      wrap.innerHTML = houseHTML();
      if (wrap.firstChild) stage.appendChild(wrap.firstChild);
    }
    setTimeout(function () { guard(false); }, 20000);
    setTimeout(function () { guard(true); }, OBSERVE_MS);
    /* NN-HERO-FIX2: a banner whose document populates only after the
       observe window must still displace a restored floor — two late
       sweep passes (sweep() no-ops unless a genuine fill is present). */
    setTimeout(sweep, OBSERVE_MS + 30000);
    setTimeout(sweep, OBSERVE_MS + 90000);
    /* the shared loader's own in-fill house fallback (watchSeat) can also
       land while the stage floor is showing — an identical promo stacked
       pixel-perfect underneath it. Drop the duplicate so exactly one
       floor is ever in the stage. Safe by construction: an in-fill house
       only exists when no genuine fill displaced the stage floor. */
    function dedupeFloor() {
      if (!floorHouse()) return;
      var fill = stage.querySelector('.nn-hero-fill');
      if (!fill) return;
      var extra = fill.querySelector('.nn-house');
      if (extra) extra.parentNode.removeChild(extra);
    }
    var obs = null;
    if (window.MutationObserver) {
      obs = new MutationObserver(sweep);
      obs.observe(stage, { childList: true, subtree: true });
    }
    var iv = setInterval(function () {
      sweep();
      dedupeFloor();
      if (!resolved && adsenseFilled(ins)) { resolved = true; el.setAttribute('data-hero-resolved', 'adsense'); }
      if (Date.now() - startedAt > OBSERVE_MS) { if (obs) obs.disconnect(); clearInterval(iv); }
    }, 250);
    /* AdSense gets first claim */
    if (ins) { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {} }
    setTimeout(function () {
      if (resolved || adsenseFilled(ins)) { resolved = true; el.setAttribute('data-hero-resolved', 'adsense'); return; } /* a filled AdSense unit wins and stays */
      /* Unfilled at the watchdog: the AdSense unit leaves the stage (so a late
         fill can never displace the backfill) and Adsterra loads through the
         shared serialized queue with this site's own keys. If Adsterra also
         fails, the floor promo simply stays. */
      if (ins && ins.parentNode) ins.parentNode.removeChild(ins);
      ins = null;
      var fill = document.createElement('div');
      fill.className = 'nn-hero-fill';
      fill.setAttribute('data-k728', el.getAttribute('data-k728') || '');
      fill.setAttribute('data-k320', el.getAttribute('data-k320') || '');
      stage.appendChild(fill);
      pick(fill);
      nnEnqueue(fill, null, false);
      el.setAttribute('data-hero-resolved', 'backfill');
    }, HERO_WATCHDOG_MS);
  }

  function init() {
    var slots = document.querySelectorAll('.nn-ad');
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].hasAttribute('data-hero-seat')) { heroChain(slots[i]); continue; } /* NN-HERO-SEAT: AdSense-first chain, not the plain Adsterra queue */
      if (slots[i].hasAttribute('data-k728')) pick(slots[i]);
      nnEnqueue(slots[i], null, false); /* serialized by the shared lock, in DOM order */
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
