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
  function applyContent() {
    Object.keys(overrides).forEach(function (sel) {
      var o = overrides[sel], el;
      try { el = document.querySelector(sel); } catch (e) { return; }
      if (!el) return;
      if (o.__html != null) el.innerHTML = o.__html;
      if (o.__src != null) { if (el.tagName === 'IMG') el.src = o.__src; else el.style.backgroundImage = "url('" + o.__src + "')"; }
    });
  }
  function applyAll() { injectStyles(); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyContent, { once: true }); else applyContent(); }

  /* ---- save (draft) ---- */
  var saveTimer = null, onDirty = null;
  function persist() {
    Local.save(overrides);
    if (remote && store) { clearTimeout(saveTimer); saveTimer = setTimeout(function () { store.saveDraft(overrides); }, 600); }
    if (onDirty) onDirty();
  }

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
  var EDITABLE = 'h1,h2,h3,h4,h5,h6,p,span,a,button,li,blockquote,em,strong,figcaption,img,' +
    'div,section,article,figure,ul,ol,aside,header,footer,form';
  var CONTROLS = [
    { prop: 'font-size',      label: 'Font size',      unit: 'px', min: 8,   max: 220, step: 1,   when: function (el) { return isTextEl(el); } },
    { prop: 'line-height',    label: 'Line height',    unit: '',   min: 0.8, max: 2.4, step: 0.01, when: function (el) { return isTextEl(el); } },
    { prop: 'letter-spacing', label: 'Letter spacing', unit: 'px', min: -6,  max: 12,  step: 0.1, when: function (el) { return isTextEl(el); } },
    { prop: 'margin-top',     label: 'Space above (margin)',  unit: 'px', min: 0, max: 280, step: 1 },
    { prop: 'margin-bottom',  label: 'Space below (margin)',  unit: 'px', min: 0, max: 280, step: 1 },
    { prop: 'padding-top',    label: 'Padding top',    unit: 'px', min: 0,   max: 240, step: 1 },
    { prop: 'padding-bottom', label: 'Padding bottom', unit: 'px', min: 0,   max: 240, step: 1 },
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
      'body.tmke-ve-on{padding-top:46px!important;}',
      '.tmke-ve-panel{position:fixed;top:62px;right:16px;z-index:2147483645;width:268px;background:#22232a;color:#f2efe9;border:1px solid rgba(255,255,255,.12);border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.45);font:13px system-ui,sans-serif;overflow:hidden;display:none;}',
      '.tmke-ve-panel.open{display:block;}',
      '.tmke-ve-panel-h{padding:12px 14px;background:rgba(255,255,255,.05);font-weight:700;display:flex;align-items:center;justify-content:space-between;}',
      '.tmke-ve-panel-h small{font-weight:500;opacity:.6;font-size:11px;}',
      '.tmke-ve-body{padding:6px 14px 14px;max-height:70vh;overflow:auto;}',
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
      '.tmke-ve-reset{width:100%;margin-top:6px;padding:9px;border-radius:7px;background:transparent;border:1px solid rgba(255,255,255,.25);color:#f2efe9;font:600 12px system-ui,sans-serif;cursor:pointer;}',
      '.tmke-ve-reset:hover{background:rgba(255,255,255,.08);}',
    ].join('');
    document.head.appendChild(s);
    document.body.classList.add('tmke-ve-on');
  }

  function buildToolbar(isRemote) {
    var bar = document.createElement('div'); bar.className = 'tmke-ve-bar';
    bar.innerHTML = '<b>Website Editor</b><span class="tag">' + (isRemote ? '' : 'Local preview') + '</span>' +
      '<span class="status" id="tmke-ve-status"></span>' +
      '<span class="crumb" id="tmke-ve-crumb">Click any element to edit it</span>';
    bar.appendChild(btn('Reset all', function () {
      if (!confirm('Remove every saved change on this page?')) return;
      overrides = {}; persist(); injectStyles(); deselect();
      if (remote && store) store.saveDraft(overrides);
    }));
    if (isRemote) {
      var pub = btn('Publish', function () {
        statusEl.textContent = 'Publishing…';
        store.publish(overrides).then(function () { statusEl.textContent = 'Published ✓'; setTimeout(function () { statusEl.textContent = ''; }, 2500); })
          .catch(function () { statusEl.textContent = 'Publish failed'; });
      });
      pub.className = 'primary'; bar.appendChild(pub);
    }
    bar.appendChild(btn('Done', function () { var u = new URL(location.href); u.searchParams.delete('edit'); location.href = u.toString(); }));
    document.body.appendChild(bar);
    crumbEl = bar.querySelector('#tmke-ve-crumb');
    statusEl = bar.querySelector('#tmke-ve-status');
    onDirty = function () { if (remote) { statusEl.textContent = 'Draft saved'; } };
  }
  function btn(label, fn) { var b = document.createElement('button'); b.textContent = label; b.onclick = fn; return b; }

  function buildPanel() {
    panel = document.createElement('div'); panel.className = 'tmke-ve-panel';
    panel.innerHTML = '<div class="tmke-ve-panel-h"><span id="tmke-ve-eltag">Element</span><small id="tmke-ve-eltxt"></small></div><div class="tmke-ve-body" id="tmke-ve-body"></div>';
    document.body.appendChild(panel);
    panelBody = panel.querySelector('#tmke-ve-body');
    tagBadge = panel.querySelector('#tmke-ve-eltag');
    var badge = document.createElement('div'); badge.className = 'tmke-ve-tag'; badge.id = 'tmke-ve-floattag'; badge.style.display = 'none';
    document.body.appendChild(badge);
  }

  function setOverride(sel, prop, value) {
    if (!sel) return;
    if (!overrides[sel]) overrides[sel] = {};
    overrides[sel][prop] = value; persist(); injectStyles();
  }

  function renderPanel(el) {
    var sel = selectorFor(el), cs = getComputedStyle(el);
    panelBody.innerHTML = '';
    tagBadge.textContent = el.tagName.toLowerCase();
    panel.querySelector('#tmke-ve-eltxt').textContent = '“' + (el.textContent || '').trim().slice(0, 22) + '”';

    CONTROLS.forEach(function (c) {
      if (c.when && !c.when(el, cs)) return;
      var saved = overrides[sel] && overrides[sel][c.prop], current;
      if (saved != null) current = parseFloat(saved);
      else if (c.prop === 'line-height') { var lh = cs.lineHeight; current = (lh === 'normal') ? 1.2 : (parseFloat(lh) / parseFloat(cs.fontSize)); }
      else current = parseFloat(cs.getPropertyValue(c.prop)) || 0;
      var row = document.createElement('div'); row.className = 'tmke-ve-row';
      row.innerHTML = '<label>' + c.label + ' <span class="val"></span></label><input type="range" min="' + c.min + '" max="' + c.max + '" step="' + c.step + '">';
      var input = row.querySelector('input'), valEl = row.querySelector('.val');
      input.value = current; valEl.textContent = fmt(current, c.unit);
      input.addEventListener('input', function () { var v = parseFloat(input.value); valEl.textContent = fmt(v, c.unit); setOverride(sel, c.prop, v + c.unit); });
      panelBody.appendChild(row);
    });

    // weight
    var wRow = document.createElement('div'); wRow.className = 'tmke-ve-row';
    wRow.innerHTML = '<label>Weight</label><select>' + ['300','400','500','600','700','800'].map(function (w) { return '<option value="' + w + '">' + w + '</option>'; }).join('') + '</select>';
    var wSel = wRow.querySelector('select');
    wSel.value = (overrides[sel] && overrides[sel]['font-weight']) || String(Math.round(parseInt(cs.fontWeight, 10) / 100) * 100) || '400';
    wSel.addEventListener('change', function () { setOverride(sel, 'font-weight', wSel.value); });
    panelBody.appendChild(wRow);

    // colour + brand swatches
    var cRow = document.createElement('div'); cRow.className = 'tmke-ve-row';
    cRow.innerHTML = '<label>Text colour</label><input type="color"><div class="tmke-ve-swatches"></div>';
    var cInput = cRow.querySelector('input');
    cInput.value = (overrides[sel] && overrides[sel]['color']) || rgbToHex(cs.color);
    cInput.addEventListener('input', function () { setOverride(sel, 'color', cInput.value); });
    var sw = cRow.querySelector('.tmke-ve-swatches');
    BRAND_VARS.forEach(function (b) {
      var hex = brandColour(b[0]); if (!hex) return;
      var dot = document.createElement('button'); dot.className = 'tmke-ve-swatch'; dot.title = b[1]; dot.style.background = hex;
      dot.onclick = function () { cInput.value = toHex(hex); setOverride(sel, 'color', hex); };
      sw.appendChild(dot);
    });
    panelBody.appendChild(cRow);

    // layout — column split for 2-column grids
    if (cs.display === 'grid') {
      var tracks = cs.gridTemplateColumns.split(' ').filter(Boolean).map(parseFloat);
      if (tracks.length === 2 && tracks[0] && tracks[1]) {
        var savedR = overrides[sel] && overrides[sel]['grid-template-columns'];
        var ratio = savedR ? (parseFloat(savedR) / (parseFloat(savedR) + parseFloat(savedR.split(' ')[1]))) : tracks[0] / (tracks[0] + tracks[1]);
        var lRow = document.createElement('div'); lRow.className = 'tmke-ve-row';
        lRow.innerHTML = '<label>Column split <span class="val"></span></label><input type="range" min="20" max="80" step="1">';
        var lInput = lRow.querySelector('input'), lVal = lRow.querySelector('.val');
        lInput.value = Math.round(ratio * 100);
        var setSplit = function (pct) { lVal.textContent = pct + ' / ' + (100 - pct); setOverride(sel, 'grid-template-columns', pct + 'fr ' + (100 - pct) + 'fr'); };
        lInput.addEventListener('input', function () { setSplit(parseInt(lInput.value, 10)); });
        lVal.textContent = lInput.value + ' / ' + (100 - lInput.value);
        panelBody.appendChild(lRow);
      }
    }

    // content: wording
    if (isTextEl(el)) {
      var tRow = document.createElement('div'); tRow.className = 'tmke-ve-row'; tRow.innerHTML = '<label>Wording</label>';
      var tBtn = document.createElement('button'); tBtn.className = 'tmke-ve-reset'; tBtn.textContent = '✎ Edit text';
      tBtn.onclick = function () { startTextEdit(el, sel); };
      tRow.appendChild(tBtn); panelBody.appendChild(tRow);
    }
    // content: image
    var isImg = el.tagName === 'IMG', hasBg = !isImg && cs.backgroundImage && cs.backgroundImage !== 'none';
    if (isImg || hasBg) {
      var iRow = document.createElement('div'); iRow.className = 'tmke-ve-row';
      iRow.innerHTML = '<label>Image</label><input type="text" class="tmke-ve-text" placeholder="https://… or /assets/…">';
      var iInput = iRow.querySelector('input');
      iInput.value = (overrides[sel] && overrides[sel].__src) || (isImg ? (el.getAttribute('src') || '') : extractUrl(cs.backgroundImage));
      iInput.addEventListener('change', function () {
        var v = iInput.value.trim(); if (!v) return;
        if (!overrides[sel]) overrides[sel] = {}; overrides[sel].__src = v; persist();
        if (isImg) el.src = v; else el.style.backgroundImage = "url('" + v + "')";
      });
      panelBody.appendChild(iRow);
    }

    // reset element
    var reset = document.createElement('button'); reset.className = 'tmke-ve-reset'; reset.textContent = 'Reset this element';
    reset.onclick = function () { delete overrides[sel]; persist(); injectStyles(); location.reload(); };
    panelBody.appendChild(reset);
  }

  /* ---- interactions ---- */
  function wirePageInteractions() {
    document.addEventListener('mouseover', function (e) {
      if (isChrome(e.target)) return;
      var el = e.target.closest(EDITABLE); clearHover();
      if (el && !isChrome(el)) { el.classList.add('tmke-ve-hover'); showFloatTag(el); }
    }, true);
    document.addEventListener('mouseout', function () { clearHover(); hideFloatTag(); }, true);
    document.addEventListener('click', function (e) {
      if (isChrome(e.target)) return;
      if (e.target.isContentEditable) return;
      var el = e.target.closest(EDITABLE); if (!el) return;
      e.preventDefault(); e.stopPropagation(); select(el);
    }, true);
  }
  function select(el) { deselect(); selected = el; el.classList.add('tmke-ve-selected'); crumbEl.textContent = pathLabel(el); panel.classList.add('open'); renderPanel(el); }
  function deselect() { if (selected) selected.classList.remove('tmke-ve-selected'); selected = null; if (panel) panel.classList.remove('open'); }
  function clearHover() { Array.prototype.forEach.call(document.querySelectorAll('.tmke-ve-hover'), function (n) { n.classList.remove('tmke-ve-hover'); }); }
  function showFloatTag(el) { var t = document.getElementById('tmke-ve-floattag'); if (!t) return; var r = el.getBoundingClientRect(); t.textContent = el.tagName.toLowerCase(); t.style.left = r.left + 'px'; t.style.top = (r.top - 4) + 'px'; t.style.display = 'block'; }
  function hideFloatTag() { var t = document.getElementById('tmke-ve-floattag'); if (t) t.style.display = 'none'; }
  function isChrome(el) { return !!(el && el.closest && (el.closest('.tmke-ve-bar') || el.closest('.tmke-ve-panel') || el.id === 'tmke-ve-floattag')); }
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
})();
