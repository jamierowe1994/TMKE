// Who sees a What's New update (Danielle, 20 Nov 2026; subscriptions and
// groups 23 Nov). An update's audience is a list, empty for every member.
// It can hold:
//   - brand names, with "none" meaning members who aren't in any brand;
//   - a group: "group:teg" (all of TEG, Fine & Country included),
//     "group:teg_no_fc" (TEG without Fine & Country) or "group:fc";
//   - a subscription: "level:calendar", "level:scheduling" (Content Calendar
//     Plus) or "level:done_for_you". A member on that level or a higher one
//     sees it, the same ladder as the Content Calendar and the guides.
// Brands and groups say who; a subscription narrows it. With both, a member
// has to be one of the people named AND hold the subscription.
//
// Kept apart from src/data/whats-new.js, which reads the database when the
// site builds and must never be bundled into a page.

export const WHATS_NEW_COUNT = 5;
export const NO_BRAND = "none";

export const AUDIENCE_LEVELS = [
  { key: "calendar", label: "Content Calendar", sees: "Content Calendar, Content Calendar Plus and Done For You" },
  { key: "scheduling", label: "Content Calendar Plus", sees: "Content Calendar Plus and Done For You" },
  { key: "done_for_you", label: "Done For You", sees: "Done For You" },
];
export const AUDIENCE_GROUPS = [
  { key: "teg", label: "TEG, all brands" },
  { key: "teg_no_fc", label: "TEG, without Fine & Country" },
  { key: "fc", label: "Fine & Country only" },
];

// "Fine and Country" and "Fine & Country" are one brand written two ways.
const norm = (b) => String(b || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
const FC = "fineandcountry";

/** An audience list taken apart: { levels, groups, brands }. */
export function audienceParts(aud) {
  const a = (Array.isArray(aud) ? aud : []).map((x) => String(x || "").trim()).filter(Boolean);
  return {
    levels: a.filter((x) => x.startsWith("level:")).map((x) => x.slice(6)),
    groups: a.filter((x) => x.startsWith("group:")).map((x) => x.slice(6)),
    brands: a.filter((x) => !x.startsWith("level:") && !x.startsWith("group:")),
  };
}

/** Does an update need the member's subscription or group to be asked for? */
export function needsAccess(items) {
  return (Array.isArray(items) ? items : []).some((t) => { const p = audienceParts(t && t.audience); return p.levels.length || p.groups.length; });
}

// `who` is the member: { brands, levels, groups }, or just their brands (an
// array) as it was before 23 Nov. Anything that couldn't be asked is left
// undefined, and an update that depends on it doesn't show: nothing opens on
// a guess.
//   brands  every brand they're in (member_brands())
//   levels  the levels they hold, lower ones included (the Worker's
//           /access/me course_levels)
//   groups  { teg, fc } from the same answer: teg is TEG without Fine &
//           Country, and someone can be both
export function seesUpdate(item, who) {
  const p = audienceParts(item && item.audience);
  if (!p.levels.length && !p.groups.length && !p.brands.length) return true;
  const me = Array.isArray(who) || who == null ? { brands: who } : who;

  if (p.levels.length) {
    const mine = me.levels instanceof Set ? me.levels : Array.isArray(me.levels) ? new Set(me.levels) : null;
    if (!mine || !p.levels.some((l) => mine.has(l))) return false;
  }
  if (!p.groups.length && !p.brands.length) return true;

  const g = me.groups;
  if (g && p.groups.some((k) => (k === "teg" ? g.teg || g.fc : k === "teg_no_fc" ? g.teg : k === "fc" ? g.fc : false))) return true;

  if (!p.brands.length || !Array.isArray(me.brands)) return false;
  if (!me.brands.length) return p.brands.includes(NO_BRAND);
  const mine = new Set(me.brands.map(norm));
  return p.brands.some((b) => b !== NO_BRAND && mine.has(norm(b)));
}

export function updatesFor(items, who, count = WHATS_NEW_COUNT) {
  return (Array.isArray(items) ? items : []).filter((t) => seesUpdate(t, who)).slice(0, count);
}

// Do two audiences share anyone? Used by the admin list to say which updates
// are still in somebody's latest five. Subscriptions always share someone
// (a Done For You member holds every level), so only who it's for decides.
export function audiencesMeet(a, b) {
  const x = audienceParts(a), y = audienceParts(b);
  const open = (p) => !p.groups.length && !p.brands.length;
  if (open(x) || open(y)) return true;
  const reach = (p) => {
    const brands = new Set(p.brands.filter((v) => v !== NO_BRAND).map(norm));
    const all = p.groups.includes("teg");
    return {
      none: p.brands.includes(NO_BRAND),
      fc: all || p.groups.includes("fc") || brands.has(FC),
      // TEG without Fine & Country: the group, or any brand that isn't F&C.
      tegAll: all || p.groups.includes("teg_no_fc"),
      brands: new Set([...brands].filter((v) => v !== FC)),
    };
  };
  const r = reach(x), s = reach(y);
  if (r.none && s.none) return true;
  if (r.fc && s.fc) return true;
  if ((r.tegAll && (s.tegAll || s.brands.size)) || (s.tegAll && r.brands.size)) return true;
  return [...r.brands].some((v) => s.brands.has(v));
}

/** Plain words for the admin list and preview: "Content Calendar Plus · TEG, all brands". */
export function audienceLabel(aud) {
  const p = audienceParts(aud);
  const bits = [];
  p.levels.forEach((l) => bits.push((AUDIENCE_LEVELS.find((x) => x.key === l) || {}).label || l));
  p.groups.forEach((k) => bits.push((AUDIENCE_GROUPS.find((x) => x.key === k) || {}).label || k));
  p.brands.forEach((b) => bits.push(b === NO_BRAND ? "No brand" : b));
  return bits.join(" · ");
}
