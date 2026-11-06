/* Revenue: the four sectors, where each kind of money goes, and the profit
 * sums. Written once here so the Revenue page, the Invoicing page and the
 * Worker's month-end review all say the same thing (Dani, 5-6 Nov 2026; agreed
 * on the mock-up https://claude.ai/artifact/Lc3J3AF5qpCXGLb2e5BAXh).
 *
 * All money in pence, without VAT.
 */

export const SECTORS = [
  ["social", "Social media"],
  ["video", "Videography"],
  ["studio", "The Studio"],
  ["agent", "Agent services"],
];
export const SECTOR_NAME = { social: "Social media", video: "Videography", studio: "The Studio", agent: "Agent services" };

/* Where each kind of money goes. `check` = Dani hasn't confirmed it yet.
   `pick` = chosen on the invoice, because nothing about it says which. */
export const REV_RULES = [
  { key: "social-monthly", src: "Social media monthly invoices", sector: "social" },
  { key: "social-other", src: "First invoices and one-offs on a social media file", sector: "social" },
  { key: "packs", src: "Pack purchases from The Edit", sector: "studio" },
  { key: "content-calendar", src: "Content Calendar subscriptions, when they start", sector: "studio" },
  { key: "video-property", src: "Property video", sector: "video" },
  { key: "video-agent", src: "Agent shoot on location", sector: "video" },
  { key: "video-content-studio", src: "Content Studio Day", sector: "video" },
  { key: "video-new-starter-studio", src: "New-starter Studio Day", sector: "video", check: true },
  { key: "video-new-starter-location", src: "New-starter on location", sector: "video", check: true },
  { key: "video-shot-scheduled", src: "Shot & Scheduled shoot", sector: "video", check: true },
  { key: "video-event", src: "Event coverage", sector: "video", check: true },
  { key: "video-photography", src: "Photography", sector: "video" },
  { key: "video-other", src: "Any other videography", sector: "video" },
  { key: "video-extras", src: "Faux twilight and extra images", sector: "video" },
  { key: "pixieset", src: "Pixieset photo sales", sector: "video", check: true },
  { key: "agent-hub", src: "TPE Marketing Hub", sector: "agent" },
  { key: "agent-assets", src: "Monthly agent assets", sector: "agent" },
  { key: "other", src: "Any other invoice, not on a file", sector: "pick", check: true },
];

const SERVICE_RULE = {
  "new-starter studio day": "video-new-starter-studio",
  "new-starter on location": "video-new-starter-location",
  "content studio day": "video-content-studio",
  "property video": "video-property",
  "agent shoot on location": "video-agent",
  "shot & scheduled shoot": "video-shot-scheduled",
  "event coverage": "video-event",
  "photography": "video-photography",
};
export function ruleForService(service) {
  return SERVICE_RULE[String(service || "").trim().toLowerCase()] || "video-other";
}

/* Which sector a rule key lands in, with any changes Dani has saved.
   overrides: { ruleKey: sector }. */
export function sectorForRule(key, overrides) {
  const o = overrides && overrides[key];
  if (o) return o;
  const r = REV_RULES.find((x) => x.key === key);
  return r ? r.sector : "pick";
}

/* ---- Costs ----
   rows from revenue_costs: { kind: "base"|"month", month, sector, staff_pence, tech_pence }.
   A base row applies from its month on ("0000-00" = always), so changing the
   base leaves finished months as they were. */
export function baseFor(rows, ym, sector) {
  const list = rows.filter((r) => r.kind === "base" && r.sector === sector && r.month <= ym).sort((a, b) => (a.month < b.month ? 1 : -1));
  return list[0] ? { staff: list[0].staff_pence, tech: list[0].tech_pence, from: list[0].month } : { staff: null, tech: null, from: null };
}
export function costFor(rows, ym, sector) {
  const o = rows.find((r) => r.kind === "month" && r.month === ym && r.sector === sector);
  if (o) return { staff: o.staff_pence, tech: o.tech_pence, changed: true };
  const b = baseFor(rows, ym, sector);
  return { staff: b.staff, tech: b.tech, changed: false };
}
export const hasCost = (c) => c.staff != null || c.tech != null;

