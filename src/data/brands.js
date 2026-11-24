// The TEG brands, in the order Danielle thinks of them.
//
// Not alphabetical and not by size: Fine & Country has the most agents by far
// and sits last, because we are not making anything for them yet. One list,
// used by the Brands page and the pack brand picker, so the two can't disagree
// about what comes first.
//
// A brand found on an agent's profile that isn't here still shows — after
// these, alphabetically — so nothing ever quietly vanishes.

export const BRAND_ORDER = [
  "The Property Experts",
  "Prestige Property Experts",
  "The Letting Experts",
  "The Letting Experts Scotland",
  "The Marketing Experts",
  "The Recruitment Experts",
  "Fine & Country",
  "TMKE",
];

// "Fine and Country" and "Fine & Country" are one brand written two ways.
const norm = (b) => String(b || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");

export function brandRank(brand) {
  const i = BRAND_ORDER.findIndex((b) => norm(b) === norm(brand));
  return i === -1 ? BRAND_ORDER.length : i;
}

export function byBrandOrder(a, b) {
  return brandRank(a) - brandRank(b) || String(a).localeCompare(String(b));
}

/* A brand that uses another brand's kit (Dani, 3 Nov 2026). The Letting
   Experts Scotland is its own brand so it can have its own print, because
   Scottish lettings law is different, but it looks exactly like The Letting
   Experts: one kit serves both and is edited once, on The Letting Experts.
   The Worker keeps the same list (KIT_SHARED_WITH in worker/src/index.js). */
export const KIT_SHARED_WITH = {
  "The Letting Experts Scotland": "The Letting Experts",
};

export function kitBrandOf(brand) {
  const k = Object.keys(KIT_SHARED_WITH).find((b) => norm(b) === norm(brand));
  return k ? KIT_SHARED_WITH[k] : brand;
}

/* Colour slots in a brand kit. Six for everybody; The Letting Experts has
   seven colours in its palette, so its kit (and Scotland's, which shares it)
   gets a seventh slot (Danielle, 24 Nov). Only theirs: an odd one out on
   every other kit would just be an empty box. */
const SEVEN_COLOUR_KITS = ["The Letting Experts"];
export function colourSlotsFor(brand) {
  return SEVEN_COLOUR_KITS.some((b) => norm(b) === norm(kitBrandOf(brand || ""))) ? 7 : 6;
}
