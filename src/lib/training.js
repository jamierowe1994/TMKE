/**
 * The training area wears the training account, never the member's.
 *
 * A guides walkthrough runs on the REAL page in whoever's session is open.
 * That is what makes it a good tour and what made it unusable for filming:
 * Dani is signed in as herself, so the Brand kit step showed The Property
 * Experts, the Studio drew her logo, and the caption generator wrote in her
 * tone of voice. Every fix aimed at the demo missed it, because a walkthrough
 * is not a demo -- there is no demo flag anywhere in it.
 *
 * So the link is cut at the source rather than at each reader. Fourteen places
 * across seven files read the kit straight out of localStorage, including a
 * plain script in public/, and patching them one at a time is how one gets
 * missed. Instead, for as long as a named walkthrough is running, reads of the
 * brand keys answer with the training kit and writes are diverted to a scratch
 * key. Nothing of the member's is moved, copied or overwritten, so there is
 * nothing to put back and nothing to lose if the tab closes mid-walk.
 *
 * Installed by BaseLayout, in the head, before any page script can read.
 * Dani, 11 Oct.
 */

/* The first-login tour is deliberately NOT included. It has no `walk` id and
   it runs on a brand new member's own account, where their own details are
   exactly what they should be looking at. Only a walkthrough opened by name
   from the guides counts as the training area. */
export const TOUR_STATE = "tmke.tour";
export const BRAND_KEYS = ["tmke.brand", "tmke.brand.training", "tmke.brand.demo"];
export const SCRATCH = "tmke.brand.training.scratch";

export function walkthroughRunning() {
  try {
    // The demonstration window only (see BaseLayout): never a member's own page.
    if (window.self === window.top) return false;
    const s = JSON.parse(localStorage.getItem(TOUR_STATE) || "null");
    return !!(s && s.active && s.walk);
  } catch (_) { return false; }
}

/* Anything that reaches a member's own kit -- their cached copy, their row on
   the server -- has no business running while the training area is on screen,
   and neither has a demo. One question, asked in both places. */
export function wearingSomebodyElsesKit() {
  if (walkthroughRunning()) return true;
  try { return !!localStorage.getItem("tmke_demo"); } catch (_) { return false; }
}
