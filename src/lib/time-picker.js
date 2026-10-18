/* A time picker in the hub's own style (Dani, 17 Oct 2026).

   The browser's own time list can't be styled, and its minutes run 00 to 59.
   This one is the width of its box, in two rows (Dani, 16 Oct): the hours, a
   strip that slides sideways with the chosen one in the middle, and below
   them the minutes in quarter hours. What's chosen is larger and plum; the
   rest are smaller and quieter, so the time on show is plain at a glance.

   Any <input data-time> becomes one. It is a read-only text box holding
   "HH:MM" (or "" when it's optional and empty), exactly the value a time
   input gave, so the code that reads .value doesn't change. Choosing fires
   `input` and `change`. `data-time-optional` adds a Clear button. An older
   value that isn't on a quarter hour (09:10) still shows as it is. */

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

const CSS = `
input[data-time] {
  cursor: pointer; caret-color: transparent;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='6.2' fill='none' stroke='%23371e28' stroke-width='1.3'/%3E%3Cpath d='M8 4.6V8l2.3 1.5' fill='none' stroke='%23371e28' stroke-width='1.3' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 12px center; background-size: 15px; padding-right: 38px !important;
}
.tp-pop { position: fixed; z-index: 1400; min-width: 200px; box-sizing: border-box; background: #fff; border-radius: 8px;
  border: 1px solid rgba(28,29,34,0.12); box-shadow: 0 14px 34px rgba(28,29,34,0.18);
  font-family: var(--sans); color: var(--ink, #1c1d22); opacity: 0; transform: translateY(-4px);
  transition: opacity 0.14s ease, transform 0.14s ease; }
.tp-pop.is-open { opacity: 1; transform: none; }
.tp-pop[hidden] { display: none; }
.tp-row { display: grid; grid-template-columns: 38px minmax(0, 1fr); align-items: start; gap: 6px; padding: 8px 10px 4px; }
.tp-row > .tp-head { line-height: 32px; }
.tp-row + .tp-row { padding-top: 4px; padding-bottom: 8px; }
.tp-head { font-size: var(--ws-t-label, 10px); font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(28,29,34,0.5); }
/* The hours: a strip with a slider under it to drag along (Dani, 16 Oct), and
   it settles on a whole hour, so the minutes below line up with the first
   four hours on show. */
.tp-hours { display: flex; gap: 2px; overflow-x: auto; scroll-behavior: smooth; cursor: grab; padding-bottom: 6px;
  scroll-snap-type: x mandatory; scrollbar-width: thin; scrollbar-color: var(--violet-deep, #371e28) transparent;
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 16px), transparent);
          mask-image: linear-gradient(90deg, #000 calc(100% - 16px), transparent); }
.tp-hours > .tp-opt { scroll-snap-align: start; }
.tp-hours::-webkit-scrollbar { height: 6px; }
/* No grey track: only the wine bar to drag (Dani, 18 Oct). */
.tp-hours::-webkit-scrollbar-track { background: transparent; }
.tp-hours::-webkit-scrollbar-thumb { background: var(--violet-deep, #371e28); border-radius: 3px; }
.tp-hours.is-dragging { cursor: grabbing; scroll-behavior: auto; scroll-snap-type: none; }
.tp-mins { display: flex; gap: 2px; }
.tp-mins > .tp-opt { width: 34px; }
/* Smaller, and the choice is the same size as the rest, only bold and wine:
   no box behind it (Dani, 18 Oct). */
.tp-opt { all: unset; box-sizing: border-box; flex: none; width: 34px; height: 32px; border-radius: 4px; text-align: center; cursor: pointer;
  font-size: 13px; line-height: 32px; font-variant-numeric: tabular-nums; color: rgba(28,29,34,0.55); transition: color 0.12s; }
.tp-opt:hover { color: var(--violet-deep, #371e28); }
.tp-opt:focus-visible { outline: 2px solid var(--violet-deep, #371e28); outline-offset: -2px; }
.tp-opt.is-on { font-weight: 700; color: var(--violet-deep, #371e28); }
.tp-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 8px; border-top: 1px solid rgba(28,29,34,0.08); }
.tp-btn { all: unset; cursor: pointer; height: 26px; padding: 0 12px; border-radius: 4px; font-size: 10px; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--violet-deep, #371e28); border: 1px solid rgba(var(--violet-rgb, 55, 30, 40), 0.3); }
.tp-btn:hover { background: rgba(var(--violet-rgb, 55, 30, 40), 0.08); }
.tp-btn--primary { background: var(--violet-deep, #371e28); border-color: var(--violet-deep, #371e28); color: #fff; }
.tp-btn--primary:hover { background: var(--violet-deep, #371e28); opacity: 0.9; }
.tp-btn[hidden] { display: none; }
`;

let pop = null, input = null, hour = "", minute = "";

