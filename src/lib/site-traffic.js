// The site's own visit log (site_events), read the same way by the admin
// dashboard and Insights, so the two can't disagree about what "the website"
// is.

// Where a page belongs. The tracker fires on every page the site serves, so
// the log holds the public site, the member hub and the admin centre together.
export const areaOf = (path) => /^\/admin(\/|$)/.test(path || "") ? "admin"
  : /^\/account(\/|$)/.test(path || "") ? "hub" : "site";

/* Every row, not the first thousand: Supabase returns 1,000 rows at most per
   request whatever the limit asks for. `count` is the total (from a head
   query with the same filters); `page(from, to)` makes one ranged request,
   which must carry a stable order. The pages are fetched side by side. */
export async function pageAll(count, page) {
  const n = Math.ceil(Math.max(0, count || 0) / 1000);
  if (!n) return { data: [], error: null };
  const res = await Promise.all(Array.from({ length: n }, (_, i) => page(i * 1000, i * 1000 + 999)));
  const bad = res.find((r) => r.error);
  if (bad) return { data: null, error: bad.error };
  return { data: res.flatMap((r) => r.data || []), error: null };
}

/* The public website: its own pages only, and not the visits that also
   opened the admin centre -- that's us, not a customer. Rows need path and
   session_id (or id). */
export function publicSite(rows) {
  const who = (e) => e.session_id || e.id;
  const staff = new Set(rows.filter((e) => areaOf(e.path) === "admin").map(who));
  return rows.filter((e) => areaOf(e.path) === "site" && !staff.has(who(e)));
}
