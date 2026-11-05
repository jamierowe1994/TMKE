/* ==========================================================================
   Social media package calculator (Danielle, 5 Nov 2026).

   One set of figures, edited on Social media › Settings › Packages & pricing
   (saved in smm_pricing_settings, supabase/smm_pricing_settings.sql), and the
   calculator prices from them. Until the figures are saved, the starting
   figures below are used and the page says so.

   Social Media Management is priced in three sections:
     1. Planning: hours a month by posts a month, in blocks of 4.
     2. Creation: minutes per post to create, then to caption and schedule.
     3. Reporting: hours a month by number of platforms.
   plus the quarterly strategy meeting, amends, Stories and groups, replying
   to comments and messages (not offered yet), software and the property pack.
   Creating is charged at the content rate; everything else at the management
   rate. TEG is cost plus a markup; an external agency is priced so a share of
   the price is margin (cost ÷ 0.65 at 35%), as on the costing sheet.

   Videos we film are priced from the Shot and Scheduled rate card instead.
   ========================================================================== */
import { SOCIAL_SERVICES } from "./smm-config.js";

export const CALC_DEFAULTS = {
  rates: { content: 30, management: 20 },                        // £ an hour
  planning: { 4: 2, 8: 2.5, 12: 3, 16: 3.5, 20: 4 },             // hours a month, by posts a month
  creation: {                                                     // minutes per post
    static:   { create: 30, caption: 15 },
    carousel: { create: 60, caption: 15 },
    reel_own: { create: 15, caption: 15 },                        // their footage: we make the cover (15 min, Dani 5 Nov)
  },
  reporting: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 },                    // hours a month, by platforms
  strategy_hours_quarter: 1,
  amends_hours_month: 0.5,                                        // one request built in
  stories_minutes_per_post: 30,                                   // the sheet's 4/6/10 hours a month
  comments: { minutes_per_post: 10, offered: false },             // its own section, not offered yet
  software: { upto8: 85, upto16: 90, more: 95 },                  // £ a month, by posts a month
  pack_per_4: 125,                                                // £ for every 4 property pack posts
  margins: { teg_markup: 25, external_margin: 35 },               // %
};

export const PLANNING_STEPS = [4, 8, 12, 16, 20];
export const PLATFORM_STEPS = [1, 2, 3, 4, 5];
export const POST_TYPES = [
  { key: "reel_own", label: "Reel from their footage", note: "We make the cover" },
  { key: "static",   label: "Static" },
  { key: "carousel", label: "Carousel" },
];
export const PLATFORMS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube Shorts"];
export const WEEKS_A_MONTH = 4;   // her blocks: 2 a week is 8 a month

/** The saved figures laid over the starting ones, so a missing key never breaks a price. */
export function mergeFigures(saved) {
  const d = CALC_DEFAULTS, s = saved && typeof saved === "object" ? saved : {};
  const num = (v, f) => (v === "" || v == null || isNaN(Number(v)) ? f : Number(v));
  const out = JSON.parse(JSON.stringify(d));
  const s2 = (o) => (o && typeof o === "object" ? o : {});
  for (const k of Object.keys(d.rates)) out.rates[k] = num(s2(s.rates)[k], d.rates[k]);
  for (const k of PLANNING_STEPS) out.planning[k] = num(s2(s.planning)[k], d.planning[k]);
  for (const t of Object.keys(d.creation)) for (const f of ["create", "caption"]) out.creation[t][f] = num(s2(s2(s.creation)[t])[f], d.creation[t][f]);
  for (const k of PLATFORM_STEPS) out.reporting[k] = num(s2(s.reporting)[k], d.reporting[k]);
  out.strategy_hours_quarter = num(s.strategy_hours_quarter, d.strategy_hours_quarter);
  out.amends_hours_month = num(s.amends_hours_month, d.amends_hours_month);
  out.stories_minutes_per_post = num(s.stories_minutes_per_post, d.stories_minutes_per_post);
  out.comments.minutes_per_post = num(s2(s.comments).minutes_per_post, d.comments.minutes_per_post);
  out.comments.offered = s2(s.comments).offered === true;
  for (const k of Object.keys(d.software)) out.software[k] = num(s2(s.software)[k], d.software[k]);
  out.pack_per_4 = num(s.pack_per_4, d.pack_per_4);
  for (const k of Object.keys(d.margins)) out.margins[k] = num(s2(s.margins)[k], d.margins[k]);
  return out;
}

