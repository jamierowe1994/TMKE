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

  // Self-hosted house fonts baked into the studio (separate from per-customer
  // uploads via /admin/fonts). Files live on R2 under /fonts/. Each face is
  // registered with the document so the canvas renders it; if a file isn't
  // there yet the family simply falls back to the stack below.
  const CUSTOM_FONTS = [
    {
      name: "The Seasons",
      stack: '"The Seasons", "Cormorant Garamond", Georgia, serif',
      category: "TMKE · House",
      faces: [
        { url: "https://assets.tmke.co.uk/fonts/the-seasons-light.woff2", weight: 300, style: "normal" },
        { url: "https://assets.tmke.co.uk/fonts/the-seasons-regular.woff2", weight: 400, style: "normal" },
        { url: "https://assets.tmke.co.uk/fonts/the-seasons-bold.woff2", weight: 700, style: "normal" },
      ],
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
      ":ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&display=swap";
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
  const zoomDisplayEl = $("ed-zoom-display");
  const tplGridEl = $("ed-template-grid");
  const photoGridEl = $("ed-photo-grid");
  const uploadGridEl = $("ed-upload-grid");
  const toastEl = $("ed-toast");

  // ---------- State ----------
  const state = {
    templateId: null,
    canvas: { width: 1080, height: 1350, background: "#F2EFE9" },
    elements: [],
    selectedIds: [],
    zoom: 1,
    history: [],
    historyIndex: -1,
    clipboard: null,
    uploads: [],
  };

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
      pop.innerHTML = "";
      pop.appendChild(opts.render(close));
      pop.hidden = false;
      position();
    }
    function close() { pop.hidden = true; }

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

  // Circular colour swatch — clicking it triggers the native colour picker.
  // Used in place of square `<input type="color">` with a "Colour" label.
  // onChange is called on every input event with the new hex string.
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

  // Font-size control: a typeable number + a caret that drops a quick list of
  // common sizes (Canva-style). onChange(size) is called with the new value.
  const SIZE_PRESETS = [6, 8, 10, 12, 14, 16, 18, 21, 24, 28, 32, 36, 42, 48, 56, 64, 72, 80, 88, 96, 104, 120, 144];
  function createSizeControl(initial, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "ed-size-ctl";
    const input = document.createElement("input");
    input.type = "number"; input.className = "ed-ctx-num"; input.value = initial; input.min = 6; input.max = 600;
    const caret = document.createElement("button");
    caret.type = "button"; caret.className = "ed-size-caret"; caret.title = "Sizes";
    caret.textContent = "▾";
    const pop = document.createElement("div");
    pop.className = "ed-size-pop"; pop.hidden = true;
    pop.innerHTML = SIZE_PRESETS.map(function (s) {
      return '<button type="button" class="ed-size-opt' + (s === initial ? " is-current" : "") + '" data-size="' + s + '">' + s + "</button>";
    }).join("");

    function apply(v) {
      v = Math.max(6, Math.min(600, parseInt(v, 10) || initial));
      input.value = v;
      onChange(v);
    }
    input.addEventListener("change", function () { apply(input.value); });
    caret.addEventListener("click", function (e) { e.stopPropagation(); pop.hidden = !pop.hidden; });
    pop.addEventListener("click", function (e) {
      const b = e.target.closest("[data-size]");
      if (!b) return;
      pop.hidden = true;
      apply(b.getAttribute("data-size"));
    });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) pop.hidden = true; });

    wrap.appendChild(input);
    wrap.appendChild(caret);
    wrap.appendChild(pop);
    return wrap;
  }

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

    const items = [
      // Z-order
      { label: "Bring forward",   action: function () { bringForward(); } },
      { label: "Send back",       action: function () { sendBack(); } },
      { label: "Bring to front",  action: function () { bringToFront(); } },
      { label: "Send to back",    action: function () { sendToBack(); } },
      { divider: true },
      // Align (snaps the element to a canvas edge / centre, not a sibling)
      { label: "Align left",      action: function () { alignSelected("left"); } },
      { label: "Align centre",    action: function () { alignSelected("centerX"); } },
      { label: "Align right",     action: function () { alignSelected("right"); } },
      { label: "Align top",       action: function () { alignSelected("top"); } },
      { label: "Align middle",    action: function () { alignSelected("centerY"); } },
      { label: "Align bottom",    action: function () { alignSelected("bottom"); } },
      { divider: true },
      // Flip — works on any element but is most useful for images.
      { label: "Flip horizontal", action: function () { flipSelected("h"); } },
      { label: "Flip vertical",   action: function () { flipSelected("v"); } },
      { divider: true },
      { label: "Copy",            hint: "Ctrl+C", action: function () { copySelectedToClipboard(); } },
      { label: "Duplicate",       hint: "Ctrl+D", action: function () { duplicateSelected(); } },
      { label: "Delete",          hint: "Del", action: function () { deleteSelected(); }, danger: true },
    ];

    if (el.type === "text") {
      items.push({ divider: true });
      if (el.link) {
        items.push({ label: "Edit link…", action: function () { promptLink(el); } });
        items.push({ label: "Remove link", action: function () { el.link = null; pushHistory(); fullRender(); } });
      } else {
        items.push({ label: "Add link…", action: function () { promptLink(el); } });
      }
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

    ctxMenu.innerHTML = items.map(function (it) {
      if (it.divider) return '<div class="ed-rclick-divider"></div>';
      return (
        '<button type="button" class="ed-rclick-item' + (it.danger ? ' is-danger' : '') + '">' +
          '<span>' + it.label + '</span>' +
          (it.hint ? '<span class="ed-rclick-hint">' + it.hint + '</span>' : '') +
        '</button>'
      );
    }).join("");

    // Position with a small offset; if it would overflow the viewport, flip.
    const w = 220;
    const h = items.length * 32 + 16;
    const px = Math.min(x + 2, window.innerWidth - w - 8);
    const py = Math.min(y + 2, window.innerHeight - h - 8);
    ctxMenu.style.left = px + "px";
    ctxMenu.style.top = py + "px";
    ctxMenu.hidden = false;

    // Wire up — re-query because we just innerHTML'd.
    const buttons = ctxMenu.querySelectorAll(".ed-rclick-item");
    let i = 0;
    items.forEach(function (it) {
      if (it.divider) return;
      const btn = buttons[i++];
      btn.addEventListener("click", function () {
        hideContextMenu();
        it.action();
      });
    });
  }

  // Align the currently-selected element relative to the canvas bounds.
  // mode: "left" | "centerX" | "right" | "top" | "centerY" | "bottom"
  function alignSelected(mode) {
    const el = getEl(state.selectedIds[0]);
    if (!el) return;
    const cw = state.canvas.width;
    const ch = state.canvas.height;
    if (mode === "left")     el.x = 0;
    if (mode === "centerX")  el.x = Math.round((cw - el.w) / 2);
    if (mode === "right")    el.x = cw - el.w;
    if (mode === "top")      el.y = 0;
    if (mode === "centerY")  el.y = Math.round((ch - el.h) / 2);
    if (mode === "bottom")   el.y = ch - el.h;
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
  const ICONS = {
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
  function pushHistory() {
    // Drop forward history
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push({
      canvas: deep(state.canvas),
      elements: deep(state.elements),
    });
    if (state.history.length > 80) state.history.shift();
    state.historyIndex = state.history.length - 1;
    updateUndoRedoButtons();
  }

  function undo() {
    if (state.historyIndex <= 0) return;
    state.historyIndex--;
    const snap = state.history[state.historyIndex];
    state.canvas = deep(snap.canvas);
    state.elements = deep(snap.elements);
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
    state.selectedIds = state.selectedIds.filter((id) => getEl(id));
    fullRender();
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    $("ed-undo").disabled = state.historyIndex <= 0;
    $("ed-redo").disabled = state.historyIndex >= state.history.length - 1;
  }

  // ---------- Load template ----------
  function loadTemplate(tplId, fresh) {
    let tpl = TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) tpl = TEMPLATES[0];
    if (!tpl) return;
    state.templateId = tpl.id;

    // Try to restore saved state
    if (!fresh) {
      try {
        const saved = JSON.parse(localStorage.getItem("tmke.editor." + tpl.id) || "null");
        if (saved && saved.elements) {
          state.canvas = saved.canvas;
          state.elements = saved.elements;
          state.selectedIds = [];
          filenameEl.value = saved.filename || tpl.name;
          state.history = [];
          state.historyIndex = -1;
          preloadFontsForElements(state.elements);
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
    filenameEl.value = tpl.name;
    // Auto-substitute merge tags ({brand name}, etc.) from the customer's
    // saved brand kit. Skipped in admin mode so admins can author templates
    // with the tokens visible and intact. Customers can still hand-edit any
    // text afterwards — this just gives them a personalised starting point.
    if (!isAdminMode()) fillTemplateMergeTags();
    state.history = [];
    state.historyIndex = -1;
    pushHistory();
    fullRender();
    fitZoom();
  }

  // ---------- Blank canvas ----------
  // A truly-empty starting point (the onboarding "Start with a blank canvas"
  // choice). A violet page with a "Start building here" hint — the hint is
  // DOM-only (see fullRender), so it never lands in an export.
  function loadBlank() {
    state.templateId = null;
    state.canvas = { width: 1080, height: 1350, background: "#7B5BCF" };
    state.elements = [];
    state.selectedIds = [];
    filenameEl.value = "Untitled";
    state.history = [];
    state.historyIndex = -1;
    pushHistory();
    fullRender();
    fitZoom();
  }

  // ---------- Rendering ----------
  function fullRender() {
    canvasEl.style.width = state.canvas.width + "px";
    canvasEl.style.height = state.canvas.height + "px";
    canvasEl.style.background = state.canvas.background;

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
      bg.style.left = "0"; bg.style.top = "0";
      bg.style.width = "100%"; bg.style.height = "100%";
      bg.style.objectFit = "cover";
      bg.style.pointerEvents = "none";
      bg.style.userSelect = "none";
      canvasEl.appendChild(bg);
    }

    state.elements.forEach((el) => {
      canvasEl.appendChild(renderElement(el));
    });

    // Blank-canvas hint: a DOM-only "Start building here" prompt shown while
    // a from-scratch canvas is still empty. It carries no element data, so
    // _renderDesignToCanvas (which draws from state) never exports it, and it
    // disappears the moment the user adds anything.
    if (state.templateId === null && state.elements.length === 0) {
      const hint = document.createElement("div");
      hint.className = "ed-blank-hint";
      hint.textContent = "Start building here";
      hint.title = "Click to add a text box";
      // Click the prompt to drop a real, editable + deletable text box (Canva-
      // style) rather than it being a stuck, undeletable label.
      hint.addEventListener("click", function (e) {
        e.stopPropagation();
        addText("body");
      });
      canvasEl.appendChild(hint);
    }

    autosizeTextElements();
    renderHandles();
    renderLayers();
    renderContextBar();
    renderProps();
    renderTemplateGrid();

    // Keep the Background-pane detach button in sync with state. Cheap
    // here (one DOM toggle per render) and means we never have to
    // remember to call it from anywhere else.
    const detachBtn = document.getElementById("ed-bg-detach");
    if (detachBtn) detachBtn.hidden = !state.canvas.backgroundImage;
  }

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
      inner.textContent = el.text || "";
      applyTextStyles(inner, el);
      node.appendChild(inner);
    } else if (el.type === "image") {
      const img = document.createElement("img");
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
    if (el.hidden) node.classList.add("is-hidden");

    bindElementInteractions(node, el);
    return node;
  }

  function applyElementStyles(node, el) {
    node.style.left = el.x + "px";
    node.style.top = el.y + "px";
    node.style.width = el.w + "px";
    node.style.height = el.h + "px";
    const sx = el.flipX ? -1 : 1;
    const sy = el.flipY ? -1 : 1;
    node.style.transform = "rotate(" + (el.rotation || 0) + "deg) scale(" + sx + ", " + sy + ")";
    node.style.opacity = el.opacity != null ? el.opacity : 1;

    if (el.type === "rect" || el.type === "ellipse") {
      node.style.background = el.fill || "transparent";
      node.style.borderRadius = (el.type === "ellipse" ? "50%" : (el.radius || 0) + "px");
      node.style.border = (el.strokeWidth ? `${el.strokeWidth}px solid ${el.stroke || "transparent"}` : "none");
    }
    if (el.type === "line") {
      node.style.background = el.fill || "#000";
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
    if (state.selectedIds.length !== 1) return;
    const el = getEl(state.selectedIds[0]);
    if (!el || el.locked) return;

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

  // ---------- Interactions ----------
  function bindElementInteractions(node, el) {
    node.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      if (node.classList.contains("is-editing")) return;
      ev.stopPropagation();

      const multi = ev.shiftKey;
      if (!state.selectedIds.includes(el.id)) {
        if (multi) state.selectedIds.push(el.id);
        else state.selectedIds = [el.id];
        fullRender();
      } else if (multi) {
        state.selectedIds = state.selectedIds.filter((x) => x !== el.id);
        fullRender();
        return;
      }
      if (!el.locked) startDrag(ev);
    });

    if (el.type === "text") {
      node.addEventListener("dblclick", (ev) => {
        ev.stopPropagation();
        startTextEdit(node, el);
      });
    }
  }

  let dragging = null;
  function startDrag(ev) {
    ev.preventDefault();
    const startX = ev.clientX, startY = ev.clientY;
    const initial = selectedElements().map((e) => ({ id: e.id, x: e.x, y: e.y }));
    let moved = false;

    function onMove(e) {
      const dx = (e.clientX - startX) / state.zoom;
      const dy = (e.clientY - startY) / state.zoom;
      if (!moved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) moved = true;
      initial.forEach((m) => {
        const el = getEl(m.id);
        if (!el) return;
        el.x = Math.round(m.x + dx);
        el.y = Math.round(m.y + dy);
        partialRenderElement(el);
      });

      // Snap guides for single selection
      if (initial.length === 1) {
        const el = getEl(initial[0].id);
        applySnap(el);
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

  function startResize(ev, el, handle) {
    ev.preventDefault();
    ev.stopPropagation();
    const startX = ev.clientX, startY = ev.clientY;
    const o = { x: el.x, y: el.y, w: el.w, h: el.h, size: el.size };
    const aspect = o.w / o.h;
    const lockAspect = (el.type === "image" || el.type === "ellipse");
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

  // ---------- Text editing ----------
  function startTextEdit(node, el) {
    const inner = node.querySelector(".ed-text-inner");
    if (!inner) return;
    node.classList.add("is-editing");
    inner.contentEditable = "true";
    inner.focus();
    document.execCommand("selectAll", false, null);

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
      // innerText preserves the line breaks from Enter (textContent drops them).
      const newText = inner.innerText.replace(/\n$/, "");
      if (newText !== el.text) {
        el.text = newText;
        pushHistory();
      }
      inner.removeEventListener("input", grow);
      inner.removeEventListener("blur", commit);
    }
    inner.addEventListener("blur", commit);
  }

  // ---------- Canvas click to deselect ----------
  canvasEl.addEventListener("pointerdown", (ev) => {
    if (ev.target === canvasEl) {
      state.selectedIds = [];
      fullRender();
    }
  });
  stageEl.addEventListener("pointerdown", (ev) => {
    if (ev.target === stageEl || ev.target === shadowEl) {
      state.selectedIds = [];
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

  function addImage(src) {
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
    const w = 500, h = 500;
    addElement({ type: "image", x: state.canvas.width / 2 - w / 2, y: state.canvas.height / 2 - h / 2, w, h, src, opacity: 1, rotation: 0 });
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

  // ---------- Delete / duplicate / clipboard ----------
  function deleteSelected() {
    if (!state.selectedIds.length) return;
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
      const targetW = 300;
      const scale = Math.min(1, targetW / full.width);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(full.width * scale));
      c.height = Math.max(1, Math.round(full.height * scale));
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(full, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.72);
    } catch (_) {
      return null;
    }
  }

  async function save() {
    if (!state.templateId) return;
    const thumb = await _renderThumbDataUrl();
    const payload = {
      templateId: state.templateId,
      filename: filenameEl.value,
      canvas: state.canvas,
      elements: state.elements,
      savedAt: Date.now(),
      thumb,
    };
    // Admin hook (set by editor.astro when ?mode=admin and signed in) — writes
    // back to the Supabase `templates` table instead of localStorage. Falls
    // through to the local save if the hook isn't installed or rejects.
    if (typeof window.__TMKE_ADMIN_SAVE__ === "function") {
      try {
        const ok = await window.__TMKE_ADMIN_SAVE__(payload);
        if (ok) { toast("Template saved"); return; }
        toast("Save failed");
        return;
      } catch (e) {
        toast("Save failed");
        return;
      }
    }
    try {
      localStorage.setItem("tmke.editor." + state.templateId, JSON.stringify(payload));
      toast("Design saved");
    } catch (e) { toast("Save failed"); }
  }

  // ---------- Export ----------
  // Internal: rasterize the current design to a fresh offscreen canvas.
  // Shared by exportImage (downloads) and the schedule-to-calendar hook
  // (uploads). Keep this in sync if you add new element types — the Share
  // button (further down) still inlines the same loop and will need
  // updating too. TODO(refactor): collapse the Share button onto this
  // helper as well once we're confident in the shape.
  async function _renderDesignToCanvas({ transparent = false } = {}) {
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
        // Cover the canvas, matching CSS object-fit: cover
        const cw = state.canvas.width, ch = state.canvas.height;
        const ar = bg.naturalWidth / bg.naturalHeight;
        const cr = cw / ch;
        let dw, dh;
        if (ar > cr) { dh = ch; dw = ch * ar; }
        else         { dw = cw; dh = cw / ar; }
        ctx.drawImage(bg, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
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
          ctx.drawImage(img, 0, 0, el.w, el.h);
        } catch (e) {}
      } else if (el.type === "frame") {
        await drawFrameToCanvas(ctx, el);
      } else if (el.type === "rect") {
        ctx.fillStyle = el.fill || "transparent";
        if (el.radius) roundedRect(ctx, 0, 0, el.w, el.h, el.radius);
        else ctx.fillRect(0, 0, el.w, el.h);
        ctx.fill();
        if (el.strokeWidth && el.stroke !== "transparent") {
          ctx.lineWidth = el.strokeWidth;
          ctx.strokeStyle = el.stroke;
          ctx.stroke();
        }
      } else if (el.type === "ellipse") {
        ctx.fillStyle = el.fill;
        ctx.beginPath();
        ctx.ellipse(el.w / 2, el.h / 2, el.w / 2, el.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (el.type === "triangle") {
        ctx.fillStyle = el.fill;
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
  function drawTextElementToCanvas(ctx, el) {
    const font = (FONTS.find((f) => f.name === el.font) || FONTS[0]).stack;
    ctx.font = (el.italic ? "italic " : "") + el.weight + " " + el.size + "px " + font;
    ctx.textBaseline = "top";
    ctx.textAlign = el.align;
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

    // Build the fill style — solid colour or a gradient. Canvas gradients are
    // defined in absolute coords, so we work out endpoints from the angle.
    let fillStyle = el.color;
    const g = el.textGradient;
    if (g && g.enabled) {
      if (g.type === "radial") {
        const grad = ctx.createRadialGradient(el.w / 2, el.h / 2, 0, el.w / 2, el.h / 2, Math.max(el.w, el.h) / 2);
        grad.addColorStop(0, g.from || "#B9826A");
        grad.addColorStop(1, g.to   || "#474254");
        fillStyle = grad;
      } else {
        const angle = (g.angle != null ? g.angle : 90) * Math.PI / 180;
        // Map CSS gradient angle (0deg = bottom→top in CSS, but we'll use
        // top→down convention to keep code simple — close enough visually).
        const x0 = el.w / 2 - Math.cos(angle) * el.w / 2;
        const y0 = el.h / 2 - Math.sin(angle) * el.h / 2;
        const x1 = el.w / 2 + Math.cos(angle) * el.w / 2;
        const y1 = el.h / 2 + Math.sin(angle) * el.h / 2;
        const grad = ctx.createLinearGradient(x0, y0, x1, y1);
        grad.addColorStop(0, g.from || "#B9826A");
        grad.addColorStop(1, g.to   || "#474254");
        fillStyle = grad;
      }
    }

    // Text shadow — applied via the same canvas shadow API. Set before draws.
    if (el.textShadow && el.textShadow.enabled) {
      ctx.shadowColor = hexToRgba(el.textShadow.color || "#000000",
        el.textShadow.opacity != null ? el.textShadow.opacity : 0.45);
      ctx.shadowBlur = el.textShadow.blur || 0;
      ctx.shadowOffsetX = el.textShadow.offsetX || 0;
      ctx.shadowOffsetY = el.textShadow.offsetY || 0;
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
      // square / portrait / landscape / wide — plain rect
      ctx.rect(0, 0, w, h);
    }
  }

  // Draw a frame element (clipped image, or empty placeholder) into a 2D
  // canvas context. Caller is responsible for the surrounding ctx.save()/
  // translate/rotate/restore.
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
  }

  // Shared binder for any DOM subtree that contains [data-prop] inputs.
  // Used by both the right panel (renderProps) and the top-bar Position
  // popover so the wiring behaviour is identical wherever the input lives.
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
  function renderProps() {
    const body = document.getElementById("ed-selection-body");
    if (!body) return;

    if (state.selectedIds.length !== 1) {
      body.innerHTML = state.selectedIds.length > 1
        ? '<p class="ed-selection-empty">' + state.selectedIds.length + ' elements selected.</p>'
        : '';
      if (state.selectedIds.length === 0) {
        // Nothing selected — go back to whatever tool tab the rail is on.
        if (typeof showPane === "function" && typeof activeToolPane === "string") {
          showPane(activeToolPane);
        }
      }
      return;
    }

    // Selected element — surface its controls and switch to Selection pane.
    if (typeof showPane === "function") showPane("selection");

    const el = getEl(state.selectedIds[0]);
    if (!el) return;

    // Position & size, font/type and the effects panel used to render
    // here as always-visible sections. They now live as popovers on the
    // top context bar so the rail isn't dominated by controls the user
    // only reaches for occasionally. Right-panel sections from here on
    // are the per-type controls that benefit from being visible: fill /
    // stroke, image actions, frame controls, arrange, etc.

    const html = [];

    if (el.type === "rect" || el.type === "ellipse" || el.type === "triangle" || el.type === "star" || el.type === "line") {
      html.push(`<div class="ed-props-section"><h4>Fill</h4>
        <div class="ed-props-field"><label>Colour</label><input type="color" data-prop="fill" value="${rgbHex(el.fill)}"></div>
      </div>`);
      if (el.type === "rect") {
        html.push(`<div class="ed-props-section"><h4>Corner radius</h4>
          <div class="ed-props-field"><input type="range" min="0" max="500" data-prop="radius" value="${el.radius||0}"></div>
        </div>`);
      }
      html.push(`<div class="ed-props-section"><h4>Stroke</h4>
        <div class="ed-props-row">
          <div class="ed-props-field"><label>Colour</label><input type="color" data-prop="stroke" value="${rgbHex(el.stroke && el.stroke!=='transparent'?el.stroke:'#000000')}"></div>
          <div class="ed-props-field"><label>Width</label><input type="number" min="0" max="40" data-prop="strokeWidth" value="${el.strokeWidth||0}"></div>
        </div>
      </div>`);
    }

    if (el.type === "image") {
      // SVG shapes/icons (added via the More-shapes / Social-icons
      // grids) are recolourable — their `svgKey` references SVG_SHAPES
      // and `svgFill` records the current colour. Raster images don't
      // get this picker because we'd have nothing meaningful to recolour.
      if (el.svgKey) {
        html.push(`<div class="ed-props-section"><h4>Colour</h4>
          <div class="ed-props-field"><input type="color" data-prop="svgFill" value="${rgbHex(el.svgFill || '#1c1d22')}"></div>
        </div>`);
      }
      html.push(`<div class="ed-props-section"><h4>Image</h4>
        <button class="ed-btn-ghost" id="ed-replace-img" style="background:rgba(28,29,34,0.06); width:100%">Replace image</button>
      </div>`);
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
          (el.src
            ? ('<div class="ed-props-field"><label>Zoom</label>' +
                '<input type="range" min="0.3" max="6" step="0.01" data-prop="imgScale" value="' + (el.imgScale || 1) + '">' +
              '</div>' +
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

    const replaceBtn = body.querySelector("#ed-replace-img");
    if (replaceBtn) {
      replaceBtn.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = () => {
          const file = input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const tgt = getEl(state.selectedIds[0]);
            if (tgt) { tgt.src = reader.result; pushHistory(); fullRender(); }
          };
          reader.readAsDataURL(file);
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
          const reader = new FileReader();
          reader.onload = () => {
            const tgt = getEl(state.selectedIds[0]);
            if (tgt && tgt.type === "frame") fillFrame(tgt, reader.result);
          };
          reader.readAsDataURL(file);
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
  function textGradientCss(grad) {
    if (!grad || !grad.enabled) return null;
    const angle = grad.angle != null ? grad.angle : 90;
    const from = grad.from || "#1c1d22";
    const to   = grad.to   || "#B9826A";
    if (grad.type === "radial") {
      return "radial-gradient(circle, " + from + ", " + to + ")";
    }
    return "linear-gradient(" + angle + "deg, " + from + ", " + to + ")";
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
    if (b.tagline) m["tagline"] = b.tagline;
    if (b.email)   m["email"]   = b.email;
    if (b.phone)   m["phone"]   = b.phone;
    if (b.website) m["website"] = b.website;
    return m;
  }
  // Surface the keys so the admin "insert tag" UI can list them.
  const KNOWN_TAGS = ["brand name", "brand", "company", "company name", "tagline", "email", "phone", "website"];

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

  // Walk every text element and run their copy through applyMergeTags. Called
  // when a template loads fresh so the customer sees their brand name baked in
  // straight away. They can still edit any text afterwards as normal.
  function fillTemplateMergeTags() {
    state.elements.forEach(function (el) {
      if (el.type !== "text" || !el.text) return;
      const replaced = applyMergeTags(el.text);
      if (replaced !== el.text) el.text = replaced;
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
    const presetButtons = presetKeys.map(function (k) {
      return '<button type="button" class="ed-fx-preset" data-shadow-preset="' + k + '" title="' + presetLabels[k] + '">' + presetLabels[k] + '</button>';
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
    if (state.selectedIds.length !== 1) {
      ctxEl.hidden = true;
      return;
    }
    const el = getEl(state.selectedIds[0]);
    if (!el) { ctxEl.hidden = true; return; }
    ctxEl.hidden = false;
    ctxEl.innerHTML = "";

    if (el.type === "text") {
      // Font — custom searchable picker (replaces native <select>).
      const g1 = group();
      const picker = createFontPicker(el.font, function (name) {
        el.font = name;
        fullRender();
        pushHistory();
      });
      g1.appendChild(picker);

      g1.appendChild(createSizeControl(el.size, function (v) { el.size = v; fullRender(); pushHistory(); }));
      ctxEl.appendChild(g1);

      // B I U
      const g2 = group();
      g2.appendChild(toggleBtn("B", el.weight >= 600, () => {
        el.weight = el.weight >= 600 ? 400 : 700; fullRender(); pushHistory();
      }, "Bold"));
      g2.appendChild(toggleBtn("I", !!el.italic, () => {
        el.italic = !el.italic; fullRender(); pushHistory();
      }, "Italic"));
      g2.appendChild(toggleBtn("U", !!el.underline, () => {
        el.underline = !el.underline; fullRender(); pushHistory();
      }, "Underline"));
      ctxEl.appendChild(g2);

      // Align
      const g3 = group();
      ["left", "center", "right"].forEach((a) => {
        const b = toggleBtn(alignIcon(a), el.align === a, () => { el.align = a; fullRender(); pushHistory(); }, "Align " + a);
        g3.appendChild(b);
      });
      ctxEl.appendChild(g3);

      // Colour — circular swatch, no label (Canva-style).
      const g4 = group();
      g4.appendChild(circleColorInput(el.color, function (hex) { el.color = hex; }, "Text colour"));
      ctxEl.appendChild(g4);
    } else if (el.type === "rect" || el.type === "ellipse" || el.type === "triangle" || el.type === "star" || el.type === "line") {
      // Fill — circle swatch
      const g = group();
      g.appendChild(circleColorInput(el.fill, function (hex) { el.fill = hex; }, "Fill"));
      ctxEl.appendChild(g);

      // Stroke — icon-only trigger; click opens a popover with colour
      // + width. Same UX shape as opacity below.
      const strokeWrap = popoverIconButton({
        icon: ICONS.stroke,
        title: "Stroke",
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
          const reader = new FileReader();
          reader.onload = () => { el.src = reader.result; pushHistory(); fullRender(); };
          reader.readAsDataURL(file);
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
      render: function () {
        const panel = document.createElement("div");
        panel.className = "ed-pop-panel ed-pop-form";
        panel.innerHTML =
          '<div class="ed-props-row">' +
            '<div class="ed-props-field"><label>X</label><input type="number" data-prop="x" value="' + el.x + '"></div>' +
            '<div class="ed-props-field"><label>Y</label><input type="number" data-prop="y" value="' + el.y + '"></div>' +
          '</div>' +
          '<div class="ed-props-row">' +
            '<div class="ed-props-field"><label>Width</label><input type="number" data-prop="w" value="' + el.w + '"></div>' +
            '<div class="ed-props-field"><label>Height</label><input type="number" data-prop="h" value="' + el.h + '"></div>' +
          '</div>' +
          '<div class="ed-props-row">' +
            '<div class="ed-props-field"><label>Rotation</label><input type="number" data-prop="rotation" value="' + (el.rotation || 0) + '"></div>' +
            '<div class="ed-props-field"></div>' +
          '</div>';
        bindGenericPropInputs(panel);
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
        render: function () {
          const panel = document.createElement("div");
          panel.className = "ed-pop-panel ed-pop-form ed-pop-effects";
          panel.innerHTML = renderEffectsSection(el);
          bindEffectsInputs(panel);
          return panel;
        },
      });
      ctxEl.appendChild(effectsWrap);
    }

    // Opacity — icon trigger, popover with a transparency slider.
    const opacityWrap = popoverIconButton({
      icon: ICONS.opacity,
      title: "Transparency",
      render: function () {
        const panel = document.createElement("div");
        panel.className = "ed-pop-panel";
        const val = Math.round((el.opacity != null ? el.opacity : 1) * 100);
        panel.innerHTML =
          '<div class="ed-pop-row"><span>Transparency</span></div>' +
          '<div class="ed-pop-row">' +
            '<input type="range" min="0" max="100" step="1" value="' + val + '" data-opacity />' +
            '<output data-opacity-out>' + val + '</output>' +
          '</div>';
        const r = panel.querySelector("[data-opacity]");
        const o = panel.querySelector("[data-opacity-out]");
        r.addEventListener("input", function () {
          el.opacity = parseInt(r.value, 10) / 100;
          o.textContent = r.value;
          partialRenderElement(el);
        });
        r.addEventListener("change", function () { pushHistory(); });
        return panel;
      },
    });
    ctxEl.appendChild(opacityWrap);

    // Duplicate — labelled button (user explicitly asked for text, not icon).
    const gA = group();
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

    // Delete — icon (universal trash-can affordance).
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "ed-ctx-btn ed-ctx-btn-danger";
    delBtn.innerHTML = ICONS.delete;
    delBtn.title = "Delete (Del)";
    delBtn.addEventListener("click", deleteSelected);
    gA.appendChild(delBtn);

    ctxEl.appendChild(gA);

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
      return a === "left" ? "≡↤" : a === "center" ? "≡" : "≡↦";
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
      if (el.type === "image") {
        const img = document.createElement("img");
        img.src = el.src; thumb.appendChild(img);
      } else if (el.type === "text") {
        thumb.textContent = "T";
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
        state.selectedIds = [el.id];
        fullRender();
      });
      layersEl.appendChild(li);
    }
  }

  function layerName(el) {
    if (el.type === "text") return el.text ? (el.text.slice(0, 28) + (el.text.length > 28 ? "…" : "")) : "Text";
    if (el.type === "image") return "Image";
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
      b.addEventListener("click", () => {
        if (state.templateId !== t.id) {
          if (!confirm("Switch to '" + t.name + "'? Unsaved edits to the current design will be discarded.")) return;
          loadTemplate(t.id, true);
        }
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
      swatchGrid.innerHTML = '<p class="ed-brand-hint" style="grid-column:1/-1">No brand colours yet. <a href="/profile" style="color:var(--english-violet); border-bottom:1px solid currentColor">Add some</a>.</p>';
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
      logoGrid.innerHTML = '<p class="ed-brand-hint" style="grid-column:1/-1">No logos yet. <a href="/profile" style="color:var(--english-violet); border-bottom:1px solid currentColor">Upload some</a>.</p>';
    }
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
    });
  });

  // ---------- Shapes / text / bg / swatches bindings ----------
  // A single .ed-shape button can carry data-shape (legacy CSS shapes),
  // data-frame (photo frame presets), or data-svg (SVG shape / icon).
  document.querySelectorAll(".ed-shape").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.frame) addFrame(btn.dataset.frame);
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
  $("ed-bg-color").addEventListener("input", (e) => {
    state.canvas.background = e.target.value;
    fullRender();
  });
  $("ed-bg-color").addEventListener("change", () => pushHistory());
  document.querySelectorAll(".ed-grad").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.canvas.background = btn.dataset.grad;
      pushHistory();
      fullRender();
    });
  });

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

  function handleFiles(files) {
    Array.from(files || []).forEach((f) => {
      if (!f.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        state.uploads.push(reader.result);
        const b = document.createElement("button");
        const img = document.createElement("img");
        img.src = reader.result;
        b.appendChild(img);
        b.addEventListener("click", () => addImage(reader.result));
        // Make uploaded photos draggable too so they can be dropped on frames
        b.draggable = true;
        b.addEventListener("dragstart", (e) => {
          if (!e.dataTransfer) return;
          e.dataTransfer.setData("text/uri-list", reader.result);
          e.dataTransfer.setData("text/plain", reader.result);
          e.dataTransfer.effectAllowed = "copy";
        });
        uploadGridEl.appendChild(b);
      };
      reader.readAsDataURL(f);
    });
  }

  // ---------- Toolbar buttons ----------
  $("ed-undo").addEventListener("click", undo);
  $("ed-redo").addEventListener("click", redo);
  $("ed-zoom-in").addEventListener("click", () => setZoom(state.zoom + 0.1));
  $("ed-zoom-out").addEventListener("click", () => setZoom(state.zoom - 0.1));
  $("ed-zoom-fit").addEventListener("click", fitZoom);
  zoomDisplayEl.addEventListener("click", () => setZoom(1));
  $("ed-save").addEventListener("click", save);

  // Crop — placeholder for the moment. The full drag-resize crop UI is
  // deferred; this just checks the user has an image selected so we can
  // wire the real flow into the same button later.
  $("ed-crop")?.addEventListener("click", function () {
    const el = getEl(state.selectedIds[0]);
    if (!el || el.type !== "image") {
      toast("Select an image to crop it", 2400);
      return;
    }
    toast("Crop tool coming soon — use Replace image for now", 3000);
  });

  // Flip — works on any selected element. Toggles flipX (horizontal).
  // The right-click menu has both axes; this top-bar button is the
  // common-case fast path.
  $("ed-flip")?.addEventListener("click", function () {
    if (!state.selectedIds.length) {
      toast("Select something to flip", 2400);
      return;
    }
    flipSelected("h");
  });

  // Share — uses the Web Share API where available (mobile, modern desktop
  // Chromium). Falls back to a PNG download so the user can post manually.
  $("ed-share")?.addEventListener("click", async function () {
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

    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(); return; }
    if (e.key === "Escape") { state.selectedIds = []; fullRender(); return; }
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

  // Onboarding pack-picker hook. Scopes the studio's template grid to a chosen
  // pack and opens its first design for editing. `templateIds` is the pack's
  // list; if it's empty or none resolve, we fall back to the full library so a
  // click always lands on something editable.
  window.__TMKE_OPEN_PACK__ = function (templateIds) {
    const ids = Array.isArray(templateIds) ? templateIds.filter(Boolean) : [];
    let scoped = ids.map((id) => TEMPLATES.find((t) => t.id === id)).filter(Boolean);
    if (!scoped.length) scoped = TEMPLATES.slice();
    if (!scoped.length) return;
    PACK_TEMPLATES = scoped;
    tplGridEl.innerHTML = "";   // force a fresh, scoped render
    renderTemplateGrid();
    loadTemplate(scoped[0].id, false);
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
  if (isAdminMode() && TEMPLATES.length) {
    // Admin: the bootstrap moved the requested template to index 0. Load it so
    // editing an existing template shows its design, and a freshly-created one
    // (empty elements) opens as a blank canvas to build from scratch.
    loadTemplate(TEMPLATES[0].id, false);
  } else if (explicitTpl) {
    loadTemplate(explicitTpl, false);
  } else {
    loadBlank();
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
