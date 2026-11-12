/* The top bar's Plan tab reads Calendar for a member on any Content Calendar
   subscription (Content Calendar, Content Calendar Plus, Planned and Posted),
   and Plan for everyone else (Danielle, 12 Nov). The answer is /access/me's
   `calendar`, kept in this browser for 30 minutes against the signed-in
   login, so the tab is right before the page paints (the inline script in
   WorkspaceHeader.astro and the dashboard reads the same key). */
const KEY = "tmke.navCalendar";
const FRESH = 30 * 60000;

function uid() {
  try { const a = JSON.parse(localStorage.getItem("tmke-member-auth") || "null"); return (a && a.user && a.user.id) || ""; } catch (_) { return ""; }
}
export function paintPlanTab(on) {
  document.querySelectorAll("[data-plan-tab]").forEach((a) => { a.textContent = on ? "Calendar" : "Plan"; });
}
export async function initPlanTab(supabase) {
  const me = uid();
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    if (c && c.uid === me && Date.now() - c.at < FRESH) { paintPlanTab(!!c.v); return; }
  } catch (_) {}
  try {
    const { memberAccess } = await import("./calendar-month.js");
    const a = await memberAccess(supabase);
    if (!a) return;   // signed out, or no answer: leave the tab as it is
    const on = !!a.calendar;
    paintPlanTab(on);
    try { localStorage.setItem(KEY, JSON.stringify({ uid: me, v: on, at: Date.now() })); } catch (_) {}
  } catch (_) {}
}
