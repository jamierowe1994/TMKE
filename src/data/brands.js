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
