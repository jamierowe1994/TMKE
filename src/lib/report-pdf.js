// The monthly report as a PDF: its own presentation, in the house style of
// TMKE's brochures (Services Brochure 2026, Videography Services), not a
// printout of the web slides. 16:9 pages on paper, Arimo ("TMKE Heading") headings in wine,
// small bold capitals for section labels, Darker Grotesque body text at a
// size you can read, hairline rules rather than boxes, full-bleed photography
// on the cover, the wine strip down its right edge.
//
// Each page is laid out at 1920 x 1080, drawn to an image (html-to-image) and
// placed on its own page of a 1440 x 810pt PDF (jsPDF), so it is one slide a
// page whatever browser or device makes it. The numbers come from the same
// report data as the web slides, worked out the same way.

import { headlineCards, normaliseInsight, INSIGHT_CATEGORIES, lastMonthOf, numbersMoves } from "./report-metrics.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const n = (v) => { if (v == null || v === "") return null; const x = Number(String(v).replace(/[^0-9.\-]/g, "")); return Number.isFinite(x) ? x : null; };
const fmt = (v) => (v == null ? "—" : Number(v).toLocaleString("en-GB"));
const has = (v) => v != null && v !== "";

const CSS = `
.rpx { position: fixed; left: -30000px; top: 0; pointer-events: none; }
.rpx-page { width: 1920px; height: 1080px; box-sizing: border-box; position: relative; overflow: hidden; background: #f3f1ee; color: #1c1d22; font-family: "Darker Grotesque", "Inter", system-ui, sans-serif; font-size: 23px; line-height: 1.55; display: flex; flex-direction: column; padding: 64px 112px 72px; }
.rpx-page * { box-sizing: border-box; }
.rpx-h, .rpx-title, .rpx-fig b, .rpx-big, .rpx-num { font-family: "TMKE Heading", "Helvetica Neue", Helvetica, Arial, sans-serif; }
.rpx-top { display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase; color: #371e28; flex: none; }
.rpx-top span:last-child { font-weight: 700; color: #6e6268; }
.rpx-body { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: 540px minmax(0, 1fr); column-gap: 96px; margin-top: 56px; }
.rpx-side { display: flex; flex-direction: column; }
.rpx-eyebrow, .rpx-glance dt, .rpx-head { font-size: 17px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #371e28; margin: 0 0 14px; }
.rpx-title { font-size: 60px; font-weight: 700; letter-spacing: -0.015em; line-height: 1.02; color: #371e28; margin: 0; }
.rpx-lede { font-size: 24px; line-height: 1.6; color: #3b3a40; margin: 28px 0 0; white-space: pre-line; }
.rpx-main { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.rpx-acts, .rpx-ins { min-height: 0; }
.rpx-label { font-size: 15px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #6e6268; margin: 0 0 10px; }
.rpx-rule { border-top: 1.5px solid rgba(55,30,40,0.28); }
.rpx-foot { position: absolute; right: 112px; bottom: 34px; font-size: 15px; font-weight: 800; letter-spacing: 0.08em; color: #6e6268; }

/* Cover */
.rpx-cover { padding: 0; background: #2a2226 url('/assets/hub/smm.jpg') center / cover no-repeat; }
.rpx-cover::before { content: ""; position: absolute; inset: 0 64px 0 0; background: linear-gradient(to top, rgba(20,14,18,0.55), rgba(20,14,18,0.15) 55%, rgba(20,14,18,0.05)); }
.rpx-strip { position: absolute; top: 0; right: 0; bottom: 0; width: 64px; background: #371e28; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 40px 0; color: #fff; font-weight: 800; font-size: 15px; letter-spacing: 0.1em; text-transform: uppercase; }
.rpx-strip span { writing-mode: vertical-rl; }
.rpx-card { position: absolute; left: 96px; bottom: 96px; width: calc((1920px - 64px - 96px) * 0.75); background: #371e28; color: #fff; padding: 64px 72px 60px; border-radius: 4px; }
.rpx-card .rpx-eyebrow { color: rgba(255,255,255,0.72); }
.rpx-card .rpx-h { font-size: 118px; font-weight: 700; letter-spacing: -0.015em; line-height: 0.95; margin: 6px 0 0; }
.rpx-card-sub { font-size: 27px; color: rgba(255,255,255,0.85); margin: 22px 0 0; }
.rpx-contents { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0 28px; margin: 44px 0 0; padding: 26px 0 0; border-top: 1.5px solid rgba(255,255,255,0.22); list-style: none; }
.rpx-contents li { font-size: 21px; line-height: 1.35; color: rgba(255,255,255,0.92); }
.rpx-contents b { display: block; font-size: 15px; letter-spacing: 0.08em; color: rgba(255,255,255,0.55); margin-bottom: 6px; }

/* Numbers: six figures, three to a row, ruled */
.rpx-figs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 56px; row-gap: 64px; }
.rpx-fig { border-top: 1.5px solid rgba(55,30,40,0.28); padding: 30px 0 0; display: flex; flex-direction: column; }
.rpx-fig b { font-size: 92px; font-weight: 400; letter-spacing: -0.03em; line-height: 1; color: #1c1d22; margin: 10px 0 0; }
.rpx-fig .rpx-move { font-size: 21px; font-weight: 800; color: #371e28; margin: 16px 0 0; min-height: 1.4em; }
.rpx-fig p { font-size: 21px; line-height: 1.5; color: #4a4850; margin: 8px 0 0; max-width: 24ch; }

/* Who you reached */
.rpx-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: auto; }
.rpx-big { font-size: 84px; font-weight: 400; letter-spacing: -0.03em; line-height: 1; color: #1c1d22; }
.rpx-small { font-size: 20px; line-height: 1.5; color: #4a4850; margin: 10px 0 0; }
.rpx-note { margin-top: 30px; padding: 22px 26px; background: #e4dcdb; font-size: 20px; line-height: 1.55; color: #3b3a40; }
.rpx-note b { color: #371e28; }
.rpx-cols3 { flex: 1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: auto 1fr; gap: 48px 64px; }
.rpx-col.wide { grid-column: 1 / -1; }
.rpx-col.wide { border-bottom: 1.5px solid rgba(55,30,40,0.28); padding-bottom: 34px; }
.rpx-col.wide .rpx-agegrid { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
.rpx-col.wide .rpx-age { grid-template-columns: 90px 1fr 70px; gap: 24px; font-size: 22px; margin: 0; }
.rpx-col.wide .rpx-age .t { height: 16px; }
.rpx-col { border-top: 1.5px solid rgba(55,30,40,0.28); padding-top: 30px; display: flex; flex-direction: column; }
.rpx-bar { height: 14px; background: #d9cfcf; margin: 28px 0 16px; }
.rpx-bar span { display: block; height: 100%; background: #371e28; }
.rpx-key { display: flex; justify-content: space-between; font-size: 19px; color: #4a4850; }
.rpx-key i { display: inline-block; width: 12px; height: 12px; margin-right: 8px; background: #d9cfcf; }
.rpx-key i.f { background: #371e28; }
.rpx-age { display: grid; grid-template-columns: 76px 1fr 60px; align-items: center; gap: 16px; font-size: 20px; color: #4a4850; margin: 0 0 16px; }
.rpx-age .t { height: 12px; background: #e4dcdb; }
.rpx-age .t i { display: block; height: 100%; background: #371e28; }
.rpx-age b { text-align: right; color: #1c1d22; }
.rpx-list { list-style: none; margin: 0; padding: 0; }
.rpx-list li { display: flex; gap: 18px; padding: 16px 0; border-bottom: 1px solid rgba(55,30,40,0.18); font-size: 23px; }
.rpx-list li:first-child { border-top: 1px solid rgba(55,30,40,0.18); }
.rpx-list li .c { flex: 1; }
.rpx-list .rpx-num { color: #9a8f94; width: 1.2em; }

/* What worked */
.rpx-glance { margin-top: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
.rpx-glance dl { margin: 0; }
.rpx-glance dt { margin: 0; padding-bottom: 12px; border-bottom: 1.5px solid rgba(55,30,40,0.28); }
.rpx-glance dd { margin: 0; display: flex; justify-content: space-between; padding: 11px 0; border-bottom: 1px solid rgba(55,30,40,0.14); font-size: 19px; color: #4a4850; }
.rpx-glance dd b { color: #1c1d22; }
.rpx-tbl { width: 100%; border-collapse: collapse; table-layout: fixed; flex: 1; }
.rpx-tbl thead tr { height: 1px; }
.rpx-tbl th { font-size: 14px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #6e6268; text-align: center; padding: 0 10px 16px; border-bottom: 1.5px solid rgba(55,30,40,0.28); }
.rpx-tbl th.l { text-align: left; }
.rpx-tbl td { padding: 18px 10px; border-bottom: 1px solid rgba(55,30,40,0.14); font-size: 22px; text-align: center; font-variant-numeric: tabular-nums; }
.rpx-tbl td.l { text-align: left; }
.rpx-tbl .rk { font-family: "TMKE Heading", "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 34px; color: #9a8f94; text-align: left; }
.rpx-tbl img, .rpx-tbl .ph { display: block; width: 84px; height: 84px; object-fit: cover; background: #e4dcdb; }
.rpx-tbl .tt { font-weight: 700; color: #1c1d22; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rpx-tbl .ty { font-size: 15px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #371e28; }

/* What it means */
.rpx-chips { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; }
.rpx-chip { background: #e4dcdb; padding: 20px 26px; }
.rpx-chip b { display: block; font-family: "TMKE Heading", "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 52px; font-weight: 400; letter-spacing: -0.03em; line-height: 1.05; margin: 6px 0 0; color: #1c1d22; }
.rpx-chip span { display: block; font-size: 19px; font-weight: 800; color: #371e28; margin: 8px 0 0; }
.rpx-ins { flex: 1; display: grid; grid-auto-rows: 1fr; gap: 36px 56px; margin-top: 44px; }
.rpx-in { border-top: 3px solid #371e28; padding-top: 22px; }
.rpx-in .rpx-label { font-size: 17px; font-weight: 800; letter-spacing: 0.06em; color: #371e28; margin: 0 0 12px; }
.rpx-in .rpx-label em { font-style: normal; color: #6e6268; margin-left: 12px; }
.rpx-in h3 { font-family: "TMKE Heading", "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 31px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; color: #1c1d22; margin: 0 0 12px; }
.rpx-in p { font-size: 21px; line-height: 1.55; color: #3b3a40; margin: 0; }
.rpx-in .ev { margin-top: 14px; font-size: 18px; font-weight: 800; color: #371e28; }

/* Into next month */
.rpx-acts { flex: 1; display: grid; grid-template-columns: 1fr; grid-auto-rows: 1fr; gap: 20px; }
.rpx-act { display: grid; grid-template-columns: 88px 1fr; gap: 0 28px; align-items: start; align-content: center; background: #e4dcdb; padding: 30px 44px; }
.rpx-act .rpx-num { font-size: 56px; margin-top: -4px; font-weight: 400; line-height: 1; color: #371e28; }
.rpx-act h3 { font-family: "TMKE Heading", "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 31px; font-weight: 700; letter-spacing: -0.02em; color: #1c1d22; line-height: 1.15; margin: 0 0 10px; }
.rpx-act p { font-size: 24px; line-height: 1.55; color: #3b3a40; margin: 0; }
.rpx-coming { margin-top: auto; padding-top: 28px; display: flex; gap: 20px 36px; flex-wrap: wrap; align-items: baseline; font-size: 21px; color: #3b3a40; }
.rpx-coming .rpx-label { margin: 0; }

/* Closing */
.rpx-close { background: #371e28; color: #fff; }
.rpx-close .rpx-top, .rpx-close .rpx-top span:last-child { color: #fff; }
.rpx-close-body { flex: 1; display: grid; grid-template-columns: 640px 1fr; column-gap: 120px; align-items: end; padding-bottom: 60px; }
.rpx-close h2 { font-family: "The Seasons", Georgia, serif; font-weight: 400; font-size: 88px; line-height: 1.05; margin: 0; }
.rpx-close p { font-size: 26px; line-height: 1.6; color: rgba(255,255,255,0.88); margin: 0 0 22px; }
.rpx-close .who { font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; font-size: 17px; color: rgba(255,255,255,0.6); }
`;

