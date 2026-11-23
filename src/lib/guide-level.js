/* Which guides a member gets by level (Danielle, 23 Nov 2026).
 *
 * A guide's `level` is the Content Calendar level it comes with: free,
 * calendar, scheduling (Content Calendar Plus) or done_for_you. A member on
 * that level or a higher one gets it. Their level is the server's answer
 * (the Worker's /access/me, course_levels), the same one the Content Calendar
 * uses; with no answer they are treated as Free, so nothing opens on a guess.
 *
 * Everyone else sees what the guide's `level_lock` says: 'locked' lists it
 * with a padlock and the level it comes with, anything else leaves it out
 * (supabase/guides_level_lock.sql; set in Admin › Guides).
 *
 * This decides what the hub shows. It is not a lock on the database: a
 * published guide's row can still be read by a signed-in member who goes
 * looking for it.
 */
import { memberAccess } from "./calendar-month.js";

export const LEVEL_NAME = { free: "Free", calendar: "Content Calendar", scheduling: "Content Calendar Plus", done_for_you: "Done For You" };

// As it reads in a sentence: "comes with the Content Calendar".
export const LEVEL_WITH = { calendar: "the Content Calendar", scheduling: "Content Calendar Plus", done_for_you: "Done For You" };

export async function memberCourseLevels(supabase) {
  let access = null;
  try { access = await memberAccess(supabase); } catch (_) {}
  const list = access && Array.isArray(access.course_levels) ? access.course_levels : [];
  return { levels: new Set(["free", ...list]), access };
}

// "open", "locked" (list it, don't open it) or "hidden".
export function levelGate(guide, levels) {
  const lvl = (guide && guide.level) || "free";
  if (lvl === "free" || !LEVEL_NAME[lvl] || (levels && levels.has(lvl))) return "open";
  return guide.level_lock === "locked" ? "locked" : "hidden";
}
