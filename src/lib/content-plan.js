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
/* The pillar each key date's prompt belongs to, by its name, for "Add
   prompt to my plan" (Dani, 18 Oct). Prompts don't carry one; a date added
   later that isn't here is guessed from its wording (pillarOfPrompt). */
const PILLAR_BY_DAY = {
  Property: ["Burns Night", "Valentine's Day", "St David's Day", "St George's Day", "National Pet Day", "May Day",
    "World Environment Day", "Back to School", "Recycle Day", "Clocks Go Back", "First Day of Winter", "World Book Day"],
  Educational: ["New Year's Day", "Earth Day", "World Photography Day"],
  Personal: ["International Women's Day", "Read a Book Day", "Make Your Bed Day", "Positive Thinking Day", "Autumn Equinox",
    "World Podcast Day", "World Smile Day", "Grandparents' Day", "World Mental Health Day", "Pumpkin Day", "Halloween",
    "International Men's Day", "First Day of Advent", "Christmas Jumper Day", "Boxing Day", "New Year's Eve"],
  Community: ["International Day of Charity", "World's Biggest Coffee Morning", "World Tourism Day", "Black History Month",
    "Coffee Week", "Movember", "Bonfire Night", "Remembrance Sunday", "Armistice Day", "World Kindness Day", "Black Friday",
    "Small Business Saturday", "St Andrew's Day", "International Volunteer Day", "Christmas Card Day", "Christmas Day"],
  Service: ["Christmas Eve"],
};
const squash = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const PILLAR_OF = new Map(Object.entries(PILLAR_BY_DAY).flatMap(([p, names]) => names.map((n) => [squash(n), p])));
export function pillarOfPrompt(p) {
  const known = PILLAR_OF.get(squash(p && p.name));
  if (known) return known;
  const t = `${p.name} ${p.angle} ${p.brief || ''}`.toLowerCase();
  if (/market update|myth|advice|how to|mortgage|first-time|valuation|stamp duty|epc/.test(t)) return 'Educational';
  if (/listing|propert|\bhomes?\b|house|room|garden|viewing|kerb|kitchen/.test(t)) return 'Property';
  if (/review|testimonial|sold|thank/.test(t)) return 'Service';
  if (/local|community|charity|independent|support/.test(t)) return 'Community';
  return 'Personal';
}

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
