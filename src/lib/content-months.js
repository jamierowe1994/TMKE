/* Content Calendar subscription: the months and their posts (Danielle, 27 Oct 2026).
 *
 * Tables: content_months and content_month_posts (supabase/content_calendar_months.sql).
 * Built in Admin › Design studio › Content calendar; read by the member Content
 * Calendar once a month is published. The build is split between the chats in
 * docs/content-calendar-build.md.
 */

// Lettings write their own month. Property, Prestige and independent agents
// share the copy but each has its own designs, so each is its own month.
export const EDITIONS = [
  { key: "property", label: "The Property Experts" },
  { key: "prestige", label: "Prestige Property Experts" },
  { key: "independent", label: "Independent agents" },
  { key: "lettings", label: "The Lettings Experts" },
];
export const editionLabel = (k) => (EDITIONS.find((e) => e.key === k) || {}).label || k;

export const POST_TYPES = [
  { key: "single", label: "Single image" },
  { key: "carousel", label: "Carousel" },
  { key: "reel", label: "Reel" },
];

export const PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "tiktok", label: "TikTok" },
];

export const MAX_CAPTIONS = 3;

// Curly tags fill in from the brand kit: the editor's own menu (TAG_MENU in
// public/scripts/editor.js), so a caption and a design use the same words.
// Square brackets are for the agent to type, and they're warned if any are left.
export const CAPTION_TAGS = ["company name", "area", "website", "agent name", "agent first name", "telephone", "email"];
export const CAPTION_FILL_INS = ["[price]", "[street]", "[school name]"];

// Ids of the templates drawn for the Content Calendar, so the Templates tab and
// the pack picker can leave them out. Empty until the SQL has run.
export async function calendarTemplateIds(supabase) {
  try {
    const { data, error } = await supabase.from("templates").select("id").eq("collection", "calendar");
    if (error) return new Set();
    return new Set((data || []).map((t) => t.id));
  } catch (_) { return new Set(); }
}

// "2026-11-01" for any day in that month.
export function monthStart(d) {
  const x = d instanceof Date ? d : new Date(d + (String(d).length <= 10 ? "T12:00:00" : ""));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-01`;
}

// Every Monday to Friday in the month of `start` ("YYYY-MM-01").
export function weekdaysOf(start) {
  const [y, m] = start.split("-").map(Number);
  const out = [];
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) break;
    const wd = dt.getUTCDay();
    if (wd >= 1 && wd <= 5) out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

export const MONTHS_MISSING = /content_months|content_month_posts|relation .* does not exist|schema cache/i;
