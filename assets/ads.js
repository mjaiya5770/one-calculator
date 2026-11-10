/* One Calculator — Adsterra banner loader: serialized seat queue +
   non-destructive fill watchdog (NN-ADS-V2 standard). Adsterra website
   registration for onecalculator.site is PENDING — until real keys are
   issued, every seat carries the zero key and the watchdog paints the
   house promo. AdSense loader is live on every page. */
/* NN-ADS-V2: seats load one at a time (queue) so concurrent invokes cannot race on the shared atOptions global;
   the house fallback waits ~30s and never wipes a seat — a MutationObserver lets a late real iframe replace the promo. */
(function () {
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
    if (!ins) return false;
    if (ins.getAttribute('data-ad-status') === 'filled') return true;
    var f = ins.querySelector('iframe');
    return !!(f && (f.offsetHeight > 0 || f.clientHeight > 0));
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
    /* a real iframe anywhere in the stage always displaces the floor promo */
    function sweep() {
      if (!stage.querySelector('iframe')) return;
      var fh = floorHouse();
      if (fh) fh.parentNode.removeChild(fh);
    }
    var obs = null;
    if (window.MutationObserver) {
      obs = new MutationObserver(sweep);
      obs.observe(stage, { childList: true, subtree: true });
    }
    var iv = setInterval(function () {
      sweep();
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