function build() {
  if (pop) return;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  pop = document.createElement("div");
  pop.className = "tp-pop"; pop.hidden = true;
  pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Choose a time");
  const opts = (list, kind) => list.map((v) => `<button type="button" class="tp-opt" data-tp-${kind}="${v}">${v}</button>`).join("");
  pop.innerHTML = `<div class="tp-row"><div class="tp-head">Hour</div><div class="tp-hours" data-tp-col="h">${opts(HOURS, "h")}</div></div>
    <div class="tp-row"><div class="tp-head">Min</div><div class="tp-mins" data-tp-col="m">${opts(MINUTES, "m")}</div></div>
    <div class="tp-foot">
      <button type="button" class="tp-btn" data-tp-clear>Clear</button>
      <button type="button" class="tp-btn tp-btn--primary" data-tp-done>Done</button>
    </div>`;
  document.body.appendChild(pop);
  // mousedown would blur the input and move focus; keep it where it is.
  pop.addEventListener("mousedown", (e) => e.preventDefault());
  // The hours slide sideways: a trackpad or touch does it already; a mouse
  // wheel turns it, and a mouse can drag it. A drag isn't a click.
  const strip = pop.querySelector("[data-tp-col=\"h\"]");
  let drag = null, dragged = false;
  strip.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); strip.scrollLeft += e.deltaY; }
  }, { passive: false });
  strip.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    if (e.offsetY > strip.clientHeight - 2) return;   // the slider drags itself
    drag = { x: e.clientX, left: strip.scrollLeft }; dragged = false;
  });
  addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) { dragged = true; strip.classList.add("is-dragging"); }
    if (dragged) strip.scrollLeft = drag.left - dx;
  });
  addEventListener("pointerup", () => { drag = null; strip.classList.remove("is-dragging"); });
  pop.addEventListener("click", (e) => {
    const h = e.target.closest("[data-tp-h]"), m = e.target.closest("[data-tp-m]");
    if (h && dragged) { dragged = false; return; }
    if (h) { hour = h.dataset.tpH; if (!minute) minute = "00"; commit(); mark(); centreHour(); return; }
    if (m) { minute = m.dataset.tpM; if (!hour) hour = "09"; commit(); close(); return; }
    if (e.target.closest("[data-tp-clear]")) { hour = minute = ""; commit(); close(); return; }
    if (e.target.closest("[data-tp-done]")) close();
  });
}

function commit() {
  if (!input) return;
  const v = hour && minute ? `${hour}:${minute}` : "";
  if (input.value === v) return;
  input.value = v;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function mark() {
  pop.querySelectorAll("[data-tp-h]").forEach((b) => b.classList.toggle("is-on", b.dataset.tpH === hour));
  pop.querySelectorAll("[data-tp-m]").forEach((b) => b.classList.toggle("is-on", b.dataset.tpM === minute));
}

// The chosen hour (or nine o'clock) on show, with the hour before it.
function centreHour(instant) {
  const strip = pop.querySelector('[data-tp-col="h"]');
  const at = pop.querySelector(`[data-tp-h="${hour || "09"}"]`);
  if (!strip || !at) return;
  const step = at.offsetWidth + 2;
  const left = Math.max(0, at.offsetLeft - strip.offsetLeft - step);   // one hour before it shows too
  if (instant) { strip.style.scrollBehavior = "auto"; strip.scrollLeft = left; strip.style.scrollBehavior = ""; }
  else strip.scrollLeft = left;
}

function place() {
  if (!input || pop.hidden) return;
  const r = input.getBoundingClientRect();
  pop.style.width = Math.max(200, Math.round(r.width)) + "px";   // as wide as its box
  const h = pop.offsetHeight, w = pop.offsetWidth;
  const below = innerHeight - r.bottom;
  const top = below >= h + 12 || r.top < h + 12 ? Math.min(r.bottom + 6, innerHeight - h - 8) : r.top - h - 6;
  pop.style.top = Math.max(8, top) + "px";
  pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px";
}

function open(el) {
  build();
  if (input === el && !pop.hidden) return;
  input = el;
  const m = /^(\d{2}):(\d{2})/.exec(el.value || "");
  hour = m ? m[1] : ""; minute = m ? m[2] : "";
  mark();
  pop.querySelector("[data-tp-clear]").hidden = !el.hasAttribute("data-time-optional");
  pop.hidden = false;
  place();
  centreHour(true);
  requestAnimationFrame(() => pop.classList.add("is-open"));
}

function close() {
  if (!pop || pop.hidden) return;
  pop.classList.remove("is-open");
  pop.hidden = true;
  input = null;
}

let installed = false;
export function installTimePicker() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest("input[data-time]");
    if (el) { open(el); return; }
    if (pop && !pop.hidden && !e.target.closest(".tp-pop")) close();
  });
  document.addEventListener("keydown", (e) => {
    const el = e.target.closest && e.target.closest("input[data-time]");
    if (el && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) { e.preventDefault(); open(el); return; }
    if (e.key === "Escape" && pop && !pop.hidden) { e.stopPropagation(); close(); }
    if (e.key === "Tab" && pop && !pop.hidden && !e.target.closest(".tp-pop")) close();
  }, true);
  // Stay with the box when the form scrolls or the window resizes.
  addEventListener("scroll", place, true);
  addEventListener("resize", place);
}