const mgmtSvc = SOCIAL_SERVICES.find((x) => x.key === "social-media-management") || {};
const sasSvc = SOCIAL_SERVICES.find((x) => x.key === "social-media-marketing") || {};
/** Service one, two and three: what's in each, and the sheet's prices for reference. */
export const MGMT_PACKAGES = (mgmtSvc.packages || []).map((p, i) => ({
  name: p.name || p.label, v: [2, 2, 2][i] ?? 2, c: [0, 1, 2][i] ?? 0, s: [0, 0, 1][i] ?? 0,
  sheet: { teg: p.price_pence.teg / 100, standard: p.price_pence.standard / 100 },
}));
/** Shot and Scheduled, for videos we film. */
export const SAS_PACKAGES = (sasSvc.packages || []).map((p) => ({
  name: p.name, v: p.postsPerWeek, price: { teg: p.price_pence.teg / 100, standard: p.price_pence.standard / 100 },
}));

export function r5(n) { return Math.round(n / 5) * 5; }

export function sell(cost, buyer, F) {
  return buyer === "teg" ? cost * (1 + F.margins.teg_markup / 100) : cost / (1 - F.margins.external_margin / 100);
}

function planningHours(posts, F) {
  if (posts <= 0) return 0;
  const block = Math.ceil(posts / 4) * 4;
  if (block <= 20) return F.planning[block];
  const step = F.planning[20] - F.planning[16];
  return F.planning[20] + step * (block - 20) / 4;
}
function reportingHours(n, F) {
  if (n <= 0) return 0;
  if (n <= 5) return F.reporting[n];
  return F.reporting[5] + (F.reporting[5] - F.reporting[4]) * (n - 5);
}
function softwareFor(posts, F) { return posts <= 8 ? F.software.upto8 : posts <= 16 ? F.software.upto16 : F.software.more; }

/** Filmed videos: the Shot and Scheduled price for that many a week, in a straight line between packages. */
function sasVideos(v, buyer) {
  const c = SAS_PACKAGES.map((p) => ({ v: p.v, p: p.price[buyer] }));
  if (!c.length || v <= 0) return 0;
  if (v <= c[0].v) return v * c[0].p / c[0].v;
  const last = c[c.length - 1];
  if (v >= last.v) return v * last.p / last.v;
  for (let i = 0; i < c.length - 1; i++) if (v <= c[i + 1].v) return c[i].p + (v - c[i].v) * (c[i + 1].p - c[i].p) / (c[i + 1].v - c[i].v);
  return 0;
}

/**
 * Price one plan. w = { maker: "own"|"us", v, c, s (a week), platforms: [...],
 * stories: bool, comments: bool, pack: 0|4|8|12 }. Returns the monthly price
 * (rounded to £5) and the working, for showing how it was reached.
 */
