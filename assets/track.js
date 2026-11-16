/* NN-APP-MODE (Nov 9, 2026 — muni app build direction): the installed-app
   experience is TOOL-PLATFORM ONLY. When the site runs as an installed app
   (standalone display mode), the homepage forwards straight to the
   calculator library, so the app always opens on the tools. Display layer
   only: keyed off the app context — never the user agent, never
   server-side — and double-gated, so a normal browser or crawler can never
   be redirected. The matching chrome rules live in assets/style.css under
   @media (display-mode: standalone). */
(function () {
  try {
    var standalone = (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
    if (!standalone) return;
    var p = window.location.pathname;
    if (p === '/' || p === '/index.html' || p.slice(-11) === '/index.html') {
      window.location.replace('/calculators.html');
    }
  } catch (e) { /* app mode is an enhancement — never break the page */ }
})();

/* One Calculator — first-party analytics beacon (no third-party trackers) */
(function () {
  if (location.pathname.indexOf('/admin') === 0) return;
  var EP = 'https://numbernest.site/api/track';
  function sid() {
    try {
      var s = sessionStorage.getItem('nn_sid');
      if (!s) { s = 's' + Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('nn_sid', s); }
      return s;
    } catch (e) { if (!window.__nnMemSid) window.__nnMemSid = 's' + Math.random().toString(36).slice(2) + Date.now().toString(36); return window.__nnMemSid; } /* NN-AUDIT: per-visitor in-memory id, never a shared constant */
  }
  function uaClass() {
    var w = Math.min(window.innerWidth || 9999, screen.width || 9999);
    if (/Mobi|Android|iPhone/i.test(navigator.userAgent) || w < 640) return 'mobile';
    if (/iPad|Tablet/i.test(navigator.userAgent) || w < 1024) return 'tablet';
    return 'desktop';
  }
  var base = { host: location.hostname, path: location.pathname, session: sid(), referrer: (function () { try { return document.referrer ? new URL(document.referrer).origin : ''; } catch (e) { return ''; } })(), /* NN-AUDIT: origin only, never full URLs/queries */ ua: uaClass() };
  function send(type, extra) {
    var payload = Object.assign({}, base, { type: type }, extra || {});
    var body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      try { if (navigator.sendBeacon(EP, new Blob([body], { type: 'application/json' }))) return; } catch (e) {} /* NN-AUDIT: a false return now falls through to fetch */
    }
    fetch(EP, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
  }
  send('pageview');
  /* NN-AUDIT (Nov 15, 2026): dwell counts VISIBLE time only — hidden intervals are
     accumulated out, and a repeated final send of the same value is suppressed. */
  var dwellAccum = 0, visSince = document.visibilityState === 'visible' ? Date.now() : null, lastSent = 0;
  function dwell(final) {
    var s = Math.round(dwellAccum + (visSince ? (Date.now() - visSince) / 1000 : 0));
    if (s < 5 || s === lastSent) return;
    if (!final && s - lastSent < 15) return;
    lastSent = s; send('dwell', { dwell: s });
  }
  setInterval(function () { if (document.visibilityState === 'visible') dwell(false); }, 15000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      if (visSince) { dwellAccum += (Date.now() - visSince) / 1000; visSince = null; }
      dwell(true);
    } else { visSince = Date.now(); }
  });
  window.addEventListener('pagehide', function () {
    if (visSince) { dwellAccum += (Date.now() - visSince) / 1000; visSince = null; }
    dwell(true);
  });
  /* calculator use: interaction + results visible */
  var lastCalc = 0;
  function maybeCalc() {
    var now = Date.now();
    if (now - lastCalc < 5000) return;
    var r = document.getElementById('results');
    var used = false;
    if (r) {
      var cs = window.getComputedStyle(r);
      if (r.classList.contains('show') || (cs.display !== 'none' && r.offsetParent !== null && r.textContent.trim().length > 0)) used = true;
    }
    if (used) { lastCalc = now; send('calc'); }
  }
  /* NN-AUDIT (Nov 15, 2026): only interactions INSIDE the calculator card can signal
     a calculation — print/share/save buttons (outside the card) no longer inflate uses. */
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.nn-calc-card')) setTimeout(maybeCalc, 350);
  });
  document.addEventListener('change', function (e) {
    if (e.target && e.target.closest && !e.target.closest('.nn-calc-card')) return;
    setTimeout(maybeCalc, 350);
  });
  /* NN-MODAL: interstitial open/close events from nn-tools.js land on the same beacon */
  window.__nnTrack = send;
})();

/* PWA: register the service worker (installable app + offline shell). */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
