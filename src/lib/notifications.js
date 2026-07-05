// Member-hub notifications — surfaces booking correspondence in the header /
// dashboard bell, deep-linking each item to its booking. Shared by
// WorkspaceHeader.astro and dashboard.astro (both use the same .ws-notif markup).
//
// Read state is tracked client-side with a single "last seen" timestamp in
// localStorage — no extra table. A notification is unread if it's newer than
// the last time the member opened/cleared the bell.
import { supabase } from "./supabase.js";

const WORKER = (import.meta.env.PUBLIC_R2_WORKER_URL || "").replace(/\/+$/, "");
const SEEN_KEY = "tmke_notif_seen";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m";
  if (s < 86400) return Math.round(s / 3600) + "h";
  if (s < 604800) return Math.round(s / 86400) + "d";
  return Math.round(s / 604800) + "w";
}
const ICON_BOOKING = '<rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>';
const ICON_MESSAGE = '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>';

function titleFor(m) {
  if (m.subject) return m.subject;
  if (m.kind === "confirmation") return "Booking confirmed";
  if (m.kind === "reschedule") return "Booking rescheduled";
  if (m.kind === "cancellation") return "Booking cancelled";
  return "New message";
}

export async function initNotifications() {
  const lists = Array.from(document.querySelectorAll(".ws-notif-list"));
  if (!lists.length || !WORKER) return;

  let session;
  try { session = (await supabase.auth.getSession()).data.session; } catch (_) { return; }
  if (!session) return;

  let messages = [];
  try {
    const res = await fetch(`${WORKER}/booking/mine`, { headers: { Authorization: "Bearer " + session.access_token } });
    if (!res.ok) return;
    const t = await res.json();
    messages = t.messages || [];
  } catch (_) { return; }

  const notifs = messages
    .filter((m) => m.direction !== "inbound")
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);

  const seen = Number(localStorage.getItem(SEEN_KEY) || 0);
  const unread = notifs.filter((m) => new Date(m.created_at).getTime() > seen).length;

  const html = notifs.length
    ? notifs.map((m) => {
        const isNew = new Date(m.created_at).getTime() > seen;
        const icon = ["confirmation", "reschedule", "cancellation"].includes(m.kind) ? ICON_BOOKING : ICON_MESSAGE;
        const href = `/account/bookings?open=${encodeURIComponent(m.booking_source + ":" + m.booking_id)}`;
        return `<a class="ws-notif-item${isNew ? " is-unread" : ""}" role="menuitem" href="${href}" data-notif-item>
          <span class="ws-notif-ic ws-notif-ic--booking"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg></span>
          <span class="ws-notif-txt"><b>${esc(titleFor(m))}</b><i>${esc((m.body || "").slice(0, 90))}</i></span>
          <span class="ws-notif-time">${timeAgo(m.created_at)}</span>
        </a>`;
      }).join("")
    : `<div class="ws-notif-empty">You're all caught up.</div>`;

  lists.forEach((l) => { l.innerHTML = html; });

  // Unread dot reflects real state.
  document.querySelectorAll(".ws-notif").forEach((n) => n.classList.toggle("is-read", unread === 0));

  const markRead = () => {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
    document.querySelectorAll(".ws-notif").forEach((n) => n.classList.add("is-read"));
    document.querySelectorAll(".ws-notif-item.is-unread").forEach((i) => i.classList.remove("is-unread"));
  };
  document.querySelectorAll("[data-notif-clear]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); markRead(); }));
  document.querySelectorAll("[data-notif-item]").forEach((a) => a.addEventListener("click", markRead));
}
