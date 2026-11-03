/* The colour pop-out, for pages outside the Studio (Dani, 3 Nov): the brand
   kit colours on the profile, the dashboard theme trial, the Admin brand kit
   form and the website editor. It is the Studio's own pop-out (editor.js,
   toggleColorPop) in the same order and the same look: kit colours, one line
   of recently used, then the picker with its hex box. Every one of these used
   to open the operating system's picker, which shows R/G/B boxes where brand
   work is written in hex, and is a different shape on every machine.

   openColourPop(anchor, {
     key,          names the control; pressing it again closes the pop-out
     current,      the colour now
     kit, kitLabel the colours to offer first, and what to call them
     onChange(hex) live, while you drag or type
     onCommit(hex) once per choice
   })

   Recently used is the Studio's list (localStorage tmke.recentColors), so a
   colour picked in one place is there in the others. */

const RECENT_KEY = "tmke.recentColors";
let current = null;   // { el, key }

export function normHex(v) {
  if (!v) return null;
  let s = String(v).trim();
  if (/^[0-9a-f]{6}$/i.test(s)) s = "#" + s;
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) return ("#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toUpperCase();
  const m = s.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (m) return rgbToHex(+m[1], +m[2], +m[3]);
  return null;
}
function rgbToHex(r, g, b) {
  return ("#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")).toUpperCase();
}
function hexToRgb(hex) {
  const h = normHex(hex) || "#000000";
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function hsvToRgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
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

function loadRecent() {
  try { const a = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (_) { return []; }
}
function pushRecent(hex) {
  const h = normHex(hex);
  if (!h) return;
  const list = [h].concat(loadRecent().filter((c) => c !== h)).slice(0, 12);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (_) {}
}

const CSS = `
.tcp-pop { position: fixed; z-index: 2147483647; width: 272px; box-sizing: border-box; padding: 14px 14px 2px;
  background: #fff; border: 1px solid rgba(28,29,34,0.12); border-radius: 6px;
  box-shadow: 0 18px 50px -10px rgba(28,29,34,0.25);
  font-family: var(--sans, "Darker Grotesque", system-ui, sans-serif); color: #1c1d22; text-align: left; }
.tcp-pop *, .tcp-pop *::before, .tcp-pop *::after { box-sizing: border-box; }
.tcp-sec { margin: 0 0 14px; }
.tcp-sec h5 { font-family: inherit; font-size: 11px; font-weight: 700; line-height: 1.2; letter-spacing: 0.08em;
  text-transform: uppercase; color: rgba(28,29,34,0.5); margin: 0 0 9px; }
.tcp-grid { display: flex; flex-wrap: wrap; gap: 7px; }
.tcp-line { flex-wrap: nowrap; overflow: hidden; padding: 4px; margin: -4px; }
.tcp-sw { width: 26px; height: 26px; flex: 0 0 auto; border-radius: 7px; cursor: pointer; padding: 0; margin: 0;
  border: 1px solid rgba(28,29,34,0.14); transition: transform 0.12s; }
.tcp-sw:hover { transform: scale(1.15); }
.tcp-sw.is-current { box-shadow: 0 0 0 2px #fff, 0 0 0 4px #371e28; }
.tcp-empty { font-size: 12px; color: rgba(28,29,34,0.45); margin: 0; }
.tcp-pick { display: flex; flex-direction: column; gap: 10px; }
.tcp-sv { position: relative; width: 100%; aspect-ratio: 3 / 2; border-radius: 10px; overflow: hidden;
  cursor: crosshair; touch-action: none; user-select: none; }
.tcp-sv-w, .tcp-sv-b { position: absolute; inset: 0; }
.tcp-sv-w { background: linear-gradient(to right, #fff, rgba(255,255,255,0)); }
.tcp-sv-b { background: linear-gradient(to top, #000, rgba(0,0,0,0)); }
.tcp-dot, .tcp-hue-dot { position: absolute; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(20,18,26,0.45), 0 1px 4px rgba(20,18,26,0.4); transform: translate(-50%, -50%); pointer-events: none; }
.tcp-hue { position: relative; height: 14px; border-radius: 999px; cursor: pointer; touch-action: none; user-select: none;
  background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%); }
.tcp-hue-dot { top: 50%; }
.tcp-foot { display: flex; align-items: center; gap: 8px; }
.tcp-preview { width: 30px; height: 30px; border-radius: 8px; flex: none; border: 1px solid rgba(28,29,34,0.18); }
.tcp-hex { flex: 1; min-width: 0; margin: 0; padding: 8px 10px; font-family: inherit; font-size: 14px; font-weight: 600;
  letter-spacing: 0.04em; text-transform: uppercase; color: #1c1d22; background: #f4f2f1;
  border: 1px solid rgba(28,29,34,0.18); border-radius: 8px; }
.tcp-hex:focus { outline: none; border-color: #371e28; box-shadow: 0 0 0 3px rgba(55,30,40,0.1); }
.tcp-drop { width: 32px; height: 32px; flex: none; display: flex; align-items: center; justify-content: center; padding: 0;
  border: 1px solid rgba(28,29,34,0.18); border-radius: 8px; background: #f4f2f1; color: #371e28; cursor: pointer; }
.tcp-drop:hover { background: rgba(55,30,40,0.06); border-color: rgba(55,30,40,0.4); }
`;
function ensureCss() {
  if (document.getElementById("tcp-css")) return;
  const st = document.createElement("style");
  st.id = "tcp-css";
  st.textContent = CSS;
  document.head.appendChild(st);
}

function buildPicker(initial, onChange, onCommit) {
  let [h, s, v] = rgbToHsv(...hexToRgb(initial || "#000000"));
  const wrap = document.createElement("div");
  wrap.className = "tcp-pick";
  wrap.innerHTML =
    '<div class="tcp-sv"><div class="tcp-sv-w"></div><div class="tcp-sv-b"></div><span class="tcp-dot"></span></div>' +
    '<div class="tcp-hue"><span class="tcp-hue-dot"></span></div>' +
    '<div class="tcp-foot"><span class="tcp-preview"></span>' +
      '<input class="tcp-hex" spellcheck="false" maxlength="7" aria-label="Hex code">' +
      '<button type="button" class="tcp-drop" title="Pick a colour from the screen">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M19 2l3 3-9 9-3-3 9-9z"/><path d="M10 11l-6 6v3h3l6-6"/></svg></button></div>';
  const sv = wrap.querySelector(".tcp-sv"), dot = wrap.querySelector(".tcp-dot");
  const hue = wrap.querySelector(".tcp-hue"), hueDot = wrap.querySelector(".tcp-hue-dot");
  const hexIn = wrap.querySelector(".tcp-hex"), preview = wrap.querySelector(".tcp-preview");
  const drop = wrap.querySelector(".tcp-drop");
  const hex = () => rgbToHex(...hsvToRgb(h, s, v));
  function paint(skipField) {
    const cur = hex();
    sv.style.background = "hsl(" + Math.round(h) + ",100%,50%)";
    dot.style.left = (s * 100) + "%"; dot.style.top = ((1 - v) * 100) + "%"; dot.style.background = cur;
    hueDot.style.left = ((h / 360) * 100) + "%";
    preview.style.background = cur;
    if (!skipField) hexIn.value = cur;
  }
  paint();
  function drag(box, onPos) {
    const move = (e) => {
      const r = box.getBoundingClientRect();
      onPos(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
      paint(); onChange(hex());
    };
    box.addEventListener("pointerdown", (e) => {
      e.preventDefault(); move(e);
      const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); onCommit(hex()); };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    });
  }
  drag(sv, (x, y) => { s = x; v = 1 - y; });
  drag(hue, (x) => { h = x * 360; });
  const set = (n) => { [h, s, v] = rgbToHsv(...hexToRgb(n)); };
  hexIn.addEventListener("input", () => { const n = normHex(hexIn.value); if (!n) return; set(n); paint(true); onChange(n); });
  hexIn.addEventListener("change", () => { const n = normHex(hexIn.value); if (n) onCommit(n); });
  // The browser's eyedropper where there is one (Chromium); gone where not.
  if (window.EyeDropper) {
    drop.addEventListener("click", async () => {
      try { const n = normHex((await new window.EyeDropper().open()).sRGBHex); if (!n) return; set(n); paint(); onChange(n); onCommit(n); } catch (_) {}
    });
  } else drop.remove();
  wrap.setColor = (c) => { const n = normHex(c); if (n) { set(n); paint(); } };
  return wrap;
}

export function closeColourPop() {
  if (!current) return;
  current.el.remove();
  current = null;
}

export function openColourPop(anchor, o) {
  if (current && current.key === o.key) { closeColourPop(); return; }
  closeColourPop();
  ensureCss();
  anchor.setAttribute("data-tcp-key", o.key);
  const cur = normHex(o.current);
  const kit = [...new Set((o.kit || []).map(normHex).filter(Boolean))];
  const recent = loadRecent().slice(0, 9);
  const sw = (c) => '<button type="button" class="tcp-sw' + (c === cur ? " is-current" : "") + '" data-hex="' + c + '" style="background:' + c + '" title="' + c + '"></button>';
  const pop = document.createElement("div");
  pop.className = "tcp-pop";
  pop.innerHTML =
    '<div class="tcp-sec"><h5></h5>' + (kit.length ? '<div class="tcp-grid">' + kit.map(sw).join("") + '</div>' : '<p class="tcp-empty">No brand colours saved.</p>') + '</div>' +
    (recent.length ? '<div class="tcp-sec"><h5>Recently used</h5><div class="tcp-grid tcp-line">' + recent.map(sw).join("") + '</div></div>' : "") +
    '<div class="tcp-sec"><h5>Add a colour</h5><div data-mount></div></div>';
  pop.querySelector("h5").textContent = o.kitLabel || "Kit colours";
  const picker = buildPicker(cur || "#000000",
    (hex) => o.onChange(hex),
    (hex) => { pushRecent(hex); if (o.onCommit) o.onCommit(hex); });
  pop.querySelector("[data-mount]").appendChild(picker);
  pop.addEventListener("click", (e) => {
    const b = e.target.closest(".tcp-sw");
    if (!b) return;
    pop.querySelectorAll(".tcp-sw.is-current").forEach((x) => x.classList.remove("is-current"));
    b.classList.add("is-current");
    picker.setColor(b.dataset.hex);
    o.onChange(b.dataset.hex);
    pushRecent(b.dataset.hex);
    if (o.onCommit) o.onCommit(b.dataset.hex);
  });
  document.body.appendChild(pop);
  // Only the recent colours that fit whole.
  const line = pop.querySelector(".tcp-line");
  if (line) { const right = line.getBoundingClientRect().right; [...line.children].forEach((c) => { if (c.getBoundingClientRect().right > right + 0.5) c.remove(); }); }
  // Under the control, or above it when there's no room; inside the window.
  const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, ht = pop.offsetHeight;
  let top = r.bottom + 6;
  if (top + ht > window.innerHeight - 12) top = Math.max(12, r.top - ht - 6);
  pop.style.top = top + "px";
  pop.style.left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12)) + "px";
  current = { el: pop, key: o.key };
}

if (typeof document !== "undefined" && !window.TMKEColourPop) {
  // Pressing anywhere else closes it; its own control's click closes it (toggle).
  document.addEventListener("pointerdown", (e) => {
    if (!current || !e.target || !e.target.closest) return;
    if (e.target.closest(".tcp-pop")) return;
    const own = e.target.closest("[data-tcp-key]");
    if (own && own.getAttribute("data-tcp-key") === current.key) return;
    closeColourPop();
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeColourPop(); });
  // The website editor is a plain script in /public, so it finds it here.
  window.TMKEColourPop = { open: openColourPop, close: closeColourPop };
}
