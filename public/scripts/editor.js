/* =============================================================
   TMKE Studio — Canva-style design editor
   ============================================================= */

(function () {
  "use strict";

  // ---------- Data ----------
  const TEMPLATES = JSON.parse(document.getElementById("ed-templates-data").textContent || "[]");
  // The template grid shows this list. Defaults to every template; the
  // onboarding pack-picker narrows it to the chosen pack via __TMKE_OPEN_PACK__.
  let PACK_TEMPLATES = TEMPLATES;
  const PHOTOS = JSON.parse(document.getElementById("ed-photos-data").textContent || "[]");

  // System fonts that are always available without any web-font load.
  const SYSTEM_FONTS = [
    { name: "Georgia", stack: 'Georgia, serif', category: "System" },
    { name: "Times New Roman", stack: '"Times New Roman", serif', category: "System" },
    { name: "Helvetica", stack: 'Helvetica, Arial, sans-serif', category: "System" },
    { name: "Arial", stack: 'Arial, sans-serif', category: "System" },
    { name: "Trebuchet", stack: '"Trebuchet MS", sans-serif', category: "System" },
    { name: "Verdana", stack: 'Verdana, sans-serif', category: "System" },
    { name: "Courier", stack: '"Courier New", monospace', category: "System" },
  ];

  // House fonts available in the studio picker (separate from per-customer
  // uploads via /admin/fonts). The actual font faces are loaded by the page —
  // The Seasons comes from the Typographer.io embed that the dashboard layout
  // includes (a real webfont CDN that serves the right CORS headers). We do NOT
  // register faces from assets.tmke.co.uk here: those files aren't hosted (404),
  // and cross-origin FontFace loads need CORS — so it only spammed the console.
  const CUSTOM_FONTS = [
    {
      name: "The Seasons",
      stack: '"The Seasons", "Cormorant Garamond", Georgia, serif',
      category: "TMKE · House",
      faces: [],
    },
  ];
  (function registerCustomFonts() {
    if (typeof document === "undefined" || typeof window.FontFace !== "function") return;
    CUSTOM_FONTS.forEach(function (cf) {
      (cf.faces || []).forEach(function (face) {
        try {
          const ff = new FontFace(cf.name, 'url("' + face.url + '")', {
            weight: String(face.weight || 400),
            style: face.style || "normal",
            display: "swap",
          });
          ff.load().then(function (loaded) { document.fonts.add(loaded); }).catch(function () { /* not uploaded yet — fall back */ });
        } catch (_) { /* ignore individual face failures */ }
      });
    });
  })();

  // Google Fonts catalogue baked into editor.astro and injected as JSON.
  // We don't load any of the actual CSS yet — `loadGoogleFont` does that on
  // demand the first time a user picks one (or a template uses one).
  const GOOGLE_CATEGORY_FALLBACK = {
    sans: "sans-serif",
    serif: "serif",
    display: "serif",
    mono: "monospace",
    handwriting: "cursive",
  };
  const GOOGLE_CATEGORY_LABEL = {
    sans: "Google · Sans",
    serif: "Google · Serif",
    display: "Google · Display",
    mono: "Google · Mono",
    handwriting: "Google · Script",
  };
  const GOOGLE_FONTS = (function readGoogleFontsJson() {
    const tag = document.getElementById("ed-google-fonts-data");
    if (!tag) return [];
    try { return JSON.parse(tag.textContent || "[]"); }
    catch (_) { return []; }
  })().map(function (g) {
    return {
      name: g.f,
      stack: '"' + g.f + '", ' + (GOOGLE_CATEGORY_FALLBACK[g.c] || "sans-serif"),
      category: GOOGLE_CATEGORY_LABEL[g.c] || "Google",
      isGoogle: true,
    };
  });

  // Lazy-load a Google Font's CSS. Idempotent — only the first call per font
  // adds a <link>; subsequent calls are no-ops.
  const _loadedGoogleFonts = new Set();
  function loadGoogleFont(name) {
    if (!name) return;
    if (_loadedGoogleFonts.has(name)) return;
    const known = GOOGLE_FONTS.find(function (f) { return f.name === name; });
    if (!known) return; // not in our catalogue — leave to browser fallback
    _loadedGoogleFonts.add(name);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=" +
      encodeURIComponent(name).replace(/%20/g, "+") +
      ":ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,700&display=swap";
    document.head.appendChild(link);
  }

  // Custom brand fonts uploaded via /admin/fonts. The page-level inline
  // script in editor.astro fetches them from Supabase and exposes the rows
  // as `window.__TMKE_BRAND_FONTS__`. They're already loaded into
  // document.fonts there, so we just need to surface them in the picker.
  const BRAND_FONTS = (function readBrandFonts() {
    const rows = (typeof window !== "undefined" && window.__TMKE_BRAND_FONTS__) || [];
    const seen = new Set();
    const out = [];
    rows.forEach(function (r) {
      if (!r || !r.family || seen.has(r.family)) return;
      seen.add(r.family);
      out.push({
        name: r.family,
        stack: '"' + r.family + '", sans-serif',
        category: "Brand · Custom",
        isBrandFont: true,
      });
    });
    return out;
  })();

  // BASE_FONTS retained as a name so the rest of the code (export canvas,
  // brand kit logic) keeps working — it now points at the combined catalogue:
  // custom brand fonts (pinned first) > system fonts > Google Fonts.
  const BASE_FONTS = BRAND_FONTS.concat(CUSTOM_FONTS).concat(SYSTEM_FONTS).concat(GOOGLE_FONTS);

  // Brand kit — colours / fonts / logos from /profile, stored in localStorage.
  function loadBrand() {
    try { return JSON.parse(localStorage.getItem("tmke.brand") || "null"); }
    catch (_) { return null; }
  }
  let BRAND = loadBrand();

  // Pin brand fonts to the top of the font list (deduped, marked as brand).
  function buildFonts() {
    const seen = new Set();
    const out = [];
    if (BRAND && BRAND.fonts) {
      ["heading", "body"].forEach(function (role) {
        const name = BRAND.fonts[role];
        if (!name || seen.has(name)) return;
        const base = BASE_FONTS.find((f) => f.name === name);
        out.push({
          name: name,
          stack: base ? base.stack : '"' + name + '", sans-serif',
          category: "Brand · " + role.charAt(0).toUpperCase() + role.slice(1),
        });
        seen.add(name);
      });
    }
    BASE_FONTS.forEach(function (f) {
      if (seen.has(f.name)) return;
      out.push(f);
      seen.add(f.name);
    });
    return out;
  }
  let FONTS = buildFonts();

  // Brand-kit favourite fonts — starred in the Text panel's font browser and
  // persisted locally. When the user has favourited at least one font, the
  // toolbar drops its inline weight <select> (weight is then chosen in the
  // panel), keeping the bar compact.
  function getFavFonts() {
    try { return JSON.parse(localStorage.getItem("tmke.editor.favFonts") || "[]"); }
    catch (_) { return []; }
  }
  function setFavFonts(arr) {
    try { localStorage.setItem("tmke.editor.favFonts", JSON.stringify(arr || [])); } catch (_) {}
  }
  function isFavFont(name) { return getFavFonts().indexOf(name) >= 0; }
  function toggleFavFont(name) {
    const a = getFavFonts(); const i = a.indexOf(name);
    if (i >= 0) a.splice(i, 1); else a.unshift(name);
    setFavFonts(a);
  }
  // Recently picked fonts (most-recent first, capped) — shown as their own
  // section in the font browser between brand fonts and the full list.
  function getRecentFonts() {
    try { return JSON.parse(localStorage.getItem("tmke.editor.recentFonts") || "[]"); }
    catch (_) { return []; }
  }
  function pushRecentFont(name) {
    if (!name) return;
    let a = getRecentFonts().filter(function (n) { return n !== name; });
    a.unshift(name);
    a = a.slice(0, 8);
    try { localStorage.setItem("tmke.editor.recentFonts", JSON.stringify(a)); } catch (_) {}
  }
  // Which text element the Text-panel font browser is currently editing, and a
  // cheap signature so fullRender doesn't rebuild the (long) list every frame.
  let _fontTargetId = null;
  let _fbSig = "";

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  const stageEl = $("ed-stage");
  const shadowEl = $("ed-canvas-shadow");
  const canvasEl = $("ed-canvas");
  const handlesEl = $("ed-handles");
  const guidesEl = $("ed-guides");
  const propsEl = $("ed-props");
  const ctxEl = $("ed-context");
  const layersEl = $("ed-layers");
  const filenameEl = $("ed-filename");
  // A title passed in via ?title= (e.g. when an admin names a design in the
  // front-end before opening the studio) wins over the default/saved filename on
  // the FIRST load only, then is consumed so switching designs doesn't re-apply it.
  let _pendingTitle = (function () {
    try { return new URLSearchParams(location.search).get("title"); } catch (_) { return null; }
  })();
  function takeInitialTitle() { const t = _pendingTitle; _pendingTitle = null; return t && t.trim() ? t.trim() : null; }
  const zoomDisplayEl = $("ed-zoom-display");
  const tplGridEl = $("ed-template-grid");
  const photoGridEl = $("ed-photo-grid");
  const uploadGridEl = $("ed-upload-grid");
  const toastEl = $("ed-toast");

  // ---------- State ----------
  const state = {
    templateId: null,
    canvas: { width: 1080, height: 1440, background: "#F2EFE9" },
    elements: [],
    selectedIds: [],
    zoom: 1,
    history: [],
    historyIndex: -1,
    clipboard: null,
    uploads: [],
    // User-placed guide lines: { id, axis:"h"|"v", pos, weight, color }.
    guides: [],
    selectedGuideId: null,
  };

  // ---------- Multi-page model ----------
  // A design holds one or more pages. `state.canvas` / `state.elements` proxy to
  // the ACTIVE page so every bit of existing single-page code keeps working;
  // `state.pages` is the source of truth and drives the page strip.
  (function initPages() {
    const initCanvas = state.canvas;
    const initElements = state.elements;
    delete state.canvas;
    delete state.elements;
    state.pages = [{ id: uid("page"), name: "Page 1", canvas: initCanvas, elements: initElements }];
    state.currentPage = 0;
    Object.defineProperty(state, "canvas", {
      get() { return state.pages[state.currentPage].canvas; },
      set(v) { state.pages[state.currentPage].canvas = v; },
      configurable: true,
    });
    Object.defineProperty(state, "elements", {
      get() { return state.pages[state.currentPage].elements; },
      set(v) { state.pages[state.currentPage].elements = v; },
      configurable: true,
    });
  })();

  // ---------- Utilities ----------
  function uid(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 9);
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function deep(o) { return JSON.parse(JSON.stringify(o)); }

  function getEl(id) { return state.elements.find((e) => e.id === id); }

  function selectedElements() {
    return state.selectedIds.map(getEl).filter(Boolean);
  }

  function toast(msg, durationMs) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.add("is-show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toastEl.classList.remove("is-show"); toastEl.hidden = true; }, durationMs || 1800);
  }

  // ---------- Context-bar helpers ----------
  // Admin mode detection: the page-level admin-mode bootstrap (in
  // editor.astro) installs `window.__TMKE_ADMIN_SAVE__` when a signed-in
  // admin opens /editor?mode=admin. Customer flows don't get this hook,
  // so it's a reliable signal for "hide admin-only affordances".
  function isAdminMode() {
    return typeof window.__TMKE_ADMIN_SAVE__ === "function";
  }

  /* Ratio lock. Sticky on purpose — it stays on until you turn it off, rather
     than resetting each time you select something, because the reason you turn
     it on is usually a run of elements rather than one. It governs both the
     Position panel's W/H boxes and dragging a resize handle, so the two cannot
     disagree about what "locked" means. */
  let ratioLocked = false;
  const LOCK_SHUT = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  const LOCK_OPEN = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>';

  // Tracks the single popover allowed open at any time. Opening one closes the
  // previous one (and the colour panel), so Position/Effects/etc. never stack.
  let _activePopoverClose = null;

  // Every popover's panel is appended to <body>, but its trigger lives in the
  // context bar — which is wiped and rebuilt on every selection change. Without
  // a registry the panel outlived its button: still on screen, still showing
  // the element you had selected a moment ago, and leaking one node per render.
  // The bar disposes these before rebuilding, then reopens the same one against
  // whatever is now selected, so a panel follows the selection instead of
  // going stale or vanishing.
  // Add-to-selection modifier. Shift has always worked; Cmd is what a Mac user
  // reaches for and was doing nothing. Ctrl is the Windows equivalent, but on a
  // Mac ctrl-click IS a right-click, so it is only additive off-Mac.
  const _IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
  function isAddToSelection(ev) {
    return !!(ev.shiftKey || ev.metaKey || (!_IS_MAC && ev.ctrlKey));
  }

  const _livePopovers = [];
  const _liveSwatches = [];     // colour swatches in the current context bar
  let _openColorKey = null;     // which swatch's panel is open
  let _reopenColorKey = null;   // set when a selection change closes it, so it can come back
  let _openPopoverKey = null;   // which panel is open, by name
  let _reopenPopoverKey = null; // and which to restore after a rebuild

  function disposePopovers() {
    _openPopoverKey = null;
    _liveSwatches.length = 0;
    while (_livePopovers.length) {
      const p = _livePopovers.pop();
      try { p.destroy(); } catch (_) { }
    }
    _activePopoverClose = null;
  }

  // Generic icon button that opens a popover when clicked. The `render`
  // callback gets a `close` function and should return a DOM element to
  // populate the popover. Closes on outside click, Escape, scroll.
  function popoverIconButton(opts) {
    const wrap = document.createElement("div");
    wrap.className = "ed-pop-wrap";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ed-ctx-btn ed-pop-trigger";
    btn.title = opts.title || "";
    btn.innerHTML = opts.icon;
    wrap.appendChild(btn);

    const pop = document.createElement("div");
    pop.className = "ed-pop";
    pop.hidden = true;
    document.body.appendChild(pop);

    function position() {
      const r = btn.getBoundingClientRect();
      pop.style.top = (r.bottom + 6) + "px";
      pop.style.left = Math.min(r.left, window.innerWidth - 280 - 12) + "px";
    }
    function open() {
      // One popover at a time: close any other open popover + the colour panel.
      if (_activePopoverClose && _activePopoverClose !== close) _activePopoverClose();
      if (typeof closeColorPanel === "function") closeColorPanel();
      _activePopoverClose = close;
      _openPopoverKey = opts.key || null;
      pop.innerHTML = "";
      pop.appendChild(opts.render(close));
      pop.hidden = false;
      position();
    }
    function close() {
      pop.hidden = true;
      if (_activePopoverClose === close) _activePopoverClose = null;
      if (_openPopoverKey === (opts.key || null)) _openPopoverKey = null;
    }
    // Called when the context bar is rebuilt: take the panel with the button.
    function destroy() { pop.remove(); }
    _livePopovers.push({ key: opts.key || null, open: open, destroy: destroy });

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      pop.hidden ? open() : close();
    });
    document.addEventListener("click", function (e) {
      if (!pop.hidden && !pop.contains(e.target) && !wrap.contains(e.target)) close();
    });
    document.addEventListener("keydown", function (e) {
      if (!pop.hidden && e.key === "Escape") close();
    });
    window.addEventListener("resize", function () { if (!pop.hidden) position(); });

    return wrap;
  }

  // Icon button that opens a small popover with a labelled slider + number box.
  // Used for text line-height / letter-spacing in the context bar.
  function sliderPopover(opts) {
    return popoverIconButton({
      icon: opts.icon,
      title: opts.title,
      key: opts.key || null,
      render: function () {
        const box = document.createElement("div");
        box.style.cssText = "padding:12px 14px;min-width:210px;font-family:var(--sans,inherit);";
        const lab = document.createElement("div");
        lab.style.cssText = "font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(28,29,34,0.55);margin-bottom:9px;";
        lab.textContent = opts.label;
        box.appendChild(lab);
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:8px;";
        const range = document.createElement("input");
        range.type = "range"; range.min = opts.min; range.max = opts.max; range.step = opts.step; range.value = opts.get();
        range.style.cssText = "flex:1;accent-color:var(--english-violet,#371e28);";
        const num = document.createElement("input");
        num.type = "number"; num.min = opts.min; num.max = opts.max; num.step = opts.step; num.value = opts.get();
        num.style.cssText = "width:64px;text-align:right;border:1px solid rgba(28,29,34,0.18);border-radius:6px;padding:5px 7px;font-family:var(--sans);font-size:var(--ws-t-meta,12px);color:var(--ink);";
        const apply = function (v, fromNum) {
          v = Math.max(opts.min, Math.min(opts.max, isNaN(v) ? opts.get() : v));
          opts.set(v); range.value = v; if (!fromNum) num.value = v; fullRender();
        };
        range.addEventListener("input", function () { apply(parseFloat(range.value), false); });
        range.addEventListener("change", function () { pushHistory(); });
        num.addEventListener("input", function () { apply(parseFloat(num.value), true); });
        num.addEventListener("change", function () { pushHistory(); });
        row.appendChild(range); row.appendChild(num);
        if (opts.unit) { const u = document.createElement("span"); u.textContent = opts.unit; u.style.cssText = "opacity:0.5;font-size:12px;"; row.appendChild(u); }
        box.appendChild(row);
        return box;
      },
    });
  }

  // One labelled slider+number row (shared by the combined spacing popover).
  function _spacingRow(labelText, unit, min, max, step, get, set) {
    const wrap = document.createElement("div");
    const lab = document.createElement("div");
    lab.style.cssText = "font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(28,29,34,0.55);margin-bottom:7px;";
    lab.textContent = labelText;
    wrap.appendChild(lab);
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;";
    const range = document.createElement("input");
    range.type = "range"; range.min = min; range.max = max; range.step = step; range.value = get();
    range.style.cssText = "flex:1;accent-color:var(--english-violet,#371e28);";
    const num = document.createElement("input");
    num.type = "number"; num.min = min; num.max = max; num.step = step; num.value = get();
    num.style.cssText = "width:60px;text-align:right;border:1px solid rgba(28,29,34,0.18);border-radius:6px;padding:5px 7px;font-family:var(--sans);font-size:var(--ws-t-meta,12px);color:var(--ink);";
    const apply = function (v, fromNum) {
      v = Math.max(min, Math.min(max, isNaN(v) ? get() : v));
      set(v); range.value = v; if (!fromNum) num.value = v; fullRender();
    };
    range.addEventListener("input", function () { apply(parseFloat(range.value), false); });
    range.addEventListener("change", function () { pushHistory(); });
    num.addEventListener("input", function () { apply(parseFloat(num.value), true); });
    num.addEventListener("change", function () { pushHistory(); });
    row.appendChild(range); row.appendChild(num);
    if (unit) { const u = document.createElement("span"); u.textContent = unit; u.style.cssText = "opacity:0.5;font-size:12px;"; row.appendChild(u); }
    wrap.appendChild(row);
    return wrap;
  }

  // Like _spacingRow but the caller supplies the live-update callback (onLive)
  // — used inside the properties panel so we can repaint just the element
  // (partialRenderElement) instead of fullRender(), which would rebuild the
  // panel mid-drag and drop the control.
  function sliderNumberRow(labelText, unit, min, max, step, get, set, onLive) {
    const wrap = document.createElement("div");
    const lab = document.createElement("div");
    lab.style.cssText = "font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(28,29,34,0.55);margin:6px 0 7px;";
    lab.textContent = labelText;
    wrap.appendChild(lab);
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;";
    const range = document.createElement("input");
    range.type = "range"; range.min = min; range.max = max; range.step = step; range.value = get();
    range.style.cssText = "flex:1;accent-color:var(--english-violet,#371e28);";
    const num = document.createElement("input");
    num.type = "number"; num.min = min; num.max = max; num.step = step; num.value = get();
    num.style.cssText = "width:64px;text-align:right;border:1px solid rgba(28,29,34,0.18);border-radius:6px;padding:5px 7px;font-family:var(--sans);font-size:var(--ws-t-meta,12px);color:var(--ink);";
    const apply = function (v, fromNum) {
      v = Math.max(min, Math.min(max, isNaN(v) ? get() : v));
      set(v); range.value = v; if (!fromNum) num.value = v; if (onLive) onLive();
    };
    range.addEventListener("input", function () { apply(parseFloat(range.value), false); });
    range.addEventListener("change", function () { pushHistory(); });
    num.addEventListener("input", function () { apply(parseFloat(num.value), true); });
    num.addEventListener("change", function () { pushHistory(); });
    row.appendChild(range); row.appendChild(num);
    if (unit) { const u = document.createElement("span"); u.textContent = unit; u.style.cssText = "opacity:0.5;font-size:12px;"; row.appendChild(u); }
    wrap.appendChild(row);
    return wrap;
  }

  // Markup for a corner-radius section (uniform slider+number, plus an
  // "Advanced" disclosure with the four individual corners). Shared by
  // rectangles and images; mounts are filled in by renderProps.
  function cornerRadiusSectionHtml() {
    return '<div class="ed-props-section"><h4>Corner radius</h4>' +
        '<div data-mount="el-radius"></div>' +
        '<details class="ed-corner-details"><summary>Advanced · individual corners</summary>' +
          '<div data-mount="el-corners"></div>' +
        '</details>' +
      '</div>';
  }

  // Four typed per-corner radius inputs (TL/TR/BL/BR) for a frame. Editing any
  // one promotes the frame to per-corner mode (el.radii), seeded from the
  // current effective values so the other corners don't jump.
  function buildCornerInputs(el) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;";
    [["tl", "Top-left"], ["tr", "Top-right"], ["bl", "Bottom-left"], ["br", "Bottom-right"]].forEach(function (c) {
      const k = c[0];
      const field = document.createElement("div");
      field.className = "ed-props-field";
      const lab = document.createElement("label");
      lab.textContent = c[1];
      const num = document.createElement("input");
      num.type = "number"; num.min = 0; num.max = 500; num.step = 1;
      num.value = cornerRadius(el, k);
      num.addEventListener("input", function () {
        if (!el.radii) el.radii = { tl: cornerRadius(el, "tl"), tr: cornerRadius(el, "tr"), br: cornerRadius(el, "br"), bl: cornerRadius(el, "bl") };
        el.radii[k] = Math.max(0, parseFloat(num.value) || 0);
        partialRenderElement(el);
      });
      num.addEventListener("change", function () { pushHistory(); });
      field.appendChild(lab); field.appendChild(num);
      wrap.appendChild(field);
    });
    return wrap;
  }

  // Combined Letter spacing + Line spacing popover (one tab, Canva-style).
  /* Matching a height from Canva.
     Canva and this editor disagree about how tall a line of type is. Canva
     builds its line box from the font's own metrics; this editor uses the CSS
     rule, height = font size x line spacing, which is why the same 46px with
     the same 1.4 spacing comes out 64 here and 76.7 there.

     Their exact algorithm is not published, and it is not simply the font's
     metrics either — The Seasons reports 1.285 for both its hhea and typo
     tables and 1.63 for win, while Canva's number implies 1.191. So rather
     than guess at it, this works backwards from the answer: you type the
     height Canva gave you and it solves for the line spacing that produces
     exactly that height here.

       line spacing = target height / (font size x lines)

     Exact, and it needs to know nothing about Canva — the arithmetic is this
     editor's own. Admin only: it is an authoring aid for rebuilding a Canva
     draft, not something a customer has any use for. */
  /* Measured, not derived. Canva's line box is taller than the CSS one by a
     factor that depends on the font, and it is not any of the font's own
     metric tables — The Seasons reports 1.285 (hhea and typo) and 1.63 (win)
     where Canva behaves as 1.191, and Montserrat's browser font box is 1.22
     where Canva behaves as 1.140. So these come from comparing real heights:

       Montserrat   24/60/100px at 1.4  ->  1.119 / 1.143 / 1.138   (~1.140)
       The Seasons  46px at 1.4         ->  1.191

     The 24px reading is the loose one — small sizes round harder — so the
     figure follows the two larger samples. A font that isn't listed has no
     measured factor; the height box below covers it exactly. */
  const CANVA_LINE_FACTOR = { "Montserrat": 1.140, "The Seasons": 1.191 };

  function textLineCount(el) {
    const node = canvasEl.querySelector('[data-id="' + el.id + '"] .ed-text-inner');
    const lh = (el.size || 16) * (el.lineHeight || 1.3);
    if (!node || !lh) return 1;
    return Math.max(1, Math.round(node.offsetHeight / lh));
  }

  function _canvaHeightRow(el) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "border-top:1px solid rgba(28,29,34,0.1);padding-top:14px;display:flex;flex-direction:column;gap:8px;";
    const lines = textLineCount(el);
    wrap.innerHTML =
      '<div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(28,29,34,0.55)">Match a Canva height</div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
        '<input type="number" id="ed-canva-h" placeholder="76.7" step="0.1" min="1" ' +
          'style="flex:1;min-width:0;padding:7px 9px;border:1px solid rgba(28,29,34,0.18);border-radius:6px;font-family:var(--sans);font-size:13px">' +
        '<button type="button" id="ed-canva-go" style="flex:none;padding:7px 14px;cursor:pointer;' +
          'font-family:var(--sans);font-size:12px;font-weight:700;color:#fff;' +
          'background:var(--english-violet);border:0;border-radius:6px">Set</button>' +
      '</div>' +
      '<p style="margin:0;font-size:11.5px;line-height:1.45;color:rgba(28,29,34,0.55)">' +
        'This text is <strong>' + lines + '</strong> line' + (lines === 1 ? "" : "s") + ' at ' + (el.size || 0) + 'px. ' +
        'Type the height Canva shows and the line spacing is solved to match it.</p>' +
      '<p style="margin:0;font-size:11.5px;color:#a3372b" id="ed-canva-warn" hidden></p>';

    // If we have measured this font against Canva, the far easier route: type
    // the line spacing off the Canva panel rather than reading a height.
    const factor = CANVA_LINE_FACTOR[el.font];
    if (factor) {
      const conv = document.createElement("div");
      conv.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-top:4px;";
      conv.innerHTML =
        '<div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(28,29,34,0.55)">Or Canva line spacing</div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          '<input type="number" id="ed-canva-ls" placeholder="1.4" step="0.05" min="0.5" ' +
            'style="flex:1;min-width:0;padding:7px 9px;border:1px solid rgba(28,29,34,0.18);border-radius:6px;font-family:var(--sans);font-size:13px">' +
          '<button type="button" id="ed-canva-ls-go" style="flex:none;padding:7px 14px;cursor:pointer;' +
            'font-family:var(--sans);font-size:12px;font-weight:700;color:#fff;' +
            'background:var(--english-violet);border:0;border-radius:6px">Set</button>' +
        '</div>' +
        '<p style="margin:0;font-size:11.5px;line-height:1.45;color:rgba(28,29,34,0.55)">' +
          escapeHtml(el.font) + ' measures &times;' + factor + ' against Canva, so 1.4 there is ' +
          (Math.round(1.4 * factor * 100) / 100) + ' here.</p>';
      conv.querySelector("#ed-canva-ls-go").addEventListener("click", function () {
        const v = parseFloat(conv.querySelector("#ed-canva-ls").value);
        if (!isFinite(v) || v <= 0) return;
        const lh = Math.round(v * factor * 100) / 100;
        if (lh < 0.8 || lh > 3) return;
        el.lineHeight = lh;
        fitTextHeight(el);
        fullRender();
        pushHistory();
        toast("Line spacing " + lh + " — Canva's " + v + " for " + el.font);
      });
      wrap.appendChild(conv);
    }

    wrap.querySelector("#ed-canva-go").addEventListener("click", function () {
      const target = parseFloat(wrap.querySelector("#ed-canva-h").value);
      const warn = wrap.querySelector("#ed-canva-warn");
      const n = textLineCount(el);
      if (!isFinite(target) || target <= 0 || !el.size || !n) return;
      const lh = target / (el.size * n);
      // The slider's own range. Outside it the answer would not stick.
      if (lh < 0.8 || lh > 3) {
        warn.hidden = false;
        warn.textContent = "That needs a line spacing of " + lh.toFixed(2)
          + ", outside the 0.8–3 range. Change the font size first.";
        return;
      }
      warn.hidden = true;
      el.lineHeight = Math.round(lh * 100) / 100;
      fitTextHeight(el);
      fullRender();
      pushHistory();
      toast("Line spacing " + el.lineHeight + " — height now " + Math.round(el.size * el.lineHeight * n) + "px");
    });
    return wrap;
  }

  function spacingPopover(el) {
    const icon = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 4v16"/><path d="M1 6l2-2 2 2"/><path d="M1 18l2 2 2-2"/></svg>';
    return popoverIconButton({
      icon: icon, title: "Spacing", key: "spacing",
      render: function () {
        const box = document.createElement("div");
        box.style.cssText = "padding:14px 16px;min-width:236px;font-family:var(--sans,inherit);display:flex;flex-direction:column;gap:16px;";
        box.appendChild(_spacingRow("Letter spacing", "px", -5, 40, 0.5,
          function () { return el.letterSpacing != null ? el.letterSpacing : 0; },
          function (v) { el.letterSpacing = v; }));
        box.appendChild(_spacingRow("Line spacing", "", 0.8, 3, 0.05,
          function () { return el.lineHeight != null ? el.lineHeight : 1.3; },
          function (v) { el.lineHeight = v; }));
        if (isAdminMode()) box.appendChild(_canvaHeightRow(el));
        return box;
      },
    });
  }

  // Circular colour swatch — clicking it triggers the native colour picker.
  // Used in place of square `<input type="color">` with a "Colour" label.
  // onChange is called on every input event with the new hex string.
  /* ---------- The colour picker ----------
     A saturation/value square, a hue strip, a hex field and an eyedropper.

     This replaces <input type="color"> wherever a colour is chosen. The native
     control opens the operating system's picker: it looks like macOS rather
     than like this app, it puts R/G/B boxes in front of you when hex is what
     brand work is written in, and on every platform it is a different shape.

     Built on canvas-free maths so it costs nothing to render. Hue drives the
     square's tint; the square gives saturation across and value down - the
     arrangement every design tool uses, so the muscle memory carries over. */
  function hsvToRgb(h, sv, vv) {
    const c = vv * sv, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = vv - c;
    let r = 0, g = 0, b = 0;
    if (h < 60)       { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else              { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    return [h, max ? d / max : 0, max];
  }
  function hexToRgb(hex) {
    const h = normHex(hex) || "#000000";
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  }

  /* Returns an element. onChange(hex) fires continuously while dragging;
     onCommit(hex) once the gesture ends, so history gets one entry per choice
     rather than one per pixel of travel. */
  function buildColorPicker(initialHex, onChange, onCommit) {
    let [h, sv, vv] = rgbToHsv.apply(null, hexToRgb(initialHex || "#000000"));

    const wrap = document.createElement("div");
    wrap.className = "ed-pick";
    wrap.innerHTML =
      '<div class="ed-pick-sv"><div class="ed-pick-sv-white"></div><div class="ed-pick-sv-black"></div>' +
        '<span class="ed-pick-dot"></span></div>' +
      '<div class="ed-pick-hue"><span class="ed-pick-hue-dot"></span></div>' +
      '<div class="ed-pick-foot">' +
        '<span class="ed-pick-preview"></span>' +
        '<input class="ed-pick-hex" spellcheck="false" maxlength="7">' +
        '<button type="button" class="ed-pick-drop" title="Pick a colour from the screen">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
          'stroke-linecap="round" stroke-linejoin="round"><path d="M19 2l3 3-9 9-3-3 9-9z"/>' +
          '<path d="M10 11l-6 6v3h3l6-6"/></svg></button>' +
      '</div>';

    const svBox = wrap.querySelector(".ed-pick-sv");
    const svDot = wrap.querySelector(".ed-pick-dot");
    const hueBox = wrap.querySelector(".ed-pick-hue");
    const hueDot = wrap.querySelector(".ed-pick-hue-dot");
    const hexInput = wrap.querySelector(".ed-pick-hex");
    const preview = wrap.querySelector(".ed-pick-preview");
    const dropBtn = wrap.querySelector(".ed-pick-drop");

    const hex = () => rgbToHex.apply(null, hsvToRgb(h, sv, vv));
    function paint(skipHexField) {
      const cur = hex();
      svBox.style.background = "hsl(" + Math.round(h) + ",100%,50%)";
      svDot.style.left = (sv * 100) + "%";
      svDot.style.top = ((1 - vv) * 100) + "%";
      svDot.style.background = cur;
      hueDot.style.left = ((h / 360) * 100) + "%";
      preview.style.background = cur;
      if (!skipHexField) hexInput.value = cur.toUpperCase();
    }
    paint();

    // One drag handler for both strips: press, move anywhere, release.
    function dragOn(box, onPos) {
      const move = (e) => {
        const r = box.getBoundingClientRect();
        const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        onPos(x, y);
        paint();
        onChange(hex());
      };
      box.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        move(e);
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          onCommit(hex());
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
    }
    dragOn(svBox, (x, y) => { sv = x; vv = 1 - y; });
    dragOn(hueBox, (x) => { h = x * 360; });

    hexInput.addEventListener("input", () => {
      const v = normHex(hexInput.value);
      if (!v) return;                     // half-typed: leave the swatch alone
      const hsv = rgbToHsv.apply(null, hexToRgb(v));
      h = hsv[0]; sv = hsv[1]; vv = hsv[2];
      paint(true);                        // not the field they are typing into
      onChange(v);
    });
    hexInput.addEventListener("change", () => { const v = normHex(hexInput.value); if (v) onCommit(v); });

    /* The browser's own eyedropper where it exists (Chromium). It reads real
       screen pixels, so it can sample the design, a photo, anything on the
       desktop. Hidden where it does not exist rather than offered and broken. */
    if (window.EyeDropper) {
      dropBtn.addEventListener("click", async () => {
        try {
          const picked = await new window.EyeDropper().open();
          const v = normHex(picked.sRGBHex);
          if (!v) return;
          const hsv = rgbToHsv.apply(null, hexToRgb(v));
          h = hsv[0]; sv = hsv[1]; vv = hsv[2];
          paint();
          onChange(v); onCommit(v);
        } catch (_) { /* dismissed */ }
      });
    } else {
      dropBtn.remove();
    }

    wrap.setColor = function (v) {
      const n = normHex(v);
      if (!n) return;
      const hsv = rgbToHsv.apply(null, hexToRgb(n));
      h = hsv[0]; sv = hsv[1]; vv = hsv[2];
      paint();
    };
    return wrap;
  }

  function circleColorInput(initialHex, onChange, title) {
    const wrap = document.createElement("label");
    wrap.className = "ed-circle-swatch";
    wrap.title = title || "Colour";
    wrap.style.background = initialHex || "#000000";

    const input = document.createElement("input");
    input.type = "color";
    input.value = rgbHex(initialHex || "#000000");
    wrap.appendChild(input);

    input.addEventListener("input", function () {
      wrap.style.background = input.value;
      onChange(input.value);
      fullRender();
    });
    input.addEventListener("change", function () { pushHistory(); });
    return wrap;
  }

  // Circular swatch that opens the rich left-hand colour panel (not the OS
  // picker). getCurrent() returns the live colour; onSolid(hex)/onGradient(g)
  // mutate the element — render + history handled here.
  function colorSwatchButton(getCurrent, opts) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ed-circle-swatch";
    btn.title = opts.title || "Colour";
    // Named so the context bar can reopen this same swatch against the next
    // element — recolouring a run of items is why the panel is open at all.
    const swatchKey = opts.key || ("colour:" + (opts.title || "Colour"));
    const paint = () => { btn.style.background = getCurrent() || "#000000"; };
    paint();
    function show() {
      _openColorKey = swatchKey;
      openColorPanel({
        title: opts.title || "Colour",
        current: getCurrent(),
        currentGradient: opts.getGradient ? opts.getGradient() : null,
        onSolid: function (hex) { opts.onSolid(hex); paint(); fullRender(); pushHistory(); },
        onGradient: opts.onGradient ? function (g) { opts.onGradient(g); paint(); fullRender(); pushHistory(); } : null,
      });
    }
    btn.addEventListener("click", function (e) { e.stopPropagation(); show(); });
    _liveSwatches.push({ key: swatchKey, open: show });
    return btn;
  }

  // Font-size control: a typeable number that, when clicked, drops a quick list
  // of common sizes (Canva-style — no separate caret button). onChange(size) is
  // called with the new value.
  const SIZE_PRESETS = [6, 8, 10, 12, 14, 16, 18, 21, 24, 28, 32, 36, 42, 48, 56, 64, 72, 80, 88, 96, 104, 120, 144];
  function createSizeControl(initial, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "ed-size-ctl";
    const input = document.createElement("input");
    input.type = "number"; input.className = "ed-ctx-num"; input.value = initial; input.min = 6; input.max = 600;
    input.title = "Font size — click for presets";
    const pop = document.createElement("div");
    pop.className = "ed-size-pop"; pop.hidden = true;
    pop.innerHTML = SIZE_PRESETS.map(function (s) {
      return '<button type="button" class="ed-size-opt' + (s === initial ? " is-current" : "") + '" data-size="' + s + '">' + s + "</button>";
    }).join("");

    function apply(v) {
      v = Math.max(6, Math.min(600, parseInt(v, 10) || initial));
      input.value = v;
      // Highlight the nearest preset so the list shows "where you are".
      let nearest = null, best = Infinity;
      pop.querySelectorAll(".ed-size-opt").forEach(function (b) {
        b.classList.remove("is-current");
        const d = Math.abs(parseInt(b.dataset.size, 10) - v);
        if (d < best) { best = d; nearest = b; }
      });
      if (nearest) nearest.classList.add("is-current");
      onChange(v);
    }
    input.addEventListener("change", function () { apply(input.value); });

    // Clicking / focusing the number opens the preset list (position:fixed so it
    // floats over the canvas, anchored under the input).
    function openPop() {
      if (!pop.hidden) return;
      pop.hidden = false;
      const r = input.getBoundingClientRect();
      pop.style.visibility = "hidden";
      pop.style.left = "0px"; pop.style.top = "0px";
      requestAnimationFrame(function () {
        const ph = pop.offsetHeight || 240, pw = pop.offsetWidth || 64;
        let top = r.bottom + 6;
        if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
        const left = Math.max(8, Math.min(r.left, window.innerWidth - pw - 8));
        pop.style.left = left + "px";
        pop.style.top = top + "px";
        pop.style.visibility = "";
        const cur = pop.querySelector(".ed-size-opt.is-current");
        if (cur) cur.scrollIntoView({ block: "center" });
      });
    }
    input.addEventListener("focus", openPop);
    input.addEventListener("click", openPop);
    pop.addEventListener("click", function (e) {
      const b = e.target.closest("[data-size]");
      if (!b) return;
      pop.hidden = true;
      apply(b.getAttribute("data-size"));
    });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target) && !pop.contains(e.target)) pop.hidden = true; });

    // +/- steppers flanking the number (Canva-style). Step by 1, holding Shift by 10.
    const minus = document.createElement("button");
    minus.type = "button"; minus.className = "ed-size-step"; minus.title = "Smaller"; minus.textContent = "−";
    const plus = document.createElement("button");
    plus.type = "button"; plus.className = "ed-size-step"; plus.title = "Larger"; plus.textContent = "+";
    plus.style.borderRadius = "0 4px 4px 0"; // round the right edge now the caret is gone
    minus.addEventListener("click", function (e) { e.stopPropagation(); apply((parseInt(input.value, 10) || initial) - (e.shiftKey ? 10 : 1)); });
    plus.addEventListener("click", function (e) { e.stopPropagation(); apply((parseInt(input.value, 10) || initial) + (e.shiftKey ? 10 : 1)); });

    wrap.appendChild(minus);
    wrap.appendChild(input);
    wrap.appendChild(plus);
    wrap.appendChild(pop);
    return wrap;
  }

  // ---------- Colour panel ----------
  // A rich left-hand colour picker (Canva-style): hex/search, colours already in
  // the design, the brand palette, photo colours sampled from the design's
  // imagery, default solids, and gradients. Replaces the native colour popup.
  const CP_DEFAULT_SOLIDS = [
    "#000000", "#3A3A3A", "#5C5C5C", "#8C8C8C", "#BFBFBF", "#E6E6E6", "#FFFFFF",
    "#E23B3B", "#F06543", "#FF7AAE", "#C98BD9", "#9B6BE0", "#5B6BF0", "#2F50C9",
    "#1C9BD1", "#16C0C8", "#3FD0A8", "#46C06A", "#9BD13E", "#F0C23B", "#F0913B",
    // 27, not 28: the grid fits nine across, so the last one wrapped onto a
    // row of its own.
    "#1c1d22", "#474254", "#B9826A", "#DFDCDE", "#F2EFE9", "#BCB3B9",
  ];
  const CP_DEFAULT_GRADS = [
    { from: "#1c1d22", to: "transparent", angle: 180 },
    { from: "#371e28", to: "transparent", angle: 180 },
    { from: "#B9826A", to: "transparent", angle: 180 },
    { from: "#1c1d22", to: "#474254", angle: 135 },
    { from: "#B9826A", to: "#F2EFE9", angle: 135 },
    { from: "#5B6BF0", to: "#16C0C8", angle: 135 },
    { from: "#F06543", to: "#F0C23B", angle: 135 },
    { from: "#9B6BE0", to: "#FF7AAE", angle: 135 },
    { from: "#46C06A", to: "#9BD13E", angle: 135 },
    { from: "#1C9BD1", to: "#9B6BE0", angle: 135 },
    { from: "#000000", to: "#5C5C5C", angle: 135 },
    { from: "#474254", to: "#B9826A", angle: 135 },
    { from: "#F0913B", to: "#E23B3B", angle: 135 },
    { from: "#16C0C8", to: "#46C06A", angle: 135 },
    { from: "#C98BD9", to: "#5B6BF0", angle: 135 },
  ];

  // ---------- Custom gradient editor (Canva-style, multi-stop) ----------
  // Draft: { type:'linear'|'radial', angle, stops:[{color,pos}], sel } where
  // `sel` is the index of the stop currently being edited.
  function cpInitGradDraft(grad, currentSolid) {
    const g = grad || {};
    let stops;
    if (Array.isArray(g.stops) && g.stops.length >= 2) {
      stops = g.stops.map(function (s) {
        const c = s.color === "transparent" ? "transparent" : (normHex(s.color) || "#371E28");
        return { color: c, pos: s.pos != null ? s.pos : 0 };
      });
    } else {
      const from = normHex(g.from) || normHex(currentSolid) || "#371E28";
      const toVal = g.to || "transparent";
      const to = toVal === "transparent" ? "transparent" : (normHex(toVal) || "#B9826A");
      stops = [
        { color: from, pos: g.fromStop != null ? g.fromStop : 0 },
        { color: to, pos: g.toStop != null ? g.toStop : 100 },
      ];
    }
    return {
      type: g.type === "radial" ? "radial" : "linear",
      angle: g.angle != null ? g.angle : 135,
      stops: stops,
      sel: 0,
    };
  }
  // CSS for the live preview swatch (shared builder).
  function cpGradCss(d) { return gradCss(d); }
  // Draft → gradient model the onGradient callback expects. We keep from/to in
  // sync (first/last stop) so any 2-stop-only consumer still works.
  function cpDraftToGrad(d) {
    const stops = (d.stops || []).slice().sort(function (a, b) { return a.pos - b.pos; })
      .map(function (s) { return { color: s.color, pos: s.pos }; });
    const first = stops[0] || { color: "#371E28", pos: 0 };
    const last = stops[stops.length - 1] || { color: "#B9826A", pos: 100 };
    return {
      type: d.type || "linear",
      angle: d.angle != null ? d.angle : 135,
      stops: stops,
      from: first.color,
      to: last.color,
      fromStop: first.pos,
      toStop: last.pos,
    };
  }
  // Style presets (the "Style" thumbnails in the Canva reference).
  const CPG_STYLES = [
    { key: "h",   type: "linear", angle: 90,  label: "Horizontal" },
    { key: "v",   type: "linear", angle: 180, label: "Vertical" },
    { key: "d1",  type: "linear", angle: 135, label: "Diagonal" },
    { key: "d2",  type: "linear", angle: 45,  label: "Diagonal (other way)" },
    { key: "rad", type: "radial", angle: 135, label: "Radial" },
  ];
  const CPG_CHECKER = "repeating-conic-gradient(#cfcfcf 0% 25%, #fff 0% 50%) 50% / 9px 9px";
  // Markup for the editor block (rebuilt each open; bound via delegation).
  function cpGradEditorHtml(d) {
    const isLin = d.type !== "radial";
    const sel = Math.max(0, Math.min(d.stops.length - 1, d.sel || 0));
    const selStop = d.stops[sel] || d.stops[0];
    const selFade = selStop.color === "transparent";
    const swatches = d.stops.map(function (s, i) {
      const bg = s.color === "transparent" ? CPG_CHECKER : s.color;
      return '<button type="button" class="ed-cpg-stop' + (i === sel ? " is-sel" : "") +
        '" data-stop="' + i + '" style="background:' + bg + '" title="' + s.color + '"></button>';
    }).join("");
    const styleBtns = CPG_STYLES.map(function (st) {
      const on = st.type === d.type && (st.type === "radial" || st.angle === d.angle);
      const prev = st.type === "radial"
        ? "radial-gradient(circle, #8a8a8a, #e6e6e6)"
        : "linear-gradient(" + st.angle + "deg, #8a8a8a, #e6e6e6)";
      return '<button type="button" class="ed-cpg-style' + (on ? " is-on" : "") +
        '" data-style="' + st.key + '" title="' + st.label + '" style="background:' + prev + '"></button>';
    }).join("");
    return '<div class="ed-cpg">' +
      '<div class="ed-cpg-preview" data-cpg="preview" style="background:' + gradCss(d) + '"></div>' +
      '<div class="ed-cpg-sub">Gradient colours</div>' +
      '<div class="ed-cpg-stops">' + swatches +
        '<button type="button" class="ed-cpg-add" data-cpg="add" title="Add a colour">+</button>' +
      '</div>' +
      '<div class="ed-cpg-row">' +
        '<input type="color" class="ed-cpg-color" data-cpg="selColor" value="' + (selFade ? "#cccccc" : selStop.color) + '"' + (selFade ? " disabled" : "") + '>' +
        '<input type="text" class="ed-cpg-hex" data-cpg="selHex" value="' + (selFade ? "transparent" : selStop.color) + '">' +
        '<label class="ed-cpg-fade"><input type="checkbox" data-cpg="selFade"' + (selFade ? " checked" : "") + '>Fade</label>' +
        '<button type="button" class="ed-cpg-del" data-cpg="del"' + (d.stops.length <= 2 ? " disabled" : "") + ' title="Remove this colour">&times;</button>' +
      '</div>' +
      '<div class="ed-cpg-row"><span class="ed-cpg-lbl">Position</span>' +
        '<input type="range" min="0" max="100" class="ed-cpg-range" data-cpg="selPos" value="' + (selStop.pos || 0) + '">' +
        '<span class="ed-cpg-val" data-out="selPos">' + (selStop.pos || 0) + '%</span></div>' +
      '<div class="ed-cpg-sub">Style</div>' +
      '<div class="ed-cpg-styles">' + styleBtns + '</div>' +
      '<div class="ed-cpg-row' + (isLin ? "" : " is-hidden") + '" data-cpg="angleRow"><span class="ed-cpg-lbl">Angle</span>' +
        '<input type="range" min="0" max="360" class="ed-cpg-range" data-cpg="angle" value="' + (d.angle != null ? d.angle : 135) + '">' +
        '<span class="ed-cpg-val" data-out="angle">' + (d.angle != null ? d.angle : 135) + '°</span></div>' +
    '</div>';
  }

  function normHex(v) {
    if (!v) return null;
    let s = String(v).trim();
    if (/^[0-9a-f]{6}$/i.test(s)) s = "#" + s;
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
    if (/^#[0-9a-f]{3}$/i.test(s)) {
      return ("#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toUpperCase();
    }
    const named = { white: "#FFFFFF", black: "#000000", red: "#E23B3B", blue: "#2F50C9", green: "#46C06A", grey: "#8C8C8C", gray: "#8C8C8C" };
    return named[s.toLowerCase()] || null;
  }

  // Every solid colour currently used on the active page.
  function collectDesignColors() {
    const seen = new Set(); const out = [];
    const add = (c) => { const h = normHex(c); if (h && !seen.has(h)) { seen.add(h); out.push(h); } };
    add(state.canvas.background);
    state.elements.forEach((el) => { add(el.color); add(el.fill); add(el.stroke); add(el.svgFill); });
    return out.slice(0, 14);
  }

  // Persistent "recently used" solid colours — shared by every colour picker
  // (text, fill, stroke, frame border) so the user isn't re-typing hex codes.
  function loadRecentColors() {
    try { const a = JSON.parse(localStorage.getItem("tmke.recentColors") || "[]"); return Array.isArray(a) ? a : []; }
    catch (_) { return []; }
  }
  function pushRecentColor(hex) {
    const h = normHex(hex);
    if (!h) return;
    let list = loadRecentColors().filter((c) => c !== h);
    list.unshift(h);
    list = list.slice(0, 12);
    try { localStorage.setItem("tmke.recentColors", JSON.stringify(list)); } catch (_) {}
  }

  // Sample dominant colours from the design's imagery (background image + image /
  // frame elements). Cross-origin images are loaded anonymously; a tainted draw
  // just yields no colours for that source.
  async function extractPhotoColors() {
    const srcs = [];
    if (state.canvas.backgroundImage) srcs.push(state.canvas.backgroundImage);
    state.elements.forEach((el) => { if ((el.type === "image" || el.type === "frame") && el.src) srcs.push(el.src); });
    const uniq = srcs.filter((s, i) => srcs.indexOf(s) === i).slice(0, 3);
    const buckets = {};
    for (const src of uniq) {
      try {
        const img = await loadImage(src);
        const c = document.createElement("canvas");
        c.width = 40; c.height = 40;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, 40, 40);
        const data = ctx.getImageData(0, 0, 40, 40).data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          const r = data[i] & 0xE0, g = data[i + 1] & 0xE0, b = data[i + 2] & 0xE0;
          const key = r + "," + g + "," + b;
          buckets[key] = (buckets[key] || 0) + 1;
        }
      } catch (_) { /* tainted / failed load — skip */ }
    }
    const toHex = (n) => ("0" + n.toString(16)).slice(-2);
    return Object.entries(buckets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([k]) => { const [r, g, b] = k.split(",").map(Number); return ("#" + toHex(r) + toHex(g) + toHex(b)).toUpperCase(); });
  }

  function closeColorPanel() {
    _openColorKey = null;
    const panel = document.getElementById("ed-colorpanel");
    if (panel) { panel.hidden = true; panel._onSolid = null; panel._onGradient = null; }
    document.documentElement.classList.remove("ed-picking");
  }

  function openColorPanel(opts) {
    const panel = document.getElementById("ed-colorpanel");
    if (!panel) return;
    // Picking a colour usually means picking it off the design. Take the guide
    // down for the duration so what you sample is what is actually there.
    document.documentElement.classList.add("ed-picking");
    // Close any open icon-popover so only one control panel shows at a time.
    if (_activePopoverClose) _activePopoverClose();
    panel._onSolid = opts.onSolid || null;
    panel._onGradient = opts.onGradient || null;
    panel._gradDraft = panel._onGradient ? cpInitGradDraft(opts.currentGradient, opts.current) : null;
    const current = normHex(opts.current);

    const swHtml = (c) => '<button class="ed-cp-sw' + (c === current ? " is-current" : "") + '" data-hex="' + c + '" style="background:' + c + '" title="' + c + '"></button>';
    const gradHtml = (g) => '<button class="ed-cp-sw" data-grad=\'' + JSON.stringify(g) + '\' style="background:linear-gradient(' + (g.angle || 135) + 'deg,' + g.from + ',' + g.to + ')" title="Gradient"></button>';

    const brand = (BRAND && Array.isArray(BRAND.colors)) ? BRAND.colors.map((c) => normHex(c.hex)).filter(Boolean) : [];
    const brandName = (BRAND && BRAND.company) ? (BRAND.company + "’s kit") : "Brand colours";
    const design = collectDesignColors();
    const recent = loadRecentColors();

    const sec = (title, inner) => '<div class="ed-cp-sec"><h5>' + title + '</h5>' + inner + '</div>';
    const grid = (cells, mod) => '<div class="ed-cp-grid' + (mod || "") + '">' + (Array.isArray(cells) ? cells.join("") : cells) + '</div>';

    /* Colours you already have come before colours you have to invent.

       The customer panel used to open on an empty hex box, with brand colours
       under it and everything else hidden - so the two sets that are nearly
       always the right answer (the brand's own, and the ones already in this
       design) were either buried or missing. They lead now, then a small
       default set, and the picker sits after them as the way to add something
       new rather than the first thing you meet.

       Hex throughout: it is what a brand guideline is written in and what gets
       pasted between tools. */
    var _cpFull = location.search.indexOf("mode=admin") !== -1;
    panel.innerHTML =
      '<div class="ed-cp-head"><span class="ed-cp-title">' + (opts.title || "Colour") + '</span><button class="ed-cp-close" title="Close">&times;</button></div>' +
      '<div class="ed-cp-scroll">' +
        sec(brandName, brand.length ? grid(brand.map(swHtml)) : '<p class="ed-cp-empty">No brand colours saved.</p>') +
        sec("Colours in this design", design.length ? grid(design.map(swHtml)) : '<p class="ed-cp-empty">None yet.</p>') +
        (recent.length ? sec("Recently used", grid(recent.map(swHtml))) : "") +
        (_cpFull ? sec("Photo colours", '<div class="ed-cp-grid" data-photo><p class="ed-cp-empty">Reading photos…</p></div>') : "") +
        sec("Default colours", grid(CP_DEFAULT_SOLIDS.map(swHtml))) +
        sec("Add a colour", '<div data-mount="picker"></div>') +
        (panel._onGradient ? sec("Gradients", grid(CP_DEFAULT_GRADS.map(gradHtml), " ed-cp-grid--grad")) : "") +
        (panel._onGradient ? sec("Custom gradient", cpGradEditorHtml(panel._gradDraft)) : "") +
      '</div>';

    panel.hidden = false;

    // The picker is built rather than templated - it carries its own drag
    // handlers and needs the live value back.
    const pickMount = panel.querySelector('[data-mount="picker"]');
    if (pickMount) {
      pickMount.appendChild(buildColorPicker(
        current || "#000000",
        function (hex) { if (panel._onSolid) panel._onSolid(hex); },
        function (hex) { pushRecentColor(hex); if (panel._onSolid) panel._onSolid(hex); pushHistory(); }
      ));
    }

    // Async photo colours fill in when ready.
    extractPhotoColors().then((cols) => {
      const slot = panel.querySelector("[data-photo]");
      if (!slot) return;
      slot.innerHTML = cols.length ? cols.map(swHtml).join("") : '<p class="ed-cp-empty">No photos in this design.</p>';
    });
  }

  // One-time delegated wiring for the colour panel (its contents are rebuilt
  // each open, so delegate from the stable root).
  (function wireColorPanel() {
    const panel = document.getElementById("ed-colorpanel");
    if (!panel) return;

    // ---- Custom gradient editor helpers (panel._gradDraft is the live draft) ----
    function cpRoot() { return panel.querySelector(".ed-cpg"); }
    function cpSelStop() {
      const d = panel._gradDraft; if (!d) return null;
      const i = Math.max(0, Math.min(d.stops.length - 1, d.sel || 0));
      return d.stops[i];
    }
    // Pull the editable values (selected-stop colour + position, angle) off the
    // DOM into the draft. Stop list / selection are managed by click handlers.
    function cpReadAll() {
      const root = cpRoot(); if (!root || !panel._gradDraft) return;
      const get = (k) => root.querySelector('[data-cpg="' + k + '"]');
      const stop = cpSelStop(); if (!stop) return;
      const fade = get("selFade"); if (fade) stop.color = fade.checked ? "transparent" : (stop.color === "transparent" ? "#CCCCCC" : stop.color);
      if (stop.color !== "transparent") {
        const c = get("selColor"); if (c && c.value) stop.color = c.value.toUpperCase();
        const h = get("selHex"); if (h) { const nh = normHex(h.value); if (nh) stop.color = nh; }
      }
      const pos = get("selPos"); if (pos) stop.pos = +pos.value;
      const ang = get("angle"); if (ang) panel._gradDraft.angle = +ang.value;
    }
    function cpRefresh() {
      const root = cpRoot(); if (!root || !panel._gradDraft) return;
      const prev = root.querySelector('[data-cpg="preview"]');
      if (prev) prev.style.background = cpGradCss(panel._gradDraft);
      const setOut = (k, v) => { const s = root.querySelector('[data-out="' + k + '"]'); if (s) s.textContent = v; };
      setOut("angle", (panel._gradDraft.angle | 0) + "°");
      const stop = cpSelStop(); if (stop) setOut("selPos", (stop.pos | 0) + "%");
    }
    function cpRerender() {
      const root = cpRoot(); if (!root || !panel._gradDraft) return;
      root.outerHTML = cpGradEditorHtml(panel._gradDraft);
    }
    function cpCommit() { if (panel._onGradient && panel._gradDraft) panel._onGradient(cpDraftToGrad(panel._gradDraft)); }

    panel.addEventListener("click", (e) => {
      if (e.target.closest(".ed-cp-close")) { closeColorPanel(); return; }
      const d = panel._gradDraft;
      // Style preset thumbnail → set type + angle.
      const styleBtn = e.target.closest(".ed-cpg-style");
      if (styleBtn && d) {
        const st = CPG_STYLES.find(function (x) { return x.key === styleBtn.dataset.style; });
        if (st) { d.type = st.type; d.angle = st.angle; cpRerender(); cpCommit(); }
        return;
      }
      // Select a stop swatch to edit it.
      const stopBtn = e.target.closest(".ed-cpg-stop");
      if (stopBtn && d) { d.sel = +stopBtn.dataset.stop; cpRerender(); return; }
      // Add a stop (midpoint, interpolated-ish colour) and select it.
      if (e.target.closest('[data-cpg="add"]') && d) {
        const sorted = d.stops.slice().sort(function (a, b) { return a.pos - b.pos; });
        const last = sorted[sorted.length - 1], prev = sorted[sorted.length - 2];
        const pos = Math.round(Math.max(0, Math.min(100, (last.pos + prev.pos) / 2)));
        d.stops.push({ color: last.color === "transparent" ? "#FFFFFF" : last.color, pos: pos });
        d.sel = d.stops.length - 1;
        cpRerender(); cpCommit(); return;
      }
      // Remove the selected stop (never below 2).
      if (e.target.closest('[data-cpg="del"]') && d && d.stops.length > 2) {
        d.stops.splice(Math.max(0, Math.min(d.stops.length - 1, d.sel || 0)), 1);
        d.sel = 0; cpRerender(); cpCommit(); return;
      }
      const sw = e.target.closest(".ed-cp-sw");
      if (!sw) return;
      if (sw.dataset.grad && panel._onGradient) {
        try {
          const g = JSON.parse(sw.dataset.grad);
          panel._onGradient(g);
          // Mirror the chosen preset into the custom editor so it's tweakable.
          panel._gradDraft = cpInitGradDraft(Object.assign({ enabled: true }, g), null);
          cpRerender();
        } catch (_) {}
      } else if (sw.dataset.hex && panel._onSolid) {
        pushRecentColor(sw.dataset.hex);
        panel._onSolid(sw.dataset.hex);
      }
    });

    // Live preview while dragging (cheap, no canvas re-render / history churn).
    panel.addEventListener("input", (e) => {
      if (!e.target.closest(".ed-cpg")) return;
      cpReadAll();
      // Editing the selected stop's colour should recolour its swatch live.
      const stop = cpSelStop();
      const selSwatch = cpRoot() && cpRoot().querySelector(".ed-cpg-stop.is-sel");
      if (stop && selSwatch && stop.color !== "transparent") selSwatch.style.background = stop.color;
      cpRefresh();
    });
    // Commit to the element (+ one history entry) on release / blur.
    panel.addEventListener("change", (e) => {
      const t = e.target;
      if (!t.closest(".ed-cpg")) return;
      cpReadAll();
      if (t.dataset.cpg === "selFade") cpRerender();
      cpRefresh(); cpCommit();
    });

    panel.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      // Gradient editor hex field commits on Enter.
      const gh = e.target.closest(".ed-cpg-hex");
      if (gh) { cpReadAll(); cpRerender(); cpCommit(); return; }
      const inp = e.target.closest(".ed-cp-hex");
      if (!inp) return;
      const h = normHex(inp.value);
      if (h && panel._onSolid) { pushRecentColor(h); panel._onSolid(h); }
    });

    /* The spectrum picker, sitting under "Add a colour". It reports live while
       you drag, and the hex box beside it keeps up - so the hex is always
       readable, whichever way the colour was chosen. */
    panel.addEventListener("input", (e) => {
      const nat = e.target.closest(".ed-cp-native-input");
      if (!nat) return;
      const h = normHex(nat.value);
      if (!h) return;
      const hex = panel.querySelector(".ed-cp-hex");
      if (hex) hex.value = h;
      if (panel._onSolid) panel._onSolid(h);
    });
    panel.addEventListener("change", (e) => {
      if (e.target.closest(".ed-cp-native-input")) pushRecentColor(normHex(e.target.value));
    });
  })();

  // ---------- Right-click context menu ----------
  // Replaces the in-toolbar Bring forward / Send back buttons. Right-click
  // any selected element (or anywhere on the canvas; we'll try to hit-test)
  // and a small floating menu appears at the cursor with z-order + duplicate
  // / delete + (text only) link options.
  const ctxMenu = document.createElement("div");
  ctxMenu.className = "ed-rclick";
  ctxMenu.hidden = true;
  document.body.appendChild(ctxMenu);

  function hideContextMenu() { ctxMenu.hidden = true; }

  function showContextMenu(x, y, el) {
    if (!el) return;
    // Make sure the right-clicked element is selected so subsequent actions
    // (which read state.selectedIds) target it.
    if (!state.selectedIds.includes(el.id)) {
      state.selectedIds = [el.id];
      fullRender();
    }

    const items = [];

    // Authoring control, admin only: mark which element on a template is the
    // brand's logo. A customer opening the template gets their own logo in
    // this box, or their brand name if they haven't uploaded one.
    if (isAdminMode()) {
      const isSlot = el.brandRole === "logo";
      items.push({
        label: isSlot ? "✓ Brand logo slot" : "Mark as brand logo slot",
        action: function () {
          if (isSlot) delete el.brandRole;
          else el.brandRole = "logo";
          pushHistory();
          fullRender();
          toast(isSlot ? "No longer the logo slot" : "This is the logo slot now");
        },
      });
    }

    items.push(
      // Z-order — collapsed into a hover fly-out so the menu isn't a wall of
      // options you rarely need all at once.
      { label: "Layer", submenu: [
        { label: "Bring forward",  action: function () { bringForward(); } },
        { label: "Send back",      action: function () { sendBack(); } },
        { label: "Bring to front", action: function () { bringToFront(); } },
        { label: "Send to back",   action: function () { sendToBack(); } },
      ] },
      // Align to the page — fly-out submenu.
      { label: "Align to page", submenu: [
        { label: "Left",   action: function () { alignSelected("left"); } },
        { label: "Centre", action: function () { alignSelected("centerX"); } },
        { label: "Right",  action: function () { alignSelected("right"); } },
        { label: "Top",    action: function () { alignSelected("top"); } },
        { label: "Middle", action: function () { alignSelected("centerY"); } },
        { label: "Bottom", action: function () { alignSelected("bottom"); } },
      ] },
      { label: "Flip", submenu: [
        { label: "Horizontal", action: function () { flipSelected("h"); } },
        { label: "Vertical",   action: function () { flipSelected("v"); } },
      ] },
      { divider: true },
      { label: "Copy",            hint: "Ctrl+C", action: function () { copySelectedToClipboard(); } },
      { label: "Duplicate",       hint: "Ctrl+D", action: function () { duplicateSelected(); } },
      { label: "Delete",          hint: "Del", action: function () { deleteSelected(); }, danger: true }
    );

    if (el.type === "text") {
      items.push({ divider: true });
      if (el.link) {
        items.push({ label: "Edit link…", action: function () { promptLink(el); } });
        items.push({ label: "Remove link", action: function () { el.link = null; pushHistory(); fullRender(); } });
      } else {
        items.push({ label: "Add link…", action: function () { promptLink(el); } });
      }
    }

    // "Detach from frame" — pull the photo out of a filled frame as a free
    // image, leaving the empty frame behind.
    if (el.type === "frame" && el.src) {
      items.push({ divider: true });
      items.push({ label: "Detach from frame", action: function () { detachFrameImage(el); } });
    }

    // "Set as background" — available for any element with an image source.
    // Images carry it on .src; filled frames also carry it on .src.
    // We also remove the source element when promoting it to background
    // so the design doesn't end up with a duplicate of the image — the
    // user expects the layer to migrate, not to be cloned.
    const photoSrc = (el.type === "image" || el.type === "frame") ? el.src : null;
    if (photoSrc) {
      items.push({ divider: true });
      items.push({ label: "Set as background", action: function () {
        if (el && el.id) {
          state.elements = state.elements.filter(function (x) { return x.id !== el.id; });
          state.selectedIds = state.selectedIds.filter(function (id) { return id !== el.id; });
        }
        setCanvasBackgroundImage(photoSrc);
      } });
    }
    if (state.canvas.backgroundImage) {
      items.push({ label: "Clear background image", action: function () { setCanvasBackgroundImage(null); } });
    }

    let subIdx = 0;
    const subDefs = [];
    ctxMenu.innerHTML = items.map(function (it) {
      if (it.divider) return '<div class="ed-rclick-divider"></div>';
      if (it.submenu) {
        const id = subIdx++;
        subDefs.push({ id: id, submenu: it.submenu });
        return (
          '<button type="button" class="ed-rclick-item has-sub" data-sub="' + id + '">' +
            '<span>' + it.label + '</span><span class="ed-rclick-arrow">&rsaquo;</span>' +
          '</button>'
        );
      }
      return (
        '<button type="button" class="ed-rclick-item' + (it.danger ? ' is-danger' : '') + '">' +
          '<span>' + it.label + '</span>' +
          (it.hint ? '<span class="ed-rclick-hint">' + it.hint + '</span>' : '') +
        '</button>'
      );
    }).join("");

    // Fly-out panels (one per submenu) — appended after the list so they sit on
    // top and are positioned beside their parent item on hover.
    subDefs.forEach(function (def) {
      const fl = document.createElement("div");
      fl.className = "ed-rclick-flyout";
      fl.dataset.flyout = def.id;
      fl.innerHTML = def.submenu.map(function (s) {
        return '<button type="button" class="ed-rclick-item"><span>' + s.label + '</span></button>';
      }).join("");
      ctxMenu.appendChild(fl);
      const sbtns = fl.querySelectorAll(".ed-rclick-item");
      def.submenu.forEach(function (s, k) {
        sbtns[k].addEventListener("click", function () { hideContextMenu(); s.action(); });
      });
    });

    // Position with a small offset; if it would overflow the viewport, flip.
    const w = 220;
    const h = items.length * 34 + 16;
    const px = Math.min(x + 2, window.innerWidth - w - 8);
    const py = Math.min(y + 2, window.innerHeight - h - 8);
    ctxMenu.style.left = px + "px";
    ctxMenu.style.top = py + "px";
    ctxMenu.hidden = false;

    const closeFlyouts = function () { ctxMenu.querySelectorAll(".ed-rclick-flyout").forEach(function (f) { f.classList.remove("is-open"); }); };
    const flipLeft = (ctxMenu.getBoundingClientRect().right + 180 > window.innerWidth);

    // Wire top-level items (direct-child buttons only — not the fly-out buttons).
    const topBtns = ctxMenu.querySelectorAll(":scope > .ed-rclick-item");
    let i = 0;
    items.forEach(function (it) {
      if (it.divider) return;
      const btn = topBtns[i++];
      if (it.submenu) {
        const fl = ctxMenu.querySelector('.ed-rclick-flyout[data-flyout="' + btn.dataset.sub + '"]');
        btn.addEventListener("mouseenter", function () {
          closeFlyouts();
          if (!fl) return;
          fl.style.top = (btn.offsetTop - 6) + "px";
          fl.classList.toggle("flip-left", flipLeft);
          fl.classList.add("is-open");
        });
      } else {
        btn.addEventListener("mouseenter", closeFlyouts);
        btn.addEventListener("click", function () { hideContextMenu(); it.action(); });
      }
    });
  }

  // Align the currently-selected element relative to the canvas bounds.
  // mode: "left" | "centerX" | "right" | "top" | "centerY" | "bottom"
  /* Align to the page. Works on whatever is selected, one element or twenty:
     the selection's bounding box is what gets centred, and everything moves by
     the same offset, so the arrangement you built is preserved rather than
     collapsed into a stack. It used to read selectedIds[0] and move only that,
     which is why aligning a group appeared to do nothing much. For a single
     element the maths is identical to before. */
  function alignSelected(mode) {
    const els = selectedElements();
    if (!els.length) return;
    const cw = state.canvas.width, ch = state.canvas.height;
    const minX = Math.min.apply(null, els.map(function (e) { return e.x; }));
    const minY = Math.min.apply(null, els.map(function (e) { return e.y; }));
    const maxX = Math.max.apply(null, els.map(function (e) { return e.x + e.w; }));
    const maxY = Math.max.apply(null, els.map(function (e) { return e.y + e.h; }));
    const bw = maxX - minX, bh = maxY - minY;

    let dx = 0, dy = 0;
    if (mode === "left")     dx = -minX;
    if (mode === "centerX")  dx = Math.round((cw - bw) / 2) - minX;
    if (mode === "right")    dx = (cw - bw) - minX;
    if (mode === "top")      dy = -minY;
    if (mode === "centerY")  dy = Math.round((ch - bh) / 2) - minY;
    if (mode === "bottom")   dy = (ch - bh) - minY;
    if (!dx && !dy) return;

    els.forEach(function (e) { e.x = Math.round(e.x + dx); e.y = Math.round(e.y + dy); });
    pushHistory();
    fullRender();
  }

  // Toggle a flip flag on the element. Render + export both honour it.
  function flipSelected(axis) {
    const el = getEl(state.selectedIds[0]);
    if (!el) return;
    if (axis === "h") el.flipX = !el.flipX;
    if (axis === "v") el.flipY = !el.flipY;
    pushHistory();
    fullRender();
  }

  // Copy the current selection to an in-memory clipboard. Paste behaviour
  // is already wired in keyboard shortcuts further down (state.clipboard).
  function copySelectedToClipboard() {
    const els = selectedElements();
    if (!els.length) return;
    state.clipboard = els.map(deep);
    toast(els.length + " copied");
  }

  // Simple prompt-based link editor. Could become a popover later.
  function promptLink(el) {
    const current = el.link || "";
    const next = prompt("Link URL (leave blank to remove)", current);
    if (next === null) return; // cancelled
    const trimmed = String(next).trim();
    el.link = trimmed || null;
    pushHistory();
    fullRender();
  }

  document.addEventListener("click", function () { hideContextMenu(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !ctxMenu.hidden) hideContextMenu();
  });

  // Bare-canvas right-click — when no element was the target, surface a
  // tiny menu that lets the user detach the background image. Without
  // this, they'd have to dive into the Background tab to find the
  // detach button, which is non-obvious when the image is taking up
  // the whole canvas.
  function showBgOnlyContextMenu(x, y) {
    if (!state.canvas.backgroundImage) return;
    const items = [{
      label: "Detach background image",
      action: function () { setCanvasBackgroundImage(null); },
    }];
    ctxMenu.innerHTML = items.map(function (it) {
      return '<button type="button" class="ed-rclick-item"><span>' + it.label + '</span></button>';
    }).join("");
    const w = 220;
    const h = items.length * 32 + 16;
    const px = Math.min(x + 2, window.innerWidth - w - 8);
    const py = Math.min(y + 2, window.innerHeight - h - 8);
    ctxMenu.style.left = px + "px";
    ctxMenu.style.top = py + "px";
    ctxMenu.hidden = false;
    const buttons = ctxMenu.querySelectorAll(".ed-rclick-item");
    items.forEach(function (it, i) {
      buttons[i].addEventListener("click", function () {
        hideContextMenu();
        it.action();
      });
    });
  }

  // Hook the contextmenu event on the canvas. Resolves which element was
  // clicked by hit-testing against state.elements (top-most first).
  // If nothing was hit, fall back to the bare-canvas menu (above) so
  // the user can still detach the background.
  if (canvasEl) {
    canvasEl.addEventListener("contextmenu", function (e) {
      const target = e.target.closest(".ed-element");
      if (!target) {
        if (state.canvas.backgroundImage) {
          e.preventDefault();
          showBgOnlyContextMenu(e.clientX, e.clientY);
        }
        return;
      }
      e.preventDefault();
      const id = target.getAttribute("data-id");
      const el = getEl(id);
      if (!el) return;
      showContextMenu(e.clientX, e.clientY, el);
    });
  }

  // SVG icons used in the context bar.
  /* Align-to-page glyphs: the outlined rectangle is the page, the solid bar is
     where the selection ends up. Local to this panel — ICONS carries only the
     context-bar set. */
  const ALIGN_ICONS = (function () {
    const frame = '<rect x="2.5" y="2.5" width="15" height="15" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.45"/>';
    const bar = function (x, y, w, h) {
      return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="0.8" fill="currentColor"/>';
    };
    const svg = function (inner) {
      return '<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">' + frame + inner + '</svg>';
    };
    return {
      left:    svg(bar(4, 6.5, 5, 7)),
      centerX: svg(bar(7.5, 6.5, 5, 7)),
      right:   svg(bar(11, 6.5, 5, 7)),
      top:     svg(bar(6.5, 4, 7, 5)),
      centerY: svg(bar(6.5, 7.5, 7, 5)),
      bottom:  svg(bar(6.5, 11, 7, 5)),
    };
  })();

  const ICONS = {
    // Placing the artwork inside a screen: crop marks with arrows through them,
    // for the one control that moves the picture rather than the box.
    place:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M7 3v14h14"/>' +
      '<path d="M3 7h14v14"/>' +
      '<path d="M10.5 10.5l3 3M13.5 10.5l-3 3"/>' +
      '</svg>',
    opacity:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="9"/>' +
      '<path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>' +
      '</svg>',
    stroke:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">' +
      '<path d="M4 12h16"/>' +
      '</svg>',
    radius:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 20V10a6 6 0 0 1 6-6h10"/>' +
      '</svg>',
    delete:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>' +
      '</svg>',
  };

  // ---------- Background removal (@imgly, runs in-browser) ----------
  // editor.js is served as a public/ asset (not bundled by Vite), so we
  // can't use a bare "@imgly/background-removal" specifier — the browser
  // wouldn't know how to resolve it. Loading the ESM build from JSDelivr
  // works in any browser that supports dynamic import. ~700KB of JS plus
  // a ~30MB ONNX model on first run, both cached after.
  let _bgRemoveModule = null;
  async function getBgRemover() {
    if (_bgRemoveModule) return _bgRemoveModule;
    _bgRemoveModule = await import(
      /* @vite-ignore */
      "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm"
    );
    return _bgRemoveModule;
  }

  async function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  async function fetchAsBlob(src) {
    // Already a data URL or blob URL — convert via fetch.
    const res = await fetch(src, { mode: "cors" });
    if (!res.ok) throw new Error("Could not load source image (status " + res.status + ").");
    return await res.blob();
  }

  async function runBackgroundRemoval(el, button) {
    if (!el || el.type !== "image" || !el.src) return;
    const originalLabel = button ? button.textContent : null;
    if (button) {
      button.disabled = true;
      button.textContent = "Loading model…";
    }
    toast("Loading background remover (first run downloads ~30MB)…", 4000);

    try {
      const { removeBackground } = await getBgRemover();
      if (button) button.textContent = "Cutting out…";

      const srcBlob = await fetchAsBlob(el.src);
      const resultBlob = await removeBackground(srcBlob);
      const dataUrl = await blobToDataUrl(resultBlob);

      el.src = dataUrl;
      pushHistory();
      fullRender();
      toast("Background removed");
    } catch (err) {
      console.error("[bg-remove]", err);
      const msg = err && err.message ? err.message : "Background removal failed";
      toast(msg.slice(0, 80), 3500);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel || "Remove background";
      }
    }
  }

  // ---------- Font picker (searchable, lazy CSS load) ----------
  // Returns a DOM element. Two modes:
  //   options.inline = false (default)  → trigger button + popover. Used in
  //     the context bar where vertical room is constrained.
  //   options.inline = true             → search + scrollable list always
  //     visible inline. Used in the right properties panel.
  function createFontPicker(currentName, onChange, options) {
    const opts = options || {};
    const inline = !!opts.inline;
    let current = currentName;

    const wrap = document.createElement("div");
    wrap.className = "ed-font-picker" + (inline ? " is-inline" : "");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "ed-font-trigger";
    trigger.textContent = current || (FONTS[0] && FONTS[0].name) || "Pick a font";
    wrap.appendChild(trigger);

    const pop = document.createElement("div");
    pop.className = "ed-font-pop";
    if (!inline) pop.hidden = true;

    const search = document.createElement("input");
    search.type = "search";
    search.className = "ed-font-search";
    search.placeholder = "Search fonts…";
    pop.appendChild(search);

    const list = document.createElement("div");
    list.className = "ed-font-list";
    pop.appendChild(list);

    function renderList(query) {
      const q = (query || "").trim().toLowerCase();
      list.innerHTML = "";
      FONTS.forEach(function (f) {
        if (q && f.name.toLowerCase().indexOf(q) === -1) return;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ed-font-item" + (f.name === current ? " is-current" : "");
        b.textContent = f.name;
        b.title = f.category || "";
        b.addEventListener("click", function () {
          loadGoogleFont(f.name);
          current = f.name;
          trigger.textContent = f.name;
          onChange(f.name);
          if (!inline) close();
        });
        list.appendChild(b);
      });
      if (!list.children.length) {
        const empty = document.createElement("div");
        empty.className = "ed-font-empty";
        empty.textContent = q
          ? "No fonts matching \"" + q + "\"."
          : "Loading fonts…";
        list.appendChild(empty);
      }
    }
    renderList("");

    function position() {
      // For the popover variant, compute viewport-fixed coordinates from the
      // trigger button. Necessary because the ancestor (.ed-context) uses
      // overflow-x: auto which clips position: absolute children.
      if (inline) return;
      const r = trigger.getBoundingClientRect();
      const width = Math.max(r.width, 280);
      pop.style.top = (r.bottom + 4) + "px";
      pop.style.left = Math.min(r.left, window.innerWidth - width - 8) + "px";
      pop.style.width = width + "px";
    }

    function open() {
      if (inline) return; // already visible
      pop.hidden = false;
      position();
      search.value = "";
      renderList("");
      setTimeout(function () { search.focus(); }, 0);
    }
    function close() {
      if (inline) return;
      pop.hidden = true;
    }

    if (!inline) {
      trigger.addEventListener("click", function (e) {
        e.stopPropagation();
        // When a host supplies onOpen (the toolbar does, to open the full Text
        // side panel instead of this small popover), defer to it.
        if (typeof opts.onOpen === "function") { opts.onOpen(); return; }
        pop.hidden ? open() : close();
      });
      // Close on outside click / page-level scroll / resize / Escape.
      document.addEventListener("click", function (e) {
        if (!pop.hidden && !wrap.contains(e.target) && !pop.contains(e.target)) close();
      });
      document.addEventListener("keydown", function (e) {
        if (!pop.hidden && e.key === "Escape") close();
      });
      // Scroll handler uses capture so it sees scrolls on any element. We
      // only want to close when something OUTSIDE the popover scrolls
      // (so the popover doesn't follow a stale anchor). Scrolling the
      // font list itself is fine and should not close.
      window.addEventListener("scroll", function (e) {
        if (pop.hidden) return;
        if (pop.contains(e.target)) return;
        close();
      }, true);
      window.addEventListener("resize", function () {
        if (!pop.hidden) position();
      });
    }

    search.addEventListener("input", function () { renderList(search.value); });

    wrap.appendChild(pop);
    return wrap;
  }

  // Make sure any Google Fonts referenced in a template/design are loaded as
  // soon as we encounter them, so the canvas renders in the right typeface.
  function preloadFontsForElements(elements) {
    if (!elements) return;
    elements.forEach(function (el) {
      if (el && el.type === "text" && el.font) loadGoogleFont(el.font);
    });
  }

  // ---------- History ----------
  // ---- Autosave + save safety net (admin) — the "dead-man's-lock" ------
  // localStorage autosave runs on EVERY change in admin mode, independent of
  // Supabase or the admin bootstrap, so a design is NEVER lost even if the
  // cloud save is completely down — it can always be recovered via "Sync local
  // drafts". Admin mode is read from the URL so it does NOT depend on the
  // bootstrap (which previously gated everything via __TMKE_AUTOSAVE__ — when
  // the bootstrap 404'd, even the local net was off and work could be lost).
  const ADMIN_MODE_URL = (function () {
    try { return new URLSearchParams(window.location.search).get("mode") === "admin"; } catch (_) { return false; }
  })();
  let _autosaveTimer = null;
  let _dbSaveTimer = null;
  let _dbSaving = false;
  let _dbRetries = 0;

  // Persistent save-status pill so a failed cloud save is never silent.
  function setSaveStatus(kind) {
    if (!ADMIN_MODE_URL && typeof window.__TMKE_DESIGN_SAVE__ !== "function") return;
    let el = document.getElementById("ed-save-status");
    if (!el) {
      el = document.createElement("div");
      el.id = "ed-save-status";
      el.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:120;font-family:var(--sans,sans-serif);font-size:12px;font-weight:700;letter-spacing:0.03em;padding:6px 14px;border-radius:999px;pointer-events:none;transition:opacity 0.35s;box-shadow:0 6px 18px -8px rgba(28,29,34,0.4);";
      document.body.appendChild(el);
    }
    clearTimeout(el._hideT);
    el.style.opacity = "1";
    if (kind === "saving") { el.textContent = "Saving…"; el.style.background = "#fff"; el.style.color = "rgba(28,29,34,0.7)"; }
    else if (kind === "saved") { el.textContent = "All changes saved ✓"; el.style.background = "#e7f3ea"; el.style.color = "#2d6a44"; el._hideT = setTimeout(function () { el.style.opacity = "0"; }, 1800); }
    else if (kind === "local") { el.textContent = "⚠ Saved on this device — not yet in the cloud"; el.style.background = "#fcefe6"; el.style.color = "#a05a3c"; el.title = "Your work is safe in this browser. The message that appeared says why the cloud save failed."; }
  }

  function autosaveDraft() {
    if (!ADMIN_MODE_URL) return;
    if (!state.templateId) state.templateId = "draft-" + Date.now(); // new / imported designs get a stable key
    try {
      localStorage.setItem("tmke.editor." + state.templateId, JSON.stringify({
        templateId: state.templateId,
        filename: filenameEl ? filenameEl.value : "Draft",
        canvas: state.canvas,
        elements: state.elements,
        pages: deep(state.pages),
        guides: deep(state.guides || []),
        savedAt: Date.now(),
      }));
    } catch (_) {}
  }
  // Also persist to the Supabase `templates` row when the cloud hook is up. On
  // failure the work is already safe locally — show it + retry with backoff so
  // a transient blip self-heals without anyone losing work.
  async function autosaveToDb() {
    const adminHook = ADMIN_MODE_URL && typeof window.__TMKE_ADMIN_SAVE__ === "function";
    const designHook = !ADMIN_MODE_URL && typeof window.__TMKE_DESIGN_SAVE__ === "function";
    if (!adminHook && !designHook) { if (ADMIN_MODE_URL) setSaveStatus("local"); return; }
    // Admin never autosaves a scratch draft over a real template row.
    if (adminHook && (!state.templateId || String(state.templateId).indexOf("draft-") === 0)) return;
    if (_dbSaving) { clearTimeout(_dbSaveTimer); _dbSaveTimer = setTimeout(autosaveToDb, 1500); return; }
    _dbSaving = true;
    setSaveStatus("saving");
    let ok = false;
    try {
      let thumb, render;
      try { ({ thumb, render } = await _renderPreviewPair()); } catch (_) {}
      const payload = {
        templateId: state.templateId,
        filename: filenameEl ? filenameEl.value : "",
        canvas: state.canvas,
        elements: state.elements,
        pages: deep(state.pages),
        guides: deep(state.guides || []),
        savedAt: Date.now(),
        thumb,
        render,
      };
      const res = await (adminHook ? window.__TMKE_ADMIN_SAVE__(payload) : window.__TMKE_DESIGN_SAVE__(payload));
      ok = res === true || (res && res.ok === true);
      // Customer: adopt the new copy's id so subsequent saves update the same row.
      if (designHook && res && res.id && state.templateId !== res.id) state.templateId = res.id;
    } catch (_) { ok = false; }
    _dbSaving = false;
    if (ok) { _dbRetries = 0; setSaveStatus("saved"); }
    else {
      // Cloud save failed — work is safe locally. Retry a few times with backoff
      // so a transient blip self-heals; then stop hammering (the next edit or a
      // manual Save tries again). The localStorage copy never depends on this.
      setSaveStatus("local");
      _dbRetries++;
      if (_dbRetries <= 5) {
        clearTimeout(_dbSaveTimer);
        _dbSaveTimer = setTimeout(autosaveToDb, Math.min(30000, 2000 * _dbRetries));
      }
    }
  }
  function scheduleAutosave() {
    const customer = !ADMIN_MODE_URL && typeof window.__TMKE_DESIGN_SAVE__ === "function";
    if (!ADMIN_MODE_URL && !customer) return;
    if (ADMIN_MODE_URL) {   // admin also keeps a local draft; customers save to their copy only
      clearTimeout(_autosaveTimer);
      _autosaveTimer = setTimeout(autosaveDraft, 1200);
    }
    clearTimeout(_dbSaveTimer);
    _dbSaveTimer = setTimeout(autosaveToDb, 3500);       // cloud copy
  }
  window.addEventListener("beforeunload", function () { try { if (ADMIN_MODE_URL) autosaveDraft(); } catch (_) {} });

  function pushHistory() {
    // Drop forward history
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push({
      canvas: deep(state.canvas),
      elements: deep(state.elements),
      guides: deep(state.guides || []),
    });
    if (state.history.length > 80) state.history.shift();
    state.historyIndex = state.history.length - 1;
    updateUndoRedoButtons();
    scheduleAutosave();   // admin: persist a draft shortly after each change
  }

  function undo() {
    if (state.historyIndex <= 0) return;
    state.historyIndex--;
    const snap = state.history[state.historyIndex];
    state.canvas = deep(snap.canvas);
    state.elements = deep(snap.elements);
    if (snap.guides) state.guides = deep(snap.guides);
    state.selectedIds = state.selectedIds.filter((id) => getEl(id));
    fullRender();
    updateUndoRedoButtons();
  }

  function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex++;
    const snap = state.history[state.historyIndex];
    state.canvas = deep(snap.canvas);
    state.elements = deep(snap.elements);
    if (snap.guides) state.guides = deep(snap.guides);
    state.selectedIds = state.selectedIds.filter((id) => getEl(id));
    fullRender();
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    $("ed-undo").disabled = state.historyIndex <= 0;
    $("ed-redo").disabled = state.historyIndex >= state.history.length - 1;
  }

  // House standard is 1080×1440 (Instagram portrait). Upgrade the legacy
  // 1080×1350 default the moment a design loads so nothing is ever launched or
  // saved at the old size — full-bleed top-anchored layers stretch to fill the
  // taller canvas. Deliberately custom sizes (anything other than exactly
  // 1080×1350) are left untouched.
  function normalizeLegacySize() {
    const fix = (cv, els) => {
      if (!cv || cv.width !== 1080 || cv.height !== 1350) return;
      cv.height = 1440;
      (els || []).forEach((el) => {
        if (el && el.y === 0 && el.h === 1350 && (el.type === "image" || el.type === "rect" || el.type === "frame")) el.h = 1440;
      });
    };
    fix(state.canvas, state.elements);
    (state.pages || []).forEach((p) => fix(p.canvas, p.elements));
  }

  // ---------- Load template ----------
  function loadTemplate(tplId, fresh) {
    let tpl = TEMPLATES.find((t) => t.id === tplId);
    // If the id isn't a bundled/pack template but a saved draft exists for it
    // (a Canva import or blank design autosaved under a "draft-…" id), keep the
    // id so we restore THAT draft rather than falling back to the first template.
    let draftRaw = null;
    if (!tpl && tplId) { try { draftRaw = localStorage.getItem("tmke.editor." + tplId); } catch (_) {} }
    if (!tpl) tpl = TEMPLATES[0];
    if (!tpl) return;
    resetToSinglePage(tpl.canvas && tpl.canvas.background);
    state.templateId = draftRaw ? tplId : tpl.id;

    // Try to restore saved state
    if (!fresh) {
      try {
        const saved = JSON.parse((draftRaw != null ? draftRaw : localStorage.getItem("tmke.editor." + tpl.id)) || "null");
        if (saved && (saved.pages || saved.elements)) {
          if (saved.pages && saved.pages.length) {
            state.pages = saved.pages;
            state.currentPage = 0;
          } else {
            state.canvas = saved.canvas;
            state.elements = saved.elements;
          }
          state.selectedIds = [];
          state.selectedGuideId = null;
          state.guides = Array.isArray(saved.guides) ? saved.guides : [];
          filenameEl.value = takeInitialTitle() || saved.filename || tpl.name;
          state.history = [];
          state.historyIndex = -1;
          state.pages.forEach((pg) => preloadFontsForElements(pg.elements));
          // Reopening a design you have already worked on comes through here
          // and used to return without ever substituting, so a template edited
          // once kept showing {brand name} and an empty logo slot no matter
          // what was in the brand kit. Safe to run on a restored copy: merge
          // tags only touch text that still contains a tag, and a logo slot
          // only fills while it is still text — anything you have typed or
          // replaced yourself is left exactly as you left it.
          if (!isAdminMode()) { fillTemplateMergeTags(); fillTemplateLogos(); nudgeIfBrandNameMissing(); }
          normalizeLegacySize();
          pushHistory();
          fullRender();
          fitZoom();
          return;
        }
      } catch (e) {}
    }

    preloadFontsForElements(tpl.elements);
    state.canvas = deep(tpl.canvas);
    state.elements = deep(tpl.elements);
    state.selectedIds = [];
    filenameEl.value = takeInitialTitle() || tpl.name;
    // Auto-substitute merge tags ({brand name}, etc.) from the customer's
    // saved brand kit. Skipped in admin mode so admins can author templates
    // with the tokens visible and intact. Customers can still hand-edit any
    // text afterwards — this just gives them a personalised starting point.
    if (!isAdminMode()) { fillTemplateMergeTags(); fillTemplateLogos(); nudgeIfBrandNameMissing(); }
    normalizeLegacySize();
    state.history = [];
    state.historyIndex = -1;
    pushHistory();
    fullRender();
    fitZoom();
  }

  // ---------- Load a member's saved design (their own copy) ----------
  // Mirrors loadTemplate's restore branch but from a passed-in design object
  // (from user_designs), so multi-page copies re-open correctly.
  function loadDesignData(d) {
    if (!d || !d.id) { loadBlank(); return; }
    resetToSinglePage(d.canvas && d.canvas.background);
    state.templateId = d.id;
    if (d.pages && d.pages.length) { state.pages = d.pages; state.currentPage = 0; }
    else { if (d.canvas) state.canvas = d.canvas; state.elements = d.elements || []; }
    state.selectedIds = [];
    state.selectedGuideId = null;
    state.guides = [];
    if (filenameEl) filenameEl.value = d.name || "My design";
    state.history = [];
    state.historyIndex = -1;
    (state.pages || []).forEach((pg) => preloadFontsForElements(pg.elements));
    if (!(d.pages && d.pages.length)) preloadFontsForElements(state.elements);
    normalizeLegacySize();
    pushHistory();
    fullRender();
    fitZoom();
  }

  // ---------- Blank canvas ----------
  // A truly-empty starting point. White, because that is what a blank page is
  // and because the violet it used to be belongs to no palette we use. The
  // "Start building here" hint is DOM-only (see fullRender), so it never lands
  // in an export.
  function loadBlank(w, h) {
    resetToSinglePage("#ffffff", w, h);
    state.templateId = null;
    state.elements = [];
    state.selectedIds = [];
    filenameEl.value = takeInitialTitle() || "Untitled";
    state.history = [];
    state.historyIndex = -1;
    pushHistory();
    fullRender();
    fitZoom();
  }

  // ---------- Pages ----------
  // Collapse back to a single page (used whenever a whole template/blank is
  // loaded — that's a one-page design until the user adds more).
  function resetToSinglePage(bg, w, h) {
    // 1080×1440 is the house standard (Instagram portrait). The onboarding size
    // chooser can pass an explicit w/h; anyone can also resize later from the
    // Resize panel. This is just where a blank starts.
    const cw = Math.round(w) > 0 ? Math.round(w) : 1080;
    const ch = Math.round(h) > 0 ? Math.round(h) : 1440;
    state.pages = [{
      id: uid("page"), name: "Page 1",
      canvas: { width: cw, height: ch, background: bg || "#F2EFE9" },
      elements: [],
    }];
    state.currentPage = 0;
  }

  function loadPage(i) {
    state.currentPage = Math.max(0, Math.min(state.pages.length - 1, i));
    state.selectedIds = [];
    state.history = [];
    state.historyIndex = -1;
    preloadFontsForElements(state.elements);
    pushHistory();
    fullRender();
    fitZoom();
  }

  function goToPage(i) {
    if (i === state.currentPage) return;
    loadPage(i);
  }

  function addPage() {
    const cur = state.pages[state.currentPage].canvas;
    state.pages.splice(state.currentPage + 1, 0, {
      id: uid("page"), name: "Page " + (state.pages.length + 1),
      canvas: { width: cur.width, height: cur.height, background: cur.background },
      elements: [],
    });
    loadPage(state.currentPage + 1);
  }

  function duplicatePage(i) {
    const src = state.pages[i];
    state.pages.splice(i + 1, 0, {
      id: uid("page"), name: src.name + " copy",
      canvas: deep(src.canvas), elements: deep(src.elements),
    });
    loadPage(i + 1);
  }

  function deletePage(i) {
    if (state.pages.length <= 1) { toast("A design needs at least one page."); return; }
    state.pages.splice(i, 1);
    let next = state.currentPage > i ? state.currentPage - 1 : state.currentPage;
    if (next >= state.pages.length) next = state.pages.length - 1;
    loadPage(next);
  }

  function renderPageStrip() {
    const strip = document.getElementById("ed-pages");
    if (!strip) return;
    // No visible scrollbar — hover the strip and scroll the wheel to move through
    // the pages horizontally. Bound once (the container is stable across renders).
    if (!strip.dataset.wheelBound) {
      strip.dataset.wheelBound = "1";
      strip.addEventListener("wheel", (e) => {
        if (strip.scrollWidth <= strip.clientWidth) return; // nothing to scroll
        const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        if (!delta) return;
        strip.scrollLeft += delta;
        e.preventDefault();
      }, { passive: false });
    }
    strip.innerHTML = "";
    const multi = state.pages.length > 1;
    state.pages.forEach((pg, i) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "ed-page-tile" + (i === state.currentPage ? " is-current" : "");
      tile.title = "Page " + (i + 1);
      // Live preview: a rendered thumbnail of the page (background + text),
      // cached on the page as _thumb. Falls back to the raw background image,
      // then the solid colour, until the thumbnail is generated.
      const cvs = pg.canvas || {};
      tile.style.backgroundColor = cvs.background || "#fff";
      const preview = pg._thumb || cvs.backgroundImage;
      if (preview) {
        tile.style.backgroundImage = "url('" + preview + "')";
        tile.style.backgroundSize = "cover";
        tile.style.backgroundPosition = "center";
      } else {
        tile.style.backgroundImage = "";
      }
      tile.addEventListener("click", () => goToPage(i));

      const num = document.createElement("span");
      num.className = "ed-page-num";
      num.textContent = i + 1;
      tile.appendChild(num);

      const acts = document.createElement("span");
      acts.className = "ed-page-acts";
      const dup = document.createElement("span");
      dup.className = "ed-page-act"; dup.title = "Duplicate page"; dup.innerHTML = "&#10697;";
      dup.addEventListener("click", (e) => { e.stopPropagation(); duplicatePage(i); });
      acts.appendChild(dup);
      if (multi) {
        const del = document.createElement("span");
        del.className = "ed-page-act ed-page-del"; del.title = "Delete page"; del.innerHTML = "&times;";
        del.addEventListener("click", (e) => { e.stopPropagation(); deletePage(i); });
        acts.appendChild(del);
      }
      tile.appendChild(acts);
      strip.appendChild(tile);
    });

    const add = document.createElement("button");
    add.type = "button";
    add.className = "ed-page-add";
    add.title = "Add a page";
    add.innerHTML = '<span>+</span><small>Add page</small>';
    add.addEventListener("click", addPage);
    strip.appendChild(add);
  }

  // Background image layout: the photo is scaled to at least cover the frame,
  // times an optional zoom (bgScale >= 1), then panned by bgPosX/bgPosY (0-100,
  // where the visible frame sits over the scaled image). At bgScale 1 this is
  // exactly object-fit:cover + object-position, so existing designs are
  // unchanged — but with zoom there's room to pan LEFT/RIGHT as well as up/down.
  // Returns pixel size + offset in design coordinates, or null until we know the
  // image's natural dimensions.
  function bgLayout(natW, natH) {
    const fw = state.canvas.width, fh = state.canvas.height;
    const nw = natW || state.canvas.bgNatW, nh = natH || state.canvas.bgNatH;
    if (!nw || !nh || !fw || !fh) return null;
    // Fit mode: "contain" shows the WHOLE photo inside the frame (letterboxed,
    // nothing cropped); "cover" (default) fills the frame and crops. Either way
    // the optional zoom (bgScale >= 1) and bgPosX/bgPosY pan/position it.
    const base = state.canvas.bgFit === "contain"
      ? Math.min(fw / nw, fh / nh)
      : Math.max(fw / nw, fh / nh);
    const scale = base * (state.canvas.bgScale ? Math.max(1, state.canvas.bgScale) : 1);
    const sw = nw * scale, sh = nh * scale;
    const px = (state.canvas.bgPosX != null ? state.canvas.bgPosX : 50) / 100;
    const py = (state.canvas.bgPosY != null ? state.canvas.bgPosY : 50) / 100;
    return { sw, sh, ox: (fw - sw) * px, oy: (fh - sh) * py };
  }

  // ---------- Rendering ----------
  function fullRender() {
    canvasEl.style.width = state.canvas.width + "px";
    canvasEl.style.height = state.canvas.height + "px";
    canvasEl.style.background = state.canvas.background;

    // Keep the top-bar size badge in lock-step with the actual canvas. This runs
    // on every render — load, resize (preset or custom), page switch, undo/redo —
    // so it always shows the format you're working in (e.g. 1080 × 1440).
    var _szEl = document.getElementById("ed-canvas-size");
    if (_szEl) {
      var _W = Math.round(state.canvas.width), _H = Math.round(state.canvas.height);
      // Customer Studio shows the platform name (estate agents think in platforms,
      // not pixels); custom sizes fall back to W × H. Admin keeps exact dimensions.
      var _szNames = {
        "1080x1920": "Instagram Story", "1080x1350": "Instagram Portrait",
        "1080x1440": "Instagram Portrait", "1080x1080": "Instagram Square",
        "1200x1200": "Instagram Square", "1200x630": "Facebook Cover",
        "1640x856": "Facebook Cover", "1584x396": "LinkedIn Banner",
        "1200x628": "LinkedIn Post", "600x200": "Email Header"
      };
      var _szName = location.search.indexOf("mode=admin") !== -1 ? null : _szNames[_W + "x" + _H];
      _szEl.textContent = _szName || (_W + " × " + _H);
    }

    canvasEl.innerHTML = "";

    // Background image layer — drawn first so all elements sit on top.
    // Saved on state.canvas.backgroundImage by the right-click action.
    if (state.canvas.backgroundImage) {
      const bg = document.createElement("img");
      bg.src = state.canvas.backgroundImage;
      bg.className = "ed-canvas-bg";
      bg.draggable = false;
      bg.crossOrigin = "anonymous";
      bg.style.position = "absolute";
      bg.style.opacity = state.canvas.backgroundOpacity != null ? state.canvas.backgroundOpacity : 1;
      bg.style.pointerEvents = "none";
      bg.style.userSelect = "none";
      const lay = bgLayout();
      if (lay) {
        // Explicit size + offset (supports zoom + 2-axis pan; matches the export).
        bg.style.left = lay.ox + "px"; bg.style.top = lay.oy + "px";
        bg.style.width = lay.sw + "px"; bg.style.height = lay.sh + "px";
        bg.style.objectFit = "fill";
      } else {
        // Until we know the photo's natural size, fall back to cover + position
        // (identical to the old behaviour), and cache the dims on load.
        bg.style.left = "0"; bg.style.top = "0";
        bg.style.width = "100%"; bg.style.height = "100%";
        bg.style.objectFit = "cover";
        bg.style.objectPosition = (state.canvas.bgPosX != null ? state.canvas.bgPosX : 50) + "% " + (state.canvas.bgPosY != null ? state.canvas.bgPosY : 50) + "%";
        bg.addEventListener("load", function () {
          if (bg.naturalWidth && !state.canvas.bgNatW) {
            state.canvas.bgNatW = bg.naturalWidth;
            state.canvas.bgNatH = bg.naturalHeight;
            fullRender();
          }
        }, { once: true });
      }
      canvasEl.appendChild(bg);
    }

    state.elements.forEach((el) => {
      canvasEl.appendChild(renderElement(el));
    });

    // Blank-canvas hint: a DOM-only "Start building here" prompt shown while
    // a from-scratch canvas is still empty. It carries no element data, so
    // _renderDesignToCanvas (which draws from state) never exports it, and it
    // disappears the moment the user adds anything.
    if (state.elements.length === 0 && !state.canvas.backgroundImage) {
      const hint = document.createElement("div");
      hint.className = "ed-blank-hint";
      hint.textContent = "Start building here";
      hint.title = "Click to edit";
      // Click the prompt to turn it into a real, editable text box that already
      // contains "Start building here" (select-all, so typing replaces it) —
      // rather than dropping a tiny separate body text box.
      hint.addEventListener("click", function (e) {
        e.stopPropagation();
        addPlaceholderText();
      });
      canvasEl.appendChild(hint);
    }

    autosizeTextElements();
    renderHandles();
    renderLayers();
    renderContextBar();
    renderProps();
    renderTextList();   // keep the Text pane's list in step (skips while typing)
    renderTemplateGrid();
    renderPageStrip();
    renderMargins();
    renderGuides();
    // Keep the page-strip preview of the page being edited live (only while the
    // strip is visible, debounced, so editing stays snappy).
    scheduleCurrentThumb();

    // Keep the Background-pane detach button in sync with state. Cheap
    // here (one DOM toggle per render) and means we never have to
    // remember to call it from anywhere else.
    syncBgPane();
    // Keep the Text-panel font browser current (signature-guarded so this is a
    // no-op during drags and only rebuilds when font/weight/favourites change).
    if (typeof maybeRefreshFontBrowser === "function") maybeRefreshFontBrowser();
  }

  // Keep the Background pane in sync with state: image preview, which controls
  // are visible, the opacity values, the fade-colour tint, and the custom swatch.
  function syncBgPane() {
    const hasImg = !!state.canvas.backgroundImage;
    const thumb = document.getElementById("ed-bg-thumb");
    if (thumb) {
      thumb.classList.toggle("has-img", hasImg);
      thumb.style.backgroundImage = hasImg ? ("url(" + JSON.stringify(state.canvas.backgroundImage) + ")") : "";
    }
    const repo = document.getElementById("ed-bg-reposition");
    if (repo) repo.hidden = !hasImg;
    const detach = document.getElementById("ed-bg-detach");
    if (detach) detach.hidden = !hasImg;
    const fit = document.getElementById("ed-bg-fit");
    if (fit) {
      fit.hidden = !hasImg;
      const cur = state.canvas.bgFit === "contain" ? "contain" : "cover";
      fit.querySelectorAll(".ed-bg-fit-btn").forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-bgfit") === cur));
    }
    const ctl = document.getElementById("ed-bg-imgctl");
    if (ctl) ctl.hidden = !hasImg;
    const op = Math.round((state.canvas.backgroundOpacity != null ? state.canvas.backgroundOpacity : 1) * 100);
    const rEl = document.getElementById("ed-bg-opacity"), nEl = document.getElementById("ed-bg-opacity-num");
    if (rEl && document.activeElement !== rEl) rEl.value = op;
    if (nEl && document.activeElement !== nEl) nEl.value = op;
    // Fade colour only matters once the photo is below 100%.
    const tint = document.getElementById("ed-bg-tint");
    if (tint) tint.hidden = !(hasImg && op < 100);
    // Custom circle reflects the current solid background (skip gradients).
    const cwrap = document.getElementById("ed-bg-color-wrap");
    if (cwrap) {
      const bg = state.canvas.background;
      cwrap.style.background = (typeof bg === "string" && bg.indexOf("gradient") === -1) ? bg : "#f4f2f1";
    }
  }

  // ---- Page-strip live previews + busy lock -----------------------------
  // Render a page (background + every element) to a small JPEG thumbnail so the
  // strip shows what each page actually looks like, text and all.
  let _thumbBusy = false, _thumbTimer = null;
  async function buildThumb(i, maxEdge) {
    const orig = state.currentPage;
    state.currentPage = i;              // _renderDesignToCanvas draws the active page
    let url = null;
    try {
      const c = await _renderDesignToCanvas({ transparent: false });
      const long = Math.max(c.width, c.height) || 1;
      const k = long > (maxEdge || 220) ? (maxEdge || 220) / long : 1;
      const t = document.createElement("canvas");
      t.width = Math.max(1, Math.round(c.width * k));
      t.height = Math.max(1, Math.round(c.height * k));
      t.getContext("2d").drawImage(c, 0, 0, t.width, t.height);
      url = t.toDataURL("image/jpeg", 0.72);
    } catch (_) {}
    state.currentPage = orig;
    return url;
  }
  function applyThumbToTile(i, url) {
    if (!url) return;
    const strip = document.getElementById("ed-pages");
    if (!strip) return;
    const tile = strip.querySelectorAll(".ed-page-tile")[i];
    if (tile) {
      tile.style.backgroundImage = "url('" + url + "')";
      tile.style.backgroundSize = "cover";
      tile.style.backgroundPosition = "center";
    }
  }
  // Regenerate every page's thumbnail (after a build, page add/delete, or when
  // the strip is opened).
  async function refreshPageThumbs() {
    if (_thumbBusy) return;
    _thumbBusy = true;
    try {
      for (let i = 0; i < state.pages.length; i++) {
        const url = await buildThumb(i, 220);
        if (url) { state.pages[i]._thumb = url; applyThumbToTile(i, url); }
      }
    } finally { _thumbBusy = false; }
  }
  // After an edit, refresh just the current page's thumbnail — but only while
  // the strip is on screen, and debounced so typing stays smooth.
  function scheduleCurrentThumb() {
    const ed = document.getElementById("editor");
    if (!ed || !ed.classList.contains("show-pages")) return;
    clearTimeout(_thumbTimer);
    _thumbTimer = setTimeout(async () => {
      const i = state.currentPage;
      const url = await buildThumb(i, 220);
      if (url && state.pages[i]) { state.pages[i]._thumb = url; applyThumbToTile(i, url); }
    }, 450);
  }
  window.__TMKE_REFRESH_THUMBS__ = refreshPageThumbs;

  // Busy lock — while the Canva build is placing text page-by-page, stop the
  // user clicking page tiles (which would redirect the text to the wrong page).
  window.__TMKE_SET_BUSY__ = function (on) {
    const ed = document.getElementById("editor");
    if (ed) ed.classList.toggle("ed-busy", !!on);
    if (!on) refreshPageThumbs(); // build finished — refresh previews with the new text
  };

  // Text boxes auto-grow to contain their text (Canva-style) so adding lines
  // (Enter) or wrapping never overflows the bounding box. Grow-only here so a
  // user's larger manual height is respected; live editing tracks both ways.
  function autosizeTextElements() {
    state.elements.forEach(function (el) {
      if (el.type !== "text") return;
      const node = canvasEl.querySelector('.ed-element[data-id="' + el.id + '"]');
      if (!node) return;
      const inner = node.querySelector(".ed-text-inner");
      if (!inner) return;
      const h = Math.ceil(inner.offsetHeight);
      if (h > 0 && h > el.h + 1) { el.h = h; node.style.height = h + "px"; }
    });
  }

  // Set or clear the canvas background image. Passing null clears it.
  function setCanvasBackgroundImage(src) {
    state.canvas.backgroundImage = src || null;
    pushHistory();
    fullRender();
    toast(src ? "Set as background" : "Background image cleared");
    // Keep the Background pane's detach button in sync — it only shows
    // when there's an image to remove.
    try {
      const btn = document.getElementById("ed-bg-detach");
      if (btn) btn.hidden = !state.canvas.backgroundImage;
    } catch (_) {}
  }

  function partialRenderElement(el) {
    const node = canvasEl.querySelector('[data-id="' + el.id + '"]');
    if (!node) return;
    applyElementStyles(node, el);
    // For text, re-apply type styles so live changes (e.g. font scaling on a
    // corner resize) show immediately, not only after a full render.
    if (el.type === "text") {
      const inner = node.querySelector(".ed-text-inner");
      if (inner) applyTextStyles(inner, el);
    }
    // For frames, also re-apply the inner image transform — a resize
    // changes the cover-fit base, and a viewpoint drag changes the offsets.
    if (el.type === "frame") {
      const img = node.querySelector(".fr-img");
      if (img) applyFrameImageTransform(img, el);
    }
  }

  // ---------- Rich text (runs) ----------
  // A text element is "plain" when it has no `el.runs` — it renders straight
  // from `el.text` with element-level weight/italic/underline (the legacy path,
  // untouched). When the user formats PART of the text, we store `el.runs`: an
  // ordered list of { text, bold, italic, underline } segments whose joined text
  // (newlines included) equals el.text. Element-level weight stays the base for
  // non-bold runs; a run's `bold` bumps it to 700. Plain `el.text` is always kept
  // alongside for measurement, export fallback, and backward compatibility, and
  // the whole object round-trips through JSON automatically (no field whitelist).
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function runsToText(runs) {
    return runs.map(function (r) { return r.text; }).join("");
  }
  // True when no run carries any per-run formatting → we can stay "plain".
  function runsAreUniform(runs) {
    return runs.every(function (r) { return !r.bold && !r.italic && !r.underline; });
  }
  // Element has live rich formatting worth rendering as spans.
  function hasRuns(el) {
    return Array.isArray(el.runs) && el.runs.length && !runsAreUniform(el.runs);
  }
  // Model → inner HTML. Each run is a <span> carrying only its overrides; base
  // font/size/colour/align live on the container. Newlines become <br>.
  function runsToHtml(runs) {
    return runs.map(function (r) {
      const css = [];
      if (r.bold) css.push("font-weight:700");
      if (r.italic) css.push("font-style:italic");
      if (r.underline) css.push("text-decoration:underline");
      const html = escapeHtml(r.text).replace(/\n/g, "<br>") || "";
      return css.length ? '<span style="' + css.join(";") + '">' + html + "</span>" : "<span>" + html + "</span>";
    }).join("");
  }
  // Put text into a .ed-text-inner: rich → innerHTML spans, else plain textContent.
  function setTextInnerContent(inner, el) {
    if (hasRuns(el)) inner.innerHTML = runsToHtml(el.runs);
    else inner.textContent = el.text || "";
  }
  // Parse a contentEditable subtree back into runs. Tracks bold/italic/underline
  // from ancestor tags + inline styles; block elements and <br> become newlines.
  function domToRuns(root) {
    const runs = [];
    function push(text, fmt) {
      if (!text) return;
      const last = runs[runs.length - 1];
      if (last && last.bold === fmt.bold && last.italic === fmt.italic && last.underline === fmt.underline) {
        last.text += text;
      } else {
        runs.push({ text: text, bold: fmt.bold, italic: fmt.italic, underline: fmt.underline });
      }
    }
    function walk(node, fmt) {
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];
        if (child.nodeType === 3) { push(child.nodeValue, fmt); continue; }
        if (child.nodeType !== 1) continue;
        const tag = child.tagName;
        if (tag === "BR") { push("\n", fmt); continue; }
        const isBlock = (tag === "DIV" || tag === "P");
        if (isBlock && runs.length && runs[runs.length - 1].text.slice(-1) !== "\n") push("\n", fmt);
        const st = child.style || {};
        const cw = parseInt(st.fontWeight, 10);
        // Start from the inherited format, then let this node's tag / inline
        // styles set OR clear each flag — execCommand un-bolding writes an
        // explicit `font-weight: normal`, which must override an inherited bold.
        const next = { bold: fmt.bold, italic: fmt.italic, underline: fmt.underline };
        if (tag === "B" || tag === "STRONG" || st.fontWeight === "bold" || cw >= 600) next.bold = true;
        else if (st.fontWeight === "normal" || (!isNaN(cw) && cw < 600)) next.bold = false;
        if (tag === "I" || tag === "EM" || st.fontStyle === "italic") next.italic = true;
        else if (st.fontStyle === "normal") next.italic = false;
        const deco = (st.textDecoration || "") + " " + (st.textDecorationLine || "");
        if (tag === "U" || deco.indexOf("underline") >= 0) next.underline = true;
        else if (deco.indexOf("none") >= 0) next.underline = false;
        walk(child, next);
      }
    }
    walk(root, { bold: false, italic: false, underline: false });
    // Drop one trailing newline (browsers leave a trailing <br>/empty block),
    // mirroring the legacy `.innerText.replace(/\n$/, "")`.
    for (let i = runs.length - 1; i >= 0; i--) {
      if (runs[i].text === "") { runs.splice(i, 1); continue; }
      if (runs[i].text.slice(-1) === "\n") runs[i].text = runs[i].text.slice(0, -1);
      break;
    }
    while (runs.length && runs[runs.length - 1].text === "") runs.pop();
    return runs;
  }
  // Read the edited DOM back onto the element, collapsing to plain when uniform.
  // ---- Panel text editing -------------------------------------------------
  // Change a text element's wording from the left panel (Text pane list, or the
  // Selection pane's Content box). Deliberately does NOT call fullRender():
  // that rebuilds the panel — stealing focus mid-keystroke — and, when
  // something is selected, flips the panel to the Selection pane.
  let _textHistT = 0;
  function liveSetText(el, value) {
    if (!el) return;
    el.text = value;
    el.runs = null;   // typing over it drops any mixed run formatting
    const node = canvasEl.querySelector('[data-id="' + el.id + '"]');
    const inner = node && node.querySelector(".ed-text-inner");
    if (inner) setTextInnerContent(inner, el);
    autosizeTextElements();
    renderHandles();
    clearTimeout(_textHistT);
    _textHistT = setTimeout(function () { pushHistory(); }, 700);
  }

  // Every text box on the page, editable in one place (Text pane) — overwrite
  // the wording without touching the design.
  function renderTextList() {
    const wrap = document.getElementById("ed-textlist");
    if (!wrap) return;
    if (wrap.contains(document.activeElement)) return;   // never rebuild mid-type
    const texts = state.elements.filter((e) => e.type === "text");
    if (!texts.length) {
      wrap.innerHTML = '<p class="ed-textlist-empty">No text on this page yet — add one below.</p>';
      return;
    }
    // The row marks itself when its element is the selection, so this list
    // doubles as the text selector: pick a box here, restyle it on the Fonts
    // tab, move to the next one — without going back to the canvas to click.
    wrap.innerHTML = texts.map((el, i) =>
      '<div class="ed-tl-row' + (state.selectedIds.length === 1 && state.selectedIds[0] === el.id ? " is-selected" : "") + '" data-id="' + el.id + '">' +
        '<div class="ed-tl-head"><span class="ed-tl-num">Text ' + (i + 1) + '</span>' +
        '<button type="button" class="ed-tl-find" data-find="' + el.id + '">Select</button></div>' +
        '<textarea class="ed-tl-input" rows="2" spellcheck="false"></textarea>' +
      "</div>").join("");
    texts.forEach((el) => {
      const ta = wrap.querySelector('.ed-tl-row[data-id="' + el.id + '"] .ed-tl-input');
      if (!ta) return;
      ta.value = el.text || "";                     // set as value (no escaping games)
      ta.addEventListener("input", () => liveSetText(getEl(el.id), ta.value));
    });
    wrap.querySelectorAll("[data-find]").forEach((b) => {
      b.addEventListener("click", () => {
        state.selectedIds = [b.dataset.find];
        fullRender();
      });
    });
    // The whole row selects too — the Select button alone was a small target
    // for what is the row's main job. Clicking into the textarea to retype the
    // wording still selects, but must not steal the caret.
    wrap.querySelectorAll(".ed-tl-row").forEach((row) => {
      row.addEventListener("pointerdown", (e) => {
        if (e.target.closest("[data-find]")) return;
        const id = row.dataset.id;
        if (state.selectedIds.length === 1 && state.selectedIds[0] === id) return;
        state.selectedIds = [id];
        // Safe mid-type: renderTextList bails out while the focus is inside
        // this list, so the textarea and its caret survive the re-render.
        wrap.querySelectorAll(".ed-tl-row").forEach((r) => r.classList.toggle("is-selected", r === row));
        fullRender();
      });
    });
  }

  function commitTextFromDom(inner, el) {
    const runs = domToRuns(inner);
    const newText = runsToText(runs).replace(/\n$/, "");
    const uniform = runsAreUniform(runs);
    const prev = el.runs ? JSON.stringify(el.runs) : null;
    const next = uniform ? null : JSON.stringify(runs);
    if (newText !== el.text || prev !== next) {
      el.text = newText;
      el.runs = uniform ? null : runs;
      pushHistory();
    }
  }

  // The .ed-text-inner currently being edited for `el` (or null).
  function editingInnerFor(el) {
    const node = canvasEl.querySelector('.ed-element[data-id="' + el.id + '"]');
    const inner = node && node.querySelector(".ed-text-inner");
    return (inner && inner.getAttribute("contenteditable") === "true") ? inner : null;
  }
  // Is there a live text selection inside this editing box?
  function hasInnerSelection(inner) {
    const sel = window.getSelection && window.getSelection();
    return !!(inner && sel && sel.rangeCount && !sel.isCollapsed && inner.contains(sel.anchorNode));
  }
  // Bold the current selection when editing (per-word → produces runs on commit),
  // otherwise toggle the whole element's weight (legacy). The DOM updates live via
  // execCommand; el.runs is parsed back on blur. Returns true if it bolded a range.
  function applyBold(el, btn) {
    const inner = editingInnerFor(el);
    if (inner && hasInnerSelection(inner)) {
      try { document.execCommand("styleWithCSS", false, true); } catch (_) {}
      document.execCommand("bold");
      if (btn) { try { btn.classList.toggle("is-on", document.queryCommandState("bold")); } catch (_) {} }
      return true;
    }
    el.weight = (el.weight || 400) >= 700 ? 400 : 700;
    loadGoogleFont(el.font); fullRender(); pushHistory();
    return false;
  }

  function renderElement(el) {
    const node = document.createElement("div");
    node.className = "ed-element";
    node.dataset.id = el.id;
    node.dataset.type = el.type;
    applyElementStyles(node, el);

    if (el.type === "text") {
      const inner = document.createElement("div");
      inner.className = "ed-text-inner";
      inner.contentEditable = "false";
      inner.spellcheck = false;
      setTextInnerContent(inner, el);
      applyTextStyles(inner, el);
      node.appendChild(inner);
    } else if (el.type === "image") {
      const img = document.createElement("img");
      img.decoding = "async";
      img.src = el.src;
      img.draggable = false;
      img.alt = "";
      img.crossOrigin = "anonymous";
      node.appendChild(img);
    } else if (el.type === "frame") {
      // Frame = masked container. The data-frame-shape attribute drives
      // the clip-path / border-radius (see editor.astro styles).
      node.dataset.frameShape = el.frameShape || "square";
      if (el.src) {
        node.classList.add("is-filled");
        const img = document.createElement("img");
        img.decoding = "async";
        img.src = el.src;
        img.draggable = false;
        img.alt = "";
        img.crossOrigin = "anonymous";
        img.className = "fr-img";
        applyFrameImageTransform(img, el);
        // Capture natural dims if not yet known (e.g. after a hydrated load)
        if (!el.imgNaturalW || !el.imgNaturalH) {
          img.addEventListener("load", function () {
            el.imgNaturalW = img.naturalWidth;
            el.imgNaturalH = img.naturalHeight;
            applyFrameImageTransform(img, el);
          });
        }
        node.appendChild(img);
      } else {
        // Empty placeholder: friendly prompt to drop a photo.
        const ph = document.createElement("div");
        ph.className = "fr-placeholder";
        ph.innerHTML =
          '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
          '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
          '<circle cx="8.5" cy="8.5" r="1.5"/>' +
          '<path d="M21 15l-5-5L5 21"/>' +
          '</svg>' +
          '<span>Drop a photo here</span>';
        node.appendChild(ph);
      }
      // Drag-and-drop targets: a photo card from the Photos / Uploads
      // panel can be dropped here to fill the frame.
      node.addEventListener("dragover", function (e) {
        if (!e.dataTransfer) return;
        const hasUrl = (e.dataTransfer.types || []).indexOf("text/uri-list") !== -1
                    || (e.dataTransfer.types || []).indexOf("text/plain") !== -1;
        if (!hasUrl) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        node.classList.add("is-drop-target");
      });
      node.addEventListener("dragleave", function () { node.classList.remove("is-drop-target"); });
      node.addEventListener("drop", function (e) {
        node.classList.remove("is-drop-target");
        if (!e.dataTransfer) return;
        const src = e.dataTransfer.getData("text/uri-list")
                 || e.dataTransfer.getData("text/plain");
        if (!src) return;
        e.preventDefault();
        e.stopPropagation();
        fillFrame(el, src);
      });
      // Double-click a filled frame → enter viewpoint edit mode
      if (el.src) {
        node.addEventListener("dblclick", function (ev) {
          ev.stopPropagation();
          enterViewpointEdit(el, node);
        });
      }
    } else if (el.type === "screen") {
      // The artwork is warped by a CSS matrix3d, so what is on the canvas is
      // the same projection the export computes - not an approximation of it.
      if (el.src) {
        node.classList.add("is-filled");
        const plane = document.createElement("div");
        plane.className = "sc-plane";
        const img = document.createElement("img");
        img.decoding = "async";
        img.src = el.src;
        img.draggable = false;
        img.alt = "";
        img.crossOrigin = "anonymous";
        img.className = "sc-img";
        plane.appendChild(img);
        node.appendChild(plane);
        if (el.imgNaturalW && el.imgNaturalH) applyScreenTransform(node, el);
        img.addEventListener("load", function () {
          el.imgNaturalW = img.naturalWidth;
          el.imgNaturalH = img.naturalHeight;
          applyScreenTransform(node, el);
        });
      } else {
        const ph = document.createElement("div");
        ph.className = "sc-placeholder";
        ph.innerHTML =
          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
          '<rect x="2" y="4" width="20" height="13" rx="1.5"/><path d="M8 21h8M12 17v4"/>' +
          '</svg>' +
          '<span>Drop your artwork, then drag the corners</span>';
        node.appendChild(ph);
      }
      // Same drop target as a frame: a photo card from any panel fills it.
      node.addEventListener("dragover", function (e) {
        if (!e.dataTransfer) return;
        const hasUrl = (e.dataTransfer.types || []).indexOf("text/uri-list") !== -1
                    || (e.dataTransfer.types || []).indexOf("text/plain") !== -1;
        if (!hasUrl) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        node.classList.add("is-drop-target");
      });
      node.addEventListener("dragleave", function () { node.classList.remove("is-drop-target"); });
      node.addEventListener("drop", function (e) {
        node.classList.remove("is-drop-target");
        if (!e.dataTransfer) return;
        const src = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
        if (!src) return;
        e.preventDefault();
        e.stopPropagation();
        fillScreen(el, src);
      });
      if (el.src) {
        if (artworkEditId === el.id) node.classList.add("is-artwork-edit");
        node.addEventListener("dblclick", function (ev) {
          ev.stopPropagation();
          setArtworkEdit(artworkEditId === el.id ? null : el.id);
        });
      }
    } else if (el.type === "rect") {
      // styling on node directly
    } else if (el.type === "ellipse") {
      node.style.borderRadius = "50%";
    } else if (el.type === "triangle") {
      node.style.background = "transparent";
      const inner = document.createElement("div");
      inner.style.width = "100%";
      inner.style.height = "100%";
      inner.style.clipPath = "polygon(50% 0%, 100% 100%, 0% 100%)";
      inner.style.background = el.fill;
      inner.style.opacity = el.opacity;
      node.appendChild(inner);
    } else if (el.type === "line") {
      node.style.background = el.fill;
    } else if (el.type === "star") {
      node.style.background = "transparent";
      const inner = document.createElement("div");
      inner.style.width = "100%";
      inner.style.height = "100%";
      inner.style.clipPath = "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
      inner.style.background = el.fill;
      inner.style.opacity = el.opacity;
      node.appendChild(inner);
    }

    if (state.selectedIds.includes(el.id)) {
      node.classList.add(state.selectedIds.length > 1 ? "is-multiselected" : "is-selected");
    }
    if (el.locked) node.classList.add("is-locked");
    // Authoring aid: show which element is the logo slot. Admin only — a
    // customer sees their own logo there, not a marked-up box.
    if (el.brandRole === "logo" && isAdminMode()) node.classList.add("is-logoslot");
    if (el.hidden) node.classList.add("is-hidden");
    if (el.type === "text" && el.vcenter) node.classList.add("ed-text-vcenter");

    // Comment badge — visible even when the element isn't selected.
    const openCmts = el.comments ? el.comments.filter((c) => !c.resolved).length : 0;
    if (openCmts) {
      const badge = document.createElement("div");
      badge.className = "ed-cmt-badge";
      badge.textContent = openCmts;
      badge.title = openCmts + " comment" + (openCmts === 1 ? "" : "s");
      node.appendChild(badge);
    }

    bindElementInteractions(node, el);
    return node;
  }

  function applyElementStyles(node, el) {
    node.style.left = el.x + "px";
    node.style.top = el.y + "px";
    node.style.width = el.w + "px";
    node.style.height = el.h + "px";
    // A line is 4px tall and a thin rule is 1px, so their clickable area was
    // 4px and 1px too - you aim at one, miss, and try again. This marks them
    // so the CSS can pad the hit target out to something a hand can hit,
    // without changing a pixel of what's drawn.
    node.classList.toggle("is-thin", (Number(el.h) || 0) < 14 || (Number(el.w) || 0) < 14);
    const sx = el.flipX ? -1 : 1;
    const sy = el.flipY ? -1 : 1;
    node.style.transform = "rotate(" + (el.rotation || 0) + "deg) scale(" + sx + ", " + sy + ")";
    node.style.opacity = el.opacity != null ? el.opacity : 1;

    if (el.type === "rect" || el.type === "ellipse") {
      const grad = (el.fillGradient && el.fillGradient.enabled) ? textGradientCss(el.fillGradient) : null;
      node.style.background = grad || el.fill || "transparent";
      node.style.borderRadius = (el.type === "ellipse" ? "50%" : frameRadiusCss(el));
      node.style.border = (el.strokeWidth ? `${el.strokeWidth}px solid ${el.stroke || "transparent"}` : "none");
    }
    if (el.type === "image") {
      // Optional rounded corners — clip the photo to the (per-corner) radius.
      const r = frameRadiusCss(el);
      node.style.borderRadius = r;
      node.style.overflow = r ? "hidden" : "";
    }
    if (el.type === "line") {
      const grad = (el.fillGradient && el.fillGradient.enabled) ? textGradientCss(el.fillGradient) : null;
      node.style.background = grad || el.fill || "#000";
    }
    if (el.type === "screen") {
      node.style.setProperty("--sc-guide", el.guide || "#00c2a8");
      node.style.setProperty("--sc-bg", el.bgFill || "transparent");
      // Clipped to the quad, so a warped image never leaks outside the shape
      // it is supposed to be sitting in.
      const pct = screenCorners(el).map((c) => (c.x * 100).toFixed(3) + "% " + (c.y * 100).toFixed(3) + "%");
      node.style.clipPath = "polygon(" + pct.join(",") + ")";
      node.style.overflow = "hidden";
    }
    if (el.type === "frame") {
      // Corner rounding + outline. Rounding/border read best on rectangular
      // frame shapes; shaped frames (circle/arch/diamond) clip the border away.
      node.style.borderRadius = frameRadiusCss(el);
      node.style.border = el.frameBorderWidth ? (el.frameBorderWidth + "px solid " + (el.frameBorder || "#1c1d22")) : "";
    }

    // Shadow / glow — applied as a CSS filter so it follows alpha and clip-paths.
    // Text elements get their shadow on the inner span instead (handled in
    // applyTextStyles) so it composes with gradient fill correctly.
    if (el.type !== "text") {
      node.style.filter = shadowFilter(el.shadow) || "";
    }
  }

  function applyTextStyles(inner, el) {
    inner.style.fontFamily = (FONTS.find((f) => f.name === el.font) || FONTS[0]).stack;
    inner.style.fontSize = el.size + "px";
    inner.style.fontWeight = el.weight;
    inner.style.fontStyle = el.italic ? "italic" : "normal";
    inner.style.color = el.color;
    inner.style.textAlign = el.align;
    inner.style.letterSpacing = (el.letterSpacing || 0) + "px";
    inner.style.lineHeight = el.lineHeight || 1.3;
    inner.style.textDecoration = el.underline ? "underline" : "none";

    // Gradient fill — paints the gradient as a background then clips it to the
    // glyph outlines. Setting -webkit-text-fill-color (and color) to
    // transparent is what makes the gradient show through.
    const gradCss = textGradientCss(el.textGradient);
    if (gradCss) {
      inner.style.backgroundImage = gradCss;
      inner.style.webkitBackgroundClip = "text";
      inner.style.backgroundClip = "text";
      inner.style.webkitTextFillColor = "transparent";
      inner.style.color = "transparent";
    } else {
      inner.style.backgroundImage = "";
      inner.style.webkitBackgroundClip = "";
      inner.style.backgroundClip = "";
      inner.style.webkitTextFillColor = "";
    }

    // Outline — paint-order makes the stroke sit underneath the fill so thin
    // strokes don't eat into letterforms.
    if (el.textOutline && el.textOutline.width > 0) {
      const w = el.textOutline.width;
      const c = el.textOutline.color || "#1c1d22";
      inner.style.webkitTextStrokeWidth = w + "px";
      inner.style.webkitTextStrokeColor = c;
      inner.style.paintOrder = "stroke fill";
    } else {
      inner.style.webkitTextStrokeWidth = "";
      inner.style.webkitTextStrokeColor = "";
      inner.style.paintOrder = "";
    }

    // Text background pill — simple rectangle behind the text block, padding
    // comes from spreadX/Y. Multi-line pill (box-decoration-break per line) is
    // deferred; this single block hugging the text area is the common case.
    const tb = el.textBg;
    if (tb && tb.enabled) {
      inner.style.backgroundColor = tb.color || "#FFE066";
      inner.style.padding = (tb.padY || 6) + "px " + (tb.padX || 12) + "px";
      inner.style.borderRadius = (tb.radius || 6) + "px";
      inner.style.boxDecorationBreak = "clone";
      inner.style.webkitBoxDecorationBreak = "clone";
      // If gradient text is also on, the gradient background needs to stay
      // clipped to text — we paint the pill on a wrapping container instead.
      // Simple compromise: when both are on, drop the pill (rare combo).
      if (gradCss) inner.style.backgroundColor = "";
    } else {
      // Only clear if we don't have a gradient using background. Gradient
      // text uses backgroundImage; backgroundColor is independent so safe.
      inner.style.backgroundColor = "";
      inner.style.padding = "";
      inner.style.borderRadius = "";
      inner.style.boxDecorationBreak = "";
      inner.style.webkitBoxDecorationBreak = "";
    }

    // Shadow / glow on the inner so it follows the painted text shape.
    inner.style.filter = textShadowFilter(el.textShadow) || "";
  }

  // ---------- Frame helpers ----------
  // Per-corner radius. el.radii ({tl,tr,br,bl}) overrides the uniform el.radius
  // when present; any unset corner falls back to the uniform value.
  function cornerRadius(el, k) {
    const base = el.radius || 0;
    return (el.radii && el.radii[k] != null) ? el.radii[k] : base;
  }
  function hasPerCorner(el) {
    const r = el.radii;
    return !!(r && (r.tl != null || r.tr != null || r.br != null || r.bl != null));
  }
  function frameRadiusCss(el) {
    if (hasPerCorner(el)) {
      return cornerRadius(el, "tl") + "px " + cornerRadius(el, "tr") + "px " +
             cornerRadius(el, "br") + "px " + cornerRadius(el, "bl") + "px";
    }
    return el.radius ? el.radius + "px" : "";
  }

  // Compute the "cover" base scale — the smallest scale that lets the
  // photo fully cover the frame in both axes (mirrors CSS object-fit:cover).
  function frameCoverFit(el) {
    if (!el.imgNaturalW || !el.imgNaturalH) return { baseW: el.w, baseH: el.h };
    const ar = el.imgNaturalW / el.imgNaturalH;
    const frameAr = el.w / el.h;
    if (ar > frameAr) {
      // Image is wider than frame → height fills, width overflows
      const h = el.h;
      return { baseW: h * ar, baseH: h };
    }
    const w = el.w;
    return { baseW: w, baseH: w / ar };
  }

  // Position the inner <img> within a frame based on viewpoint state.
  // We size the img to "cover" the frame then translate from centre by
  // the user's offsets, scaled by imgScale (zoom). Centre-origin transform
  // means scale + translate compose intuitively for the user.
  function applyFrameImageTransform(img, el) {
    const fit = frameCoverFit(el);
    img.style.width  = fit.baseW + "px";
    img.style.height = fit.baseH + "px";
    img.style.marginLeft = (-fit.baseW / 2) + "px";
    img.style.marginTop  = (-fit.baseH / 2) + "px";
    const s = el.imgScale || 1;
    const tx = el.imgOffsetX || 0;
    const ty = el.imgOffsetY || 0;
    img.style.transform = "translate(" + tx + "px, " + ty + "px) scale(" + s + ")";
  }

  // Viewpoint edit mode — entered by dblclick on a filled frame. Lets the
  // user pan the inner photo by dragging and zoom by scroll-wheel. Click
  // anywhere outside the frame, press Esc, or hit Enter to exit.
  let viewpointSession = null;
  function enterViewpointEdit(el, node) {
    if (!el.src) return;
    // Tear down any previous session before starting a fresh one.
    if (viewpointSession) exitViewpointEdit();
    node.classList.add("is-editing-viewpoint");

    const img = node.querySelector(".fr-img");
    if (!img) return;

    // Dimmed, un-clipped "ghost" of the full photo, placed directly under the
    // frame so the in-frame region reads bright (the real clipped image on top)
    // while the cropped-away parts show faintly around it. This is the area the
    // user is reframing into — nothing else on the canvas moves.
    const ghost = document.createElement("div");
    ghost.className = "ed-frame-ghost";
    const gsx = el.flipX ? -1 : 1, gsy = el.flipY ? -1 : 1;
    ghost.style.cssText =
      "position:absolute;left:" + el.x + "px;top:" + el.y + "px;width:" + el.w + "px;height:" + el.h +
      "px;overflow:visible;pointer-events:none;z-index:49;transform:rotate(" + (el.rotation || 0) + "deg) scale(" + gsx + "," + gsy + ");";
    const gimg = document.createElement("img");
    gimg.className = "fr-img";
    gimg.crossOrigin = "anonymous";
    gimg.src = el.src;
    applyFrameImageTransform(gimg, el);
    ghost.appendChild(gimg);
    canvasEl.insertBefore(ghost, node);
    const syncGhost = function () { applyFrameImageTransform(gimg, el); };

    let dragging = false;
    let lastX = 0, lastY = 0;
    function onDown(ev) {
      ev.stopPropagation();
      ev.preventDefault();
      dragging = true;
      lastX = ev.clientX;
      lastY = ev.clientY;
      node.setPointerCapture && node.setPointerCapture(ev.pointerId);
    }
    function onMove(ev) {
      if (!dragging) return;
      const dx = (ev.clientX - lastX) / state.zoom;
      const dy = (ev.clientY - lastY) / state.zoom;
      lastX = ev.clientX;
      lastY = ev.clientY;
      el.imgOffsetX = (el.imgOffsetX || 0) + dx;
      el.imgOffsetY = (el.imgOffsetY || 0) + dy;
      applyFrameImageTransform(img, el);
      syncGhost();
    }
    function onUp(ev) {
      if (!dragging) return;
      dragging = false;
      try { node.releasePointerCapture && node.releasePointerCapture(ev.pointerId); } catch (_) {}
      pushHistory();
    }
    function onWheel(ev) {
      ev.preventDefault();
      const step = ev.deltaY < 0 ? 1.06 : 1 / 1.06;
      el.imgScale = Math.max(0.3, Math.min(6, (el.imgScale || 1) * step));
      applyFrameImageTransform(img, el);
      syncGhost();
      // Debounce history pushes — store on wheel-end via a small timer.
      clearTimeout(viewpointSession && viewpointSession.wheelTimer);
      if (viewpointSession) {
        viewpointSession.wheelTimer = setTimeout(function () { pushHistory(); }, 200);
      }
    }
    function onDocClick(ev) {
      if (!node.contains(ev.target)) exitViewpointEdit();
    }
    function onKey(ev) {
      if (ev.key === "Escape" || ev.key === "Enter") {
        ev.preventDefault();
        exitViewpointEdit();
      }
    }
    node.addEventListener("pointerdown", onDown);
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerup", onUp);
    node.addEventListener("pointercancel", onUp);
    node.addEventListener("wheel", onWheel, { passive: false });
    // Delay outside-click listener by a tick so the originating dblclick
    // doesn't immediately tear us back down.
    setTimeout(function () { document.addEventListener("pointerdown", onDocClick, true); }, 0);
    document.addEventListener("keydown", onKey);

    viewpointSession = {
      el, node, img, wheelTimer: null,
      teardown: function () {
        node.classList.remove("is-editing-viewpoint");
        if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
        node.removeEventListener("pointerdown", onDown);
        node.removeEventListener("pointermove", onMove);
        node.removeEventListener("pointerup", onUp);
        node.removeEventListener("pointercancel", onUp);
        node.removeEventListener("wheel", onWheel);
        document.removeEventListener("pointerdown", onDocClick, true);
        document.removeEventListener("keydown", onKey);
      },
    };
  }
  function exitViewpointEdit() {
    if (!viewpointSession) return;
    viewpointSession.teardown();
    viewpointSession = null;
  }

  // ---------- Handles ----------
  function renderHandles() {
    handlesEl.innerHTML = "";
    handlesEl.style.width = state.canvas.width + "px";
    handlesEl.style.height = state.canvas.height + "px";

    // Multi-selection — a combined dashed box + the group action bar.
    if (state.selectedIds.length > 1) {
      hideFloatBar();
      const els = selectedElements().filter((e) => !e.locked);
      if (!els.length) { hideGroupBar(); return; }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      els.forEach((e) => { minX = Math.min(minX, e.x); minY = Math.min(minY, e.y); maxX = Math.max(maxX, e.x + e.w); maxY = Math.max(maxY, e.y + e.h); });
      const mb = document.createElement("div");
      mb.className = "ed-bounds ed-bounds--multi";
      mb.style.left = minX + "px"; mb.style.top = minY + "px";
      mb.style.width = (maxX - minX) + "px"; mb.style.height = (maxY - minY) + "px";
      handlesEl.appendChild(mb);

      // Scale handles on the combined box — drag to resize/reshape everything
      // inside as one group (text sizes scale too).
      const gbox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      const mpos = [
        ["nw", 0, 0], ["n", 0.5, 0], ["ne", 1, 0],
        ["e", 1, 0.5], ["se", 1, 1],
        ["s", 0.5, 1], ["sw", 0, 1], ["w", 0, 0.5],
      ];
      mpos.forEach(([h, fx, fy]) => {
        const handle = document.createElement("div");
        handle.className = "ed-handle";
        handle.dataset.h = h;
        handle.style.left = (gbox.x + fx * gbox.w - 5) + "px";
        handle.style.top = (gbox.y + fy * gbox.h - 5) + "px";
        handlesEl.appendChild(handle);
        handle.addEventListener("pointerdown", (ev) => startGroupResize(ev, els, gbox, h));
      });

      positionGroupBar(mb.getBoundingClientRect());
      return;
    }
    hideGroupBar();
    if (state.selectedIds.length !== 1) { hideFloatBar(); return; }
    const el = getEl(state.selectedIds[0]);
    if (!el || el.locked) { hideFloatBar(); return; }

    // Bounds
    const bounds = document.createElement("div");
    bounds.className = "ed-bounds";
    bounds.style.left = el.x + "px";
    bounds.style.top = el.y + "px";
    bounds.style.width = el.w + "px";
    bounds.style.height = el.h + "px";
    bounds.style.transform = "rotate(" + (el.rotation || 0) + "deg)";
    bounds.style.transformOrigin = "center center";
    handlesEl.appendChild(bounds);

    // Floating quick-action toolbar above the element (hidden while editing text).
    const elNode = canvasEl.querySelector('.ed-element[data-id="' + el.id + '"]');
    if (elNode && elNode.classList.contains("is-editing")) hideFloatBar();
    else positionFloatBar(bounds.getBoundingClientRect(), el);

    /* A screen gets four corner pins instead of the eight box handles. Its
       shape IS its corners - box handles would only scale the quad, which is
       what dragging the element already does, and two sets of handles sitting
       on top of each other at the corners would be a coin toss as to which one
       you grabbed. */
    if (el.type === "screen") {
      // Nothing drawn over the artwork while the guide is off - including the
      // handles, which are the brightest thing on it.
      if (screenGuideHidden) return;
      const pts = screenPoints(el);
      const outline = document.createElement("div");
      outline.className = "ed-screen-outline";
      outline.style.setProperty("--sc-guide", el.guide || "#00c2a8");
      outline.style.left = el.x + "px";
      outline.style.top = el.y + "px";
      outline.style.width = el.w + "px";
      outline.style.height = el.h + "px";
      outline.style.clipPath = "polygon(" + screenCorners(el).map((c) =>
        (c.x * 100).toFixed(3) + "% " + (c.y * 100).toFixed(3) + "%").join(",") + ")";
      handlesEl.appendChild(outline);
      /* Spin the artwork by hand. Typing an angle means guessing it, then
         correcting the guess - and a screen is being matched to a photograph,
         where the right angle is the one that looks right rather than one you
         could have named in advance. The number box is still there for when
         you do know it. */
      if (el.src) {
        const centre = { x: (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4,
                         y: (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4 };
        const top = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        // Sat off the top edge, along the line out from the centre, so it stays
        // clear of the corner pins however the quad is angled.
        const vx = top.x - centre.x, vy = top.y - centre.y;
        const len = Math.hypot(vx, vy) || 1;
        const rh = document.createElement("div");
        rh.className = "ed-screen-rot";
        rh.title = "Drag to spin the artwork (hold Shift for 15° steps)";
        rh.style.setProperty("--sc-guide", el.guide || "#00c2a8");
        rh.style.left = (top.x + (vx / len) * 32 - 15) + "px";
        rh.style.top = (top.y + (vy / len) * 32 - 15) + "px";
        rh.innerHTML =
          '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" ' +
          'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg>';
        handlesEl.appendChild(rh);
        rh.addEventListener("pointerdown", (ev) => startArtworkRotate(ev, el, centre));
      }

      pts.forEach((pt, i) => {
        const pin = document.createElement("div");
        pin.className = "ed-screen-pin";
        pin.style.setProperty("--sc-guide", el.guide || "#00c2a8");
        pin.dataset.corner = String(i);
        pin.style.left = (pt.x - 8) + "px";
        pin.style.top = (pt.y - 8) + "px";
        handlesEl.appendChild(pin);
        pin.addEventListener("pointerdown", (ev) => startCornerDrag(ev, el, i));
      });
      return;
    }

    // Resize handles
    const positions = [
      ["nw", 0, 0], ["n", 0.5, 0], ["ne", 1, 0],
      ["e",  1, 0.5], ["se", 1, 1],
      ["s",  0.5, 1], ["sw", 0, 1], ["w",  0, 0.5],
    ];
    positions.forEach(([h, fx, fy]) => {
      const handle = document.createElement("div");
      handle.className = "ed-handle";
      handle.dataset.h = h;
      const localX = fx * el.w;
      const localY = fy * el.h;
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      const dx = localX - el.w / 2;
      const dy = localY - el.h / 2;
      const a = (el.rotation || 0) * Math.PI / 180;
      const rx = dx * Math.cos(a) - dy * Math.sin(a);
      const ry = dx * Math.sin(a) + dy * Math.cos(a);
      handle.style.left = (cx + rx - 5) + "px";
      handle.style.top = (cy + ry - 5) + "px";
      handlesEl.appendChild(handle);

      handle.addEventListener("pointerdown", (ev) => startResize(ev, el, h));
    });

    // Rotation handle
    const rotHandle = document.createElement("div");
    rotHandle.className = "ed-handle";
    rotHandle.dataset.h = "rot";
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    const dy = -el.h / 2 - 28;
    const a = (el.rotation || 0) * Math.PI / 180;
    const rx = 0 * Math.cos(a) - dy * Math.sin(a);
    const ry = 0 * Math.sin(a) + dy * Math.cos(a);
    rotHandle.style.left = (cx + rx - 7) + "px";
    rotHandle.style.top = (cy + ry - 7) + "px";
    handlesEl.appendChild(rotHandle);
    rotHandle.addEventListener("pointerdown", (ev) => startRotate(ev, el));
  }

  // ---------- Floating selection toolbar (Canva-style quick actions) ----------
  function cmtEscape(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const ICON_FB = {
    comment: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>',
    duplicate: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    delete: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    more: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    convert: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
  };
  const floatBar = document.createElement("div");
  floatBar.className = "ed-floatbar";
  floatBar.hidden = true;
  floatBar.innerHTML =
    '<button type="button" class="ed-fb-btn" data-fb="convert" title="Add a text label beside this icon (matched & linked)" hidden>' + ICON_FB.convert + '</button>' +
    '<button type="button" class="ed-fb-btn" data-fb="comment" title="Comment">' + ICON_FB.comment + '<span class="ed-fb-count" hidden></span></button>' +
    '<button type="button" class="ed-fb-btn" data-fb="duplicate" title="Duplicate">' + ICON_FB.duplicate + '</button>' +
    '<button type="button" class="ed-fb-btn ed-fb-danger" data-fb="delete" title="Delete">' + ICON_FB.delete + '</button>' +
    '<span class="ed-fb-sep"></span>' +
    '<button type="button" class="ed-fb-btn" data-fb="more" title="More">' + ICON_FB.more + '</button>';
  document.body.appendChild(floatBar);
  // Don't let clicks on the bar bubble to the canvas (which would deselect).
  floatBar.addEventListener("pointerdown", (e) => e.stopPropagation());
  floatBar.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fb]"); if (!b) return;
    const el = getEl(state.selectedIds[0]); if (!el) return;
    const act = b.dataset.fb;
    if (act === "duplicate") duplicateSelected();
    else if (act === "delete") deleteSelected();
    else if (act === "more") { const r = b.getBoundingClientRect(); showContextMenu(r.left - 4, r.bottom + 2, el); }
    else if (act === "comment") openCommentPopover(el, b);
    else if (act === "convert") convertIconToText(el);
  });

  function positionFloatBar(rect, el) {
    if (!rect) { hideFloatBar(); return; }
    floatBar.hidden = false;
    // "Convert to text" shows for icons / images (add a matched, linked label).
    const convertBtn = floatBar.querySelector('[data-fb="convert"]');
    if (convertBtn) convertBtn.hidden = !(el && (el.svgKey || el.type === "image"));
    // Comment count badge.
    const open = (el && el.comments ? el.comments.filter((c) => !c.resolved).length : 0);
    const countEl = floatBar.querySelector(".ed-fb-count");
    if (countEl) { countEl.hidden = !open; countEl.textContent = open || ""; }
    const bw = floatBar.offsetWidth || 168;
    const bh = floatBar.offsetHeight || 40;
    let left = rect.left + rect.width / 2 - bw / 2;
    let top = rect.top - bh - 12;
    if (top < 70) top = rect.bottom + 12; // no room above → go below
    left = Math.max(8, Math.min(left, window.innerWidth - bw - 8));
    floatBar.style.left = left + "px";
    floatBar.style.top = top + "px";
  }
  function hideFloatBar() { floatBar.hidden = true; }

  // Add a text label beside an icon: same height, vertically centred, and
  // grouped so the two stay matched + aligned and move together. Then edit it.
  function convertIconToText(icon) {
    if (!icon) return;
    const gid = icon.group || uid("grp");
    icon.group = gid;
    const gap = Math.round(icon.h * 0.25);
    // Match the icon's height: a cap-height of ~0.72·fontSize means the text
    // visually reads the same height as the icon glyph beside it.
    const size = Math.max(8, Math.round(icon.h * 0.92));
    const tx = icon.x + icon.w + gap;
    const tw = Math.max(120, Math.round(icon.w * 3));
    const th = Math.round(size * 1.25);              // box tall enough for the glyph
    const ty = Math.round(icon.y + icon.h / 2 - th / 2); // centre on the icon
    const t = {
      id: uid("text"), type: "text", text: "Add text",
      x: tx, y: ty, w: tw, h: th, rotation: 0, opacity: 1,
      font: "Cormorant Garamond", size: size, weight: 500, italic: false,
      color: icon.svgFill && /^#[0-9a-f]{6}$/i.test(icon.svgFill) ? icon.svgFill : "#1c1d22",
      align: "left", letterSpacing: 0, lineHeight: 1, group: gid,
      vcenter: true, // vertically centre within its box so it lines up with the icon
    };
    state.elements.push(t);
    state.selectedIds = [icon.id, t.id];
    pushHistory();
    fullRender();
    requestAnimationFrame(() => {
      const node = canvasEl.querySelector('.ed-element[data-id="' + t.id + '"]');
      if (node) { state.selectedIds = [t.id]; fullRender(); startTextEdit(canvasEl.querySelector('.ed-element[data-id="' + t.id + '"]'), getEl(t.id)); }
    });
  }

  // ---------- Multi-select group bar ----------
  const ICON_GRP = {
    group: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  };
  const groupBar = document.createElement("div");
  groupBar.className = "ed-floatbar";
  groupBar.hidden = true;
  groupBar.innerHTML =
    '<button type="button" class="ed-fb-btn ed-fb-text" data-gb="group"><span></span></button>' +
    '<span class="ed-fb-sep"></span>' +
    '<button type="button" class="ed-fb-btn" data-gb="duplicate" title="Duplicate">' + ICON_FB.duplicate + '</button>' +
    '<button type="button" class="ed-fb-btn ed-fb-danger" data-gb="delete" title="Delete">' + ICON_FB.delete + '</button>';
  document.body.appendChild(groupBar);
  groupBar.addEventListener("pointerdown", (e) => e.stopPropagation());
  groupBar.addEventListener("click", (e) => {
    const b = e.target.closest("[data-gb]"); if (!b) return;
    const act = b.dataset.gb;
    if (act === "duplicate") duplicateSelected();
    else if (act === "delete") deleteSelected();
    else if (act === "group") {
      const els = selectedElements();
      const allGrouped = els.length && els.every((e2) => e2.group && e2.group === els[0].group);
      if (allGrouped) { els.forEach((e2) => { delete e2.group; }); }   // ungroup
      else { const gid = uid("grp"); els.forEach((e2) => { e2.group = gid; }); } // group
      pushHistory(); fullRender();
    }
  });
  function hideGroupBar() { groupBar.hidden = true; }
  function positionGroupBar(rect) {
    groupBar.hidden = false;
    const els = selectedElements();
    const grouped = els.length && els.every((e2) => e2.group && e2.group === els[0].group);
    const label = groupBar.querySelector('[data-gb="group"] span');
    if (label) label.textContent = grouped ? "Ungroup" : "Group";
    const bw = groupBar.offsetWidth || 180, bh = groupBar.offsetHeight || 40;
    let left = rect.left + rect.width / 2 - bw / 2;
    let top = rect.top - bh - 12;
    if (top < 70) top = rect.bottom + 12;
    left = Math.max(8, Math.min(left, window.innerWidth - bw - 8));
    groupBar.style.left = left + "px";
    groupBar.style.top = top + "px";
  }

  // ---------- Comments (per element; the review-workflow foundation) ----------
  let commentPop = null;
  function closeCommentPopover() { if (commentPop) { commentPop.remove(); commentPop = null; } }
  function openCommentPopover(el, anchorBtn) {
    closeCommentPopover();
    if (!el.comments) el.comments = [];
    commentPop = document.createElement("div");
    commentPop.className = "ed-cmt-pop";
    commentPop.addEventListener("pointerdown", (e) => e.stopPropagation());
    document.body.appendChild(commentPop);
    drawCommentPop(el);
    const r = anchorBtn.getBoundingClientRect();
    commentPop.style.left = Math.max(8, Math.min(r.left - 20, window.innerWidth - 312)) + "px";
    commentPop.style.top = (r.bottom + 8) + "px";
    const ta = commentPop.querySelector("textarea"); if (ta) ta.focus();
  }
  function drawCommentPop(el) {
    if (!commentPop) return;
    const list = (el.comments || []).map((c, i) =>
      '<div class="ed-cmt' + (c.resolved ? " is-resolved" : "") + '"><p>' + cmtEscape(c.text) + '</p>' +
      '<div class="ed-cmt-acts"><button type="button" data-cmt-resolve="' + i + '">' + (c.resolved ? "Reopen" : "Resolve") + '</button>' +
      '<button type="button" data-cmt-del="' + i + '">Delete</button></div></div>'
    ).join("");
    commentPop.innerHTML =
      '<div class="ed-cmt-head">Comments</div>' +
      '<div class="ed-cmt-list">' + (list || '<p class="ed-cmt-empty">No comments yet.</p>') + '</div>' +
      '<div class="ed-cmt-add"><textarea rows="2" placeholder="Add a comment…"></textarea><button type="button" class="ed-cmt-send">Comment</button></div>';
    commentPop.querySelector(".ed-cmt-send").addEventListener("click", () => {
      const ta = commentPop.querySelector("textarea");
      const txt = (ta.value || "").trim();
      if (!txt) return;
      el.comments.push({ id: uid("cmt"), text: txt, resolved: false, ts: Date.now() });
      pushHistory(); fullRender(); drawCommentPop(el);
    });
    commentPop.querySelectorAll("[data-cmt-resolve]").forEach((b) => b.addEventListener("click", () => {
      const i = +b.dataset.cmtResolve; el.comments[i].resolved = !el.comments[i].resolved; pushHistory(); fullRender(); drawCommentPop(el);
    }));
    commentPop.querySelectorAll("[data-cmt-del]").forEach((b) => b.addEventListener("click", () => {
      const i = +b.dataset.cmtDel; el.comments.splice(i, 1); pushHistory(); fullRender(); drawCommentPop(el);
    }));
  }
  document.addEventListener("pointerdown", (e) => {
    if (commentPop && !commentPop.contains(e.target) && !(e.target.closest && e.target.closest('[data-fb="comment"]'))) closeCommentPopover();
  });

  // Grouped elements move + select as a unit. Returns the ids to select for el.
  function groupIdsFor(el) {
    if (el && el.group) return state.elements.filter((e) => e.group === el.group).map((e) => e.id);
    return el ? [el.id] : [];
  }

  // ---------- Interactions ----------
  function bindElementInteractions(node, el) {
    node.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      if (node.classList.contains("is-editing")) return;
      // While reframing a photo, the drag pans the image (handled by the
      // viewpoint session) — the frame itself must not move/select.
      if (node.classList.contains("is-editing-viewpoint")) return;
      ev.stopPropagation();

      const multi = isAddToSelection(ev);
      const ids = groupIdsFor(el); // the whole group if el is grouped
      state.selectedGuideId = null; // selecting an element drops any guide selection
      if (!state.selectedIds.includes(el.id)) {
        if (multi) ids.forEach((id) => { if (!state.selectedIds.includes(id)) state.selectedIds.push(id); });
        else state.selectedIds = ids;
        // A different element is now selected, so the panel's callbacks point
        // at the wrong one — but remember which swatch it was, so the bar can
        // reopen it against the new element rather than dumping you back to
        // the generic pane mid-way through recolouring a run of items.
        _reopenColorKey = _openColorKey;
        closeColorPanel();
        _paneFollowClick = true;
        fullRender();
      } else if (multi) {
        // Shift-click a selected group toggles the whole group off.
        state.selectedIds = state.selectedIds.filter((x) => ids.indexOf(x) === -1);
        fullRender();
        return;
      } else {
        // Already selected, so nothing about the selection changed and no
        // re-render was happening — which is exactly why the panel used to
        // stay on whatever pane you had open. Surface its controls anyway;
        // renderProps only rebuilds the panel, so the drag below is unaffected.
        _paneFollowClick = true;
        renderProps();
      }
      // Inside a screen's artwork mode, dragging moves the picture rather than
      // the element. Entered by double-clicking the screen, so the ordinary
      // drag - moving the whole thing - stays the default.
      if (!el.locked) {
        if (el.type === "screen" && el.src && artworkEditId === el.id) startArtworkPan(ev, el);
        else startDrag(ev);
      }
    });

    if (el.type === "text") {
      node.addEventListener("dblclick", (ev) => {
        ev.stopPropagation();
        startTextEdit(node, el);
      });
      // Click-to-edit: the first click selects (a full re-render replaces this
      // node, so this handler won't fire then); a second click on the already-
      // selected box drops the caret where you clicked — no double-click needed.
      node.addEventListener("click", (ev) => {
        if (el.locked || node.classList.contains("is-editing")) return;
        if (isAddToSelection(ev) || _dragMoved) return;
        if (state.selectedIds.length === 1 && state.selectedIds[0] === el.id) {
          startTextEdit(node, el, { x: ev.clientX, y: ev.clientY });
        }
      });
    }
  }

  let dragging = null;
  let _dragMoved = false; // true if the last pointer gesture actually moved an element
  function startDrag(ev) {
    ev.preventDefault();
    _dragMoved = false;
    const startX = ev.clientX, startY = ev.clientY;
    const initial = selectedElements().map((e) => ({ id: e.id, x: e.x, y: e.y }));
    let moved = false;

    function onMove(e) {
      const dx = (e.clientX - startX) / state.zoom;
      const dy = (e.clientY - startY) / state.zoom;
      if (!moved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) { moved = true; _dragMoved = true; }
      initial.forEach((m) => {
        const el = getEl(m.id);
        if (!el) return;
        el.x = Math.round(m.x + dx);
        el.y = Math.round(m.y + dy);
        partialRenderElement(el);
      });

      // Snap + smart distance guides for single selection
      if (initial.length === 1) {
        const el = getEl(initial[0].id);
        applySnap(el);        // clears guides, draws alignment lines, edge-snaps
        drawDistances(el);    // adds pixel-distance badges + equal-spacing snap
        partialRenderElement(el);
      }
      renderHandles();
    }
    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      clearGuides();
      if (moved) pushHistory();
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  // Re-measure a single text element's height to its content and update the
  // node + bounds (used live during text scaling/resizing).
  function fitTextHeight(el) {
    const node = canvasEl.querySelector('.ed-element[data-id="' + el.id + '"]');
    if (!node) return;
    const inner = node.querySelector(".ed-text-inner");
    if (!inner) return;
    const h = Math.ceil(inner.offsetHeight);
    if (h > 0) { el.h = h; node.style.height = h + "px"; }
  }

  /* Dragging one corner of a screen. Only that corner moves - the other three
     stay pinned, which is what makes it possible to match a surface in a photo
     rather than just skew a rectangle. */
  /* A quad is only meaningful as a surface while it stays convex and wound the
     same way round. Drag one corner past the far edge and it folds into a
     bowtie: the homography flips, the artwork turns inside out, and there is
     no sensible picture on the other side of it. So a move that would fold it
     is simply not taken - the corner stops at the last good position rather
     than the drag being cancelled, which is what makes it feel like a limit
     rather than a glitch. */
  function screenIsConvex(pts) {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const a = pts[i], b = pts[(i + 1) % 4], c = pts[(i + 2) % 4];
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cross) < 1e-6) return false;      // three corners in a line
      const s = cross > 0 ? 1 : -1;
      if (!sign) sign = s;
      else if (s !== sign) return false;
    }
    return true;
  }

  /* Spin the artwork inside the quad. The angle is read from the pointer's
     bearing around the quad's centre, so the artwork follows the cursor rather
     than tracking some accumulated delta. */
  function startArtworkRotate(ev, el, centre) {
    ev.preventDefault();
    ev.stopPropagation();
    const rect = canvasEl.getBoundingClientRect();
    const cx = rect.left + centre.x * state.zoom;
    const cy = rect.top + centre.y * state.zoom;
    const base = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
    const start = el.imgRotation || 0;
    function onMove(e) {
      const a = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
      let r = start + (a - base);
      if (e.shiftKey) r = Math.round(r / 15) * 15;
      // Kept in -180..180 so the number box never shows 540 degrees.
      r = ((Math.round(r) + 180) % 360 + 360) % 360 - 180;
      el.imgRotation = r;
      const node = canvasEl.querySelector('.ed-element[data-id="' + el.id + '"]');
      if (node) applyScreenTransform(node, el);
      renderHandles();
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      pushHistory();
      renderProps();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  /* Drag the artwork around inside the quad. Zooming in used to leave you
     looking at the middle of the picture with no way to reach the rest of it
     except two number boxes. */
  function startArtworkPan(ev, el) {
    ev.preventDefault();
    ev.stopPropagation();
    const startX = ev.clientX, startY = ev.clientY;
    const ox = el.imgOffsetX || 0, oy = el.imgOffsetY || 0;
    const node = canvasEl.querySelector('.ed-element[data-id="' + el.id + '"]');
    function onMove(e) {
      el.imgOffsetX = Math.round(ox + (e.clientX - startX) / state.zoom);
      el.imgOffsetY = Math.round(oy + (e.clientY - startY) / state.zoom);
      if (node) applyScreenTransform(node, el);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      pushHistory();
      renderProps();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && artworkEditId) setArtworkEdit(null);
  });

  function startCornerDrag(ev, el, index) {
    ev.preventDefault();
    ev.stopPropagation();
    const startX = ev.clientX, startY = ev.clientY;
    const origin = screenPoints(el);

    function onMove(e) {
      const dx = (e.clientX - startX) / state.zoom;
      const dy = (e.clientY - startY) / state.zoom;
      const pts = origin.map((p, i) => (i === index ? { x: p.x + dx, y: p.y + dy } : { x: p.x, y: p.y }));
      if (!screenIsConvex(pts)) return;
      // Written back through the element's own box so normaliseScreen can
      // re-fit it, rather than mutating corners in place.
      const minX = Math.min.apply(null, pts.map((p) => p.x));
      const minY = Math.min.apply(null, pts.map((p) => p.y));
      const maxX = Math.max.apply(null, pts.map((p) => p.x));
      const maxY = Math.max.apply(null, pts.map((p) => p.y));
      const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
      el.x = minX; el.y = minY; el.w = w; el.h = h;
      el.corners = pts.map((p) => ({ x: (p.x - minX) / w, y: (p.y - minY) / h }));
      partialRenderElement(el);
      renderHandles();
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      normaliseScreen(el);
      pushHistory();
      fullRender();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startResize(ev, el, handle) {
    ev.preventDefault();
    ev.stopPropagation();
    const startX = ev.clientX, startY = ev.clientY;
    const o = { x: el.x, y: el.y, w: el.w, h: el.h, size: el.size };
    const aspect = o.w / o.h;
    // Images and ellipses always keep their proportions; the toggle turns that
    // on for everything else too.
    const lockAspect = ratioLocked || el.type === "image" || el.type === "ellipse";
    // Text + corner handle → Canva-style scale: the font grows/shrinks with the
    // box (and the box width follows), so you size by dragging, not guessing.
    const textScale = (el.type === "text" && handle.length === 2);

    function onMove(e) {
      let dx = (e.clientX - startX) / state.zoom;
      let dy = (e.clientY - startY) / state.zoom;

      if (textScale) {
        const nw = handle.includes("e") ? Math.max(20, o.w + dx) : Math.max(20, o.w - dx);
        const scale = nw / o.w;
        el.w = Math.round(nw);
        el.size = Math.max(6, Math.round(o.size * scale));
        el.x = handle.includes("w") ? Math.round(o.x + (o.w - el.w)) : o.x;
        partialRenderElement(el);
        fitTextHeight(el); // height follows the wrapped, rescaled text
        el.y = handle.includes("n") ? Math.round(o.y + o.h - el.h) : o.y;
        partialRenderElement(el);
        renderHandles();
        // Live size readout in the context bar so you can see the number change.
        const sizeInput = document.querySelector("#ed-context .ed-size-ctl .ed-ctx-num");
        if (sizeInput) sizeInput.value = el.size;
        return;
      }

      let nx = o.x, ny = o.y, nw = o.w, nh = o.h;
      const shift = e.shiftKey || lockAspect;

      if (handle.includes("e")) nw = Math.max(8, o.w + dx);
      if (handle.includes("s")) nh = Math.max(8, o.h + dy);
      if (handle.includes("w")) { nw = Math.max(8, o.w - dx); nx = o.x + (o.w - nw); }
      if (handle.includes("n")) { nh = Math.max(8, o.h - dy); ny = o.y + (o.h - nh); }
      if (handle === "n") nw = o.w;
      if (handle === "s") nw = o.w;
      if (handle === "e") nh = o.h;
      if (handle === "w") nh = o.h;

      if (shift && (handle.length === 2)) {
        // corner: lock aspect
        if (Math.abs(dx) > Math.abs(dy)) {
          nh = nw / aspect;
          if (handle.includes("n")) ny = o.y + (o.h - nh);
        } else {
          nw = nh * aspect;
          if (handle.includes("w")) nx = o.x + (o.w - nw);
        }
      }
      el.x = Math.round(nx); el.y = Math.round(ny);
      el.w = Math.round(nw); el.h = Math.round(nh);
      partialRenderElement(el);
      renderHandles();
    }
    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      pushHistory();
      renderProps();
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  // Resize a multi-selection as one group: drag a handle on the combined box and
  // every element repositions + rescales proportionally (text font-size included).
  function startGroupResize(ev, els, gbox, handle) {
    ev.preventDefault();
    ev.stopPropagation();
    const startX = ev.clientX, startY = ev.clientY;
    const o = { x: gbox.x, y: gbox.y, w: gbox.w, h: gbox.h };
    const orig = els.map((e) => ({ el: e, x: e.x, y: e.y, w: e.w, h: e.h, size: e.size }));
    function onMove(e) {
      const dx = (e.clientX - startX) / state.zoom;
      const dy = (e.clientY - startY) / state.zoom;
      let nx = o.x, ny = o.y, nw = o.w, nh = o.h;
      if (handle.includes("e")) nw = Math.max(16, o.w + dx);
      if (handle.includes("s")) nh = Math.max(16, o.h + dy);
      if (handle.includes("w")) { nw = Math.max(16, o.w - dx); nx = o.x + (o.w - nw); }
      if (handle.includes("n")) { nh = Math.max(16, o.h - dy); ny = o.y + (o.h - nh); }
      if (handle === "n" || handle === "s") nw = o.w;
      if (handle === "e" || handle === "w") nh = o.h;
      // Shift (or a corner) keeps the group's aspect so nothing skews.
      if ((e.shiftKey || handle.length === 2)) {
        const s = Math.min(nw / o.w, nh / o.h);
        nw = o.w * s; nh = o.h * s;
        if (handle.includes("w")) nx = o.x + (o.w - nw);
        if (handle.includes("n")) ny = o.y + (o.h - nh);
      }
      const sx = nw / o.w, sy = nh / o.h;
      const sAvg = (sx + sy) / 2;
      orig.forEach((r) => {
        r.el.x = Math.round(nx + (r.x - o.x) * sx);
        r.el.y = Math.round(ny + (r.y - o.y) * sy);
        r.el.w = Math.max(4, Math.round(r.w * sx));
        r.el.h = Math.max(4, Math.round(r.h * sy));
        if (r.el.type === "text" && r.size) r.el.size = Math.max(6, Math.round(r.size * sAvg));
        partialRenderElement(r.el);
      });
      renderHandles();
    }
    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      pushHistory();
      renderProps();
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  function startRotate(ev, el) {
    ev.preventDefault();
    ev.stopPropagation();
    const rect = canvasEl.getBoundingClientRect();
    const cx = rect.left + (el.x + el.w / 2) * state.zoom;
    const cy = rect.top + (el.y + el.h / 2) * state.zoom;
    const baseAngle = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
    const startRot = el.rotation || 0;
    function onMove(e) {
      const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
      let r = startRot + (angle - baseAngle);
      if (e.shiftKey) r = Math.round(r / 15) * 15;
      el.rotation = Math.round(r);
      partialRenderElement(el);
      renderHandles();
    }
    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      pushHistory();
      renderProps();
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  // ---------- Snap guides ----------
  function clearGuides() { guidesEl.innerHTML = ""; }
  function drawGuide(orientation, pos) {
    const g = document.createElement("div");
    g.className = "ed-guide " + (orientation === "v" ? "ed-guide-v" : "ed-guide-h");
    if (orientation === "v") {
      g.style.left = pos + "px"; g.style.top = "0"; g.style.height = state.canvas.height + "px";
    } else {
      g.style.top = pos + "px"; g.style.left = "0"; g.style.width = state.canvas.width + "px";
    }
    guidesEl.appendChild(g);
  }
  function applySnap(el) {
    clearGuides();
    const threshold = 6;
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    const W = state.canvas.width, H = state.canvas.height;

    // Snap targets: canvas edges & center
    const xTargets = [0, W / 2, W];
    const yTargets = [0, H / 2, H];

    // Safe-area margins (when on) are snap lines too — an element nearing a
    // margin sticks to it (and releases if you keep pulling, via the threshold),
    // so designers can align to the margin without fiddling.
    const _m = state.margins;
    if (_m && _m.on && _m.size > 0) {
      const ms = _m.size;
      if (ms < W) xTargets.push(ms, W - ms);
      if (ms < H) yTargets.push(ms, H - ms);
    }

    xTargets.forEach((tx) => {
      if (Math.abs(cx - tx) < threshold) { el.x = tx - el.w / 2; drawGuide("v", tx); }
      else if (Math.abs(el.x - tx) < threshold) { el.x = tx; drawGuide("v", tx); }
      else if (Math.abs(el.x + el.w - tx) < threshold) { el.x = tx - el.w; drawGuide("v", tx); }
    });
    yTargets.forEach((ty) => {
      if (Math.abs(cy - ty) < threshold) { el.y = ty - el.h / 2; drawGuide("h", ty); }
      else if (Math.abs(el.y - ty) < threshold) { el.y = ty; drawGuide("h", ty); }
      else if (Math.abs(el.y + el.h - ty) < threshold) { el.y = ty - el.h; drawGuide("h", ty); }
    });

    // Snap to other elements
    state.elements.forEach((other) => {
      if (other.id === el.id) return;
      const oxs = [other.x, other.x + other.w / 2, other.x + other.w];
      const oys = [other.y, other.y + other.h / 2, other.y + other.h];
      oxs.forEach((tx) => {
        if (Math.abs(cx - tx) < threshold) { el.x = tx - el.w / 2; drawGuide("v", tx); }
        else if (Math.abs(el.x - tx) < threshold) { el.x = tx; drawGuide("v", tx); }
        else if (Math.abs(el.x + el.w - tx) < threshold) { el.x = tx - el.w; drawGuide("v", tx); }
      });
      oys.forEach((ty) => {
        if (Math.abs(cy - ty) < threshold) { el.y = ty - el.h / 2; drawGuide("h", ty); }
        else if (Math.abs(el.y - ty) < threshold) { el.y = ty; drawGuide("h", ty); }
        else if (Math.abs(el.y + el.h - ty) < threshold) { el.y = ty - el.h; drawGuide("h", ty); }
      });
    });
  }

  // ---------- Smart distance guides (Canva-style) ----------
  // While dragging one element, measure the gap to the nearest element on each
  // side (that overlaps on the perpendicular axis) and show a labelled pixel
  // distance. When the gaps on opposite sides are nearly equal, snap the element
  // so it's evenly spaced between its two neighbours.
  function _rangesOverlap(a0, a1, b0, b1) { return Math.min(a1, b1) - Math.max(a0, b0) > 0; }
  function drawDistance(orientation, a, b, perp) {
    const px = Math.round(Math.abs(b - a));
    if (px < 1) return;
    const lo = Math.min(a, b);
    const line = document.createElement("div");
    line.className = "ed-dist-line " + (orientation === "h" ? "ed-dist-line-h" : "ed-dist-line-v");
    const badge = document.createElement("div");
    badge.className = "ed-dist";
    badge.textContent = px;
    if (orientation === "h") {
      line.style.left = lo + "px"; line.style.top = perp + "px"; line.style.width = px + "px";
      badge.style.left = (lo + px / 2) + "px"; badge.style.top = perp + "px";
    } else {
      line.style.top = lo + "px"; line.style.left = perp + "px"; line.style.height = px + "px";
      badge.style.top = (lo + px / 2) + "px"; badge.style.left = perp + "px";
    }
    guidesEl.appendChild(line);
    guidesEl.appendChild(badge);
  }
  function drawDistances(el) {
    const others = state.elements.filter((o) => o.id !== el.id && !o.hidden);
    const ex0 = el.x, ex1 = el.x + el.w, ey0 = el.y, ey1 = el.y + el.h;
    // Horizontal neighbours (their vertical span overlaps this element's)
    let leftN = null, rightN = null;
    others.forEach((o) => {
      if (!_rangesOverlap(ey0, ey1, o.y, o.y + o.h)) return;
      if (o.x + o.w <= ex0) { if (!leftN || (o.x + o.w) > (leftN.x + leftN.w)) leftN = o; }
      else if (o.x >= ex1) { if (!rightN || o.x < rightN.x) rightN = o; }
    });
    const perpY = el.y + el.h / 2;
    if (leftN) drawDistance("h", leftN.x + leftN.w, ex0, perpY);
    if (rightN) drawDistance("h", ex1, rightN.x, perpY);
    // Vertical neighbours (their horizontal span overlaps this element's)
    let topN = null, botN = null;
    others.forEach((o) => {
      if (!_rangesOverlap(ex0, ex1, o.x, o.x + o.w)) return;
      if (o.y + o.h <= ey0) { if (!topN || (o.y + o.h) > (topN.y + topN.h)) topN = o; }
      else if (o.y >= ey1) { if (!botN || o.y < botN.y) botN = o; }
    });
    const perpX = el.x + el.w / 2;
    if (topN) drawDistance("v", topN.y + topN.h, ey0, perpX);
    if (botN) drawDistance("v", ey1, botN.y, perpX);
    // Equal-spacing snap — centre between two flanking neighbours when close.
    const eqTol = 4;
    if (leftN && rightN && Math.abs((ex0 - (leftN.x + leftN.w)) - (rightN.x - ex1)) < eqTol) {
      el.x = Math.round(((leftN.x + leftN.w) + rightN.x) / 2 - el.w / 2);
    }
    if (topN && botN && Math.abs((ey0 - (topN.y + topN.h)) - (botN.y - ey1)) < eqTol) {
      el.y = Math.round(((topN.y + topN.h) + botN.y) / 2 - el.h / 2);
    }
  }

  // ---------- Safe-area / margin guides ----------
  // A toggleable dashed rectangle inset from the canvas edges, so designers keep
  // content within a safe margin. Lives in its own persistent overlay (NOT the
  // transient snap-guides layer) and scales with the canvas via the shadow.
  function renderMargins() {
    const shadow = canvasEl && canvasEl.parentNode;
    if (!shadow) return;
    let ov = document.getElementById("ed-margins");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "ed-margins";
      ov.className = "ed-margins";
      shadow.insertBefore(ov, guidesEl || null);
    }
    const m = state.margins || (state.margins = { on: false, size: 60 });
    if (!m.on) { ov.hidden = true; ov.innerHTML = ""; return; }
    const W = state.canvas.width, H = state.canvas.height, s = Math.max(0, m.size || 0);
    ov.hidden = false;
    ov.innerHTML = "";
    const box = document.createElement("div");
    box.className = "ed-margin-box";
    box.style.left = s + "px"; box.style.top = s + "px";
    box.style.width = Math.max(0, W - 2 * s) + "px";
    box.style.height = Math.max(0, H - 2 * s) + "px";
    ov.appendChild(box);
  }

  // ---------- User guide lines ----------
  // Individual horizontal / vertical guides the user places, drags and styles
  // (weight + colour). Independent of the safe-area margin box above. They live
  // in their own overlay inside the canvas shadow so they scale with zoom, and
  // persist with the design.
  function renderGuides() {
    const shadow = canvasEl && canvasEl.parentNode;
    if (!shadow) return;
    let ov = document.getElementById("ed-userguides");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "ed-userguides";
      ov.className = "ed-userguides";
      shadow.insertBefore(ov, guidesEl || null);
    }
    ov.innerHTML = "";
    const guides = state.guides || (state.guides = []);
    const W = state.canvas.width, H = state.canvas.height;
    guides.forEach(function (g) {
      const line = document.createElement("div");
      line.className = "ed-userguide ed-userguide--" + g.axis + (g.id === state.selectedGuideId ? " is-selected" : "");
      line.dataset.guideId = g.id;
      const w = Math.max(0.5, g.weight || 1);
      if (g.axis === "v") {
        line.style.left = (g.pos - w / 2) + "px"; line.style.top = "0px";
        line.style.width = w + "px"; line.style.height = H + "px";
      } else {
        line.style.top = (g.pos - w / 2) + "px"; line.style.left = "0px";
        line.style.height = w + "px"; line.style.width = W + "px";
      }
      line.style.background = g.color || "#5B466E";
      bindGuideInteraction(line, g);
      ov.appendChild(line);
    });
  }

  function bindGuideInteraction(line, g) {
    line.addEventListener("pointerdown", function (ev) {
      ev.stopPropagation();
      ev.preventDefault();
      selectGuide(g.id);
      let dragging = true;
      function move(e) {
        if (!dragging) return;
        const rect = canvasEl.getBoundingClientRect();
        const x = (e.clientX - rect.left) / state.zoom;
        const y = (e.clientY - rect.top) / state.zoom;
        const lim = g.axis === "v" ? state.canvas.width : state.canvas.height;
        g.pos = Math.round(Math.max(0, Math.min(lim, g.axis === "v" ? x : y)));
        renderGuides();
      }
      function up() {
        dragging = false;
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        pushHistory();
        renderProps(); // refresh the position readout in the panel
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });
  }

  function selectGuide(id) {
    state.selectedGuideId = id;
    state.selectedIds = [];
    renderGuides();
    renderHandles();
    renderProps();
  }

  function deleteGuide(id) {
    state.guides = (state.guides || []).filter(function (g) { return g.id !== id; });
    if (state.selectedGuideId === id) state.selectedGuideId = null;
    pushHistory();
    fullRender();
  }

  function addGuide(axis) {
    const g = {
      id: uid("guide"),
      axis: axis,
      pos: Math.round((axis === "v" ? state.canvas.width : state.canvas.height) / 2),
      weight: 1,
      color: "#5B466E",
    };
    state.guides = state.guides || [];
    state.guides.push(g);
    pushHistory();
    fullRender();
    selectGuide(g.id);
  }

  // Remove every guide line at once (from the Guides pane).
  function clearAllGuides() {
    if (!state.guides || !state.guides.length) { toast("No guides to remove", 1800); return; }
    state.guides = [];
    state.selectedGuideId = null;
    pushHistory();
    fullRender();
    toast("Guides removed", 1600);
  }

  // Selection-pane controls for the active guide (position, weight, colour,
  // delete). Rendered by renderProps when a guide is selected.
  function renderGuideProps(body) {
    const g = (state.guides || []).find(function (x) { return x.id === state.selectedGuideId; });
    if (!g) { body.innerHTML = ""; return; }
    body.innerHTML = '<div class="ed-pane-header"><h3 class="ed-pane-title">Guide</h3>' +
      '<p class="ed-pane-sub">' + (g.axis === "v" ? "Vertical" : "Horizontal") + ' guide — drag on the canvas or set values here.</p></div>';
    const maxPos = g.axis === "v" ? state.canvas.width : state.canvas.height;
    const sec = document.createElement("div");
    sec.className = "ed-props-section";
    sec.appendChild(sliderNumberRow(g.axis === "v" ? "Position (X)" : "Position (Y)", "px", 0, maxPos, 1,
      function () { return g.pos; },
      function (v) { g.pos = v; },
      renderGuides));
    sec.appendChild(sliderNumberRow("Line weight", "px", 0.5, 12, 0.5,
      function () { return g.weight || 1; },
      function (v) { g.weight = v; },
      renderGuides));
    body.appendChild(sec);

    const colorSec = document.createElement("div");
    colorSec.className = "ed-props-section";
    colorSec.innerHTML = '<h4>Colour</h4>';
    const cwrap = document.createElement("div");
    cwrap.style.cssText = "display:flex;align-items:center;gap:8px;";
    cwrap.appendChild(colorSwatchButton(
      function () { return g.color || "#5B466E"; },
      { title: "Guide colour", onSolid: function (hex) { g.color = hex; renderGuides(); } }
    ));
    colorSec.appendChild(cwrap);
    body.appendChild(colorSec);

    const delSec = document.createElement("div");
    delSec.className = "ed-props-section";
    delSec.innerHTML = '<div class="ed-props-actions"><button class="danger" data-guide-del>Delete guide</button></div>';
    delSec.querySelector("[data-guide-del]").addEventListener("click", function () { deleteGuide(g.id); });
    body.appendChild(delSec);
  }

  // Small dropdown off the "+ Guide" button to pick the new guide's axis.
  let guideMenuEl = null;
  function closeGuideMenu() {
    if (guideMenuEl) { guideMenuEl.remove(); guideMenuEl = null; document.removeEventListener("pointerdown", onGuideMenuOutside, true); }
  }
  function onGuideMenuOutside(e) { if (guideMenuEl && !guideMenuEl.contains(e.target)) closeGuideMenu(); }
  function showGuideMenu(btn) {
    closeGuideMenu();
    const menu = document.createElement("div");
    menu.className = "ed-rclick";
    menu.style.position = "fixed";
    const r = btn.getBoundingClientRect();
    menu.style.left = r.left + "px";
    menu.style.top = (r.bottom + 6) + "px";
    menu.innerHTML =
      '<button type="button" class="ed-rclick-item" data-axis="v"><span>Vertical guide</span></button>' +
      '<button type="button" class="ed-rclick-item" data-axis="h"><span>Horizontal guide</span></button>';
    menu.querySelectorAll("[data-axis]").forEach(function (b) {
      b.addEventListener("click", function () { addGuide(b.dataset.axis); closeGuideMenu(); });
    });
    document.body.appendChild(menu);
    guideMenuEl = menu;
    setTimeout(function () { document.addEventListener("pointerdown", onGuideMenuOutside, true); }, 0);
  }

  // A large, centred, editable "Start building here" text box — what the blank
  // hint becomes on click (text pre-selected so typing replaces it).
  function addPlaceholderText() {
    const cw = state.canvas.width, ch = state.canvas.height;
    const w = Math.min(900, cw - 120);
    addElement({
      type: "text", text: "Start building here",
      font: "Cormorant Garamond", size: 64, weight: 500, italic: false,
      color: textContrastColor(state.canvas.background),
      align: "center", letterSpacing: 0, lineHeight: 1.1,
      x: Math.round((cw - w) / 2), y: Math.round(ch / 2 - 64), w: w, h: 128,
      rotation: 0, opacity: 1,
    });
    requestAnimationFrame(() => {
      const id = state.selectedIds[0];
      const node = canvasEl.querySelector('.ed-element[data-id="' + id + '"]');
      if (node) startTextEdit(node, getEl(id)); // select-all, ready to type over
    });
  }

  // Pick black or white text for legibility against a (possibly hex) background.
  function textContrastColor(bg) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(bg || "").trim());
    if (!m) return "#1c1d22";
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.55 ? "#1c1d22" : "#FFFFFF";
  }

  // ---------- Text editing ----------
  function startTextEdit(node, el, point) {
    const inner = node.querySelector(".ed-text-inner");
    if (!inner) return;
    node.classList.add("is-editing");
    inner.contentEditable = "true";
    inner.focus();
    // Click-to-edit places the caret where you clicked; double-click / new box
    // selects everything.
    let placed = false;
    if (point) {
      try {
        let range = null;
        if (document.caretRangeFromPoint) {
          range = document.caretRangeFromPoint(point.x, point.y);
        } else if (document.caretPositionFromPoint) {
          const pos = document.caretPositionFromPoint(point.x, point.y);
          if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); range.collapse(true); }
        }
        if (range && inner.contains(range.startContainer)) {
          const sel = window.getSelection();
          sel.removeAllRanges(); sel.addRange(range);
          placed = true;
        }
      } catch (_) { /* fall back to select-all */ }
    }
    if (!placed) document.execCommand("selectAll", false, null);

    // Grow (or shrink) the box live as lines are added/removed, and keep the
    // selection outline glued to it.
    function grow() {
      const h = Math.ceil(inner.offsetHeight);
      if (h > 0 && h !== el.h) {
        el.h = h;
        node.style.height = h + "px";
        renderHandles();
      }
    }
    inner.addEventListener("input", grow);
    grow();

    function commit() {
      inner.contentEditable = "false";
      node.classList.remove("is-editing");
      // Read the edited DOM back into el.text (+ el.runs when the user has
      // formatted part of it). Collapses to plain text when nothing is styled,
      // so plain editing behaves exactly as before.
      commitTextFromDom(inner, el);
      inner.removeEventListener("input", grow);
      inner.removeEventListener("blur", commit);
      renderHandles(); // bring the floating toolbar back now editing is done
    }
    inner.addEventListener("blur", commit);
  }

  // ---------- Canvas: drag a marquee to multi-select, or click to deselect ----
  canvasEl.addEventListener("pointerdown", (ev) => {
    if (ev.target !== canvasEl || ev.button !== 0) return;
    if (_bgRepoActive) return; // reposition mode runs its own drag
    closeColorPanel();
    // Plain drag on the empty background PANS the view; hold Shift (or Cmd) to box-select.
    if (!isAddToSelection(ev)) {
      const startX = ev.clientX, startY = ev.clientY;
      const startL = stageEl.scrollLeft, startT = stageEl.scrollTop;
      let panned = false;
      stageEl.style.cursor = "grabbing";
      function pMove(e) {
        if (Math.abs(e.clientX - startX) > 2 || Math.abs(e.clientY - startY) > 2) panned = true;
        stageEl.scrollLeft = startL - (e.clientX - startX);
        stageEl.scrollTop = startT - (e.clientY - startY);
      }
      function pUp(e) {
        document.removeEventListener("pointermove", pMove);
        document.removeEventListener("pointerup", pUp);
        stageEl.style.cursor = "";
        if (!panned) { state.selectedIds = []; state.selectedGuideId = null; fullRender(); } // click = deselect
      }
      document.addEventListener("pointermove", pMove);
      document.addEventListener("pointerup", pUp);
      return;
    }
    const rect = canvasEl.getBoundingClientRect();
    const z = state.zoom || 1;
    const sx = (ev.clientX - rect.left) / z, sy = (ev.clientY - rect.top) / z;
    let moved = false;
    const box = document.createElement("div");
    box.className = "ed-marquee";
    handlesEl.appendChild(box);
    const draw = (x, y, w, h) => { box.style.left = x + "px"; box.style.top = y + "px"; box.style.width = w + "px"; box.style.height = h + "px"; };
    draw(sx, sy, 0, 0);
    function onMove(e) {
      const cx = (e.clientX - rect.left) / z, cy = (e.clientY - rect.top) / z;
      if (Math.abs(cx - sx) > 3 || Math.abs(cy - sy) > 3) moved = true;
      draw(Math.min(sx, cx), Math.min(sy, cy), Math.abs(cx - sx), Math.abs(cy - sy));
    }
    function onUp(e) {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      box.remove();
      if (!moved) { state.selectedIds = []; state.selectedGuideId = null; fullRender(); return; }
      const cx = (e.clientX - rect.left) / z, cy = (e.clientY - rect.top) / z;
      const rx = Math.min(sx, cx), ry = Math.min(sy, cy), rw = Math.abs(cx - sx), rh = Math.abs(cy - sy);
      const ids = new Set();
      state.elements.forEach((el) => {
        if (el.locked) return;
        if (el.x < rx + rw && el.x + el.w > rx && el.y < ry + rh && el.y + el.h > ry) {
          groupIdsFor(el).forEach((id) => ids.add(id));
        }
      });
      state.selectedIds = Array.from(ids);
      fullRender();
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  });
  stageEl.addEventListener("pointerdown", (ev) => {
    if (ev.target === stageEl || ev.target === shadowEl) {
      state.selectedIds = [];
      state.selectedGuideId = null;
      closeColorPanel();
      fullRender();
    }
  });

  // ---------- Add element helpers ----------
  function addElement(props) {
    const id = uid(props.type);
    const el = Object.assign({
      id,
      type: props.type,
      x: 100, y: 100, w: 200, h: 200,
      rotation: 0,
      opacity: 1,
    }, props);
    state.elements.push(el);
    state.selectedIds = [id];
    pushHistory();
    fullRender();
  }

  function addShape(shape) {
    const cx = state.canvas.width / 2 - 100;
    const cy = state.canvas.height / 2 - 100;
    const common = { x: cx, y: cy, w: 200, h: 200, rotation: 0, opacity: 1, fill: "#474254", stroke: "transparent", strokeWidth: 0, radius: 0 };
    if (shape === "rect") addElement(Object.assign({ type: "rect" }, common));
    else if (shape === "ellipse") addElement(Object.assign({ type: "ellipse" }, common));
    else if (shape === "rounded") addElement(Object.assign({ type: "rect" }, common, { radius: 100 }));
    else if (shape === "triangle") addElement(Object.assign({ type: "triangle" }, common));
    else if (shape === "star") addElement(Object.assign({ type: "star" }, common));
    else if (shape === "line") addElement(Object.assign({ type: "line" }, common, { h: 4, w: 320 }));
    else if (shape === "hr-thin") addElement(Object.assign({ type: "rect" }, common, { h: 1, w: 480, fill: "#1c1d22" }));
    else if (shape === "hr-thick") addElement(Object.assign({ type: "rect" }, common, { h: 4, w: 480, fill: "#1c1d22" }));
  }

  function addText(kind) {
    const cx = state.canvas.width / 2;
    const cy = state.canvas.height / 2;
    let preset = { text: "Add your text", font: "Cormorant Garamond", size: 48, weight: 500, italic: false, color: "#1c1d22", align: "center", letterSpacing: 0, lineHeight: 1.2, w: 600, h: 80 };
    if (kind === "heading") preset = Object.assign(preset, { text: "Heading", size: 72, w: 700, h: 120 });
    if (kind === "subheading") preset = Object.assign(preset, { text: "A subheading goes here", size: 32, italic: true, w: 600, h: 80 });
    if (kind === "body") preset = Object.assign(preset, { text: "Body copy that explains the story behind the post.", font: "Darker Grotesque", size: 18, weight: 400, w: 520, h: 100 });
    if (kind === "brand-eyebrow") preset = Object.assign(preset, { text: "CHAPTER MARKER", font: "Darker Grotesque", size: 16, weight: 700, letterSpacing: 6, color: "#474254", w: 480, h: 30 });
    if (kind === "brand-quote") preset = Object.assign(preset, { text: '"A pulled quote — italic Cormorant for emphasis."', italic: true, size: 38, w: 720, h: 140 });
    addElement(Object.assign({ type: "text", x: cx - preset.w / 2, y: cy - preset.h / 2, rotation: 0, opacity: 1 }, preset));
  }

  /* How big a photo should arrive, and in what shape.

     Both of the paths below used to hardcode 500x500, so every image was
     stretched into a square the moment it landed - a portrait shot came in
     squashed and you had to fix it by hand before you could even see what it
     was. The logo drop already sized from the natural dimensions; this is that,
     shared, so every route in agrees.

     The image loads before the element is made: the natural size is the whole
     input, and guessing it and correcting later would make the element jump
     under the cursor. */
  function fitImageBox(natW, natH, max) {
    const cap = max || 500;
    const ratio = (natW && natH) ? natW / natH : 1;
    // Never wider or taller than the canvas either - an image that arrives
    // bigger than the page is its own kind of annoying.
    const limit = Math.min(cap, state.canvas.width * 0.85, state.canvas.height * 0.85);
    let w, h;
    if (ratio >= 1) { w = limit; h = limit / ratio; }
    else { h = limit; w = limit * ratio; }
    return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
  }
  async function measureImageBox(src, max) {
    try {
      const img = await loadImage(src);
      return fitImageBox(img.naturalWidth, img.naturalHeight, max);
    } catch (_) {
      return fitImageBox(1, 1, max);   // unreadable image: square, as before
    }
  }

  async function addImage(src) {
    // If exactly one frame is selected, treat this as a "fill the frame"
    // action rather than adding a new floating image. This matches the
    // user's mental model: pick a frame, then pick a photo.
    if (state.selectedIds.length === 1) {
      const sel = getEl(state.selectedIds[0]);
      if (sel && sel.type === "frame") {
        fillFrame(sel, src);
        return;
      }
    }
    const { w, h } = await measureImageBox(src);
    addElement({ type: "image", x: Math.round(state.canvas.width / 2 - w / 2), y: Math.round(state.canvas.height / 2 - h / 2), w, h, src, opacity: 1, rotation: 0 });
  }

  // ---------- SVG shapes + icons ----------
  // Each entry is a self-contained SVG and the preferred starting size
  // on the canvas. We render them as `image` elements with a data-URI
  // src, so they go through the existing image renderer, selection,
  // resize, history, and export pipelines for free.
  //
  // To keep the file readable each SVG uses single-quoted attributes;
  // the surrounding JS string is backtick-quoted so we don't have to
  // escape anything.
  const SVG_SHAPES = {
    // ----- Shapes (geometric + symbolic) -----
    heart: { w: 400, h: 400, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#1c1d22'><path d='M12 21s-7-4.5-9.5-9C1 8.5 3 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4 0 6 4.5 4.5 8-2.5 4.5-9.5 9-9.5 9z'/></svg>` },
    cloud: { w: 480, h: 320, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 16' fill='#1c1d22'><path d='M18 14H6a4 4 0 0 1-1-7.9 5 5 0 0 1 9.7-1.4 4 4 0 0 1 4.3 4.3A4 4 0 0 1 18 14z'/></svg>` },
    hexagon: { w: 400, h: 400, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#1c1d22'><polygon points='12,2 21.66,7.5 21.66,16.5 12,22 2.34,16.5 2.34,7.5'/></svg>` },
    pentagon: { w: 400, h: 400, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#1c1d22'><polygon points='12,2 22.5,9.5 18.5,22 5.5,22 1.5,9.5'/></svg>` },
    octagon: { w: 400, h: 400, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#1c1d22'><polygon points='8.5,2 15.5,2 22,8.5 22,15.5 15.5,22 8.5,22 2,15.5 2,8.5'/></svg>` },
    diamond: { w: 400, h: 400, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#1c1d22'><polygon points='12,2 22,12 12,22 2,12'/></svg>` },
    'arrow-r': { w: 500, h: 360, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 24' fill='#1c1d22'><polygon points='2,9 18,9 18,3 30,12 18,21 18,15 2,15'/></svg>` },
    'arrow-l': { w: 500, h: 360, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 24' fill='#1c1d22'><polygon points='30,9 14,9 14,3 2,12 14,21 14,15 30,15'/></svg>` },
    speech: { w: 480, h: 400, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 20' fill='#1c1d22'><path d='M3 2h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-8l-5 4v-4H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z'/></svg>` },
    lightning: { w: 320, h: 500, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 24' fill='#1c1d22'><polygon points='11,2 2,13 8,13 6,22 16,11 10,11 12,2'/></svg>` },
    banner: { w: 520, h: 240, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 16' fill='#1c1d22'><polygon points='2,2 28,2 30,8 28,14 2,14 4,8'/></svg>` },
    plus: { w: 400, h: 400, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#1c1d22'><polygon points='9,2 15,2 15,9 22,9 22,15 15,15 15,22 9,22 9,15 2,15 2,9 9,9'/></svg>` },

    // ----- Social media + contact icons -----
    // Simple, monochrome, recognisable. Sized 200x200 by default so
    // they read as "icons" not "shapes" — small accents you drop onto
    // a design. User can resize freely afterwards.
    ig:   { w: 200, h: 200, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='#1c1d22' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='18' height='18' rx='5'/><circle cx='12' cy='12' r='4'/><circle cx='17.5' cy='6.5' r='1' fill='#1c1d22' stroke='none'/></svg>` },
    fb:   { w: 200, h: 200, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#1c1d22'><path d='M12 2a10 10 0 0 0-1.5 19.9v-7H8v-3h2.5v-2.2c0-2.5 1.5-3.8 3.7-3.8 1.1 0 2.2.2 2.2.2v2.4h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 3h-2.3v7A10 10 0 0 0 12 2z'/></svg>` },
    li:   { w: 200, h: 200, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#1c1d22'><path d='M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.3 18.3H5.7V9.5h2.6v8.8zM7 8.3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm11.3 10h-2.6v-4.3c0-1-.4-1.7-1.3-1.7-.7 0-1.1.5-1.3 1-.1.2-.1.4-.1.6v4.4h-2.6V9.5h2.6v1.1c.3-.5 1-1.3 2.4-1.3 1.7 0 3 1.1 3 3.5v5.5z'/></svg>` },
    tt:   { w: 200, h: 200, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#1c1d22'><path d='M16 2v3.5a4.5 4.5 0 0 0 4.5 4.5V13a7.5 7.5 0 0 1-4.5-1.5V16a6 6 0 1 1-6-6v3a3 3 0 1 0 3 3V2h3z'/></svg>` },
    yt:   { w: 200, h: 200, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#1c1d22'><path d='M22 7.6c-.2-1.6-1.4-2.8-3-3-2.2-.2-7-.2-7-.2s-4.8 0-7 .2c-1.6.2-2.8 1.4-3 3-.2 1.4-.2 4.4-.2 4.4s0 3 .2 4.4c.2 1.6 1.4 2.8 3 3 2.2.2 7 .2 7 .2s4.8 0 7-.2c1.6-.2 2.8-1.4 3-3 .2-1.4.2-4.4.2-4.4s0-3-.2-4.4zM10 15V9l5 3-5 3z'/></svg>` },
    x:    { w: 200, h: 200, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#1c1d22'><path d='M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z'/></svg>` },
    wa:   { w: 200, h: 200, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#1c1d22'><path d='M17.5 14.4c-.3-.1-1.7-.8-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-1 1.2-.2.2-.4.2-.6.1-.3-.1-1.2-.5-2.4-1.5-.9-.8-1.4-1.8-1.6-2-.2-.3 0-.4.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.7-1.7c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.4-.3.3-1 .9-1 2.3 0 1.4 1 2.7 1.2 2.9.1.2 2 3 4.8 4.2 1.7.7 2.3.7 3.1.6.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2z'/></svg>` },
    pi:   { w: 200, h: 200, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#1c1d22'><path d='M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9.2-.8 1.2-5.1 1.2-5.1s-.3-.6-.3-1.5c0-1.4.8-2.5 1.9-2.5.9 0 1.3.7 1.3 1.5 0 .9-.6 2.2-.9 3.5-.2 1 .5 1.9 1.6 1.9 1.9 0 3.3-2 3.3-4.8 0-2.5-1.8-4.3-4.4-4.3-3 0-4.7 2.2-4.7 4.5 0 .9.3 1.8.7 2.3.1.1.1.2.1.3l-.3 1.2c-.1.2-.2.3-.4.2-1.4-.7-2.3-2.7-2.3-4.3 0-3.5 2.5-6.7 7.3-6.7 3.8 0 6.8 2.7 6.8 6.4 0 3.8-2.4 6.9-5.8 6.9-1.1 0-2.2-.6-2.6-1.3l-.7 2.7c-.3 1-.9 2.2-1.3 3A10 10 0 1 0 12 2z'/></svg>` },
    ph:   { w: 200, h: 200, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#1c1d22'><path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z'/></svg>` },
    mail: { w: 200, h: 200, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='#1c1d22' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'/><polyline points='22,6 12,13 2,6'/></svg>` },
    pin:  { w: 200, h: 200, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#1c1d22'><path d='M12 2C8 2 5 5 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-4-3-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z'/></svg>` },
    web:  { w: 200, h: 200, svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='#1c1d22' stroke-width='1.8' stroke-linecap='round'><circle cx='12' cy='12' r='10'/><line x1='2' y1='12' x2='22' y2='12'/><path d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'/></svg>` },
  };

  // ----- SVG recolor helpers -----
  // Every entry in SVG_SHAPES bakes #1c1d22 as the fill/stroke colour.
  // When the customer picks a different colour in the selection panel,
  // we regenerate the data-URI src by global-replacing that token.
  // Cheap, no parser needed — and works for fill, stroke and any
  // attribute that references the colour.
  const SVG_DEFAULT_FILL = "#1c1d22";
  function svgWithFill(key, fill) {
    const def = SVG_SHAPES[key];
    if (!def) return null;
    const safe = (fill && /^#[0-9a-f]{3,8}$/i.test(fill)) ? fill : SVG_DEFAULT_FILL;
    return def.svg.split(SVG_DEFAULT_FILL).join(safe);
  }
  function svgKeyToDataUri(key, fill) {
    const svg = svgWithFill(key, fill);
    if (!svg) return null;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  // Insert an SVG-as-image element. The SVG is encoded as a data URI so
  // it goes through the standard `image` element path — no changes to
  // renderer, history, export, or selection.
  // We stamp the element with `svgKey` + `svgFill` so the selection
  // panel can offer a colour picker that regenerates the src.
  function addSvgShape(key) {
    const def = SVG_SHAPES[key];
    if (!def) return;
    const fill = SVG_DEFAULT_FILL;
    const src = svgKeyToDataUri(key, fill);
    const w = def.w, h = def.h;
    addElement({
      type: "image",
      svgKey: key,
      svgFill: fill,
      x: state.canvas.width / 2 - w / 2,
      y: state.canvas.height / 2 - h / 2,
      w, h, src,
      opacity: 1,
      rotation: 0,
    });
  }

  // ---------- Frames ----------
  // Frame presets — w/h are starting sizes (px on the design canvas), and
  // shape is the silhouette the photo will be cropped to.
  const FRAME_PRESETS = {
    square:    { w: 500, h: 500, shape: "square" },
    portrait:  { w: 420, h: 560, shape: "portrait" },
    landscape: { w: 600, h: 450, shape: "landscape" },
    wide:      { w: 720, h: 320, shape: "wide" },
    circle:    { w: 500, h: 500, shape: "circle" },
    rounded:   { w: 500, h: 500, shape: "rounded" },
    arch:      { w: 440, h: 560, shape: "arch" },
    diamond:   { w: 500, h: 500, shape: "diamond" },
  };

  /* ---------- Screen mockups ----------
     A screen is a frame whose four corners move independently: drop a photo of
     a laptop, a phone, a billboard or a poster on the canvas, add a screen over
     the flat surface, pull its corners onto the four corners of that surface,
     and the artwork sits in it in perspective.

     Corners are stored as fractions of the element's own box (0..1, clockwise
     from top-left), not as canvas coordinates. That is what lets a screen
     inherit everything else for free: dragging moves x/y, resizing scales w/h,
     alignment and group resize read the same bounding box as every other
     element, and the quad follows all of it without a line of extra code. */
  const SCREEN_CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];   // TL TR BR BL
  // Enough contrast between them to find one that shows up on any photograph.
  const SCREEN_GUIDE_COLOURS = [
    { name: "Black", hex: "#111111" }, { name: "White", hex: "#ffffff" },
    { name: "Beige", hex: "#e8dcc8" }, { name: "Green", hex: "#00c2a8" },
    { name: "Blue", hex: "#2f6bf0" },  { name: "Pink", hex: "#c200b2" },
  ];
  // Which screen, if any, is in artwork mode: double-clicked, so dragging pans
  // the picture inside it instead of moving the element.
  let artworkEditId = null;
  /* The guide sits over the photo, which is the point of it - until you are
     trying to read the photo. Sampling a colour off the device screen you are
     lining up against gave you the guide's tint instead, and an eyedropper
     that reads actual screen pixels cannot be reasoned with: whatever is
     showing is what it takes. So the guide comes off on demand. Editor state,
     not design data - it describes how you are working, not what you made. */
  let screenGuideHidden = false;
  function setArtworkEdit(id) {
    if (artworkEditId === id) return;
    artworkEditId = id;
    fullRender();
  }

  function screenCorners(el) {
    const c = Array.isArray(el.corners) && el.corners.length === 4 ? el.corners : null;
    return SCREEN_CORNERS.map((d, i) => ({
      x: c && c[i] && isFinite(c[i].x) ? c[i].x : d[0],
      y: c && c[i] && isFinite(c[i].y) ? c[i].y : d[1],
    }));
  }
  // Corner positions in canvas coordinates.
  function screenPoints(el) {
    return screenCorners(el).map((c) => ({ x: el.x + c.x * el.w, y: el.y + c.y * el.h }));
  }

  /* The homography taking the unit square to the four corners.

     This is the whole trick, and it is the one thing a plain 2D transform
     cannot express: a perspective map needs the bottom row (g, h) that an
     affine matrix does not have. Closed form - no solver, no library. */
  function screenHomography(q) {
    const [p0, p1, p2, p3] = q;                 // TL TR BR BL
    const sx = p0.x - p1.x + p2.x - p3.x;
    const sy = p0.y - p1.y + p2.y - p3.y;
    // Both zero means the quad is a parallelogram: no perspective, and the
    // general form below would divide by a determinant of zero.
    if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
      return { a: p1.x - p0.x, b: p3.x - p0.x, c: p0.x,
               d: p1.y - p0.y, e: p3.y - p0.y, f: p0.y, g: 0, h: 0 };
    }
    const dx1 = p1.x - p2.x, dy1 = p1.y - p2.y;
    const dx2 = p3.x - p2.x, dy2 = p3.y - p2.y;
    const den = dx1 * dy2 - dx2 * dy1;
    if (!den) return null;
    const g = (sx * dy2 - dx2 * sy) / den;
    const h = (dx1 * sy - sx * dy1) / den;
    return {
      a: p1.x - p0.x + g * p1.x, b: p3.x - p0.x + h * p3.x, c: p0.x,
      d: p1.y - p0.y + g * p1.y, e: p3.y - p0.y + h * p3.y, f: p0.y, g: g, h: h,
    };
  }
  // Where a point in the unit square lands. Used by the export mesh.
  function screenProject(m, u, v) {
    const w = m.g * u + m.h * v + 1;
    return { x: (m.a * u + m.b * v + m.c) / w, y: (m.d * u + m.e * v + m.f) / w };
  }

  /* The same homography as a CSS transform, so the live canvas shows exactly
     what will be exported. The image is laid out at its own pixel size and the
     matrix maps that box onto the quad, so the source coordinates divide out
     by the image's width and height. matrix3d is column-major. */
  function screenMatrixCss(el, imgW, imgH) {
    const local = screenCorners(el).map((c) => ({ x: c.x * el.w, y: c.y * el.h }));
    const m = screenHomography(local);
    if (!m || !imgW || !imgH) return "";
    const a = m.a / imgW, d = m.d / imgW, g = m.g / imgW;
    const b = m.b / imgH, e = m.e / imgH, h = m.h / imgH;
    return "matrix3d(" + [a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, m.c, m.f, 0, 1].join(",") + ")";
  }

  /* The artwork's own placement inside the screen.

     It used to be stretched to the quad, which only looks right when the
     artwork happens to share the surface's proportions - and a phone screen
     and an Instagram post never do. So it is fitted to cover the plane with
     its shape intact, and then it is yours to move: pan, zoom and rotate,
     the same three things you would reach for on any crop.

     Two nested transforms rather than one. The plane carries the perspective;
     the artwork sits inside that space with a plain affine transform of its
     own. Composing them this way means panning does not have to be re-derived
     through the homography every time it moves. */
  /* Fill crops the artwork to the surface; Fit shows all of it and leaves the
     surface showing at the edges.

     Fill alone is wrong more often than it looks: a 4:5 post going onto a
     landscape screen gets cropped to a band across its middle, and the only way
     back was to zoom out - which shrank it away from the edges and left gaps
     anyway. Fit is the honest answer to "show me my whole design". */
  function screenImageFit(el) {
    const nw = el.imgNaturalW, nh = el.imgNaturalH;
    if (!nw || !nh) return { baseW: el.w, baseH: el.h };
    const ar = nw / nh, planeAr = el.w / el.h;
    const contain = el.imgFit === "contain";
    // Fill matches the longer side, Fit matches the shorter one. Same two
    // cases, opposite choice.
    if (contain ? ar > planeAr : ar < planeAr) { const w = el.w; return { baseW: w, baseH: w / ar }; }
    const h = el.h; return { baseW: h * ar, baseH: h };
  }
  // The artwork's affine transform, in plane coordinates.
  function screenImageAffine(el) {
    const fit = screenImageFit(el);
    const s = el.imgScale != null ? el.imgScale : 1;
    const rot = ((el.imgRotation || 0) * Math.PI) / 180;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    // Centre of the artwork in plane space.
    const cx = el.w / 2 + (el.imgOffsetX || 0);
    const cy = el.h / 2 + (el.imgOffsetY || 0);
    return { a: cos * s, b: -sin * s, c: cx, d: sin * s, e: cos * s, f: cy, baseW: fit.baseW, baseH: fit.baseH };
  }

  function applyScreenTransform(node, el) {
    const plane = node.querySelector(".sc-plane");
    const img = node.querySelector(".sc-img");
    if (!plane) return;
    plane.style.width = el.w + "px";
    plane.style.height = el.h + "px";
    plane.style.transformOrigin = "0 0";
    plane.style.transform = screenMatrixCss(el, el.w, el.h);
    if (!img) return;
    const fit = screenImageFit(el);
    /* Placed with explicit left/top rather than a percentage translate.

       A `translate(-50%,-50%)` in the same list as a scale resolves against the
       element's own un-scaled box, so the centring drifts by half the growth as
       soon as you zoom - which showed up as the artwork pulling away from one
       corner of the quad. Positioning it outright and rotating about its own
       centre is unambiguous, and it is the same placement screenImageAffine
       describes, so the canvas and the exported file cannot disagree. */
    img.style.width = fit.baseW + "px";
    img.style.height = fit.baseH + "px";
    img.style.left = ((el.w - fit.baseW) / 2 + (el.imgOffsetX || 0)) + "px";
    img.style.top = ((el.h - fit.baseH) / 2 + (el.imgOffsetY || 0)) + "px";
    img.style.transformOrigin = "50% 50%";
    img.style.transform =
      "rotate(" + (el.imgRotation || 0) + "deg)" +
      " scale(" + (el.imgScale != null ? el.imgScale : 1) + ")";
  }

  /* After a corner moves, re-fit the element's box to the quad so the bounding
     box stays honest: selection, layers, alignment and multi-select all read
     x/y/w/h, and a box that no longer contains its own artwork makes every one
     of them wrong. */
  function normaliseScreen(el) {
    const pts = screenPoints(el);
    const minX = Math.min.apply(null, pts.map((p) => p.x));
    const minY = Math.min.apply(null, pts.map((p) => p.y));
    const maxX = Math.max.apply(null, pts.map((p) => p.x));
    const maxY = Math.max.apply(null, pts.map((p) => p.y));
    const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
    el.x = minX; el.y = minY; el.w = w; el.h = h;
    el.corners = pts.map((p) => ({ x: (p.x - minX) / w, y: (p.y - minY) / h }));
  }

  function addScreen() {
    const w = 520, h = 320;
    addElement({
      type: "screen",
      x: Math.round(state.canvas.width / 2 - w / 2),
      y: Math.round(state.canvas.height / 2 - h / 2),
      w: w, h: h, rotation: 0, opacity: 1,
      // Starts square. A default skew would only have to be undone, and a
      // rectangle makes it obvious the corners are yours to move.
      corners: SCREEN_CORNERS.map(([x, y]) => ({ x: x, y: y })),
      // The colour of the guide you position it with - not part of the artwork
      // and never exported. A screen is usually being lined up against a dark
      // phone or a black monitor, where a subtle outline is no outline at all,
      // so it is a colour you can change rather than one we picked for you.
      guide: "#00c2a8",
      src: null, imgNaturalW: 0, imgNaturalH: 0,
      imgScale: 1, imgOffsetX: 0, imgOffsetY: 0, imgRotation: 0, imgFit: "cover",
    });
  }

  function fillScreen(el, src) {
    el.src = src;
    el.imgNaturalW = 0;
    el.imgNaturalH = 0;
    // A new piece of artwork starts centred and unrotated - carrying the last
    // one's framing over would be a puzzle, not a convenience.
    el.imgScale = 1; el.imgOffsetX = 0; el.imgOffsetY = 0; el.imgRotation = 0;
    const probe = new Image();
    probe.crossOrigin = "anonymous";
    probe.onload = function () {
      el.imgNaturalW = probe.naturalWidth;
      el.imgNaturalH = probe.naturalHeight;
      partialRenderElement(el);
    };
    probe.src = src;
    pushHistory();
    fullRender();
  }

  function resetScreenCorners(el) {
    if (!el || el.type !== "screen") return;
    el.corners = SCREEN_CORNERS.map(([x, y]) => ({ x: x, y: y }));
    pushHistory();
    fullRender();
  }

  function addFrame(kind) {
    const p = FRAME_PRESETS[kind] || FRAME_PRESETS.square;
    addElement({
      type: "frame",
      frameShape: p.shape,
      x: state.canvas.width / 2 - p.w / 2,
      y: state.canvas.height / 2 - p.h / 2,
      w: p.w,
      h: p.h,
      rotation: 0,
      opacity: 1,
      src: null,                // empty until filled
      imgScale: 1,              // viewpoint zoom — 1 = "cover" fit
      imgOffsetX: 0,            // viewpoint pan in px (centre-relative)
      imgOffsetY: 0,
      imgNaturalW: 0,           // populated when src loads — used to compute fit
      imgNaturalH: 0,
    });
  }

  // Fill (or replace) the photo inside a frame. Always resets the viewpoint
  // so the new photo sits centred and "covers" the frame.
  function fillFrame(frameEl, src) {
    frameEl.src = src;
    frameEl.imgScale = 1;
    frameEl.imgOffsetX = 0;
    frameEl.imgOffsetY = 0;
    frameEl.imgNaturalW = 0;
    frameEl.imgNaturalH = 0;
    // Pre-load to capture natural dimensions so the cover fit can compute
    // the correct base scale. We render again once they're known.
    const probe = new Image();
    probe.crossOrigin = "anonymous";
    probe.onload = function () {
      frameEl.imgNaturalW = probe.naturalWidth;
      frameEl.imgNaturalH = probe.naturalHeight;
      partialRenderElement(frameEl);
    };
    probe.src = src;
    pushHistory();
    fullRender();
  }

  // Pull a frame's photo out as a free-standing image element, leaving the
  // frame empty (Canva-style "Detach image"). The image is placed so the
  // currently-visible region stays anchored and the rest of the photo is
  // revealed around it (a plain image element has no crop).
  function detachFrameImage(frameEl) {
    if (!frameEl || frameEl.type !== "frame" || !frameEl.src) return;
    const fit = frameCoverFit(frameEl);
    const s = frameEl.imgScale || 1;
    const imgW = Math.round(fit.baseW * s);
    const imgH = Math.round(fit.baseH * s);
    const cx = frameEl.x + frameEl.w / 2 + (frameEl.imgOffsetX || 0);
    const cy = frameEl.y + frameEl.h / 2 + (frameEl.imgOffsetY || 0);
    const id = uid("image");
    const imgEl = {
      id,
      type: "image",
      x: Math.round(cx - imgW / 2),
      y: Math.round(cy - imgH / 2),
      w: imgW,
      h: imgH,
      src: frameEl.src,
      opacity: frameEl.opacity != null ? frameEl.opacity : 1,
      rotation: frameEl.rotation || 0,
    };
    // Sit the detached image directly above the (now empty) frame.
    const idx = state.elements.indexOf(frameEl);
    state.elements.splice(idx + 1, 0, imgEl);
    frameEl.src = null;
    frameEl.imgScale = 1; frameEl.imgOffsetX = 0; frameEl.imgOffsetY = 0;
    frameEl.imgNaturalW = 0; frameEl.imgNaturalH = 0;
    state.selectedIds = [id];
    pushHistory();
    fullRender();
  }

  // ---------- Delete / duplicate / clipboard ----------
  function deleteSelected() {
    if (!state.selectedIds.length) return;
    // Two-stage delete for frames: a filled frame's first Delete empties just
    // the photo (the frame stays, still selected); a second Delete on the now
    // empty frame removes the frame itself. Only applies to a single frame.
    if (state.selectedIds.length === 1) {
      const only = getEl(state.selectedIds[0]);
      if (only && only.type === "frame" && only.src) {
        only.src = null;
        only.imgScale = 1;
        only.imgOffsetX = 0;
        only.imgOffsetY = 0;
        only.imgNaturalW = 0;
        only.imgNaturalH = 0;
        pushHistory();
        fullRender();
        return;
      }
    }
    state.elements = state.elements.filter((e) => !state.selectedIds.includes(e.id));
    state.selectedIds = [];
    pushHistory();
    fullRender();
  }

  function duplicateSelected() {
    if (!state.selectedIds.length) return;
    const copies = selectedElements().map((e) => {
      const c = deep(e);
      c.id = uid(c.type);
      c.x += 20; c.y += 20;
      return c;
    });
    state.elements.push(...copies);
    state.selectedIds = copies.map((c) => c.id);
    pushHistory();
    fullRender();
  }

  function copySelected() {
    state.clipboard = selectedElements().map(deep);
    toast("Copied " + state.clipboard.length + " element(s)");
  }
  function paste() {
    if (!state.clipboard || !state.clipboard.length) return;
    const copies = state.clipboard.map((e) => {
      const c = deep(e);
      c.id = uid(c.type);
      c.x += 20; c.y += 20;
      return c;
    });
    state.elements.push(...copies);
    state.selectedIds = copies.map((c) => c.id);
    pushHistory();
    fullRender();
  }

  // ---------- Layer ordering ----------
  function bringForward() {
    if (state.selectedIds.length !== 1) return;
    const id = state.selectedIds[0];
    const i = state.elements.findIndex((e) => e.id === id);
    if (i < 0 || i === state.elements.length - 1) return;
    [state.elements[i], state.elements[i + 1]] = [state.elements[i + 1], state.elements[i]];
    pushHistory();
    fullRender();
  }
  function sendBack() {
    if (state.selectedIds.length !== 1) return;
    const id = state.selectedIds[0];
    const i = state.elements.findIndex((e) => e.id === id);
    if (i <= 0) return;
    [state.elements[i], state.elements[i - 1]] = [state.elements[i - 1], state.elements[i]];
    pushHistory();
    fullRender();
  }
  function bringToFront() {
    if (state.selectedIds.length !== 1) return;
    const id = state.selectedIds[0];
    const i = state.elements.findIndex((e) => e.id === id);
    if (i < 0) return;
    const [el] = state.elements.splice(i, 1);
    state.elements.push(el);
    pushHistory();
    fullRender();
  }
  function sendToBack() {
    if (state.selectedIds.length !== 1) return;
    const id = state.selectedIds[0];
    const i = state.elements.findIndex((e) => e.id === id);
    if (i < 0) return;
    const [el] = state.elements.splice(i, 1);
    state.elements.unshift(el);
    pushHistory();
    fullRender();
  }

  // ---------- Zoom / pan ----------
  function setZoom(z) {
    state.zoom = clamp(z, 0.1, 4);
    shadowEl.style.transform = "scale(" + state.zoom + ")";
    // The sizer reserves the space the scaled canvas actually occupies. Without
    // it the stage sizes itself to the canvas's unscaled box and the rest of a
    // zoomed-in design sits outside anything you can scroll to.
    const sizer = document.getElementById("ed-canvas-sizer");
    if (sizer) {
      sizer.style.width = Math.round(state.canvas.width * state.zoom) + "px";
      sizer.style.height = Math.round(state.canvas.height * state.zoom) + "px";
    }
    zoomDisplayEl.textContent = Math.round(state.zoom * 100) + "%";
  }
  function fitZoom() {
    const stageRect = stageEl.getBoundingClientRect();
    const pad = 80;
    const zw = (stageRect.width - pad) / state.canvas.width;
    const zh = (stageRect.height - pad) / state.canvas.height;
    setZoom(Math.min(zw, zh, 1));
  }

  stageEl.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(state.zoom + delta);
    }
  }, { passive: false });

  // Space + drag to pan
  let panning = false;
  let spaceDown = false;
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !isTyping(e.target)) { spaceDown = true; stageEl.style.cursor = "grab"; }
  });
  document.addEventListener("keyup", (e) => {
    if (e.code === "Space") { spaceDown = false; stageEl.style.cursor = ""; }
  });
  stageEl.addEventListener("pointerdown", (e) => {
    if (!spaceDown) return;
    panning = true;
    const startX = e.clientX, startY = e.clientY;
    const startL = stageEl.scrollLeft, startT = stageEl.scrollTop;
    function onMove(ev) {
      stageEl.scrollLeft = startL - (ev.clientX - startX);
      stageEl.scrollTop = startT - (ev.clientY - startY);
    }
    function onUp() {
      panning = false;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  });

  // ---------- Save / load ----------
  // Renders a small JPEG preview of the current design (~300px wide,
  // q=0.72) so /account can surface real thumbnails of the user's work.
  // Returns a data URL, or null if rasterization fails.
  async function _renderThumbDataUrl() {
    try {
      const full = await _renderDesignToCanvas({ transparent: false });
      // Render the preview/cover near full design width (was 300px, which looked
      // very low-res blown up on the pack detail page) at high JPEG quality.
      const targetW = 1080;
      const scale = Math.min(1, targetW / full.width);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(full.width * scale));
      c.height = Math.max(1, Math.round(full.height * scale));
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(full, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.9);
    } catch (_) {
      return null;
    }
  }

  // Full-resolution, LOSSLESS render of the active page — a PNG at the design's
  // native canvas size (1080×1440). Text and flat brand colours stay crisp (no
  // JPEG ringing), so the pack catalogue / detail can show the real design at
  // high quality without anyone hand-uploading a preview gallery.
  async function _renderFullPngDataUrl() {
    try {
      const full = await _renderDesignToCanvas({ transparent: false });
      return full.toDataURL("image/png");
    } catch (_) {
      return null;
    }
  }

  // Render both preview assets from a SINGLE rasterization pass (so a save
  // doesn't draw the whole design twice): the lossless full-res PNG (render_url,
  // for the shop) and the lighter 1080 JPEG (thumb_url, for fast admin lists).
  async function _renderPreviewPair() {
    try {
      const full = await _renderDesignToCanvas({ transparent: false });
      const render = full.toDataURL("image/png");
      const targetW = 1080;
      const scale = Math.min(1, targetW / full.width);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(full.width * scale));
      c.height = Math.max(1, Math.round(full.height * scale));
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(full, 0, 0, c.width, c.height);
      const thumb = c.toDataURL("image/jpeg", 0.9);
      return { thumb, render };
    } catch (_) {
      return { thumb: null, render: null };
    }
  }

  async function save() {
    if (!state.templateId) { toast("Open a template to save into"); return false; }
    const { thumb, render } = await _renderPreviewPair();
    const payload = {
      templateId: state.templateId,
      filename: filenameEl.value,
      canvas: state.canvas,
      elements: state.elements,
      pages: deep(state.pages),
      guides: deep(state.guides || []),
      savedAt: Date.now(),
      thumb,
      render,
    };
    // ALWAYS write the local copy first — the dead-man's-lock. Even if the cloud
    // save fails, the design is recoverable from this browser via "Sync local
    // drafts", so a failed Save never means lost work.
    try { localStorage.setItem("tmke.editor." + state.templateId, JSON.stringify(payload)); } catch (_) {}
    // Cloud hook (set by editor.astro when ?mode=admin and signed in) — writes
    // back to the Supabase `templates` table.
    if (typeof window.__TMKE_ADMIN_SAVE__ === "function") {
      setSaveStatus("saving");
      try {
        // The hook returns { ok, reason }. It used to return a bare boolean, so
        // every failure read the same and none of them said what to do.
        const res = await window.__TMKE_ADMIN_SAVE__(payload);
        const ok = res === true || (res && res.ok);
        if (ok) { _dbRetries = 0; setSaveStatus("saved"); toast("Template saved"); return true; }
        const why = (res && res.reason) || "the cloud save was refused";
        setSaveStatus("local");
        // Long enough to read: this is the sentence that says what went wrong.
        toast("Saved on this device. " + why, 7000);
        scheduleAutosave();
        return false;
      } catch (e) {
        setSaveStatus("local");
        toast("Saved on this device. Couldn't reach the server" + (e && e.message ? ": " + e.message : "") + ".", 7000);
        scheduleAutosave();
        return false;
      }
    }
    // No cloud hook (bootstrap not up) — the local copy above is the safety net.
    setSaveStatus("local");
    toast("Saved on this device");
    return true;
  }

  // ---------- Export ----------
  // Internal: rasterize the current design to a fresh offscreen canvas.
  // Shared by exportImage (downloads) and the schedule-to-calendar hook
  // (uploads). Keep this in sync if you add new element types — the Share
  // button (further down) still inlines the same loop and will need
  // updating too. TODO(refactor): collapse the Share button onto this
  // helper as well once we're confident in the shape.
  // Force every font used by a text element to finish loading before we draw to
  // a canvas. Canvas measureText/fillText silently fall back to a wider system
  // font if the real font isn't loaded yet, which makes a one-line title wrap
  // onto two lines in the snapshot (but not in the live DOM editor) — pushing
  // the layout down and ruining the preview/thumbnail.
  async function ensureTextFontsLoaded() {
    if (!document.fonts || !document.fonts.load) return;
    const specs = new Set();
    for (const el of state.elements) {
      if (el.hidden || el.type !== "text") continue;
      const fam = (FONTS.find((f) => f.name === el.font) || FONTS[0]).stack.split(",")[0].trim();
      specs.add((el.italic ? "italic " : "") + (el.weight || 400) + " " + (el.size || 16) + "px " + fam);
    }
    try {
      await Promise.all([...specs].map((s) => document.fonts.load(s).catch(function () {})));
      await document.fonts.ready;
    } catch (_) {}
  }

  async function _renderDesignToCanvas({ transparent = false } = {}) {
    await ensureTextFontsLoaded();
    const c = document.createElement("canvas");
    c.width = state.canvas.width;
    c.height = state.canvas.height;
    const ctx = c.getContext("2d");
    // Skipping the background fill produces a cut-out PNG. JPG and the
    // regular PNG both want a solid background — we always pass
    // transparent=false for those paths.
    if (!transparent) {
      ctx.fillStyle = state.canvas.background || "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
    }

    // Canvas background image (set via right-click → "Set as background")
    if (state.canvas.backgroundImage) {
      try {
        const bg = await loadImage(state.canvas.backgroundImage);
        // Same cover-scale + zoom + pan layout as the live editor (bgLayout).
        const lay = bgLayout(bg.naturalWidth, bg.naturalHeight) || (function () {
          const cw = state.canvas.width, ch = state.canvas.height;
          const ar = bg.naturalWidth / bg.naturalHeight, cr = cw / ch;
          let dw, dh; if (ar > cr) { dh = ch; dw = ch * ar; } else { dw = cw; dh = cw / ar; }
          const px = (state.canvas.bgPosX != null ? state.canvas.bgPosX : 50) / 100;
          const py = (state.canvas.bgPosY != null ? state.canvas.bgPosY : 50) / 100;
          return { sw: dw, sh: dh, ox: (cw - dw) * px, oy: (ch - dh) * py };
        })();
        ctx.save();
        ctx.globalAlpha = state.canvas.backgroundOpacity != null ? state.canvas.backgroundOpacity : 1;
        ctx.drawImage(bg, lay.ox, lay.oy, lay.sw, lay.sh);
        ctx.restore();
      } catch (_) {}
    }

    for (const el of state.elements) {
      if (el.hidden) continue;
      ctx.save();
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((el.rotation || 0) * Math.PI / 180);
      // Honour flipX / flipY on export so the rasterized image matches
      // what the user sees on the canvas.
      if (el.flipX || el.flipY) {
        ctx.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
      }
      ctx.translate(-el.w / 2, -el.h / 2);
      ctx.globalAlpha = el.opacity != null ? el.opacity : 1;

      // Apply shadow for shape/image/frame elements. Canvas's built-in
      // shadowBlur/Offset draws a blurred copy of subsequent fills/strokes,
      // mirroring the DOM filter:drop-shadow look closely enough.
      const sh = el.type !== "text" ? el.shadow : null;
      if (sh && sh.enabled) {
        ctx.shadowColor = hexToRgba(sh.color || "#000000", sh.opacity != null ? sh.opacity : 0.45);
        ctx.shadowBlur = sh.blur || 0;
        ctx.shadowOffsetX = sh.offsetX || 0;
        ctx.shadowOffsetY = sh.offsetY || 0;
      }

      if (el.type === "image") {
        try {
          const img = await loadImage(el.src);
          if (hasPerCorner(el) || el.radius) {
            ctx.save();
            roundedRectPerCorner(ctx, 0, 0, el.w, el.h,
              cornerRadius(el, "tl"), cornerRadius(el, "tr"), cornerRadius(el, "br"), cornerRadius(el, "bl"));
            ctx.clip();
            ctx.drawImage(img, 0, 0, el.w, el.h);
            ctx.restore();
          } else {
            ctx.drawImage(img, 0, 0, el.w, el.h);
          }
        } catch (e) {}
      } else if (el.type === "screen") {
        await drawScreenToCanvas(ctx, el);
      } else if (el.type === "frame") {
        await drawFrameToCanvas(ctx, el);
      } else if (el.type === "rect") {
        ctx.fillStyle = shapeCanvasFill(ctx, el);
        if (hasPerCorner(el)) roundedRectPerCorner(ctx, 0, 0, el.w, el.h,
          cornerRadius(el, "tl"), cornerRadius(el, "tr"), cornerRadius(el, "br"), cornerRadius(el, "bl"));
        else if (el.radius) roundedRect(ctx, 0, 0, el.w, el.h, el.radius);
        else ctx.fillRect(0, 0, el.w, el.h);
        ctx.fill();
        if (el.strokeWidth && el.stroke !== "transparent") {
          ctx.lineWidth = el.strokeWidth;
          ctx.strokeStyle = el.stroke;
          ctx.stroke();
        }
      } else if (el.type === "ellipse") {
        ctx.fillStyle = shapeCanvasFill(ctx, el);
        ctx.beginPath();
        ctx.ellipse(el.w / 2, el.h / 2, el.w / 2, el.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (el.type === "triangle") {
        ctx.fillStyle = shapeCanvasFill(ctx, el);
        ctx.beginPath();
        ctx.moveTo(el.w / 2, 0);
        ctx.lineTo(el.w, el.h);
        ctx.lineTo(0, el.h);
        ctx.closePath();
        ctx.fill();
      } else if (el.type === "star") {
        ctx.fillStyle = el.fill;
        drawStar(ctx, el.w, el.h);
      } else if (el.type === "line") {
        ctx.fillStyle = el.fill;
        ctx.fillRect(0, 0, el.w, el.h);
      } else if (el.type === "text") {
        drawTextElementToCanvas(ctx, el);
      }

      ctx.restore();
    }

    return c;
  }

  // Helper: paint a text element to the canvas, honouring gradient fill,
  // text shadow, outline and the simple block background. Used by the export
  // pipeline so PNG/JPG output matches what the editor renders on screen.
  // Canvas font string for a run, honouring the element base + the run override.
  function runFont(el, fmt) {
    const stack = (FONTS.find((f) => f.name === el.font) || FONTS[0]).stack;
    const weight = fmt.bold ? 700 : (el.weight || 400);
    const italic = (fmt.italic || el.italic) ? "italic " : "";
    return italic + weight + " " + el.size + "px " + stack;
  }
  // Word-wrap runs into lines, each line an array of {text, fmt, w} tokens
  // (spaces kept as their own tokens). Newlines inside runs force a break.
  function richWrapLines(ctx, el, runs, maxWidth) {
    const lines = [];
    let line = [], lineW = 0;
    function flush() { lines.push(line); line = []; lineW = 0; }
    runs.forEach(function (r) {
      const parts = r.text.split(/(\n| )/); // keep delimiters as tokens
      parts.forEach(function (p) {
        if (p === "") return;
        if (p === "\n") { flush(); return; }
        ctx.font = runFont(el, r);
        const w = ctx.measureText(p).width;
        if (p === " ") { if (line.length) { line.push({ text: " ", fmt: r, w: w }); lineW += w; } return; }
        if (lineW + w > maxWidth && line.length) {
          while (line.length && line[line.length - 1].text === " ") { lineW -= line[line.length - 1].w; line.pop(); }
          flush();
        }
        line.push({ text: p, fmt: r, w: w }); lineW += w;
      });
    });
    flush();
    return lines;
  }
  // Draw wrapped rich lines: per-token font, plus a manual underline stroke
  // (canvas fonts can't express underline). `paint` is solid colour or gradient.
  function drawRichLines(ctx, el, lines, lh, paint) {
    let yy = 0;
    lines.forEach(function (toks) {
      let tw = 0; for (const t of toks) tw += t.w;
      let x = 0;
      if (el.align === "center") x = (el.w - tw) / 2;
      else if (el.align === "right") x = el.w - tw;
      ctx.textAlign = "left";
      for (const t of toks) {
        ctx.font = runFont(el, t.fmt);
        ctx.fillStyle = paint;
        ctx.fillText(t.text, x, yy);
        if (t.fmt.underline || el.underline) {
          const uy = yy + el.size * 1.02;
          ctx.save();
          ctx.strokeStyle = paint;
          ctx.lineWidth = Math.max(1, el.size / 16);
          ctx.beginPath(); ctx.moveTo(x, uy); ctx.lineTo(x + t.w, uy); ctx.stroke();
          ctx.restore();
        }
        x += t.w;
      }
      yy += lh;
    });
  }

  function drawTextElementToCanvas(ctx, el) {
    const font = (FONTS.find((f) => f.name === el.font) || FONTS[0]).stack;
    ctx.font = (el.italic ? "italic " : "") + el.weight + " " + el.size + "px " + font;
    // Match the editor's letter-spacing in BOTH the wrap measurement and the
    // draw. Without this the canvas packs text tighter than the live design
    // ("forced inwards"), and the narrower measure also changes where lines
    // wrap — so titles render cramped or on the wrong number of lines.
    try { ctx.letterSpacing = ((Number(el.letterSpacing) || 0)) + "px"; } catch (_) {}
    ctx.textBaseline = "top";
    // Canvas has no "justify" — fall back to left for the static snapshot.
    ctx.textAlign = el.align === "justify" ? "left" : el.align;
    const lh = el.size * (el.lineHeight || 1.3);
    const lines = wrapText(ctx, el.text || "", el.w);

    // Background pill — drawn first so the text sits on top. We measure each
    // line independently so per-line backgrounds approximate Canva's
    // box-decoration-break: clone look.
    if (el.textBg && el.textBg.enabled) {
      const padX = el.textBg.padX != null ? el.textBg.padX : 12;
      const padY = el.textBg.padY != null ? el.textBg.padY : 6;
      const radius = el.textBg.radius || 0;
      ctx.save();
      ctx.fillStyle = el.textBg.color || "#FFE066";
      let yy = 0;
      for (const ln of lines) {
        const tw = ctx.measureText(ln).width;
        let lx = 0;
        if (el.align === "center") lx = (el.w - tw) / 2;
        else if (el.align === "right") lx = el.w - tw;
        roundedRect(ctx, lx - padX, yy - padY, tw + padX * 2, lh + padY * 2, radius);
        ctx.fill();
        yy += lh;
      }
      ctx.restore();
    }

    // Build the fill style — solid colour or a (multi-stop) gradient.
    let fillStyle = el.color;
    const g = el.textGradient;
    if (g && g.enabled) {
      fillStyle = canvasGrad(ctx, g, el.w, el.h);
    }

    // Text shadow — applied via the same canvas shadow API. Set before draws.
    if (el.textShadow && el.textShadow.enabled) {
      ctx.shadowColor = hexToRgba(el.textShadow.color || "#000000",
        el.textShadow.opacity != null ? el.textShadow.opacity : 0.45);
      ctx.shadowBlur = el.textShadow.blur || 0;
      ctx.shadowOffsetX = el.textShadow.offsetX || 0;
      ctx.shadowOffsetY = el.textShadow.offsetY || 0;
    }

    // Rich (mixed-format) text: wrap + draw token-by-token, then we're done.
    // Outline is stroked per token under the fill; shadow (set above) carries.
    if (hasRuns(el)) {
      const rlines = richWrapLines(ctx, el, el.runs, el.w);
      if (el.textOutline && el.textOutline.width > 0) {
        ctx.save();
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
        ctx.lineWidth = el.textOutline.width * 2;
        ctx.strokeStyle = el.textOutline.color || "#1c1d22";
        ctx.lineJoin = "round";
        let oy = 0;
        rlines.forEach(function (toks) {
          let tw = 0; for (const t of toks) tw += t.w;
          let x = 0;
          if (el.align === "center") x = (el.w - tw) / 2; else if (el.align === "right") x = el.w - tw;
          for (const t of toks) { ctx.font = runFont(el, t.fmt); ctx.strokeText(t.text, x, oy); x += t.w; }
          oy += lh;
        });
        ctx.restore();
      }
      drawRichLines(ctx, el, rlines, lh, fillStyle);
      return;
    }

    let yy = 0;
    let tx = 0;
    if (el.align === "center") tx = el.w / 2;
    else if (el.align === "right") tx = el.w;

    // Outline — drawn under the fill (matches CSS paint-order: stroke fill).
    if (el.textOutline && el.textOutline.width > 0) {
      ctx.save();
      // Drawing a stroke also picks up shadow — usually we want the shadow on
      // the visible paint, so clear it before the stroke pass and re-apply
      // for the fill below.
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.lineWidth = el.textOutline.width * 2; // half outside, half inside → outside-only feel
      ctx.strokeStyle = el.textOutline.color || "#1c1d22";
      ctx.lineJoin = "round";
      let oy = 0;
      for (const ln of lines) { ctx.strokeText(ln, tx, oy); oy += lh; }
      ctx.restore();
    }

    ctx.fillStyle = fillStyle;
    for (const ln of lines) { ctx.fillText(ln, tx, yy); yy += lh; }
  }

  // type can be: "png" | "jpg" | "png-transparent" | "pdf"
  async function exportImage(type) {
    const c = await _renderDesignToCanvas({ transparent: type === "png-transparent" });

    if (type === "pdf") {
      await exportToPdf(c);
      return;
    }

    const mime = type === "jpg" ? "image/jpeg" : "image/png";
    const ext = type === "png-transparent" ? "png" : type;
    const url = c.toDataURL(mime, 0.95);
    const a = document.createElement("a");
    a.href = url;
    a.download = (filenameEl.value || "design") + "." + ext;
    a.click();
    toast("Exported " + ext.toUpperCase() + (type === "png-transparent" ? " (transparent)" : ""));
  }

  // Lazy-loaded so the jsPDF library only downloads when the user actually
  // exports a PDF. Loaded from CDN (editor.js is a public/ asset, not
  // bundled by Vite, so we can't use a bare specifier).
  let _jspdfModule = null;
  async function getJsPdf() {
    if (_jspdfModule) return _jspdfModule;
    _jspdfModule = await import(
      /* @vite-ignore */
      "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm"
    );
    return _jspdfModule;
  }

  async function exportToPdf(canvas) {
    toast("Building PDF…");
    try {
      const mod = await getJsPdf();
      const jsPDF = mod.jsPDF || mod.default;
      const w = canvas.width, h = canvas.height;
      // Pixels at 72 DPI translate roughly 1:1 to PDF points, so this preserves
      // the on-screen aspect ratio without surprising the user with margins.
      const pdf = new jsPDF({
        orientation: w >= h ? "landscape" : "portrait",
        unit: "px",
        format: [w, h],
        hotfixes: ["px_scaling"],
      });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(dataUrl, "JPEG", 0, 0, w, h);
      pdf.save((filenameEl.value || "design") + ".pdf");
      toast("Exported PDF");
    } catch (err) {
      console.error("[pdf-export]", err);
      toast("PDF export failed", 3500);
    }
  }

  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  }

  // Full-screen "processing image…" overlay shown while an upload is read +
  // downscaled, so a big photo doesn't feel like a frozen click.
  let _spinCount = 0;
  function uploadSpinner(show) {
    let el = document.getElementById("ed-upload-spinner");
    if (show) {
      _spinCount++;
      if (!el) {
        el = document.createElement("div");
        el.id = "ed-upload-spinner";
        el.innerHTML = '<div class="ed-spin-box"><div class="ed-spin"></div><div class="ed-spin-label">Processing image…</div></div>';
        document.body.appendChild(el);
      }
      el.style.display = "flex";
    } else {
      _spinCount = Math.max(0, _spinCount - 1);
      if (el && _spinCount === 0) el.style.display = "none";
    }
  }

  // Read an uploaded image File and downscale it to a sane max edge before use.
  // Phone/camera photos are often 3000–6000px / 3–8MB; loading those full-size is
  // the main reason a design's photos take several seconds to appear (and they
  // bloat the saved row). 2000px is plenty for a 1080-wide canvas + crisp export.
  // PNGs keep transparency; everything else becomes JPEG. Returns a data URL.
  function fileToWebImage(file, maxEdge) {
    maxEdge = maxEdge || 2000;
    uploadSpinner(true);
    return new Promise((resolve) => {
      const done = (v) => { uploadSpinner(false); resolve(v); };
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result;
        const img = new Image();
        img.onload = () => {
          const longest = Math.max(img.naturalWidth, img.naturalHeight);
          const scale = longest > maxEdge ? maxEdge / longest : 1;
          if (scale >= 1) { done(src); return; } // already web-sized
          try {
            const c = document.createElement("canvas");
            c.width = Math.max(1, Math.round(img.naturalWidth * scale));
            c.height = Math.max(1, Math.round(img.naturalHeight * scale));
            const ctx = c.getContext("2d");
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, c.width, c.height);
            const png = /image\/png/i.test(file.type || "");
            done(png ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.85));
          } catch (_) { done(src); }
        };
        img.onerror = () => done(src);
        img.src = src;
      };
      reader.onerror = () => done(null);
      reader.readAsDataURL(file);
    });
  }

  function wrapText(ctx, text, maxWidth) {
    const paragraphs = text.split("\n");
    const lines = [];
    for (const p of paragraphs) {
      const words = p.split(" ");
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = w;
        } else line = test;
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  function roundedRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Rounded rect with independent corner radii (tl, tr, br, bl). Each is
  // clamped to half the shorter side so corners never overlap.
  function roundedRectPerCorner(ctx, x, y, w, h, tl, tr, br, bl) {
    const m = Math.min(w, h) / 2;
    tl = Math.min(tl, m); tr = Math.min(tr, m); br = Math.min(br, m); bl = Math.min(bl, m);
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.arcTo(x + w, y, x + w, y + tr, tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    ctx.lineTo(x + bl, y + h);
    ctx.arcTo(x, y + h, x, y + h - bl, bl);
    ctx.lineTo(x, y + tl);
    ctx.arcTo(x, y, x + tl, y, tl);
    ctx.closePath();
  }

  function drawStar(ctx, w, h) {
    const pts = [[50,0],[61,35],[98,35],[68,57],[79,91],[50,70],[21,91],[32,57],[2,35],[39,35]];
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = p[0] / 100 * w; const y = p[1] / 100 * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }

  // Build a Path2D matching a frame's silhouette. Mirrors the CSS clip-paths
  // / border-radii used in the live DOM render so what you see is what
  // exports. ctx is positioned at (0,0)-(w,h) for the frame.
  function pathForFrame(ctx, el) {
    const w = el.w, h = el.h;
    const shape = el.frameShape || "square";
    ctx.beginPath();
    if (shape === "circle") {
      ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    } else if (shape === "rounded") {
      const r = Math.min(24, w / 2, h / 2);
      ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r);
      ctx.lineTo(w, h - r); ctx.quadraticCurveTo(w, h, w - r, h);
      ctx.lineTo(r, h); ctx.quadraticCurveTo(0, h, 0, h - r);
      ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
    } else if (shape === "arch") {
      // Big arch on top corners (use width as radius), small bottom radius
      const topR = Math.min(w / 2, h * 0.75);
      const botR = Math.min(12, w / 2, h / 2);
      ctx.moveTo(0, topR);
      // Top arch sweeps from (0,topR) up over to (w,topR)
      ctx.bezierCurveTo(0, 0, w, 0, w, topR);
      ctx.lineTo(w, h - botR);
      ctx.quadraticCurveTo(w, h, w - botR, h);
      ctx.lineTo(botR, h);
      ctx.quadraticCurveTo(0, h, 0, h - botR);
      ctx.closePath();
    } else if (shape === "diamond") {
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w, h / 2);
      ctx.lineTo(w / 2, h);
      ctx.lineTo(0, h / 2);
      ctx.closePath();
    } else {
      // square / portrait / landscape / wide — rect, honouring corner radius
      // (uniform el.radius or per-corner el.radii) so exports match the canvas.
      if (hasPerCorner(el) || el.radius) {
        roundedRectPerCorner(ctx, 0, 0, w, h,
          cornerRadius(el, "tl"), cornerRadius(el, "tr"), cornerRadius(el, "br"), cornerRadius(el, "bl"));
      } else {
        ctx.rect(0, 0, w, h);
      }
    }
  }

  // Draw a frame element (clipped image, or empty placeholder) into a 2D
  // canvas context. Caller is responsible for the surrounding ctx.save()/
  // translate/rotate/restore.
  /* ---------- Screen: perspective on a canvas that has no perspective ----------
     Canvas 2D transforms are affine - six numbers, so translate, rotate, scale
     and skew, and nothing that can make parallel lines converge. Handing it the
     matrix the browser uses for the live preview would export a parallelogram.

     So the quad is cut into a grid of triangles and each one is drawn with its
     own affine transform. Three points can always be mapped exactly by an
     affine matrix; enough small triangles and the error inside each is smaller
     than a pixel. This is how every 2D engine fakes a texture-mapped quad.

     The triangles are expanded a hair before clipping - adjacent edges are
     antialiased against nothing, and without the overlap the seams show as a
     faint grid over the artwork. */
  function drawTexturedTriangle(ctx, img, s0, s1, s2, d0, d1, d2) {
    const den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
    if (!den) return;
    const m11 = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den;
    const m12 = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den;
    const m21 = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den;
    const m22 = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den;
    const dx = d0.x - m11 * s0.x - m12 * s0.y;
    const dy = d0.y - m21 * s0.x - m22 * s0.y;

    ctx.save();
    const cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3;
    const grow = (p) => {
      const vx = p.x - cx, vy = p.y - cy;
      const len = Math.hypot(vx, vy) || 1;
      return { x: p.x + (vx / len) * 0.5, y: p.y + (vy / len) * 0.5 };
    };
    const g0 = grow(d0), g1 = grow(d1), g2 = grow(d2);
    ctx.beginPath();
    ctx.moveTo(g0.x, g0.y); ctx.lineTo(g1.x, g1.y); ctx.lineTo(g2.x, g2.y);
    ctx.closePath();
    ctx.clip();
    ctx.transform(m11, m21, m12, m22, dx, dy);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  async function drawScreenToCanvas(ctx, el) {
    // The fill goes down first, whether or not there is artwork on top of it -
    // it is the surface itself, and on a Fit-ed design it is most of what you
    // see at the edges.
    if (el.bgFill) {
      const q0 = screenCorners(el).map((c) => ({ x: c.x * el.w, y: c.y * el.h }));
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(q0[0].x, q0[0].y);
      for (let k = 1; k < 4; k++) ctx.lineTo(q0[k].x, q0[k].y);
      ctx.closePath();
      ctx.fillStyle = el.bgFill;
      ctx.fill();
      ctx.restore();
    }
    if (!el.src) return;
    let img;
    try { img = await loadImage(el.src); } catch (_) { return; }
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) return;

    // Corners in the element's own space; the caller has already translated
    // the context to the element's top-left.
    const m = screenHomography(screenCorners(el).map((c) => ({ x: c.x * el.w, y: c.y * el.h })));
    if (!m) return;

    /* The mesh walks the plane, so each vertex has to be taken back to a pixel
       in the artwork - the opposite direction to the live preview, which walks
       the artwork forward. That is the inverse of the same affine transform,
       and inverting it once here beats solving it per vertex. */
    const t = screenImageAffine(el);
    const det = t.a * t.e - t.b * t.d;
    if (!det) return;
    const ia = t.e / det, ib = -t.b / det, id = -t.d / det, ie = t.a / det;
    const ic = -(ia * t.c + ib * t.f), iff = -(id * t.c + ie * t.f);
    // Plane point -> source pixel in the artwork's own coordinates.
    const toSrc = (px, py) => {
      const x = ia * px + ib * py + ic;      // centred on the artwork
      const y = id * px + ie * py + iff;
      return { x: (x + t.baseW / 2) * (iw / t.baseW), y: (y + t.baseH / 2) * (ih / t.baseH) };
    };

    // Enough subdivision that a straight edge stays straight at print sizes,
    // cheap enough that export does not stall on it.
    const N = 24;
    ctx.save();
    // The artwork may now be rotated or zoomed inside the plane, so it can
    // reach past the quad. The quad is the window; clip to it.
    const q = screenCorners(el).map((c) => ({ x: c.x * el.w, y: c.y * el.h }));
    ctx.beginPath();
    ctx.moveTo(q[0].x, q[0].y);
    for (let k = 1; k < 4; k++) ctx.lineTo(q[k].x, q[k].y);
    ctx.closePath();
    ctx.clip();
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const u0 = i / N, u1 = (i + 1) / N, v0 = j / N, v1 = (j + 1) / N;
        const pA = { x: u0 * el.w, y: v0 * el.h }, pB = { x: u1 * el.w, y: v0 * el.h };
        const pC = { x: u1 * el.w, y: v1 * el.h }, pD = { x: u0 * el.w, y: v1 * el.h };
        const sA = toSrc(pA.x, pA.y), sB = toSrc(pB.x, pB.y);
        const sC = toSrc(pC.x, pC.y), sD = toSrc(pD.x, pD.y);
        const dA = screenProject(m, u0, v0), dB = screenProject(m, u1, v0);
        const dC = screenProject(m, u1, v1), dD = screenProject(m, u0, v1);
        drawTexturedTriangle(ctx, img, sA, sB, sC, dA, dB, dC);
        drawTexturedTriangle(ctx, img, sA, sC, sD, dA, dC, dD);
      }
    }
    ctx.restore();
  }

  async function drawFrameToCanvas(ctx, el) {
    ctx.save();
    pathForFrame(ctx, el);
    ctx.clip();
    if (el.src) {
      try {
        const img = await loadImage(el.src);
        // Re-compute fit using freshly-known natural dims (safer than relying
        // on el.imgNaturalW which may not be populated for older templates).
        const elClone = Object.assign({}, el, {
          imgNaturalW: img.naturalWidth, imgNaturalH: img.naturalHeight,
        });
        const fit = frameCoverFit(elClone);
        const s = el.imgScale || 1;
        const tx = el.imgOffsetX || 0;
        const ty = el.imgOffsetY || 0;
        // Centre origin transform: translate to frame centre, then user offset,
        // then scale, then draw the cover-sized image at its centre.
        ctx.translate(el.w / 2 + tx, el.h / 2 + ty);
        ctx.scale(s, s);
        ctx.drawImage(img, -fit.baseW / 2, -fit.baseH / 2, fit.baseW, fit.baseH);
      } catch (_) {}
    } else {
      // Empty frame — paint a soft striped placeholder so the silhouette
      // is at least visible if someone exports without filling it.
      ctx.fillStyle = "rgba(71,66,84,0.12)";
      ctx.fillRect(0, 0, el.w, el.h);
    }
    ctx.restore();
    // Border (drawn after the clip is released so the stroke isn't clipped to
    // half-width). The path is centred on the silhouette edge, matching the DOM.
    if (el.frameBorderWidth) {
      ctx.save();
      pathForFrame(ctx, el);
      ctx.lineWidth = el.frameBorderWidth * 2; // half is clipped away by the path
      ctx.strokeStyle = el.frameBorder || "#1c1d22";
      ctx.clip();
      ctx.stroke();
      ctx.restore();
    }
  }

  // Shared binder for any DOM subtree that contains [data-prop] inputs.
  // Used by both the right panel (renderProps) and the top-bar Position
  // popover so the wiring behaviour is identical wherever the input lives.
  /* Width and Height as a linked pair. Not part of bindGenericPropInputs
     because that sets one property per input, and here changing one has to
     move the other. The ratio is read off the element BEFORE the edit is
     applied, so repeated nudges don't compound rounding into a drift. */
  function bindRatioPair(root) {
    const wIn = root.querySelector("#ed-pos-w");
    const hIn = root.querySelector("#ed-pos-h");
    const btn = root.querySelector("#ed-pos-lock");
    if (!wIn || !hIn || !btn) return;

    function apply(which) {
      const tgt = getEl(state.selectedIds[0]);
      if (!tgt) return;
      const ratio = (tgt.w > 0 && tgt.h > 0) ? tgt.w / tgt.h : 1;
      const v = parseFloat(which === "w" ? wIn.value : hIn.value);
      if (!isFinite(v) || v <= 0) return;
      if (which === "w") {
        tgt.w = Math.round(v);
        if (ratioLocked) { tgt.h = Math.max(1, Math.round(tgt.w / ratio)); hIn.value = tgt.h; }
      } else {
        tgt.h = Math.round(v);
        if (ratioLocked) { tgt.w = Math.max(1, Math.round(tgt.h * ratio)); wIn.value = tgt.w; }
      }
      fullRender();
      pushHistory();
    }
    wIn.addEventListener("change", function () { apply("w"); });
    hIn.addEventListener("change", function () { apply("h"); });

    btn.addEventListener("click", function () {
      ratioLocked = !ratioLocked;
      btn.classList.toggle("is-on", ratioLocked);
      btn.setAttribute("aria-pressed", ratioLocked ? "true" : "false");
      btn.innerHTML = ratioLocked ? LOCK_SHUT : LOCK_OPEN;
      btn.title = ratioLocked ? "Ratio locked — click to unlock" : "Lock the ratio";
      toast(ratioLocked ? "Ratio locked" : "Ratio unlocked");
    });
  }

  function bindGenericPropInputs(root) {
    root.querySelectorAll("[data-prop]").forEach(function (input) {
      const prop = input.dataset.prop;
      const ev = (input.type === "range" || input.type === "color") ? "input" : "change";
      input.addEventListener(ev, function () {
        const tgt = getEl(state.selectedIds[0]);
        if (!tgt) return;
        const val = (input.type === "number" || input.type === "range")
          ? parseFloat(input.value)
          : input.value;
        tgt[prop] = val;
        // SVG shapes/icons: recompute the data-URI src whenever the colour
        // changes so the visual updates in lockstep with the picker.
        if (prop === "svgFill" && tgt.svgKey) {
          tgt.src = svgKeyToDataUri(tgt.svgKey, val);
        }
        fullRender();
        if (input.type !== "range") pushHistory();
      });
      if (input.type === "range") {
        input.addEventListener("change", function () { pushHistory(); });
      }
    });
  }

  // ---------- Property panel ----------
  // Targets `#ed-selection-body` inside the left "Selection" pane (the right
  // properties panel was removed in favour of a unified left rail). On
  // selection change this either populates the pane and switches to it, or
  // empties it and switches back to the user's last-active tool tab.
  // The selected element's controls live in one node. When you are working in
  // the Text pane on a text box, that node is moved into the Text selection
  // tab so choosing which box to style and styling it are the same place;
  // otherwise it goes home to the Selection pane. Moving it rather than
  // duplicating it means there is only ever one set of live controls.
  function placeSelectionBody() {
    const body = document.getElementById("ed-selection-body");
    if (!body) return null;
    const host = document.getElementById("ed-text-selhost");
    const home = document.querySelector('.ed-panel-pane[data-pane="selection"]');
    const el = state.selectedIds.length === 1 ? getEl(state.selectedIds[0]) : null;
    const wantText = host && activeToolPane === "text" && el && el.type === "text";
    const target = wantText ? host : home;
    if (target && body.parentNode !== target) target.appendChild(body);
    const listHead = document.getElementById("ed-textlist-head");
    if (listHead) listHead.hidden = !wantText;
    return body;
  }

  function renderProps() {
    const body = placeSelectionBody();
    if (!body) return;

    // A selected guide takes over the Selection pane (no element is selected
    // at the same time).
    if (state.selectedGuideId && state.selectedIds.length === 0) {
      if (typeof showPane === "function") showPane("selection");
      renderGuideProps(body);
      return;
    }

    if (state.selectedIds.length !== 1) {
      closeColorPanel();
      if (state.selectedIds.length > 1) {
        // Multi-select: show the group's bounding-box X/Y (editable — moves the
        // whole group) and its overall W/H (read-only). Previously the inspector
        // showed nothing but the count, so you lost the position readout.
        const gels = selectedElements();
        const minX = Math.min.apply(null, gels.map(function (e) { return e.x; }));
        const minY = Math.min.apply(null, gels.map(function (e) { return e.y; }));
        const maxX = Math.max.apply(null, gels.map(function (e) { return e.x + e.w; }));
        const maxY = Math.max.apply(null, gels.map(function (e) { return e.y + e.h; }));
        body.innerHTML =
          '<p class="ed-selection-empty">' + gels.length + ' elements selected.</p>' +
          '<div class="ed-props-section"><h4>Position &amp; size</h4>' +
            '<div class="ed-props-field-row" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
              '<div class="ed-props-field"><label>X</label><input type="number" id="ed-grp-x" value="' + Math.round(minX) + '"></div>' +
              '<div class="ed-props-field"><label>Y</label><input type="number" id="ed-grp-y" value="' + Math.round(minY) + '"></div>' +
            '</div>' +
            '<div class="ed-props-field-row" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
              '<div class="ed-props-field"><label>Width</label><input type="number" value="' + Math.round(maxX - minX) + '" disabled></div>' +
              '<div class="ed-props-field"><label>Height</label><input type="number" value="' + Math.round(maxY - minY) + '" disabled></div>' +
            '</div>' +
          '</div>' +
          // Align to page. The context bar is single-selection only, so without
          // this a group had no way to reach it but the right-click menu.
          '<div class="ed-props-section"><h4>Align to page</h4>' +
            '<div class="ed-grp-align">' +
              '<button type="button" data-galign="left" title="Left">' + ALIGN_ICONS.left + '</button>' +
              '<button type="button" data-galign="centerX" title="Centre horizontally">' + ALIGN_ICONS.centerX + '</button>' +
              '<button type="button" data-galign="right" title="Right">' + ALIGN_ICONS.right + '</button>' +
              '<button type="button" data-galign="top" title="Top">' + ALIGN_ICONS.top + '</button>' +
              '<button type="button" data-galign="centerY" title="Centre vertically">' + ALIGN_ICONS.centerY + '</button>' +
              '<button type="button" data-galign="bottom" title="Bottom">' + ALIGN_ICONS.bottom + '</button>' +
            '</div>' +
          '</div>';
        if (typeof showPane === "function") showPane("selection");
        body.querySelectorAll("[data-galign]").forEach(function (b) {
          b.addEventListener("click", function () { alignSelected(b.getAttribute("data-galign")); });
        });
        const gx = body.querySelector("#ed-grp-x"), gy = body.querySelector("#ed-grp-y");
        const moveGroup = function () {
          const nx = parseFloat(gx.value), ny = parseFloat(gy.value);
          const ddx = isFinite(nx) ? Math.round(nx) - Math.round(minX) : 0;
          const ddy = isFinite(ny) ? Math.round(ny) - Math.round(minY) : 0;
          if (!ddx && !ddy) return;
          gels.forEach(function (e) { e.x = Math.round(e.x + ddx); e.y = Math.round(e.y + ddy); });
          fullRender(); pushHistory();
        };
        if (gx) gx.addEventListener("change", moveGroup);
        if (gy) gy.addEventListener("change", moveGroup);
      } else {
        body.innerHTML = '';
        // Nothing selected — go back to whatever tool tab the rail is on.
        if (typeof showPane === "function" && typeof activeToolPane === "string") {
          showPane(activeToolPane);
        }
      }
      return;
    }

    const el = getEl(state.selectedIds[0]);
    if (!el) return;

    // Selected element — surface its controls and switch to Selection pane.
    // Exception: if you are already working in the Text pane and you pick
    // another text box, stay there. Moving between text boxes to restyle them
    // is the whole point of that pane, and being thrown back to the generic
    // Selection pane on every click made it unusable for the job — the same
    // fault the colour panel had. Any other element type still switches, since
    // the Text pane has nothing to say about a photo.
    // Text always goes to the Text pane, not just when you were already in it.
    // Its controls now live in that pane's first tab, so sending a text box to
    // the generic Selection pane would show the same controls in the poorer of
    // the two places — without the list of the page's other text, the fonts,
    // or the tabs. Everything else still uses the Selection pane.
    /* Only follow the selection when the selection actually changed.
       renderProps runs on every fullRender, and this used to switch the panel
       every single time — so recolouring from "Make this design yours", or any
       other panel action that redraws, threw you out of the pane you were
       working in and onto Selection. Now picking a colour keeps you where you
       are, and the panel still follows when you genuinely select something
       else. */
    const selSig = state.selectedIds.join(",");
    const selectionChanged = selSig !== _lastSelSig || _paneFollowClick;
    _lastSelSig = selSig;
    _paneFollowClick = false;

    const useTextPane = el.type === "text";
    if (!selectionChanged) {
      // Same element as last time: refresh its controls, leave the panel alone.
      if (useTextPane && activeToolPane === "text") { renderTextList(); renderFontBrowser(); }
    } else if (useTextPane) {
      if (activeToolPane !== "text") {
        activeToolPane = "text";
        document.querySelectorAll(".ed-rail-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.tool === "text"));
        showPane("text");
        // Land on Text selection — where the controls are — rather than
        // whichever tab was last open.
        setTextTab("page");
        placeSelectionBody();
      }
      renderTextList(); renderFontBrowser();
    } else if (typeof showPane === "function") {
      showPane("selection");
    }

    // Position & size, font/type and the effects panel used to render
    // here as always-visible sections. They now live as popovers on the
    // top context bar so the rail isn't dominated by controls the user
    // only reaches for occasionally. Right-panel sections from here on
    // are the per-type controls that benefit from being visible: fill /
    // stroke, image actions, frame controls, arrange, etc.

    const html = [];

    /* A filled logo slot keeps knowing it is a logo, so it can still offer the
       rest of the brand kit. A light mark works most of the time and then
       lands on a pale photo — this is the swap, without going near the brand
       kit or resizing anything by hand. Each choice is re-fitted and re-seated
       by the same code that placed the first one. */
    if (el.brandRole === "logo" && el.type === "image") {
      const kit = (BRAND && Array.isArray(BRAND.logos)) ? BRAND.logos.filter(function (l) { return l && l.src; }) : [];
      if (kit.length > 1) {
        html.push('<div class="ed-props-section"><h4>Brand logo</h4><div class="ed-logopick">' +
          kit.map(function (l, i) {
            const on = l.src === el.src ? " is-on" : "";
            const label = l.name || (l.primary ? "Main logo" : "Logo " + (i + 1));
            return '<button type="button" class="ed-logopick-b' + on + '" data-logopick="' + i + '" title="' + escapeHtml(label) + '">' +
              '<img src="' + escapeHtml(l.src) + '" alt="' + escapeHtml(label) + '">' +
            '</button>';
          }).join('') +
        '</div><p class="ed-props-hint">Kept to ' + LOGO_MAX_W + ' \u00d7 ' + LOGO_MAX_H + ', its own shape, back on the line.</p></div>');
      } else if (kit.length === 1) {
        html.push('<div class="ed-props-section"><h4>Brand logo</h4>' +
          '<p class="ed-props-hint">Only one logo in your brand kit. ' +
          '<a href="/account/profile" style="color:var(--english-violet)">Add another</a> to switch between them here.</p></div>');
      }
    }

    if (el.type === "rect" || el.type === "ellipse" || el.type === "triangle" || el.type === "star" || el.type === "line") {
      // Same rich panel the swatch on the toolbar opens — Stroke below has
      // always used it, so a native colour box here meant two different
      // pickers for the same job in one panel.
      html.push(`<div class="ed-props-section"><h4>Fill</h4>
        <div class="ed-props-field" style="flex-direction:row;align-items:center;gap:8px"><span data-mount="fill-color"></span><label style="margin:0">Colour</label></div>
      </div>`);
      if (el.type === "rect") {
        html.push(cornerRadiusSectionHtml());
      }
      if (el.type === "line") {
        // A line's thickness IS its element height; the old "Stroke width"
        // never rendered. Give it a real Weight control instead (1 = thinnest).
        html.push(`<div class="ed-props-section"><h4>Weight</h4>
          <div data-mount="line-weight"></div>
        </div>`);
      } else {
        html.push(`<div class="ed-props-section"><h4>Stroke</h4>
          <div class="ed-props-row">
            <div class="ed-props-field" style="flex-direction:row;align-items:center;gap:8px"><span data-mount="stroke-color"></span><label style="margin:0">Colour</label></div>
            <div class="ed-props-field"><label>Width</label><input type="number" min="0" max="40" data-prop="strokeWidth" value="${el.strokeWidth||0}"></div>
          </div>
        </div>`);
      }
    }

    if (el.type === "image") {
      // SVG shapes/icons (added via the More-shapes / Social-icons
      // grids) are recolourable — their `svgKey` references SVG_SHAPES
      // and `svgFill` records the current colour. Raster images don't
      // get this picker because we'd have nothing meaningful to recolour.
      if (el.svgKey) {
        html.push(`<div class="ed-props-section"><h4>Colour</h4>
          <div class="ed-props-field" style="flex-direction:row;align-items:center;gap:8px"><span data-mount="svg-fill"></span><label style="margin:0">Colour</label></div>
        </div>`);
      }
      html.push(`<div class="ed-props-section"><h4>Image</h4>
        <button class="ed-btn-ghost" id="ed-replace-img" style="background:rgba(28,29,34,0.06); width:100%">Replace image</button>
      </div>`);
      html.push(cornerRadiusSectionHtml());
    }

    if (el.type === "screen") {
      const zoom = Math.round((el.imgScale != null ? el.imgScale : 1) * 100);
      const rot = Math.round(el.imgRotation || 0);
      // Six, not a picker. The guide only has to stand out from the photo
      // underneath it, and picking a colour from a spectrum to solve "I can't
      // see it against black" is more work than the problem deserves.
      html.push(
          '<div class="ed-props-section"><h4>Guide</h4>' +
            '<div class="ed-props-field"><label>Colour <span class="ed-props-hint">shown while you position it, never exported</span></label>' +
              '<div class="ed-sc-swatches">' +
                SCREEN_GUIDE_COLOURS.map(function (c) {
                  const on = (el.guide || "#00c2a8").toLowerCase() === c.hex.toLowerCase();
                  return '<button type="button" class="ed-sc-sw' + (on ? " is-on" : "") + '" data-guide="' + c.hex + '"' +
                         ' style="background:' + c.hex + '" title="' + c.name + '"></button>';
                }).join("") +
              '</div></div>' +
            '<label class="ed-sc-hide"><input type="checkbox" id="ed-sc-hide"' + (screenGuideHidden ? " checked" : "") + '>' +
              '<span>Hide the guide <span class="ed-props-hint">so you can see — and sample — the photo underneath</span></span></label>' +
            '<button class="ed-btn-ghost" id="ed-sc-reset" style="background:rgba(28,29,34,0.06);width:100%">Reset corners</button>' +
          '</div>');
      if (el.src) {
        html.push(
          '<div class="ed-props-section"><h4>Artwork</h4>' +
            '<div class="ed-props-field"><label>How it sits</label>' +
              '<select data-prop="imgFit">' +
                '<option value="cover"' + (el.imgFit !== "contain" ? " selected" : "") + '>Fill the surface (crops)</option>' +
                '<option value="contain"' + (el.imgFit === "contain" ? " selected" : "") + '>Fit it all in (shows everything)</option>' +
              '</select></div>' +
            '<div class="ed-props-field"><label>Angle</label>' +
              '<div class="ed-props-row">' +
                '<input type="range" min="-180" max="180" step="1" value="' + rot + '" data-sc-rot>' +
                '<input type="number" min="-180" max="180" step="1" value="' + rot + '" data-sc-rot-num style="width:64px">' +
              '</div></div>' +
            '<div class="ed-props-field"><label>Zoom</label>' +
              '<div class="ed-props-row">' +
                '<input type="range" min="20" max="400" step="1" value="' + zoom + '" data-sc-zoom>' +
                '<input type="number" min="20" max="400" step="1" value="' + zoom + '" data-sc-zoom-num style="width:64px">' +
              '</div></div>' +
            '<div class="ed-props-field-row" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
              '<div class="ed-props-field"><label>Across</label><input type="number" step="1" value="' + Math.round(el.imgOffsetX || 0) + '" data-sc-x></div>' +
              '<div class="ed-props-field"><label>Down</label><input type="number" step="1" value="' + Math.round(el.imgOffsetY || 0) + '" data-sc-y></div>' +
            '</div>' +
            '<p class="ed-props-hint">Double-click the screen to move the artwork by dragging it, and use the round handle above it to spin it. Escape when you are done.</p>' +
            '<button class="ed-btn-ghost" id="ed-sc-recentre" style="background:rgba(28,29,34,0.06);width:100%">Recentre artwork</button>' +
          '</div>');
        /* What shows where the artwork does not reach. A design almost never
           shares a screen's proportions, so Fit leaves a margin - and a real
           device fills that margin with its own screen rather than letting the
           desk show through. Off by default, because on a poster or a board
           the surface showing IS the right answer. */
        const bg = el.bgFill || null;
        const bgSw = (hex, name) =>
          '<button type="button" class="ed-sc-sw' + (bg && bg.toLowerCase() === hex.toLowerCase() ? " is-on" : "") + '"' +
          ' data-scbg="' + hex + '" style="background:' + hex + '" title="' + name + '"></button>';
        const brandHexes = (BRAND && Array.isArray(BRAND.colors))
          ? BRAND.colors.map((c) => normHex(c.hex)).filter(Boolean).slice(0, 5) : [];
        html.push(
          '<div class="ed-props-section"><h4>Behind the artwork</h4>' +
            '<div class="ed-sc-swatches">' +
              '<button type="button" class="ed-sc-sw ed-sc-sw--none' + (!bg ? " is-on" : "") + '" data-scbg="none" title="Let the photo show through"></button>' +
              bgSw("#000000", "Black") + bgSw("#ffffff", "White") +
              brandHexes.map((h) => bgSw(h, h)).join("") +
            '</div>' +
            '<div class="ed-props-field" style="margin-top:10px"><label>Or pick one</label>' +
              '<div data-mount="sc-bg-pick"></div></div>' +
          '</div>');
      }
    }

    if (el.type === "frame") {
      // Shape picker — lets the user swap silhouette on the same frame
      // without re-creating it (and without losing the contained photo).
      const shapeOpts = ["square","portrait","landscape","wide","circle","rounded","arch","diamond"];
      const shapeHtml = shapeOpts.map(function (s) {
        return '<option value="' + s + '"' + (el.frameShape === s ? ' selected' : '') + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>';
      }).join("");
      html.push(
        '<div class="ed-props-section"><h4>Frame</h4>' +
          '<div class="ed-props-field"><label>Shape</label>' +
            '<select data-prop="frameShape">' + shapeHtml + '</select>' +
          '</div>' +
          // Corner radius — uniform slider+number, plus a collapsible set of
          // four typed per-corner inputs. Mounted from JS below.
          '<div data-mount="frame-radius"></div>' +
          '<details class="ed-corner-details"><summary>Individual corners</summary>' +
            '<div data-mount="frame-corners"></div>' +
          '</details>' +
          // Border — circular swatch (opens the rich colour panel) + width.
          '<div class="ed-props-field-row" style="display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;margin-top:10px">' +
            '<div class="ed-props-field" style="flex-direction:row;align-items:center;gap:8px"><span data-mount="frame-border"></span><label style="margin:0">Border</label></div>' +
            '<div class="ed-props-field"><label>Border width</label><input type="number" min="0" max="40" data-prop="frameBorderWidth" value="' + (el.frameBorderWidth || 0) + '"></div>' +
          '</div>' +
          (el.src
            ? ('<div data-mount="frame-zoom"></div>' +
              '<div class="ed-props-field-row" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
                '<div class="ed-props-field"><label>X offset</label><input type="number" data-prop="imgOffsetX" value="' + Math.round(el.imgOffsetX || 0) + '"></div>' +
                '<div class="ed-props-field"><label>Y offset</label><input type="number" data-prop="imgOffsetY" value="' + Math.round(el.imgOffsetY || 0) + '"></div>' +
              '</div>' +
              '<div class="ed-props-actions" style="display:flex;gap:8px">' +
                '<button type="button" id="ed-frame-reset" style="flex:1">Reset viewpoint</button>' +
                '<button type="button" id="ed-frame-replace" style="flex:1">Replace photo</button>' +
              '</div>' +
              '<button type="button" id="ed-frame-clear" class="ed-btn-ghost" style="width:100%;margin-top:8px;background:rgba(28,29,34,0.06)">Empty frame</button>')
            : '<p class="ed-section-hint" style="margin:6px 0">Drag a photo from the Photos or Uploads panel onto this frame to fill it.</p>') +
        '</div>'
      );
    }

    // Content — the quick, safe way to change wording: type over it. Selecting a
    // text box used to open this pane on "Arrange" (styling having moved to the
    // top bar), which did nothing useful. Value is set in the wiring below so we
    // don't have to escape it into markup.
    if (el.type === "text") {
      html.push(
        '<div class="ed-props-section"><h4>Content</h4>' +
          '<textarea class="ed-props-text" id="ed-sel-text" rows="3" spellcheck="false"></textarea>' +
          '<p class="ed-section-hint" style="margin:6px 0 0;font-size:11px;color:rgba(28,29,34,0.55)">Type to replace the wording — the design updates as you go.</p>' +
        '</div>'
      );
    }

    // Effects now lives in a top-bar popover (see renderContextBar). Admins
    // still get the merge-tag picker rendered here as its own section so
    // it doesn't disappear into the popover.
    if (el.type === "text" && isAdminMode()) {
      const tagOpts = KNOWN_TAGS.map(function (k) {
        return '<option value="' + k + '">{' + k + '}</option>';
      }).join("");
      html.push(
        '<div class="ed-props-section"><h4>Merge tag</h4>' +
          '<div class="ed-props-field"><label>Insert at end</label>' +
            '<select data-fx="mergetag-pick"><option value="">Pick a tag…</option>' + tagOpts + '</select>' +
          '</div>' +
          '<p class="ed-section-hint" style="margin:6px 0 0;font-size:11px;color:rgba(28,29,34,0.55)">Customers will see their saved brand kit values in place of these tags.</p>' +
        '</div>'
      );
    }

    html.push(`<div class="ed-props-section"><h4>Arrange</h4>
      <div class="ed-props-actions">
        <button data-arrange="up">Bring forward</button>
        <button data-arrange="down">Send back</button>
        <button data-arrange="front">To front</button>
        <button data-arrange="back">To back</button>
      </div>
    </div>`);

    // Lock is admin-only — customer flow doesn't get the affordance.
    html.push(`<div class="ed-props-section">
      <div class="ed-props-actions">
        ${isAdminMode() ? `<button data-action="lock">${el.locked ? "Unlock" : "Lock"}</button>` : ""}
        <button data-action="duplicate">Duplicate</button>
        <button data-action="delete" class="danger">Delete</button>
      </div>
    </div>`);

    body.innerHTML = html.join("");

    // Swap the slot to another logo from the kit.
    body.querySelectorAll("[data-logopick]").forEach(function (b) {
      b.addEventListener("click", function () {
        const kit = (BRAND && Array.isArray(BRAND.logos)) ? BRAND.logos.filter(function (l) { return l && l.src; }) : [];
        const pick = kit[+b.getAttribute("data-logopick")];
        if (!pick || pick.src === el.src) return;
        placeLogoInSlot(el, pick.src, function () {
          pushHistory();
          renderProps();   // repaint so the chosen one shows as selected
        });
      });
    });

    // Mount the font picker into its placeholder (text elements only).
    // Inline mode: search + scrollable list always visible, no popover.
    const fontMount = body.querySelector('[data-mount="font-picker"]');
    if (fontMount && el.type === "text") {
      fontMount.appendChild(createFontPicker(el.font, function (name) {
        el.font = name;
        fullRender();
        pushHistory();
      }, { inline: true }));
    }

    // Bind data-prop inputs inside the right panel — shared with the top-bar
    // Position popover via bindGenericPropInputs so both surfaces stay
    // in lockstep.
    bindGenericPropInputs(body);

    // Circular colour swatches (open the rich colour panel — brand + recent +
    // design colours) in place of the native "long square" colour inputs.
    // Corner radius for rectangles + images — uniform slider+number (sets all
    // corners, clears per-corner overrides) plus the four individual corners.
    const elRadiusMount = body.querySelector('[data-mount="el-radius"]');
    if (elRadiusMount && el) {
      elRadiusMount.appendChild(sliderNumberRow("Corner radius", "px", 0, 500, 1,
        function () { return el.radius || 0; },
        function (v) { el.radius = v; el.radii = null; },
        function () { partialRenderElement(el); }));
    }
    const elCornersMount = body.querySelector('[data-mount="el-corners"]');
    if (elCornersMount && el) {
      elCornersMount.appendChild(buildCornerInputs(el));
    }

    // Line weight — slider + typed number bound to the element height (its
    // visible thickness). 1px = thinnest.
    const lineWeightMount = body.querySelector('[data-mount="line-weight"]');
    if (lineWeightMount && el.type === "line") {
      lineWeightMount.appendChild(sliderNumberRow("Thickness", "px", 1, 80, 1,
        function () { return Math.max(1, Math.round(el.h || 1)); },
        function (v) { el.h = Math.max(1, v); },
        function () { partialRenderElement(el); renderHandles(); }));
    }

    const fillMount = body.querySelector('[data-mount="fill-color"]');
    if (fillMount) {
      fillMount.appendChild(colorSwatchButton(
        function () { return rgbHex(el.fill); },
        { title: "Fill colour", onSolid: function (hex) { el.fill = hex; } }
      ));
    }
    const svgFillMount = body.querySelector('[data-mount="svg-fill"]');
    if (svgFillMount) {
      svgFillMount.appendChild(colorSwatchButton(
        function () { return rgbHex(el.svgFill || "#1c1d22"); },
        { title: "Icon colour", onSolid: function (hex) {
            el.svgFill = hex;
            // The icon is a data-URI, so its colour is baked into the src.
            if (el.svgKey) el.src = svgKeyToDataUri(el.svgKey, hex);
          } }
      ));
    }
    const strokeMount = body.querySelector('[data-mount="stroke-color"]');
    if (strokeMount) {
      strokeMount.appendChild(colorSwatchButton(
        function () { return (el.stroke && el.stroke !== "transparent") ? el.stroke : "#000000"; },
        { title: "Stroke colour", onSolid: function (hex) { el.stroke = hex; if (!el.strokeWidth) el.strokeWidth = 2; } }
      ));
    }
    const borderMount = body.querySelector('[data-mount="frame-border"]');
    if (borderMount) {
      borderMount.appendChild(colorSwatchButton(
        function () { return el.frameBorder || "#1c1d22"; },
        { title: "Border colour", onSolid: function (hex) { el.frameBorder = hex; if (!el.frameBorderWidth) el.frameBorderWidth = 2; } }
      ));
    }

    // Frame corner radius — uniform slider+number that drives all four corners
    // (and clears any per-corner overrides), plus four typed per-corner inputs.
    const radiusMount = body.querySelector('[data-mount="frame-radius"]');
    if (radiusMount && el.type === "frame") {
      radiusMount.appendChild(sliderNumberRow("Corner radius", "px", 0, 500, 1,
        function () { return el.radius || 0; },
        function (v) { el.radius = v; el.radii = null; },
        function () { partialRenderElement(el); }));
    }
    const cornersMount = body.querySelector('[data-mount="frame-corners"]');
    if (cornersMount && el.type === "frame") {
      cornersMount.appendChild(buildCornerInputs(el));
    }

    // Frame image zoom — typed slider+number (replaces the lone range).
    const zoomMount = body.querySelector('[data-mount="frame-zoom"]');
    if (zoomMount && el.type === "frame" && el.src) {
      zoomMount.appendChild(sliderNumberRow("Zoom", "×", 0.3, 6, 0.01,
        function () { return el.imgScale || 1; },
        function (v) { el.imgScale = v; },
        function () { partialRenderElement(el); }));
    }

    // Content box (text only) — overwrite the wording straight from the panel.
    const selText = body.querySelector("#ed-sel-text");
    if (selText) {
      selText.value = el.text || "";
      selText.addEventListener("input", () => liveSetText(getEl(el.id), selText.value));
    }

    body.querySelectorAll("[data-arrange]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = btn.dataset.arrange;
        if (a === "up") bringForward();
        else if (a === "down") sendBack();
        else if (a === "front") bringToFront();
        else if (a === "back") sendToBack();
      });
    });
    body.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = btn.dataset.action;
        if (a === "lock") {
          const tgt = getEl(state.selectedIds[0]);
          if (!tgt) return;
          tgt.locked = !tgt.locked;
          pushHistory();
          fullRender();
        } else if (a === "duplicate") duplicateSelected();
        else if (a === "delete") deleteSelected();
      });
    });

    // ---- Screen controls -------------------------------------------------
    if (el.type === "screen") {
      const live = () => {
        const node = canvasEl.querySelector('.ed-element[data-id="' + el.id + '"]');
        if (node) applyScreenTransform(node, el);
      };
      // A slider and a number box for the same value, each following the other.
      const pair = (rangeSel, numSel, set, read) => {
        const r = body.querySelector(rangeSel), n = numSel ? body.querySelector(numSel) : null;
        const apply = (v, from) => {
          if (!isFinite(v)) return;
          set(v);
          if (r && from !== "r") r.value = String(v);
          if (n && from !== "n") n.value = String(v);
          live();
        };
        if (r) {
          r.addEventListener("input", () => apply(parseFloat(r.value), "r"));
          r.addEventListener("change", pushHistory);
        }
        if (n) {
          n.addEventListener("input", () => apply(parseFloat(n.value), "n"));
          n.addEventListener("change", pushHistory);
        }
      };
      pair("[data-sc-rot]", "[data-sc-rot-num]", (v) => { el.imgRotation = v; });
      pair("[data-sc-zoom]", "[data-sc-zoom-num]", (v) => { el.imgScale = v / 100; });
      pair("[data-sc-x]", null, (v) => { el.imgOffsetX = v; });
      pair("[data-sc-y]", null, (v) => { el.imgOffsetY = v; });

      const fitSel = body.querySelector('[data-prop="imgFit"]');
      if (fitSel) fitSel.addEventListener("change", () => {
        el.imgFit = fitSel.value;
        // Changing how it sits invalidates a zoom chosen against the old fit.
        el.imgScale = 1; el.imgOffsetX = 0; el.imgOffsetY = 0;
        pushHistory(); fullRender();
      });
      const hideBox = body.querySelector("#ed-sc-hide");
      if (hideBox) hideBox.addEventListener("change", () => {
        screenGuideHidden = hideBox.checked;
        document.documentElement.classList.toggle("ed-guide-off", screenGuideHidden);
        fullRender();
      });
      body.querySelectorAll("[data-guide]").forEach((b) => b.addEventListener("click", () => {
        el.guide = b.getAttribute("data-guide");
        pushHistory(); fullRender(); renderProps();
      }));
      body.querySelectorAll("[data-scbg]").forEach((b) => b.addEventListener("click", () => {
        const v = b.getAttribute("data-scbg");
        el.bgFill = v === "none" ? null : v;
        pushHistory(); fullRender(); renderProps();
      }));
      const bgMount = body.querySelector('[data-mount="sc-bg-pick"]');
      if (bgMount) {
        bgMount.appendChild(buildColorPicker(
          el.bgFill || "#000000",
          function (hex) {
            el.bgFill = hex;
            const node = canvasEl.querySelector('.ed-element[data-id="' + el.id + '"]');
            if (node) node.style.setProperty("--sc-bg", hex);
          },
          function (hex) { el.bgFill = hex; pushHistory(); fullRender(); }
        ));
      }
      body.querySelector("#ed-sc-reset")?.addEventListener("click", () => resetScreenCorners(el));
      body.querySelector("#ed-sc-recentre")?.addEventListener("click", () => {
        el.imgRotation = 0; el.imgScale = 1; el.imgOffsetX = 0; el.imgOffsetY = 0;
        pushHistory(); fullRender(); renderProps();
      });
    }

    const replaceBtn = body.querySelector("#ed-replace-img");
    if (replaceBtn) {
      replaceBtn.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = () => {
          const file = input.files[0];
          if (!file) return;
          fileToWebImage(file).then((src) => {
            if (!src) return;
            const tgt = getEl(state.selectedIds[0]);
            if (tgt) { tgt.src = src; pushHistory(); fullRender(); }
          });
        };
        input.click();
      });
    }

    // Frame controls
    const frameResetBtn = body.querySelector("#ed-frame-reset");
    if (frameResetBtn) {
      frameResetBtn.addEventListener("click", () => {
        const tgt = getEl(state.selectedIds[0]);
        if (!tgt || tgt.type !== "frame") return;
        tgt.imgScale = 1; tgt.imgOffsetX = 0; tgt.imgOffsetY = 0;
        pushHistory(); fullRender();
      });
    }
    const frameReplaceBtn = body.querySelector("#ed-frame-replace");
    if (frameReplaceBtn) {
      frameReplaceBtn.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = () => {
          const file = input.files[0];
          if (!file) return;
          fileToWebImage(file).then((src) => {
            if (!src) return;
            const tgt = getEl(state.selectedIds[0]);
            if (tgt && tgt.type === "frame") fillFrame(tgt, src);
          });
        };
        input.click();
      });
    }
    const frameClearBtn = body.querySelector("#ed-frame-clear");
    if (frameClearBtn) {
      frameClearBtn.addEventListener("click", () => {
        const tgt = getEl(state.selectedIds[0]);
        if (!tgt || tgt.type !== "frame") return;
        tgt.src = null;
        tgt.imgScale = 1; tgt.imgOffsetX = 0; tgt.imgOffsetY = 0;
        tgt.imgNaturalW = 0; tgt.imgNaturalH = 0;
        pushHistory(); fullRender();
      });
    }

    // Effects section bindings — shadow/outline/background/gradient + merge tags.
    bindEffectsInputs(body);
  }

  function rgbHex(color) {
    if (!color) return "#000000";
    if (color.startsWith("#")) return color.length === 4
      ? "#" + color.slice(1).split("").map(c => c + c).join("")
      : color;
    // best-effort fallback
    return "#000000";
  }

  // ---------- Effects (shadow / glow / outline / text background / gradient) ----------
  // Each preset writes a plain shadow object so the slider UI just edits values
  // and we never need to keep "current preset" state separate from the values.
  // Tuned to roughly match Canva's defaults so designers get a familiar starting
  // point — they can fine-tune from there.
  const SHADOW_PRESETS = {
    none:    null,
    drop:    { offsetX: 8,  offsetY: 12, blur: 18, color: "#000000", opacity: 0.45 },
    glow:    { offsetX: 0,  offsetY: 0,  blur: 22, color: "#FFFFFF", opacity: 0.8  },
    outline: { offsetX: 0,  offsetY: 0,  blur: 0,  color: "#1c1d22", opacity: 1, strokePx: 3 },
    curved:  { offsetX: 0,  offsetY: 24, blur: 30, color: "#000000", opacity: 0.3  },
    lift:    { offsetX: 0,  offsetY: 4,  blur: 12, color: "#000000", opacity: 0.25 },
    angled:  { offsetX: 16, offsetY: 16, blur: 6,  color: "#000000", opacity: 0.45 },
    backdrop:{ offsetX: 0,  offsetY: 0,  blur: 40, color: "#000000", opacity: 0.55 },
  };

  // Does this element have any visible effect applied? Used to highlight the
  // Effects toolbar button so you can tell at a glance (e.g. coming back to a
  // design tomorrow) that a layer already carries a shadow / outline / etc.
  function elementHasEffect(el) {
    if (!el) return false;
    const sh = el.type === "text" ? el.textShadow : el.shadow;
    if (sh && sh.enabled) return true;
    if (el.type === "text") {
      if (el.textOutline && el.textOutline.width > 0) return true;
      if (el.textBg && el.textBg.enabled) return true;
      if (el.textGradient && el.textGradient.enabled) return true;
    }
    if (el.fillGradient && el.fillGradient.enabled) return true;
    return false;
  }
  // Which shadow preset (if any) the element's current shadow matches exactly,
  // so the effects panel can highlight the chosen one. "none" when off; null
  // when enabled but tweaked away from any preset (custom).
  function shadowPresetKeyFor(el) {
    const sh = el.type === "text" ? el.textShadow : el.shadow;
    if (!sh || !sh.enabled) return "none";
    const keys = ["drop", "glow", "curved", "lift", "angled", "backdrop"];
    for (let i = 0; i < keys.length; i++) {
      const p = SHADOW_PRESETS[keys[i]];
      if (p && p.offsetX === sh.offsetX && p.offsetY === sh.offsetY && p.blur === sh.blur &&
          String(p.color || "").toLowerCase() === String(sh.color || "").toLowerCase() &&
          p.opacity === sh.opacity) return keys[i];
    }
    return null;
  }

  function hexToRgba(hex, alpha) {
    const h = rgbHex(hex || "#000000").replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + (alpha != null ? alpha : 1) + ")";
  }

  // Build the CSS filter value for an element's shadow. filter:drop-shadow
  // follows alpha + clip-path + border-radius, so it works for raster images,
  // frame masks and all the clip-path shapes (triangle/star).
  function shadowFilter(shadow) {
    if (!shadow || !shadow.enabled) return "";
    const color = hexToRgba(shadow.color || "#000000", shadow.opacity != null ? shadow.opacity : 0.45);
    return "drop-shadow(" + (shadow.offsetX || 0) + "px " + (shadow.offsetY || 0) + "px " +
      (shadow.blur || 0) + "px " + color + ")";
  }

  // Text shadow as a CSS `filter` value too (rather than text-shadow), so it
  // composes correctly with gradient-filled text — text-shadow paints behind
  // the *background-clipped* glyph, which becomes invisible when the glyph
  // itself is transparent. filter:drop-shadow paints behind the *rendered*
  // pixels, which is what we want.
  function textShadowFilter(shadow) {
    return shadowFilter(shadow);
  }

  // Build a CSS background for gradient-filled text. Returns null if disabled.
  // `fromStop`/`toStop` (0–100) control where the blend starts/ends — i.e. how
  // much of the shape is solid colour vs. transition ("how much gradient").
  // ---------- Gradient model (multi-stop) ----------
  // A gradient is { enabled, type:'linear'|'radial', angle, stops:[{color,pos}] }.
  // For backward compatibility we still read the old from/to/fromStop/toStop pair
  // when no `stops` array is present (and we keep writing from/to alongside stops).
  // `gradStops` is the single source of truth used by every builder below.
  function gradStops(g) {
    if (g && Array.isArray(g.stops) && g.stops.length >= 2) {
      return g.stops.map(function (s) {
        return { color: s.color || "#000000", pos: s.pos != null ? s.pos : 0 };
      }).sort(function (a, b) { return a.pos - b.pos; });
    }
    const from = (g && g.from) || "#1c1d22";
    const to = (g && (g.toTransparent ? "transparent" : g.to)) || "#B9826A";
    const fs = g && g.fromStop != null ? g.fromStop : 0;
    const ts = g && g.toStop != null ? g.toStop : 100;
    return [{ color: from, pos: fs }, { color: to, pos: ts }];
  }
  // CSS gradient string for any gradient object (or draft).
  function gradCss(g) {
    const stops = gradStops(g).map(function (s) { return s.color + " " + s.pos + "%"; }).join(", ");
    if (g && g.type === "radial") return "radial-gradient(circle, " + stops + ")";
    const angle = g && g.angle != null ? g.angle : 135;
    return "linear-gradient(" + angle + "deg, " + stops + ")";
  }
  // Canvas gradient object for export, honouring every stop.
  function canvasGrad(ctx, g, w, h) {
    let grad;
    if (g && g.type === "radial") {
      grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
    } else {
      // Match the CSS linear-gradient angle convention used on screen (gradCss):
      // 0deg points UP, increasing clockwise, default 135deg. Direction vector in
      // canvas coords (x right, y down) is (sin a, -cos a). Using the math
      // convention here (cos/sin) rotated gradients ~90deg vs what the editor
      // showed — leaving a hard edge and the wrong areas shaded in exports/thumbs.
      const a = (g && g.angle != null ? g.angle : 135) * Math.PI / 180;
      const dx = Math.sin(a), dy = -Math.cos(a);
      // CSS gradient-line LENGTH: the line through the centre, extended so the
      // box corners project exactly onto its 0%/100% ends — len = |w·sin a| +
      // |h·cos a|. Scaling by half-width/half-height instead (the old approach)
      // makes the line too short for angled gradients, so the fade reaches its
      // end colour before the shape edge and the remainder fills flat → a hard
      // line. This makes the fade span the whole shape, matching CSS exactly.
      const len = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
      const cx = w / 2, cy = h / 2;
      grad = ctx.createLinearGradient(
        cx - dx * len / 2, cy - dy * len / 2,
        cx + dx * len / 2, cy + dy * len / 2
      );
    }
    gradStops(g).forEach(function (s) {
      const p = Math.max(0, Math.min(1, (s.pos || 0) / 100));
      try { grad.addColorStop(p, s.color); } catch (_) { /* invalid colour — skip */ }
    });
    return grad;
  }

  function textGradientCss(grad) {
    if (!grad || !grad.enabled) return null;
    return gradCss(grad);
  }

  // Canvas fill for a shape on export — a gradient (incl. fade-to-transparent)
  // when el.fillGradient is enabled, else the solid el.fill.
  function shapeCanvasFill(ctx, el) {
    const grad = el.fillGradient;
    if (!grad || !grad.enabled) return el.fill || "transparent";
    return canvasGrad(ctx, grad, el.w, el.h);
  }

  // ---------- Merge tags ({brand name}, {company}, etc.) ----------
  // Tokens are matched case-insensitively in either {brace} or (paren) form.
  // We only substitute known keys, so legitimate parenthetical text in
  // user-written copy isn't accidentally stripped.
  function mergeTagMap() {
    const m = {};
    const b = BRAND || {};
    const company = (b.company || "").trim();
    if (company) {
      m["brand name"] = company;
      m["brand"]      = company;
      m["company"]    = company;
      m["company name"] = company;
    }
    // Optional fields — wired up as customers fill them in (kept opt-in so
    // half-finished brand kits don't push empty strings into templates).
    // The patch, straight from the kit. Templates ask for it 21 times across
    // the pack — "We Know {location}", "A Day in {location}" — and it is the
    // same answer every time for a given agency. Overwritable like any other
    // text, for the post where it isn't.
    if (b.location) {
      m["location"] = b.location;
      m["area"]     = b.location;
      m["town"]     = b.location;
    }
    // Slogan. The engine has always known {tagline} but the brand kit had no
    // field to fill it, so it could never resolve — there is one now, and
    // {slogan} and {strapline} say the same thing. Older kits that stored a
    // tagline still work.
    const slogan = (b.slogan || b.tagline || "").trim();
    if (slogan) {
      m["slogan"] = slogan;
      m["strapline"] = slogan;
      m["tagline"] = slogan;
    }
    if (b.email)   m["email"]   = b.email;
    if (b.phone)   m["phone"]   = b.phone;
    if (b.website) m["website"] = b.website;
    return m;
  }
  // Surface the keys so the admin "insert tag" UI can list them.
  const KNOWN_TAGS = ["brand name", "brand", "company", "company name",
    "location", "area", "town", "slogan", "strapline", "tagline",
    "email", "phone", "website"];

  function applyMergeTags(text) {
    if (!text || typeof text !== "string") return text;
    const map = mergeTagMap();
    // Match {key} or (key) where key is one of our known tags. Letter case in
    // the source is preserved by looking up against the lowercased key.
    const pattern = /([{(])\s*([a-zA-Z][a-zA-Z ]*?)\s*([})])/g;
    return text.replace(pattern, function (full, open, key, close) {
      // Only substitute paired delimiters — `{x)` stays as-is.
      const paired = (open === "{" && close === "}") || (open === "(" && close === ")");
      if (!paired) return full;
      const k = key.toLowerCase().replace(/\s+/g, " ").trim();
      if (KNOWN_TAGS.indexOf(k) === -1) return full;
      const val = map[k];
      // Unknown brand data → leave the placeholder so the customer can fill it
      // (or the admin can spot what's missing on the template).
      return val ? val : full;
    });
  }

  /* ---- Brand logo slots ---------------------------------------------------
     Templates are drawn with a made-up agency on them — "Greenfield Property"
     set in The Seasons, small, pinned to the top or foot of the design. That
     works for a brand whose mark IS its name, and not at all for one with a
     real image logo, which is most estate agents.

     A slot is any element carrying brandRole: "logo". On load we do one of two
     things with it, so both kinds of brand are served by the same template:

       · the member has uploaded a logo  -> the slot becomes that image, fitted
         inside the box the designer drew, keeping its own proportions
       · they haven't                    -> it stays text, and the merge tag in
         it resolves to their brand name

     Nothing happens in admin mode: authors need to see the placeholder they
     drew, tags and all. */
  /* Authoring: drop a logo slot that is already the right size and in the
     right place, rather than drawing a box by eye and hoping. 200x75 is the
     largest a mark should sit on these designs, centred, 108px from the edge —
     the measurements the existing pack already follows.

     It goes in as TEXT carrying {brand name}, which is exactly what a member
     without a logo should see; the slot only becomes an image for members who
     have uploaded one. So the placeholder IS the fallback, not a stand-in for
     it, and there is nothing to remember to swap out later. */
  const LOGO_SLOT_W = 200, LOGO_SLOT_H = 75, LOGO_SLOT_EDGE = 108;

  function addLogoSlot(anchor) {
    const y = anchor === "bottom"
      ? state.canvas.height - LOGO_SLOT_EDGE - LOGO_SLOT_H
      : LOGO_SLOT_EDGE;
    addElement({
      type: "text",
      brandRole: "logo",
      text: "{brand name}",
      x: Math.round((state.canvas.width - LOGO_SLOT_W) / 2),
      y: Math.round(y),
      w: LOGO_SLOT_W,
      h: LOGO_SLOT_H,
      font: "The Seasons",
      size: 20,
      weight: 400,
      color: "#1c1d22",
      align: "center",
      lineHeight: 1.2,
    });
    toast("Logo slot added — " + LOGO_SLOT_W + " × " + LOGO_SLOT_H + ", centred, " + LOGO_SLOT_EDGE + "px from the " + (anchor === "bottom" ? "foot" : "top"));
  }

  /* ---- Rebrand: put this design into their colours and fonts ---------------
     Not a fixed list of roles. The packs don't record what is a "title" and
     what is "body", and inventing that from font size would be guesswork. So
     this reads the colours the design ACTUALLY uses and offers each one for
     remapping — measured across the pack, a design uses one to three colours,
     so that is one to three decisions rather than a wall of controls.

     Why not one colour for everything: on a design with light text over a dark
     panel, flattening to a single colour makes the text disappear. Mapping
     keeps the relationships — light stays light, dark stays dark — and anyone
     who wants a title in its own colour just recolours that one item as usual.

     Background is only offered where it can be seen. 57 of the 81 templates
     sit on a photo, where the colour behind is irrelevant, so the row is shown
     only when there is no background image. */
  const REBRAND_PROPS = { text: "color", rect: "fill", line: "stroke", ellipse: "fill", triangle: "fill", star: "fill" };

  function normHexSafe(v) {
    if (typeof v !== "string" || v[0] !== "#") return null;
    let c = v.toLowerCase();
    if (c.length === 4) c = "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    return /^#[0-9a-f]{6}$/.test(c) ? c : null;
  }

  // Every colour in the current page, with what carries it — so a row can say
  // "body text, 4 items" rather than showing a bare swatch.
  function designColours() {
    const map = {};
    const note = { text: "text", rect: "shapes", ellipse: "shapes", triangle: "shapes", star: "shapes", line: "lines" };
    state.elements.forEach(function (el) {
      if (!el) return;
      ["color", "fill", "stroke"].forEach(function (k) {
        const c = normHexSafe(el[k]);
        if (!c) return;
        if (!map[c]) map[c] = { hex: c, count: 0, kinds: {}, refs: [] };
        map[c].count++;
        map[c].kinds[note[el.type] || el.type] = true;
        map[c].refs.push({ id: el.id, prop: k });
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  function recolourDesign(fromHex, toHex) {
    if (!normHexSafe(toHex)) return 0;
    let n = 0;
    state.elements.forEach(function (el) {
      ["color", "fill", "stroke"].forEach(function (k) {
        if (normHexSafe(el[k]) === fromHex) { el[k] = toHex; n++; }
      });
    });
    if (n) { fullRender(); pushHistory(); }
    return n;
  }

  // The colour behind the design is only meaningful when nothing covers it.
  function canRecolourBackground() {
    return !state.canvas.backgroundImage && !!normHexSafe(state.canvas.background);
  }

  /* Fonts follow the pack's own convention rather than asking twice: The
     Seasons is the display face on a couple of things, Montserrat carries
     everything else. So a serif in the kit takes the display role and a sans
     takes the body, and a design maps across in one move. */
  function isSerifFont(name) {
    const f = FONTS.find(function (x) { return x.name === name; });
    // "sans-serif" contains "serif", so it has to go before the test — without
    // this, Montserrat reads as a serif and takes the display role.
    const stack = ((f && f.stack) || "").toLowerCase().replace(/sans-serif/g, "");
    return /serif|georgia|garamond|seasons|cormorant|times|playfair|baskerville/.test(stack);
  }

  function designFonts() {
    const seen = {};
    state.elements.forEach(function (el) {
      if (el && el.type === "text" && el.font) seen[el.font] = (seen[el.font] || 0) + 1;
    });
    return Object.keys(seen).map(function (name) {
      return { name: name, count: seen[name], serif: isSerifFont(name) };
    }).sort(function (a, b) { return b.count - a.count; });
  }

  function refontDesign(fromName, toName) {
    if (!toName) return 0;
    let n = 0;
    state.elements.forEach(function (el) {
      if (el && el.type === "text" && el.font === fromName) { el.font = toName; n++; }
    });
    if (n) { loadGoogleFont(toName); fullRender(); pushHistory(); }
    return n;
  }

  /* Drop the member's logo onto a design they are building themselves, on the
     same footing the packs use: 200x75, centred, 108px from the edge. Without
     this the only customer route was the Logos grid, which lands a logo at
     canvas centre at up to 480px wide — nothing like where a pack puts it, so
     a design of their own never matched one they bought.

     It goes in carrying brandRole, so it is a real slot: the swap-to-another-
     logo picker works on it, and it re-seats itself if they choose a different
     shaped mark. They can still drag it anywhere afterwards. */
  function addBrandLogo(anchor) {
    const src = brandLogoSrc();
    if (!src) { toast("Add a logo to your brand kit first"); return; }
    addElement({
      type: "image",
      src: src,
      brandRole: "logo",
      logoAnchor: anchor,
      x: Math.round((state.canvas.width - LOGO_MAX_W) / 2),
      y: anchor === "bottom" ? state.canvas.height - LOGO_EDGE - LOGO_MAX_H : LOGO_EDGE,
      w: LOGO_MAX_W, h: LOGO_MAX_H,
      opacity: 1, rotation: 0,
    });
    // addElement selects what it made, which is how we get hold of it — then
    // the shared placer fits it to the logo's real proportions.
    const el = getEl(state.selectedIds[0]);
    if (el) placeLogoInSlot(el, src, function () { pushHistory(); });
    toast("Logo added — " + (anchor === "bottom" ? "foot" : "top") + " of the design");
  }

  function renderRebrand() {
    const mount = document.getElementById("ed-rebrand");
    if (!mount) return;
    const kit = (BRAND && Array.isArray(BRAND.colors))
      ? BRAND.colors.map(function (c) { return { hex: normHexSafe(c.hex), name: c.name || "" }; }).filter(function (c) { return c.hex; })
      : [];
    if (!kit.length) {
      mount.innerHTML = '<p class="ed-rb-note">Add some colours to your brand kit and you can recolour a whole design from here.</p>';
      return;
    }

    const swatches = function (current) {
      return '<span class="ed-rb-to">' + kit.map(function (c) {
        return '<button type="button" class="ed-rb-sw' + (c.hex === current ? " is-on" : "") + '"' +
          ' style="background:' + c.hex + '" data-to="' + c.hex + '"' +
          ' title="' + escapeHtml(c.name || c.hex) + '"></button>';
      }).join("") + '</span>';
    };

    const rows = [];
    if (brandLogoSrc()) {
      rows.push('<div class="ed-rb-row" data-logorow="1">' +
        '<span class="ed-rb-what"><b>Your logo</b>200 \u00d7 75, centred</span>' +
        '<span class="ed-rb-to">' +
          '<button type="button" class="ed-rb-logo" data-addlogo="top">Top</button>' +
          '<button type="button" class="ed-rb-logo" data-addlogo="bottom">Foot</button>' +
        '</span>' +
      '</div>');
    }
    rows.push.apply(rows, designColours().map(function (c) {
      const kinds = Object.keys(c.kinds).join(" &amp; ");
      return '<div class="ed-rb-row" data-from="' + c.hex + '">' +
        '<span class="ed-rb-from" style="background:' + c.hex + '"></span>' +
        '<span class="ed-rb-what"><b>' + kinds + '</b>' + c.count + ' item' + (c.count === 1 ? "" : "s") + '</span>' +
        swatches(c.hex) +
      '</div>';
    }));

    if (canRecolourBackground()) {
      const bg = normHexSafe(state.canvas.background);
      rows.push('<div class="ed-rb-row" data-bg="1">' +
        '<span class="ed-rb-from" style="background:' + bg + '"></span>' +
        '<span class="ed-rb-what"><b>Background</b>behind everything</span>' +
        swatches(bg) +
      '</div>');
    }

    // Fonts follow the pack's own split rather than asking per font.
    const fonts = designFonts();
    const kitSerif = BRAND && BRAND.fonts && BRAND.fonts.heading;
    const kitSans = BRAND && BRAND.fonts && BRAND.fonts.body;
    const fontRows = fonts.map(function (f) {
      const suggested = f.serif ? kitSerif : kitSans;
      const opts = FONTS.map(function (x) {
        return '<option value="' + escapeHtml(x.name) + '"' + (x.name === f.name ? " selected" : "") + '>' + escapeHtml(x.name) + '</option>';
      }).join("");
      return '<div class="ed-rb-font" data-font-from="' + escapeHtml(f.name) + '">' +
        '<span class="ed-rb-what"><b>' + escapeHtml(f.name) + '</b>' + f.count + ' text item' + (f.count === 1 ? "" : "s") + '</span>' +
        '<select>' + opts + '</select>' +
        (suggested && suggested !== f.name
          ? '<button type="button" class="ed-rb-sw" style="width:auto;padding:5px 9px;font-family:var(--sans);font-size:11px;font-weight:700;background:rgba(var(--violet-rgb),0.1);color:var(--english-violet);border-color:rgba(var(--violet-rgb),0.35)" data-font-to="' + escapeHtml(suggested) + '">Use ' + escapeHtml(suggested) + '</button>'
          : '') +
      '</div>';
    });

    mount.innerHTML = rows.join("") +
      (fontRows.length ? '<p class="ed-rb-note" style="margin-top:8px">Fonts</p>' + fontRows.join("") : "") +
      '<p class="ed-rb-note">Changing a colour here changes every item using it. To do just one, select it and set its colour as usual.</p>';

    mount.querySelectorAll("[data-addlogo]").forEach(function (b) {
      b.addEventListener("click", function () { addBrandLogo(b.getAttribute("data-addlogo")); });
    });

    mount.querySelectorAll(".ed-rb-row").forEach(function (row) {
      row.querySelectorAll("[data-to]").forEach(function (b) {
        b.addEventListener("click", function () {
          const to = b.getAttribute("data-to");
          if (row.getAttribute("data-bg")) {
            state.canvas.background = to;
            fullRender(); pushHistory();
          } else {
            recolourDesign(row.getAttribute("data-from"), to);
          }
          renderRebrand();
        });
      });
    });

    mount.querySelectorAll("[data-font-from]").forEach(function (row) {
      const from = row.getAttribute("data-font-from");
      row.querySelector("select")?.addEventListener("change", function (e) {
        refontDesign(from, e.target.value); renderRebrand();
      });
      row.querySelector("[data-font-to]")?.addEventListener("click", function (b) {
        refontDesign(from, row.querySelector("[data-font-to]").getAttribute("data-font-to")); renderRebrand();
      });
    });
  }

  function brandLogoSrc() {
    const L = (BRAND && Array.isArray(BRAND.logos)) ? BRAND.logos : [];
    const withSrc = L.filter(function (l) { return l && l.src; });
    if (!withSrc.length) return null;
    const main = withSrc.filter(function (l) { return l.primary; })[0];
    return (main || withSrc[0]).src;
  }

  /* One logo, one slot. Sizing and placement live here so the first automatic
     fill and a later hand-swap cannot drift apart — they are the same call.

     At most 200 x 75, whichever limit the logo reaches first, its own
     proportions never touched. Centred on the canvas rather than on whatever
     box the designer drew, because those boxes are variously left, right,
     centre and justified. Vertically it returns to the edge the slot belongs
     to, so swapping a wide mark for a square one re-seats it rather than
     leaving it hanging where the previous one ended. */
  const LOGO_MAX_W = 200, LOGO_MAX_H = 75, LOGO_EDGE = 108;

  // Which edge this slot belongs to. Recorded on the element the first time it
  // is filled; worked out from where it sits for slots filled before that.
  function logoAnchorOf(el) {
    if (el.logoAnchor) return el.logoAnchor;
    const dTop = el.y;
    const dBottom = state.canvas.height - (el.y + (el.h || 0));
    if (dTop <= dBottom && dTop < 400) return "top";
    if (dBottom < dTop && dBottom < 400) return "bottom";
    return "free";   // placed deliberately mid-design: stays put
  }

  function placeLogoInSlot(slot, src, after) {
    const anchor = logoAnchorOf(slot);
    const prevY = slot.y, prevH = slot.h || 0;
    slot.logoAnchor = anchor;
    slot.src = src;
    const probe = new Image();
    probe.onload = function () {
      const ratio = probe.naturalWidth / probe.naturalHeight || 1;
      let w = LOGO_MAX_W, h = LOGO_MAX_W / ratio;
      if (h > LOGO_MAX_H) { h = LOGO_MAX_H; w = LOGO_MAX_H * ratio; }
      slot.w = Math.round(w);
      slot.h = Math.round(h);
      slot.x = Math.round((state.canvas.width - w) / 2);
      if (anchor === "top") slot.y = LOGO_EDGE;
      else if (anchor === "bottom") slot.y = Math.round(state.canvas.height - LOGO_EDGE - h);
      else slot.y = Math.round(prevY + (prevH - h) / 2);
      fullRender();
      if (after) after();
    };
    // A logo that won't load leaves the slot where it is rather than
    // collapsing it — visible and fixable, not silently gone.
    probe.src = src;
  }

  function fillTemplateLogos() {
    const src = brandLogoSrc();
    if (!src) return;   // no logo in the kit — the text path already covers it
    // Still text = still a placeholder. Once a slot has become an image it is
    // left alone, so reopening a design cannot overwrite a logo you swapped or
    // repositioned by hand.
    const slots = state.elements.filter(function (el) {
      return el && el.brandRole === "logo" && el.type === "text";
    });
    if (!slots.length) return;

    slots.forEach(function (slot) {
      // The anchor has to be read while the element still sits where the
      // designer put it, before the fit moves it.
      slot.logoAnchor = logoAnchorOf(slot);
      // Converted in place, so z-order, rotation and any grouping survive.
      ["text", "runs", "font", "size", "weight", "color", "align", "lineHeight",
       "letterSpacing", "textGradient", "textShadow", "textOutline", "textBg"]
        .forEach(function (k) { delete slot[k]; });
      slot.type = "image";
      placeLogoInSlot(slot, src);
    });
  }

  // Walk every text element and run their copy through applyMergeTags. Called
  // when a template loads fresh so the customer sees their brand name baked in
  // straight away. They can still edit any text afterwards as normal.
  function fillTemplateMergeTags() {
    state.elements.forEach(function (el) {
      if (el.type !== "text") return;
      if (el.text) {
        const replaced = applyMergeTags(el.text);
        if (replaced !== el.text) el.text = replaced;
      }
      /* Formatted text keeps its wording a second time, in `runs` — one entry
         per stretch of bold/italic/underline — and the renderer prefers runs
         when they exist. Substituting only `text` left a run-carrying element
         showing the template's own wording while the element claimed to say
         something else. Found on Sale Price Insights, whose text read
         {brand name} while its single bold run still read the old agency. */
      if (Array.isArray(el.runs)) {
        el.runs.forEach(function (r) {
          if (!r || typeof r.text !== "string") return;
          const rep = applyMergeTags(r.text);
          if (rep !== r.text) r.text = rep;
        });
      }
    });
  }

  // ---------- Effects panel ----------
  function defaultShadow() {
    return { enabled: true, offsetX: 8, offsetY: 12, blur: 18, color: "#000000", opacity: 0.45 };
  }
  function defaultTextOutline() { return { width: 2, color: "#1c1d22" }; }
  function defaultTextBg()      { return { enabled: true, color: "#FFE066", radius: 6, padX: 12, padY: 6 }; }
  function defaultTextGradient(){ return { enabled: true, from: "#B9826A", to: "#474254", angle: 90, type: "linear" }; }

  function renderEffectsSection(el) {
    const isText = el.type === "text";
    const shadow = (isText ? el.textShadow : el.shadow) || { enabled: false };
    const sxOn = !!shadow.enabled;
    const sx = shadow.offsetX != null ? shadow.offsetX : 8;
    const sy = shadow.offsetY != null ? shadow.offsetY : 12;
    const sb = shadow.blur    != null ? shadow.blur    : 18;
    const sc = rgbHex(shadow.color || "#000000");
    const so = Math.round((shadow.opacity != null ? shadow.opacity : 0.45) * 100);

    const presetKeys = ["none","drop","glow","curved","lift","angled","backdrop"];
    const presetLabels = { none:"None", drop:"Drop", glow:"Glow", curved:"Curved", lift:"Page lift", angled:"Angled", backdrop:"Backdrop" };
    const activeKey = shadowPresetKeyFor(el); // highlight the chosen preset
    const presetButtons = presetKeys.map(function (k) {
      return '<button type="button" class="ed-fx-preset' + (k === activeKey ? " is-current" : "") + '" data-shadow-preset="' + k + '" title="' + presetLabels[k] + '">' + presetLabels[k] + '</button>';
    }).join("");

    let out =
      '<div class="ed-props-section"><h4>Effects</h4>' +
        '<div class="ed-fx-preset-grid">' + presetButtons + '</div>' +
        '<label class="ed-fx-toggle"><input type="checkbox" data-fx="shadow-enabled"' + (sxOn ? " checked" : "") + '><span>Drop shadow</span></label>' +
        '<div class="ed-fx-controls" data-fx-group="shadow"' + (sxOn ? "" : ' hidden') + '>' +
          '<div class="ed-props-row">' +
            '<div class="ed-props-field"><label>Offset X</label><input type="range" min="-100" max="100" step="1" data-fx="shadow-offsetX" value="' + sx + '"></div>' +
            '<div class="ed-props-field"><label>Offset Y</label><input type="range" min="-100" max="100" step="1" data-fx="shadow-offsetY" value="' + sy + '"></div>' +
          '</div>' +
          '<div class="ed-props-row">' +
            '<div class="ed-props-field"><label>Blur</label><input type="range" min="0" max="80" step="1" data-fx="shadow-blur" value="' + sb + '"></div>' +
            '<div class="ed-props-field"><label>Intensity</label><input type="range" min="0" max="100" step="1" data-fx="shadow-opacity" value="' + so + '"></div>' +
          '</div>' +
          '<div class="ed-props-field"><label>Colour</label><input type="color" data-fx="shadow-color" value="' + sc + '"></div>' +
        '</div>';

    if (isText) {
      const og = el.textOutline || { width: 0, color: "#1c1d22" };
      out +=
        '<label class="ed-fx-toggle"><input type="checkbox" data-fx="outline-enabled"' + (og.width > 0 ? " checked" : "") + '><span>Outline</span></label>' +
        '<div class="ed-fx-controls" data-fx-group="outline"' + (og.width > 0 ? "" : ' hidden') + '>' +
          '<div class="ed-props-row">' +
            '<div class="ed-props-field"><label>Width</label><input type="range" min="0" max="20" step="1" data-fx="outline-width" value="' + (og.width || 0) + '"></div>' +
            '<div class="ed-props-field"><label>Colour</label><input type="color" data-fx="outline-color" value="' + rgbHex(og.color || "#1c1d22") + '"></div>' +
          '</div>' +
        '</div>';

      const bg = el.textBg || { enabled: false };
      out +=
        '<label class="ed-fx-toggle"><input type="checkbox" data-fx="bg-enabled"' + (bg.enabled ? " checked" : "") + '><span>Background</span></label>' +
        '<div class="ed-fx-controls" data-fx-group="bg"' + (bg.enabled ? "" : ' hidden') + '>' +
          '<div class="ed-props-row">' +
            '<div class="ed-props-field"><label>Colour</label><input type="color" data-fx="bg-color" value="' + rgbHex(bg.color || "#FFE066") + '"></div>' +
            '<div class="ed-props-field"><label>Roundness</label><input type="range" min="0" max="80" step="1" data-fx="bg-radius" value="' + (bg.radius || 6) + '"></div>' +
          '</div>' +
          '<div class="ed-props-row">' +
            '<div class="ed-props-field"><label>Spread X</label><input type="range" min="0" max="60" step="1" data-fx="bg-padX" value="' + (bg.padX || 12) + '"></div>' +
            '<div class="ed-props-field"><label>Spread Y</label><input type="range" min="0" max="60" step="1" data-fx="bg-padY" value="' + (bg.padY || 6) + '"></div>' +
          '</div>' +
        '</div>';

      const g = el.textGradient || { enabled: false };
      out +=
        '<label class="ed-fx-toggle"><input type="checkbox" data-fx="grad-enabled"' + (g.enabled ? " checked" : "") + '><span>Gradient fill</span></label>' +
        '<div class="ed-fx-controls" data-fx-group="grad"' + (g.enabled ? "" : ' hidden') + '>' +
          '<div class="ed-props-row">' +
            '<div class="ed-props-field"><label>From</label><input type="color" data-fx="grad-from" value="' + rgbHex(g.from || "#B9826A") + '"></div>' +
            '<div class="ed-props-field"><label>To</label><input type="color" data-fx="grad-to" value="' + rgbHex(g.to || "#474254") + '"></div>' +
          '</div>' +
          '<div class="ed-props-row">' +
            '<div class="ed-props-field"><label>Angle</label><input type="range" min="0" max="360" step="1" data-fx="grad-angle" value="' + (g.angle != null ? g.angle : 90) + '"></div>' +
            '<div class="ed-props-field"><label>Type</label>' +
              '<select data-fx="grad-type">' +
                '<option value="linear"' + (g.type === "linear" || !g.type ? " selected" : "") + '>Linear</option>' +
                '<option value="radial"' + (g.type === "radial" ? " selected" : "") + '>Radial</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
        '</div>';

      // The merge-tag picker used to live here too, but it's now rendered
      // as its own right-panel section (see renderProps) — keeps admins
      // from having to open a popover to insert a token.
    }

    out += '</div>';
    return out;
  }

  // Wire up the inputs rendered by renderEffectsSection. Called from the end
  // of renderProps after body.innerHTML is set.
  function bindEffectsInputs(body) {
    function tgt() { return getEl(state.selectedIds[0]); }
    function ensureGroup(el, key) {
      if (key === "shadow") {
        if (el.type === "text") return (el.textShadow = el.textShadow || defaultShadow());
        return (el.shadow = el.shadow || defaultShadow());
      }
      if (key === "outline")  return (el.textOutline  = el.textOutline  || defaultTextOutline());
      if (key === "bg")       return (el.textBg       = el.textBg       || defaultTextBg());
      if (key === "grad")     return (el.textGradient = el.textGradient || defaultTextGradient());
      return null;
    }
    function syncToggle(el, key, on) {
      // Persist the on/off bit on the relevant group object so reloads pick
      // it up exactly as the user left it.
      if (key === "shadow") {
        const g = ensureGroup(el, "shadow");
        g.enabled = on;
      } else if (key === "outline") {
        if (!on) el.textOutline = { width: 0, color: el.textOutline ? el.textOutline.color : "#1c1d22" };
        else { const g = ensureGroup(el, "outline"); if (!g.width) g.width = 2; }
      } else if (key === "bg") {
        const g = ensureGroup(el, "bg");
        g.enabled = on;
      } else if (key === "grad") {
        const g = ensureGroup(el, "grad");
        g.enabled = on;
      }
    }

    // Shadow preset grid
    body.querySelectorAll("[data-shadow-preset]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const el = tgt(); if (!el) return;
        const key = btn.getAttribute("data-shadow-preset");
        const preset = SHADOW_PRESETS[key];
        const targetKey = el.type === "text" ? "textShadow" : "shadow";
        if (!preset) {
          if (el[targetKey]) el[targetKey].enabled = false;
        } else {
          el[targetKey] = Object.assign({ enabled: true }, preset);
        }
        pushHistory();
        fullRender();
      });
    });

    // Toggles
    body.querySelectorAll('[data-fx$="-enabled"]').forEach(function (chk) {
      chk.addEventListener("change", function () {
        const el = tgt(); if (!el) return;
        const key = chk.getAttribute("data-fx").replace(/-enabled$/, "");
        syncToggle(el, key, chk.checked);
        // Hide/show the controls panel without a full re-render to avoid
        // resetting focus on the checkbox.
        const group = body.querySelector('[data-fx-group="' + key + '"]');
        if (group) group.hidden = !chk.checked;
        pushHistory();
        fullRender();
      });
    });

    // Sliders / colours / selects — generic input binding.
    body.querySelectorAll('[data-fx]:not([data-fx$="-enabled"]):not([data-fx="mergetag-pick"])').forEach(function (input) {
      const ev = (input.type === "range" || input.type === "color") ? "input" : "change";
      input.addEventListener(ev, function () {
        const el = tgt(); if (!el) return;
        const raw = input.getAttribute("data-fx");
        const dash = raw.indexOf("-");
        const groupKey = raw.slice(0, dash);
        const fieldKey = raw.slice(dash + 1);
        const group = ensureGroup(el, groupKey);
        if (!group) return;
        if (input.type === "range" || input.type === "number") {
          let v = parseFloat(input.value);
          if (fieldKey === "opacity") v = v / 100;
          group[fieldKey] = v;
        } else {
          group[fieldKey] = input.value;
        }
        // This simple from/to editor is 2-stop; clear any multi-stop array set
        // by the rich gradient builder so its edits actually take effect.
        if (groupKey === "grad") group.stops = null;
        // Outline doesn't have an enabled flag — its presence is governed by
        // width > 0. Mirror the checkbox state if the user nudges width.
        if (groupKey === "outline" && fieldKey === "width") {
          const chk = body.querySelector('[data-fx="outline-enabled"]');
          if (chk) chk.checked = group.width > 0;
        }
        fullRender();
        if (input.type !== "range") pushHistory();
      });
      if (input.type === "range") {
        input.addEventListener("change", function () { pushHistory(); });
      }
    });

    // Merge-tag insert (admin only)
    const tagPicker = body.querySelector('[data-fx="mergetag-pick"]');
    if (tagPicker) {
      tagPicker.addEventListener("change", function () {
        const el = tgt();
        const key = tagPicker.value;
        if (!el || el.type !== "text" || !key) return;
        const token = "{" + key + "}";
        el.text = (el.text ? el.text + " " : "") + token;
        tagPicker.value = "";
        pushHistory();
        fullRender();
      });
    }
  }

  // ---------- Context bar (top, when element selected) ----------
  function renderContextBar() {
    // Remember which panel was open, then take the old ones down with their
    // buttons. Restored at the end against the newly selected element.
    const reopen = _reopenPopoverKey || _openPopoverKey;
    const reopenColor = _reopenColorKey;
    _reopenColorKey = null;
    disposePopovers();
    if (state.selectedIds.length !== 1) {
      ctxEl.hidden = true;
      _reopenPopoverKey = null;
      return;
    }
    const el = getEl(state.selectedIds[0]);
    if (!el) { ctxEl.hidden = true; _reopenPopoverKey = null; return; }
    ctxEl.hidden = false;
    ctxEl.innerHTML = "";
    _reopenPopoverKey = reopen;

    if (el.type === "text") {
      // Row order: font · size · colour. Weight now lives in the Text side panel
      // (click the font name), so it's off the toolbar entirely. A roomier gap
      // here gives these three controls space to breathe.
      const g1 = group();
      g1.style.gap = "10px";
      g1.appendChild(createFontPicker(el.font, function (name) {
        el.font = name; fullRender(); pushHistory();
      }, { onOpen: function () { openFontPanel(el); } }));
      g1.appendChild(createSizeControl(el.size, function (v) { el.size = v; fullRender(); pushHistory(); }));
      // Colour — sits next to size now (opens the rich solid/gradient panel).
      g1.appendChild(colorSwatchButton(
        function () { return el.color; },
        {
          title: "Text colour",
          onSolid: function (hex) { el.color = hex; el.textGradient = null; },
          onGradient: function (g) { el.textGradient = { enabled: true, type: g.type || "linear", angle: g.angle != null ? g.angle : 135, stops: g.stops, from: g.from, to: g.to, fromStop: g.fromStop, toStop: g.toStop }; },
          getGradient: function () { return el.textGradient; },
        }
      ));
      ctxEl.appendChild(g1);

      // B I U — Bold applies to the selected text while editing (per-word),
      // else toggles the whole element's weight. Ctrl+B does the same.
      const g2 = group();
      const boldBtn = document.createElement("button");
      boldBtn.type = "button";
      boldBtn.className = "ed-ctx-btn" + ((el.weight || 400) >= 700 ? " is-on" : "");
      boldBtn.textContent = "B";
      boldBtn.title = "Bold (Ctrl+B)";
      // Don't steal focus from the editing box — keeps the text selection alive
      // through the click so execCommand('bold') has something to act on.
      boldBtn.addEventListener("mousedown", function (e) { if (editingInnerFor(el)) e.preventDefault(); });
      boldBtn.addEventListener("click", function () { applyBold(el, boldBtn); });
      g2.appendChild(boldBtn);
      g2.appendChild(toggleBtn("I", !!el.italic, () => {
        el.italic = !el.italic; fullRender(); pushHistory();
      }, "Italic"));
      g2.appendChild(toggleBtn("U", !!el.underline, () => {
        el.underline = !el.underline; fullRender(); pushHistory();
      }, "Underline"));
      ctxEl.appendChild(g2);

      // Align (bigger, no arrow — cycles) + Spacing (one popover: letter + line).
      const ALIGN_CYCLE = ["left", "center", "right", "justify"];
      const ALIGN_LABEL = { left: "Left", center: "Centre", right: "Right", justify: "Justified" };
      const g3 = group();
      const curAlign = ALIGN_CYCLE.indexOf(el.align) >= 0 ? el.align : "left";
      const alignBtn = document.createElement("button");
      alignBtn.className = "ed-ctx-btn ed-ctx-btn-align";
      alignBtn.innerHTML = alignIconSvg(curAlign);
      alignBtn.title = "Alignment: " + ALIGN_LABEL[curAlign] + " — click to cycle";
      alignBtn.addEventListener("click", function () {
        const i = ALIGN_CYCLE.indexOf(el.align) >= 0 ? ALIGN_CYCLE.indexOf(el.align) : 0;
        el.align = ALIGN_CYCLE[(i + 1) % ALIGN_CYCLE.length];
        fullRender(); pushHistory();
      });
      g3.appendChild(alignBtn);
      g3.appendChild(spacingPopover(el));
      ctxEl.appendChild(g3);
    } else if (el.type === "screen") {
      /* A screen's own controls live in the Selection panel on the left, not
         up here. There are enough of them - colour, fit, angle, zoom, position
         - that a row of popovers was the wrong home: they are what you are
         working on while a screen is selected, not things you dip into. */

    } else if (el.type === "rect" || el.type === "ellipse" || el.type === "triangle" || el.type === "star" || el.type === "line") {
      // Fill — opens the rich colour panel.
      const g = group();
      g.appendChild(colorSwatchButton(
        function () { return el.fill; },
        {
          title: "Fill",
          onSolid: function (hex) { el.fill = hex; el.fillGradient = null; },
          onGradient: function (gr) { el.fillGradient = { enabled: true, type: gr.type || "linear", angle: gr.angle != null ? gr.angle : 135, stops: gr.stops, from: gr.from, to: gr.to, fromStop: gr.fromStop, toStop: gr.toStop }; },
          getGradient: function () { return el.fillGradient; },
        }
      ));
      ctxEl.appendChild(g);

      // Stroke — icon-only trigger; click opens a popover with colour
      // + width. Same UX shape as opacity below.
      const strokeWrap = popoverIconButton({
        icon: ICONS.stroke,
        title: "Stroke",
        key: "stroke",
        render: function () {
          const panel = document.createElement("div");
          panel.className = "ed-pop-panel";
          panel.innerHTML =
            '<div class="ed-pop-row"><span>Stroke colour</span></div>' +
            '<div class="ed-pop-row" data-mount="stroke-color"></div>' +
            '<div class="ed-pop-row"><span>Width</span></div>' +
            '<div class="ed-pop-row">' +
              '<input type="range" min="0" max="40" step="1" value="' + (el.strokeWidth || 0) + '" data-stroke-w />' +
              '<output data-stroke-out>' + (el.strokeWidth || 0) + 'px</output>' +
            '</div>';
          const mount = panel.querySelector('[data-mount="stroke-color"]');
          mount.appendChild(circleColorInput(
            el.stroke && el.stroke !== "transparent" ? el.stroke : "#000000",
            function (hex) {
              el.stroke = hex;
              // If user picks a colour but has no width, give it 2px so the change is visible.
              if (!el.strokeWidth) {
                el.strokeWidth = 2;
                panel.querySelector("[data-stroke-w]").value = "2";
                panel.querySelector("[data-stroke-out]").textContent = "2px";
              }
            }, "Stroke colour"
          ));
          const r = panel.querySelector("[data-stroke-w]");
          const o = panel.querySelector("[data-stroke-out]");
          r.addEventListener("input", function () {
            el.strokeWidth = parseInt(r.value, 10) || 0;
            if (el.strokeWidth > 0 && (!el.stroke || el.stroke === "transparent")) el.stroke = "#000000";
            o.textContent = el.strokeWidth + "px";
            fullRender();
          });
          r.addEventListener("change", function () { pushHistory(); });
          return panel;
        },
      });
      ctxEl.appendChild(strokeWrap);

      // Corner radius — same popover pattern for rectangles only.
      if (el.type === "rect") {
        const radiusWrap = popoverIconButton({
          icon: ICONS.radius,
          title: "Corner radius",
          key: "radius",
          render: function () {
            const panel = document.createElement("div");
            panel.className = "ed-pop-panel";
            const max = Math.min(el.w, el.h) / 2;
            panel.innerHTML =
              '<div class="ed-pop-row"><span>Corner radius</span></div>' +
              '<div class="ed-pop-row">' +
                '<input type="range" min="0" max="' + max + '" step="1" value="' + (el.radius || 0) + '" data-radius />' +
                '<output data-radius-out>' + (el.radius || 0) + 'px</output>' +
              '</div>';
            const r = panel.querySelector("[data-radius]");
            const o = panel.querySelector("[data-radius-out]");
            r.addEventListener("input", function () {
              el.radius = parseInt(r.value, 10) || 0;
              o.textContent = el.radius + "px";
              fullRender();
            });
            r.addEventListener("change", function () { pushHistory(); });
            return panel;
          },
        });
        ctxEl.appendChild(radiusWrap);
      }
    } else if (el.type === "image") {
      const g = group();

      // Background remover — runs in the browser via @imgly. First click on
      // any session downloads ~30MB of model (cached after), then 1-3s per
      // image to process. Replaces el.src with a transparent PNG data URL.
      const bgBtn = document.createElement("button");
      bgBtn.className = "ed-ctx-btn";
      bgBtn.textContent = "Remove background";
      bgBtn.title = "Cut out the subject — works best on people / products against a clear background.";
      bgBtn.addEventListener("click", () => runBackgroundRemoval(el, bgBtn));
      g.appendChild(bgBtn);

      const btn = document.createElement("button");
      btn.className = "ed-ctx-btn";
      btn.textContent = "Replace image";
      btn.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file"; input.accept = "image/*";
        input.onchange = () => {
          const file = input.files[0]; if (!file) return;
          fileToWebImage(file).then((src) => { if (!src) return; el.src = src; pushHistory(); fullRender(); });
        };
        input.click();
      });
      g.appendChild(btn);
      ctxEl.appendChild(g);
    }

    // ===== Common controls — position, effects, opacity, duplicate, delete =====
    // Z-order (bring forward / send back) moved to the right-click menu.
    // Lock is admin-only — hidden in the customer flow.

    // Centre on the page — drop the element onto the vertical centre line
    // (horizontal centre), the horizontal centre line (vertical centre), or
    // both for dead centre. (A handy thing even Canva doesn't offer.)
    const gCentre = group();
    const vBtn = document.createElement("button");
    vBtn.type = "button"; vBtn.className = "ed-ctx-btn";
    vBtn.title = "Centre on the vertical line";
    vBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="7.5" y="6" width="9" height="12" rx="1" fill="currentColor" stroke="none" opacity="0.25"/><line x1="12" y1="2.5" x2="12" y2="21.5"/></svg>';
    vBtn.addEventListener("click", function () { alignSelected("centerX"); });
    const hBtn = document.createElement("button");
    hBtn.type = "button"; hBtn.className = "ed-ctx-btn";
    hBtn.title = "Centre on the horizontal line";
    hBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="7.5" width="12" height="9" rx="1" fill="currentColor" stroke="none" opacity="0.25"/><line x1="2.5" y1="12" x2="21.5" y2="12"/></svg>';
    hBtn.addEventListener("click", function () { alignSelected("centerY"); });
    gCentre.appendChild(vBtn);
    gCentre.appendChild(hBtn);
    ctxEl.appendChild(gCentre);

    // Position — text-label popover trigger. Holds X / Y / W / H / Rotation
    // numeric inputs. Lives on the top bar so the right-panel rail doesn't
    // have to dedicate a section to controls people only reach for sometimes.
    const positionWrap = popoverIconButton({
      icon: '<span class="ed-ctx-poplabel">Position</span>',
      title: "Position & size",
      key: "position",
      render: function () {
        const panel = document.createElement("div");
        panel.className = "ed-pop-panel ed-pop-form";
        panel.innerHTML =
          '<div class="ed-props-row">' +
            '<div class="ed-props-field"><label>X</label><input type="number" data-prop="x" value="' + el.x + '"></div>' +
            '<div class="ed-props-field"><label>Y</label><input type="number" data-prop="y" value="' + el.y + '"></div>' +
          '</div>' +
          '<div class="ed-props-row ed-props-row--wh">' +
            '<div class="ed-props-field"><label>Width</label><input type="number" id="ed-pos-w" value="' + el.w + '"></div>' +
            '<button type="button" class="ed-ratio-lock' + (ratioLocked ? " is-on" : "") + '" id="ed-pos-lock"' +
              ' aria-pressed="' + (ratioLocked ? "true" : "false") + '"' +
              ' title="' + (ratioLocked ? "Ratio locked — click to unlock" : "Lock the ratio") + '">' +
              (ratioLocked ? LOCK_SHUT : LOCK_OPEN) + '</button>' +
            '<div class="ed-props-field"><label>Height</label><input type="number" id="ed-pos-h" value="' + el.h + '"></div>' +
          '</div>' +
          '<div class="ed-props-row">' +
            '<div class="ed-props-field"><label>Rotation</label><input type="number" data-prop="rotation" value="' + (el.rotation || 0) + '"></div>' +
            '<div class="ed-props-field"></div>' +
          '</div>';
        bindGenericPropInputs(panel);
        bindRatioPair(panel);
        return panel;
      },
    });
    ctxEl.appendChild(positionWrap);

    // Effects — text-label popover trigger. Reuses renderEffectsSection so
    // the markup matches what the right panel used to show. Skipped for
    // line elements (no useful shadow on a 1-axis line).
    if (el.type !== "line") {
      const effectsWrap = popoverIconButton({
        icon: '<span class="ed-ctx-poplabel">Effects</span>',
        title: "Effects",
        key: "effects",
        render: function () {
          const panel = document.createElement("div");
          panel.className = "ed-pop-panel ed-pop-form ed-pop-effects";
          panel.innerHTML = renderEffectsSection(el);
          bindEffectsInputs(panel);
          return panel;
        },
      });
      // Highlight the trigger when this layer already carries an effect, so it's
      // obvious at a glance which layers have shadows/outlines/etc.
      if (elementHasEffect(el)) {
        const trig = effectsWrap.querySelector(".ed-pop-trigger");
        if (trig) trig.classList.add("ed-fx-active");
      }
      ctxEl.appendChild(effectsWrap);
    }

    // Opacity — icon trigger, popover with a transparency slider.
    const opacityWrap = popoverIconButton({
      icon: ICONS.opacity,
      title: "Transparency",
      key: "opacity",
      render: function () {
        const panel = document.createElement("div");
        panel.className = "ed-pop-panel";
        const val = Math.round((el.opacity != null ? el.opacity : 1) * 100);
        panel.innerHTML =
          '<div class="ed-pop-row"><span>Transparency</span></div>' +
          '<div class="ed-pop-row">' +
            '<input type="range" min="0" max="100" step="1" value="' + val + '" data-opacity />' +
            '<input type="number" min="0" max="100" step="1" value="' + val + '" data-opacity-num ' +
              'style="width:52px;text-align:right;border:1px solid rgba(28,29,34,0.18);border-radius:6px;padding:4px 6px;font:inherit;" />' +
            '<span style="opacity:0.55;font-size:12px;">%</span>' +
          '</div>';
        const r = panel.querySelector("[data-opacity]");
        const n = panel.querySelector("[data-opacity-num]");
        // Slider and the typable % box stay in sync; either updates the element.
        function applyOpacity(pct, fromNum) {
          pct = Math.max(0, Math.min(100, Math.round(isNaN(pct) ? 100 : pct)));
          el.opacity = pct / 100;
          r.value = pct;
          if (!fromNum) n.value = pct;
          partialRenderElement(el);
        }
        r.addEventListener("input", function () { applyOpacity(parseInt(r.value, 10), false); });
        n.addEventListener("input", function () { applyOpacity(parseInt(n.value, 10), true); });
        r.addEventListener("change", function () { pushHistory(); });
        n.addEventListener("change", function () { n.value = Math.round((el.opacity != null ? el.opacity : 1) * 100); pushHistory(); });
        return panel;
      },
    });
    ctxEl.appendChild(opacityWrap);

    const gA = group();
    /* Flip. Moved down from the global bar, where it sat next to undo and zoom
       as though it were about the whole design - it has only ever acted on the
       selection, and up there it could only tell you off for not having one. */
    const flipBtn = document.createElement("button");
    flipBtn.type = "button";
    flipBtn.className = "ed-ctx-btn";
    flipBtn.title = "Flip horizontally (right-click for vertical)";
    flipBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>' +
      '<polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
    flipBtn.addEventListener("click", function () { flipSelected("h"); });
    gA.appendChild(flipBtn);

    // Duplicate — labelled button (user explicitly asked for text, not icon).
    const dupBtn = document.createElement("button");
    dupBtn.type = "button";
    dupBtn.className = "ed-ctx-btn ed-ctx-btn-text";
    dupBtn.textContent = "Duplicate";
    dupBtn.title = "Duplicate (Ctrl+D)";
    dupBtn.addEventListener("click", duplicateSelected);
    gA.appendChild(dupBtn);

    // Lock — admin only.
    if (isAdminMode()) {
      gA.appendChild(toggleBtn(el.locked ? "🔒" : "🔓", el.locked, function () {
        el.locked = !el.locked; pushHistory(); fullRender();
      }, "Lock"));
    }

    // (Delete removed from the toolbar — use Backspace/Del or right-click → Delete.)

    ctxEl.appendChild(gA);

    // Put back the panel that was open before this rebuild, now reading the
    // element you just clicked. Recolouring or nudging several items in a row
    // is the common case, so the panel is dismissed deliberately rather than
    // by the act of selecting the next thing. If the new element has no such
    // control (no Effects on a line, say) it simply stays closed.
    if (_reopenPopoverKey) {
      const want = _reopenPopoverKey;
      const entry = _livePopovers.filter(function (p) { return p.key === want; })[0];
      _reopenPopoverKey = null;
      if (entry) entry.open();
    } else if (reopenColor) {
      // Only ever set by a selection change, so picking a colour doesn't
      // rebuild the panel under your cursor.
      const sw = _liveSwatches.filter(function (p) { return p.key === reopenColor; })[0];
      if (sw) sw.open();
    }

    function group() {
      const g = document.createElement("div");
      g.className = "ed-ctx-group";
      return g;
    }
    function label(t) {
      const s = document.createElement("span");
      s.className = "ed-ctx-label";
      s.textContent = t;
      return s;
    }
    function toggleBtn(label, on, onClick, title) {
      const b = document.createElement("button");
      b.className = "ed-ctx-btn" + (on ? " is-on" : "");
      b.textContent = label;
      b.title = title || "";
      b.addEventListener("click", onClick);
      return b;
    }
    function alignIcon(a) {
      return a === "left" ? "≡↤" : a === "center" ? "≡" : a === "right" ? "≡↦" : "≣";
    }
    // Crisp SVG alignment icons (no directional arrow — clearer than the glyphs).
    function alignIconSvg(a) {
      const lines = {
        left:    [[3, 21], [3, 15], [3, 19], [3, 13]],
        center:  [[4, 20], [7, 17], [5, 19], [8, 16]],
        right:   [[3, 21], [9, 21], [5, 21], [11, 21]],
        justify: [[3, 21], [3, 21], [3, 21], [3, 21]],
      }[a] || [[3, 21], [3, 15], [3, 19], [3, 13]];
      const ys = [6, 11, 16, 21];
      const rows = lines.map(function (l, i) {
        return '<line x1="' + l[0] + '" y1="' + ys[i] + '" x2="' + l[1] + '" y2="' + ys[i] + '"/>';
      }).join("");
      return '<svg viewBox="0 0 24 27" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' + rows + "</svg>";
    }
  }

  // ---------- Layers ----------
  function renderLayers() {
    layersEl.innerHTML = "";
    for (let i = state.elements.length - 1; i >= 0; i--) {
      const el = state.elements[i];
      const li = document.createElement("li");
      li.className = "ed-layer";
      if (state.selectedIds.includes(el.id)) li.classList.add("is-selected");

      const thumb = document.createElement("div");
      thumb.className = "ed-layer-thumb";
      if (el.type === "image" || (el.type === "screen" && el.src)) {
        const img = document.createElement("img");
        img.src = el.src; thumb.appendChild(img);
      } else if (el.type === "text") {
        thumb.textContent = "T";
      } else if (el.type === "screen") {
        thumb.textContent = "\u25F1";
      } else thumb.style.background = el.fill || "#999";

      const name = document.createElement("div");
      name.className = "ed-layer-name";
      name.textContent = layerName(el);

      const hideBtn = document.createElement("button");
      hideBtn.className = "ed-layer-action" + (el.hidden ? "" : " is-on");
      hideBtn.innerHTML = el.hidden
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      hideBtn.title = el.hidden ? "Show" : "Hide";
      hideBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        el.hidden = !el.hidden;
        pushHistory();
        fullRender();
      });

      const lockBtn = document.createElement("button");
      lockBtn.className = "ed-layer-action" + (el.locked ? " is-on" : "");
      lockBtn.innerHTML = el.locked
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
      lockBtn.title = el.locked ? "Unlock" : "Lock";
      lockBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        el.locked = !el.locked;
        pushHistory();
        fullRender();
      });

      li.appendChild(thumb);
      li.appendChild(name);
      li.appendChild(hideBtn);
      li.appendChild(lockBtn);

      li.addEventListener("click", () => {
        if (li._dragged) { li._dragged = false; return; }   // a drag, not a click
        state.selectedIds = [el.id];
        fullRender();
      });

      li.dataset.id = el.id;
      bindLayerDrag(li, el);
      layersEl.appendChild(li);
    }
  }

  /* Drag to reorder. The panel has always said you could; nothing was ever
     wired to it, so the rows only ever selected.

     Pointer events rather than HTML5 drag-and-drop: the canvas already uses
     them for everything else, and native DnD brings a drag image and drop
     effects that fight a list this small. Rows are reordered in the DOM as you
     move, so what you see is the result, and the final order is read back off
     the DOM once — no index arithmetic mid-drag.

     The list is drawn top-of-canvas first, which is the REVERSE of
     state.elements, so the readback reverses again to put it back. */
  function bindLayerDrag(li, el) {
    li.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      if (ev.target.closest(".ed-layer-action")) return;   // hide / lock
      ev.preventDefault();

      const startY = ev.clientY;
      let moved = false;

      /* Listeners go on the document, NOT the row, and there is no
         setPointerCapture. Both matter: reordering moves this row in the DOM,
         and moving a node releases any pointer capture it holds — so a
         captured row stopped receiving events the instant it was reordered,
         and the drag died after the first step. Dispatching events straight at
         the row in a test hides this completely, which is how it got through. */
      function onMove(e) {
        if (!moved && Math.abs(e.clientY - startY) < 4) return;   // still a click
        if (!moved) { moved = true; li.classList.add("is-dragging"); layersEl.classList.add("is-reordering"); }

        // The row under the pointer decides where this one goes: above it when
        // the pointer is in its top half, below when in its bottom.
        const rows = [...layersEl.children].filter((r) => r !== li);
        for (const row of rows) {
          const b = row.getBoundingClientRect();
          if (e.clientY >= b.top && e.clientY <= b.bottom) {
            const before = e.clientY < b.top + b.height / 2;
            layersEl.insertBefore(li, before ? row : row.nextSibling);
            break;
          }
        }
      }

      function onUp() {
        document.removeEventListener("pointermove", onMove, true);
        document.removeEventListener("pointerup", onUp, true);
        document.removeEventListener("pointercancel", onUp, true);
        li.classList.remove("is-dragging");
        layersEl.classList.remove("is-reordering");
        if (!moved) return;
        li._dragged = true;   // stops the click handler re-selecting

        // Read the order off the DOM and reverse it: top of the list is the top
        // of the canvas, which is the END of state.elements.
        const order = [...layersEl.children].map((r) => r.dataset.id).reverse();
        const byId = {};
        state.elements.forEach((x) => { byId[x.id] = x; });
        const next = order.map((id) => byId[id]).filter(Boolean);
        if (next.length === state.elements.length) {
          state.elements = next;
          pushHistory();
          fullRender();
        } else {
          fullRender();   // something was missing — put the rows back
        }
      }

      document.addEventListener("pointermove", onMove, true);
      document.addEventListener("pointerup", onUp, true);
      document.addEventListener("pointercancel", onUp, true);
    });
  }

  function layerName(el) {
    if (el.type === "text") return el.text ? (el.text.slice(0, 28) + (el.text.length > 28 ? "…" : "")) : "Text";
    if (el.type === "image") return "Image";
    if (el.type === "screen") return "Screen" + (el.src ? "" : " (empty)");
    if (el.type === "frame") {
      const shape = (el.frameShape || "square");
      const cap = shape.charAt(0).toUpperCase() + shape.slice(1);
      return cap + " frame" + (el.src ? "" : " (empty)");
    }
    if (el.type === "rect") return el.radius >= Math.min(el.w, el.h) / 2 ? "Pill" : "Rectangle";
    if (el.type === "ellipse") return "Ellipse";
    if (el.type === "triangle") return "Triangle";
    if (el.type === "star") return "Star";
    if (el.type === "line") return "Line";
    return el.type;
  }

  // ---------- Template grid in panel ----------
  function renderTemplateGrid() {
    if (tplGridEl.children.length) {
      tplGridEl.querySelectorAll("button").forEach((b) => {
        b.classList.toggle("is-current", b.dataset.id === state.templateId);
      });
      return;
    }
    PACK_TEMPLATES.forEach((t) => {
      const b = document.createElement("button");
      b.dataset.id = t.id;
      b.title = t.name;
      if (t.id === state.templateId) b.classList.add("is-current");
      const img = document.createElement("img");
      img.src = t.thumb;
      img.loading = "lazy";
      img.alt = t.name;
      b.appendChild(img);
      b.addEventListener("click", async () => {
        if (state.templateId === t.id) return;
        if (!confirm("Switch to '" + t.name + "'? Unsaved edits to the current design will be discarded.")) return;
        // The switcher list is lightweight (no elements) so it scales to hundreds
        // of templates — pull this design's full data on demand before loading it.
        if ((!Array.isArray(t.elements) || !t.elements.length) && typeof window.__TMKE_FETCH_TEMPLATE__ === "function") {
          const prevOpacity = b.style.opacity;
          b.style.opacity = "0.5";
          try {
            const full = await window.__TMKE_FETCH_TEMPLATE__(t.id);
            if (full) { t.canvas = full.canvas; t.elements = full.elements; }
          } catch (_) {}
          b.style.opacity = prevOpacity || "";
        }
        loadTemplate(t.id, true);
      });
      tplGridEl.appendChild(b);
    });
  }

  function renderPhotoGrid() {
    PHOTOS.forEach((p) => {
      const b = document.createElement("button");
      b.title = p.name;
      const img = document.createElement("img");
      img.src = p.src;
      img.loading = "lazy";
      b.appendChild(img);
      b.addEventListener("click", () => addImage(p.src));
      // Drag the photo onto a frame to fill it. We also set text/plain
      // for browsers that won't accept text/uri-list (Firefox quirk).
      b.draggable = true;
      b.addEventListener("dragstart", (e) => {
        if (!e.dataTransfer) return;
        e.dataTransfer.setData("text/uri-list", p.src);
        e.dataTransfer.setData("text/plain", p.src);
        e.dataTransfer.effectAllowed = "copy";
      });
      photoGridEl.appendChild(b);
    });
  }

  // ---------- Brand pane ----------
  function applyBrandColour(hex) {
    const sel = selectedElements();
    if (!sel.length) {
      state.canvas.background = hex;
      pushHistory();
      fullRender();
      return;
    }
    sel.forEach(function (el) {
      if (el.type === "text") el.color = hex;
      else if (el.type === "image") { /* skip — colour doesn't apply */ }
      else el.fill = hex;
    });
    pushHistory();
    fullRender();
  }

  function renderBrandPane() {
    const empty = $("brand-empty");
    const loaded = $("brand-loaded");
    const companyEl = $("brand-company");
    const swatchGrid = $("brand-colour-grid");
    const fontList = $("brand-font-list");
    const logoGrid = $("brand-logo-grid");
    if (!swatchGrid) return;

    BRAND = loadBrand();
    FONTS = buildFonts();

    if (!BRAND || ((!BRAND.colors || !BRAND.colors.length) && (!BRAND.logos || !BRAND.logos.length) && (!BRAND.fonts || (!BRAND.fonts.heading && !BRAND.fonts.body)))) {
      if (empty) empty.hidden = false;
      if (loaded) loaded.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    if (loaded) loaded.hidden = false;
    if (companyEl) companyEl.textContent = BRAND.company || "Your brand kit";

    // Colours
    swatchGrid.innerHTML = "";
    (BRAND.colors || []).forEach(function (c) {
      const b = document.createElement("button");
      b.className = "ed-sw";
      b.style.background = c.hex;
      b.title = c.name + " — " + c.hex;
      if (/^#(f|F){3,6}$/.test(c.hex) || c.hex.toUpperCase() === "#FFFFFF") {
        b.style.border = "1px solid rgba(0,0,0,0.1)";
      }
      b.addEventListener("click", function () { applyBrandColour(c.hex); });
      swatchGrid.appendChild(b);
    });
    if (!BRAND.colors || !BRAND.colors.length) {
      swatchGrid.innerHTML = isAdminMode()
        ? '<p class="ed-brand-hint" style="grid-column:1/-1">No brand colours yet. <a href="/admin/fonts" target="_blank" rel="noopener" style="color:var(--english-violet); border-bottom:1px solid currentColor">Add some</a>.</p>'
        : '<p class="ed-brand-hint" style="grid-column:1/-1">No brand colours yet. <a href="/profile" style="color:var(--english-violet); border-bottom:1px solid currentColor">Add some</a>.</p>';
    }

    // Fonts
    fontList.innerHTML = "";
    if (BRAND.fonts) {
      [["heading", "Heading"], ["body", "Body"]].forEach(function (pair) {
        const key = pair[0], label = pair[1];
        const name = BRAND.fonts[key];
        if (!name) return;
        const btn = document.createElement("button");
        btn.className = "ed-brand-font";
        btn.innerHTML = '<div><div class="ed-brand-font-role">' + label + '</div><div class="ed-brand-font-name">' + name + '</div></div><span class="ed-brand-font-role">Apply</span>';
        btn.querySelector(".ed-brand-font-name").style.fontFamily = '"' + name + '", sans-serif';
        btn.addEventListener("click", function () {
          const sel = selectedElements().filter(function (e) { return e.type === "text"; });
          if (!sel.length) { toast("Select a text element first"); return; }
          sel.forEach(function (e) { e.font = name; });
          pushHistory();
          fullRender();
        });
        fontList.appendChild(btn);
      });
    }

    // Logos
    logoGrid.innerHTML = "";
    (BRAND.logos || []).forEach(function (lg) {
      const b = document.createElement("button");
      b.title = lg.name;
      const img = document.createElement("img");
      img.src = lg.src;
      img.style.objectFit = "contain";
      img.style.background = "#fff";
      b.appendChild(img);
      b.addEventListener("click", function () {
        // Add at canvas centre, preserving aspect ratio via natural image dimensions.
        const tmp = new Image();
        tmp.onload = function () {
          const max = 480;
          const ratio = tmp.naturalWidth / tmp.naturalHeight || 1;
          let w, h;
          if (ratio >= 1) { w = max; h = max / ratio; }
          else { h = max; w = max * ratio; }
          addElement({
            type: "image",
            x: state.canvas.width / 2 - w / 2,
            y: state.canvas.height / 2 - h / 2,
            w: Math.round(w), h: Math.round(h),
            src: lg.src,
            opacity: 1, rotation: 0,
          });
        };
        tmp.onerror = function () { addImage(lg.src); };
        tmp.src = lg.src;
      });
      logoGrid.appendChild(b);
    });
    if (!BRAND.logos || !BRAND.logos.length) {
      logoGrid.innerHTML = isAdminMode()
        ? '<p class="ed-brand-hint" style="grid-column:1/-1">No logos yet. <a href="/admin/fonts" target="_blank" rel="noopener" style="color:var(--english-violet); border-bottom:1px solid currentColor">Upload some</a>.</p>'
        : '<p class="ed-brand-hint" style="grid-column:1/-1">No logos yet. <a href="/profile" style="color:var(--english-violet); border-bottom:1px solid currentColor">Upload some</a>.</p>';
    }
    renderRebrand();
  }


  // ---------- Tool rail / panel switching ----------
  // The left panel now serves double duty: when an element is selected it
  // shows that element's properties (the "selection" pane), and when
  // nothing's selected it falls back to whichever tool tab the user
  // last clicked on the rail. `activeToolPane` remembers that fallback.
  let activeToolPane = "brand";
  function showPane(name) {
    document.querySelectorAll(".ed-panel-pane").forEach((p) => {
      p.classList.toggle("is-active", p.dataset.pane === name);
    });
  }
  document.querySelectorAll(".ed-rail-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ed-rail-btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const tool = btn.dataset.tool;
      activeToolPane = tool;
      showPane(tool);
      if (tool === "text") { placeSelectionBody(); renderTextList(); renderFontBrowser(); }
      else placeSelectionBody();
      if (tool === "elements") mountLogoSlotTool();
      if (tool === "brand") renderRebrand();
    });
  });

  // Customer Studio: a calm "choose something to edit" start panel is shown when
  // nothing is selected, instead of the brand kit. Its options just trigger the
  // matching rail tool. Admin (?mode=admin) keeps brand-kit-first, untouched.
  document.querySelectorAll("[data-start-tool]").forEach(function (b) {
    b.addEventListener("click", function () {
      var railBtn = document.querySelector('.ed-rail-btn[data-tool="' + b.dataset.startTool + '"]');
      if (railBtn) railBtn.click();
    });
  });
  if (!location.search.includes("mode=admin")) {
    activeToolPane = "start";
    showPane("start");
    document.querySelectorAll(".ed-rail-btn").forEach(function (b) { b.classList.remove("is-active"); });
    // Slim the rail toward the brief: "Photos" -> "Images". Background stays in
    // the customer rail too — it's a core design tool (also reachable via the
    // start panel + double-clicking the canvas).
    var _photosLbl = document.querySelector('.ed-rail-btn[data-tool="photos"] span');
    if (_photosLbl) _photosLbl.textContent = "Images";

    // Brand Kit gets its own tab with its own space, moved to sit just after
    // Layers (rather than sitting on top of the shapes/elements). Elements stays
    // a standalone "Elements" tab. Shape buttons are wired per-button, so they
    // keep working wherever the pane sits.
    var _brandBtn = document.querySelector('.ed-rail-btn[data-tool="brand"]');
    var _layersBtn = document.querySelector('.ed-rail-btn[data-tool="layers"]');
    if (_brandBtn && _layersBtn && _layersBtn.parentNode) {
      _layersBtn.parentNode.insertBefore(_brandBtn, _layersBtn.nextSibling);
      var _brandLbl = _brandBtn.querySelector("span");
      if (_brandLbl) _brandLbl.textContent = "Brand kit";
    }
    var _elemsLbl = document.querySelector('.ed-rail-btn[data-tool="elements"] span');
    if (_elemsLbl) _elemsLbl.textContent = "Elements";
  }

  // Open a tool pane programmatically (clears any selection so the pane shows).
  function openTool(name) {
    state.selectedIds = [];
    activeToolPane = name;
    document.querySelectorAll(".ed-rail-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.tool === name));
    showPane(name);
    fullRender();
  }
  // Double-click the empty canvas or the background photo → jump to Background.
  // (Element double-clicks call stopPropagation, so this only fires on the bg.)
  if (canvasEl) {
    canvasEl.addEventListener("dblclick", function (ev) {
      if (ev.target === canvasEl) openTool("background");
    });
  }

  // ---------- Text-panel font browser ----------
  // The toolbar's font name opens the Text side panel, which hosts a full
  // browser: search, your starred "brand fonts", every font, and a weight
  // picker for the selected text. Starring a font saves it to the brand kit.
  const FB_WEIGHTS = [[300, "Light"], [400, "Regular"], [500, "Medium"], [600, "Semibold"], [700, "Bold"], [800, "Extra bold"]];
  const FB_STAR_ON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,3 15,9.5 22,10.3 17,15 18.3,22 12,18.5 5.7,22 7,15 2,10.3 9,9.5"/></svg>';
  const FB_STAR_OFF = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><polygon points="12,3 15,9.5 22,10.3 17,15 18.3,22 12,18.5 5.7,22 7,15 2,10.3 9,9.5"/></svg>';

  // The text element the browser applies to: the selected text if any, else the
  // element the panel was opened for.
  function fontTextTarget() {
    const sel = selectedElements().filter((e) => e.type === "text");
    if (sel.length) return sel[0];
    const t = _fontTargetId && getEl(_fontTargetId);
    return (t && t.type === "text") ? t : null;
  }
  function fbSignature() {
    const el = fontTextTarget();
    return (el ? el.font + "|" + (el.weight || 400) : "none") + "|" + getFavFonts().join(",");
  }

  function renderFontBrowser() {
    const mount = document.getElementById("ed-font-browser");
    if (!mount || activeToolPane !== "text") return;
    _fbSig = fbSignature();
    const el = fontTextTarget();
    mount.innerHTML = "";

    const search = document.createElement("input");
    search.type = "search"; search.className = "ed-fb-search"; search.placeholder = "Search fonts…";
    mount.appendChild(search);

    const hint = document.createElement("p");
    hint.className = "ed-fb-hint";
    hint.textContent = el ? "Applying to the selected text layer." : "Select a text layer to change its font.";
    mount.appendChild(hint);

    if (el) {
      const wsec = document.createElement("div"); wsec.className = "ed-fb-weights";
      const wt = document.createElement("div"); wt.className = "ed-fb-title"; wt.textContent = "Weight";
      wsec.appendChild(wt);
      const chips = document.createElement("div"); chips.className = "ed-fb-chips";
      FB_WEIGHTS.forEach(function (w) {
        const c = document.createElement("button");
        c.type = "button";
        c.className = "ed-fb-chip" + ((el.weight || 400) == w[0] ? " is-on" : "");
        c.textContent = w[1]; c.style.fontWeight = w[0];
        c.addEventListener("click", function () {
          el.weight = w[0]; loadGoogleFont(el.font); fullRender(); pushHistory();
        });
        chips.appendChild(c);
      });
      wsec.appendChild(chips);
      mount.appendChild(wsec);
    }

    // The list is its own scroll area (CSS max-height + overflow) so the panel
    // stays compact instead of growing into a giant nav.
    const listWrap = document.createElement("div");
    listWrap.className = "ed-fb-list";
    mount.appendChild(listWrap);

    function fontByName(nm) {
      return FONTS.find(function (x) { return x.name === nm; }) || { name: nm, stack: '"' + nm + '", sans-serif' };
    }
    function rowFor(f, preview) {
      const row = document.createElement("div");
      row.className = "ed-fb-row" + (el && f.name === el.font ? " is-current" : "");
      const name = document.createElement("button");
      name.type = "button"; name.className = "ed-fb-name"; name.textContent = f.name;
      if (preview) { name.style.fontFamily = f.stack; loadGoogleFont(f.name); }
      name.addEventListener("click", function () {
        if (!el) { toast("Select a text layer first"); return; }
        loadGoogleFont(f.name); el.font = f.name; pushRecentFont(f.name);
        fullRender(); pushHistory();
      });
      const star = document.createElement("button");
      star.type = "button";
      const on = isFavFont(f.name);
      star.className = "ed-fb-star" + (on ? " is-on" : "");
      star.innerHTML = on ? FB_STAR_ON : FB_STAR_OFF;
      star.title = on ? "Remove from brand kit" : "Save to brand kit";
      star.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleFavFont(f.name);
        renderFontBrowser();   // refresh stars + the brand-fonts section
      });
      row.appendChild(name); row.appendChild(star);
      return row;
    }
    function sectionTitle(text) {
      const t = document.createElement("div"); t.className = "ed-fb-title"; t.textContent = text;
      listWrap.appendChild(t);
    }

    function build(query) {
      listWrap.innerHTML = "";
      const q = (query || "").trim().toLowerCase();
      // While searching, show one flat filtered list — sections only add noise.
      if (q) {
        let n = 0;
        FONTS.forEach(function (f) {
          if (f.name.toLowerCase().indexOf(q) === -1) return;
          listWrap.appendChild(rowFor(f, false)); n++;
        });
        if (!n) {
          const e = document.createElement("div"); e.className = "ed-fb-empty";
          e.textContent = 'No fonts matching "' + q + '".';
          listWrap.appendChild(e);
        }
        return;
      }
      // Sectioned view: Brand fonts → Recently picked → All fonts.
      // "Brand fonts" means the kit's own heading/body faces first — they were
      // only reachable by scrolling All fonts, which is not what a brand kit is
      // for — followed by anything starred here.
      const kit = [];
      if (BRAND && BRAND.fonts) {
        ["heading", "body"].forEach(function (role) {
          const nm = BRAND.fonts[role];
          if (nm && kit.indexOf(nm) === -1) kit.push(nm);
        });
      }
      const favs = getFavFonts().filter(function (nm) { return kit.indexOf(nm) === -1; });
      const brandList = kit.concat(favs);
      if (brandList.length) {
        sectionTitle(BRAND && BRAND.company ? BRAND.company + "’s fonts" : "Brand fonts");
        brandList.forEach(function (nm) { listWrap.appendChild(rowFor(fontByName(nm), true)); });
      }
      const recents = getRecentFonts().filter(function (nm) { return brandList.indexOf(nm) === -1; });
      if (recents.length) {
        sectionTitle("Recently picked");
        recents.forEach(function (nm) { listWrap.appendChild(rowFor(fontByName(nm), true)); });
      }
      sectionTitle("All fonts");
      FONTS.forEach(function (f) {
        listWrap.appendChild(rowFor(f, false)); // names in UI font — avoids loading 100s of webfonts
      });
    }
    build("");
    search.addEventListener("input", function () { build(search.value); });
  }

  // Cheap refresh from fullRender: only rebuild when the target/font/weight/
  // favourites actually changed, so dragging an element doesn't rebuild the list.
  function maybeRefreshFontBrowser() {
    if (activeToolPane !== "text") return;
    const mount = document.getElementById("ed-font-browser");
    if (!mount) return;
    if (fbSignature() === _fbSig && mount.firstChild) return;
    renderFontBrowser();
  }

  // Open the Text panel focused on a text element's font (from the toolbar).
  // Keeps the element selected so the context bar + canvas highlight stay put.
  // Text pane tabs — On this page / Add text / Brand kit / Fonts. Keeps the
  // pane short instead of stacking every section into one long scroll.
  function setTextTab(name) {
    document.querySelectorAll(".ed-ttab").forEach((t) => t.classList.toggle("is-active", t.dataset.ttab === name));
    document.querySelectorAll(".ed-ttab-pane").forEach((p) => p.classList.toggle("is-active", p.dataset.ttabPane === name));
    if (name === "page") { placeSelectionBody(); renderTextList(); }
    if (name === "fonts") renderFontBrowser();
  }
  document.querySelectorAll(".ed-ttab").forEach((t) => {
    t.addEventListener("click", () => setTextTab(t.dataset.ttab));
  });

  function openFontPanel(el) {
    _fontTargetId = el ? el.id : null;
    activeToolPane = "text";
    document.querySelectorAll(".ed-rail-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.tool === "text"));
    showPane("text");
    // The browser lives behind the Fonts tab now — no scrolling-to-it needed.
    setTextTab("fonts");
  }

  // Admin authoring only: a Brand section at the head of Elements, so the logo
  // slot is placed from a control rather than drawn by hand.
  // Mounted on demand, not at load: isAdminMode() reads a hook the admin page
  // installs after this script runs, so checking it once on boot always said no.
  // The selection renderProps last drew, so it can tell a real selection change
  // from the many re-renders that leave it untouched.
  let _lastSelSig = null;
  /* Clicking an element on the canvas is an explicit "work on this" — the
     panel should show its controls even when that element was already
     selected and nothing technically changed. Without this, clicking a shape
     while the Elements or Brand pane was open left you looking at the wrong
     panel, and only the click that CHANGED the selection ever followed. */
  let _paneFollowClick = false;

  let _logoToolMounted = false;
  function mountLogoSlotTool() {
    if (_logoToolMounted || !isAdminMode()) return;
    const pane = document.querySelector('.ed-panel-pane[data-pane="elements"]');
    if (!pane) return;
    const head = pane.querySelector(".ed-pane-header");
    if (!head) return;
    const wrap = document.createElement("div");
    wrap.innerHTML =
      '<div class="ed-section-title">Brand</div>' +
      '<div class="ed-logoslot-row">' +
        '<button type="button" class="ed-logoslot-btn" data-logoslot="top">Logo slot &middot; top</button>' +
        '<button type="button" class="ed-logoslot-btn" data-logoslot="bottom">Logo slot &middot; foot</button>' +
      '</div>' +
      '<p class="ed-brand-hint">200 &times; 75, centred, 108px in. Holds {brand name} for members with no logo, and their mark for those who have one.</p>';
    head.insertAdjacentElement("afterend", wrap);
    wrap.querySelectorAll("[data-logoslot]").forEach(function (b) {
      b.addEventListener("click", function () { addLogoSlot(b.getAttribute("data-logoslot")); });
    });
    _logoToolMounted = true;
  }

  document.getElementById("ed-brandnudge-x")?.addEventListener("click", function () {
    document.getElementById("ed-brandnudge").hidden = true;
  });

  // ---------- Shapes / text / bg / swatches bindings ----------
  // A single .ed-shape button can carry data-shape (legacy CSS shapes),
  // data-frame (photo frame presets), or data-svg (SVG shape / icon).
  document.querySelectorAll(".ed-shape").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.screen) addScreen();
      else if (btn.dataset.frame) addFrame(btn.dataset.frame);
      else if (btn.dataset.svg) addSvgShape(btn.dataset.svg);
      else if (btn.dataset.shape) addShape(btn.dataset.shape);
    });
  });

  // Detach (clear) the canvas background image. The button lives in the
  // Background pane and is shown only when there's a background image
  // to remove — otherwise it'd be a confusing dead control.
  const detachBgBtn = $("ed-bg-detach");
  function syncDetachBgBtn() {
    if (!detachBgBtn) return;
    detachBgBtn.hidden = !state.canvas.backgroundImage;
  }
  detachBgBtn?.addEventListener("click", () => {
    if (!state.canvas.backgroundImage) return;
    setCanvasBackgroundImage(null);
    syncDetachBgBtn();
  });
  // Background-image transparency — slider + typable %, kept in sync. Lets you
  // dim a photo set as the background (then stack overlays/text on top).
  (function () {
    const rEl = $("ed-bg-opacity"), nEl = $("ed-bg-opacity-num");
    function setBgOpacity(pct, fromNum) {
      pct = Math.max(0, Math.min(100, Math.round(isNaN(pct) ? 100 : pct)));
      state.canvas.backgroundOpacity = pct / 100;
      if (rEl) rEl.value = pct;
      if (nEl && !fromNum) nEl.value = pct;
      fullRender();
    }
    if (rEl) {
      rEl.addEventListener("input", () => setBgOpacity(parseInt(rEl.value, 10), false));
      rEl.addEventListener("change", () => pushHistory());
    }
    if (nEl) {
      nEl.addEventListener("input", () => setBgOpacity(parseInt(nEl.value, 10), true));
      nEl.addEventListener("change", () => pushHistory());
    }
  })();
  document.querySelectorAll(".ed-text-add").forEach((btn) => {
    btn.addEventListener("click", () => addText(btn.dataset.text));
  });
  document.querySelectorAll(".ed-sw").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.canvas.background = btn.dataset.color;
      pushHistory();
      fullRender();
    });
  });
  // Background "Custom" circle → the rich hex colour panel (which also hosts the
  // gradient builder), instead of the native OS colour picker (which shows RGB).
  (function () {
    const wrap = $("ed-bg-color-wrap");
    if (!wrap) return;
    function isGradient(v) { return typeof v === "string" && v.indexOf("gradient") !== -1; }
    wrap.addEventListener("click", function (e) {
      e.stopPropagation();
      const bg = state.canvas.background;
      openColorPanel({
        title: "Background",
        current: isGradient(bg) ? "#F4F2F1" : bg,
        currentGradient: null,
        onSolid: function (hex) { state.canvas.background = hex; wrap.style.background = hex; fullRender(); pushHistory(); },
        onGradient: function (g) { state.canvas.background = gradCss(g); wrap.style.background = gradCss(g); fullRender(); pushHistory(); },
      });
    });
  })();
  document.querySelectorAll(".ed-grad").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.canvas.background = btn.dataset.grad;
      pushHistory();
      fullRender();
    });
  });

  // ---------- Background pane: change/upload image, fade tint, gradient menu, reposition ----------
  (function () {
    const changeBtn = $("ed-bg-change");
    const menu = $("ed-bg-imgmenu");
    const fileInput = $("ed-bg-upload");
    const repoBtn = $("ed-bg-reposition");
    const tintColor = $("ed-bg-tint-color");
    const gradCircle = $("ed-bg-grad");
    const gradMenu = $("ed-bg-gradmenu");

    function buildImgMenu() {
      if (!menu) return;
      const recent = (state.uploads || []).slice(-9).reverse();
      let html = recent.length
        ? '<div class="ed-bg-imgmenu-grid">' + recent.map((src, i) => '<button type="button" data-idx="' + i + '" style="background-image:url(' + JSON.stringify(src) + ')"></button>').join("") + '</div>'
        : '<p class="ed-bg-imgmenu-empty">No recent uploads yet.</p>';
      html += '<button type="button" class="ed-bg-imgmenu-upload" data-upload>Upload a new image</button>';
      menu.innerHTML = html;
      menu.querySelectorAll("[data-idx]").forEach((b) => b.addEventListener("click", () => {
        setCanvasBackgroundImage(recent[parseInt(b.dataset.idx, 10)]);
        menu.hidden = true;
      }));
      const up = menu.querySelector("[data-upload]");
      if (up) up.addEventListener("click", () => { menu.hidden = true; if (fileInput) fileInput.click(); });
    }
    if (changeBtn && menu) {
      changeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (menu.hidden) { buildImgMenu(); menu.hidden = false; } else menu.hidden = true;
      });
      document.addEventListener("click", (e) => {
        if (!menu.hidden && !menu.contains(e.target) && !changeBtn.contains(e.target)) menu.hidden = true;
      });
    }
    if (fileInput) {
      fileInput.addEventListener("change", () => {
        const f = fileInput.files && fileInput.files[0];
        fileInput.value = "";
        if (!f) return;
        fileToWebImage(f).then((src) => { if (!src) return; state.uploads.push(src); setCanvasBackgroundImage(src); });
      });
    }
    if (tintColor) {
      tintColor.addEventListener("input", () => { state.canvas.background = tintColor.value; fullRender(); });
      tintColor.addEventListener("change", () => pushHistory());
    }
    if (gradCircle && gradMenu) {
      gradCircle.addEventListener("click", (e) => { e.stopPropagation(); gradMenu.hidden = !gradMenu.hidden; });
      document.addEventListener("click", (e) => { if (!gradMenu.hidden && !gradMenu.contains(e.target) && !gradCircle.contains(e.target)) gradMenu.hidden = true; });
      gradMenu.querySelectorAll(".ed-grad").forEach((b) => b.addEventListener("click", () => { gradMenu.hidden = true; }));
    }
    if (repoBtn) repoBtn.addEventListener("click", () => { if (state.canvas.backgroundImage) enterBgReposition(); });

    // Fill / Fit toggle — "cover" crops to fill, "contain" shows the whole photo.
    const fitGroup = $("ed-bg-fit");
    if (fitGroup) fitGroup.querySelectorAll(".ed-bg-fit-btn").forEach((b) => b.addEventListener("click", () => {
      state.canvas.bgFit = b.getAttribute("data-bgfit");
      // Centre when switching so the result is predictable.
      state.canvas.bgPosX = 50; state.canvas.bgPosY = 50; state.canvas.bgScale = 1;
      fitGroup.querySelectorAll(".ed-bg-fit-btn").forEach((x) => x.classList.toggle("is-active", x === b));
      pushHistory();
      fullRender();
    }));
  })();

  // Background reposition (Canva-style): the whole photo is shown, dimmed
  // outside the frame, so you can drag it anywhere — left/right AND up/down —
  // and scroll to zoom. Exit on click-away / Escape.
  let _bgRepoActive = false;
  function enterBgReposition() {
    if (_bgRepoActive || !state.canvas.backgroundImage) return;
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));
    const start = () => {
      _bgRepoActive = true;
      state.selectedIds = [];
      state.selectedGuideId = null;
      fullRender();
      // Let the photo spill past the frame, and dim everything outside it.
      canvasEl.style.overflow = "visible";
      canvasEl.style.cursor = "move";
      /* Take the design out of the way for the duration.
         Two reasons, and the first is why this never worked over an overlay:
         an element's own pointerdown calls preventDefault to start its drag,
         and preventDefault on pointerdown suppresses the mousedown that
         follows — which is the event this listens for. So landing on anything
         covering the photo moved that thing and never began the reposition.
         pointer-events:none on the elements fixes the drag and stops you
         nudging the overlay by accident at the same time.
         Everything but text is also faded out, so you can see the photo you
         are placing. Text stays: it is what you are usually positioning the
         photo around. */
      canvasEl.classList.add("is-bg-repositioning");

      /* Give the photo somewhere to move before anyone tries to move it.
         The background is a COVER fit, so at scale 1 it is sized to exactly
         cover the canvas and there is nothing hidden to pan into — the drag
         then does nothing at all, which reads as broken. Scrolling used to be
         the only way out: zooming past 1 created the overflow and movement
         suddenly worked.
         So on entry, if either axis has less than a little headroom, the photo
         is scaled up just enough to give it some. Visible, undone by the same
         Escape that ends the mode, and it means clicking Reposition and
         dragging works immediately. */
      let nudged = false;
      (function ensureRoom() {
        const nw = state.canvas.bgNatW, nh = state.canvas.bgNatH;
        const fw = state.canvas.width, fh = state.canvas.height;
        if (!nw || !nh) return;
        const ROOM = 40;                       // px of travel to guarantee, each axis
        const base = state.canvas.bgFit === "contain"
          ? Math.min(fw / nw, fh / nh) : Math.max(fw / nw, fh / nh);
        const cur = state.canvas.bgScale ? Math.max(1, state.canvas.bgScale) : 1;
        const lay = bgLayout();
        if (lay && (lay.sw - fw) >= ROOM && (lay.sh - fh) >= ROOM) return;   // already free
        const needed = Math.max((fw + ROOM) / nw, (fh + ROOM) / nh) / base;
        if (needed > cur) { state.canvas.bgScale = Math.min(needed, 5); nudged = true; }
      })();
      const mask = document.createElement("div");
      mask.id = "ed-bg-repo-mask";
      mask.style.cssText =
        "position:absolute;inset:0;z-index:50;pointer-events:none;" +
        "box-shadow:0 0 0 9999px rgba(244,242,240,0.55);outline:2px solid var(--english-violet,#371e28);";
      mask.innerHTML =
        '<span style="position:absolute;left:33.333%;top:0;bottom:0;border-left:1px solid rgba(255,255,255,0.5)"></span>' +
        '<span style="position:absolute;left:66.666%;top:0;bottom:0;border-left:1px solid rgba(255,255,255,0.5)"></span>' +
        '<span style="position:absolute;top:33.333%;left:0;right:0;border-top:1px solid rgba(255,255,255,0.5)"></span>' +
        '<span style="position:absolute;top:66.666%;left:0;right:0;border-top:1px solid rgba(255,255,255,0.5)"></span>';
      canvasEl.appendChild(mask);
      toast(nudged
        ? "Drag to move the photo, scroll to zoom — zoomed in slightly so it has room to move"
        : "Drag to move the photo, scroll to zoom — click away or Esc when done", 3600);

      function applyBg() {
        const img = canvasEl.querySelector(".ed-canvas-bg");
        const lay = bgLayout();
        if (img && lay) {
          img.style.left = lay.ox + "px"; img.style.top = lay.oy + "px";
          img.style.width = lay.sw + "px"; img.style.height = lay.sh + "px";
          img.style.objectFit = "fill";
        }
      }
      let dragging = false, lastX = 0, lastY = 0;
      function down(ev) { if (ev.button !== 0) return; dragging = true; lastX = ev.clientX; lastY = ev.clientY; ev.preventDefault(); }
      function move(ev) {
        if (!dragging) return;
        const z = state.zoom || 1;
        const lay = bgLayout(); if (!lay) return;
        const overX = lay.sw - state.canvas.width, overY = lay.sh - state.canvas.height;
        const dX = (ev.clientX - lastX) / z, dY = (ev.clientY - lastY) / z;
        lastX = ev.clientX; lastY = ev.clientY;
        const bx = state.canvas.bgPosX != null ? state.canvas.bgPosX : 50;
        const by = state.canvas.bgPosY != null ? state.canvas.bgPosY : 50;
        if (overX > 1) state.canvas.bgPosX = cl(bx - dX / overX * 100, 0, 100);
        if (overY > 1) state.canvas.bgPosY = cl(by - dY / overY * 100, 0, 100);
        applyBg();
      }
      function up() { dragging = false; }
      function wheel(ev) {
        if (!canvasEl.contains(ev.target)) return;
        // Cmd/Ctrl + scroll is the design's own zoom everywhere else in the
        // editor; it keeps meaning that here rather than being swallowed.
        if (ev.metaKey || ev.ctrlKey) return;
        ev.preventDefault();
        const cur = state.canvas.bgScale ? Math.max(1, state.canvas.bgScale) : 1;
        state.canvas.bgScale = cl(cur * (ev.deltaY < 0 ? 1.08 : 1 / 1.08), 1, 5);
        applyBg();
      }
      function exit(ev) {
        if (ev && ev.type === "keydown" && ev.key !== "Escape") return;
        _bgRepoActive = false;
        canvasEl.removeEventListener("mousedown", down);
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        window.removeEventListener("wheel", wheel, { passive: false });
        document.removeEventListener("keydown", exit, true);
        document.removeEventListener("mousedown", outside, true);
        canvasEl.style.overflow = "";
        canvasEl.style.cursor = "";
        canvasEl.classList.remove("is-bg-repositioning");
        const m = document.getElementById("ed-bg-repo-mask"); if (m) m.remove();
        pushHistory();
        fullRender();
      }
      function outside(ev) { if (!canvasEl.contains(ev.target)) exit(); }
      canvasEl.addEventListener("mousedown", down);
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      window.addEventListener("wheel", wheel, { passive: false });
      document.addEventListener("keydown", exit, true);
      // Defer the click-away listener so the click that opened this doesn't exit it.
      setTimeout(() => document.addEventListener("mousedown", outside, true), 0);
    };
    // Need the photo's natural size for the layout maths — cache it first.
    if (state.canvas.bgNatW) { start(); }
    else {
      const probe = new Image();
      probe.crossOrigin = "anonymous";
      probe.onload = () => { state.canvas.bgNatW = probe.naturalWidth; state.canvas.bgNatH = probe.naturalHeight; start(); };
      probe.onerror = () => start();
      probe.src = state.canvas.backgroundImage;
    }
  }

  // ---------- Resize ----------
  document.querySelectorAll(".ed-resize-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [w, h] = btn.dataset.size.split(",").map(Number);
      state.canvas.width = w; state.canvas.height = h;
      pushHistory();
      fullRender();
      fitZoom();
    });
  });
  $("ed-resize-apply").addEventListener("click", () => {
    const w = parseInt($("ed-resize-w").value, 10);
    const h = parseInt($("ed-resize-h").value, 10);
    if (!w || !h) return;
    state.canvas.width = w; state.canvas.height = h;
    pushHistory();
    fullRender();
    fitZoom();
  });

  // ---------- Uploads ----------
  const uploadInput = $("ed-upload-input");
  uploadInput.addEventListener("change", () => handleFiles(uploadInput.files));
  const dropZone = document.querySelector(".ed-upload-drop");
  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("is-drag"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-drag"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("is-drag");
    handleFiles(e.dataTransfer.files);
  });

  // One tile in the uploads grid. `b.dataset.src` is the live source: it starts
  // as the data URL and is swapped to the stored URL once the upload lands, so
  // click/drag always use whatever is current.
  function addUploadTile(src) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ed-upload-tile";
    b.dataset.src = src;
    const img = document.createElement("img");
    img.src = src;
    b.appendChild(img);
    b.addEventListener("click", () => addImage(b.dataset.src));
    // Make uploaded photos draggable too so they can be dropped on frames
    b.draggable = true;
    b.addEventListener("dragstart", (e) => {
      if (!e.dataTransfer) return;
      e.dataTransfer.setData("text/uri-list", b.dataset.src);
      e.dataTransfer.setData("text/plain", b.dataset.src);
      e.dataTransfer.effectAllowed = "copy";
    });
    // Remove from the library (storage + grid). Designs already using the image
    // keep working — they reference the URL directly.
    const x = document.createElement("span");
    x.className = "ed-upload-x";
    x.title = "Remove from your uploads";
    x.setAttribute("aria-hidden", "true");
    x.textContent = "×";
    x.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = b.dataset.src;
      b.remove();
      state.uploads = state.uploads.filter((u) => u !== url);
      if (typeof window.__TMKE_UPLOAD_DELETE__ === "function") {
        try { await window.__TMKE_UPLOAD_DELETE__(url); } catch (_) {}
      }
    });
    b.appendChild(x);
    uploadGridEl.appendChild(b);
    return b;
  }

  function handleFiles(files) {
    Array.from(files || []).forEach((f) => {
      if (!f.type.startsWith("image/")) return;
      fileToWebImage(f).then(async (src) => {
        if (!src) return;
        state.uploads.push(src);
        const tile = addUploadTile(src);
        // Persist it so it's still here next time (signed-in members only).
        if (typeof window.__TMKE_UPLOAD_SAVE__ !== "function") return;
        let url = null;
        try { url = await window.__TMKE_UPLOAD_SAVE__(src); } catch (_) {}
        if (!url) return;   // signed out / upload failed → stays in-memory
        tile.dataset.src = url;
        const i = state.uploads.indexOf(src);
        if (i > -1) state.uploads[i] = url;
      });
    });
  }

  // Rehydrate the member's saved uploads on open, so they don't have to keep
  // re-uploading the same logos and imagery.
  (async function loadUploadLibrary() {
    if (typeof window.__TMKE_UPLOADS_LIST__ !== "function") return;
    let urls = [];
    try { urls = await window.__TMKE_UPLOADS_LIST__(); } catch (_) {}
    urls.forEach((u) => {
      if (state.uploads.includes(u)) return;
      state.uploads.push(u);
      addUploadTile(u);
    });
  })();

  // ---------- Drop a photo/upload anywhere on the canvas ----------
  // Frames have their own drop handlers (they stopPropagation), so a drop that
  // reaches the canvas is on empty space → drop a floating image where released.
  // Works for both Pexels photos and uploaded images (same drag data).
  async function addImageAt(src, cx, cy) {
    const { w, h } = await measureImageBox(src);
    addElement({ type: "image", x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h, src, opacity: 1, rotation: 0 });
  }
  function _dtHasUri(dt) {
    const t = (dt && dt.types) || [];
    return (t.indexOf ? t.indexOf("text/uri-list") !== -1 || t.indexOf("text/plain") !== -1 : false);
  }
  canvasEl.addEventListener("dragover", function (e) {
    if (!_dtHasUri(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  canvasEl.addEventListener("drop", function (e) {
    if (!e.dataTransfer) return;
    const src = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (!src) return;
    e.preventDefault();
    const rect = canvasEl.getBoundingClientRect();
    const x = (e.clientX - rect.left) / state.zoom;
    const y = (e.clientY - rect.top) / state.zoom;
    addImageAt(src, x, y);
  });

  // ---------- Toolbar buttons ----------
  $("ed-undo").addEventListener("click", undo);
  $("ed-redo").addEventListener("click", redo);
  $("ed-zoom-in").addEventListener("click", () => setZoom(state.zoom + 0.1));
  $("ed-zoom-out").addEventListener("click", () => setZoom(state.zoom - 0.1));
  $("ed-zoom-fit").addEventListener("click", fitZoom);
  zoomDisplayEl.addEventListener("click", () => setZoom(1));

  // Safe-area / margin guides toggle + size.
  (function () {
    const mt = $("ed-margins-toggle");
    const ms = $("ed-margins-size");
    if (!mt) return;
    state.margins = state.margins || { on: false, size: (ms && parseFloat(ms.value)) || 60 };
    mt.addEventListener("click", function () {
      state.margins.on = !state.margins.on;
      mt.setAttribute("aria-pressed", state.margins.on ? "true" : "false");
      renderMargins();
    });
    if (ms) ms.addEventListener("change", function () {
      const v = parseFloat(ms.value);
      state.margins.size = isFinite(v) ? Math.max(0, v) : 60;
      renderMargins();
    });
  })();
  // Guides pane — add a vertical / horizontal guide, or clear them all.
  (function () {
    const av = $("ed-guide-add-v"); if (av) av.addEventListener("click", function () { addGuide("v"); });
    const ah = $("ed-guide-add-h"); if (ah) ah.addEventListener("click", function () { addGuide("h"); });
    const clr = $("ed-guides-clear"); if (clr) clr.addEventListener("click", clearAllGuides);
  })();
  $("ed-save").addEventListener("click", async function () {
    const btn = $("ed-save");
    const label = btn.innerHTML;
    btn.disabled = true; btn.textContent = "Saving…";
    let ok = false;
    try { ok = await save(); } catch (_) { ok = false; }
    btn.innerHTML = ok ? "✓ Saved" : "Save failed";
    if (ok) { btn.style.background = "#2d6a44"; btn.style.color = "#fff"; btn.style.borderColor = "#2d6a44"; }
    setTimeout(function () {
      btn.innerHTML = label;
      btn.style.background = ""; btn.style.color = ""; btn.style.borderColor = "";
      btn.disabled = false;
    }, 1600);
  });

  // Crop — placeholder for the moment. The full drag-resize crop UI is
  // deferred; this just checks the user has an image selected so we can
  // wire the real flow into the same button later.
  /* Crop and flip have left the top bar - see the header comment there. Flip
     is on the element's own toolbar now (it needs something selected, which is
     exactly the condition that toolbar appears under), and the right-click menu
     still carries both axes. Crop was never built. */

  // The format pill opens the Resize pane rather than only reporting the size.
  $("ed-canvas-size-btn")?.addEventListener("click", function () {
    if (typeof showPane === "function") showPane("resize");
    const rail = document.querySelector('.ed-rail-btn[data-tool="resize"]');
    if (rail) {
      document.querySelectorAll(".ed-rail-btn").forEach((b) => b.classList.remove("is-active"));
      rail.classList.add("is-active");
    }
  });

  // Share — uses the Web Share API where available (mobile, modern desktop
  // Chromium). Falls back to a PNG download so the user can post manually.
  $("ed-share-image")?.addEventListener("click", async function () {
    try {
      // Reuse the shared renderer so shadow/gradient/text-effect rules stay
      // in one place — Share used to duplicate the draw loop verbatim, which
      // meant any new effect needed touching twice.
      const c = await _renderDesignToCanvas({ transparent: false });
      const blob = await new Promise(function (r) { c.toBlob(r, "image/png"); });
      if (!blob) throw new Error("Could not encode design");
      const filename = (filenameEl.value || "design").replace(/[^a-z0-9-_]+/gi, "-") + ".png";
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: filenameEl.value || "TMKE design",
            text: "Made with TMKE Studio",
          });
        } catch (e) { /* user cancelled — ignore */ }
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        toast("Saved — drop it into Instagram, LinkedIn or TikTok", 3500);
      }
    } catch (err) {
      console.error("[share]", err);
      toast("Couldn't share — try Download instead", 3000);
    }
  });

  // Download dropdown — replaces the old PNG/JPG buttons. Click trigger to
  // toggle; click outside or pick an item to close.
  (function wireDownload() {
    const wrap = $("ed-download");
    const trigger = $("ed-download-trigger");
    const menu = $("ed-download-menu");
    if (!wrap || !trigger || !menu) return;

    function close() {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    }
    function open() {
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
    }
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.hidden ? open() : close();
    });
    document.addEventListener("click", (e) => {
      if (!menu.hidden && !wrap.contains(e.target)) close();
    });
    document.addEventListener("keydown", (e) => {
      if (!menu.hidden && e.key === "Escape") close();
    });
    menu.querySelectorAll("[data-export]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.getAttribute("data-export");
        close();
        exportImage(type);
      });
    });
  })();
  filenameEl.addEventListener("change", save);

  // Shortcut modal
  $("ed-shortcuts-close").addEventListener("click", () => $("ed-shortcuts").hidden = true);

  // ---------- Keyboard ----------
  function isTyping(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
  }

  document.addEventListener("keydown", (e) => {
    // Ctrl/Cmd+B WHILE editing a text box → bold the selection (per-word). We
    // handle it explicitly (rather than relying on the browser default) so the
    // behaviour is consistent everywhere; runs are parsed back on blur.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      const editingInner = document.querySelector('.ed-text-inner[contenteditable="true"]');
      if (editingInner) {
        e.preventDefault();
        try { document.execCommand("styleWithCSS", false, true); } catch (_) {}
        document.execCommand("bold");
        return;
      }
    }
    if (isTyping(e.target)) return;
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if (ctrl && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
    if (ctrl && e.key.toLowerCase() === "s") { e.preventDefault(); save(); return; }
    if (ctrl && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSelected(); return; }
    if (ctrl && e.key.toLowerCase() === "c") { e.preventDefault(); copySelected(); return; }
    if (ctrl && e.key.toLowerCase() === "v") { e.preventDefault(); paste(); return; }
    if (ctrl && e.key.toLowerCase() === "a") {
      e.preventDefault();
      state.selectedIds = state.elements.map((el) => el.id);
      fullRender(); return;
    }
    if (ctrl && e.key.toLowerCase() === "b") {
      const texts = selectedElements().filter((el) => el.type === "text");
      if (texts.length) {
        e.preventDefault();
        // Toggle off only if every selected text is already bold; otherwise bold all.
        const allBold = texts.every((el) => (el.weight || 400) >= 700);
        texts.forEach((el) => { el.weight = allBold ? 400 : 700; loadGoogleFont(el.font); });
        fullRender(); pushHistory();
      }
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (state.selectedGuideId && !state.selectedIds.length) { deleteGuide(state.selectedGuideId); return; }
      deleteSelected();
      return;
    }
    if (e.key === "Escape") { state.selectedIds = []; state.selectedGuideId = null; fullRender(); return; }
    if (e.key === "?") { $("ed-shortcuts").hidden = false; return; }

    if (e.key === "+" || (e.key === "=" && !e.shiftKey)) { setZoom(state.zoom + 0.1); return; }
    if (e.key === "-") { setZoom(state.zoom - 0.1); return; }
    if (e.key === "0") { fitZoom(); return; }
    if (e.key === "[") { sendBack(); return; }
    if (e.key === "]") { bringForward(); return; }

    // Nudge
    if (state.selectedIds.length) {
      const step = e.shiftKey ? 10 : 1;
      let dx = 0, dy = 0;
      if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      if (dx || dy) {
        e.preventDefault();
        selectedElements().forEach((el) => { el.x += dx; el.y += dy; });
        fullRender();
      }
    }
  });

  // ---------- Init ----------
  // Expose addImage so the stock-photo search panel (set up in editor.astro)
  // can drop search results onto the canvas with the same flow as the bundled
  // library buttons.
  window.__TMKE_ADD_PHOTO__ = addImage;

  // Schedule-to-calendar hook. The "Schedule" button in editor.astro
  // (top-right toolbar) calls this to rasterize the current design,
  // upload it to Supabase Storage, and insert a calendar_items row.
  // Returns a Promise<Blob> of the PNG (with the canvas background).
  // We always flatten to PNG-with-background because the v2 auto-poster
  // (Instagram Graph API) requires a non-transparent image.
  window.__TMKE_RENDER_PNG_BLOB__ = async function () {
    const canvas = await _renderDesignToCanvas({ transparent: false });
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not encode PNG"));
      }, "image/png");
    });
  };

  // Lightweight read-only summary of the editor's current state. The
  // schedule modal reads this for the default title (= filename) and
  // for the design_ref (= templateId) it stores against the calendar
  // row so "Edit" can later reopen the source design.
  window.__TMKE_EDITOR_SUMMARY__ = function () {
    return {
      filename: (filenameEl && filenameEl.value) || "design",
      templateId: state.templateId || null,
      width: state.canvas && state.canvas.width,
      height: state.canvas && state.canvas.height,
    };
  };

  // Canva bulk import — turn a set of background images into a multi-page
  // design (one page per image, sized to the image). Admins then add text.
  window.__TMKE_IMPORT_BACKGROUNDS__ = function (images) {
    if (!images || !images.length) return;
    state.templateId = null;
    state.pages = images.map(function (im, i) {
      return {
        id: uid("page"), name: "Page " + (i + 1),
        canvas: {
          width: im.w || 1080, height: im.h || 1350,
          background: "#FFFFFF", backgroundImage: im.src,
        },
        elements: [],
      };
    });
    state.currentPage = 0;
    state.selectedIds = [];
    state.history = []; state.historyIndex = -1;
    if (filenameEl) filenameEl.value = takeInitialTitle() || filenameEl.value || "Canva import";
    state.pages.forEach(function (pg) { /* nothing to preload */ });
    pushHistory();
    fullRender();
    fitZoom();
  };

  // Publish hook — admin Publish flow reads every page (with a properly RENDERED
  // thumbnail per page, text and all, at full resolution) plus the loaded
  // template id so a re-publish can UPDATE that row instead of duplicating it.
  window.__TMKE_PUBLISH_DATA__ = async function () {
    const orig = state.currentPage;
    const pages = [];
    for (let i = 0; i < state.pages.length; i++) {
      state.currentPage = i;             // the pair renderer renders the active page
      let thumb = "", render = "";
      try { ({ thumb, render } = await _renderPreviewPair()); } catch (_) {}
      const p = state.pages[i];
      pages.push({ canvas: deep(p.canvas), elements: deep(p.elements), thumb: thumb, render: render });
    }
    state.currentPage = orig;
    return {
      filename: (filenameEl && filenameEl.value) || "Design",
      templateId: state.templateId || null,
      pages: pages,
      cover: (pages[orig] && pages[orig].thumb) || (pages[0] && pages[0].thumb) || "",
    };
  };

  // Render an arbitrary stored design ({canvas, elements}) to a high-res JPEG
  // data URL — used by the admin "Regenerate previews" tool to refresh every
  // template's thumbnail without anyone re-opening each design by hand.
  window.__TMKE_RENDER_THUMB_FROM__ = async function (canvasObj, elementsArr) {
    const savePages = state.pages, saveCur = state.currentPage;
    try {
      state.pages = [{ canvas: deep(canvasObj || {}), elements: deep(elementsArr || []) }];
      state.currentPage = 0;
      return await _renderThumbDataUrl();
    } catch (_) {
      return null;
    } finally {
      state.pages = savePages; state.currentPage = saveCur;
      fullRender();
    }
  };

  // Same as above, but returns BOTH preview assets (full-res PNG + light JPEG)
  // from a single pass — used by the admin "Regenerate previews" tool to backfill
  // render_url + thumb_url across every template without re-opening each design.
  window.__TMKE_RENDER_PAIR_FROM__ = async function (canvasObj, elementsArr) {
    const savePages = state.pages, saveCur = state.currentPage;
    try {
      state.pages = [{ canvas: deep(canvasObj || {}), elements: deep(elementsArr || []) }];
      state.currentPage = 0;
      return await _renderPreviewPair();
    } catch (_) {
      return { thumb: null, render: null };
    } finally {
      state.pages = savePages; state.currentPage = saveCur;
      fullRender();
    }
  };

  // AI text parser — snapshot the active page (the imported design) so it can be
  // sent to the parser, then place the returned text blocks as editable layers.
  window.__TMKE_PAGE_IMAGE__ = async function () {
    let image = "";
    try { const c = await _renderDesignToCanvas({ transparent: false }); image = c.toDataURL("image/jpeg", 0.85); } catch (_) {}
    return { image: image, width: state.canvas.width, height: state.canvas.height };
  };
  // Page navigation hooks for the "Read all pages" AI pass.
  window.__TMKE_PAGE_COUNT__ = function () { return state.pages.length; };
  // So "Add a page" can sit in the start panel, where somebody who does not
  // already know what Pages means will actually find it.
  window.__TMKE_ADD_PAGE__ = function () { addPage(); };
  window.__TMKE_GOTO_PAGE__ = function (i) { goToPage(i); };
  window.__TMKE_AI_PLACE_TEXT__ = function (blocks) {
    if (!Array.isArray(blocks) || !blocks.length) return 0;
    let added = 0;
    blocks.forEach(function (b) {
      if (!b || !b.text) return;
      state.elements.push({
        id: uid("text"), type: "text", text: String(b.text),
        x: Math.round(b.x || 0), y: Math.round(b.y || 0),
        w: Math.max(20, Math.round(b.w || 320)), h: Math.max(20, Math.round(b.h || 60)),
        rotation: 0, opacity: 1,
        font: "Cormorant Garamond", size: Math.max(6, Math.round(b.fontSize || 32)),
        weight: (b.weight >= 600 ? 700 : 400), italic: false,
        color: /^#[0-9a-f]{6}$/i.test(b.color || "") ? b.color : "#1c1d22",
        align: ["left", "center", "right"].includes(b.align) ? b.align : "left",
        letterSpacing: 0, lineHeight: 1.2,
      });
      added++;
    });
    if (added) { state.selectedIds = []; pushHistory(); fullRender(); }
    return added;
  };

  // Review snapshot — rasterises EVERY page to a JPEG so the reviewer page can
  // show the design as flat images (no editor needed). Plus the comments left
  // on elements, flattened with their page index for the reviewer's notes list.
  window.__TMKE_REVIEW_DATA__ = async function () {
    const orig = state.currentPage;
    const pageImages = [];
    const comments = [];
    const pageElements = [];   // per-page element boxes (normalised) so the
                               // reviewer can click an element to comment on it
    for (let i = 0; i < state.pages.length; i++) {
      state.currentPage = i; // _renderDesignToCanvas draws the active page
      try {
        const c = await _renderDesignToCanvas({ transparent: false });
        pageImages.push(c.toDataURL("image/jpeg", 0.82));
      } catch (_) { pageImages.push(null); }
      const W = (state.pages[i].canvas && state.pages[i].canvas.width) || 1080;
      const H = (state.pages[i].canvas && state.pages[i].canvas.height) || 1440;
      const boxes = [];
      (state.pages[i].elements || []).forEach(function (el) {
        (el.comments || []).forEach(function (cm) {
          if (!cm.resolved) comments.push({ page: i, text: cm.text });
        });
        boxes.push({
          id: el.id,
          type: el.type,
          label: el.type === "text" ? String(el.text || "").replace(/\s+/g, " ").trim().slice(0, 48) : el.type,
          x: el.x / W, y: el.y / H, w: el.w / W, h: el.h / H,
        });
      });
      pageElements.push(boxes);
    }
    state.currentPage = orig;
    return {
      filename: (filenameEl && filenameEl.value) || "Design",
      pageImages: pageImages,
      comments: comments,
      pageElements: pageElements,
    };
  };

  // Onboarding pack-picker hook. Scopes the studio's template grid to a chosen
  // pack's designs. `templateIds` is the pack's list. Returns a lightweight
  // [{id,name,thumb,category}] list so the onboarding overlay can render a
  // "pick a design" chooser. Pass { load: false } to only scope/register
  // WITHOUT opening a design (the overlay opens the one the user clicks).
  // When ids don't resolve, falls back to the full library so the studio is
  // never empty.
  window.__TMKE_OPEN_PACK__ = function (templateIds, opts) {
    const ids = Array.isArray(templateIds) ? templateIds.filter(Boolean) : [];
    let scoped = ids.map((id) => TEMPLATES.find((t) => t.id === id)).filter(Boolean);
    if (!scoped.length) scoped = TEMPLATES.slice();
    if (!scoped.length) return [];
    PACK_TEMPLATES = scoped;
    tplGridEl.innerHTML = "";   // force a fresh, scoped render
    renderTemplateGrid();
    if (!opts || opts.load !== false) loadTemplate(scoped[0].id, false);
    return scoped.map((t) => ({ id: t.id, name: t.name, thumb: t.thumb || null, category: t.category || null }));
  };

  // Open a pack whose templates come from Supabase (a pack an admin published).
  // The customer studio's bundled library doesn't contain them, so inject the
  // rows into TEMPLATES first, then scope. Returns the design list; honours
  // { load: false } the same way as __TMKE_OPEN_PACK__.
  window.__TMKE_OPEN_PACK_TEMPLATES__ = function (rows, opts) {
    const list = Array.isArray(rows) ? rows : [];
    const shaped = list.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category || null,
      thumb: r.thumb_url || null,
      canvas: r.canvas || { width: 1080, height: 1440, background: "#F2EFE9" },
      elements: r.elements || [],
    })).filter((t) => t.id);
    if (!shaped.length) return window.__TMKE_OPEN_PACK__([], opts); // fallback to library
    shaped.forEach((t) => { if (!TEMPLATES.find((x) => x.id === t.id)) TEMPLATES.push(t); });
    PACK_TEMPLATES = shaped;
    tplGridEl.innerHTML = "";
    renderTemplateGrid();
    if (!opts || opts.load !== false) loadTemplate(shaped[0].id, false);
    return shaped.map((t) => ({ id: t.id, name: t.name, thumb: t.thumb || null, category: t.category || null }));
  };

  // Load one specific design from the already-scoped pack (used when the user
  // picks a design in the onboarding chooser).
  window.__TMKE_LOAD_TEMPLATE__ = function (id) {
    if (id) loadTemplate(id, false);
  };

  // Onboarding "start fresh" → open a blank canvas at the chosen size (falls
  // back to the 1080×1440 house standard when no size is given).
  window.__TMKE_LOAD_BLANK__ = function (w, h) {
    loadBlank(w, h);
  };

  // If a stock-photo search panel is taking over the Photos tab, skip
  // rendering the bundled library — its results will fill the grid instead.
  if (!window.__TMKE_STOCK_SEARCH_ACTIVE__) renderPhotoGrid();
  renderBrandPane();
  seedBrandIntoBackgroundPane();
  window.addEventListener("resize", () => fitZoom());

  // Read template ID from URL. A `?template=` deep-link (admin / library
  // "edit this design") loads that specific template; otherwise we open on a
  // genuinely blank canvas rather than silently dropping the first library
  // template behind the onboarding overlay.
  const urlParams = new URLSearchParams(window.location.search);
  const explicitTpl = urlParams.get("template");
  const explicitDesign = urlParams.get("design");
  const adminPending = urlParams.get("mode") === "admin";

  // Re-read the templates blob from the DOM and mutate TEMPLATES *in place* so
  // PACK_TEMPLATES and every closure keep their reference. The admin bootstrap
  // in editor.astro fetches the live templates from Supabase asynchronously, so
  // this blob is empty when the IIFE first runs — we refresh once it's ready.
  function refreshAdminTemplates() {
    try {
      const tag = document.getElementById("ed-templates-data");
      const arr = JSON.parse((tag && tag.textContent) || "[]");
      if (Array.isArray(arr)) TEMPLATES.splice(0, TEMPLATES.length, ...arr);
    } catch (_) {}
  }

  if (adminPending) {
    // Admin studio. editor.js boots *before* the async Supabase bootstrap has
    // installed the save hook (`__TMKE_ADMIN_SAVE__`, which is what
    // `isAdminMode()` keys off) or filled the templates blob — so we cannot
    // load the requested template here. Expose a callback the bootstrap fires
    // once it's ready; if it already finished, run immediately.
    window.__TMKE_BOOT_ADMIN__ = function (requestedId) {
      refreshAdminTemplates();
      const id = requestedId || (TEMPLATES[0] && TEMPLATES[0].id);
      if (id) loadTemplate(id, false); else loadBlank();
      // Headless thumbnail rebuild (opened in a hidden iframe by the studio
      // list's "Rebuild thumbnails" action). Render the design with the real
      // editor renderer, persist a fresh thumbnail, then tell the opener so it
      // can move on to the next template.
      if (id && urlParams.get("rebuildthumb") === "1") {
        (async () => {
          try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (_) {}
          // Persist only when there's an actual design — loadTemplate restores any
          // localStorage draft, so this heals drafts whose content never reached
          // the DB. Truly-empty templates are left as the "Blank canvas" placeholder.
          const hasContent = (state.elements && state.elements.length) ||
            (state.canvas && state.canvas.backgroundImage) ||
            (state.pages && state.pages.some((p) => (p.elements && p.elements.length) || (p.canvas && p.canvas.backgroundImage)));
          if (hasContent) { try { await autosaveToDb(); } catch (_) {} }
          try { (window.parent || window).postMessage({ type: "tmke-thumb-rebuilt", id: id }, location.origin); } catch (_) {}
        })();
      }
    };
    // The bootstrap loads the requested template first (fast, single row) then
    // backfills the full list for the switcher grid. This re-reads the refreshed
    // blob and rebuilds the grid *without* disturbing the open design.
    window.__TMKE_REFRESH_TEMPLATES__ = function () {
      refreshAdminTemplates();
      PACK_TEMPLATES = TEMPLATES;
      try { if (tplGridEl) { tplGridEl.innerHTML = ""; renderTemplateGrid(); } } catch (_) {}
    };
    if (window.__TMKE_ADMIN_BOOTSTRAP_DONE__) {
      window.__TMKE_BOOT_ADMIN__(window.__TMKE_ADMIN_BOOTSTRAP_DONE__.requestedId);
    } else {
      // Fallback: if the bootstrap never resolves (network/auth error), don't
      // leave a frozen empty canvas. Honour the requested ?id= (refresh the blob
      // first in case the bootstrap populated it) so we never silently open the
      // bundled default ("Just Listed") in place of the template that was asked for.
      setTimeout(function () {
        if (!state.templateId && !(state.elements && state.elements.length)) {
          refreshAdminTemplates();
          var reqId = null;
          try { reqId = new URLSearchParams(location.search).get("id"); } catch (_) {}
          var pick = (reqId && TEMPLATES.some(function (t) { return t.id === reqId; }))
            ? reqId
            : (TEMPLATES[0] && TEMPLATES[0].id);
          if (pick) loadTemplate(pick, false);
          else loadBlank();
        }
      }, 6000);
    }
  } else if (explicitDesign) {
    // Customer re-opening their own saved design. editor.astro fetches the row
    // and calls __TMKE_BOOT_DESIGN__ (or leaves a breadcrumb if it ran first).
    window.__TMKE_BOOT_DESIGN__ = function (d) { loadDesignData(d); };
    if (typeof window.__TMKE_DESIGN_BOOTSTRAP_DONE__ !== "undefined") {
      window.__TMKE_BOOT_DESIGN__(window.__TMKE_DESIGN_BOOTSTRAP_DONE__);
    } else {
      setTimeout(function () { if (!state.templateId && !(state.elements && state.elements.length)) loadBlank(); }, 6000);
    }
  } else if (explicitTpl) {
    loadTemplate(explicitTpl, false);
  } else {
    // ?blank=1080x1920 — the "new design" pop-out sends the size it was
    // asked for. Anything else (?blank=1, or nothing) takes the default.
    var _bm = /^(\d{2,5})x(\d{2,5})$/.exec(urlParams.get("blank") || "");
    if (_bm) loadBlank(Number(_bm[1]), Number(_bm[2])); else loadBlank();
  }

  // Persist filename changes
  filenameEl.addEventListener("blur", save);

  // Re-pull brand kit if user updates it in another tab.
  window.addEventListener("storage", function (e) {
    if (e.key === "tmke.brand") {
      BRAND = loadBrand();
      FONTS = buildFonts();
      renderBrandPane();
      seedBrandIntoBackgroundPane();
      if (state.selectedIds.length === 1) renderContextBar();
    }
  });

  function seedBrandIntoBackgroundPane() {
    if (!BRAND || !BRAND.colors || !BRAND.colors.length) return;
    const bgPane = document.querySelector('.ed-panel-pane[data-pane="background"]');
    if (!bgPane) return;
    let existing = bgPane.querySelector(".ed-brand-injected");
    if (existing) existing.remove();
    const wrap = document.createElement("div");
    wrap.className = "ed-brand-injected";
    const title = document.createElement("div");
    title.className = "ed-section-title";
    title.textContent = "Your brand";
    wrap.appendChild(title);
    const row = document.createElement("div");
    row.className = "ed-swatches";
    BRAND.colors.forEach(function (c) {
      const b = document.createElement("button");
      b.className = "ed-sw";
      b.style.background = c.hex;
      b.title = c.name + " — " + c.hex;
      if (c.hex.toUpperCase() === "#FFFFFF") b.style.border = "1px solid rgba(0,0,0,0.1)";
      b.addEventListener("click", function () {
        state.canvas.background = c.hex;
        pushHistory();
        fullRender();
      });
      row.appendChild(b);
    });
    wrap.appendChild(row);
    // Insert right after pane header
    const header = bgPane.querySelector(".ed-pane-header");
    if (header && header.nextSibling) bgPane.insertBefore(wrap, header.nextSibling);
    else bgPane.appendChild(wrap);
  }
})();
