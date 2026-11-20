// Who sees a What's New update (Danielle, 20 Nov 2026). An update's audience is
// empty for every member, or a list of brand names, with "none" meaning members
// who aren't in any brand. Kept apart from src/data/whats-new.js, which reads
// the database when the site builds and must never be bundled into a page.

export const WHATS_NEW_COUNT = 5;
export const NO_BRAND = "none";

// "Fine and Country" and "Fine & Country" are one brand written two ways.
const norm = (b) => String(b || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");

// `brands`: the member's brands (an array), or undefined when they couldn't be
// asked, in which case only the updates for everyone show.
export function seesUpdate(item, brands) {
  const aud = Array.isArray(item && item.audience) ? item.audience.filter(Boolean) : [];
  if (!aud.length) return true;
  if (!Array.isArray(brands)) return false;
  if (!brands.length) return aud.includes(NO_BRAND);
  const mine = new Set(brands.map(norm));
  return aud.some((b) => b !== NO_BRAND && mine.has(norm(b)));
}

export function updatesFor(items, brands, count = WHATS_NEW_COUNT) {
  return (Array.isArray(items) ? items : []).filter((t) => seesUpdate(t, brands)).slice(0, count);
}

// Do two audiences share anyone? Used by the admin list to say which updates
// are still in somebody's latest five.
export function audiencesMeet(a, b) {
  const x = (a || []).filter(Boolean), y = (b || []).filter(Boolean);
  if (!x.length || !y.length) return true;
  const ys = new Set(y.map(norm));
  return x.some((v) => ys.has(norm(v)));
}
