/* Shared tool actions + effects for the calculator network — loaded by every tool page and homepage.
   Features: shareable result links (inputs in the URL), copy result, saved calculations
   (localStorage, no account), print / save-as-PDF, count-up results, verdict pulse, confetti on save.
   No external requests. Brand-neutral: colors come from each site's CSS variables.
   NN-SHELL-P1 build (R1 rollout build, + NN-EFFECTS-P1): adds the NN-SHELL-P1
   section (stale-state contract, result anatomy, sticky result strip). The PURE block,
   the print markers and the NN-MODAL logic are unchanged from the fleet canonical. */
(function () {
  'use strict';

  /*PURE-BEGIN*/
  function nnFieldParams(fields) {
    var out = {};
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (!f || !f.id || f.skip) continue;
      if (f.type === 'radio') { if (f.checked) out[f.id] = String(f.value); }
      else if (f.type === 'checkbox') { out[f.id] = f.checked ? '1' : '0'; }
      else { out[f.id] = String(f.value == null ? '' : f.value); }
    }
    return out;
  }
  function nnQueryString(params) {
    var parts = [];
    for (var k in params) {
      if (Object.prototype.hasOwnProperty.call(params, k)) {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
      }
    }
    return parts.join('&');
  }
  function nnParseQuery(search) {
    var out = {};
    if (!search) return out;
    var s = search.charAt(0) === '?' ? search.slice(1) : search;
    if (!s) return out;
    var pairs = s.split('&');
    for (var i = 0; i < pairs.length; i++) {
      if (!pairs[i]) continue;
      var eq = pairs[i].indexOf('=');
      var k = eq >= 0 ? pairs[i].slice(0, eq) : pairs[i];
      var v = eq >= 0 ? pairs[i].slice(eq + 1) : '';
      try { out[decodeURIComponent(k.replace(/\+/g, ' '))] = decodeURIComponent(v.replace(/\+/g, ' ')); }
      catch (e) { out[k] = v; }
    }
    return out;
  }
  function nnRestoreList(params, fields) {
    var ops = [];
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (!f || !f.id || f.skip) continue;
      if (!Object.prototype.hasOwnProperty.call(params, f.id)) continue;
      if (f.type === 'checkbox') { ops.push({ id: f.id, kind: 'checked', checked: params[f.id] === '1' }); }
      else if (f.type === 'radio') { ops.push({ id: f.id, kind: 'checked', checked: String(f.value) === params[f.id] }); }
      else { ops.push({ id: f.id, kind: 'value', value: params[f.id] }); }
    }
    return ops;
  }
  function nnParseBig(text) {
    if (!text) return null;
    var matches = String(text).match(/-?\d[\d,]*(\.\d+)?/g);
    if (!matches || matches.length !== 1) return null;
    var m = matches[0];
    var idx = String(text).indexOf(m);
    var raw = m.replace(/,/g, '');
    var num = parseFloat(raw);
    if (!isFinite(num)) return null;
    var dec = raw.indexOf('.') >= 0 ? raw.split('.')[1].length : 0;
    return {
      prefix: String(text).slice(0, idx),
      suffix: String(text).slice(idx + m.length),
      num: num, decimals: dec, grouped: m.indexOf(',') >= 0
    };
  }
  function nnFormatNum(num, spec) {
    var body;
    if (!spec.grouped && spec.decimals === 0) { body = String(Math.round(num)); }
    else {
      body = num.toLocaleString('en-US', {
        minimumFractionDigits: spec.decimals,
        maximumFractionDigits: spec.decimals
      });
    }
    return spec.prefix + body + spec.suffix;
  }
  function nnComposeResult(title, verdict, big, rows, stats) {
    var lines = [];
    if (title) lines.push(title);
    if (verdict) lines.push(verdict);
    if (big) lines.push(big);
    var i;
    if (rows) for (i = 0; i < rows.length; i++) lines.push(rows[i][0] + ': ' + rows[i][1]);
    if (stats) for (i = 0; i < stats.length; i++) lines.push(stats[i][0] + ': ' + stats[i][1]);
    return lines.join('\n');
  }
  /*PURE-END*/

  var LS_KEY = 'nnSavesV1';
  var LS_CAP = 50;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- field collection / serialize / restore ---------- */
  function collectFields() {
    var els = $all('main input[id], main select[id], main textarea[id]');
    return els.map(function (el) {
      var tag = el.tagName;
      var skip = (tag === 'INPUT' && el.readOnly) ||
        (el.type === 'file' || el.type === 'submit' || el.type === 'button' || el.type === 'hidden') ||
        !!el.closest('.nn-actions, .nn-saves');
      return {
        id: el.id, tag: tag, type: (el.type || '').toLowerCase(),
        value: el.value, checked: !!el.checked, skip: skip, el: el
      };
    });
  }

  var lastMode = null;
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-mode]');
    if (b) lastMode = b.getAttribute('data-mode');
  }, true);

  function getMode() {
    var panels = $all('.mode-panel');
    for (var i = 0; i < panels.length; i++) {
      if (panels[i].style.display !== 'none' && panels[i].offsetParent !== null) {
        return panels[i].id.replace(/^panel-/, '') || null;
      }
    }
    return lastMode;
  }

  function currentParams() {
    var params = nnFieldParams(collectFields());
    var mode = getMode();
    if (mode) params.__mode = mode;
    return params;
  }

  function shareUrl(params) {
    var qs = nnQueryString(params || currentParams());
    return location.origin + location.pathname + (qs ? '?' + qs : '');
  }

  function fireEvents(el) {
    ['input', 'change'].forEach(function (type) {
      var ev;
      try { ev = new Event(type, { bubbles: true }); }
      catch (e) { ev = document.createEvent('Event'); ev.initEvent(type, true, false); }
      el.dispatchEvent(ev);
    });
  }

  function triggerCalc() {
    var names = ['calc', 'calculate', 'compute', 'count', 'generate', 'update'];
    for (var i = 0; i < names.length; i++) {
      if (typeof window[names[i]] === 'function') {
        try { window[names[i]](); } catch (e) {}
        return;
      }
    }
  }

  function restoreFromObject(params) {
    if (!params) return false;
    if (params.__mode) {
      var m = params.__mode;
      if (typeof window.setMode === 'function') { try { window.setMode(m); } catch (e) {} }
      else {
        var btn = document.querySelector('[data-mode="' + m + '"]');
        if (btn) btn.click();
      }
    }
    var fields = collectFields();
    var ops = nnRestoreList(params, fields);
    if (!ops.length && !params.__mode) return false;
    var byId = {};
    fields.forEach(function (f) { byId[f.id] = f.el; });
    var touched = [];
    ops.forEach(function (op) {
      var el = byId[op.id];
      if (!el) return;
      if (op.kind === 'checked') { el.checked = op.checked; }
      else { el.value = op.value; }
      touched.push(el);
    });
    touched.forEach(fireEvents);
    /* NN-SHELL-P1: a restored value inside a collapsed disclosure opens it,
       so restored state is never hidden (POLISH-SPEC §4 disclosure rule). */
    touched.forEach(function (el) {
      var d = el.closest && el.closest('details');
      if (d && !d.open) d.open = true;
    });
    triggerCalc();
    return true;
  }

  /* ---------- result extraction (copy / save) ---------- */
  function toolTitle() {
    var h = $('h1.tool-title') || $('h1');
    if (h && h.textContent.trim()) return h.textContent.trim();
    return document.title.split('|')[0].trim();
  }

  function extractResult() {
    var verdict = '';
    var vel = $('#verdict');
    if (vel) verdict = vel.textContent.trim();
    var big = '';
    var bigEl = $('.results .big');
    if (bigEl) big = bigEl.textContent.trim();
    var rows = [];
    $all('.results table tr').forEach(function (tr) {
      var tds = tr.querySelectorAll('td');
      if (tds.length >= 2) {
        var k = tds[0].textContent.trim(), v = tds[1].textContent.trim();
        if (k && v) rows.push([k, v]);
      }
    });
    var stats = [];
    $all('.stat-grid .stat').forEach(function (st) {
      var k = st.querySelector('.k'), v = st.querySelector('.v');
      if (k && v) stats.push([k.textContent.trim(), v.textContent.trim()]);
    });
    if (!big && !rows.length && !stats.length) {
      var pw = $('#pwout');
      if (pw && pw.value) stats.push(['Password', pw.value]);
    }
    var text = nnComposeResult(toolTitle(), verdict, big, rows, stats);
    var snippet = verdict || big || (rows.length ? rows[0][0] + ': ' + rows[0][1] : '') ||
      (stats.length ? stats[0][0] + ': ' + stats[0][1] : '');
    return { text: text, snippet: snippet };
  }

  /* ---------- clipboard ---------- */
  function copyText(text, btn) {
    function done() {
      if (!btn) return;
      var old = btn.getAttribute('data-label') || btn.textContent;
      btn.setAttribute('data-label', old);
      btn.textContent = '✓ Copied';
      setTimeout(function () { btn.textContent = old; }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      done();
    }
  }

  /* ---------- saved calculations (localStorage, no account) ---------- */
  function loadSaves() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function storeSaves(arr) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(0, LS_CAP))); } catch (e) {}
  }
  function fmtDate(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  function saveCurrent(btn) {
    var res = extractResult();
    var saves = loadSaves();
    saves.unshift({
      tool: location.pathname,
      title: toolTitle(),
      ts: Date.now(),
      inputs: currentParams(),
      result: res.text,
      snippet: res.snippet
    });
    storeSaves(saves);
    renderToolSaves();
    renderHomeSaves();
    if (btn) {
      var old = btn.getAttribute('data-label') || btn.textContent;
      btn.setAttribute('data-label', old);
      btn.textContent = '✓ Saved';
      setTimeout(function () { btn.textContent = old; }, 1600);
    }
    nnConfetti();
  }
  function renderToolSaves() {
    var panel = $('#nnSavesPanel');
    if (!panel) return;
    var mine = loadSaves().map(function (s, i) { return { s: s, i: i }; })
      .filter(function (x) { return x.s.tool === location.pathname; });
    if (!mine.length) { panel.hidden = true; panel.innerHTML = ''; return; }
    panel.hidden = false;
    panel.innerHTML = '<div class="nn-saves-h">💾 Saved on this calculator</div>' + mine.map(function (x) {
      return '<div class="nn-save-item"><div class="nn-save-meta"><strong>' +
        escapeHtml(x.s.snippet || x.s.title) + '</strong><span>' + fmtDate(x.s.ts) + '</span></div>' +
        '<div class="nn-save-btns"><button type="button" class="nn-mini" data-nn-load="' + x.i + '">Load</button>' +
        '<button type="button" class="nn-mini" data-nn-del="' + x.i + '">Delete</button></div></div>';
    }).join('');
  }
  function renderHomeSaves() {
    var list = $('#nnSavedList');
    if (!list) return;
    var saves = loadSaves();
    if (!saves.length) {
      list.innerHTML = '<p style="color:var(--muted)">No saved calculations yet — open any calculator and hit “Save this calculation”. They’ll show up here, no account needed.</p>';
      return;
    }
    list.innerHTML = saves.map(function (s, i) {
      var href = s.tool + '?' + nnQueryString(s.inputs || {});
      return '<div class="nn-save-item"><div class="nn-save-meta"><strong>' +
        escapeHtml(s.title) + '</strong><span>' + escapeHtml(s.snippet || '') + ' · ' + fmtDate(s.ts) + '</span></div>' +
        '<div class="nn-save-btns"><a class="nn-mini" href="' + href + '">Open</a>' +
        '<button type="button" class="nn-mini" data-nn-del="' + i + '">Delete</button></div></div>';
    }).join('');
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- confetti (tiny, self-drawn; fires on Save) ---------- */
  function nnConfetti() {
    if (reducedMotion) return;
    try {
      var cs = getComputedStyle(document.documentElement);
      var colors = [
        (cs.getPropertyValue('--gold') || '').trim() || '#ffc93c',
        (cs.getPropertyValue('--amber') || '').trim() || '#f5a623',
        (cs.getPropertyValue('--teal') || '').trim() || '#0d5c56',
        (cs.getPropertyValue('--accent') || '').trim() || '#0d5c56'
      ];
      var canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
      canvas.width = window.innerWidth; canvas.height = window.innerHeight;
      document.body.appendChild(canvas);
      var ctx = canvas.getContext('2d');
      var parts = [];
      for (var i = 0; i < 70; i++) {
        parts.push({
          x: canvas.width / 2 + (Math.random() - 0.5) * canvas.width * 0.4,
          y: canvas.height * 0.35,
          vx: (Math.random() - 0.5) * 9,
          vy: -(Math.random() * 8 + 4),
          w: Math.random() * 7 + 4, h: Math.random() * 4 + 3,
          rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.25,
          color: colors[i % colors.length]
        });
      }
      var t0 = null;
      function frame(ts) {
        if (!t0) t0 = ts;
        var t = (ts - t0) / 1000;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        var alive = false;
        parts.forEach(function (p) {
          p.vy += 16 * 0.016; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
          if (p.y < canvas.height + 20 && t < 1.6) alive = true;
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.globalAlpha = Math.max(0, 1 - t / 1.6);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        });
        if (alive) { requestAnimationFrame(frame); }
        else { canvas.remove(); }
      }
      requestAnimationFrame(frame);
      setTimeout(function () { if (canvas.parentNode) canvas.remove(); }, 2500);
    } catch (e) {}
  }

  /* ---------- count-up on the main result number ---------- */
  function animateBig(el, fromSpec, toSpec, finalText) {
    if (reducedMotion) return;
    if (el._nnRaf) cancelAnimationFrame(el._nnRaf);
    var dur = 550, t0 = null;
    el._nnAnim = true;
    function frame(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = fromSpec.num + (toSpec.num - fromSpec.num) * eased;
      el.textContent = nnFormatNum(val, toSpec);
      if (p < 1) { el._nnRaf = requestAnimationFrame(frame); }
      else {
        el.textContent = finalText;
        el._nnAnim = false; el._nnRaf = null; el._nnLast = finalText;
      }
    }
    el._nnRaf = requestAnimationFrame(frame);
  }
  function watchBig(el) {
    el._nnLast = el.textContent;
    var obs = new MutationObserver(function () {
      if (el._nnAnim) return;
      var now = el.textContent;
      var prev = el._nnLast;
      if (now === prev) return;
      el._nnLast = now;
      var toSpec = nnParseBig(now);
      if (!toSpec) return;
      var fromSpec = nnParseBig(prev) || { num: 0 };
      if (fromSpec.num === toSpec.num) return;
      animateBig(el, fromSpec, toSpec, now);
      nnMaybeModal(); /* NN-MODAL: first fresh result of the page view */
    });
    obs.observe(el, { childList: true, characterData: true, subtree: true });
  }

  /* ---------- verdict pulse when results first show ---------- */
  function watchResults(el) {
    function pulse() {
      if (el._nnPulsed) return;
      if (!el.classList.contains('show')) return;
      el._nnPulsed = true;
      nnMaybeModal(); /* NN-MODAL: first fresh result (stat-grid / no-big tools) */
      var target = el.querySelector('#verdict') || el.querySelector('.big');
      if (target && !reducedMotion) {
        target.classList.add('nn-pulse');
        setTimeout(function () { target.classList.remove('nn-pulse'); }, 950);
      }
    }
    var obs = new MutationObserver(pulse);
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    pulse();
  }

  /* ---------- result interstitial (NN-MODAL): the calculate moment ----------
     Fires ONCE per page view on the first FRESH result that follows a genuine
     user interaction with the calculator (Calculate click, Enter-submit, or a
     field edit that recalcs). The page's initial auto-calc on load must NEVER
     fire it: the trigger stays disarmed until the first interaction, so the
     load-time render is ignored (nnUserArmed). Never on share-link restore
     (nnRestoredLink), never in embed mode, never on print. Results render
     behind the modal immediately — the close (x) works from the first frame,
     a pulsing "Your result is ready" bar dismisses on tap, and a 20s timer
     auto-dismisses: the result is always one tap away. The 300x250 seat loads
     FRESH at open time, with priority in the serialized ads queue and a short
     6s house-promo watchdog, so the seat never opens blank. */
  var nnModalFired = false;
  var nnRestoredLink = false;
  var nnModalKey = '';
  /* NN-MODAL arming: only a real user interaction with the calculator arms the
     trigger. Capture-phase listeners run before the page's own calc handlers,
     and MutationObserver callbacks (which call nnMaybeModal) are microtasks
     that run after the event dispatch — so by the time a user-triggered recalc
     renders, the trigger is armed; the load-time auto-calc never arms it. */
  var nnUserArmed = false;
  function nnArmModal() { nnUserArmed = true; }
  document.addEventListener('input', nnArmModal, true);
  document.addEventListener('change', nnArmModal, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName || '')) nnArmModal();
  }, true);
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var btn = t.closest('button');
    if (!btn || btn.hasAttribute('data-nn') || !btn.closest('.nn-calc-card')) return;
    nnArmModal();
    /* A Calculate click whose inputs did not change produces no DOM mutation,
       so the watchers never call nnMaybeModal. Retry once on the next tick —
       after the button's own calc() has run — if a real result is shown. */
    setTimeout(function () { if (nnResultShown()) nnMaybeModal(); }, 0);
  }, true);
  function nnResultShown() {
    var r = document.querySelector('.results.show');
    if (r) {
      var b = r.querySelector('.big');
      if (!b) return true;
      var t = (b.textContent || '').replace(/\s+/g, ' ').trim();
      return !!t && t !== '—';
    }
    return !!document.querySelector('.stat-grid');
  }
  function nnSiteAdKey(kind) {
    /* NN-MODAL-FIT2: for the 300x250 key, match the seat by its STATIC size
       attributes (data-w/data-h exist in markup only on the genuine fixed
       300x250 seats). NEVER match on [data-key] alone: ads.js pick() writes a
       runtime data-key (the 728x90 key on desktop, 320x50 on mobile) onto the
       responsive top seat — which precedes the 300 seats in DOM order — so a
       [data-key] query captured the LEADERBOARD key and the modal seat filled
       with a 728-wide creative that clipped at the right edge (live, Nov 6). */
    var seat = document.querySelector(kind === '300' ? '.nn-ad[data-w="300"][data-h="250"]' : '.nn-ad[data-k728]');
    if (!seat) return '';
    return kind === '300' ? (seat.getAttribute('data-key') || '') : (seat.getAttribute('data-k728') || '');
  }
  function nnTrackEvt(type) {
    try { if (typeof window.__nnTrack === 'function') window.__nnTrack(type); } catch (e) {}
  }
  function nnCloseModal(overlay, why) {
    if (!overlay || overlay._nnClosed) return;
    overlay._nnClosed = true;
    if (overlay._nnTimer) clearTimeout(overlay._nnTimer);
    if (overlay._nnSizer) clearInterval(overlay._nnSizer);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    nnTrackEvt('ad_modal_close');
  }
  function nnSizeModalFrame(seat, overlay) {
    /* NN-MODAL-FIT2 sizer: second line of defense — if the network ever
       answers with a frame larger than the 300x250 seat (any cause), scale
       the WHOLE frame down to fit: complete creative visible, undistorted,
       nothing cropped on either side. Intrinsic size comes from the frame's
       width/height attributes (its layout size before any transform), never
       from the already-scaled box. Re-checks until the modal closes so a
       late-swapped frame is sized too. */
    var sizedFor = null;
    var iv = setInterval(function () {
      if (overlay._nnClosed) { clearInterval(iv); return; }
      var f = seat.querySelector('iframe');
      if (!f || f === sizedFor) return;
      var w = parseInt(f.getAttribute('width'), 10) || f.offsetWidth || 0;
      var h = parseInt(f.getAttribute('height'), 10) || f.offsetHeight || 0;
      if (!w || !h) return;
      if (w > 300 || h > 250) {
        var s = Math.min(300 / w, 250 / h);
        f.style.transform = 'translateX(-50%) scale(' + s + ')';
        f.style.transformOrigin = 'center top';
      }
      sizedFor = f;
    }, 400);
    return iv;
  }
  function nnOpenModal() {
    var key = nnSiteAdKey('300') || nnModalKey; /* NN-MODAL-FIT2: re-derive fresh at open via the corrected selector; init capture is only a fallback */
    if (!key || (typeof window.__nnLoadSeat !== 'function' && typeof window.__nnLoadSeatPriority !== 'function')) return;
    var brandEl = document.querySelector('.brand');
    var brand = brandEl ? brandEl.textContent.replace(/\s+/g, ' ').trim() : 'Calculator';
    var toolEl = document.querySelector('.tool-title') || document.querySelector('h1');
    var tool = toolEl ? toolEl.textContent.replace(/\s+/g, ' ').trim() : 'Your result';
    var overlay = document.createElement('div');
    overlay.className = 'nn-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Advertisement');
    var box = document.createElement('div');
    box.className = 'nn-modal';
    var brandP = document.createElement('p');
    brandP.className = 'nn-modal-brand';
    brandP.textContent = brand;
    var subP = document.createElement('p');
    subP.className = 'nn-modal-sub';
    subP.textContent = tool + ' — done. Your result is below.';
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'nn-modal-x';
    x.setAttribute('aria-label', 'Close and see your result');
    x.textContent = '×';
    var seat = document.createElement('div');
    seat.className = 'nn-ad nn-ad-modal';
    seat.setAttribute('data-key', key);
    seat.setAttribute('data-w', '300');
    seat.setAttribute('data-h', '250');
    seat.setAttribute('data-watchdog', '6000'); /* NN-MODAL: house promo paints within the modal's lifetime, never a blank seat */
    var label = document.createElement('div');
    label.className = 'nn-ad-label';
    label.textContent = 'Advertisement';
    seat.appendChild(label);
    var ready = document.createElement('button');
    ready.type = 'button';
    ready.className = 'nn-modal-ready';
    ready.textContent = 'Your result is ready ↓';
    box.appendChild(x);
    box.appendChild(brandP);
    box.appendChild(subP);
    box.appendChild(seat);
    box.appendChild(ready);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    nnTrackEvt('ad_modal_open');
    if (typeof window.__nnLoadSeatPriority === 'function') window.__nnLoadSeatPriority(seat, function () {});
    else window.__nnLoadSeat(seat, function () {});
    overlay._nnSizer = nnSizeModalFrame(seat, overlay); /* NN-MODAL-FIT2: scale any oversized served frame to fit whole */
    x.addEventListener('click', function () { nnCloseModal(overlay, 'x'); });
    ready.addEventListener('click', function () { nnCloseModal(overlay, 'ready'); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) nnCloseModal(overlay, 'backdrop'); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { nnCloseModal(overlay, 'esc'); document.removeEventListener('keydown', esc); }
    });
    overlay._nnTimer = setTimeout(function () { nnCloseModal(overlay, 'auto'); }, 20000);
    window.addEventListener('beforeprint', function bp() { nnCloseModal(overlay, 'print'); window.removeEventListener('beforeprint', bp); });
  }
  function nnMaybeModal() {
    if (nnSuppressModalOnce) { nnSuppressModalOnce = false; return; } /* NN-SHELL-P1: silent recalc (print refresh) */
    if (nnModalFired || nnRestoredLink || !nnUserArmed || document.documentElement.classList.contains('nn-embed')) return;
    nnModalFired = true;
    nnOpenModal();
  }

  /* ---------- toolbar actions (delegated) ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var act = t.closest && t.closest('[data-nn]');
    if (act) {
      var kind = act.getAttribute('data-nn');
      /* NN-SHELL-P1 stale holds: never copy / share / save a stale result.
         Print is never blocked — it recalculates synchronously instead. */
      if (nnStale.active && (kind === 'copy' || kind === 'share' || kind === 'save')) {
        if (nnStale.line) {
          nnStale.line.classList.remove('nn-stale-flash');
          void nnStale.line.offsetWidth;
          nnStale.line.classList.add('nn-stale-flash');
          nnStale.line.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
        }
        return;
      }
      if (kind === 'print' && nnStale.active) {
        nnSuppressModalOnce = true;
        triggerCalc();
        nnStaleSyncFromRender();
        window.print();
        return;
      }
      if (kind === 'share') { copyText(shareUrl(), act); }
      else if (kind === 'copy') { copyText(extractResult().text, act); }
      else if (kind === 'save') { saveCurrent(act); }
      else if (kind === 'print') { window.print(); }
      return;
    }
    var load = t.closest && t.closest('[data-nn-load]');
    if (load) {
      var saves = loadSaves();
      var entry = saves[parseInt(load.getAttribute('data-nn-load'), 10)];
      if (entry) restoreFromObject(entry.inputs);
      return;
    }
    var del = t.closest && t.closest('[data-nn-del]');
    if (del) {
      var arr = loadSaves();
      arr.splice(parseInt(del.getAttribute('data-nn-del'), 10), 1);
      storeSaves(arr);
      renderToolSaves();
      renderHomeSaves();
    }
  });

  /* ---------- NN-SHELL-P1: supremacy pilot shell (the P1 pilot trees) ----------
     Stale-state contract (POLISH-SPEC §3/§4): once a result is on screen, an
     input change that has not re-rendered marks the result stale — a standing
     line above the result says so (never color alone), the calculate button
     becomes "Update results", and Copy link / Copy result / Save are held
     until the result is fresh. Print never ships a stale result: it
     recalculates synchronously first, without the interstitial. Live tools
     re-render on edit, so their snapshot syncs in the same tick and they
     never show the stale state. Also: the action bar moves BELOW the result
     (result anatomy, POLISH-SPEC §6), results get aria-live, numeric fields
     get inputmode, seg buttons get aria-pressed, an empty signature slot is
     mounted inside .results for the P2+ signature visuals, and a mobile
     sticky result strip follows the answer when it scrolls off-screen
     (suppressed while typing, with the keyboard open, in embed mode and in
     print — CSS). Tap-target sizes live in style.css (NN-SHELL-P1 block).
     Live-vs-commit policy: a card declaring data-update="live" hides its
     calculate button and recalcs debounced as the user types. */
  var nnSuppressModalOnce = false;
  var nnStale = { active: false, snap: null, line: null, region: null, btn: null, btnLabel: null, strip: null };
  var nnStripState = { regionVisible: true, kb: false, focusField: false };

  function nnResultRegion() {
    return document.querySelector('.results') || document.querySelector('.stat-grid');
  }
  function nnFindCalcBtn(scope) {
    if (!scope) return null;
    var btns = $all('button', scope);
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b.hasAttribute('data-nn') || b.closest('.nn-actions') || b.closest('.nn-saves') || b.classList.contains('seg-btn')) continue;
      var oc = (b.getAttribute('onclick') || '').trim();
      var tx = (b.textContent || '').trim();
      if (/^(calc|calculate|compute|count|generate|update)\s*\(/.test(oc) || /^(calculate|compute|generate|update results|recalculate)$/i.test(tx)) return b;
    }
    return null;
  }
  function nnSnapNow() {
    try { return JSON.stringify(currentParams()); } catch (e) { return null; }
  }
  function nnRegionAnswerText() {
    var r = nnStale.region;
    if (!r) return '';
    var v = r.querySelector('#verdict');
    if (v && v.textContent.trim()) return v.textContent.trim();
    var b = r.querySelector('.big');
    if (b && b.textContent.trim()) return b.textContent.trim();
    var st = r.querySelector('.stat .v');
    if (st) {
      var k = r.querySelector('.stat .k');
      return (k ? k.textContent.trim() + ': ' : '') + st.textContent.trim();
    }
    return '';
  }
  function nnStripSync() {
    var strip = nnStale.strip;
    if (!strip) return;
    var ans = nnStale.active ? 'Inputs changed — result out of date' : nnRegionAnswerText();
    var span = strip.querySelector('.nn-strip-answer');
    if (span && ans) span.textContent = ans;
    var btn = strip.querySelector('.nn-strip-btn');
    if (btn) btn.textContent = nnStale.active ? 'Update' : 'View result';
    nnStripVisibility();
  }
  function nnStripVisibility() {
    var strip = nnStale.strip;
    if (!strip) return;
    strip.hidden = nnStripState.regionVisible || nnStripState.kb || nnStripState.focusField || !nnResultShown();
  }
  function nnSetStale(on) {
    if (nnStale.active === on) { if (on) nnStripSync(); return; }
    nnStale.active = on;
    if (nnStale.line) nnStale.line.hidden = !on;
    if (nnStale.region) nnStale.region.classList.toggle('nn-is-stale', on);
    if (nnStale.btn) {
      if (on) {
        if (nnStale.btnLabel == null) nnStale.btnLabel = nnStale.btn.textContent;
        nnStale.btn.textContent = 'Update results';
      } else if (nnStale.btnLabel != null) {
        nnStale.btn.textContent = nnStale.btnLabel;
      }
    }
    nnStripSync();
  }
  function nnStaleSyncFromRender() {
    /* A result render just happened: the snapshot behind it is current. */
    nnStale.snap = nnSnapNow();
    if (nnStale.active) nnSetStale(false);
    nnStripSync();
  }
  function nnStaleCheck() {
    if (!nnStale.region || nnStale.snap == null) return;
    if (!nnResultShown()) return;
    var now = nnSnapNow();
    if (now != null && now !== nnStale.snap) nnSetStale(true);
    else if (now === nnStale.snap) nnSetStale(false);
  }
  function nnSegSync() {
    $all('.seg-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', b.classList.contains('is-on') ? 'true' : 'false');
    });
  }
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('.seg-btn')) nnSegSync();
  });
  function nnShellInit() {
    var region = nnResultRegion();
    var actions = $('.nn-actions');
    /* Result anatomy: the action bar sits BELOW the result (POLISH-SPEC §6). */
    if (actions && region && actions.parentNode === region.parentNode &&
        (actions.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      region.parentNode.insertBefore(actions, region.nextSibling);
    }
    /* inputmode on numeric fields (POLISH-SPEC §7). */
    $all('main input[type="number"]').forEach(function (el) {
      if (el.getAttribute('inputmode')) return;
      var st = el.getAttribute('step');
      el.setAttribute('inputmode', (st && st !== 'any' && String(st).indexOf('.') < 0) ? 'numeric' : 'decimal');
    });
    nnSegSync();
    if (!region) return;
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    /* Signature slot: P2+ waves mount each tool's signature visual here. */
    if (region.classList.contains('results') && !region.querySelector('.nn-signature')) {
      var sig = document.createElement('div');
      sig.className = 'nn-signature';
      sig.setAttribute('data-nn-signature', '');
      region.appendChild(sig);
    }
    nnStale.region = region;
    var card = region.closest('.nn-calc-card') || region.closest('.card') || document.querySelector('main');
    nnStale.btn = nnFindCalcBtn(card);
    var line = document.createElement('div');
    line.className = 'nn-stale-line no-print';
    line.setAttribute('role', 'status');
    line.hidden = true;
    line.textContent = nnStale.btn
      ? 'Inputs changed — this result is out of date. Press “Update results” to recalculate.'
      : 'Inputs changed — this result is out of date. Recalculate to update it.';
    region.parentNode.insertBefore(line, region);
    nnStale.line = line;
    if (nnResultShown()) nnStale.snap = nnSnapNow();
    var rObs = new MutationObserver(function () { nnStaleSyncFromRender(); });
    rObs.observe(region, { childList: true, characterData: true, subtree: true });
    document.addEventListener('input', function () { setTimeout(nnStaleCheck, 0); });
    document.addEventListener('change', function () { setTimeout(nnStaleCheck, 0); });
    if (nnStale.btn) {
      /* Explicit refresh intent: even if a tool renders outside the observed
         region, clicking its calculate button re-baselines the snapshot. */
      nnStale.btn.addEventListener('click', function () {
        setTimeout(function () { nnStale.snap = nnSnapNow(); nnSetStale(false); }, 0);
      });
    }
    /* Sticky result strip (mobile pattern; CSS hides it on wide screens). */
    if (!document.documentElement.classList.contains('nn-embed')) {
      var strip = document.createElement('div');
      strip.className = 'nn-strip no-print';
      strip.hidden = true;
      strip.innerHTML = '<span class="nn-strip-answer"></span><button type="button" class="nn-btn nn-strip-btn">View result</button>';
      document.body.appendChild(strip);
      nnStale.strip = strip;
      strip.querySelector('.nn-strip-btn').addEventListener('click', function () {
        if (nnStale.active && nnStale.btn) nnStale.btn.click();
        region.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      });
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          nnStripState.regionVisible = !!(entries[0] && entries[0].isIntersecting);
          nnStripVisibility();
        }, { threshold: 0.05 });
        io.observe(region);
      }
      document.addEventListener('focusin', function (e) {
        if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName || '')) nnStripState.focusField = true;
        nnStripVisibility();
      });
      document.addEventListener('focusout', function () {
        setTimeout(function () {
          var a = document.activeElement;
          nnStripState.focusField = !!(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName || ''));
          nnStripVisibility();
        }, 0);
      });
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', function () {
          nnStripState.kb = window.visualViewport.height < window.innerHeight * 0.75;
          nnStripVisibility();
        });
      }
      nnStripSync();
    }
    /* Print: never ship a stale result — recalc synchronously, no modal. */
    window.addEventListener('beforeprint', function () {
      if (!nnStale.active) return;
      nnSuppressModalOnce = true;
      triggerCalc();
      nnStaleSyncFromRender();
    });
    /* Live-update policy: a card declaring data-update="live" hides its
       calculate button and recalcs (debounced) as the user types. */
    $all('[data-update="live"]').forEach(function (liveCard) {
      var lb = nnFindCalcBtn(liveCard);
      if (lb) lb.classList.add('nn-live-hidden');
      var t = null;
      liveCard.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { triggerCalc(); }, 250);
      });
    });
  }

  /* ---------- NN-EFFECTS-P1: shell effects layer (R1 rollout build) ----------
     Presentation only — no math, no state: the final rendered text of every
     value is always the tool's own computed string (tweens end by writing the
     exact final text, print snaps any in-flight tween to it). Layers on top
     of the fleet's existing count-up (.results .big via watchBig) and the
     first-show verdict pulse:
       - result reveal: the panel fades/rises when a fresh result lands
         (hidden->shown transition, or a render that follows a button-style
         calculation rather than live typing);
       - headline tween for stat-grid tools (no .big): the first .stat .v
         counts up with the fleet's own animateBig/nnParseBig machinery;
       - milestone sparkle: a restrained CSS spark burst, at most once per
         page view, only after a genuine user calculation (nnUserArmed),
         only when the rendered result itself carries the milestone copy
         the tools already print ("debt-free" / "mortgage-free");
       - the sticky strip slides in (CSS), buttons get tactile press depth
         (CSS). GPU-cheap transform/opacity only, zero layout shift, all of
         it inert under prefers-reduced-motion, in embed mode and in print. */
  var nnFx = { celebrated: false, wasShown: false, lastReveal: 0, lastInput: 0, animating: false, celebTimer: null };

  function nnFxSparkle(region) {
    try {
      var host = document.createElement('div');
      host.className = 'nn-fx-burst';
      host.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < 12; i++) {
        var s = document.createElement('span');
        s.className = 'nn-fx-spark';
        var ang = (Math.PI * 2 * i) / 12 + (Math.random() * 0.35 - 0.175);
        var dist = 46 + Math.random() * 42;
        s.style.setProperty('--nn-fx-x', (Math.cos(ang) * dist).toFixed(1) + 'px');
        s.style.setProperty('--nn-fx-y', (Math.sin(ang) * dist - 14).toFixed(1) + 'px');
        s.style.setProperty('--nn-fx-r', Math.round(Math.random() * 160 - 80) + 'deg');
        host.appendChild(s);
      }
      region.appendChild(host);
      setTimeout(function () { if (host.parentNode) host.remove(); }, 1050);
    } catch (e) {}
  }
  function nnFxMaybeCelebrate(region) {
    if (nnFx.celebrated || reducedMotion) return;
    if (!nnUserArmed || nnStale.active) return;
    if (document.documentElement.classList.contains('nn-embed')) return;
    if (!nnResultShown()) return;
    var text = region.textContent || '';
    if (!/debt-free|mortgage-free/i.test(text)) return;
    nnFx.celebrated = true;
    nnFxSparkle(region);
  }
  function nnFxTweenStat(region) {
    /* .big already tweens via watchBig; stat-grid tools have no .big, so
       their primary value (first .stat .v) snaps today — tween it with the
       same machinery, but never mid-typing (the value would roll from 0 on
       every keystroke settle) and never away from the exact final text. */
    if (region.querySelector('.big')) return;
    var v = region.querySelector('.stat .v');
    if (!v) return;
    var finalText = v.textContent;
    if (v._nnFxLast === finalText) return;
    v._nnFxLast = finalText;
    if (reducedMotion) return;
    if (Date.now() - nnFx.lastInput < 600) return; /* live typing: snap */
    var spec = nnParseBig(finalText);
    if (!spec || spec.num === 0) return;
    nnFx.animating = true;
    animateBig(v, { num: 0 }, spec, finalText);
    setTimeout(function () { nnFx.animating = false; }, 700);
  }
  function nnFxSnap(region) {
    /* beforeprint: an in-flight stat tween must never print an intermediate
       value — cancel it and write the exact final text. */
    if (!region) return;
    var v = region.querySelector('.stat .v');
    if (v && v._nnAnim) {
      if (v._nnRaf) cancelAnimationFrame(v._nnRaf);
      v._nnAnim = false; v._nnRaf = null;
      if (v._nnFxLast != null) v.textContent = v._nnFxLast;
      nnFx.animating = false;
    }
  }
  function nnFxOnRender(region) {
    var shown = nnResultShown();
    if (!shown) { nnFx.wasShown = false; return; }
    if (nnStale.active) { nnFx.wasShown = true; return; }
    var now = Date.now();
    var typing = now - nnFx.lastInput < 600;
    if (!reducedMotion && (!nnFx.wasShown || !typing) && now - nnFx.lastReveal > 1200) {
      nnFx.lastReveal = now;
      region.classList.remove('nn-fx-reveal');
      void region.offsetWidth;
      region.classList.add('nn-fx-reveal');
    }
    nnFx.wasShown = true;
    nnFxTweenStat(region);
    nnFxMaybeCelebrate(region);
  }
  function nnFxInit() {
    if (document.documentElement.classList.contains('nn-embed')) return;
    var region = nnResultRegion();
    if (!region) return; /* document tools (invoice) carry their own chrome */
    region.classList.add('nn-fx-host');
    document.addEventListener('input', function () {
      nnFx.lastInput = Date.now();
      clearTimeout(nnFx.celebTimer);
      nnFx.celebTimer = setTimeout(function () { nnFxMaybeCelebrate(region); }, 900);
    });
    document.addEventListener('change', function () { nnFx.lastInput = Date.now(); });
    var pending = false;
    var obs = new MutationObserver(function () {
      if (nnFx.animating || pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; nnFxOnRender(region); });
    });
    obs.observe(region, { childList: true, characterData: true, subtree: true });
    window.addEventListener('beforeprint', function () { nnFxSnap(region); });
    if (nnResultShown()) nnFx.wasShown = true;
  }

  /* ---------- init ---------- */
  function init() {
    /* print scoping: mark cards that hold results. Markers: .results /
       .stat-grid (standard tools), #pwout (password generator) and
       #preview (document-style tools: the invoice generator renders its
       printable document there and has no .results element — leaving it
       out once kept nn-has-results unset on that page, so the print
       report shipped every detail card; muni defect report Nov 8 2026). */
    if (document.querySelector('.results, .stat-grid, #preview') || $('#pwout')) {
      document.body.classList.add('nn-has-results');
    }
    $all('.card').forEach(function (card) {
      if (card.querySelector('.results, .stat-grid, #preview') || card.querySelector('#pwout') || card.id === 'preview') {
        card.classList.add('nn-calc-card');
      }
    });
    $all('.results .big').forEach(watchBig);
    $all('.results').forEach(watchResults);
    renderToolSaves();
    renderHomeSaves();
    /* share-link restore: only when a param matches a real field (or a mode) */
    if (location.search && location.search.length > 1) {
      var params = nnParseQuery(location.search);
      var fields = collectFields();
      var hit = !!params.__mode;
      if (!hit) {
        for (var i = 0; i < fields.length; i++) {
          if (fields[i].id && Object.prototype.hasOwnProperty.call(params, fields[i].id)) { hit = true; break; }
        }
      }
      if (hit) { nnRestoredLink = true; restoreFromObject(params); } /* NN-MODAL: restored links never see the interstitial */
    }
    /* NN-MODAL: capture this site's own 300x250 key for the interstitial seat */
    nnModalKey = nnSiteAdKey('300');
    nnShellInit(); /* NN-SHELL-P1 */
    nnFxInit(); /* NN-EFFECTS-P1 */
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