/* A sector with no costs in yet stays out of the profit, both its revenue and
   its costs, so the profit is never overstated. rev: { social, video, studio, agent }. */
export function monthPL(rows, ym, rev) {
  const lines = SECTORS.map(([a, name]) => {
    const c = costFor(rows, ym, a), r = (rev && rev[a]) || 0, cost = (c.staff || 0) + (c.tech || 0);
    return { a, name, rev: r, staff: c.staff, tech: c.tech, has: hasCost(c), cost, profit: r - cost, margin: r ? Math.round((r - cost) / r * 100) : null, changed: c.changed };
  });
  const inn = lines.filter((r) => r.has);
  const revT = inn.reduce((t, r) => t + r.rev, 0), cost = inn.reduce((t, r) => t + r.cost, 0), profit = revT - cost;
  return { rows: lines, rev: revT, cost, profit, margin: revT ? Math.round(profit / revT * 100) : null, missing: lines.filter((r) => !r.has).map((r) => r.name) };
}

/* What came in that month, including anything not under a sector yet. */
export const monthTotal = (rev) => SECTORS.reduce((t, [a]) => t + ((rev && rev[a]) || 0), 0) + ((rev && rev.pick) || 0);

/* Payments added up by the month they were paid and the sector they go under,
   without VAT and after any refund. */
export function revenueByMonth(payments) {
  const out = {};
  for (const p of payments || []) {
    const ym = String(p.paid_at || "").slice(0, 7);
    if (!ym) continue;
    const m = out[ym] || (out[ym] = { social: 0, video: 0, studio: 0, agent: 0, pick: 0 });
    const gross = Number(p.gross_pence) || 0, refunded = Number(p.refunded_pence) || 0;
    const net = Math.round((Number(p.net_pence) || 0) * (gross ? Math.max(0, gross - refunded) / gross : 1));
    const a = m[p.sector] !== undefined ? p.sector : "pick";
    m[a] += net;
  }
  return out;
}

/* The lines under a month's profit. No figure is left unexplained. */
export function plNotes(ym, thisMonth, rev, pl, withBtn) {
  const box = (words, btn) => `<div class="closed"><span>${words}</span>${btn || ""}</div>`;
  let out = "";
  const uncosted = pl.rows.filter((r) => !r.has).reduce((t, r) => t + r.rev, 0);
  if (pl.missing.length) out += box(`${pl.missing.join(" and ")} isn't counted in the profit yet, because its costs aren't in. That leaves ${gbp(uncosted)} of revenue out of the profit.`, withBtn ? '<button type="button" class="btn" data-costs="base">Add the costs</button>' : "");
  if (rev && rev.pick) out += box(`${gbp(rev.pick)} of revenue isn't under a sector yet, so it isn't counted in the profit. Choose its sector on the invoice.`);
  if (ym === thisMonth) out += box(`${ymLabel(ym).split(" ")[0]} isn't finished, so this is the whole month's costs against the revenue so far.`);
  return out;
}

/* ---- Words and figures ---- */
export function gbp(p) {
  const n = Math.round(Number(p) || 0) / 100;
  const abs = Math.abs(n);
  return (n < 0 ? "−" : "") + "£" + abs.toLocaleString("en-GB", { minimumFractionDigits: abs % 1 ? 2 : 0, maximumFractionDigits: 2 });
}
export const pct = (n) => (n == null ? "—" : (n < 0 ? "−" : "") + Math.abs(n) + "%");
export function ymLabel(ym) { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }); }
export function monShort(ym) { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }); }
export function ymAddMonths(ym, k) { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + k, 1)).toISOString().slice(0, 7); }

