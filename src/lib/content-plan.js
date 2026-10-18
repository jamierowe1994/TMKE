/* Content plans (Dani, 18 Oct 2026): one per member per month, planned at
   /account/content-plan, and tied to the Content Calendar -- a dated row is
   a post there (calendar_items, details.plan = { id, row }).

   Shared by the plan page, the Planner ("Open / Create your content plan"
   on the Content Calendar, Content Planning sessions) and the Studio.
   supabase/content_plans.sql has the tables. */
import { plannerStore } from './design-store.js';

/* Linked to the calendar: every row with a date is a post on the Content
   Calendar, and the post itself (a design, a template, an upload, the
   caption) is made from the row. Off is the basic planner Dani has in mind
   for the free membership (18 Oct): the same table, kept on its own, opened
   from the Content Calendar, with nothing put on the calendar for them. On
   for everyone for now. */
export const PLAN_LINKED = true;

export const FORMATS = ['Single image', 'Carousel', 'Reel / video', 'Story', 'Text-only post'];
// Dani's five (18 Oct); members add their own as well.
export const PILLARS = ['Property', 'Personal', 'Community', 'Service', 'Educational'];
// A plan opens with this many rows to fill.
export const PLAN_ROWS = 8;

/* 'YYYY-MM' for a Date or a 'YYYY-MM-DD'. */
export function monthKey(d) {
  if (typeof d === 'string') return d.slice(0, 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export const monthStart = (key) => `${key}-01`;
export function monthName(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long' });
}
export const planUrl = (key) => `/account/content-plan?month=${encodeURIComponent(key)}`;

/* The account's plans table, beside its calendar: a member's own, or the
   training account's through Dani's login. */
export async function planStore() {
  const a = await plannerStore();
  if (!a || a.blocked) return a;
  return Object.assign({}, a, { plans: a.training ? 'training_content_plans' : 'content_plans' });
}

/* Has this account made a plan for these months? A Set of 'YYYY-MM'. Quietly
   empty when it can't tell (signed out, the demo, the table not there yet). */
export async function plannedMonths(keys) {
  try {
    const s = await planStore();
    if (!s || s.blocked || !keys.length) return new Set();
    const { data, error } = await s.db.from(s.plans).select('month').eq('user_id', s.uid).in('month', keys.map(monthStart));
    if (error) return new Set();
    return new Set((data || []).map((r) => monthKey(String(r.month))));
  } catch (_) { return new Set(); }
}

/* A post from a plan that hasn't been made yet: on the calendar, nothing to
   post. */
export function postIsMade(it) {
  if (!it) return false;
  const d = it.details || {};
  return !!(it.asset_url || it.thumbnail_url || (Array.isArray(d.files) && d.files.length) || (Array.isArray(d.links) && d.links.length));
}
