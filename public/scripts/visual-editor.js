/* ============================================================================
   TMKE Visual Editor — PROTOTYPE (per-element, Squarespace-style)
   ----------------------------------------------------------------------------
   Two parts run from this one file:

   1. LOADER (always runs, lightweight): reads saved per-element overrides and
      injects them as a single <style> so changes show for every visitor.
   2. EDITOR (only when the URL has ?edit=1): an overlay that lets you click any
      text element and tweak font size / line-height / letter-spacing / weight /
      colour / margins with live preview. Each change is saved against a stable
      selector for that element.

   PROTOTYPE NOTES (what becomes "production" next):
   - Persistence is localStorage here so it's instant to demo. It's behind a
     small Store adapter — swapping to Supabase (so edits are live for everyone,
     not just this browser) is a ~1-file change.
   - Edit mode is gated by ?edit=1 for the demo. Production gates it behind the
     existing admin login (src/lib/admin-gate.js) + a Preview/Publish split.
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'tmke-overrides-v1';

  /* ---- Persistence adapter (prototype: localStorage; prod: Supabase) ---- */
  var Store = {
    load: function () {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
      catch (e) { return {}; }
    },
    save: function (map) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch (e) {}
    },
  };

  var overrides = Store.load();   // { selector: { prop: value, ... } }

  /* ---- Stable selector for an element (the persistence key) ----
     Anchors at the nearest ancestor with an id, then a :nth-of-type chain.
     Deterministic across reloads as long as the markup is unchanged. */
  function selectorFor(el) {
    if (!el || el.nodeType !== 1 || el === document.body) return null;
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && node !== document.body) {
      if (node.id) { parts.unshift('#' + cssEscape(node.id)); break; }
      var parent = node.parentNode;
      if (!parent) break;
      var tag = node.tagName.toLowerCase();
      var same = [];
      for (var i = 0; i < parent.children.length; i++) {
        if (parent.children[i].tagName === node.tagName) same.push(parent.children[i]);
      }
      parts.unshift(tag + ':nth-of-type(' + (same.indexOf(node) + 1) + ')');
      node = parent;
    }
    return parts.join(' > ');
  }
  function cssEscape(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  /* ---- Apply all overrides as one stylesheet ---- */
  function injectStyles() {
    var css = '';
    Object.keys(overrides).forEach(function (sel) {
      var rules = overrides[sel];
      var decls = Object.keys(rules)
        .filter(function (p) { return rules[p] !== '' && rules[p] != null; })
        .map(function (p) { return p + ':' + rules[p] + ' !important'; })
        .join(';');
      if (decls) css += sel + '{' + decls + '}\n';
    });
    var tag = document.getElementById('tmke-overrides');
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'tmke-overrides';
      document.head.appendChild(tag);
    }
    tag.textContent = css;
  }
  injectStyles(); // <-- viewers get saved changes applied

  /* ====================================================================== */
  /*  EDITOR — only when ?edit=1                                            */
  /* ====================================================================== */
  if (!new URLSearchParams(location.search).has('edit')) return;

  var EDITABLE = 'h1,h2,h3,h4,h5,h6,p,span,a,button,li,blockquote,em,strong,figcaption';
  var selected = null;

  document.addEventListener('DOMContentLoaded', initEditor);
  if (document.readyState !== 'loading') initEditor();

  function initEditor() {
    if (document.getElementById('tmke-ve-root')) return;
    injectChrome();
    buildToolbar();
    buildPanel();
    wirePageInteractions();
  }

  /* ---- Editor chrome styles ---- */
  function injectChrome() {
    var s = document.createElement('style');
    s.id = 'tmke-ve-root';
    s.textContent = [
      '.tmke-ve-hover{outline:2px dashed rgba(91,75,122,.85)!important;outline-offset:2px!important;cursor:pointer!important;}',
      '.tmke-ve-selected{outline:2px solid #5b4b7a!important;outline-offset:2px!important;}',
      '.tmke-ve-tag{position:fixed;z-index:2147483646;background:#5b4b7a;color:#fff;font:600 10px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;padding:3px 6px;border-radius:3px;pointer-events:none;transform:translateY(-100%);white-space:nowrap;}',
      '.tmke-ve-bar{position:fixed;top:0;left:0;right:0;z-index:2147483645;height:46px;background:#1c1d22;color:#f2efe9;display:flex;align-items:center;gap:16px;padding:0 16px;font:600 13px/1 system-ui,sans-serif;box-shadow:0 2px 14px rgba(0,0,0,.3);}',
      '.tmke-ve-bar b{font-weight:700;letter-spacing:.02em;}',
      '.tmke-ve-bar .tag{font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.6;}',
      '.tmke-ve-bar .crumb{margin-left:auto;opacity:.7;font-weight:500;max-width:42vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
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
      '.tmke-ve-reset{width:100%;margin-top:6px;padding:9px;border-radius:7px;background:transparent;border:1px solid rgba(255,255,255,.25);color:#f2efe9;font:600 12px system-ui,sans-serif;cursor:pointer;}',
      '.tmke-ve-reset:hover{background:rgba(255,255,255,.08);}',
      '.tmke-ve-empty{padding:22px 16px;text-align:center;opacity:.6;font-size:12px;line-height:1.5;}',
    ].join('');
    document.head.appendChild(s);
    document.body.classList.add('tmke-ve-on');
  }

  /* ---- Top toolbar ---- */
  var crumbEl;
  function buildToolbar() {
    var bar = document.createElement('div');
    bar.className = 'tmke-ve-bar';
    bar.innerHTML =
      '<b>TMKE Editor</b><span class="tag">Prototype</span>' +
      '<span class="crumb" id="tmke-ve-crumb">Click any text to edit it</span>';
    var resetAll = btn('Reset all', function () {
      if (!confirm('Remove every saved change on this site?')) return;
      overrides = {}; Store.save(overrides); injectStyles(); deselect();
    });
    var done = btn('Done', function () {
      var u = new URL(location.href); u.searchParams.delete('edit'); location.href = u.toString();
    });
    done.className = 'primary';
    bar.appendChild(resetAll); bar.appendChild(done);
    document.body.appendChild(bar);
    crumbEl = bar.querySelector('#tmke-ve-crumb');
  }
  function btn(label, fn) { var b = document.createElement('button'); b.textContent = label; b.onclick = fn; return b; }

  /* ---- Control panel ---- */
  var panel, panelBody, tagBadge;
  var CONTROLS = [
    { prop: 'font-size',      label: 'Font size',      unit: 'px', min: 8,   max: 220, step: 1 },
    { prop: 'line-height',    label: 'Line height',    unit: '',   min: 0.8, max: 2.4, step: 0.01 },
    { prop: 'letter-spacing', label: 'Letter spacing', unit: 'px', min: -6,  max: 12,  step: 0.1 },
    { prop: 'margin-top',     label: 'Space above',    unit: 'px', min: 0,   max: 240, step: 1 },
    { prop: 'margin-bottom',  label: 'Space below',    unit: 'px', min: 0,   max: 240, step: 1 },
  ];
  function buildPanel() {
    panel = document.createElement('div');
    panel.className = 'tmke-ve-panel';
    panel.innerHTML =
      '<div class="tmke-ve-panel-h"><span id="tmke-ve-eltag">Element</span><small id="tmke-ve-eltxt"></small></div>' +
      '<div class="tmke-ve-body" id="tmke-ve-body"></div>';
    document.body.appendChild(panel);
    panelBody = panel.querySelector('#tmke-ve-body');
    tagBadge = panel.querySelector('#tmke-ve-eltag');
    // floating element-tag badge (follows hover)
    var badge = document.createElement('div'); badge.className = 'tmke-ve-tag'; badge.id = 'tmke-ve-floattag';
    badge.style.display = 'none'; document.body.appendChild(badge);
  }

  function renderPanel(el) {
    var sel = selectorFor(el);
    var cs = getComputedStyle(el);
    panelBody.innerHTML = '';
    tagBadge.textContent = el.tagName.toLowerCase();
    panel.querySelector('#tmke-ve-eltxt').textContent =
      '“' + (el.textContent || '').trim().slice(0, 22) + '”';

    CONTROLS.forEach(function (c) {
      var saved = overrides[sel] && overrides[sel][c.prop];
      var current;
      if (saved != null) {
        current = parseFloat(saved);
      } else if (c.prop === 'line-height') {
        // computed line-height is in px — show it as a unitless ratio.
        var lh = cs.lineHeight;
        current = (lh === 'normal') ? 1.2 : (parseFloat(lh) / parseFloat(cs.fontSize));
      } else {
        current = parseFloat(cs.getPropertyValue(c.prop)) || 0;
      }
      var row = document.createElement('div'); row.className = 'tmke-ve-row';
      row.innerHTML =
        '<label>' + c.label + ' <span class="val"></span></label>' +
        '<input type="range" min="' + c.min + '" max="' + c.max + '" step="' + c.step + '">';
      var input = row.querySelector('input');
      var valEl = row.querySelector('.val');
      input.value = current;
      valEl.textContent = fmt(current, c.unit);
      input.addEventListener('input', function () {
        var v = parseFloat(input.value);
        valEl.textContent = fmt(v, c.unit);
        setOverride(sel, c.prop, v + c.unit);
      });
      panelBody.appendChild(row);
    });

    // font-weight
    var wRow = document.createElement('div'); wRow.className = 'tmke-ve-row';
    wRow.innerHTML = '<label>Weight</label><select>' +
      ['300','400','500','600','700','800'].map(function (w) { return '<option value="' + w + '">' + w + '</option>'; }).join('') +
      '</select>';
    var wSel = wRow.querySelector('select');
    wSel.value = (overrides[sel] && overrides[sel]['font-weight']) || String(Math.round(parseInt(cs.fontWeight, 10) / 100) * 100) || '400';
    wSel.addEventListener('change', function () { setOverride(sel, 'font-weight', wSel.value); });
    panelBody.appendChild(wRow);

    // colour
    var cRow = document.createElement('div'); cRow.className = 'tmke-ve-row';
    cRow.innerHTML = '<label>Text colour</label><input type="color">';
    var cInput = cRow.querySelector('input');
    cInput.value = (overrides[sel] && overrides[sel]['color']) || rgbToHex(cs.color);
    cInput.addEventListener('input', function () { setOverride(sel, 'color', cInput.value); });
    panelBody.appendChild(cRow);

    // reset this element
    var reset = document.createElement('button'); reset.className = 'tmke-ve-reset';
    reset.textContent = 'Reset this element';
    reset.onclick = function () { delete overrides[sel]; Store.save(overrides); injectStyles(); renderPanel(el); };
    panelBody.appendChild(reset);
  }

  function setOverride(sel, prop, value) {
    if (!sel) return;
    if (!overrides[sel]) overrides[sel] = {};
    overrides[sel][prop] = value;
    Store.save(overrides);
    injectStyles();
  }

  /* ---- Page interactions ---- */
  function wirePageInteractions() {
    document.addEventListener('mouseover', function (e) {
      if (isChrome(e.target)) return;
      var el = e.target.closest(EDITABLE);
      clearHover();
      if (el && !isChrome(el)) { el.classList.add('tmke-ve-hover'); showFloatTag(el); }
    }, true);
    document.addEventListener('mouseout', function () { clearHover(); hideFloatTag(); }, true);

    // Intercept clicks while editing so links/buttons don't navigate.
    document.addEventListener('click', function (e) {
      if (isChrome(e.target)) return;       // let panel/toolbar work normally
      var el = e.target.closest(EDITABLE);
      if (!el) return;
      e.preventDefault(); e.stopPropagation();
      select(el);
    }, true);
  }

  function select(el) {
    deselect();
    selected = el;
    el.classList.add('tmke-ve-selected');
    crumbEl.textContent = pathLabel(el);
    panel.classList.add('open');
    renderPanel(el);
  }
  function deselect() {
    if (selected) selected.classList.remove('tmke-ve-selected');
    selected = null;
    if (panel) panel.classList.remove('open');
  }

  function clearHover() {
    Array.prototype.forEach.call(document.querySelectorAll('.tmke-ve-hover'), function (n) {
      n.classList.remove('tmke-ve-hover');
    });
  }
  function showFloatTag(el) {
    var t = document.getElementById('tmke-ve-floattag'); if (!t) return;
    var r = el.getBoundingClientRect();
    t.textContent = el.tagName.toLowerCase();
    t.style.left = r.left + 'px'; t.style.top = (r.top - 4) + 'px'; t.style.display = 'block';
  }
  function hideFloatTag() { var t = document.getElementById('tmke-ve-floattag'); if (t) t.style.display = 'none'; }

  function isChrome(el) {
    return !!(el && el.closest && (el.closest('.tmke-ve-bar') || el.closest('.tmke-ve-panel') || el.id === 'tmke-ve-floattag'));
  }
  function pathLabel(el) {
    var bits = []; var n = el;
    for (var i = 0; i < 3 && n && n !== document.body; i++) { bits.unshift(n.tagName.toLowerCase()); n = n.parentElement; }
    return bits.join(' › ');
  }

  /* ---- helpers ---- */
  function fmt(v, unit) { return (unit === '' ? v.toFixed(2) : Math.round(v * 10) / 10 + unit); }
  function rgbToHex(rgb) {
    var m = (rgb || '').match(/\d+/g); if (!m) return '#000000';
    return '#' + m.slice(0, 3).map(function (x) { return ('0' + parseInt(x, 10).toString(16)).slice(-2); }).join('');
  }
})();
