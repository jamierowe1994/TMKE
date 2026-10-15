/* A time picker in the hub's own style (Dani, 17 Oct 2026).

   The browser's own time list can't be styled, and its minutes run 00 to 59.
   This one has two columns, hours then minutes in quarter hours, and looks
   like the rest of the hub.

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
.tp-pop { position: fixed; z-index: 1400; width: 212px; background: #fff; border-radius: 8px;
  border: 1px solid rgba(28,29,34,0.12); box-shadow: 0 14px 34px rgba(28,29,34,0.18);
  font-family: var(--sans); color: var(--ink, #1c1d22); opacity: 0; transform: translateY(-4px);
  transition: opacity 0.14s ease, transform 0.14s ease; }
.tp-pop.is-open { opacity: 1; transform: none; }
.tp-pop[hidden] { display: none; }
.tp-heads, .tp-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 0 8px; }
.tp-heads { padding-top: 10px; border-bottom: 1px solid rgba(28,29,34,0.08); }
.tp-cols { padding-top: 6px; padding-bottom: 6px; }
.tp-col { display: grid; align-content: start; gap: 2px; max-height: 236px; overflow-y: auto; scrollbar-width: thin; padding-right: 2px; }
.tp-head { padding: 4px 0 6px; text-align: center; font-size: var(--ws-t-label, 10px); font-weight: 700; letter-spacing: 0.22em;
  text-transform: uppercase; color: rgba(28,29,34,0.5); }
.tp-opt { all: unset; box-sizing: border-box; height: 34px; border-radius: 5px; text-align: center; cursor: pointer;
  font-size: var(--ws-t-row, 14px); font-variant-numeric: tabular-nums; color: var(--ink, #1c1d22); }
.tp-opt:hover { background: rgba(var(--violet-rgb, 55, 30, 40), 0.08); color: var(--violet-deep, #371e28); }
.tp-opt:focus-visible { outline: 2px solid var(--violet-deep, #371e28); outline-offset: -2px; }
.tp-opt.is-on { background: var(--violet-deep, #371e28); color: #fff; font-weight: 600; }
.tp-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 8px; border-top: 1px solid rgba(28,29,34,0.08); }
.tp-btn { all: unset; cursor: pointer; height: 28px; padding: 0 12px; border-radius: 4px; font-size: 10px; font-weight: 700;
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
  pop.innerHTML = `<div class="tp-heads"><div class="tp-head">Hour</div><div class="tp-head">Min</div></div>
    <div class="tp-cols">
      <div class="tp-col" data-tp-col="h">${opts(HOURS, "h")}</div>
      <div class="tp-col" data-tp-col="m">${opts(MINUTES, "m")}</div>
    </div>
    <div class="tp-foot">
      <button type="button" class="tp-btn" data-tp-clear>Clear</button>
      <button type="button" class="tp-btn tp-btn--primary" data-tp-done>Done</button>
    </div>`;
  document.body.appendChild(pop);
  // mousedown would blur the input and move focus; keep it where it is.
  pop.addEventListener("mousedown", (e) => e.preventDefault());
  pop.addEventListener("click", (e) => {
    const h = e.target.closest("[data-tp-h]"), m = e.target.closest("[data-tp-m]");
    if (h) { hour = h.dataset.tpH; if (!minute) minute = "00"; commit(); mark(); return; }
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

function place() {
  if (!input || pop.hidden) return;
  const r = input.getBoundingClientRect();
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
  // The chosen hour (or nine o'clock) in view.
  const col = pop.querySelector('[data-tp-col="h"]');
  const at = pop.querySelector(`[data-tp-h="${hour || "09"}"]`);
  if (col && at) col.scrollTop = at.offsetTop - col.offsetTop - 36;
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