const niceStep = (span) => {
  const pounds = span / 100;
  const s = pounds > 40000 ? 20000 : pounds > 20000 ? 10000 : pounds > 10000 ? 5000 : pounds > 4000 ? 2000 : pounds > 1000 ? 500 : pounds > 200 ? 100 : 50;
  return s * 100;
};
const axisLabel = (t) => (t === 0 ? "£0" : (t < 0 ? "−" : "") + "£" + (Math.abs(t) >= 100000 ? Math.abs(t) / 100000 + "k" : Math.abs(t) / 100));

/* One series, wine for the month you're on and stone for the rest. */
export function barsSvg(vals, labels, sel, w, h, money) {
  const pad = { l: money ? 44 : 2, r: 2, t: 20, b: 22 }, iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const max = Math.max(...vals, 1), step = niceStep(max), top = Math.ceil(max / step) * step;
  const y = (v) => pad.t + ih - (v / top) * ih;
  let out = `<svg viewBox="0 0 ${w} ${h}" role="img">`;
  if (money) for (let t = 0; t <= top; t += step) out += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(t)}" y2="${y(t)}" stroke="#eae5e1"/><text x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${axisLabel(t)}</text>`;
  const bw = iw / vals.length, mw = Math.min(money ? 44 : 22, bw - 6);
  vals.forEach((v, i) => {
    const x = pad.l + bw * i + (bw - mw) / 2, yy = y(v), bh = Math.max(v ? 2 : 0, pad.t + ih - yy), r = Math.min(4, bh);
    out += `<path d="M${x} ${yy + bh}V${yy + r}Q${x} ${yy} ${x + r} ${yy}H${x + mw - r}Q${x + mw} ${yy} ${x + mw} ${yy + r}V${yy + bh}Z" fill="${i === sel ? "#371e28" : "#c9bcb7"}"/>`;
    if (i === sel) out += `<text class="v" x="${x + mw / 2}" y="${yy - 6}" text-anchor="middle">${gbp(v)}</text>`;
    out += `<text x="${x + mw / 2}" y="${h - 6}" text-anchor="middle">${labels[i]}</text>`;
    out += `<rect class="bar-hit" x="${pad.l + bw * i}" y="${pad.t}" width="${bw}" height="${ih}" fill="transparent" data-tip="${labels[i]}: ${gbp(v)}"/>`;
  });
  return out + "</svg>";
}

/* Profit: a real zero line, so a loss-making month goes below it, in red. */
export function profitSvg(vals, labels, margins, sel, w, h) {
  const pad = { l: 44, r: 2, t: 22, b: 24 }, iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const hi = Math.max(...vals, 0), lo = Math.min(...vals, 0), span = Math.max(hi - lo, 1), step = niceStep(span);
  let top = Math.ceil(hi / step) * step; const bot = Math.floor(lo / step) * step; if (top === bot) top = bot + step;
  const y = (v) => pad.t + (top - v) / (top - bot) * ih;
  let out = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Profit by month">`;
  for (let t = bot; t <= top; t += step) out += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 ? "#c9bcb7" : "#eae5e1"}"/><text x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${axisLabel(t)}</text>`;
  const bw = iw / vals.length, mw = Math.min(44, bw - 6), z = y(0);
  vals.forEach((v, i) => {
    const x = pad.l + bw * i + (bw - mw) / 2, yy = y(v), bh = Math.max(v ? 2 : 0, Math.abs(z - yy)), r = Math.min(4, bh), up = v >= 0;
    const d = up
      ? `M${x} ${z}V${z - bh + r}Q${x} ${z - bh} ${x + r} ${z - bh}H${x + mw - r}Q${x + mw} ${z - bh} ${x + mw} ${z - bh + r}V${z}Z`
      : `M${x} ${z}V${z + bh - r}Q${x} ${z + bh} ${x + r} ${z + bh}H${x + mw - r}Q${x + mw} ${z + bh} ${x + mw} ${z + bh - r}V${z}Z`;
    out += `<path d="${d}" fill="${v < 0 ? "#8a3f3f" : i === sel ? "#371e28" : "#c9bcb7"}"/>`;
    if (i === sel || v < 0) out += `<text class="v" x="${x + mw / 2}" y="${up ? z - bh - 6 : z + bh + 15}" text-anchor="middle">${gbp(v)}</text>`;
    out += `<text x="${x + mw / 2}" y="${h - 6}" text-anchor="middle">${labels[i]}</text>`;
    out += `<rect class="bar-hit" x="${pad.l + bw * i}" y="${pad.t}" width="${bw}" height="${ih}" fill="transparent" data-tip="${labels[i]}: ${gbp(v)}, ${pct(margins[i])} margin"/>`;
  });
  return out + "</svg>";
}

