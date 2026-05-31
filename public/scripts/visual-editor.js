/* ============================================================================
   TMKE "Website Editor"  (per-element visual editor)
   ----------------------------------------------------------------------------
   - LOADER (always): applies the *published* per-element overrides for the
     current page so every visitor sees them.
   - EDITOR (?edit=1): click any element to tweak type / spacing / colour /
     layout, edit wording, swap images. Saves to a *draft*; "Publish" makes the
     draft live for everyone.

   Persistence is provided by window.tmkeStore (a Supabase bridge, see
   BaseLayout). When Supabase isn't configured (e.g. local dev) it falls back
   to localStorage and the editor opens without a login — so the prototype keeps
   working. With Supabase configured, edit mode requires an admin session and
   Publish writes to the database.
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'tmke-overrides-v1::' + pathKey();
  var overrides = {};                                   // { selector: { prop: value } }
  var editMode = new URLSearchParams(location.search).has('edit');
  var store = null, remote = false;

  function pathKey() { return (location.pathname.replace(/\/+$/, '') || '/'); }

  /* ---- local fallback persistence ---- */
  var Local = {
    load: function () { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; } },
    save: function (m) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(m)); } catch (e) {} },
  };

  /* ---- wait for the Supabase bridge (or fall back) ---- */
  function withStore(cb) {
    if (window.tmkeStore) return cb(window.tmkeStore);
    var done = false;
    var fin = function () { if (done) return; done = true; cb(window.tmkeStore || null); };
    window.addEventListener('tmke:store-ready', fin, { once: true });
    setTimeout(fin, 2500);
  }

  /* ---- stable selector (persistence key) ---- */
  function selectorFor(el) {
    if (!el || el.nodeType !== 1 || el === document.body) return null;
    var parts = [], node = el;
    while (node && node.nodeType === 1 && node !== document.body) {
      if (node.id) { parts.unshift('#' + cssEscape(node.id)); break; }
      var parent = node.parentNode; if (!parent) break;
      var same = [];
      for (var i = 0; i < parent.children.length; i++) {
        if (parent.children[i].tagName === node.tagName) same.push(parent.children[i]);
      }
      parts.unshift(node.tagName.toLowerCase() + ':nth-of-type(' + (same.indexOf(node) + 1) + ')');
      node = parent;
    }
    return parts.join(' > ');
  }
  function cssEscape(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }

  /* ---- apply overrides ---- */
  function injectStyles() {
    var css = '';
    Object.keys(overrides).forEach(function (sel) {
      if (sel.indexOf('__') === 0) return;
      var rules = overrides[sel];
      var decls = Object.keys(rules)
        .filter(function (p) { return p.indexOf('__') !== 0 && rules[p] !== '' && rules[p] != null; })
        .map(function (p) { return p + ':' + rules[p] + ' !important'; })
        .join(';');
      if (decls) css += sel + '{' + decls + '}\n';
    });
    var tag = document.getElementById('tmke-overrides');
    if (!tag) { tag = document.createElement('style'); tag.id = 'tmke-overrides'; document.head.appendChild(tag); }
    tag.textContent = css;
  }
  var baseContent = {};          // pristine content captured before first edit (for undo)
  function captureBase(sel, el) {
    if (!sel || !el) return;
    if (!baseContent[sel]) baseContent[sel] = {};
    var b = baseContent[sel];
    if (b.html == null) b.html = el.innerHTML;
    if ((el.tagName === 'IMG' || el.tagName === 'VIDEO') && b.src == null) b.src = el.getAttribute('src') || '';
    else if (b.bg == null) { var cbg = getComputedStyle(el).backgroundImage; b.bg = (cbg && cbg !== 'none') ? cbg : ''; }
  }
  var ATTR_BOOL = { controls: 1, autoplay: 1, loop: 1, muted: 1, playsinline: 1 };
  function applyContent() {
    // 1) restore pristine content where the content override has been removed (undo/reset)
    Object.keys(baseContent).forEach(function (sel) {
      var el; try { el = document.querySelector(sel); } catch (e) { return; }
      if (!el) return;
      var o = overrides[sel] || {}, b = baseContent[sel];
      if (b.html != null && o.__html == null) el.innerHTML = b.html;
      if (b.src != null && o.__src == null && (el.tagName === 'IMG' || el.tagName === 'VIDEO')) el.src = b.src;
      if (b.bg != null && o.__src == null && el.tagName !== 'IMG' && el.tagName !== 'VIDEO') el.style.backgroundImage = b.bg;
    });
    // 2) apply current content overrides
    Object.keys(overrides).forEach(function (sel) {
      if (sel.indexOf('__') === 0) return;
      var o = overrides[sel], el;
      try { el = document.querySelector(sel); } catch (e) { return; }
      if (!el) return;
      if (o.__html != null) el.innerHTML = o.__html;
      if (o.__src != null) { if (el.tagName === 'IMG' || el.tagName === 'VIDEO') el.src = o.__src; else el.style.backgroundImage = o.__src ? ("url('" + o.__src + "')") : ''; }
      if (o.__icon != null && el.tagName.toLowerCase() === 'svg') { el.setAttribute('viewBox', '0 0 24 24'); el.innerHTML = o.__icon; }
      if (o.__attrs) Object.keys(o.__attrs).forEach(function (a) { if (o.__attrs[a]) el.setAttribute(a, ATTR_BOOL[a] ? '' : 'true'); else el.removeAttribute(a); });
    });
  }
  function applyAll() {
    injectStyles();
    var run = function () { applyBlocks(); applyContent(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
  }

  /* Always-on styles for everyone: animation keyframes + added-block layout. */
  function injectGlobalStyles() {
    if (document.getElementById('tmke-ve-keyframes')) return;
    var s = document.createElement('style'); s.id = 'tmke-ve-keyframes';
    s.textContent =
      '@keyframes ve-fade{from{opacity:0}to{opacity:1}}' +
      '@keyframes ve-up{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}' +
      '@keyframes ve-inleft{from{opacity:0;transform:translateX(-34px)}to{opacity:1;transform:none}}' +
      '@keyframes ve-zoom{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}' +
      '@keyframes ve-pop{0%{transform:scale(.8);opacity:0}60%{transform:scale(1.05);opacity:1}100%{transform:scale(1)}}' +
      '.ve-block{max-width:1360px;margin:40px auto;padding:0 76px;}' +
      '.ve-block--text h2{font-family:var(--sans);font-size:clamp(32px,4vw,52px);line-height:1.05;color:var(--ink);margin:0;}' +
      '.ve-block--text h3{font-family:var(--serif);font-size:clamp(24px,3vw,34px);line-height:1.2;color:var(--ink);margin:0;}' +
      '.ve-block--text p{font-family:var(--serif);font-size:clamp(20px,2vw,26px);line-height:1.5;color:var(--ink);margin:0;}' +
      '.ve-block--image img,.ve-block--video video{width:100%;height:auto;display:block;border-radius:4px;}' +
      '.ve-block.ve-shape,.ve-block.ve-line,.ve-block.ve-gradient{max-width:none;padding:0;}' +
      '.ve-shape{width:180px;height:120px;background:var(--english-violet);margin:24px auto;}' +
      '.ve-shape--circle{border-radius:50%;}' +
      '.ve-shape--tri{clip-path:polygon(50% 0%,100% 100%,0% 100%);}' +
      '.ve-line{background:var(--ink);margin:24px auto;}' +
      '.ve-line--h{width:60%;height:3px;}' +
      '.ve-line--v{width:3px;height:160px;}' +
      '.ve-gradient{width:100%;height:240px;margin:0 auto;background:linear-gradient(to bottom,rgba(0,0,0,.6),rgba(0,0,0,0));}';
    document.head.appendChild(s);
  }
  injectGlobalStyles();

  /* Re-insert blocks the editor added (stored in overrides.__blocks). */
  function applyBlocks() {
    var blocks = overrides.__blocks; if (!blocks || !blocks.length) return;
    blocks.forEach(function (bk) {
      if (document.querySelector('[data-ve-block="' + bk.id + '"]')) return; // already there
      var after; try { after = document.querySelector(bk.after); } catch (e) { return; }
      var wrap = document.createElement('div'); wrap.innerHTML = bk.html.trim();
      var node = wrap.firstElementChild; if (!node) return;
      if (after && after.parentNode) after.parentNode.insertBefore(node, after.nextSibling);
      else document.body.appendChild(node);
    });
  }

  /* ---- save (draft) ---- */
  var saveTimer = null, onDirty = null;
  function persist() {
    Local.save(overrides);
    if (remote && store) { clearTimeout(saveTimer); saveTimer = setTimeout(function () { store.saveDraft(overrides); }, 600); }
    if (onDirty) onDirty();
    recordHistory();
  }

  /* ---- undo / redo (history within the current publish window) ---- */
  var history = [], histIndex = -1, restoring = false, histTimer = null;
  function snapshot() { return JSON.parse(JSON.stringify(overrides)); }
  function historyInit() { history = [snapshot()]; histIndex = 0; updateHistButtons(); }
  function recordHistory() {
    if (restoring || histIndex < 0) return;
    clearTimeout(histTimer);
    histTimer = setTimeout(function () {
      var snap = JSON.stringify(overrides);
      if (JSON.stringify(history[histIndex]) === snap) return;     // nothing changed
      history = history.slice(0, histIndex + 1);
      history.push(JSON.parse(snap));
      if (history.length > 80) history.shift();
      histIndex = history.length - 1;
      updateHistButtons();
    }, 350);
  }
  function reapplyAll() {
    injectStyles();
    var want = {}; (overrides.__blocks || []).forEach(function (b) { want[b.id] = 1; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-ve-block]'), function (n) { if (!want[n.getAttribute('data-ve-block')]) n.remove(); });
    applyBlocks();
    applyContent();
  }
  function restoreState(map) {
    restoring = true;
    overrides = JSON.parse(JSON.stringify(map));
    Local.save(overrides);
    if (remote && store) { clearTimeout(saveTimer); saveTimer = setTimeout(function () { store.saveDraft(overrides); }, 200); }
    reapplyAll();
    if (selected && document.contains(selected)) renderPanel(selected); else deselect();
    restoring = false;
  }
  function undo() { if (histIndex <= 0) return; histIndex--; restoreState(history[histIndex]); updateHistButtons(); flashStatus('Undo'); }
  function redo() { if (histIndex >= history.length - 1) return; histIndex++; restoreState(history[histIndex]); updateHistButtons(); flashStatus('Redo'); }
  function updateHistButtons() {
    var u = document.getElementById('tmke-ve-undo'), r = document.getElementById('tmke-ve-redo');
    if (u) u.disabled = histIndex <= 0;
    if (r) r.disabled = histIndex >= history.length - 1;
  }
  function flashStatus(msg) { if (statusEl) { statusEl.textContent = msg; clearTimeout(flashStatus._t); flashStatus._t = setTimeout(function () { statusEl.textContent = (remote ? 'Draft saved' : ''); }, 1200); } }

  /* ====================================================================== */
  /*  BOOT                                                                  */
  /* ====================================================================== */
  withStore(function (s) {
    store = s; remote = !!(s && s.configured);
    if (!editMode) {
      // viewer — show published
      if (remote) s.loadPublished().then(function (p) { overrides = p || {}; applyAll(); });
      else { overrides = Local.load(); applyAll(); }
      return;
    }
    // editor
    if (remote) {
      s.hasSession().then(function (isAdmin) {
        if (!isAdmin) return loginGate(s);
        s.loadDraft().then(function (d) { overrides = d || {}; applyAll(); startEditor(true); });
      });
    } else {
      overrides = Local.load(); applyAll(); startEditor(false);
    }
  });

  /* ---- login gate (Supabase configured but not signed in) ---- */
  function loginGate(s) {
    var bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;inset:0 0 auto 0;z-index:2147483647;background:#1c1d22;color:#f2efe9;font:600 14px system-ui;padding:14px 18px;display:flex;gap:14px;align-items:center;';
    bar.innerHTML = '<b>Website Editor</b><span style="opacity:.7;font-weight:500">Please sign in to edit this page.</span>';
    var a = document.createElement('a');
    a.href = '/admin/login?next=' + encodeURIComponent(location.pathname + location.search);
    a.textContent = 'Sign in →';
    a.style.cssText = 'margin-left:auto;color:#fff;background:#5b4b7a;padding:8px 14px;border-radius:6px;text-decoration:none;';
    bar.appendChild(a);
    document.body.appendChild(bar);
  }

  /* ====================================================================== */
  /*  EDITOR UI                                                             */
  /* ====================================================================== */
  function isContainer(el, cs) { var d = cs.display; return d === 'flex' || d === 'grid' || d === 'inline-flex' || d === 'inline-grid'; }
  function isTextEl(el) { return /^(H1|H2|H3|H4|H5|H6|P|SPAN|A|BUTTON|LI|EM|STRONG|BLOCKQUOTE|FIGCAPTION)$/.test(el.tagName); }
  var EDITABLE = 'h1,h2,h3,h4,h5,h6,p,span,a,button,li,blockquote,em,strong,figcaption,img,svg,' +
    'div,section,article,figure,ul,ol,aside,header,footer,form';
  var ANIMS = [['None', ''], ['Fade in', 've-fade'], ['Slide up', 've-up'], ['Slide in', 've-inleft'], ['Zoom in', 've-zoom'], ['Pop', 've-pop']];
  var ICONS = [
    ['Arrow', '<path d="M4 12h15M13 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'],
    ['Arrow ↗', '<path d="M7 17L17 7M8 7h9v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'],
    ['Star', '<path d="M12 2.5l2.95 6 6.6.96-4.78 4.66 1.13 6.58L12 17.6l-5.9 3.1 1.13-6.58L2.45 9.46l6.6-.96L12 2.5z" fill="currentColor"/>'],
    ['Heart', '<path d="M12 21S3.5 15.4 3.5 9.6C3.5 6.9 5.6 5 8 5c1.7 0 3.1 1 4 2.3C12.9 6 14.3 5 16 5c2.4 0 4.5 1.9 4.5 4.6C20.5 15.4 12 21 12 21z" fill="currentColor"/>'],
    ['Check', '<path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'],
    ['Plus', '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'],
    ['Phone', '<path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1 1 0 011-.24 11 11 0 003.4.55 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11 11 0 00.55 3.4 1 1 0 01-.24 1l-2.2 2.4z" fill="currentColor"/>'],
    ['Mail', '<rect x="3" y="6" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 7l8.5 6 8.5-6" fill="none" stroke="currentColor" stroke-width="2"/>'],
    ['Calendar', '<rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 9h18M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'],
    ['Play', '<path d="M8 5v14l11-7z" fill="currentColor"/>'],
    ['Chat', '<path d="M4 5h16v10H8l-4 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'],
    ['Search', '<circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'],
  ];
  var CONTROLS = [
    { prop: 'font-size',      label: 'Font size',      unit: 'px', min: 8,   max: 220, step: 1,   when: function (el) { return isTextEl(el); } },
    { prop: 'line-height',    label: 'Line height',    unit: '',   min: 0.8, max: 2.4, step: 0.01, when: function (el) { return isTextEl(el); } },
    { prop: 'letter-spacing', label: 'Letter spacing', unit: 'px', min: -6,  max: 12,  step: 0.1, when: function (el) { return isTextEl(el); } },
    { prop: 'margin-top',     label: 'Margin top',     unit: 'px', min: -120, max: 320, step: 1 },
    { prop: 'margin-bottom',  label: 'Margin bottom',  unit: 'px', min: -120, max: 320, step: 1 },
    { prop: 'margin-left',    label: 'Margin left',    unit: 'px', min: -120, max: 320, step: 1 },
    { prop: 'margin-right',   label: 'Margin right',   unit: 'px', min: -120, max: 320, step: 1 },
    { prop: 'padding-top',    label: 'Padding top',    unit: 'px', min: 0,   max: 280, step: 1 },
    { prop: 'padding-bottom', label: 'Padding bottom', unit: 'px', min: 0,   max: 280, step: 1 },
    { prop: 'padding-left',   label: 'Padding left',   unit: 'px', min: 0,   max: 280, step: 1 },
    { prop: 'padding-right',  label: 'Padding right',  unit: 'px', min: 0,   max: 280, step: 1 },
    { prop: 'max-width',      label: 'Content width (max)', unit: 'px', min: 280, max: 1680, step: 10 },
    { prop: 'border-radius',  label: 'Corner radius',  unit: 'px', min: 0,   max: 200, step: 1 },
    { prop: 'gap',            label: 'Gap (space between items)', unit: 'px', min: 0, max: 160, step: 1, when: isContainer },
  ];
  var BRAND_VARS = [['--ink','Ink'],['--paper','Paper'],['--english-violet','Violet'],['--accent','Accent'],['--coral','Coral'],['--gold','Gold'],['--mint','Mint'],['--gunmetal','Gunmetal']];
  function brandColour(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

  var selected = null, panel, panelBody, tagBadge, crumbEl, statusEl;

  function startEditor(isRemote) {
    if (document.getElementById('tmke-ve-root')) return;
    injectChrome();
    buildToolbar(isRemote);
    buildPanel();
    wirePageInteractions();
    editingEnabled = true;
    loadRulers(); renderRulers();
    historyInit();
    deselect();
  }

  function injectChrome() {
    var s = document.createElement('style'); s.id = 'tmke-ve-root';
    s.textContent = [
      '.tmke-ve-hover{outline:2px dashed rgba(91,75,122,.85)!important;outline-offset:2px!important;cursor:pointer!important;}',
      '.tmke-ve-selected{outline:2px solid #5b4b7a!important;outline-offset:2px!important;}',
      '.tmke-ve-tag{position:fixed;z-index:2147483646;background:#5b4b7a;color:#fff;font:600 10px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;padding:3px 6px;border-radius:3px;pointer-events:none;transform:translateY(-100%);white-space:nowrap;}',
      '.tmke-ve-bar{position:fixed;top:0;left:0;right:0;z-index:2147483645;height:46px;background:#1c1d22;color:#f2efe9;display:flex;align-items:center;gap:16px;padding:0 16px;font:600 13px/1 system-ui,sans-serif;box-shadow:0 2px 14px rgba(0,0,0,.3);}',
      '.tmke-ve-bar b{font-weight:700;}',
      '.tmke-ve-bar .tag{font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.6;}',
      '.tmke-ve-bar .crumb{margin-left:auto;opacity:.7;font-weight:500;max-width:36vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.tmke-ve-bar .status{font-weight:600;opacity:.85;font-size:12px;}',
      '.tmke-ve-bar button{font:600 12px system-ui,sans-serif;color:#f2efe9;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:7px 12px;cursor:pointer;}',
      '.tmke-ve-bar button:hover{background:rgba(255,255,255,.2);}',
      '.tmke-ve-bar button.primary{background:#5b4b7a;border-color:#5b4b7a;}',
      'body.tmke-ve-on{padding-top:46px!important;margin-right:300px!important;}',
      'body.tmke-ve-on .nav{right:300px!important;}',
      '.tmke-ve-panel{position:fixed;top:46px;right:0;bottom:0;z-index:2147483645;width:300px;background:#22232a;color:#f2efe9;border-left:1px solid rgba(255,255,255,.12);box-shadow:-8px 0 30px rgba(0,0,0,.22);font:13px system-ui,sans-serif;display:flex;flex-direction:column;}',
      '.tmke-ve-panel-h{padding:12px 14px;background:rgba(255,255,255,.05);font-weight:700;display:flex;align-items:center;justify-content:space-between;flex:0 0 auto;}',
      '.tmke-ve-panel-h small{font-weight:500;opacity:.6;font-size:11px;}',
      '.tmke-ve-body{padding:6px 14px 24px;flex:1 1 auto;min-height:0;overflow-y:scroll;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#6b5e86 #2a2b33;}',
      '.tmke-ve-body::-webkit-scrollbar{width:11px;}',
      '.tmke-ve-body::-webkit-scrollbar-track{background:#2a2b33;}',
      '.tmke-ve-body::-webkit-scrollbar-thumb{background:#6b5e86;border-radius:6px;border:2px solid #2a2b33;}',
      '.tmke-ve-body::-webkit-scrollbar-thumb:hover{background:#8573a8;}',
      '.tmke-ve-empty{opacity:.55;font-size:12px;line-height:1.5;padding:20px 4px;}',
      '.tmke-ve-prebar{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:2147483646;background:#1c1d22;color:#f2efe9;border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:8px 10px 8px 18px;display:flex;align-items:center;gap:12px;box-shadow:0 12px 40px rgba(0,0,0,.4);font:600 13px system-ui,sans-serif;}',
      '.tmke-ve-prebar button{font:600 12px system-ui,sans-serif;border:none;border-radius:999px;padding:9px 16px;cursor:pointer;}',
      '.tmke-ve-prebar .ghost{background:rgba(255,255,255,.12);color:#f2efe9;}',
      '.tmke-ve-prebar .primary{background:#5b4b7a;color:#fff;}',
      '.tmke-ve-row{margin:12px 0;}',
      '.tmke-ve-row label{display:flex;justify-content:space-between;font-size:11px;letter-spacing:.04em;text-transform:uppercase;opacity:.7;margin-bottom:6px;}',
      '.tmke-ve-row label .val{opacity:1;font-weight:700;text-transform:none;letter-spacing:0;}',
      '.tmke-ve-row input[type=range]{width:100%;accent-color:#9a86b8;}',
      '.tmke-ve-row input[type=color]{width:100%;height:30px;border:none;background:none;cursor:pointer;}',
      '.tmke-ve-row select{width:100%;padding:6px;border-radius:6px;background:#1c1d22;color:#f2efe9;border:1px solid rgba(255,255,255,.18);}',
      '.tmke-ve-row .tmke-ve-text{width:100%;padding:7px;border-radius:6px;background:#1c1d22;color:#f2efe9;border:1px solid rgba(255,255,255,.18);font:12px system-ui,sans-serif;}',
      '[contenteditable=true]{outline:2px solid #9a86b8!important;outline-offset:3px;cursor:text!important;}',
      '.tmke-ve-swatches{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}',
      '.tmke-ve-swatch{width:22px;height:22px;border-radius:5px;border:1px solid rgba(255,255,255,.25);cursor:pointer;padding:0;}',
      '.tmke-ve-swatch:hover{transform:scale(1.12);}',
      '.tmke-ve-chips{display:flex;flex-wrap:wrap;gap:6px;}',
      '.tmke-ve-chip{font:600 11px system-ui,sans-serif;color:#f2efe9;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:6px 10px;cursor:pointer;}',
      '.tmke-ve-chip.on{background:#5b4b7a;border-color:#5b4b7a;}',
      '.tmke-ve-chip:hover{background:rgba(255,255,255,.2);}',
      '.tmke-ve-icons{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;}',
      '.tmke-ve-iconbtn{display:flex;align-items:center;justify-content:center;padding:6px;border-radius:6px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#f2efe9;cursor:pointer;}',
      '.tmke-ve-iconbtn:hover{background:rgba(255,255,255,.2);}',
      '.tmke-ve-addmenu{position:fixed;z-index:2147483646;background:#22232a;border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:6px;display:flex;flex-direction:column;min-width:150px;box-shadow:0 12px 36px rgba(0,0,0,.4);}',
      '.tmke-ve-addmenu button{display:block;width:100%;text-align:left;background:none;border:none;color:#f2efe9;font:600 13px system-ui,sans-serif;padding:9px 10px;border-radius:6px;cursor:pointer;}',
      '.tmke-ve-addmenu button:hover{background:rgba(255,255,255,.12);}',
      '.tmke-ve-reset{width:100%;margin-top:6px;padding:9px;border-radius:7px;background:transparent;border:1px solid rgba(255,255,255,.25);color:#f2efe9;font:600 12px system-ui,sans-serif;cursor:pointer;}',
      '.tmke-ve-reset:hover{background:rgba(255,255,255,.08);}',
      '#tmke-ve-guides{position:fixed;inset:0;z-index:2147483644;pointer-events:none;}',
      '.tmke-ve-guide{position:absolute;background:#ff3b80;box-shadow:0 0 0 .5px rgba(255,59,128,.4);}',
      '.tmke-ve-guide.v{top:0;bottom:0;width:1px;}',
      '.tmke-ve-guide.h{left:0;right:0;height:1px;}',
      '#tmke-ve-rulers{position:fixed;inset:0;z-index:2147483643;pointer-events:none;}',
      '.tmke-ve-ruler{position:absolute;background:#2bb0ff;pointer-events:auto;}',
      '.tmke-ve-ruler.v{top:0;bottom:0;width:1px;cursor:ew-resize;}',
      '.tmke-ve-ruler.h{left:0;right:0;height:1px;cursor:ns-resize;}',
      '.tmke-ve-ruler .lab{position:absolute;background:#2bb0ff;color:#fff;font:600 10px/1 system-ui;padding:3px 5px;border-radius:3px;white-space:nowrap;}',
      '.tmke-ve-ruler.v .lab{top:52px;left:5px;}',
      '.tmke-ve-ruler.h .lab{left:52px;top:5px;}',
      '.tmke-ve-selected{cursor:move!important;}',
      '.tmke-ve-bar button:disabled{opacity:.32;cursor:default;}',
      '.tmke-ve-group{border:1px solid rgba(255,255,255,.1);border-radius:8px;margin:8px 0;overflow:hidden;background:rgba(255,255,255,.02);}',
      '.tmke-ve-group>summary{list-style:none;cursor:pointer;padding:10px 12px;font-weight:700;font-size:12px;letter-spacing:.03em;display:flex;align-items:center;justify-content:space-between;user-select:none;}',
      '.tmke-ve-group>summary::-webkit-details-marker{display:none;}',
      '.tmke-ve-group>summary::after{content:"\\25B8";opacity:.55;font-size:11px;transition:transform .15s;}',
      '.tmke-ve-group[open]>summary::after{transform:rotate(90deg);}',
      '.tmke-ve-group>summary:hover{background:rgba(255,255,255,.05);}',
      '.tmke-ve-gbody{padding:2px 12px 12px;}',
      '.tmke-ve-gbody .tmke-ve-row:first-child{margin-top:4px;}',
      '.tmke-ve-hint{font-size:11.5px;line-height:1.5;opacity:.6;padding:4px 0;}',
      '.tmke-ve-quadgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px;}',
      '.tmke-ve-quadcell{display:flex;align-items:center;gap:6px;background:#1c1d22;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:5px 8px;}',
      '.tmke-ve-quadcell span{font-size:10px;opacity:.55;font-weight:700;width:12px;flex:0 0 auto;}',
      '.tmke-ve-quadcell input{width:100%;background:none;border:none;color:#f2efe9;font:12px system-ui;outline:none;-moz-appearance:textfield;}',
      '.tmke-ve-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;}',
      '.tmke-ve-toggle label{margin:0;flex:1;}',
      '.tmke-ve-switch{width:38px;height:22px;border-radius:999px;background:rgba(255,255,255,.18);border:none;position:relative;cursor:pointer;flex:0 0 auto;padding:0;transition:background .15s;}',
      '.tmke-ve-switch::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .15s;}',
      '.tmke-ve-switch.on{background:#5b4b7a;}',
      '.tmke-ve-switch.on::after{transform:translateX(16px);}',
      '.tmke-ve-danger{margin-top:14px;border-color:rgba(255,120,120,.45)!important;color:#ffb4b4!important;}',
      '.tmke-ve-danger:hover{background:rgba(255,120,120,.1)!important;}',
      '#tmke-ve-handles{position:fixed;z-index:2147483644;pointer-events:none;outline:1px solid rgba(91,75,122,.9);}',
      '.tmke-ve-handle{position:absolute;width:13px;height:13px;background:#fff;border:2px solid #5b4b7a;border-radius:50%;pointer-events:auto;}',
      '.tmke-ve-handle.nw{left:-7px;top:-7px;cursor:nwse-resize;}',
      '.tmke-ve-handle.ne{right:-7px;top:-7px;cursor:nesw-resize;}',
      '.tmke-ve-handle.sw{left:-7px;bottom:-7px;cursor:nesw-resize;}',
      '.tmke-ve-handle.se{right:-7px;bottom:-7px;cursor:nwse-resize;}',
      '#tmke-ve-ghost{position:fixed;z-index:2147483646;transform:translate(-50%,-50%);background:#5b4b7a;color:#fff;font:600 12px system-ui;padding:6px 10px;border-radius:6px;pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,.4);text-transform:capitalize;}',
      '.tmke-ve-palette{width:300px;padding:8px;}',
      '.tmke-ve-palcats{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;}',
      '.tmke-ve-palcat{flex:1 1 auto;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#f2efe9;font:600 11px system-ui;padding:6px 8px;border-radius:6px;cursor:pointer;}',
      '.tmke-ve-palcat.on{background:#5b4b7a;border-color:#5b4b7a;}',
      '.tmke-ve-paltiles{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;}',
      '.tmke-ve-tile{display:flex;flex-direction:column;align-items:center;gap:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);color:#f2efe9;border-radius:8px;padding:12px 6px 9px;cursor:grab;font:600 11px system-ui;}',
      '.tmke-ve-tile:hover{background:rgba(255,255,255,.14);}',
      '.tmke-ve-tile .ic{opacity:.92;}',
      '.tmke-ve-palhint{font-size:10.5px;opacity:.55;line-height:1.4;padding:8px 2px 2px;}',
    ].join('');
    document.head.appendChild(s);
    document.body.classList.add('tmke-ve-on');
  }

  var editingEnabled = false;
  function buildToolbar(isRemote) {
    var bar = document.createElement('div'); bar.className = 'tmke-ve-bar';
    bar.innerHTML = '<b>Website Editor</b><span class="tag">' + (isRemote ? '' : 'Local preview') + '</span>' +
      '<span class="status" id="tmke-ve-status"></span>' +
      '<span class="crumb" id="tmke-ve-crumb">Click any element to edit it</span>';
    var ub = btn('↶ Undo', undo); ub.id = 'tmke-ve-undo'; ub.disabled = true; ub.title = 'Undo (Ctrl+Z)'; bar.appendChild(ub);
    var rb = btn('↷ Redo', redo); rb.id = 'tmke-ve-redo'; rb.disabled = true; rb.title = 'Redo (Ctrl+Shift+Z)'; bar.appendChild(rb);
    bar.appendChild(btn('+ Add', function (e) { toggleAddMenu(e.currentTarget); }));
    bar.appendChild(btn('Rulers', function (e) { toggleRulerMenu(e.currentTarget); }));
    bar.appendChild(btn('Reset all', function () {
      if (!confirm('Remove every saved change on this page?')) return;
      overrides = {}; persist(); injectStyles(); deselect();
      if (remote && store) store.saveDraft(overrides);
    }));
    var prev = btn('Preview', enterPreview); prev.className = 'primary'; bar.appendChild(prev);
    bar.appendChild(btn('Done', exitEditor));
    document.body.appendChild(bar);
    crumbEl = bar.querySelector('#tmke-ve-crumb');
    statusEl = bar.querySelector('#tmke-ve-status');
    onDirty = function () { if (remote) statusEl.textContent = 'Draft saved'; };
  }
  function btn(label, fn) { var b = document.createElement('button'); b.textContent = label; b.onclick = fn; return b; }
  function btn2(label, cls, fn) { var b = document.createElement('button'); b.className = cls; b.textContent = label; b.onclick = fn; return b; }

  /* ---- Add palette (Canva-style tiles + drag-to-place) ---- */
  var blockSeq = 0;
  var ADD_CATS = [
    ['Text', [['Heading', 'heading'], ['Subheading', 'subheading'], ['Paragraph', 'paragraph']]],
    ['Media', [['Image', 'image'], ['Video', 'video']]],
    ['Shapes', [['Rectangle', 'rect'], ['Circle', 'circle'], ['Triangle', 'triangle']]],
    ['Lines', [['Horizontal', 'hline'], ['Vertical', 'vline']]],
    ['Gradient', [['Gradient', 'gradient']]],
  ];
  function tileIcon(t) {
    var s = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6">';
    var g = { heading: '<path d="M5 5v14M5 12h9M14 5v14"/>', subheading: '<path d="M5 7v10M5 12h7M12 7v10"/><circle cx="18" cy="9" r="1.4" fill="currentColor"/>',
      paragraph: '<path d="M5 6h14M5 10h14M5 14h10M5 18h7"/>', image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M4 17l5-4 4 3 3-2 4 3"/>',
      video: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>', rect: '<rect x="4" y="6" width="16" height="12" rx="1.5" fill="currentColor"/>',
      circle: '<circle cx="12" cy="12" r="8" fill="currentColor"/>', triangle: '<path d="M12 4l8 16H4z" fill="currentColor"/>',
      hline: '<path d="M4 12h16" stroke-width="2.4"/>', vline: '<path d="M12 4v16" stroke-width="2.4"/>',
      gradient: '<defs><linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs><rect x="4" y="4" width="16" height="16" rx="2" fill="url(#vg)" stroke="none"/>' };
    return s + (g[t] || '') + '</svg>';
  }
  function toggleAddMenu(anchor) {
    var ex = document.getElementById('tmke-ve-addmenu'); if (ex) { ex.remove(); return; }
    var m = document.createElement('div'); m.id = 'tmke-ve-addmenu'; m.className = 'tmke-ve-addmenu tmke-ve-palette';
    var cats = document.createElement('div'); cats.className = 'tmke-ve-palcats';
    var tiles = document.createElement('div'); tiles.className = 'tmke-ve-paltiles';
    function renderTiles(items) {
      tiles.innerHTML = '';
      items.forEach(function (it) {
        var tile = document.createElement('button'); tile.className = 'tmke-ve-tile';
        tile.innerHTML = '<span class="ic">' + tileIcon(it[1]) + '</span><span>' + it[0] + '</span>';
        tile.addEventListener('mousedown', function (e) { startPaletteDrag(e, { t: it[1] }, m); });
        tiles.appendChild(tile);
      });
    }
    ADD_CATS.forEach(function (c, ci) {
      var cb = document.createElement('button'); cb.className = 'tmke-ve-palcat' + (ci === 0 ? ' on' : ''); cb.textContent = c[0];
      cb.onclick = function () { Array.prototype.forEach.call(cats.children, function (n) { n.classList.remove('on'); }); cb.classList.add('on'); renderTiles(c[1]); };
      cats.appendChild(cb);
    });
    renderTiles(ADD_CATS[0][1]);
    var hint = document.createElement('div'); hint.className = 'tmke-ve-palhint'; hint.textContent = 'Click to add, or drag onto the page to drop it exactly where you want.';
    m.appendChild(cats); m.appendChild(tiles); m.appendChild(hint);
    var r = anchor.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 320)) + 'px'; m.style.top = (r.bottom + 6) + 'px';
    document.body.appendChild(m);
  }
  function startPaletteDrag(e, def, menu) {
    e.preventDefault();
    var sx = e.clientX, sy = e.clientY, moved = false, ghost = null;
    var move = function (ev) {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) return;
      if (!moved) { moved = true; ghost = document.createElement('div'); ghost.id = 'tmke-ve-ghost'; ghost.textContent = '＋ ' + def.t; document.body.appendChild(ghost); }
      ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
    };
    var up = function (ev) {
      document.removeEventListener('mousemove', move, true); document.removeEventListener('mouseup', up, true);
      if (ghost) ghost.remove(); if (menu) menu.remove();
      if (moved) { if (!isChrome(ev.target)) addPaletteBlock(def, ev.clientX, ev.clientY); }
      else addPaletteBlock(def);
    };
    document.addEventListener('mousemove', move, true); document.addEventListener('mouseup', up, true);
  }
  function blockHtml(t, id) {
    var a = 'id="' + id + '" data-ve-block="' + id + '"';
    switch (t) {
      case 'heading': return '<div class="ve-block ve-block--text" ' + a + '><h2>New heading</h2></div>';
      case 'subheading': return '<div class="ve-block ve-block--text" ' + a + '><h3>New subheading</h3></div>';
      case 'paragraph': return '<div class="ve-block ve-block--text" ' + a + '><p>New paragraph — click to edit.</p></div>';
      case 'image': return '<div class="ve-block ve-block--image" ' + a + '><img src="/assets/hero.png" alt=""></div>';
      case 'video': return '<div class="ve-block ve-block--video" ' + a + '><video src="" controls playsinline></video></div>';
      case 'rect': return '<div class="ve-block ve-shape ve-shape--rect" ' + a + '></div>';
      case 'circle': return '<div class="ve-block ve-shape ve-shape--circle" ' + a + '></div>';
      case 'triangle': return '<div class="ve-block ve-shape ve-shape--tri" ' + a + '></div>';
      case 'hline': return '<div class="ve-block ve-line ve-line--h" ' + a + '></div>';
      case 'vline': return '<div class="ve-block ve-line ve-line--v" ' + a + '></div>';
      case 'gradient': return '<div class="ve-block ve-gradient" ' + a + '></div>';
      default: return '<div class="ve-block ve-block--text" ' + a + '><p>New block</p></div>';
    }
  }
  function addPaletteBlock(def, x, y) {
    blockSeq++;
    var id = 'veb' + Date.now() + '-' + blockSeq;
    var wrap = document.createElement('div'); wrap.innerHTML = blockHtml(def.t, id).trim();
    var node = wrap.firstElementChild;
    var ref = null;
    if (typeof x === 'number') { var u = document.elementFromPoint(x, y); ref = u && u.closest('section'); }
    if (!ref) ref = selected && selected.closest('section');
    if (!ref) { var secs = document.querySelectorAll('section'); ref = secs[secs.length - 1] || document.body.lastElementChild; }
    ref.parentNode.insertBefore(node, ref.nextSibling);
    if (!overrides.__blocks) overrides.__blocks = [];
    var nsel = selectorFor(node);
    if (typeof x === 'number') {
      var r = node.getBoundingClientRect();
      var tx = Math.round(x - (r.left + r.width / 2)), ty = Math.round(y - (r.top + r.height / 2));
      setOverride(nsel, 'transform', 'translate(' + tx + 'px,' + ty + 'px)');
    } else node.scrollIntoView({ block: 'center' });
    overrides.__blocks.push({ id: id, after: selectorFor(ref), html: node.outerHTML });
    persist();
    select((def.t === 'heading' || def.t === 'subheading' || def.t === 'paragraph') ? (node.querySelector('h2,h3,p') || node) : node);
  }
  function toggleRulerMenu(anchor) {
    var ex = document.getElementById('tmke-ve-addmenu'); if (ex) { ex.remove(); return; }
    var m = document.createElement('div'); m.id = 'tmke-ve-addmenu'; m.className = 'tmke-ve-addmenu';
    [['Vertical ruler', function () { addRuler('v'); }], ['Horizontal ruler', function () { addRuler('h'); }],
     ['Clear rulers', function () { rulers = []; saveRulers(); }]].forEach(function (o) {
      var b = document.createElement('button'); b.textContent = o[0];
      b.onclick = function () { m.remove(); o[1](); }; m.appendChild(b);
    });
    var r = anchor.getBoundingClientRect();
    m.style.left = r.left + 'px'; m.style.top = (r.bottom + 6) + 'px';
    document.body.appendChild(m);
  }
  function exitEditor() { var u = new URL(location.href); u.searchParams.delete('edit'); location.href = u.toString(); }

  /* Edit mode ⇆ Preview, toggled in-session (no reload → scroll preserved). */
  function setEditing(on) {
    editingEnabled = on;
    var bar = document.querySelector('.tmke-ve-bar'); if (bar) bar.style.display = on ? 'flex' : 'none';
    if (panel) panel.style.display = on ? 'flex' : 'none';
    document.body.classList.toggle('tmke-ve-on', on);
    if (!on) { clearHover(); hideFloatTag(); deselect(); clearGuides(); }
    renderRulers();
  }
  function enterPreview() {
    setEditing(false);
    var pb = document.createElement('div'); pb.className = 'tmke-ve-prebar'; pb.id = 'tmke-ve-prebar';
    pb.innerHTML = '<span>Preview — this is how it will look</span>';
    pb.appendChild(btn2('Continue editing', 'ghost', function () { pb.remove(); setEditing(true); }));
    if (remote) {
      var pubBtn = btn2('Publish', 'primary', function () {
        pubBtn.textContent = 'Publishing…';
        store.publish(overrides).then(function () { pubBtn.textContent = 'Published ✓'; setTimeout(function () { pubBtn.textContent = 'Publish'; }, 2500); })
          .catch(function () { pubBtn.textContent = 'Publish failed'; });
      });
      pb.appendChild(pubBtn);
    } else {
      pb.appendChild(btn2('Exit', 'ghost', exitEditor));
    }
    document.body.appendChild(pb);
  }

  function buildPanel() {
    panel = document.createElement('div'); panel.className = 'tmke-ve-panel';
    // data-lenis-prevent: stop the page's smooth-scroll from hijacking the
    // mouse wheel over the panel, so it scrolls its own content natively.
    panel.setAttribute('data-lenis-prevent', '');
    panel.innerHTML = '<div class="tmke-ve-panel-h"><span id="tmke-ve-eltag">Element</span><small id="tmke-ve-eltxt"></small></div><div class="tmke-ve-body" id="tmke-ve-body" data-lenis-prevent></div>';
    document.body.appendChild(panel);
    panelBody = panel.querySelector('#tmke-ve-body');
    // Belt-and-braces: also translate wheel into native panel scroll in case
    // the smooth-scroll library doesn't honour the attribute.
    panelBody.addEventListener('wheel', function (e) { panelBody.scrollTop += e.deltaY; e.stopPropagation(); }, { passive: true });
    tagBadge = panel.querySelector('#tmke-ve-eltag');
    var badge = document.createElement('div'); badge.className = 'tmke-ve-tag'; badge.id = 'tmke-ve-floattag'; badge.style.display = 'none';
    document.body.appendChild(badge);
  }

  function setOverride(sel, prop, value) {
    if (!sel) return;
    if (!overrides[sel]) overrides[sel] = {};
    overrides[sel][prop] = value; persist(); injectStyles();
  }

  /* ---- panel building blocks (collapsible groups + compact controls) ---- */
  function group(title, open) {
    var d = document.createElement('details'); d.className = 'tmke-ve-group'; if (open) d.open = true;
    var s = document.createElement('summary'); s.textContent = title; d.appendChild(s);
    var body = document.createElement('div'); body.className = 'tmke-ve-gbody'; d.appendChild(body);
    panelBody.appendChild(d); return body;
  }
  function rangeRow(parent, label, prop, sel, cs, opt) {
    var saved = overrides[sel] && overrides[sel][prop], cur;
    if (saved != null) cur = parseFloat(saved);
    else if (opt.init) cur = opt.init(cs);
    else cur = parseFloat(cs.getPropertyValue(prop)) || 0;
    var row = document.createElement('div'); row.className = 'tmke-ve-row';
    row.innerHTML = '<label>' + label + ' <span class="val"></span></label><input type="range" min="' + opt.min + '" max="' + opt.max + '" step="' + opt.step + '">';
    var input = row.querySelector('input'), valEl = row.querySelector('.val');
    input.value = cur; valEl.textContent = fmt(cur, opt.unit);
    input.addEventListener('input', function () { var v = parseFloat(input.value); valEl.textContent = fmt(v, opt.unit); setOverride(sel, prop, v + opt.unit); });
    parent.appendChild(row); return input;
  }
  function selectRow(parent, label, options, current, onChange) {
    var row = document.createElement('div'); row.className = 'tmke-ve-row';
    row.innerHTML = '<label>' + label + '</label><select>' + options.map(function (o) { return '<option value="' + o[1] + '">' + o[0] + '</option>'; }).join('') + '</select>';
    var s = row.querySelector('select'); s.value = current; s.addEventListener('change', function () { onChange(s.value); });
    parent.appendChild(row); return s;
  }
  function boolToggle(parent, label, on, onChange) {
    var row = document.createElement('div'); row.className = 'tmke-ve-row tmke-ve-toggle';
    row.innerHTML = '<label>' + label + '</label><button class="tmke-ve-switch' + (on ? ' on' : '') + '" type="button" role="switch"></button>';
    var b = row.querySelector('button');
    b.onclick = function () { var now = !b.classList.contains('on'); b.classList.toggle('on', now); onChange(now); };
    parent.appendChild(row);
  }
  function positionRows(parent, sel, el) {
    var t = getTranslate(sel);
    var row = document.createElement('div'); row.className = 'tmke-ve-row';
    row.innerHTML = '<label>Nudge position (px)</label><div class="tmke-ve-quadgrid tmke-ve-xy"></div>';
    var g = row.querySelector('.tmke-ve-xy');
    var apply = function () { setOverride(sel, 'transform', 'translate(' + (Math.round(state.x) || 0) + 'px,' + (Math.round(state.y) || 0) + 'px)'); };
    var state = { x: t.x, y: t.y };
    [['X', 'x'], ['Y', 'y']].forEach(function (ax) {
      var cell = document.createElement('label'); cell.className = 'tmke-ve-quadcell';
      cell.innerHTML = '<span>' + ax[0] + '</span><input type="number" step="1">';
      var inp = cell.querySelector('input'); inp.value = Math.round(state[ax[1]]);
      inp.addEventListener('input', function () { state[ax[1]] = parseFloat(inp.value) || 0; apply(); });
      g.appendChild(cell);
    });
    parent.appendChild(row);
    if (t.x || t.y) {
      var rrow = document.createElement('div'); rrow.className = 'tmke-ve-row'; rrow.innerHTML = '<div class="tmke-ve-chips"></div>';
      var chip = document.createElement('button'); chip.className = 'tmke-ve-chip'; chip.textContent = 'Reset to original';
      chip.onclick = function () { if (overrides[sel]) delete overrides[sel]['transform']; persist(); injectStyles(); renderPanel(el); };
      rrow.querySelector('.tmke-ve-chips').appendChild(chip); parent.appendChild(rrow);
    } else {
      var hint = document.createElement('div'); hint.className = 'tmke-ve-hint'; hint.textContent = 'Type X / Y values to nudge this element. Dragging on the page is off so nothing moves by accident.';
      parent.appendChild(hint);
    }
  }
  function sideGrid(parent, base, sel, cs) {
    var row = document.createElement('div'); row.className = 'tmke-ve-row';
    row.innerHTML = '<div class="tmke-ve-quadgrid"></div>';
    var g = row.querySelector('.tmke-ve-quadgrid');
    ['top', 'right', 'bottom', 'left'].forEach(function (side) {
      var prop = base + '-' + side;
      var saved = overrides[sel] && overrides[sel][prop];
      var cur = saved != null ? parseFloat(saved) : (parseFloat(cs.getPropertyValue(prop)) || 0);
      var cell = document.createElement('label'); cell.className = 'tmke-ve-quadcell';
      cell.innerHTML = '<span>' + side.charAt(0).toUpperCase() + '</span><input type="number" step="1">';
      var inp = cell.querySelector('input'); inp.value = Math.round(cur);
      inp.addEventListener('input', function () { setOverride(sel, prop, (parseFloat(inp.value) || 0) + 'px'); });
      g.appendChild(cell);
    });
    parent.appendChild(row);
  }
  function colourRow(parent, label, prop, sel, cs, isBg) {
    var row = document.createElement('div'); row.className = 'tmke-ve-row';
    row.innerHTML = '<label>' + label + '</label><input type="color"><div class="tmke-ve-swatches"></div>';
    var input = row.querySelector('input');
    if (isBg) { var curBg = (overrides[sel] && overrides[sel][prop]) || cs.backgroundColor; input.value = toHex(curBg && curBg !== 'rgba(0, 0, 0, 0)' && curBg !== 'transparent' ? curBg : '#ffffff'); }
    else input.value = (overrides[sel] && overrides[sel][prop]) || rgbToHex(cs.color);
    input.addEventListener('input', function () { setOverride(sel, prop, input.value); });
    var sw = row.querySelector('.tmke-ve-swatches');
    var choices = (isBg ? [['transparent', 'None'], ['#ffffff', 'White']] : []).concat(BRAND_VARS.map(function (b) { return [brandColour(b[0]), b[1]]; }));
    choices.forEach(function (item) {
      var val = item[0]; if (!val) return;
      var dot = document.createElement('button'); dot.className = 'tmke-ve-swatch'; dot.title = item[1];
      dot.style.background = (val === 'transparent') ? 'repeating-conic-gradient(#bbb 0% 25%, #fff 0% 50%) 50% / 8px 8px' : val;
      dot.onclick = function () { if (val !== 'transparent') input.value = toHex(val); setOverride(sel, prop, val); };
      sw.appendChild(dot);
    });
    parent.appendChild(row);
  }
  function shapeRow(parent, sel, el) {
    var row = document.createElement('div'); row.className = 'tmke-ve-row';
    row.innerHTML = '<label>Shape</label><div class="tmke-ve-chips"></div>';
    var c = row.querySelector('.tmke-ve-chips');
    [['Sharp', '0'], ['Soft', '14px'], ['Round', '28px'], ['Pill', '999px'], ['Circle', '50%']].forEach(function (s) {
      var chip = document.createElement('button'); chip.className = 'tmke-ve-chip'; chip.textContent = s[0];
      chip.onclick = function () { setOverride(sel, 'border-radius', s[1]); if (el.tagName === 'IMG' || getComputedStyle(el).overflow === 'visible') setOverride(sel, 'overflow', 'hidden'); };
      c.appendChild(chip);
    });
    parent.appendChild(row);
  }
  function fontControls(parent, sel, el, cs) {
    rangeRow(parent, 'Font size', 'font-size', sel, cs, { min: 8, max: 220, step: 1, unit: 'px' });
    var FONTS = [['Default', ''], ['Cormorant (serif)', '"Cormorant Garamond", Georgia, serif'], ['Darker Grotesque', '"Darker Grotesque", system-ui, sans-serif']];
    var curFont = (overrides[sel] && overrides[sel]['font-family']) || '';
    if (!curFont) { var cf = cs.fontFamily; FONTS.forEach(function (f) { if (f[1] && cf.indexOf(f[1].split(',')[0].replace(/"/g, '')) === 0) curFont = f[1]; }); }
    selectRow(parent, 'Font', FONTS, curFont, function (v) { if (v) setOverride(sel, 'font-family', v); else { if (overrides[sel]) delete overrides[sel]['font-family']; persist(); injectStyles(); } });
    var curW = (overrides[sel] && overrides[sel]['font-weight']) || String(Math.round(parseInt(cs.fontWeight, 10) / 100) * 100) || '400';
    selectRow(parent, 'Weight', ['300', '400', '500', '600', '700', '800'].map(function (w) { return [w, w]; }), curW, function (v) { setOverride(sel, 'font-weight', v); });
    rangeRow(parent, 'Letter spacing', 'letter-spacing', sel, cs, { min: -6, max: 12, step: 0.1, unit: 'px', init: function (cs2) { var l = cs2.letterSpacing; return l === 'normal' ? 0 : (parseFloat(l) || 0); } });
    rangeRow(parent, 'Line height', 'line-height', sel, cs, { min: 0.8, max: 2.4, step: 0.01, unit: '', init: function (cs2) { var lh = cs2.lineHeight; return lh === 'normal' ? 1.2 : (parseFloat(lh) / parseFloat(cs2.fontSize)); } });
    colourRow(parent, 'Text colour', 'color', sel, cs, false);
    var tRow = document.createElement('div'); tRow.className = 'tmke-ve-row';
    var tBtn = document.createElement('button'); tBtn.className = 'tmke-ve-reset'; tBtn.textContent = '✎ Edit wording';
    tBtn.onclick = function () { captureBase(sel, el); startTextEdit(el, sel); };
    tRow.appendChild(tBtn); parent.appendChild(tRow);
  }
  function sourceRow(parent, label, sel, el, kind) {
    var row = document.createElement('div'); row.className = 'tmke-ve-row';
    row.innerHTML = '<label>' + label + '</label><input type="text" class="tmke-ve-text" placeholder="https://… or /assets/…">';
    var inp = row.querySelector('input');
    inp.value = (overrides[sel] && overrides[sel].__src) || (el.getAttribute('src') || '');
    inp.addEventListener('change', function () {
      var v = inp.value.trim(); if (!v) return; captureBase(sel, el);
      if (!overrides[sel]) overrides[sel] = {}; overrides[sel].__src = v; persist(); el.src = v;
    });
    parent.appendChild(row);
  }
  function bgImageRows(parent, sel, el, cs) {
    var row = document.createElement('div'); row.className = 'tmke-ve-row';
    row.innerHTML = '<label>Background image</label><input type="text" class="tmke-ve-text" placeholder="/assets/… (blank to remove)">';
    var inp = row.querySelector('input'); inp.value = (overrides[sel] && overrides[sel].__src) || extractUrl(cs.backgroundImage);
    inp.addEventListener('change', function () {
      var v = inp.value.trim(); captureBase(sel, el);
      if (!overrides[sel]) overrides[sel] = {}; overrides[sel].__src = v; persist();
      el.style.backgroundImage = v ? ("url('" + v + "')") : '';
    });
    parent.appendChild(row);
    selectRow(parent, 'Image size', [['Cover (fill area)', 'cover'], ['Contain (whole image)', 'contain'], ['Original', 'auto']], (overrides[sel] && overrides[sel]['background-size']) || (/^(cover|contain)$/.test(cs.backgroundSize) ? cs.backgroundSize : 'cover'), function (v) { setOverride(sel, 'background-size', v); });
    selectRow(parent, 'Image position', [['Center', 'center'], ['Top', 'top'], ['Bottom', 'bottom'], ['Left', 'left'], ['Right', 'right']], (overrides[sel] && overrides[sel]['background-position']) || 'center', function (v) { setOverride(sel, 'background-position', v); });
  }
  function attrToggles(parent, sel, el, attrs) {
    attrs.forEach(function (a) {
      var name = a[0];
      var cur = (overrides[sel] && overrides[sel].__attrs && overrides[sel].__attrs[name] != null) ? overrides[sel].__attrs[name] : el.hasAttribute(name);
      boolToggle(parent, a[1], !!cur, function (on) {
        if (!overrides[sel]) overrides[sel] = {}; if (!overrides[sel].__attrs) overrides[sel].__attrs = {};
        overrides[sel].__attrs[name] = on; persist();
        if (on) el.setAttribute(name, ATTR_BOOL[name] ? '' : 'true'); else el.removeAttribute(name);
      });
    });
  }
  function columnSplit(parent, el, cs, sel) {
    if (cs.display !== 'grid') return;
    var tracks = cs.gridTemplateColumns.split(' ').filter(Boolean).map(parseFloat);
    if (!(tracks.length === 2 && tracks[0] && tracks[1])) return;
    var savedR = overrides[sel] && overrides[sel]['grid-template-columns'];
    var ratio = savedR ? (parseFloat(savedR) / (parseFloat(savedR) + parseFloat(savedR.split(' ')[1]))) : tracks[0] / (tracks[0] + tracks[1]);
    var row = document.createElement('div'); row.className = 'tmke-ve-row';
    row.innerHTML = '<label>Column split <span class="val"></span></label><input type="range" min="20" max="80" step="1">';
    var input = row.querySelector('input'), valEl = row.querySelector('.val'); input.value = Math.round(ratio * 100);
    var setSplit = function (pct) { valEl.textContent = pct + ' / ' + (100 - pct); setOverride(sel, 'grid-template-columns', pct + 'fr ' + (100 - pct) + 'fr'); };
    input.addEventListener('input', function () { setSplit(parseInt(input.value, 10)); }); valEl.textContent = input.value + ' / ' + (100 - input.value);
    parent.appendChild(row);
  }
  function iconGroup(iconSvg) {
    var icSel = selectorFor(iconSvg);
    var parent = group('Icon', true);
    var row = document.createElement('div'); row.className = 'tmke-ve-row'; row.innerHTML = '<label>Pick an icon</label><div class="tmke-ve-icons"></div>';
    var ig = row.querySelector('.tmke-ve-icons');
    ICONS.forEach(function (ic) {
      var b = document.createElement('button'); b.className = 'tmke-ve-iconbtn'; b.title = ic[0];
      b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20">' + ic[1] + '</svg>';
      b.onclick = function () { captureBase(icSel, iconSvg); if (!overrides[icSel]) overrides[icSel] = {}; overrides[icSel].__icon = ic[1]; persist(); iconSvg.setAttribute('viewBox', '0 0 24 24'); iconSvg.innerHTML = ic[1]; };
      ig.appendChild(b);
    });
    parent.appendChild(row);
  }
  function blurRow(parent, sel, cs) {
    var saved = overrides[sel] && overrides[sel]['filter'];
    var cur = saved ? (parseFloat((String(saved).match(/blur\(([\d.]+)px\)/) || [])[1]) || 0) : 0;
    var row = document.createElement('div'); row.className = 'tmke-ve-row';
    row.innerHTML = '<label>Blur <span class="val">' + cur + 'px</span></label><input type="range" min="0" max="30" step="0.5">';
    var input = row.querySelector('input'), valEl = row.querySelector('.val'); input.value = cur;
    input.addEventListener('input', function () { var v = parseFloat(input.value); valEl.textContent = v + 'px'; if (v > 0) setOverride(sel, 'filter', 'blur(' + v + 'px)'); else { if (overrides[sel]) delete overrides[sel]['filter']; persist(); injectStyles(); } });
    parent.appendChild(row);
  }
  function effectsGroup(sel, el, cs) {
    var ge = group('Effects (opacity & blur)', false);
    rangeRow(ge, 'Opacity', 'opacity', sel, cs, { min: 0, max: 1, step: 0.05, unit: '', init: function (cs2) { return parseFloat(cs2.opacity) || 1; } });
    blurRow(ge, sel, cs);
  }
  function lineGroup(sel, el, cs) {
    var isV = el.classList.contains('ve-line--v');
    var gl = group('Line', true);
    rangeRow(gl, 'Thickness', isV ? 'width' : 'height', sel, cs, { min: 1, max: 40, step: 1, unit: 'px' });
    rangeRow(gl, 'Length', isV ? 'height' : 'width', sel, cs, { min: 20, max: 1200, step: 10, unit: 'px', init: function (cs2) { return parseFloat(isV ? cs2.height : cs2.width) || 200; } });
    colourRow(gl, 'Colour', 'background-color', sel, cs, false);
  }
  function gradientGroup(sel, el) {
    var gg = group('Gradient', true);
    var saved = (overrides[sel] && overrides[sel].__grad) || { dir: 'to bottom', c1: '#000000', fade: true, c2: '#ffffff' };
    var apply = function () {
      if (!overrides[sel]) overrides[sel] = {}; overrides[sel].__grad = saved;
      var end = saved.fade ? hexToRgba(saved.c1, 0) : saved.c2;
      setOverride(sel, 'background-image', 'linear-gradient(' + saved.dir + ',' + saved.c1 + ',' + end + ')');
    };
    selectRow(gg, 'Direction', [['Top → Bottom', 'to bottom'], ['Bottom → Top', 'to top'], ['Left → Right', 'to right'], ['Right → Left', 'to left'], ['Diagonal', '135deg']], saved.dir, function (v) { saved.dir = v; apply(); });
    var c1Row = document.createElement('div'); c1Row.className = 'tmke-ve-row'; c1Row.innerHTML = '<label>Start colour</label><input type="color">';
    var c1 = c1Row.querySelector('input'); c1.value = toHex(saved.c1); c1.addEventListener('input', function () { saved.c1 = c1.value; apply(); }); gg.appendChild(c1Row);
    boolToggle(gg, 'Fade to transparent', saved.fade, function (on) { saved.fade = on; apply(); renderPanel(el); });
    if (!saved.fade) {
      var c2Row = document.createElement('div'); c2Row.className = 'tmke-ve-row'; c2Row.innerHTML = '<label>End colour</label><input type="color">';
      var c2 = c2Row.querySelector('input'); c2.value = toHex(saved.c2); c2.addEventListener('input', function () { saved.c2 = c2.value; apply(); }); gg.appendChild(c2Row);
    }
  }
  function animRows(parent, sel, el) {
    var animSaved = overrides[sel] && overrides[sel]['animation'];
    var animName = (animSaved && animSaved !== 'none') ? animSaved.split(' ')[0] : '';
    var animDur = animSaved ? (parseFloat(animSaved.split(' ')[1]) || 0.6) : 0.6;
    // surface any animation the element already has from the site's own CSS
    var liveAnim = getComputedStyle(el).animationName;
    var known = ANIMS.some(function (a) { return a[1] === liveAnim; });
    if (!animName && liveAnim && liveAnim !== 'none') { if (known) animName = liveAnim; }
    var row = document.createElement('div'); row.className = 'tmke-ve-row';
    row.innerHTML = '<label>Effect</label><select>' + ANIMS.map(function (a) { return '<option value="' + a[1] + '">' + a[0] + '</option>'; }).join('') +
      '</select><label style="margin-top:10px">Duration <span class="val">' + animDur.toFixed(1) + 's</span></label><input type="range" min="0.2" max="2.5" step="0.1">';
    var aSel = row.querySelector('select'); aSel.value = animName; var aDur = row.querySelector('input'); aDur.value = animDur; var aVal = row.querySelector('.val');
    var apply = function () { var name = aSel.value, dur = parseFloat(aDur.value); aVal.textContent = dur.toFixed(1) + 's'; setOverride(sel, 'animation', name ? (name + ' ' + dur + 's ease both') : 'none'); };
    aSel.addEventListener('change', apply); aDur.addEventListener('input', apply);
    parent.appendChild(row);
    if (liveAnim && liveAnim !== 'none' && !known && !animSaved) {
      var hint = document.createElement('div'); hint.className = 'tmke-ve-hint'; hint.textContent = 'This element already animates on scroll (“' + liveAnim + '”). Choosing an effect here replaces it.';
      parent.appendChild(hint);
    }
  }

  function renderPanel(el) {
    var sel = selectorFor(el), cs = getComputedStyle(el);
    panelBody.innerHTML = '';
    var isImg = el.tagName === 'IMG', isVid = el.tagName === 'VIDEO';
    var iconSvg = el.tagName.toLowerCase() === 'svg' ? el : (el.querySelector ? el.querySelector('svg') : null);
    var hasBg = !isImg && !isVid && cs.backgroundImage && cs.backgroundImage !== 'none';
    var isSection = el.tagName === 'SECTION';
    var textEl = isTextEl(el);
    var cl = el.classList || { contains: function () { return false; } };
    var isShape = cl.contains('ve-shape'), isLine = cl.contains('ve-line'), isGradient = cl.contains('ve-gradient');
    var kind = isGradient ? 'Gradient' : isLine ? 'Line' : isShape ? 'Shape' : isImg ? 'Image' : isVid ? 'Video' : iconSvg ? 'Icon' : isSection ? 'Section' : textEl ? 'Text' : el.tagName.toLowerCase();
    tagBadge.textContent = kind;
    panel.querySelector('#tmke-ve-eltxt').textContent = '“' + (el.textContent || '').trim().slice(0, 22) + '”';

    // POSITION — exact X/Y nudge from the sidebar (no dragging on the page)
    var gp = group('Position', true);
    positionRows(gp, sel, el);

    // GRADIENT / LINE / SHAPE (added blocks get tailored controls)
    if (isGradient) gradientGroup(sel, el);
    if (isLine) lineGroup(sel, el, cs);

    // TEXT
    if (textEl) fontControls(group('Text', true), sel, el, cs);

    // IMAGE
    if (isImg) {
      var gi = group('Image', true);
      sourceRow(gi, 'Image URL', sel, el, 'img');
      selectRow(gi, 'Fit', [['Cover', 'cover'], ['Contain', 'contain'], ['Fill', 'fill'], ['None', 'none']], (overrides[sel] && overrides[sel]['object-fit']) || cs.objectFit || 'cover', function (v) { setOverride(sel, 'object-fit', v); });
      rangeRow(gi, 'Width', 'max-width', sel, cs, { min: 40, max: 1680, step: 10, unit: 'px', init: function (cs2) { return cs2.maxWidth === 'none' ? (parseFloat(cs2.width) || 400) : parseFloat(cs2.maxWidth); } });
      shapeRow(gi, sel, el);
    }

    // VIDEO
    if (isVid) {
      var gv = group('Video', true);
      sourceRow(gv, 'Video URL', sel, el, 'video');
      selectRow(gv, 'Fit', [['Cover', 'cover'], ['Contain', 'contain'], ['Fill', 'fill']], (overrides[sel] && overrides[sel]['object-fit']) || cs.objectFit || 'cover', function (v) { setOverride(sel, 'object-fit', v); });
      attrToggles(gv, sel, el, [['controls', 'Show controls'], ['autoplay', 'Autoplay'], ['loop', 'Loop'], ['muted', 'Muted']]);
      shapeRow(gv, sel, el);
    }

    // ICON
    if (iconSvg) iconGroup(iconSvg);

    // BACKGROUND (non media; gradient/line handle their own colour)
    if (!isImg && !isVid && !isGradient && !isLine) {
      var gb = group('Background', isSection || hasBg || isShape);
      colourRow(gb, isShape ? 'Fill colour' : 'Background colour', 'background-color', sel, cs, true);
      if (!isShape) bgImageRows(gb, sel, el, cs);
    }

    // SPACING — each its own collapsible box
    sideGrid(group('Margins', false), 'margin', sel, cs);
    sideGrid(group('Padding', false), 'padding', sel, cs);
    if (isContainer(el, cs)) {
      var gg = group('Layout (gap & columns)', false);
      rangeRow(gg, 'Gap between items', 'gap', sel, cs, { min: 0, max: 160, step: 1, unit: 'px' });
      columnSplit(gg, el, cs, sel);
    }

    // SIZE & SHAPE (non-image/line/gradient; those size via handles or their own box)
    if (!isImg && !isLine && !isGradient) {
      var gs = group('Size & shape', false);
      rangeRow(gs, 'Max width', 'max-width', sel, cs, { min: 280, max: 1680, step: 10, unit: 'px', init: function (cs2) { return cs2.maxWidth === 'none' ? 1360 : parseFloat(cs2.maxWidth); } });
      rangeRow(gs, 'Corner radius', 'border-radius', sel, cs, { min: 0, max: 200, step: 1, unit: 'px' });
      shapeRow(gs, sel, el);
    }

    // SECTION-level controls — height presets, side margins, sticky
    if (isSection) {
      var gsec = group('Section', true);
      // Height presets: Auto / Half / Full screen
      var hrow = document.createElement('div'); hrow.className = 'tmke-ve-row';
      hrow.innerHTML = '<label>Section height</label><div class="tmke-ve-chips"></div>';
      var hc = hrow.querySelector('.tmke-ve-chips');
      var curMin = (overrides[sel] && overrides[sel]['min-height']) || '';
      [['Auto', ''], ['Half screen', '50vh'], ['Full screen', '100vh']].forEach(function (p) {
        var chip = document.createElement('button'); chip.className = 'tmke-ve-chip'; chip.textContent = p[0];
        if (curMin === p[1]) chip.classList.add('on');
        chip.onclick = function () { if (p[1]) setOverride(sel, 'min-height', p[1]); else { if (overrides[sel]) delete overrides[sel]['min-height']; persist(); injectStyles(); } renderPanel(el); };
        hc.appendChild(chip);
      });
      gsec.appendChild(hrow);
      // Side margins (left & right) — one slider; works even on full-screen sections
      var curPad = (overrides[sel] && overrides[sel]['padding-left'] != null) ? parseFloat(overrides[sel]['padding-left']) : (parseFloat(cs.paddingLeft) || 0);
      var mrow = document.createElement('div'); mrow.className = 'tmke-ve-row';
      mrow.innerHTML = '<label>Side margins (left &amp; right) <span class="val">' + Math.round(curPad) + 'px</span></label><input type="range" min="0" max="320" step="2">';
      var mInput = mrow.querySelector('input'), mVal = mrow.querySelector('.val'); mInput.value = curPad;
      mInput.addEventListener('input', function () { var v = parseFloat(mInput.value); mVal.textContent = Math.round(v) + 'px'; if (!overrides[sel]) overrides[sel] = {}; overrides[sel]['padding-left'] = v + 'px'; overrides[sel]['padding-right'] = v + 'px'; persist(); injectStyles(); });
      gsec.appendChild(mrow);
      boolToggle(gsec, 'Sticky hold (pin on scroll)', (overrides[sel] && overrides[sel]['position']) === 'sticky', function (on) { if (on) { setOverride(sel, 'position', 'sticky'); setOverride(sel, 'top', '0px'); } else { if (overrides[sel]) { delete overrides[sel]['position']; delete overrides[sel]['top']; } persist(); injectStyles(); } });
    }

    // EFFECTS (opacity + blur) — on everything except whole sections
    if (!isSection) effectsGroup(sel, el, cs);

    // ANIMATION (whole-element entrance effect — works on sections too)
    animRows(group('Animation', false), sel, el);

    // RESET (no reload — reverts styles + content live)
    var reset = document.createElement('button'); reset.className = 'tmke-ve-reset tmke-ve-danger'; reset.textContent = 'Reset this element';
    reset.onclick = function () { delete overrides[sel]; persist(); injectStyles(); applyContent(); renderPanel(el); };
    panelBody.appendChild(reset);
  }

  /* ---- interactions ---- */
  function wirePageInteractions() {
    document.addEventListener('mouseover', function (e) {
      if (!editingEnabled || isChrome(e.target)) return;
      var el = e.target.closest(EDITABLE); clearHover();
      if (el && !isChrome(el)) { el.classList.add('tmke-ve-hover'); showFloatTag(el); }
    }, true);
    document.addEventListener('mouseout', function () { clearHover(); hideFloatTag(); }, true);
    document.addEventListener('click', function (e) {
      if (!editingEnabled || isChrome(e.target)) return;
      if (suppressNextClick) { suppressNextClick = false; e.preventDefault(); e.stopPropagation(); return; }
      if (e.target.isContentEditable) return;
      var el = e.target.closest(EDITABLE); if (!el) return;
      e.preventDefault(); e.stopPropagation(); select(el);
    }, true);
    document.addEventListener('keydown', function (e) {
      if (!editingEnabled) return;
      var tgt = e.target;
      if (tgt && (tgt.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName))) return;
      var z = (e.key === 'z' || e.key === 'Z'), y = (e.key === 'y' || e.key === 'Y');
      if ((e.ctrlKey || e.metaKey) && z && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && ((z && e.shiftKey) || y)) { e.preventDefault(); redo(); }
    }, true);
    // Drag-to-move is intentionally disabled — clients kept nudging things by
    // accident. Position is now set from the sidebar via X/Y fields instead.
  }

  /* Elements that drive scroll animations — draggable-locked so a move can't
     break the effect. (Text inside them stays selectable + editable.) */
  var NO_DRAG = '.approach-pin, .approach-photo-layer, .approach-photo, .approach-overlay, .shelf-scene, .shelf-stage, .shelf-rec, [data-photo], [data-ve-lock]';
  function isDragLocked(el) {
    if (el.closest && el.closest(NO_DRAG)) return true;
    var n = el;
    while (n && n !== document.body) { if (n.style && n.style.transform && !(dragging && dragging.el === n)) return true; n = n.parentElement; }
    return false;
  }

  /* ---- Drag-to-move + smart alignment guides ---- */
  var dragging = null, dragCands = null, guideLayer = null, suppressNextClick = false;
  function getTranslate(sel) {
    var saved = overrides[sel] && overrides[sel]['transform'];
    if (saved) { var m = String(saved).match(/translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px/); if (m) return { x: parseFloat(m[1]), y: parseFloat(m[2]) }; }
    return { x: 0, y: 0 };
  }
  function wireDrag() {
    document.addEventListener('mousedown', function (e) {
      if (!editingEnabled || e.button !== 0 || isChrome(e.target) || e.target.isContentEditable) return;
      var el = (selected && selected.contains && selected.contains(e.target)) ? selected : e.target.closest(EDITABLE);
      if (!el || el === document.body) return;
      if (isDragLocked(el)) return;                 // don't drag scroll-animated elements
      var sel = selectorFor(el), base = getTranslate(sel);
      dragging = { el: el, sel: sel, sx: e.clientX, sy: e.clientY, bx: base.x, by: base.y, rect0: el.getBoundingClientRect(), moved: false, lx: base.x, ly: base.y };
      dragCands = gatherCandidates(el);
    }, true);
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - dragging.sx, dy = e.clientY - dragging.sy;
      if (!dragging.moved && (Math.abs(dx) + Math.abs(dy)) < 4) return;
      if (!dragging.moved) { dragging.moved = true; if (selected !== dragging.el) select(dragging.el); document.body.style.userSelect = 'none'; }
      var snap = computeSnap(dragging, dragging.bx + dx, dragging.by + dy);
      dragging.lx = snap.x; dragging.ly = snap.y;
      dragging.el.style.setProperty('transform', 'translate(' + Math.round(snap.x) + 'px,' + Math.round(snap.y) + 'px)', 'important');
      drawGuides(snap.guides);
      e.preventDefault();
    }, true);
    document.addEventListener('mouseup', function (e) {
      if (!dragging) return;
      var d = dragging; dragging = null; document.body.style.userSelect = ''; clearGuides();
      if (d.moved) {
        d.el.style.removeProperty('transform');
        setOverride(d.sel, 'transform', 'translate(' + Math.round(d.lx) + 'px,' + Math.round(d.ly) + 'px)');
        suppressNextClick = true; e.preventDefault(); e.stopPropagation();
      }
    }, true);
  }
  function gatherCandidates(el) {
    var vx = [], hy = [], push = function (node) {
      if (node === el) return; var r = node.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      vx.push(r.left, r.left + r.width / 2, r.right); hy.push(r.top, r.top + r.height / 2, r.bottom);
    };
    var p = el.parentElement;
    if (p) { push(p); for (var i = 0; i < p.children.length; i++) push(p.children[i]); }
    return { vx: vx, hy: hy };
  }
  function computeSnap(d, nx, ny) {
    var TH = 6, ox = nx - d.bx, oy = ny - d.by;
    var box = { l: d.rect0.left + ox, r: d.rect0.right + ox, t: d.rect0.top + oy, b: d.rect0.bottom + oy };
    box.cx = (box.l + box.r) / 2; box.cy = (box.t + box.b) / 2;
    var guides = [];
    var best = function (edges, cands) { var bb = null; edges.forEach(function (v) { cands.forEach(function (c) { var dd = c - v; if (Math.abs(dd) <= TH && (!bb || Math.abs(dd) < Math.abs(bb.dd))) bb = { dd: dd, line: c }; }); }); return bb; };
    var vb = best([box.l, box.cx, box.r], dragCands.vx); if (vb) { nx += vb.dd; guides.push({ t: 'v', pos: vb.line }); }
    var hb = best([box.t, box.cy, box.b], dragCands.hy); if (hb) { ny += hb.dd; guides.push({ t: 'h', pos: hb.line }); }
    return { x: nx, y: ny, guides: guides };
  }
  function drawGuides(guides) {
    clearGuides(); if (!guides.length) return;
    guideLayer = document.createElement('div'); guideLayer.id = 'tmke-ve-guides';
    guides.forEach(function (g) { var ln = document.createElement('div'); ln.className = 'tmke-ve-guide ' + g.t; if (g.t === 'v') ln.style.left = g.pos + 'px'; else ln.style.top = g.pos + 'px'; guideLayer.appendChild(ln); });
    document.body.appendChild(guideLayer);
  }
  function clearGuides() { if (guideLayer) { guideLayer.remove(); guideLayer = null; } }

  /* ---- Rulers (editor-only guides; not published) ---- */
  var rulers = [];
  function loadRulers() { try { rulers = JSON.parse(localStorage.getItem('tmke-ve-rulers') || '[]'); } catch (e) { rulers = []; } }
  function saveRulers() { try { localStorage.setItem('tmke-ve-rulers', JSON.stringify(rulers)); } catch (e) {} renderRulers(); }
  function addRuler(t) { rulers.push({ t: t, pos: t === 'v' ? 80 : 200 }); saveRulers(); }
  function renderRulers() {
    var old = document.getElementById('tmke-ve-rulers'); if (old) old.remove();
    if (!editingEnabled || !rulers.length) return;
    var layer = document.createElement('div'); layer.id = 'tmke-ve-rulers';
    rulers.forEach(function (r, idx) {
      var ln = document.createElement('div'); ln.className = 'tmke-ve-ruler ' + r.t;
      ln.style[r.t === 'v' ? 'left' : 'top'] = r.pos + 'px';
      var lab = document.createElement('span'); lab.className = 'lab'; lab.textContent = Math.round(r.pos) + 'px'; ln.appendChild(lab);
      ln.addEventListener('mousedown', function (e) {
        e.preventDefault(); e.stopPropagation();
        var move = function (ev) { r.pos = (r.t === 'v') ? ev.clientX : ev.clientY; ln.style[r.t === 'v' ? 'left' : 'top'] = r.pos + 'px'; lab.textContent = Math.round(r.pos) + 'px'; };
        var up = function () { document.removeEventListener('mousemove', move, true); document.removeEventListener('mouseup', up, true); saveRulers(); };
        document.addEventListener('mousemove', move, true); document.addEventListener('mouseup', up, true);
      }, true);
      ln.addEventListener('dblclick', function (e) { e.preventDefault(); rulers.splice(idx, 1); saveRulers(); });
      layer.appendChild(ln);
    });
    document.body.appendChild(layer);
  }
  function select(el) { deselect(); selected = el; el.classList.add('tmke-ve-selected'); crumbEl.textContent = pathLabel(el); renderPanel(el); showHandles(el); }
  function deselect() {
    if (selected) selected.classList.remove('tmke-ve-selected');
    selected = null; removeHandles();
    if (panelBody) panelBody.innerHTML = '<div class="tmke-ve-empty">Select any element on the page — text, image, section — to edit it here.</div>';
    if (tagBadge) tagBadge.textContent = 'Nothing selected';
    var t = panel && panel.querySelector('#tmke-ve-eltxt'); if (t) t.textContent = '';
  }

  /* ---- resize handles (corner-drag to scale text / images / shapes) ---- */
  var handleLayer = null, hdlWired = false;
  function showHandles(el) {
    removeHandles();
    if (!el || el === document.body || el.tagName === 'SECTION' || isChrome(el)) return;
    handleLayer = document.createElement('div'); handleLayer.id = 'tmke-ve-handles';
    ['nw', 'ne', 'sw', 'se'].forEach(function (pos) {
      var h = document.createElement('div'); h.className = 'tmke-ve-handle ' + pos;
      h.addEventListener('mousedown', function (e) { startResize(e, el, pos); });
      handleLayer.appendChild(h);
    });
    document.body.appendChild(handleLayer);
    positionHandles(el);
    if (!hdlWired) {
      hdlWired = true;
      var reflow = function () { if (selected && handleLayer) positionHandles(selected); };
      window.addEventListener('scroll', reflow, true);
      window.addEventListener('resize', reflow);
      if (window.__lenis && window.__lenis.on) window.__lenis.on('scroll', reflow);
    }
  }
  function positionHandles(el) {
    if (!handleLayer) return; var r = el.getBoundingClientRect();
    handleLayer.style.left = r.left + 'px'; handleLayer.style.top = r.top + 'px';
    handleLayer.style.width = r.width + 'px'; handleLayer.style.height = r.height + 'px';
  }
  function removeHandles() { if (handleLayer) { handleLayer.remove(); handleLayer = null; } }
  function startResize(e, el, pos) {
    e.preventDefault(); e.stopPropagation();
    var sel = selectorFor(el), r = el.getBoundingClientRect();
    var sx = e.clientX, sy = e.clientY, w0 = r.width, h0 = r.height, ar = w0 / (h0 || 1);
    var isImg = el.tagName === 'IMG', isLine = el.classList && el.classList.contains('ve-line');
    var moved = false;
    document.body.style.userSelect = 'none';
    var move = function (ev) {
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      var fx = (pos === 'ne' || pos === 'se') ? 1 : -1, fy = (pos === 'sw' || pos === 'se') ? 1 : -1;
      var w = Math.max(16, w0 + dx * fx), h = Math.max(10, h0 + dy * fy);
      if (isImg) { h = w / ar; el.style.setProperty('height', 'auto', 'important'); }
      el.style.setProperty('width', Math.round(w) + 'px', 'important');
      if (!isImg) el.style.setProperty('height', Math.round(h) + 'px', 'important');
      positionHandles(el); moved = true;
    };
    var up = function () {
      document.removeEventListener('mousemove', move, true); document.removeEventListener('mouseup', up, true);
      document.body.style.userSelect = '';
      if (moved) {
        var r2 = el.getBoundingClientRect();
        el.style.removeProperty('width'); el.style.removeProperty('height');
        setOverride(sel, 'width', Math.round(r2.width) + 'px');
        setOverride(sel, isImg ? 'height' : 'height', isImg ? 'auto' : (Math.round(r2.height) + 'px'));
        positionHandles(el);
      }
    };
    document.addEventListener('mousemove', move, true); document.addEventListener('mouseup', up, true);
  }
  function clearHover() { Array.prototype.forEach.call(document.querySelectorAll('.tmke-ve-hover'), function (n) { n.classList.remove('tmke-ve-hover'); }); }
  function showFloatTag(el) { var t = document.getElementById('tmke-ve-floattag'); if (!t) return; var r = el.getBoundingClientRect(); t.textContent = el.tagName.toLowerCase(); t.style.left = r.left + 'px'; t.style.top = (r.top - 4) + 'px'; t.style.display = 'block'; }
  function hideFloatTag() { var t = document.getElementById('tmke-ve-floattag'); if (t) t.style.display = 'none'; }
  function isChrome(el) { return !!(el && el.closest && (el.closest('.tmke-ve-bar') || el.closest('.tmke-ve-panel') || el.closest('.tmke-ve-addmenu') || el.closest('.tmke-ve-prebar') || el.closest('#tmke-ve-rulers') || el.closest('#tmke-ve-guides') || el.closest('#tmke-ve-handles') || el.id === 'tmke-ve-floattag' || el.id === 'tmke-ve-ghost')); }
  function pathLabel(el) { var bits = [], n = el; for (var i = 0; i < 3 && n && n !== document.body; i++) { bits.unshift(n.tagName.toLowerCase()); n = n.parentElement; } return bits.join(' › '); }

  /* ---- content helpers ---- */
  function startTextEdit(el, sel) {
    el.setAttribute('contenteditable', 'true'); el.focus();
    var range = document.createRange(); range.selectNodeContents(el);
    var s2 = window.getSelection(); s2.removeAllRanges(); s2.addRange(range);
    var finish = function () { el.removeAttribute('contenteditable'); el.removeEventListener('blur', finish); el.removeEventListener('keydown', onKey); if (!overrides[sel]) overrides[sel] = {}; overrides[sel].__html = el.innerHTML; persist(); };
    var onKey = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); } };
    el.addEventListener('blur', finish); el.addEventListener('keydown', onKey);
  }
  function extractUrl(bg) { var m = (bg || '').match(/url\(["']?(.*?)["']?\)/); return m ? m[1] : ''; }

  /* ---- misc helpers ---- */
  function fmt(v, unit) { return (unit === '' ? v.toFixed(2) : Math.round(v * 10) / 10 + unit); }
  function rgbToHex(rgb) { var m = (rgb || '').match(/\d+/g); if (!m) return '#000000'; return '#' + m.slice(0, 3).map(function (x) { return ('0' + parseInt(x, 10).toString(16)).slice(-2); }).join(''); }
  function toHex(c) { c = (c || '').trim(); if (c[0] === '#') return c.length === 4 ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(0, 7); return rgbToHex(c); }
  function hexToRgba(hex, a) { var h = toHex(hex).replace('#', ''); var n = parseInt(h, 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
})();