export function priceOf(w, buyer, F) {
  const W = WEEKS_A_MONTH;
  const posts = W * (w.v + w.c + w.s);
  const nPlat = (w.platforms || []).length;
  const pack = (w.pack / 4) * F.pack_per_4;
  const lines = [];
  if (posts === 0) return { price: r5(pack), cost: 0, lines, posts };
  const cr = F.creation, rc = F.rates.content, rm = F.rates.management;
  const filmed = w.maker === "us" && w.v > 0;
  const ownV = filmed ? 0 : w.v;

  const createH = W * (ownV * cr.reel_own.create + w.c * cr.carousel.create + w.s * cr.static.create) / 60;
  const captionH = W * (ownV * cr.reel_own.caption + w.c * cr.carousel.caption + w.s * cr.static.caption) / 60;
  let planH, reportH, strategyH, amendsH, software;
  if (filmed) {
    // Shot and Scheduled already covers its videos' planning, reporting on
    // Instagram, Facebook and TikTok, the strategy meeting and software; add
    // only what the carousels, statics and extra platforms bring.
    planH = planningHours(posts, F) - planningHours(W * w.v, F);
    reportH = Math.max(0, reportingHours(nPlat, F) - reportingHours(3, F));
    strategyH = 0; amendsH = 0; software = 0;
  } else {
    planH = planningHours(posts, F);
    reportH = reportingHours(nPlat, F);
    strategyH = F.strategy_hours_quarter / 3;
    amendsH = F.amends_hours_month;
    software = softwareFor(posts, F);
  }
  const storiesH = w.stories ? posts * F.stories_minutes_per_post / 60 : 0;
  const commentsH = w.comments ? posts * F.comments.minutes_per_post / 60 : 0;
  const mgmtH = planH + captionH + reportH + strategyH + amendsH + storiesH + commentsH;
  const cost = createH * rc + mgmtH * rm + software;
  const filmedPrice = filmed ? sasVideos(w.v, buyer) : 0;

  if (filmed) lines.push({ label: `Filmed videos, from Shot and Scheduled`, amount: filmedPrice, sold: true });
  if (planH) lines.push({ label: `Planning, ${fmtH(planH)}`, amount: planH * rm });
  if (createH) lines.push({ label: `Creating, ${fmtH(createH)}`, amount: createH * rc });
  if (captionH) lines.push({ label: `Captions and scheduling, ${fmtH(captionH)}`, amount: captionH * rm });
  if (reportH) lines.push({ label: `Reporting, ${fmtH(reportH)}`, amount: reportH * rm });
  if (strategyH) lines.push({ label: `Strategy meeting, ${fmtH(strategyH)}`, amount: strategyH * rm });
  if (amendsH) lines.push({ label: `Amends, ${fmtH(amendsH)}`, amount: amendsH * rm });
  if (storiesH) lines.push({ label: `Stories and groups, ${fmtH(storiesH)}`, amount: storiesH * rm });
  if (commentsH) lines.push({ label: `Comments and messages, ${fmtH(commentsH)}`, amount: commentsH * rm });
  if (software) lines.push({ label: "Software", amount: software });
  if (pack) lines.push({ label: `Property pack, ${w.pack} posts`, amount: pack, sold: true });

  return { price: r5(filmedPrice + sell(cost, buyer, F) + pack), cost, lines, posts, hours: createH + mgmtH };
}

export function fmtH(h) {
  const m = Math.round(h * 60);
  const hh = Math.floor(m / 60), mm = m % 60;
  return hh && mm ? `${hh} hr ${mm} min` : hh ? `${hh} hr` : `${mm} min`;
}

/** How much of the wish-list a plan covers. A weekly post and 4 pack posts each count as one. */
export function score(w) {
  return w.v + w.c + w.s + w.pack / 4 + (w.stories ? 0.5 : 0) + (w.comments ? 0.5 : 0) + 0.3 * Math.max(0, (w.platforms || []).length - 2);
}

/** The most of the wish-list that fits the budget. Instagram and Facebook always stay. */
export function fitBudget(W, budget, buyer, F) {
  const opt = (W.platforms || []).filter((p) => p !== "Instagram" && p !== "Facebook");
  const base = (W.platforms || []).filter((p) => p === "Instagram" || p === "Facebook");
  let sets = [[]];
  opt.forEach((p) => { sets = sets.concat(sets.map((s) => s.concat(p))); });
  let best = null;
  for (let v = W.v; v >= 0; v--) for (let c = W.c; c >= 0; c--) for (let s = W.s; s >= 0; s--)
    for (let pk = W.pack; pk >= 0; pk -= 4) for (let st = W.stories ? 1 : 0; st >= 0; st--) for (let cm = W.comments ? 1 : 0; cm >= 0; cm--)
      for (const set of sets) {
        if (v + c + s === 0 && !pk) continue;
        const w = { maker: W.maker, v, c, s, platforms: base.concat(set), stories: !!st, comments: !!cm, pack: pk };
        const p = priceOf(w, buyer, F).price;
        if (p > budget) continue;
        const sc = score(w);
        if (!best || sc > best.score + 1e-9 || (Math.abs(sc - best.score) < 1e-9 && p < best.price)) best = { w, price: p, score: sc };
      }
  return best;
}