const escHtml = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* The body of the Month-end review: the pop-out and the PDF are the same words.
   data: { month, thisMonth, months[], revenueByMonth {ym: {social...}}, costs[], open: { interBrand:{n,p}, client:{n,p}, overdue:{n,p} } } */
export function reviewBody(d, chartWidth) {
  const rev = d.revenueByMonth[d.month] || {};
  const total = monthTotal(rev);
  const pl = monthPL(d.costs, d.month, rev);
  const i = d.months.indexOf(d.month);
  const totals = d.months.map((m) => monthTotal(d.revenueByMonth[m] || {}));
  const row3 = (lab, x) => `<tr><td>${lab}</td><td class="num">${x.n}</td><td class="num">${gbp(x.p)}</td></tr>`;
  const notes = plNotes(d.month, d.thisMonth, rev, pl, false);
  return `<div class="figs" style="margin:0"><div class="fig lin static"><b>${gbp(total)}</b><span>Revenue</span></div><div class="fig lin static"><b>${gbp(pl.cost)}</b><span>Costs</span></div><div class="fig dark static"><b>${gbp(pl.profit)}</b><span>Profit</span></div><div class="fig lin static"><b>${pct(pl.margin)}</b><span>Margin</span></div></div>${notes}`
    + `<div class="section"><div class="strip"><div class="strip-t">Revenue<span>last six months</span></div></div><div class="chart">${barsSvg(totals, d.months.map(monShort), i, chartWidth || 780, 200, true)}</div></div>`
    + `<div class="section"><div class="strip"><div class="strip-t">By sector</div></div>${plTable(pl, true)}</div>`
    + `<div class="section"><div class="strip"><div class="strip-t">Invoices from ${ymLabel(d.month).split(" ")[0]} still open</div></div><div class="tablewrap"><table><thead><tr><th></th><th class="num">Invoices</th><th class="num">Net</th></tr></thead><tbody>${row3("Inter-brand", d.open.interBrand)}${row3("Waiting on client payment", d.open.client)}${row3("Of those, overdue", d.open.overdue)}</tbody></table></div></div>`;
}

