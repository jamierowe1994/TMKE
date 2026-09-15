// "A new pack has landed" for the member hub's Your week.
//
// When a pack goes live it takes over ONE day card: the day it launched, if
// that day is on screen, still to come, and has nothing planned on it.
// Otherwise it takes the next free day from today, so a member who looks later
// in the week (or the week after) still sees it while the pack is new. A day
// with a post on it is never touched - their own plan outranks our news.
export const NEW_FOR_DAYS = 14;
// Without packs.launched_at (supabase/pack_launch.sql) we go by when the pack
// was made, which runs ahead of the day it went live - hence the longer window.
export const NEW_FOR_DAYS_GUESSED = 21;

// packs: rows from the packs table (select * so a missing launched_at column
// simply isn't there). emptyDates: the ymd strings of day cards with nothing on
// them. weekDates: every ymd on screen, Monday first.
export function pickNewPackDay({ packs, weekDates, emptyDates, todayYmd, now = new Date() }) {
  const empty = new Set(emptyDates || []);
  const week = new Set(weekDates || []);
  const live = (packs || [])
    .filter((p) => p && p.status === "active" && p.demo !== true && p.slug)
    // By the day, not the minute: a pack launched at nine this morning is new
    // from midnight, not from nine - otherwise the hub spends the early hours
    // announcing yesterday's pack instead.
    .map((p) => ({ pack: p, at: launchedAt(p), guessed: !p.launched_at }))
    .filter((x) => x.at && ymd(x.at) <= todayYmd && daysApart(x.at, now) <= (x.guessed ? NEW_FOR_DAYS_GUESSED : NEW_FOR_DAYS))
    .sort((a, b) => b.at - a.at);
  if (!live.length) return null;

  const { pack, at } = live[0];
  const launchYmd = ymd(at);
  // Its own day where that day is free, else the next free day from today -
  // never a day with a post on it, and never a day already gone.
  const ahead = (weekDates || []).filter((d) => d >= todayYmd && empty.has(d));
  const day = week.has(launchYmd) && empty.has(launchYmd) && launchYmd >= todayYmd
    ? launchYmd
    : (ahead[0] || null);
  if (!day) return null;

  return {
    date: day,
    flag: "New",
    title: `${pack.title} has just dropped.`,
    hint: oneLiner(pack.description) || "A new pack of editable templates, ready to make yours.",
    cta: "Discover the pack",
    href: `/edit/${encodeURIComponent(pack.slug)}`,
  };
}

// The launch date: the column when the database has it. Without it, when the
// pack was created - NOT when the row last changed, which is the same moment
// for every pack whenever anything touches them all (a reorder, say) and made
// the hub announce whichever one happened to sort first.
export function launchedAt(p) {
  const raw = p.launched_at || p.created_at;
  const d = raw ? new Date(raw) : null;
  return d && !isNaN(d) ? d : null;
}

// One sentence, short enough for a day card.
export function oneLiner(text, max = 96) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const stop = s.search(/[.!?](\s|$)/);
  let out = stop > 0 ? s.slice(0, stop + 1) : s;
  if (out.length > max) out = out.slice(0, out.lastIndexOf(" ", max - 1) || max - 1).replace(/[,;:]$/, "") + "…";
  return out;
}

export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// Whole days between two dates, counted from midnight to midnight.
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysApart = (a, b) => Math.round((midnight(b) - midnight(a)) / 86400000);
