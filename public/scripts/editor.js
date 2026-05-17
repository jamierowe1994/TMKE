/* =============================================================
   TMKE Studio — Canva-style design editor
   ============================================================= */

(function () {
  "use strict";

  // ---------- Data ----------
  const TEMPLATES = JSON.parse(document.getElementById("ed-templates-data").textContent || "[]");
  const PHOTOS = JSON.parse(document.getElementById("ed-photos-data").textContent || "[]");

  const BASE_FONTS = [
    { name: "Cormorant Garamond", stack: '"Cormorant Garamond", serif', category: "Serif" },
    { name: "Darker Grotesque", stack: '"Darker Grotesque", sans-serif', category: "Sans" },
    { name: "Georgia", stack: 'Georgia, serif', category: "Serif" },
    { name: "Times New Roman", stack: '"Times New Roman", serif', category: "Serif" },
    { name: "Helvetica", stack: 'Helvetica, Arial, sans-serif', category: "Sans" },
    { name: "Arial", stack: 'Arial, sans-serif', category: "Sans" },
    { name: "Courier", stack: '"Courier New", monospace', category: "Mono" },
    { name: "Inter", stack: 'Inter, sans-serif', category: "Sans" },
    { name: "Trebuchet", stack: '"Trebuchet MS", sans-serif', category: "Sans" },
    { name: "Verdana", stack: 'Verdana, sans-serif', category: "Sans" },
  ];

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

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.add("is-show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toastEl.classList.remove("is-show"); toastEl.hidden = true; }, 1800);
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
          pushHistory();
          fullRender();
          fitZoom();
          return;
        }
      } catch (e) {}
    }

    state.canvas = deep(tpl.canvas);
    state.elements = deep(tpl.elements);
    state.selectedIds = [];
    filenameEl.value = tpl.name;
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
    state.elements.forEach((el) => {
      canvasEl.appendChild(renderElement(el));
    });

    renderHandles();
    renderLayers();
    renderContextBar();
    renderProps();
    renderTemplateGrid();
  }

  function partialRenderElement(el) {
    const node = canvasEl.querySelector('[data-id="' + el.id + '"]');
    if (!node) return;
    applyElementStyles(node, el);
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
    node.style.transform = "rotate(" + (el.rotation || 0) + "deg)";
    node.style.opacity = el.opacity != null ? el.opacity : 1;

    if (el.type === "rect" || el.type === "ellipse") {
      node.style.background = el.fill || "transparent";
      node.style.borderRadius = (el.type === "ellipse" ? "50%" : (el.radius || 0) + "px");
      node.style.border = (el.strokeWidth ? `${el.strokeWidth}px solid ${el.stroke || "transparent"}` : "none");
    }
    if (el.type === "line") {
      node.style.background = el.fill || "#000";
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

  function startResize(ev, el, handle) {
    ev.preventDefault();
    ev.stopPropagation();
    const startX = ev.clientX, startY = ev.clientY;
    const o = { x: el.x, y: el.y, w: el.w, h: el.h };
    const aspect = o.w / o.h;
    const lockAspect = (el.type === "image" || el.type === "ellipse");

    function onMove(e) {
      let dx = (e.clientX - startX) / state.zoom;
      let dy = (e.clientY - startY) / state.zoom;
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

    function commit() {
      inner.contentEditable = "false";
      node.classList.remove("is-editing");
      const newText = inner.textContent;
      if (newText !== el.text) {
        el.text = newText;
        pushHistory();
      }
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
    const w = 500, h = 500;
    addElement({ type: "image", x: state.canvas.width / 2 - w / 2, y: state.canvas.height / 2 - h / 2, w, h, src, opacity: 1, rotation: 0 });
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
  async function save() {
    if (!state.templateId) return;
    const payload = {
      templateId: state.templateId,
      filename: filenameEl.value,
      canvas: state.canvas,
      elements: state.elements,
      savedAt: Date.now(),
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
  async function exportImage(type) {
    const c = document.createElement("canvas");
    c.width = state.canvas.width;
    c.height = state.canvas.height;
    const ctx = c.getContext("2d");
    ctx.fillStyle = state.canvas.background || "#fff";
    ctx.fillRect(0, 0, c.width, c.height);

    for (const el of state.elements) {
      if (el.hidden) continue;
      ctx.save();
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((el.rotation || 0) * Math.PI / 180);
      ctx.translate(-el.w / 2, -el.h / 2);
      ctx.globalAlpha = el.opacity != null ? el.opacity : 1;

      if (el.type === "image") {
        try {
          const img = await loadImage(el.src);
          ctx.drawImage(img, 0, 0, el.w, el.h);
        } catch (e) {}
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
        const font = (FONTS.find((f) => f.name === el.font) || FONTS[0]).stack;
        ctx.fillStyle = el.color;
        ctx.font = `${el.italic ? "italic " : ""}${el.weight} ${el.size}px ${font}`;
        ctx.textBaseline = "top";
        ctx.textAlign = el.align;
        const lh = el.size * (el.lineHeight || 1.3);
        const lines = wrapText(ctx, el.text || "", el.w);
        let yy = 0;
        let tx = 0;
        if (el.align === "center") tx = el.w / 2;
        else if (el.align === "right") tx = el.w;
        for (const ln of lines) { ctx.fillText(ln, tx, yy); yy += lh; }
      }

      ctx.restore();
    }

    const mime = type === "jpg" ? "image/jpeg" : "image/png";
    const url = c.toDataURL(mime, 0.95);
    const a = document.createElement("a");
    a.href = url;
    a.download = (filenameEl.value || "design") + "." + type;
    a.click();
    toast("Exported " + type.toUpperCase());
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

  // ---------- Property panel ----------
  function renderProps() {
    if (state.selectedIds.length !== 1) {
      propsEl.innerHTML = `
        <div class="ed-props-empty">
          <div class="ed-props-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg>
          </div>
          <p>${state.selectedIds.length === 0 ? "Select an element to edit its properties." : state.selectedIds.length + " elements selected"}</p>
          <p class="ed-props-hint">Tip: press <kbd>?</kbd> for keyboard shortcuts.</p>
        </div>`;
      return;
    }
    const el = getEl(state.selectedIds[0]);
    if (!el) return;

    const html = [];
    html.push(`<div class="ed-props-section"><h4>Position &amp; size</h4>
      <div class="ed-props-row">
        <div class="ed-props-field"><label>X</label><input type="number" data-prop="x" value="${el.x}"></div>
        <div class="ed-props-field"><label>Y</label><input type="number" data-prop="y" value="${el.y}"></div>
      </div>
      <div class="ed-props-row">
        <div class="ed-props-field"><label>Width</label><input type="number" data-prop="w" value="${el.w}"></div>
        <div class="ed-props-field"><label>Height</label><input type="number" data-prop="h" value="${el.h}"></div>
      </div>
      <div class="ed-props-row">
        <div class="ed-props-field"><label>Rotation</label><input type="number" data-prop="rotation" value="${el.rotation || 0}"></div>
        <div class="ed-props-field"><label>Opacity</label><input type="range" min="0" max="1" step="0.05" data-prop="opacity" value="${el.opacity != null ? el.opacity : 1}"></div>
      </div>
    </div>`);

    if (el.type === "text") {
      html.push(`<div class="ed-props-section"><h4>Type</h4>
        <div class="ed-props-field"><label>Font</label>
          <select data-prop="font">
            ${FONTS.map(f => `<option value="${f.name}" ${f.name===el.font?"selected":""}>${f.name} — ${f.category}</option>`).join("")}
          </select>
        </div>
        <div class="ed-props-row">
          <div class="ed-props-field"><label>Size</label><input type="number" data-prop="size" min="6" max="500" value="${el.size}"></div>
          <div class="ed-props-field"><label>Weight</label>
            <select data-prop="weight">
              <option value="300" ${el.weight==300?"selected":""}>Light</option>
              <option value="400" ${el.weight==400?"selected":""}>Regular</option>
              <option value="500" ${el.weight==500?"selected":""}>Medium</option>
              <option value="600" ${el.weight==600?"selected":""}>Semibold</option>
              <option value="700" ${el.weight==700?"selected":""}>Bold</option>
              <option value="800" ${el.weight==800?"selected":""}>Black</option>
            </select>
          </div>
        </div>
        <div class="ed-props-row">
          <div class="ed-props-field"><label>Letter spacing</label><input type="number" data-prop="letterSpacing" step="0.1" value="${el.letterSpacing||0}"></div>
          <div class="ed-props-field"><label>Line height</label><input type="number" data-prop="lineHeight" step="0.05" value="${el.lineHeight||1.3}"></div>
        </div>
        <div class="ed-props-field"><label>Colour</label><input type="color" data-prop="color" value="${rgbHex(el.color)}"></div>
      </div>`);
    }

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
      html.push(`<div class="ed-props-section"><h4>Image</h4>
        <button class="ed-btn-ghost" id="ed-replace-img" style="background:rgba(28,29,34,0.06); width:100%">Replace image</button>
      </div>`);
    }

    html.push(`<div class="ed-props-section"><h4>Arrange</h4>
      <div class="ed-props-actions">
        <button data-arrange="up">Bring forward</button>
        <button data-arrange="down">Send back</button>
        <button data-arrange="front">To front</button>
        <button data-arrange="back">To back</button>
      </div>
    </div>`);

    html.push(`<div class="ed-props-section">
      <div class="ed-props-actions">
        <button data-action="lock">${el.locked ? "Unlock" : "Lock"}</button>
        <button data-action="duplicate">Duplicate</button>
        <button data-action="delete" class="danger">Delete</button>
      </div>
    </div>`);

    propsEl.innerHTML = html.join("");

    // Bind prop inputs
    propsEl.querySelectorAll("[data-prop]").forEach((input) => {
      const prop = input.dataset.prop;
      const ev = (input.type === "range" || input.type === "color") ? "input" : "change";
      input.addEventListener(ev, () => {
        const tgt = getEl(state.selectedIds[0]);
        if (!tgt) return;
        const val = input.type === "number" || input.type === "range" ? parseFloat(input.value) : input.value;
        tgt[prop] = val;
        fullRender();
        if (input.type !== "range") pushHistory();
      });
      if (input.type === "range") {
        input.addEventListener("change", () => pushHistory());
      }
    });

    propsEl.querySelectorAll("[data-arrange]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = btn.dataset.arrange;
        if (a === "up") bringForward();
        else if (a === "down") sendBack();
        else if (a === "front") bringToFront();
        else if (a === "back") sendToBack();
      });
    });
    propsEl.querySelectorAll("[data-action]").forEach((btn) => {
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

    const replaceBtn = propsEl.querySelector("#ed-replace-img");
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
  }

  function rgbHex(color) {
    if (!color) return "#000000";
    if (color.startsWith("#")) return color.length === 4
      ? "#" + color.slice(1).split("").map(c => c + c).join("")
      : color;
    // best-effort fallback
    return "#000000";
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
      // Font
      const g1 = group();
      const fontSel = document.createElement("select");
      fontSel.className = "ed-ctx-select";
      FONTS.forEach((f) => {
        const o = document.createElement("option");
        o.value = f.name; o.textContent = f.name;
        if (f.name === el.font) o.selected = true;
        fontSel.appendChild(o);
      });
      fontSel.addEventListener("change", () => { el.font = fontSel.value; fullRender(); pushHistory(); });
      g1.appendChild(fontSel);

      const sizeIn = document.createElement("input");
      sizeIn.type = "number"; sizeIn.className = "ed-ctx-num";
      sizeIn.value = el.size; sizeIn.min = 6; sizeIn.max = 600;
      sizeIn.addEventListener("change", () => { el.size = parseInt(sizeIn.value, 10); fullRender(); pushHistory(); });
      g1.appendChild(sizeIn);
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

      // Color
      const g4 = group();
      const color = document.createElement("input");
      color.type = "color";
      color.className = "ed-ctx-color";
      color.value = rgbHex(el.color);
      color.addEventListener("input", () => { el.color = color.value; fullRender(); });
      color.addEventListener("change", () => pushHistory());
      g4.appendChild(label("Colour"));
      g4.appendChild(color);
      ctxEl.appendChild(g4);
    } else if (el.type === "rect" || el.type === "ellipse" || el.type === "triangle" || el.type === "star" || el.type === "line") {
      const g = group();
      const fill = document.createElement("input");
      fill.type = "color"; fill.className = "ed-ctx-color"; fill.value = rgbHex(el.fill);
      fill.addEventListener("input", () => { el.fill = fill.value; fullRender(); });
      fill.addEventListener("change", () => pushHistory());
      g.appendChild(label("Fill"));
      g.appendChild(fill);
      ctxEl.appendChild(g);

      if (el.type === "rect") {
        const gr = group();
        gr.appendChild(label("Radius"));
        const r = document.createElement("input");
        r.type = "range"; r.min = 0; r.max = Math.min(el.w, el.h) / 2; r.value = el.radius || 0;
        r.style.width = "100px";
        r.addEventListener("input", () => { el.radius = parseInt(r.value, 10); fullRender(); });
        r.addEventListener("change", () => pushHistory());
        gr.appendChild(r);
        ctxEl.appendChild(gr);
      }
    } else if (el.type === "image") {
      const g = group();
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

    // Common: opacity, lock, duplicate, delete
    const gC = group();
    gC.appendChild(label("Opacity"));
    const op = document.createElement("input");
    op.type = "range"; op.min = 0; op.max = 1; op.step = 0.05;
    op.value = el.opacity != null ? el.opacity : 1;
    op.style.width = "80px";
    op.addEventListener("input", () => { el.opacity = parseFloat(op.value); partialRenderElement(el); });
    op.addEventListener("change", () => pushHistory());
    gC.appendChild(op);
    ctxEl.appendChild(gC);

    const gZ = group();
    gZ.appendChild(toggleBtn("⌃", false, bringForward, "Bring forward"));
    gZ.appendChild(toggleBtn("⌄", false, sendBack, "Send back"));
    gZ.appendChild(toggleBtn(el.locked ? "🔒" : "🔓", el.locked, () => { el.locked = !el.locked; pushHistory(); fullRender(); }, "Lock"));
    gZ.appendChild(toggleBtn("⎘", false, duplicateSelected, "Duplicate"));
    gZ.appendChild(toggleBtn("✕", false, deleteSelected, "Delete"));
    ctxEl.appendChild(gZ);

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
    TEMPLATES.forEach((t) => {
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
  document.querySelectorAll(".ed-rail-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ed-rail-btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const tool = btn.dataset.tool;
      document.querySelectorAll(".ed-panel-pane").forEach((p) => {
        p.classList.toggle("is-active", p.dataset.pane === tool);
      });
    });
  });

  // ---------- Shapes / text / bg / swatches bindings ----------
  document.querySelectorAll(".ed-shape").forEach((btn) => {
    btn.addEventListener("click", () => addShape(btn.dataset.shape));
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
  $("ed-export-png").addEventListener("click", () => exportImage("png"));
  $("ed-export-jpg").addEventListener("click", () => exportImage("jpg"));
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
  renderPhotoGrid();
  renderBrandPane();
  seedBrandIntoBackgroundPane();
  window.addEventListener("resize", () => fitZoom());

  // Read template ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const tplId = urlParams.get("template") || (TEMPLATES[0] && TEMPLATES[0].id);
  loadTemplate(tplId, false);

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