/* The profit table. compact = no chips and rows don't open anything. */
export function plTable(pl, compact) {
  const dash = '<td class="num tx">—</td>', red = (v) => (v < 0 ? ' style="color:#8a3f3f"' : "");
  return `<div class="tablewrap"><table><thead><tr><th>Sector</th><th class="num">Revenue</th><th class="num">Staffing</th><th class="num">Tools and tech</th><th class="num">Costs</th><th class="num">Profit</th><th class="num">Margin</th>${compact ? "" : "<th></th>"}</tr></thead><tbody>${pl.rows.map((r) => {
    const attr = compact ? "" : ' class="click" data-costs="month" tabindex="0"';
    const flag = compact ? "" : `<td>${!r.has ? '<span class="chip plain">Costs not in yet</span>' : r.changed ? '<span class="chip plain">Changed this month</span>' : ""}</td>`;
    if (!r.has) return `<tr${attr}><td>${escHtml(r.name)}</td><td class="num">${gbp(r.rev)}</td>${dash}${dash}${dash}${dash}${dash}${flag}</tr>`;
    return `<tr${attr}><td>${escHtml(r.name)}</td><td class="num">${gbp(r.rev)}</td><td class="num tx">${gbp(r.staff || 0)}</td><td class="num tx">${gbp(r.tech || 0)}</td><td class="num tx">${gbp(r.cost)}</td><td class="num"${red(r.profit)}>${gbp(r.profit)}</td><td class="num">${pct(r.margin)}</td>${flag}</tr>`;
  }).join("")}</tbody><tfoot><tr><td>${pl.missing.length ? "Total counted" : "Total"}</td><td class="num">${gbp(pl.rev)}</td><td></td><td></td><td class="num">${gbp(pl.cost)}</td><td class="num"${red(pl.profit)}>${gbp(pl.profit)}</td><td class="num">${pct(pl.margin)}</td>${compact ? "" : "<td></td>"}</tr></tfoot></table></div>`;
}

/* The styles the review needs on its own, for the PDF. */
export const REVIEW_CSS = `
*{box-sizing:border-box}
html,body{margin:0;background:#fff;color:#2b2226;font-family:"Darker Grotesque","Helvetica Neue",Arial,sans-serif;font-size:14px;line-height:1.35;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4;margin:14mm}
.rv-head{padding:20px 20px;background:#eae5e1;border-radius:4px;margin:0 0 14px}
.rv-eye{margin:0 0 6px;font-size:11px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:#7e6765}
.rv-title{margin:0;font-family:"Fraunces",Georgia,serif;font-weight:300;font-size:30px;line-height:1.05;letter-spacing:-.05em}
.rv-body{display:grid;gap:14px}
.figs{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.fig{display:grid;gap:4px;padding:14px 16px 12px;border-radius:4px}
.fig b{font-weight:400;font-size:26px;line-height:1.1;font-variant-numeric:lining-nums tabular-nums}
.fig.lin{background:#eae5e1;color:#371e28}.fig.lin span{color:#7e6765}
.fig.dark{background:#371e28;color:#fff}.fig.dark span{color:rgba(255,255,255,.8)}
.section{display:grid;gap:10px;break-inside:avoid}
.strip{display:flex;align-items:center;min-height:30px;padding:0 14px;background:#371e28;border-radius:4px}
.strip-t{font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#fff}
.strip-t span{margin-left:8px;color:rgba(255,255,255,.6)}
.chart{border:1px solid #e2d9d4;border-radius:4px;padding:14px 16px 10px}
.chart svg{display:block;width:100%;height:auto}
.chart text{font-size:13px;fill:#7e6765}.chart text.v{fill:#2b2226}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th,td{padding:0 10px;height:34px;border-bottom:1px solid #eae5e1;text-align:left;font-weight:400;white-space:nowrap}
thead th{color:#7e6765;border-top:1px solid #c9bcb7;border-bottom:1px solid #c9bcb7}
tbody tr:last-child td{border-bottom:1px solid #c9bcb7}
tfoot td{border-bottom:1px solid #c9bcb7}
.num{text-align:right}.tx{color:#7e6765}
.closed{padding:10px 14px;border:1px dashed #c9bcb7;border-radius:4px;color:#7e6765}
`;

/* The whole page the PDF is printed from. */
export function reviewHtml(d) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Month-end review, ${escHtml(ymLabel(d.month))}</title>`
    + `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300&family=Darker+Grotesque:wght@400;500;600&display=swap"><style>${REVIEW_CSS}</style></head>`
    + `<body><div class="rv-head"><p class="rv-eye">Month-end review</p><div class="rv-title">${escHtml(ymLabel(d.month))}${d.month === d.thisMonth ? " so far" : ""}</div></div><div class="rv-body">${reviewBody(d, 780)}</div></body></html>`;
}