/** The PDF's pages, as HTML. */
export function reportPdfHtml({ r, all, vis, client, MONTHS }) {
  const d = r.data || {}, p = d.profile || {}, rc = d.reach || {}, dem = d.demographics || {}, cl = d.client || {};
  const month = MONTHS[r.month], next = MONTHS[(r.month + 1) % 12];
  const title = `${month} ${r.year}`;
  const mgr = String(client?.social_media_manager || "").trim().split(/\s+/)[0] || "";
  const pages = [];
  const top = `<div class="rpx-top"><span>TMKE</span><span>${esc(title)} &middot; Social Media Report</span></div>`;
  const page = (no, cls, inner) => `<div class="rpx-page ${cls || ""}">${top}${inner}<div class="rpx-foot">${String(no).padStart(2, "0")}</div></div>`;
  const side = (eyebrow, heading, lede, extra) => `<div class="rpx-side"><p class="rpx-eyebrow">${esc(eyebrow)}</p><h2 class="rpx-title">${esc(heading)}</h2>${lede ? `<p class="rpx-lede">${esc(lede)}</p>` : ""}${extra || ""}</div>`;
  const mv = (v) => { const x = n(v); return x ? `${x > 0 ? "Up" : "Down"} ${Math.abs(x)}% on last month` : ""; };

  const sections = ["In Numbers", "Who You Reached", "What Worked Well", "What It Means", `Into ${next}`];

  // Cover
  pages.push(`<div class="rpx-page rpx-cover"><div class="rpx-strip"><span>The Future of Property Marketing</span><span>TMKE</span></div>
    <div class="rpx-card"><p class="rpx-eyebrow">Your monthly social media report</p><h1 class="rpx-h">${esc(title)}</h1>
      <p class="rpx-card-sub">${esc([client?.business, r.platform || "Instagram"].filter(Boolean).join(" · "))}</p>
      <ol class="rpx-contents">${[`${month} in Numbers`, ...sections.slice(1)].map((s, i) => `<li><b>0${i + 1}</b>${esc(s)}</li>`).join("")}</ol></div></div>`);

  // 1 — Numbers
  const figs = [];
  const fig = (label, val, move, means) => { if (val != null) figs.push(`<div class="rpx-fig"><p class="rpx-label">${esc(label)}</p><b>${esc(val)}</b><p class="rpx-move">${move ? esc(move) : "&nbsp;"}</p><p>${esc(means)}</p></div>`); };
  const nfo = n(p.newFollowers);
  if (vis.followers !== false) fig("Followers", n(p.followers) != null ? fmt(n(p.followers)) : null, nfo ? `${fmt(nfo)} new followers in ${month}` : "", "Your total follower count on the day this report was produced.");
  if (vis.reach !== false) fig("Profile reach", n(p.reach) != null ? fmt(n(p.reach)) : null, mv(p.reachChange), "Different people who saw the account, each counted once.");
  if (vis.views !== false) fig("Views", n(p.views) != null ? fmt(n(p.views)) : null, mv(p.viewsChange), "Times your posts and videos were seen, repeats included.");
  if (vis.interactions !== false) fig("Interactions", n(p.interactions) != null ? fmt(n(p.interactions)) : null, mv(p.interactionsChange), "Likes, comments, saves and shares, all added together.");
  const lm = numbersMoves(d, lastMonthOf(r, all)?.data);
  if (vis.interactionRate !== false) fig("Interaction rate", n(p.interactionRate) != null ? Math.round(n(p.interactionRate) * 10) / 10 + "%" : null, lm.interactionRate, "Of everyone the account reached, the share who interacted.");
  const np = n(d.posts?.published), nr = n(d.reels?.published);
  if (vis.published !== false && (np != null || nr != null)) fig("Total published", fmt((np || 0) + (nr || 0)), lm.published, [np ? `${np} image and carousel post${np === 1 ? "" : "s"}` : "", nr ? `${nr} short-form video${nr === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ") + ".");
  const lastDay = new Date(r.year, r.month + 1, 0).getDate();
  const details = [["Period", `1 to ${lastDay} ${month} ${r.year}`], ["Platform", r.platform || "Instagram"], ["Account", client?.business], ["Account manager", client?.social_media_manager]].filter(([, v]) => v);
  const detailsHtml = `<div class="rpx-glance" style="grid-template-columns:1fr"><dl><dt>Report details</dt>${details.map(([k, v]) => `<dd><span>${esc(k)}</span><b>${esc(v)}</b></dd>`).join("")}</dl></div>`;
  pages.push(page(2, "", `<div class="rpx-body">${side("01 · At a glance", `${month} in Numbers`, "Your Instagram performance at a glance: the six figures that describe the month.", detailsHtml)}<div class="rpx-main"><div class="rpx-figs">${figs.join("")}</div></div></div>`));

  // 2 — Who you reached
  const cr = (n(d.posts?.reach) || 0) + (n(d.reels?.reach) || 0);
  const reachSide = `<div class="rpx-pair"><div><p class="rpx-label">Profile reach</p><div class="rpx-big">${fmt(n(p.reach))}</div><p class="rpx-small">different people saw the account.</p></div>
      ${cr ? `<div><p class="rpx-label">Content reach</p><div class="rpx-big">${fmt(cr)}</div><p class="rpx-small">people reached, counted per post.</p></div>` : ""}</div>
    ${cr ? `<div class="rpx-note"><b>Why two numbers?</b> Profile reach counts each person once, however many of your posts they saw. Content reach adds up every post's own reach, so someone who saw three posts is counted three times.</div>` : ""}`;
  const cols = [];
  const nfr = n(rc.nonFollower), fr = n(rc.follower);
  if (vis.followerSplit !== false && nfr != null && fr != null && nfr + fr > 0) {
    const pct = Math.round(nfr / (nfr + fr) * 100);
    cols.push(`<div class="rpx-col"><p class="rpx-label">Followers and non-followers</p><div class="rpx-big">${pct}%</div><p class="rpx-small">of your content's reach was people who don't follow you yet.</p>
      <div class="rpx-bar"><span style="width:${100 - pct}%"></span></div><div class="rpx-key"><span><i class="f"></i>${fmt(fr)} followers</span><span><i></i>${fmt(nfr)} non-followers</span></div>
      <p class="rpx-small" style="font-size:17px;margin-top:18px">Counted piece by piece, like content reach, so these don't add up to your profile reach.</p></div>`);
  }
  let ageCol = "";
  const ages = vis.followerAge !== false ? (dem.age || []).filter((a) => a && a.range).map((a) => ({ range: a.range, v: (n(a.male) || 0) + (n(a.female) || 0) + (n(a.unspecified) || 0) })) : [];
  const ageTot = ages.reduce((a, b) => a + b.v, 0);
  if (ageTot) {
    const topA = Math.max(...ages.map((a) => a.v));
    ageCol = (`<div class="rpx-col wide"><p class="rpx-label" style="margin-bottom:26px">Age of your followers</p><div class="rpx-agegrid">${ages.map((a) => `<div class="rpx-age"><span>${esc(a.range)}</span><div class="t"><i style="width:${Math.max(2, Math.round(a.v / topA * 100))}%"></i></div><b>${Math.round(a.v / ageTot * 100)}%</b></div>`).join("")}</div></div>`);
  }
  const cities = vis.followerLocation !== false ? (dem.topCities || []).map((c) => c && ({ city: c.city || c.name || c.location, count: c.count })).filter((c) => c && c.city).slice(0, 3) : [];
  if (cities.length) {
    const uk = n((dem.topCountries || []).find((c) => /united kingdom/i.test(c.country || ""))?.count) ?? n(p.ukFollowers);
    const ukPct = uk != null && n(p.followers) ? Math.round(uk / n(p.followers) * 100) : null;
    cols.push(`<div class="rpx-col"><p class="rpx-label" style="margin-bottom:18px">Where your followers are</p><ol class="rpx-list">${cities.map((c, i) => `<li><span class="rpx-num">${i + 1}</span><span class="c">${esc(String(c.city).replace(/,\s*(England|Scotland|Wales|Northern Ireland|United Kingdom)$/i, ""))}</span><b>${fmt(n(c.count))}</b></li>`).join("")}</ol>${ukPct != null ? `<p class="rpx-small" style="margin-top:22px">${ukPct}% of your followers are in the UK.</p>` : ""}</div>`);
  }
  pages.push(page(3, "", `<div class="rpx-body">${side("02 · Audience", "Who You Reached", n(p.reach) != null ? `${fmt(n(p.reach))} different people saw your account this month.\nHere's who they were.` : "", reachSide)}<div class="rpx-main"><div class="rpx-cols3"${cols.length === 1 ? ' style="grid-template-columns:1fr"' : ""}>${cols.join("")}${ageCol}</div></div></div>`));

  // 3 — What worked
  const rows = (Array.isArray(d.content) && d.content.length ? d.content : (d.topContent || [])).filter((t) => t && (t.title || t.url));
  const top5 = rows.slice().sort((a, b) => (n(b.reach) || 0) - (n(a.reach) || 0) || (n(b.interactions) || 0) - (n(a.interactions) || 0)).slice(0, 5);
  const glance = (label, one, x) => {
    if (!x) return "";
    const rate = n(x.interactionRate);
    const rs = [[`${label} published`, x.published], [`${one} reach`, x.reach], [`${one} views`, x.views], [`${one} interactions`, x.interactions], [`${one} interaction rate`, rate != null ? rate + "%" : null]].filter(([, v]) => has(v));
    return `<dl><dt>${esc(label)}</dt>${rs.map(([k, v]) => `<dd><span>${esc(k)}</span><b>${esc(/%$/.test(String(v)) ? v : fmt(n(v)))}</b></dd>`).join("")}</dl>`;
  };
  const glanceHtml = vis.organicContent !== false ? `<div class="rpx-glance">${glance("Reels", "Reel", d.reels)}${glance("Posts", "Post", d.posts)}</div>` : "";
  const tbl = top5.length ? `<p class="rpx-head" style="margin-bottom:20px">Top performing content</p><table class="rpx-tbl"><colgroup><col style="width:64px"><col style="width:116px"><col><col style="width:12%"><col style="width:12%"><col style="width:12%"><col style="width:15%"></colgroup>
      <thead><tr><th></th><th></th><th class="l">Content</th><th>Type</th><th>Reach</th><th>Views</th><th>Interactions</th></tr></thead>
      <tbody>${top5.map((t, i) => { const reel = /reel/i.test(t.type || ""); return `<tr><td class="rk">${i + 1}</td><td>${t.thumb ? `<img src="${esc(t.thumb)}" alt="">` : `<span class="ph"></span>`}</td><td class="l tt">${esc(String(t.title || "").trim())}</td><td><span class="ty">${reel ? "Reel" : "Post"}</span></td><td>${fmt(n(t.reach))}</td><td>${reel ? fmt(n(t.views)) : "&ndash;"}</td><td>${fmt(n(t.interactions))}</td></tr>`; }).join("")}</tbody></table>` : "";
  pages.push(page(4, "", `<div class="rpx-body">${side("03 · Content", "What Worked This Month", "The posts that reached furthest, and how reels and posts did overall. Each post's reach counts everyone who saw it, so someone who saw three posts is in all three.", glanceHtml)}<div class="rpx-main">${tbl}</div></div>`));

  // 4 — What it means
  const series = all.filter((x) => (x.platform || "") === (r.platform || "") && (x.year * 12 + x.month) <= (r.year * 12 + r.month) && (x.year * 12 + x.month) >= (r.year * 12 + r.month) - 2).sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
  const prev = vis.trends !== false && series.length > 1 ? series[series.length - 2] : null;
  const heads = headlineCards(cl.headline, { d, prev: prev?.data || null, month, pm: prev ? MONTHS[prev.month] : null }, vis);
  const chips = heads.length ? `<div class="rpx-chips">${heads.map((c) => `<div class="rpx-chip"><p class="rpx-label">${esc(c.label)}</p><b>${esc(c.value)}</b>${c.sub ? `<span>${esc(c.sub)}</span>` : ""}</div>`).join("")}</div>` : "";
  const ins = vis.summary !== false ? (cl.insights || []).map(normaliseInsight).filter(Boolean).slice(0, 4) : [];
  const insHtml = ins.length ? `<div class="rpx-ins"${ins.length === 3 ? "" : " data-balance"} style="grid-template-columns:repeat(${ins.length === 3 ? 3 : 2}, minmax(0,1fr))">${ins.map((i) => `<div class="rpx-in"><p class="rpx-label">${esc(INSIGHT_CATEGORIES[i.category])}${i.confidence === "emerging" ? "<em>Early signal</em>" : ""}</p><h3>${esc(i.headline)}</h3><p>${esc(i.analysis)}</p></div>`).join("")}</div>`
    : (has(cl.summary || d.summary) ? `<div class="rpx-ins"><p class="rpx-lede" style="margin:0;white-space:pre-line">${esc(cl.summary || d.summary)}</p></div>` : "");
  pages.push(page(5, "", `<div class="rpx-body" style="grid-template-columns:1fr;row-gap:40px">${side("04 · Insight", "What It Means", "")}<div class="rpx-main">${chips}${insHtml}</div></div>`));

  // 5 — Into next month
  const takes = vis.priorities !== false ? ((cl.priorities || []).length ? cl.priorities : (d.priorities || [])).filter((x) => x && x.text).slice(0, 4) : [];
  const coming = vis.comingSoon !== false ? (d.comingSoon || []).filter(Boolean) : [];
  const comingHtml = coming.length ? `<div class="rpx-glance" style="grid-template-columns:1fr"><dl><dt>Content coming up</dt>${coming.map((c) => `<dd><span>${esc(c)}</span></dd>`).join("")}</dl></div>` : "";
  pages.push(page(6, "", `<div class="rpx-body">${side(`05 · ${next}`, `Into ${next}`, "Taking into account how the account has done recently, here's what we're bringing into the next few weeks.", comingHtml)}<div class="rpx-main"><div class="rpx-acts">${takes.map((x, i) => `<div class="rpx-act"><span class="rpx-num">0${i + 1}</span><div>${x.title ? `<h3>${esc(x.title)}</h3>` : ""}<p>${esc(x.text)}</p></div></div>`).join("")}</div></div></div>`));

  // Closing
  pages.push(`<div class="rpx-page rpx-close">${top}<div class="rpx-close-body"><h2>Any questions?</h2><div>
      <p>${mgr ? `${esc(mgr)}, your account manager,` : "Your account manager"} can talk you through any questions about this month's insights and our plan for ${esc(next)}. Just reply to your report email, or send a message from your Member Hub.</p>
      <p class="who">The Marketing Experts &middot; tmke.co.uk</p></div></div></div>`);

  return { css: CSS, html: pages.join(""), count: pages.length };
}

// Fonts drawn into the page images must be embedded: the page's own font
// stylesheets are on other hosts, so they're fetched here and inlined.
// "TMKE Heading" is the site's own Arimo face (see global.css), embedded
// here the same way so headings draw in it on every computer.
let fontCssP = null;
async function fontEmbedCss() {
  if (fontCssP) return fontCssP;
  fontCssP = (async () => {
    const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href).filter((h) => /fonts\.googleapis|typographer/.test(h));
    let out = "";
    for (const href of sheets) {
      try {
        const css = await (await fetch(href)).text();
        // Latin only, and only the families the PDF uses.
        const blocks = css.split("@font-face").slice(1).map((b) => "@font-face" + b.slice(0, b.indexOf("}") + 1))
          .filter((b) => /Darker Grotesque|The Seasons/.test(b))
          .filter((b) => !/unicode-range/.test(b) || /U\+0000-00FF/.test(b))
          .filter((b) => !/The Seasons/.test(b) || /font-weight:\s*400/.test(b) && !/italic/.test(b));
        for (const b of blocks) {
          const m = /url\(["']?([^"')]+)["']?\)/.exec(b);
          if (!m) continue;
          const blob = await (await fetch(m[1])).blob();
          const data = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
          out += b.replace(m[0], `url(${data})`) + "\n";
        }
      } catch (_) { /* a missing font falls back; the PDF still gets made */ }
    }
    try {
      const blob = await (await fetch("/fonts/arimo-latin.woff2")).blob();
      const data = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      out += `@font-face { font-family: "TMKE Heading"; src: url(${data}) format("woff2"); font-weight: 100 500; }\n@font-face { font-family: "TMKE Heading"; src: url(${data}) format("woff2"); font-weight: 600; }\n`;
    } catch (_) { /* falls back to Helvetica Neue */ }
    return out;
  })();
  return fontCssP;
}

/**
 * Two-column grids marked data-balance are reordered so each row pairs items
 * of the same length: headings that wrap sit beside headings that wrap, and
 * the words line up across the row. Order is kept where it costs nothing, and
 * numbered cards are renumbered to read 01 to 04.
 */
export function balanceRows(root) {
  for (const grid of root.querySelectorAll("[data-balance]")) {
    const kids = [...grid.children];
    if (kids.length < 4 || kids.length % 2 || kids.length > 8) continue;
    const size = kids.map((k) => {
      const h = k.querySelector("h3");
      const body = k.querySelector(".rpx-act > div") || k;
      return { h: h ? h.getBoundingClientRect().height : 0, t: [...body.children].reduce((a, c) => a + c.getBoundingClientRect().height, 0) };
    });
    const cost = (a, b) => Math.abs(size[a].h - size[b].h) * 3 + Math.abs(size[a].t - size[b].t);
    let best = null, bestCost = Infinity;
    const walk = (left, pairs, c) => {
      if (c >= bestCost) return;
      if (!left.length) { best = pairs; bestCost = c; return; }
      const [a, ...rest] = left;
      rest.forEach((b, i) => walk(rest.filter((_, j) => j !== i), [...pairs, [a, b]], c + cost(a, b)));
    };
    walk(kids.map((_, i) => i), [], 0);
    best.flat().forEach((i) => grid.appendChild(kids[i]));
    grid.querySelectorAll(".rpx-act > .rpx-num").forEach((el, i) => { el.textContent = String(i + 1).padStart(2, "0"); });
    // Centred cards: both text blocks in a row take the taller one's height,
    // so the headings start level across the row.
    const texts = [...grid.querySelectorAll(".rpx-act > div")];
    for (let i = 0; i + 1 < texts.length; i += 2) {
      const h = Math.max(texts[i].getBoundingClientRect().height, texts[i + 1].getBoundingClientRect().height);
      texts[i].style.minHeight = texts[i + 1].style.minHeight = h + "px";
    }
  }
}

/**
 * Priorities and insights are written by people, so their length varies.
 * Where a block's text would run past the bottom of its page, the text steps
 * down a pixel at a time (to 18px at the smallest) until it fits.
 */
export function fitText(root) {
  for (const box of root.querySelectorAll(".rpx-acts, .rpx-ins")) {
    const ps = [...box.querySelectorAll("p:not(.rpx-label):not(.ev)")];
    if (!ps.length) continue;
    let size = parseFloat(getComputedStyle(ps[0]).fontSize);
    while (box.scrollHeight > box.clientHeight + 1 && size > 18) {
      size -= 1;
      ps.forEach((el) => { el.style.fontSize = size + "px"; });
    }
  }
}

/* The cover photograph, fetched here rather than left to the renderer.
   html-to-image asks for it in the middle of drawing the page and, when that
   ask fails, quietly swaps in the blank tile we hand it -- which is how a
   title page came out with no picture on it while the file itself was there
   and serving fine. Locally it always succeeds; on the live site something
   between the two (Cloudflare, or the hub's own service worker, which
   intercepts same-origin requests) defeats it.

   Fetching it ourselves first means the renderer is handed a data URI it
   cannot fail to read. If OUR fetch fails the page keeps its wine ground, the
   same as before, and the rest of the PDF is unaffected. */
async function inlineCoverPhoto(host) {
  const cover = host.querySelector(".rpx-cover");
  if (!cover) return;
  try {
    const res = await fetch("/assets/hub/smm.jpg", { cache: "force-cache" });
    if (!res.ok) return;
    const blob = await res.blob();
    const data = await new Promise((ok, no) => {
      const fr = new FileReader();
      fr.onload = () => ok(fr.result);
      fr.onerror = no;
      fr.readAsDataURL(blob);
    });
    // Only the image layer: the colour, position and sizing stay with the class.
    cover.style.backgroundImage = 'url("' + data + '")';
  } catch (_) { /* the wine ground underneath is the fallback */ }
}

/** Build the PDF and save it. */
export async function downloadReportPdf({ r, all, vis, client, MONTHS, filename, onProgress }) {
  const { css, html, count } = reportPdfHtml({ r, all, vis, client, MONTHS });
  const style = document.createElement("style"); style.textContent = css;
  const host = document.createElement("div"); host.className = "rpx"; host.innerHTML = html;
  document.head.appendChild(style); document.body.appendChild(host);
  try {
    const [{ toJpeg }, { jsPDF }] = await Promise.all([
      import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/+esm"),
      import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm"),
    ]);
    const fontCss = await fontEmbedCss();
    await document.fonts.ready;
    await inlineCoverPhoto(host);
    balanceRows(host);
    fitText(host);
    // A picture that can't be fetched becomes a blank tile, not a failed PDF.
    const blank = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: [1440, 810], compress: true });
    const nodes = [...host.querySelectorAll(".rpx-page")];
    for (let i = 0; i < nodes.length; i++) {
      onProgress && onProgress(i + 1, count);
      // Each page keeps its own ground: the closing page is wine, not paper.
      const img = await toJpeg(nodes[i], { quality: 0.88, pixelRatio: 1.5, width: 1920, height: 1080, backgroundColor: getComputedStyle(nodes[i]).backgroundColor || "#f3f1ee", imagePlaceholder: blank, fontEmbedCSS: fontCss, cacheBust: false });
      if (i) doc.addPage([1440, 810], "landscape");
      doc.addImage(img, "JPEG", 0, 0, 1440, 810, undefined, "FAST");
    }
    doc.save(filename);
    return true;
  } finally {
    host.remove(); style.remove();
  }
}
