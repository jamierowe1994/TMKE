/* Keeping a scheduled post true to the calendar (Content Calendar build list,
   Phase 4 row 3, Danielle, 11 Nov 2026). A post on Your calendar that has
   been sent to Zernio carries details.zernio. Whenever the calendar row
   changes what Zernio will post (the picture, caption, date or time) it is
   sent again; before the row is deleted it is taken back. Zernio must never
   go on to post the old version.

   Used by the Planner (account/schedule.astro) and Your Content Plan
   (account/content-plan.astro). The training account's planner has no
   Zernio, so nothing here runs for it. */

const BASE = (import.meta.env.PUBLIC_R2_WORKER_URL || "").replace(/\/+$/, "");

// What Zernio would post: change any of these and it has to be sent again.
export const SCHEDULE_FIELDS = ["asset_url", "caption", "scheduled_date", "scheduled_time", "has_time"];

export function zernioOf(item) {
  const z = item && item.details && item.details.zernio;
  return z && typeof z === "object" ? z : null;
}
// Waiting to go out: the only state a change or a delete has to deal with.
export function isScheduled(item) {
  const z = zernioOf(item);
  return !!(z && z.status === "scheduled" && z.post_id);
}

async function call(token, route, body) {
  if (!BASE) throw new Error("Scheduling isn't available here.");
  const res = await fetch(`${BASE}/schedule/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).catch(() => null);
  const out = res ? await res.json().catch(() => null) : null;
  if (!res || !res.ok || !out || !out.ok) throw new Error((out && out.error) || "We couldn't reach the scheduler just now. Try again in a moment.");
  return out;
}

export function schedulePost(token, itemId, accountIds) {
  return call(token, "post", { item_id: itemId, accountIds });
}
export function checkPost(token, itemId, caption, platforms) {
  return call(token, "check", { item_id: itemId, caption, platforms });
}
export function cancelPost(token, itemId) {
  return call(token, "cancel", { item_id: itemId });
}

/* After the row is saved: send a scheduled post again if what changed is
   something Zernio posts. Updates item.details.zernio. Returns true when it
   re-sent. Throws with a plain message if the scheduler refused, so the
   caller can say the calendar saved but the scheduled post didn't change. */
export async function resendIfScheduled(store, item, changedKeys) {
  if (!store || store.training || !isScheduled(item)) return false;
  if (!changedKeys.some((k) => SCHEDULE_FIELDS.includes(k))) return false;
  const z = zernioOf(item);
  try {
    const out = await schedulePost(store.token, item.id, z.accounts || []);
    item.details = { ...(item.details || {}), zernio: out.zernio };
    return true;
  } catch (e) {
    throw new Error(`Saved on your calendar, but the scheduled post didn't update: ${e.message} Open it and press Change, or Don't post it.`);
  }
}

/* Before the row is deleted: take a scheduled post back. Throws if it
   couldn't, so the row stays and nothing goes out unseen. */
export async function cancelIfScheduled(store, item) {
  if (!store || store.training || !isScheduled(item)) return false;
  await cancelPost(store.token, item.id);
  const { zernio, ...rest } = item.details || {};
  item.details = rest;
  return true;
}
