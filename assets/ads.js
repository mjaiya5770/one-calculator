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
    primeChain(job.el, function () {
      job.done();
      var nxt = nnPending.shift();
      if (nxt) nnRunJob(nxt); else nnLockBusy = false;
    });
  }
  window.__nnLoadSeat = function (el, done) { el.setAttribute('data-prime-slot', PRIME_SLOT_MODAL); nnEnqueue(el, done, false); }; /* NN-PRIME-CHAIN: fresh single-seat loads are the modal seat — interstitial unit */ /* NN-MODAL: fresh single-seat loads (result interstitial) reuse this loader */
  window.__nnLoadSeatPriority = function (el, done) { el.setAttribute('data-prime-slot', PRIME_SLOT_MODAL); nnEnqueue(el, done, true); }; /* NN-PRIME-CHAIN: modal seat — interstitial unit */
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


  /* NN-PRIME-CHAIN (Nov 12, 2026 — AdSense-prime law): every impression seat
     on this site is AdSense-FIRST by construction, Adsterra strictly backfill,
     house floor last. Per seat: (1) the watchdog starts first, so the house
     floor timing is IDENTICAL to the pre-chain loader and a filled AdSense
     iframe displaces the floor promo via the existing promote(); (2) the
     seat's AdSense unit is inserted in normal flow inside the seat (never a
     fixed-height stage) and pushed ONCE — pushes ride the same serialized
     queue as every other load, so seats never race; (3) a ~3s watchdog (the
     Nov 9 hero-chain pattern, generalized) checks the fill: a filled unit is
     TERMINAL — Adsterra never loads into the seat; (4) unfilled at the
     watchdog — including today's pre-approval reality, where the sites are
     still "Getting ready" and AdSense serves nothing — the unit is removed
     (a late fill can never displace the backfill) and the seat runs the
     EXISTING Adsterra path below, unchanged. */
  var PRIME_CLIENT = 'ca-pub-8058544460943611';
  var PRIME_SLOT_CONTENT = '9510565953'; /* AdSense in-content unit, account-level (Display, Responsive) — page seats */
  var PRIME_SLOT_MODAL = '6485781513';   /* AdSense interstitial unit, account-level (Display, Responsive) — the NN-MODAL seat */
  var PRIME_WATCHDOG_MS = 3000;          /* AdSense fill check before the Adsterra backfill */

  function primeFilled(ins) {
    if (!ins) return false;
    if (ins.getAttribute && ins.getAttribute('data-ad-status') === 'filled') return true;
    var f = ins.querySelector ? ins.querySelector('iframe') : null;
    return !!(f && (f.offsetHeight > 0 || f.clientHeight > 0));
  }

  function primeChain(el, done) {
    var startedAt = Date.now();
    el.setAttribute('data-watching', '1');
    watchSeat(el, startedAt); /* floor + promote machinery from t=0, exactly as the pre-chain loader started it inside loadBanner */
    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.setAttribute('style', 'display:block');
    ins.setAttribute('data-ad-client', PRIME_CLIENT);
    ins.setAttribute('data-ad-slot', el.getAttribute('data-prime-slot') || PRIME_SLOT_CONTENT);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    el.appendChild(ins);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    var settled = false;
    function resolveAdsense() {
      settled = true;
      el.setAttribute('data-prime-resolved', 'adsense');
      clearInterval(iv);
      done(); /* a filled AdSense unit is terminal: no Adsterra invoke, ever */
    }
    var iv = setInterval(function () {
      if (!settled && primeFilled(ins)) resolveAdsense();
    }, 250);
    setTimeout(function () {
      if (settled) return;
      if (primeFilled(ins)) { resolveAdsense(); return; }
      settled = true;
      clearInterval(iv);
      try { if (ins.parentNode) ins.parentNode.removeChild(ins); } catch (e) {}
      el.setAttribute('data-prime-resolved', 'backfill');
      loadBanner(el, done); /* the existing Adsterra path, unchanged — house floor last */
    }, PRIME_WATCHDOG_MS);
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
    if (!key || !w || !h || el.getAttribute('data-loaded')) { if (!el.getAttribute('data-watching')) { el.setAttribute('data-watching', '1'); watchSeat(el, Date.now()); } done(); return; } /* NN-PRIME-CHAIN: watchdog may already run */ /* NN-KEYLESS-WATCHDOG: a keyless seat still gets the house fallback — never a blank seat */
    el.setAttribute('data-loaded', '1');
    var startedAt = Date.now();
    var s1 = document.createElement('script');
    s1.textContent = "atOptions = {'key':'" + key + "','format':'iframe','height':" + h + ",'width':" + w + ",'params':{}};";
    el.appendChild(s1);
    var s2 = document.createElement('script');
    s2.src = HOST + key; s2.async = false;
    el.appendChild(s2);
    if (!el.getAttribute('data-watching')) { el.setAttribute('data-watching', '1'); watchSeat(el, startedAt); } /* NN-PRIME-CHAIN: primeChain pre-started this seat's watchdog — never double-watch */
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
    var w = wide ? '728' : '320', h = wide ? '90' : '50';
    /* NN-TRAILING-SEAT (Nov 10, 2026): footer-position seats carry the
       data-k300/data-k320 pair instead of data-k728 — wide screens resolve
       the site's 300x250, phones keep the 320x50. Before this, the
       homepage trailing seat had no key attributes at all and could only
       ever paint the house promo. */
    if (!key && wide) { key = el.getAttribute('data-k300'); if (key) { w = '300'; h = '250'; } }
    if (key) { el.setAttribute('data-key', key); el.setAttribute('data-w', w); el.setAttribute('data-h', h); }
  }


  function init() {
    var slots = document.querySelectorAll('.nn-ad');
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].hasAttribute('data-k728') || slots[i].hasAttribute('data-k300')) pick(slots[i]);
      nnEnqueue(slots[i], null, false); /* serialized by the shared lock, in DOM order */
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
