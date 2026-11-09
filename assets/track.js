/* One Calculator — first-party analytics beacon (no third-party trackers) */
(function () {
  if (location.pathname.indexOf('/admin') === 0) return;
  var EP = 'https://numbernest.site/api/track';
  function sid() {
    try {
      var s = sessionStorage.getItem('nn_sid');
      if (!s) { s = 's' + Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('nn_sid', s); }
      return s;
    } catch (e) { return 'nostore'; }
  }
  function uaClass() {
    var w = Math.min(window.innerWidth || 9999, screen.width || 9999);
    if (/Mobi|Android|iPhone/i.test(navigator.userAgent) || w < 640) return 'mobile';
    if (/iPad|Tablet/i.test(navigator.userAgent) || w < 1024) return 'tablet';
    return 'desktop';
  }
  var base = { host: location.hostname, path: location.pathname, session: sid(), referrer: document.referrer || '', ua: uaClass() };
  function send(type, extra) {
    var payload = Object.assign({}, base, { type: type }, extra || {});
    var body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      try { navigator.sendBeacon(EP, new Blob([body], { type: 'application/json' })); return; } catch (e) {}
    }
    fetch(EP, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
  }
  send('pageview');
  var t0 = Date.now(), lastSent = 0;
  function dwell(final) {
    var s = Math.round((Date.now() - t0) / 1000);
    if (s >= 5 && (final || s - lastSent >= 15)) { lastSent = s; send('dwell', { dwell: s }); }
  }
  setInterval(function () { if (document.visibilityState === 'visible') dwell(false); }, 15000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') dwell(true); });
  window.addEventListener('pagehide', function () { dwell(true); });
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
  document.addEventListener('click', function (e) {
    if (e.target.closest && (e.target.closest('.btn') || e.target.closest('button'))) setTimeout(maybeCalc, 350);
  });
  document.addEventListener('change', function () { setTimeout(maybeCalc, 350); });
  /* NN-MODAL: interstitial open/close events from nn-tools.js land on the same beacon */
  window.__nnTrack = send;
})();

/* PWA: register the service worker (installable app + offline shell). */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
