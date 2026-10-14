/**
 * The training area is a window of its own.
 *
 * Every guides walkthrough opens in a pop-out whose frame is named
 * TRAINING_WINDOW. BaseLayout seals that frame's storage into a space of its
 * own (keys start TRAINING_PREFIX) and lays the training account in it: Alex
 * Mercer of Rimberio Homes, nobody signed in. The member's login, kit and
 * drafts are not in there to be seen, and nothing done in there reaches them.
 *
 * Until 14 Oct the walkthrough ran in the member's own login with only the
 * brand kit swapped, by a switch kept in the member's own storage. A walk left
 * half-way left their hub wearing the training kit. Dani: "Member Hub and the
 * information in it should not be linked to the training kit."
 *
 * The first-login tour is not a walkthrough: it runs on a new member's own
 * pages, where their own details are the point of it.
 */
export const TRAINING_WINDOW = "tmke-training";   // also in BaseLayout
export const TRAINING_PREFIX = "tmke-training:";  // also in BaseLayout and supabase.js

export function inTrainingWindow() {
  try { return !!window.__TMKE_TRAINING_WINDOW__; } catch (_) { return false; }
}

/* Empty the training window's space, from the member's side: the window starts
   every walkthrough as the training account fresh, and leaves nothing behind. */
export function clearTrainingWindow() {
  for (const st of [localStorage, sessionStorage]) {
    try { Object.keys(st).filter((k) => k.startsWith(TRAINING_PREFIX)).forEach((k) => st.removeItem(k)); } catch (_) {}
  }
  try { indexedDB.deleteDatabase(TRAINING_PREFIX + "tmke-studio"); } catch (_) {}
}

/* Anything that reaches a member's own kit -- their cached copy, their row on
   the server -- has no business running while the training area is on screen,
   and neither has a demo. One question, asked in both places. */
export function wearingSomebodyElsesKit() {
  if (inTrainingWindow()) return true;
  try { return !!localStorage.getItem("tmke_demo"); } catch (_) { return false; }
}
