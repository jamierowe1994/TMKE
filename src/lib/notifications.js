// Member-hub notifications — surfaces booking correspondence in the header /
// dashboard bell, deep-linking each item to its booking. Shared by
// WorkspaceHeader.astro and dashboard.astro (both use the same .ws-notif markup).
//
// Two sources:
//  - booking correspondence (Worker /booking/mine). Read state is a single
//    "last seen" timestamp in localStorage: unread if newer than that.
//  - member_notifications (member_notifications.sql): things we tell a member
//    directly, such as "your monthly report is ready". Read state lives on
//    the row (read_at), so it follows them from phone to laptop.
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
const ICON_REPORT = '<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="11" width="3" height="7"/><rect x="11" y="7" width="3" height="11"/><rect x="16" y="13" width="3" height="5"/>';
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
  if (!lists.length) return;

  let session;
  try { session = (await supabase.auth.getSession()).data.session; } catch (_) { return; }
  if (!session) return;

  // Both at once; either failing leaves the other.
  const [messages, direct] = await Promise.all([
    WORKER
      ? fetch(`${WORKER}/booking/mine`, { headers: { Authorization: "Bearer " + session.access_token } })
          .then((r) => (r.ok ? r.json() : {})).then((t) => t.messages || []).catch(() => [])
      : Promise.resolve([]),
    supabase.from("member_notifications").select("id,kind,title,body,href,created_at,read_at")
      .order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => data || []).catch(() => []),
  ]);

  const seen = Number(localStorage.getItem(SEEN_KEY) || 0);
  const items = [
    ...messages
      // Same rule as the bookings thread: internal notes are channel 'note' and
      // are never a member's notification. The Worker filters them too; this is
      // the second lock on the same door.
      .filter((m) => m.channel === "email")
      .filter((m) => m.direction !== "inbound")
      .map((m) => ({
        at: m.created_at, unread: new Date(m.created_at).getTime() > seen,
        title: titleFor(m), body: m.body, icon: ["confirmation", "reschedule", "cancellation"].includes(m.kind) ? ICON_BOOKING : ICON_MESSAGE, tone: "booking",
        href: `/account/bookings?open=${encodeURIComponent(m.booking_source + ":" + m.booking_id)}`,
      })),
    ...direct.map((n) => ({
      id: n.id, at: n.created_at, unread: !n.read_at,
      title: n.title, body: n.body, icon: /report/.test(n.kind || "") ? ICON_REPORT : ICON_MESSAGE, tone: "order",
      href: n.href || "/account",
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 10);

  const unread = items.filter((i) => i.unread).length;
  const html = items.length
    ? items.map((i) => `<a class="ws-notif-item${i.unread ? " is-unread" : ""}" role="menuitem" href="${esc(i.href)}" data-notif-item${i.id ? ` data-notif-id="${esc(i.id)}"` : ""}>
          <span class="ws-notif-ic ws-notif-ic--${i.tone}"><svg viewBox="0 0 24 24" aria-hidden="true">${i.icon}</svg></span>
          <span class="ws-notif-txt"><b>${esc(i.title)}</b><i>${esc((i.body || "").slice(0, 90))}</i></span>
          <span class="ws-notif-time">${timeAgo(i.at)}</span>
        </a>`).join("")
    : `<div class="ws-notif-empty">You're all caught up.</div>`;

  lists.forEach((l) => { l.innerHTML = html; });

  // Unread dot reflects real state.
  document.querySelectorAll(".ws-notif").forEach((n) => n.classList.toggle("is-read", unread === 0));

  const markAll = () => {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
    supabase.rpc("member_notifications_read_all").then(() => {}, () => {});
    document.querySelectorAll(".ws-notif").forEach((n) => n.classList.add("is-read"));
    document.querySelectorAll(".ws-notif-item.is-unread").forEach((i) => i.classList.remove("is-unread"));
  };
  document.querySelectorAll("[data-notif-clear]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); markAll(); }));
  // Opening one marks that one read (and, as before, the bookings as seen).
  // The page change would cut the write off, so wait for it (briefly).
  document.querySelectorAll("[data-notif-item]").forEach((a) => a.addEventListener("click", async (e) => {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
    const id = a.getAttribute("data-notif-id");
    if (!id || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    await Promise.race([supabase.rpc("member_notification_read", { p_id: id }).then(() => {}, () => {}), new Promise((r) => setTimeout(r, 900))]);
    location.href = a.getAttribute("href");
  }));
}
