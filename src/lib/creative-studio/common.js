// Creative Studio (Dani, 8 Nov 2026): what the Library, Client portals and Photo
// editing tabs share. The look was agreed on the mock-up in
// docs/tmke-os/creative-studio/index.html.
import { supabase } from "../supabase.js";

export const WORKER = (import.meta.env.PUBLIC_R2_WORKER_URL || "").trim().replace(/\/+$/, "");
export const ROOT = "deliverables/";
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// Set by the page, so the tabs can hand over to each other.
export const hooks = {};

export async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session ? data.session.access_token : "";
}
export async function api(path, opts = {}) {
  const t = await token();
  const res = await fetch(WORKER + path, { ...opts, headers: { ...(opts.headers || {}), Authorization: "Bearer " + t } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Something went wrong (${res.status}).`);
  return body;
}

let toastT;
export function toast(text) {
  const e = $("#cs-toast");
  e.textContent = text; e.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (e.hidden = true), 4200);
}

/* One pop-out: one size, beside the sidebar. */
export function pop({ eyebrow, title, chipHtml = "", body, foot = "" }) {
  $("#cs-popup").innerHTML = `<div class="cs-scrim"></div><div class="cs-popw"><div class="cs-pop" role="dialog" aria-label="${esc(title)}"><div class="cs-pop-h"><div>${esc(eyebrow)}</div><div class="cs-pop-t">${esc(title)}</div>${chipHtml}</div><div class="cs-pop-b" data-lenis-prevent>${body}</div><div class="cs-pop-f">${foot}<button type="button" class="cs-btn" id="cs-pop-x">Close</button></div></div></div>`;
  $("#cs-pop-x").onclick = closePop; $(".cs-scrim").onclick = closePop;
}
export function closePop() { $("#cs-popup").innerHTML = ""; }
export function confirmPop({ eyebrow, title, text, yes, onYes }) {
  pop({ eyebrow, title, body: `<p>${esc(text)}</p>`, foot: `<button type="button" class="cs-btn cs-pri" id="cs-yes">${esc(yes)}</button>` });
  $("#cs-yes").onclick = async () => { $("#cs-yes").disabled = true; await onYes(); };
}

export const chip = (t, k) => `<span class="cs-chip${k ? " cs-chip-" + k : ""}">${esc(t)}</span>`;
export const rowsOf = (list) => list.map(([k, v]) => `<div class="cs-row"><span class="cs-k">${esc(k)}</span><span class="cs-v">${esc(v)}</span></div>`).join("");
export const cleanName = (n) => String(n).replace(/^\d{10,}-/, "");
export const fmtSize = (n) => {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"], i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return (n / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + u[i];
};
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function fmtD(s) {
  if (!s) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : new Date(s);
  if (isNaN(d)) return "";
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}${d.getFullYear() === new Date().getFullYear() ? "" : " " + d.getFullYear()}`;
}
export const isFilm = (f) => /^video\//.test(f.contentType || "") || /\.(mp4|mov|m4v|webm)$/i.test(f.name);
export const isPhoto = (f) => /^image\//.test(f.contentType || "") || /\.(jpe?g|png|webp|avif|gif|heic)$/i.test(f.name);
export const isEditable = (f) => /\.(jpe?g|png|webp)$/i.test(f.name);
export function saveFile(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
