/* The Content Calendar's month, as members see it (Danielle, 27 Oct 2026).
 *
 * Reads a published month from content_months / content_month_posts
 * (supabase/content_calendar_months.sql, built in Admin > Design studio >
 * Content calendar). Who may see it is decided on the server, never here:
 * the Worker's /access/me says whether this member gets the calendar and
 * which edition is theirs, and the database only gives the month to those
 * it may (admins only for now). Everyone else finds nothing here, and the
 * hub looks as it always has.
 *
 * Before the SQL has run the tables don't exist; that is nothing too.
 */

const POST_COLS = "id, month_id, post_date, date_tied, occasion, title, post_type, pillar, captions, how_to_edit, reel_prompt, platforms, template_id, sort_order";

// Which edition to show: the member's own, from /access/me. Staff can pick
// another to test with; with no answer, The Property Experts.
const EDITION_ORDER = ["property", "prestige", "independent", "lettings"];
const EDITION_KEY = "tmke.cc.edition";
export const EDITION_LABEL = {
  property: "The Property Experts",
  prestige: "Prestige Property Experts",
  independent: "Independent agents",
  lettings: "The Lettings Experts",
};
let accessEdition = null;
export function preferredEdition() {
  try { const v = localStorage.getItem(EDITION_KEY); if (EDITION_ORDER.includes(v)) return v; } catch (_) {}
  return accessEdition || "property";
}

/* What this member gets, from the Worker's /access/me (worked out on the
   server: their level, and which edition's month is theirs). Read once a
   page. Anything short of an answer is no access: a month never shows on a
   guess. */
let accessP = null;
export function memberAccess(supabase) {
  if (accessP) return accessP;
  accessP = (async () => {
    const base = (import.meta.env.PUBLIC_R2_WORKER_URL || "").replace(/\/+$/, "");
    const { data: { session } } = await supabase.auth.getSession();
    if (!base || !session) return null;
    const res = await fetch(`${base}/access/me`, { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (!res.ok) return null;
    const a = await res.json();
    if (!a || !a.ok) return null;
    if (EDITION_ORDER.includes(a.edition)) accessEdition = a.edition;
    return a;
  })().catch(() => null);
  return accessP;
}
export function setPreferredEdition(v) {
  try { localStorage.setItem(EDITION_KEY, v); } catch (_) {}
}

// "2026-11-01" for the month a Date falls in.
export function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// "November's posts".
export function monthPostsName(monthStr) {
  const d = new Date(String(monthStr).slice(0, 10) + "T12:00:00");
  return d.toLocaleDateString("en-GB", { month: "long" }) + "’s posts";
}

// The templates' pictures and names, by id.
async function templatesById(supabase, ids) {
  const want = [...new Set(ids.filter(Boolean))];
  if (!want.length) return new Map();
  const { data } = await supabase.from("templates").select("id, name, thumb_url").in("id", want);
  return new Map((data || []).map((t) => [t.id, t]));
}

/* The published editions of one month, and the posts of the one to show.
   Returns null when there's nothing this person may see. */
export async function loadPublishedMonth(supabase, month, edition) {
  try {
    const access = await memberAccess(supabase);
    if (!access || !access.calendar) return null;
    const { data: months, error } = await supabase.from("content_months")
      .select("id, month, edition, status, intro").eq("month", month).eq("status", "published");
    if (error || !months || !months.length) return null;
    const want = edition || preferredEdition();
    const m = months.find((x) => x.edition === want)
      || months.slice().sort((a, b) => EDITION_ORDER.indexOf(a.edition) - EDITION_ORDER.indexOf(b.edition))[0];
    const { data: posts, error: pErr } = await supabase.from("content_month_posts")
      .select(POST_COLS).eq("month_id", m.id)
      .order("post_date", { ascending: true }).order("sort_order", { ascending: true });
    if (pErr) return null;
    const tpls = await templatesById(supabase, (posts || []).map((p) => p.template_id));
    return {
      month: m,
      editions: months.map((x) => x.edition).sort((a, b) => EDITION_ORDER.indexOf(a) - EDITION_ORDER.indexOf(b)),
      posts: (posts || []).map((p) => ({ ...p, template: tpls.get(p.template_id) || null })),
    };
  } catch (_) { return null; }
}

/* The months to offer as packs in the Studio: this month and any published
   ahead of it, one edition each. */
export async function loadPublishedMonths(supabase, fromMonth) {
  try {
    const access = await memberAccess(supabase);
    if (!access || !access.calendar) return [];
    const { data, error } = await supabase.from("content_months")
      .select("id, month, edition").eq("status", "published").gte("month", fromMonth)
      .order("month", { ascending: true });
    if (error || !data) return [];
    const want = preferredEdition();
    const byMonth = new Map();
    for (const m of data) {
      const have = byMonth.get(m.month);
      if (!have || (m.edition === want && have.edition !== want)) byMonth.set(m.month, m);
    }
    const out = [...byMonth.values()];
    // Each month's cover: its first post's picture.
    if (out.length) {
      const { data: posts } = await supabase.from("content_month_posts").select("month_id, template_id, post_date, sort_order")
        .in("month_id", out.map((m) => m.id)).not("template_id", "is", null)
        .order("post_date", { ascending: true }).order("sort_order", { ascending: true });
      const first = new Map();
      (posts || []).forEach((p) => { if (!first.has(p.month_id)) first.set(p.month_id, p.template_id); });
      const tpls = await templatesById(supabase, [...first.values()]);
      out.forEach((m) => { const t = tpls.get(first.get(m.id)); m.cover = (t && t.thumb_url) || null; });
    }
    return out;
  } catch (_) { return []; }
}

// One month's posts with their full templates, for the Studio pack.
export async function loadMonthTemplates(supabase, monthId) {
  try {
    const { data: posts, error } = await supabase.from("content_month_posts")
      .select(POST_COLS).eq("month_id", monthId)
      .order("post_date", { ascending: true }).order("sort_order", { ascending: true });
    if (error || !posts) return { posts: [], templates: [] };
    const ids = [...new Set(posts.map((p) => p.template_id).filter(Boolean))];
    if (!ids.length) return { posts, templates: [] };
    const q = (cols) => supabase.from("templates").select(cols).in("id", ids);
    let { data: tpls, error: tErr } = await q("id, name, category, thumb_url, canvas, elements, pages, size_variants");
    if (tErr) ({ data: tpls } = await q("id, name, category, thumb_url, canvas, elements"));
    const byId = new Map((tpls || []).map((t) => [t.id, t]));
    // In the month's order, each template once.
    const templates = ids.map((id) => byId.get(id)).filter(Boolean);
    return { posts, templates };
  } catch (_) { return { posts: [], templates: [] }; }
}

// One post, with its month, for ?ccpost= in the Studio.
export async function loadPost(supabase, id) {
  try {
    const access = await memberAccess(supabase);
    if (!access || !access.calendar) return null;
    const { data: p, error } = await supabase.from("content_month_posts").select(POST_COLS).eq("id", id).maybeSingle();
    if (error || !p) return null;
    const { data: m } = await supabase.from("content_months").select("id, month, edition, status").eq("id", p.month_id).maybeSingle();
    if (!m || m.status !== "published") return null;
    return { ...p, month: m };
  } catch (_) { return null; }
}

export const POST_TYPE_LABEL = { single: "Single image", carousel: "Carousel", reel: "Reel" };

// "Monday 3 November".
export function fmtPostDate(ymd) {
  if (!ymd) return "";
  return new Date(ymd + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}
