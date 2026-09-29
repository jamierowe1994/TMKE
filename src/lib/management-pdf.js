// The management report: every client's published month in one A4 PDF, for
// the team (Admin > Social > Settings > Monthly report). A working document,
// not a presentation: a cover with the month's totals and who's missing, then
// one page per account with the profile, the content, the top five, and our
// own read of the month (the Summary tab: what it means, into next month,
// trends). Drawn the same way as the client PDF (report-pdf.js): each page is
// laid out in HTML, captured as an image and placed on an A4 page.

import { fontEmbedCss } from "./report-pdf.js";
import { lastMonthOf, numbersMoves, pct2 } from "./report-metrics.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const n = (v) => { if (v == null || v === "") return null; const x = Number(String(v).replace(/[^0-9.\-]/g, "")); return Number.isFinite(x) ? x : null; };
const fmt = (v) => (v == null ? "–" : Number(v).toLocaleString("en-GB"));
const pc = (v) => (v == null ? "–" : `${pct2(v)}%`);
const sum = (xs) => { const v = xs.filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
const PRIO = { go: "Do more", caution: "Improve", action: "Fix now" };

// A4 at 150 dpi.
const W = 1240, H = 1754;

const CSS = `
.mg { position: fixed; left: -30000px; top: 0; pointer-events: none; }
.mg-page { width: ${W}px; height: ${H}px; box-sizing: border-box; position: relative; overflow: hidden; background: #fff; color: #1c1d22; font-family: "Darker Grotesque", "Inter", system-ui, sans-serif; font-size: 19px; line-height: 1.45; padding: 0 72px 70px; display: flex; flex-direction: column; }
.mg-page * { box-sizing: border-box; }
.mg-h, .mg-num, .mg-tile b, .mg-tbl td.v { font-family: "TMKE Heading", "Helvetica Neue", Helvetica, Arial, sans-serif; }
.mg-band { margin: 0 -72px; padding: 26px 72px; background: #371e28; color: #fff; display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; flex: none; }
.mg-band span:last-child { color: rgba(255,255,255,0.7); }
.mg-foot { position: absolute; left: 72px; right: 72px; bottom: 30px; display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #8a8086; border-top: 1px solid #e6e0e1; padding-top: 12px; }
.mg-sec { margin-top: 24px; flex: none; }
.mg-sec-h { font-size: 15px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #371e28; margin: 0 0 10px; padding-bottom: 7px; border-bottom: 2px solid #371e28; display: flex; justify-content: space-between; align-items: baseline; }
.mg-sec-h small { font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: none; color: #8a8086; }
.mg-title { display: flex; justify-content: space-between; align-items: flex-end; gap: 30px; margin-top: 28px; flex: none; }
.mg-title .mg-h { font-size: 44px; font-weight: 700; letter-spacing: -0.015em; line-height: 1.05; color: #371e28; margin: 0; }
.mg-title p { margin: 8px 0 0; font-size: 19px; color: #4a4850; }
.mg-title .mg-meta { text-align: right; font-size: 16px; color: #6e6268; line-height: 1.5; white-space: nowrap; }
.mg-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.mg-tile { background: #f5f2f1; padding: 12px 16px 11px; }
.mg-tile span { display: block; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #6e6268; }
.mg-tile b { display: block; font-size: 32px; font-weight: 400; letter-spacing: -0.02em; line-height: 1.1; margin: 6px 0 2px; color: #1c1d22; }
.mg-tile em { display: block; font-style: normal; font-size: 15px; font-weight: 700; color: #371e28; }
.mg-tile em.dn { color: #8f3b3b; }
.mg-tile em.ne { color: #6e6268; font-weight: 600; }
.mg-tbl { width: 100%; border-collapse: collapse; font-size: 17px; }
.mg-tbl th { font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #6e6268; text-align: right; padding: 0 10px 8px; border-bottom: 1px solid #d9d2d3; }
.mg-tbl th.l, .mg-tbl td.l { text-align: left; }
.mg-tbl td { padding: 6px 10px; border-bottom: 1px solid #eee9ea; text-align: right; font-variant-numeric: tabular-nums; }
.mg-tbl td.v { font-size: 17px; }
.mg-tbl tr.tot td { font-weight: 800; border-bottom: 0; border-top: 1px solid #d9d2d3; }
.mg-tbl .rk { width: 34px; color: #8a8086; font-weight: 800; text-align: left; }
.mg-tbl .th img, .mg-tbl .th span { display: block; width: 38px; height: 38px; object-fit: cover; background: #efeaea; }
.mg-tbl .th { width: 54px; padding-top: 4px; padding-bottom: 4px; }
.mg-tbl .tt { max-width: 0; width: 46%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 700; }
.mg-tbl .ty { font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #371e28; }
.mg-two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 40px; flex: none; }
.mg-prose { font-size: 17px; line-height: 1.5; color: #3b3a40; margin: 0; white-space: pre-line; }
.mg-none { font-size: 16px; color: #8a8086; font-style: italic; margin: 0; }
.mg-prios { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.mg-prios li { font-size: 16px; line-height: 1.45; color: #3b3a40; }
.mg-prios b { color: #1c1d22; }
.mg-tag { display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 7px; margin-right: 7px; background: #efe6e8; color: #371e28; vertical-align: 2px; }
.mg-tag.caution { background: #f6ecd9; color: #7a5412; }
.mg-tag.action { background: #f5dede; color: #8f3b3b; }
.mg-trend { display: grid; grid-template-columns: 1.15fr 1fr; gap: 0 40px; }
/* Cover */
.mg-cover .mg-coverhead { margin-top: 80px; flex: none; }
.mg-cover .mg-kicker { font-size: 17px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #6e6268; margin: 0; }
.mg-cover .mg-h { font-size: 74px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; color: #371e28; margin: 14px 0 0; }
.mg-cover .mg-sub { font-size: 21px; color: #4a4850; margin: 18px 0 0; }
.mg-miss li { display: flex; justify-content: space-between; gap: 20px; padding: 8px 0; border-bottom: 1px solid #eee9ea; font-size: 17px; }
.mg-miss li span:last-child { color: #8f3b3b; font-weight: 700; }
.mg-miss { list-style: none; margin: 0; padding: 0; }
`;

function tile(label, value, move, dir) {
  const cls = dir < 0 ? "dn" : dir > 0 ? "" : "ne";
  return `<div class="mg-tile"><span>${esc(label)}</span><b>${esc(value)}</b><em class="${cls}">${move ? esc(move) : "&nbsp;"}</em></div>`;
}
const change = (v) => { const x = n(v); return x == null ? ["", 0] : [`${x >= 0 ? "Up" : "Down"} ${Math.abs(x)}% on last month`, Math.sign(x)]; };

function accountPage(a, pageNo, title) {
  const d = a.report.data || {}, p = d.profile || {}, rc = d.reach || {};
  const month = MONTHS[a.report.month], next = MONTHS[(a.report.month + 1) % 12];
  const lm = numbersMoves(d, lastMonthOf(a.report, a.earlier.map((e) => ({ ...e, platform: a.report.platform })))?.data);
  const np = n(d.posts?.published), nr = n(d.reels?.published);
  const cr = sum([n(d.posts?.reach), n(d.reels?.reach)]);
  const nf = n(rc.nonFollower), fo = n(rc.follower);
  const dirOf = (s) => (/^Up/.test(s) ? 1 : /^Down/.test(s) ? -1 : 0);
  const [rMove, rDir] = change(p.reachChange), [vMove, vDir] = change(p.viewsChange), [iMove, iDir] = change(p.interactionsChange);
  const tiles = [
    tile("Followers", fmt(n(p.followers)), n(p.newFollowers) ? `${fmt(n(p.newFollowers))} new in ${month}` : "", n(p.newFollowers) ? 1 : 0),
    tile("Profile reach", fmt(n(p.reach)), rMove, rDir),
    tile("Views", fmt(n(p.views)), vMove, vDir),
    tile("Interactions", fmt(n(p.interactions)), iMove, iDir),
    tile("Interaction rate", pc(n(p.interactionRate)), lm.interactionRate, dirOf(lm.interactionRate)),
    tile("Published", np == null && nr == null ? "–" : fmt((np || 0) + (nr || 0)), [np != null ? `${np} post${np === 1 ? "" : "s"}` : "", nr != null ? `${nr} reel${nr === 1 ? "" : "s"}` : ""].filter(Boolean).join(", ") + (lm.published ? ` · ${lm.published.replace(" on last month", "")}` : ""), 0),
    tile("Content reach", fmt(cr), "Every post's reach added up", 0),
    nf != null && fo != null && nf + fo > 0
      ? tile("Non-followers", `${Math.round(nf / (nf + fo) * 100)}%`, `${fmt(nf)} of content reach`, 0)
      : tile("Link taps", fmt(n(p.linkTaps)), "From the profile", 0),
  ].join("");

  const row = (label, x) => `<tr><td class="l">${label}</td><td class="v">${fmt(n(x?.published))}</td><td class="v">${fmt(n(x?.reach))}</td><td class="v">${fmt(n(x?.views))}</td><td class="v">${fmt(n(x?.interactions))}</td><td class="v">${pc(n(x?.interactionRate))}</td></tr>`;
  const tot = { published: sum([np, nr]), reach: cr, views: sum([n(d.posts?.views), n(d.reels?.views)]), interactions: sum([n(d.posts?.interactions), n(d.reels?.interactions)]) };
  const contentTbl = `<table class="mg-tbl"><thead><tr><th class="l">Format</th><th>Published</th><th>Reach</th><th>Views</th><th>Interactions</th><th>Interaction rate</th></tr></thead>
    <tbody>${row("Reels", d.reels)}${row("Posts", d.posts)}<tr class="tot"><td class="l">All content</td><td class="v">${fmt(tot.published)}</td><td class="v">${fmt(tot.reach)}</td><td class="v">${fmt(tot.views)}</td><td class="v">${fmt(tot.interactions)}</td><td class="v"></td></tr></tbody></table>`;

  const rows = (Array.isArray(d.content) && d.content.length ? d.content : (d.topContent || [])).filter((t) => t && (t.title || t.url));
  const top5 = rows.slice().sort((x, y) => (n(y.reach) || 0) - (n(x.reach) || 0) || (n(y.interactions) || 0) - (n(x.interactions) || 0)).slice(0, 5);
  const topTbl = top5.length ? `<table class="mg-tbl"><thead><tr><th class="l"></th><th class="l"></th><th class="l">Post</th><th class="l">Type</th><th>Reach</th><th>Views</th><th>Interactions</th></tr></thead><tbody>${top5.map((t, i) => {
    const reel = /reel/i.test(t.type || "");
    return `<tr><td class="rk">${i + 1}</td><td class="th">${t.thumb ? `<img src="${esc(t.thumb)}" alt="">` : "<span></span>"}</td><td class="l tt">${esc(String(t.title || "").trim() || "Untitled")}</td><td class="l"><span class="ty">${reel ? "Reel" : "Post"}</span></td><td class="v">${fmt(n(t.reach))}</td><td class="v">${reel ? fmt(n(t.views)) : "–"}</td><td class="v">${fmt(n(t.interactions))}</td></tr>`;
  }).join("")}</tbody></table>` : `<p class="mg-none">No posts in this month's data.</p>`;

  const prios = (d.priorities || []).filter((x) => x && x.text);
  const prioHtml = prios.length ? `<ul class="mg-prios">${prios.map((x) => `<li><span class="mg-tag ${esc(x.type || "go")}">${esc(PRIO[x.type] || PRIO.go)}</span>${x.title ? `<b>${esc(x.title)}.</b> ` : ""}${esc(x.text)}</li>`).join("")}</ul>` : `<p class="mg-none">No plan written yet.</p>`;

  const series = [...a.earlier, { month: a.report.month, year: a.report.year, data: d }];
  const tr = (label, f) => `<tr><td class="l">${label}</td>${series.map((s) => `<td class="v">${f(s.data || {})}</td>`).join("")}</tr>`;
  const trendTbl = `<table class="mg-tbl"><thead><tr><th class="l"></th>${series.map((s) => `<th>${esc(MONTHS[s.month].slice(0, 3))}</th>`).join("")}</tr></thead><tbody>
    ${tr("New followers", (x) => fmt(n(x.profile?.newFollowers)))}
    ${tr("Profile reach", (x) => fmt(n(x.profile?.reach)))}
    ${tr("Views", (x) => fmt(n(x.profile?.views)))}
    ${tr("Interactions", (x) => fmt(n(x.profile?.interactions)))}
    ${tr("Interaction rate", (x) => pc(n(x.profile?.interactionRate)))}
    ${tr("Published", (x) => fmt(sum([n(x.posts?.published), n(x.reels?.published)])))}
  </tbody></table>`;
  const trendText = series.length < 2 ? `<p class="mg-none">The first month on record: nothing to compare with yet.</p>`
    : d.trendSummary ? `<p class="mg-prose">${esc(d.trendSummary)}</p>` : `<p class="mg-none">Trend summary not written yet.</p>`;

  const L = a.lead;
  const who = [L.name && L.business && L.name !== L.business ? L.name : "", a.report.platform, L.package ? `${L.package} package` : ""].filter(Boolean).join(" · ");
  const pub = a.report.published_at ? new Date(a.report.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  return `<div class="mg-page">
    <div class="mg-band"><span>TMKE · Social media management</span><span>${esc(title)}</span></div>
    <div class="mg-title"><div><h2 class="mg-h">${esc(L.business || L.name || "Account")}</h2><p>${esc(who)}</p></div>
      <div class="mg-meta">${L.manager ? `Account manager: <b>${esc(L.manager)}</b><br>` : ""}${pub ? `Published to client ${esc(pub)}` : ""}</div></div>
    <div class="mg-sec"><p class="mg-sec-h">Profile overview <small>${esc(month)} ${a.report.year}</small></p><div class="mg-tiles">${tiles}</div></div>
    <div class="mg-sec"><p class="mg-sec-h">Content overview</p>${contentTbl}</div>
    <div class="mg-sec"><p class="mg-sec-h">Top 5 posts <small>by reach</small></p>${topTbl}</div>
    <div class="mg-sec mg-two"><div><p class="mg-sec-h">What it means</p>${d.summary ? `<p class="mg-prose">${esc(d.summary)}</p>` : `<p class="mg-none">Summary not written yet.</p>`}</div>
      <div><p class="mg-sec-h">Into ${esc(next)}</p>${prioHtml}</div></div>
    <div class="mg-sec"><p class="mg-sec-h">Trends <small>${series.length > 1 ? `${esc(MONTHS[series[0].month])} to ${esc(month)}` : esc(month)}</small></p><div class="mg-trend"><div>${trendTbl}</div><div>${trendText}</div></div></div>
    <div class="mg-foot"><span>Internal · not for clients</span><span>${pageNo}</span></div>
  </div>`;
}

function coverPage({ month, year, accounts, missing, by }, title) {
  const ds = accounts.map((a) => a.report.data || {});
  const P = (k) => sum(ds.map((d) => n(d.profile?.[k])));
  const rates = ds.map((d) => n(d.profile?.interactionRate)).filter((x) => x != null);
  const published = sum(ds.map((d) => sum([n(d.posts?.published), n(d.reels?.published)])));
  const tiles = [
    tile("Accounts", fmt(accounts.length), missing.length ? `${missing.length} active not included` : "Every active client", missing.length ? -1 : 0),
    tile("Followers", fmt(P("followers")), P("newFollowers") ? `${fmt(P("newFollowers"))} new this month` : "", 0),
    tile("Profile reach", fmt(P("reach")), "Added across accounts", 0),
    tile("Views", fmt(P("views")), "", 0),
    tile("Interactions", fmt(P("interactions")), "", 0),
    tile("Interaction rate", rates.length ? pc(rates.reduce((x, y) => x + y, 0) / rates.length) : "–", "Average of accounts", 0),
    tile("Content published", fmt(published), "Posts and reels", 0),
    tile("Link taps", fmt(P("linkTaps")), "From profiles", 0),
  ].join("");
  const list = `<table class="mg-tbl"><thead><tr><th class="l">Account</th><th class="l">Manager</th><th>Followers</th><th>New</th><th>Reach</th><th>Views</th><th>Interactions</th><th>Rate</th><th>Page</th></tr></thead><tbody>${accounts.map((a, i) => {
    const p = (a.report.data || {}).profile || {};
    return `<tr><td class="l"><b>${esc(a.lead.business || a.lead.name)}</b></td><td class="l">${esc(a.lead.manager || "")}</td><td class="v">${fmt(n(p.followers))}</td><td class="v">${fmt(n(p.newFollowers))}</td><td class="v">${fmt(n(p.reach))}</td><td class="v">${fmt(n(p.views))}</td><td class="v">${fmt(n(p.interactions))}</td><td class="v">${pc(n(p.interactionRate))}</td><td class="v">${i + 2}</td></tr>`;
  }).join("")}</tbody></table>`;
  const miss = missing.length ? `<div class="mg-sec"><p class="mg-sec-h">Not included <small>Active clients without a published ${esc(MONTHS[month])} report</small></p><ul class="mg-miss">${missing.map((x) => `<li><span>${esc(x.business || x.name)}${x.manager ? ` · ${esc(x.manager)}` : ""}</span><span>${esc(x.reason)}</span></li>`).join("")}</ul></div>` : "";
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return `<div class="mg-page mg-cover">
    <div class="mg-band"><span>TMKE · Social media management</span><span>${esc(title)}</span></div>
    <div class="mg-coverhead"><p class="mg-kicker">Management report</p><h1 class="mg-h">${esc(MONTHS[month])} ${year}</h1>
      <p class="mg-sub">Every client report published for the month, one page each. Pulled ${esc(today)}${by ? ` by ${esc(by)}` : ""}.</p></div>
    <div class="mg-sec" style="margin-top:44px"><p class="mg-sec-h">The month across all accounts</p><div class="mg-tiles">${tiles}</div></div>
    <div class="mg-sec"><p class="mg-sec-h">Accounts <small>${accounts.length} included</small></p>${accounts.length ? list : `<p class="mg-none">No published reports for this month.</p>`}</div>
    ${miss}
    <div class="mg-foot"><span>Internal · not for clients</span><span>1</span></div>
  </div>`;
}

/** The pages as HTML (exported for checking the layout in dev). */
export function managementPdfHtml(input) {
  const title = `Monthly report · ${MONTHS[input.month]} ${input.year}`;
  const pages = [coverPage(input, title), ...input.accounts.map((a, i) => accountPage(a, i + 2, title))];
  return { css: CSS, html: pages.join(""), count: pages.length };
}

// Long summaries and plans step down in size rather than run off the page.
function fitPages(root) {
  for (const pg of root.querySelectorAll(".mg-page")) {
    const els = [...pg.querySelectorAll(".mg-prose, .mg-prios li")];
    let size = 17;
    const over = () => [...pg.children].some((c) => !c.classList.contains("mg-foot") && c.getBoundingClientRect().bottom > pg.getBoundingClientRect().top + H - 76);
    while (els.length && over() && size > 13) { size -= 0.5; els.forEach((e) => { e.style.fontSize = size + "px"; }); }
  }
}

/** Build the PDF and save it. */
export async function downloadManagementPdf(input, { filename, onProgress } = {}) {
  const { css, html, count } = managementPdfHtml(input);
  const style = document.createElement("style"); style.textContent = css;
  const host = document.createElement("div"); host.className = "mg"; host.innerHTML = html;
  document.head.appendChild(style); document.body.appendChild(host);
  try {
    const [{ toJpeg }, { jsPDF }] = await Promise.all([
      import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/+esm"),
      import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm"),
    ]);
    const fontCss = await fontEmbedCss();
    await document.fonts.ready;
    fitPages(host);
    const blank = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    const nodes = [...host.querySelectorAll(".mg-page")];
    for (let i = 0; i < nodes.length; i++) {
      onProgress && onProgress(i + 1, count);
      const img = await toJpeg(nodes[i], { quality: 0.9, pixelRatio: 1.5, width: W, height: H, backgroundColor: "#ffffff", imagePlaceholder: blank, fontEmbedCSS: fontCss, cacheBust: false });
      if (i) doc.addPage("a4", "portrait");
      doc.addImage(img, "JPEG", 0, 0, pw, ph, undefined, "FAST");
    }
    doc.save(filename || `TMKE social media management report ${MONTHS[input.month]} ${input.year}.pdf`);
    return true;
  } finally {
    host.remove(); style.remove();
  }
}
