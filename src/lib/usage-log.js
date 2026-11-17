/* The usage log (Danielle, 17 Nov 2026).
 *
 *   import { logUsage } from "../lib/usage-log.js";
 *   logUsage("post_opened", { post_id, month_id, template_id });
 *
 * One row in public.usage_log (supabase/usage_log.sql) for something a
 * signed-in member did with our templates or the Content Calendar. It's part
 * of running their membership, kept against their account on our server, so
 * unlike track.js it doesn't wait on the analytics cookie choice (privacy
 * policy, section 2). It never throws and never holds the page up.
 *
 * Not recorded: signed-out visitors, the team building templates
 * (?mode=admin), the Member Hub demo and the guided walkthroughs. Staff and
 * test logins are recorded and left out when the Insights are worked out.
 *
 * Events:
 *   hub_visit     the Member Hub, once a day
 *   month_viewed  a month's posts on the calendar, once a visit per month
 *   post_opened   a post clicked open on the calendar
 *   design_opened one of our templates opened in the Studio, once a visit
 *   copy_saved    their own copy of a template saved for the first time
 *   downloaded    a design downloaded
 *   course_part      a new part of a training course reached ({ course, part, of })
 *   course_completed a training course finished for the first time ({ course, of })
 *   guide_read       a training article read for the first time ({ course })
 */
import { supabase, isConfigured } from "./supabase.js";
import { isDemo } from "./demo.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOr = (v) => (v && UUID.test(String(v)) ? String(v) : null);

function skipped() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("mode") === "admin" || q.has("training")) return true;
    if (isDemo()) return true;
  } catch (_) {}
  return false;
}

export async function logUsage(event, f = {}) {
  if (!isConfigured || !event || skipped()) return;
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data && data.session && data.session.user && data.session.user.id;
    if (!uid) return;
    const row = {
      user_id: uid,
      event: String(event).slice(0, 40),
      template_id: f.template_id ? String(f.template_id).slice(0, 120) : null,
      post_id: uuidOr(f.post_id),
      month_id: uuidOr(f.month_id),
      design_id: uuidOr(f.design_id),
      detail: f.detail && typeof f.detail === "object" ? f.detail : null,
    };
    await supabase.from("usage_log").insert(row);
  } catch (_) { /* best-effort: never in the member's way */ }
}

/* Once per `key` for as long as `store` keeps it: sessionStorage for once a
   visit, localStorage with a dated key for once a day. */
export function logUsageOnce(key, event, f, store = "session") {
  try {
    const s = store === "local" ? localStorage : sessionStorage;
    const k = "tmke.usage." + key;
    if (s.getItem(k)) return;
    s.setItem(k, "1");
  } catch (_) {}
  logUsage(event, f);
}

// The Member Hub, once a day: "signed in but didn't open a post".
export function logHubVisit() {
  const d = new Date();
  const day = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  logUsageOnce("visit." + day, "hub_visit", { detail: { page: location.pathname.slice(0, 80) } }, "local");
}
