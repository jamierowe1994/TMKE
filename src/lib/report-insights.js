// Report Insights — shared render functions for the monthly SocialPilot reports.
// Ported from the client's internal demo, re-skinned to the TMKE palette
// (brand dark → english-violet #371e28, light tiles → paper #f4f2f1). Pure
// functions: data in → HTML string out. Reused by the admin Insights page, the
// SMM client-file Insights tab, and the read-only member view.

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const num = (v) => (v == null ? "—" : Number(v).toLocaleString());

// ---- small helpers ---------------------------------------------------------
function kpi(l, v, s, sc) {
  return `<div class="ri-kpi"><div class="ri-kpi-label">${esc(l)}</div><div class="ri-kpi-val">${v ?? "—"}</div>${s ? `<div class="ri-kpi-sub" style="color:${sc || "#8a8796"};">${esc(s)}</div>` : ""}</div>`;
}
function bar(l, v, max, col) {
  const pct = max > 0 ? Math.round((v || 0) / max * 100) : 0;
  return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><div style="font-size:11px;color:#8a8796;width:64px;flex-shrink:0;text-align:right;">${esc(l)}</div><div style="flex:1;background:#e5e1e2;border-radius:3px;height:7px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:${col || "#371e28"};border-radius:3px;"></div></div><div style="font-size:11px;color:#8a8796;width:48px;text-align:right;flex-shrink:0;">${(v || 0).toLocaleString()}</div></div>`;
}

// ---- report card (dashboard) ----------------------------------------------
export function renderCard(r) {
  const d = r.data || {}, prof = d.profile || {}, ml = MONTHS[r.month] + " " + r.year;
  const color = r.accountColor || "#371e28";
  const kpis = [
    { l: "Followers", v: prof.followers != null ? Number(prof.followers).toLocaleString() : "—", s: prof.newFollowers ? "+" + prof.newFollowers + " new" : "" },
    { l: "Reach", v: prof.reach != null ? Number(prof.reach).toLocaleString() : "—", s: prof.reachChange ? "↑ " + Number(prof.reachChange) + "%" : "" },
    { l: "Interactions", v: prof.interactions != null ? prof.interactions : "—", s: "" },
    { l: "Int. Rate", v: prof.interactionRate ? prof.interactionRate + "%" : "—", s: "" },
  ];
  const hasK = kpis.some((k) => k.v !== "—");
  return `<div class="ri-card">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></div>
      <div style="flex:1;min-width:0;"><div style="font-size:15px;font-weight:600;color:#1c1d22;">${esc(r.accountName)}</div><div style="font-size:11.5px;color:#8a8796;">${esc(r.platform || "Instagram")} · ${esc(ml)}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="ri-btn ri-btn-primary ri-btn-sm" data-hub="${esc(r.accountId)}">Report Hub ✦</button>
        <button class="ri-btn ri-btn-ghost ri-btn-sm" data-view="${esc(r.id)}">View →</button>
      </div>
    </div>
    ${d.summary ? `<div style="font-size:13px;line-height:1.6;color:#55565b;padding:10px 12px;background:#faf9f8;border-radius:8px;margin-bottom:${hasK ? "12px" : "0"};">${esc(d.summary)}</div>` : ""}
    ${hasK ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">${kpis.map((k) => `<div style="background:#faf9f8;border-radius:8px;padding:9px 11px;"><div style="font-size:10px;color:#8a8796;margin-bottom:3px;">${esc(k.l)}</div><div style="font-size:16px;font-weight:700;color:#1c1d22;">${k.v}</div>${k.s ? `<div style="font-size:10px;color:#2c7a4b;">${esc(k.s)}</div>` : ""}</div>`).join("")}</div>` : ""}
  </div>`;
}

// ---- shared pieces for the admin tabs --------------------------------------
// A number as SocialPilot's JSON gives it: a number, a numeric string, or
// missing. Returns null when there's nothing to show.
const nv = (v) => { if (v == null || v === "") return null; const x = Number(String(v).replace(/[^0-9.\-]/g, "")); return Number.isFinite(x) ? x : null; };
const nf = (v) => (nv(v) == null ? "—" : nv(v).toLocaleString("en-GB"));
// "+42% on last month" / "−29% on last month", coloured by direction.
function change(v) {
  const x = nv(v); if (!x) return ["", ""];
  return [`${x > 0 ? "↑" : "↓"} ${Math.abs(x)}% on last month`, x > 0 ? "#2c7a4b" : "#a05a3c"];
}
const grid = (cols, inner) => `<div class="ri-grid" style="--ri-cols:${cols}">${inner}</div>`;
const sec = (label, first) => `<div class="ri-sec"${first ? ' style="margin-top:0;"' : ""}>${esc(label)}</div>`;
// Everything past the first `keep` rows goes behind a "Show all" toggle.
function withMore(rows, keep, label, wrap) {
  const top = rows.slice(0, keep).join(""), rest = rows.slice(keep).join("");
  return wrap(top) + (rest ? `<details class="ri-more"><summary>${esc(label || "Show all")}</summary>${wrap(rest)}</details>` : "");
}
// A small two-part split, e.g. followers vs non-followers.
function split(title, a, b, note) {
  const x = nv(a[1]) || 0, y = nv(b[1]) || 0, t = x + y;
  if (!t) return "";
  const pa = Math.round(x / t * 100);
  return `<div class="ri-panel ri-split"><div class="ri-split-h">${esc(title)}</div>
    <div class="ri-split-bar"><span style="width:${pa}%"></span></div>
    <div class="ri-split-legend"><div><b>${nf(x)}</b> ${esc(a[0])} <em>${pa}%</em></div><div><b>${nf(y)}</b> ${esc(b[0])} <em>${100 - pa}%</em></div></div>
    ${note ? `<div class="ri-split-note">${esc(note)}</div>` : ""}</div>`;
}

// Every post and reel in the month. New reports carry them all in `content`;
// older ones only had a short `topContent` list.
export function contentRows(d) {
  const rows = Array.isArray(d.content) && d.content.length ? d.content : (d.topContent || []);
  return rows.filter((t) => t && (t.title || t.url));
}
// The league table: by reach, then interactions to break a tie.
export function rankContent(d) {
  return contentRows(d).slice().sort((a, b) => (nv(b.reach) || 0) - (nv(a.reach) || 0) || (nv(b.interactions) || 0) - (nv(a.interactions) || 0));
}

// ---- Overview tab ----------------------------------------------------------
// `vis` (optional) = a { [fieldKey]: boolean } map from report-fields.js. When
// present, any field set to false is omitted; when absent every field shows
// (admin view).
//
// Two kinds of reach, kept apart on purpose. PROFILE reach counts each person
// once for the month. CONTENT reach is each post's reach added together, so a
// person who saw three reels counts three times — which is why reels + posts
// comes to more than the profile's total. They're in separate sections and
// labelled so nobody compares one with the other.
export function renderOverview(d, r, vis) {
  const show = (k) => !vis || vis[k] !== false;
  const p = d.profile || {}, rc = d.reach || {}, po = d.posts || {}, re = d.reels || {};
  const out = [];

  // Profile
  const [rcTxt, rcCol] = change(p.reachChange), [vTxt, vCol] = change(p.viewsChange), [iTxt, iCol] = change(p.interactionsChange);
  const k = [];
  if (show("followers")) k.push(kpi("Followers", nf(p.followers), show("newFollowers") && nv(p.newFollowers) ? `+${nf(p.newFollowers)} this month` : "", "#2c7a4b"));
  if (show("reach")) k.push(kpi("Reach", nf(p.reach), rcTxt || "People reached, each counted once", rcTxt ? rcCol : "#8a8796"));
  if (show("views")) k.push(kpi("Views", nf(p.views), vTxt, vCol));
  if (show("interactions")) k.push(kpi("Interactions", nf(p.interactions), iTxt, iCol));
  if (show("interactionRate")) k.push(kpi("Interaction rate", nv(p.interactionRate) != null ? nv(p.interactionRate) + "%" : "—", "Interactions ÷ reach", "#8a8796"));
  if (show("linkTaps")) k.push(kpi("Profile link taps", nf(p.linkTaps), "", "#8a8796"));
  if (k.length) out.push(sec("Profile overview", !out.length) + grid(3, k.join("")));

  // Published — how much we put out. Stories aren't counted: SocialPilot
  // only reports them for the last 24 hours.
  const np = nv(po.published), nr = nv(re.published);
  if (show("published") && (np != null || nr != null)) {
    out.push(sec("Published this month", !out.length) + grid(3,
      kpi("Posts", nf(np), "", "") + kpi("Reels", nf(nr), "", "") + kpi("Total published", nf((np || 0) + (nr || 0)), "Stories not included", "#8a8796")));
  }

  // Content — posts and reels together, then each on its own.
  const sum = (key) => { const a = nv(po[key]), b = nv(re[key]); return a == null && b == null ? null : (a || 0) + (b || 0); };
  if (show("contentOverview") && (d.posts || d.reels)) {
    const cRate = sum("reach") ? Math.round(sum("interactions") / sum("reach") * 1000) / 10 : null;
    out.push(sec("Content overview · posts and reels together", !out.length)
      + `<p class="ri-note">Reach here is each post's reach added together, so someone who saw three posts counts three times. That's why it's higher than the profile's reach above.</p>`
      + grid(4, kpi("Published", nf(sum("published")), "", "") + kpi("Reach (added)", nf(sum("reach")), "", "") + kpi("Views", nf(sum("views")), "", "") + kpi("Interactions", nf(sum("interactions")), cRate != null ? `${cRate}% of reach` : "", "#8a8796")));
    const card = (lbl, x, col) => {
      const rows = [["Published", x.published], ["Reach (added)", x.reach], ["Views", x.views], ["Interactions", x.interactions], ["Likes", x.likes], ["Comments", x.comments], ["Saves", x.saves], ["Shares", x.shares], ["Interaction rate", nv(x.interactionRate) != null ? nv(x.interactionRate) + "%" : null]]
        .filter(([, v]) => v != null && v !== "");
      return `<div class="ri-panel" style="margin:0;"><div class="ri-card-h" style="color:${col};">${esc(lbl)}</div>${rows.map(([a, v]) => `<div class="ri-row"><span>${esc(a)}</span><b>${typeof v === "string" && /%$/.test(v) ? esc(v) : nf(v)}</b></div>`).join("")}</div>`;
    };
    out.push(grid(2, (d.posts ? card("Posts", po, "#3f5a75") : "") + (d.reels ? card("Reels", re, "#371e28") : "")));
  }

  // Who the profile reached and who watched (SocialPilot's page 2).
  const parts = [];
  if (show("followerSplit")) {
    // Counted content by content, so it isn't a split of profile reach: in
    // September it came to 858 against 695 reached. Never set it against the
    // profile figure.
    parts.push(split("Content reach: followers vs non-followers", ["followers", rc.follower], ["non-followers", rc.nonFollower],
      "Counted piece by piece, so it doesn't add up to profile reach and isn't a share of it."));
  }
  if (show("viewsSplit") && d.viewsSplit) parts.push(split("Views: followers vs non-followers", ["by followers", d.viewsSplit.follower], ["by non-followers", d.viewsSplit.nonFollower], ""));
  const ib = d.interactionsByFormat || {};
  if (show("interactionsByFormat") && [ib.feed, ib.reel, ib.story, ib.ad].some((v) => nv(v))) {
    const fm = [["Posts", ib.feed, "#3f5a75"], ["Reels", ib.reel, "#371e28"], ["Stories", ib.story, "#8a8796"], ["Ads", ib.ad, "#b9826a"]].filter(([, v]) => nv(v));
    const max = Math.max(1, ...fm.map(([, v]) => nv(v)));
    parts.push(`<div class="ri-panel ri-split"><div class="ri-split-h">Interactions by format</div>${fm.map(([l, v, c]) => bar(l, nv(v), max, c)).join("")}</div>`);
  }
  const partsHtml = parts.filter(Boolean);
  if (partsHtml.length) out.push(sec("Who you reached", !out.length) + grid(Math.min(3, partsHtml.length), partsHtml.join("")));

  // Paid, only when ads actually ran — and from SocialPilot's own figures.
  const ads = d.ads || {};
  if (show("organicPaidReach") && (nv(ads.reach) || nv(ads.spend))) {
    out.push(sec("Paid advertising", !out.length) + grid(4,
      kpi("Ad reach", nf(ads.reach), "", "") + kpi("Clicks", nf(ads.clicks), "", "") + kpi("Spend", nv(ads.spend) != null ? "£" + nv(ads.spend).toLocaleString("en-GB") : "—", "", "") + kpi("Cost per click", nv(ads.cpc) != null ? "£" + nv(ads.cpc).toFixed(2) : "—", "", "")));
  }
  return out.join("");
}

// ---- Content tab -----------------------------------------------------------
// Days of the report's month, with each post's figures on the day it went out.
function dailyChart(title, rows, series, r) {
  const y = r && r.year, m = r && r.month;
  if (y == null || m == null) return "";
  const days = new Date(y, m + 1, 0).getDate();
  const byDay = Array.from({ length: days }, () => series.map(() => 0));
  let any = false;
  for (const t of rows) {
    const dt = /^(\d{4})-(\d{2})-(\d{2})/.exec(t.date || ""); if (!dt || +dt[1] !== y || +dt[2] - 1 !== m) continue;
    series.forEach((s, i) => { const v = nv(t[s.key]); if (v) { byDay[+dt[3] - 1][i] += v; any = true; } });
  }
  if (!any) return "";
  const W = 960, H = 240, L = 40, B = 22, T = 10, stacked = series.length > 2;
  const max = Math.max(1, ...byDay.map((v) => (stacked ? v.reduce((a, b) => a + b, 0) : Math.max(...v))));
  const step = Math.pow(10, Math.floor(Math.log10(max))), top = Math.ceil(max / step) * step;
  const X = (i) => L + (i + 0.5) * (W - L) / days, Y = (v) => H - B - v / top * (H - B - T), bw = Math.max(3, (W - L) / days * 0.62);
  let bars = "";
  byDay.forEach((v, i) => {
    if (stacked) { let acc = 0; v.forEach((val, k) => { if (!val) return; bars += `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${Y(acc + val).toFixed(1)}" width="${bw.toFixed(1)}" height="${(Y(acc) - Y(acc + val)).toFixed(1)}" fill="${series[k].col}"/>`; acc += val; }); }
    else v.forEach((val, k) => { if (!val) return; const w = bw / series.length; bars += `<rect x="${(X(i) - bw / 2 + k * w).toFixed(1)}" y="${Y(val).toFixed(1)}" width="${w.toFixed(1)}" height="${(Y(0) - Y(val)).toFixed(1)}" fill="${series[k].col}"/>`; });
  });
  const ticks = [0, top / 2, top].map((v) => `<line x1="${L}" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e5e1e2"/><text x="${L - 6}" y="${Y(v) + 3}" text-anchor="end" font-size="11" fill="#8a8796">${Math.round(v).toLocaleString("en-GB")}</text>`).join("");
  const xl = [1, 8, 15, 22, days].map((dd) => `<text x="${X(dd - 1)}" y="${H - 5}" text-anchor="middle" font-size="11" fill="#8a8796">${dd} ${MONTHS[m].slice(0, 3)}</text>`).join("");
  const totals = series.map((s, i) => byDay.reduce((a, v) => a + v[i], 0));
  const legend = series.map((s, i) => `<span><i style="background:${s.col}"></i>${esc(s.label)} (${totals[i].toLocaleString("en-GB")})</span>`).join("");
  return { title, html: `<div class="ri-panel"><div class="ri-split-h">${esc(title)} by day</div><svg viewBox="0 0 ${W} ${H}" class="ri-chart" role="img" aria-label="${esc(title)} by day">${ticks}${bars}${xl}</svg><div class="ri-legend">${legend}</div></div>` };
}

export function renderContent(d, vis, opts, r) {
  const show = (k) => !vis || vis[k] !== false;
  const out = [];
  const ranked = rankContent(d);
  if (show("topContent") && ranked.length) {
    const row = (t, i) => {
      const reel = /reel/i.test(t.type || "");
      const title = t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer"><span class="ri-ttl-t">${esc(t.title || "Open on Instagram")}</span><span class="ri-ttl-go" aria-hidden="true">↗</span></a>` : `<span class="ri-ttl-t">${esc(t.title)}</span>`;
      return `<tr><td class="ri-rank">${i + 1}</td>
        <td class="ri-thumbcell">${t.thumb ? `<img src="${esc(t.thumb)}" alt="" class="ri-thumb" loading="lazy">` : `<span class="ri-thumb ri-thumb--none"></span>`}</td>
        <td class="ri-ttl">${title}${t.date ? `<span class="ri-ttl-d">${esc(new Date(t.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }))}</span>` : ""}</td>
        <td class="ri-c"><span class="ri-type ri-type--${reel ? "reel" : "post"}">${reel ? "Reel" : esc(t.type || "Post")}</span></td>
        <td class="ri-c">${nf(t.reach)}</td><td class="ri-c">${reel ? nf(t.views) : "–"}</td><td class="ri-c">${nf(t.interactions)}</td></tr>`;
    };
    const rows = ranked.map(row);
    // Fixed columns, the four figures an equal width and centred, so the
    // top six and the rest (a second table, behind "Show all") line up.
    const cols = `<colgroup><col style="width:34px"><col style="width:60px"><col><col class="ri-eq"><col class="ri-eq"><col class="ri-eq"><col class="ri-eq"></colgroup>`;
    const wrap = (inner, head = true) => `<table class="ri-tbl ri-tbl--fixed">${cols}${head ? `<thead><tr><th></th><th></th><th>Content</th><th class="ri-c">Type</th><th class="ri-c">Reach</th><th class="ri-c">Views</th><th class="ri-c">Interactions</th></tr></thead>` : ""}<tbody>${inner}</tbody></table>`;
    const top6 = rows.slice(0, 6).join(""), rest = rows.slice(6).join("");
    out.push(sec("Top performing content · ranked by reach", !out.length)
      + `<div class="ri-panel ri-tblwrap">${wrap(top6)}${rest ? `<details class="ri-more"><summary>Show all</summary>${wrap(rest, false)}</details>` : ""}</div>`);
  }
  if (show("contentTrends")) {
    const rows = contentRows(d);
    const posts = rows.filter((t) => !/reel/i.test(t.type || "")), reels = rows.filter((t) => /reel/i.test(t.type || ""));
    const RV = (withViews) => [{ key: "reach", label: "Reach", col: "#371e28" }, ...(withViews ? [{ key: "views", label: "Views", col: "#c9a9b5" }] : [])];
    const IN = [{ key: "likes", label: "Likes", col: "#371e28" }, { key: "comments", label: "Comments", col: "#b9826a" }, { key: "saves", label: "Saves", col: "#5b7a9a" }, { key: "shares", label: "Shares", col: "#c9c3c6" }];
    const charts = [
      // SocialPilot's post table has no per-post views, so posts chart reach only.
      dailyChart("Post reach", posts, [{ key: "reach", label: "Reach", col: "#3f5a75" }], r),
      dailyChart("Post interactions", posts, IN, r),
      dailyChart("Reel reach and views", reels, RV(true), r),
      dailyChart("Reel interactions", reels, IN, r),
    ].filter(Boolean);
    // One chart at a time, full width, chosen from a row of pills (wired by
    // the admin page: [data-ri-pill] shows the [data-ri-pane] with its index).
    if (charts.length) out.push(sec("Day by day", !out.length)
      + `<div class="ri-pills" role="tablist">${charts.map((c, i) => `<button type="button" class="ri-pill${i ? "" : " is-active"}" role="tab" aria-selected="${i ? "false" : "true"}" data-ri-pill="${i}">${esc(c.title)}</button>`).join("")}</div>`
      + charts.map((c, i) => `<div data-ri-pane="${i}"${i ? " hidden" : ""}>${c.html}</div>`).join(""));
  }
  // Hashtags: the five best-reaching shown, the rest behind a toggle, posts
  // and reels apart as SocialPilot keeps them.
  const hts = d.hashtags || [];
  if (show("hashtags") && hts.length && !(opts && opts.hideHashtags)) {
    const groups = hts.some((h) => h.format) ? [["Post", "Posts"], ["Reel", "Reels"]] : [[null, "All content"]];
    const panels = groups.map(([f, lbl]) => {
      const list = hts.filter((h) => !f || (h.format || "Post") === f);
      if (!list.length) return "";
      const rows = list.map((h) => `<tr><td>${esc(String(h.name || "").startsWith("#") ? h.name : "#" + h.name)}</td><td class="ri-n">${nf(h.count)}</td><td class="ri-n">${nf(h.reach)}</td><td class="ri-n">${nf(h.interactions)}</td></tr>`);
      const wrap = (inner) => `<table class="ri-tbl"><thead><tr><th>Hashtag</th><th class="ri-n">Used</th><th class="ri-n">Avg reach</th><th class="ri-n" title="Average interactions">Avg int.</th></tr></thead><tbody>${inner}</tbody></table>`;
      return `<div class="ri-panel ri-tblwrap" style="margin:0;"><div class="ri-card-h">${esc(lbl)}</div>${withMore(rows, 5, "Show all", wrap)}</div>`;
    }).filter(Boolean);
    // The five that did most, posts and reels together: each tag's reach
    // across every use (uses × its average), so a tag used once on a lucky
    // post doesn't outrank one that carried several.
    const merged = new Map();
    for (const h of hts) {
      const name = String(h.name || "").replace(/^#/, ""); if (!name) continue;
      const k = name.toLowerCase(), c = nv(h.count) || 1, m = merged.get(k) || { name, uses: 0, reach: 0, inter: 0 };
      m.uses += c; m.reach += c * (nv(h.reach) || 0); m.inter += c * (nv(h.interactions) || 0);
      merged.set(k, m);
    }
    const best = [...merged.values()].sort((a, b) => b.reach - a.reach).slice(0, 5);
    const snap = best.length ? `<p class="ri-note" style="margin:0 0 8px;">Top five across posts and reels · average reach · times used</p><div class="ri-tags">${best.map((m, i) => `<span class="ri-tag"><b>${i + 1}</b>#${esc(m.name)}<em title="Average reach · times used">${nf(Math.round(m.reach / m.uses))} · ${m.uses}×</em></span>`).join("")}</div>` : "";
    if (panels.length) out.push(sec("Hashtag performance", !out.length) + snap + grid(panels.length, panels.join("")));
  }
  return out.join("");
}

// ---- Audience tab ----------------------------------------------------------
export function renderAudience(d, vis) {
  const show = (k) => !vis || vis[k] !== false;
  const out = [];
  const dem = d.demographics || {}, p = d.profile || {};

  // When followers are online — first, as it's what we schedule by. Never
  // shown to the client.
  const pt = d.peakTimes || {}, slots = pt.slots || [], g = pt.grid || [];
  if ((show("peakTimes") || show("postingWindows")) && (g.length || d.bestDays)) {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], hc = ["#f4f2f1", "#d8d2d5", "#9a8f94", "#371e28"];
    const hm = g.length && slots.length ? `<div class="ri-hm" style="--ri-slots:${slots.length}"><div></div>${slots.map((s) => `<div class="ri-hm-l">${esc(s)}</div>`).join("")}${g.map((row, i) => `<div class="ri-hm-l">${days[i]}</div>${row.map((v) => `<div class="ri-hm-c" style="background:${hc[Math.max(0, Math.min(3, v || 0))]}"></div>`).join("")}`).join("")}</div>`
      + `<div class="ri-legend" style="margin:0 0 14px;">${["Low", "Moderate", "Good", "Peak"].map((l, i) => `<span><i style="background:${hc[i]};${i ? "" : "box-shadow:inset 0 0 0 1px #d8d2d5;"}"></i>${l}</span>`).join("")}<span style="margin-left:auto;">Share of followers online</span></div>` : "";
    const w = [["Best days", d.bestDays], ["Morning", d.morningWindow], ["Evening", d.eveningWindow]].filter(([, v]) => v);
    out.push(sec("When followers are online", !out.length) + `<div class="ri-panel">${d.timing ? `<p class="ri-note" style="margin:0 0 12px;">${esc(d.timing)}</p>` : ""}${hm}${w.length ? grid(w.length, w.map(([l, v]) => `<div class="ri-kpi ri-kpi--window"><div class="ri-kpi-label">${esc(l)}</div><div class="ri-kpi-val">${esc(v)}</div></div>`).join("")) : ""}</div>`);
  }
  // Age, split by gender — then gender, cities and countries.
  const age = (dem.age || []).filter((a) => a && a.range);
  if (show("age") && age.length) {
    const G = [["male", "Male", "#3f5a75"], ["female", "Female", "#371e28"], ["unspecified", "Unspecified", "#c9c3c6"]];
    const max = Math.max(1, ...age.flatMap((a) => G.map(([k]) => nv(a[k]) || 0)));
    const cols = age.map((a) => `<div class="ri-age-col"><div class="ri-age-bars">${G.map(([k, , c]) => `<span title="${esc(a.range)} ${k}: ${nf(a[k])}" style="height:${Math.round((nv(a[k]) || 0) / max * 100)}%;background:${c}"></span>`).join("")}</div><div class="ri-age-l">${esc(a.range)}</div></div>`).join("");
    const legend = G.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join("");
    out.push(sec("Age", !out.length) + `<div class="ri-panel"><div class="ri-age">${cols}</div><div class="ri-legend">${legend}</div><p class="ri-note" style="margin:8px 0 0;">Read off SocialPilot's chart, so each bar is close rather than exact. Followers since the account began.</p></div>`);
  }

  const genders = dem.gender || [], cities = dem.topCities || [];
  const gHtml = show("gender") && genders.length ? `<div class="ri-panel" style="margin:0;"><div class="ri-card-h">Gender</div>${genders.map((g, i) => bar(g.label, nv(g.pct) || 0, 100, ["#371e28", "#8a8796", "#c9c3c6"][i % 3]).replace(/>(\d+)<\/div><\/div>$/, ">$1%</div></div>")).join("")}</div>` : "";
  const maxCity = Math.max(1, ...cities.map((c) => nv(c.count) || 0));
  const cHtml = show("cities") && cities.length ? `<div class="ri-panel" style="margin:0;"><div class="ri-card-h">Top cities</div>${withMore(cities.map((c) => bar(c.city, nv(c.count), maxCity, "#371e28")), 3, "Show all", (x) => x)}</div>` : "";
  if (gHtml || cHtml) out.push(sec("Gender and location", !out.length) + grid((gHtml ? 1 : 0) + (cHtml ? 1 : 0), gHtml + cHtml));

  const countries = dem.topCountries || [];
  if (show("countries") && countries.length) {
    const uk = nv(p.ukFollowers) ?? nv((countries.find((c) => /united kingdom|^uk$/i.test(c.country || "")) || {}).count);
    const maxC = Math.max(1, ...countries.map((c) => nv(c.count) || 0));
    out.push(sec("Countries", !out.length) + `<div class="ri-panel">${uk != null && nv(p.followers) ? `<p class="ri-note" style="margin:0 0 12px;"><b>${nf(uk)}</b> of ${nf(p.followers)} followers are in the UK (${Math.round(uk / nv(p.followers) * 100)}%).</p>` : ""}${withMore(countries.map((c) => bar(c.country, nv(c.count), maxC, "#8a8796")), 3, "Show all", (x) => x)}</div>`);
  }

  return out.join("");
}

// ---- Actions tab -----------------------------------------------------------
export function renderActions(d, r, vis) {
  const show = (k) => !vis || vis[k] !== false;
  const prios = d.priorities || [], coming = d.comingSoon || [], nextM = MONTHS[((r && r.month) + 1) % 12] || "Next month";
  const dc = { go: "#2c7a4b", caution: "#9a6a04", action: "#a05a3c" };
  const pRows = prios.map((p, i) => `<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:${i < prios.length - 1 ? ".5px solid #e5e1e2" : "none"};"><div style="width:8px;height:8px;border-radius:50%;background:${dc[p.type] || "#8a8796"};flex-shrink:0;margin-top:4px;"></div><div style="font-size:13px;color:#1c1d22;line-height:1.55;">${esc(p.text)}</div></div>`).join("");
  const pLeg = prios.length ? `<div style="display:flex;gap:20px;margin-top:14px;padding-top:12px;border-top:.5px solid #e5e1e2;">${[["#2c7a4b", "Do more"], ["#9a6a04", "Improve"], ["#a05a3c", "Fix now"]].map(([c, l]) => `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#8a8796;"><div style="width:7px;height:7px;border-radius:50%;background:${c};"></div>${l}</div>`).join("")}</div>` : "";
  const cRows = coming.map((item, i) => `<div style="display:flex;gap:12px;padding:7px 0;border-bottom:${i < coming.length - 1 ? ".5px solid #e5e1e2" : "none"};align-items:flex-start;"><div style="width:20px;height:20px;border-radius:50%;background:#efedf0;color:#371e28;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">${i + 1}</div><div style="font-size:12px;color:#1c1d22;line-height:1.55;">${esc(item)}</div></div>`).join("");
  const prioSec = show("priorities") ? `<div class="ri-sec" style="margin-top:0;">${esc(nextM)} priorities</div><div class="ri-panel">${pRows || '<div style="font-size:12px;color:#8a8796;">No action items.</div>'}${pLeg}</div>` : "";
  const comeSec = (show("comingSoon") && coming.length) ? `<div class="ri-sec">Coming soon content</div><div class="ri-panel" style="border-left:3px solid #371e28;">${cRows}</div>` : "";
  return (prioSec + comeSec).replace(/^<div class="ri-sec"(?! style)/, '<div class="ri-sec" style="margin-top:0;"');
}

// ---- Trends tab (month-on-month) — takes the account's reports, oldest→newest
// With Facebook or LinkedIn in any of the months, each platform gets its own
// comparison, one after the other (Danielle, 10 Oct 2026).
function platformTrendTable(accR, key, rows) {
  const months = accR.filter((r) => (r.data || {})[key]);
  if (!months.length) return "";
  const cell = (v) => (v == null || v === "" ? "—" : v);
  return `<div class="ri-panel" style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:${100 + accR.length * 90}px;"><thead><tr><th style="text-align:left;color:#8a8796;font-weight:600;font-size:10px;padding:6px 0;border-bottom:1px solid #e5e1e2;"></th>${accR.map((r) => `<th style="text-align:center;color:#8a8796;font-weight:600;font-size:10px;padding:6px 8px;border-bottom:1px solid #e5e1e2;">${esc(MONTHS[r.month].slice(0, 3))} ${r.year}</th>`).join("")}</tr></thead><tbody>${rows.map(([lbl, fn]) => `<tr><td style="color:#8a8796;padding:8px 0;border-bottom:.5px solid #e5e1e2;white-space:nowrap;">${esc(lbl)}</td>${accR.map((r) => { const x = (r.data || {})[key]; return `<td style="font-weight:600;color:#1c1d22;text-align:center;padding:8px;border-bottom:.5px solid #e5e1e2;">${x ? cell(fn(x)) : "—"}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>`;
}
export function renderTrends(accR) {
  const fbT = platformTrendTable(accR || [], "facebook", [["Page likes", (x) => nf(x.pageLikes)], ["New likes", (x) => nf(x.newFans)], ["Page reach", (x) => nf(x.pageReach)], ["Post views", (x) => nf((x.posts || {}).views)], ["Engagement", (x) => nf((x.posts || {}).engagement)], ["Posts published", (x) => nf((x.posts || {}).published)]]);
  const liT = platformTrendTable(accR || [], "linkedin", [["Followers", (x) => nf(x.followers)], ["New followers", (x) => nf(x.followerGrowth)], ["Impressions", (x) => nf((x.posts || {}).impressions ?? x.impressions)], ["Post reach", (x) => nf((x.posts || {}).reach)], ["Engagement", (x) => nf((x.posts || {}).engagement)], ["Engagement rate", (x) => nv((x.posts || {}).engagementRate) != null ? nv(x.posts.engagementRate) + "%" : "—"]]);
  if (!fbT && !liT) return renderTrendsIg(accR);
  const igHas = (accR || []).some((r) => { const d = r.data || {}; return d.profile || d.posts || d.reels; });
  return [igHas ? `<section class="ri-platsec">${platHead("instagram", true)}${renderTrendsIg(accR)}</section>` : "",
    fbT ? `<section class="ri-platsec">${platHead("facebook", !igHas)}${fbT}</section>` : "",
    liT ? `<section class="ri-platsec">${platHead("linkedin", !igHas && !fbT)}<p class="ri-note" style="margin:0 0 10px;">Each LinkedIn month is the 30 days before that report was run.</p>${liT}</section>` : ""].join("");
}
function renderTrendsIg(accR) {
  if (!accR || accR.length < 2) return `<div class="ri-sec" style="margin-top:0;">Trends</div><div class="ri-panel" style="text-align:center;padding:22px;color:#8a8796;font-size:13px;">Upload at least 2 months to see month-on-month trends here.</div>`;
  const labels = accR.map((r) => MONTHS[r.month].slice(0, 3));
  const fol = accR.map((r) => Number((r.data || {}).profile?.followers) || 0);
  const rea = accR.map((r) => Number((r.data || {}).profile?.reach) || 0);
  const eng = accR.map((r) => parseFloat((r.data || {}).profile?.interactionRate) || 0);
  const inter = accR.map((r) => Number((r.data || {}).profile?.interactions) || 0);
  const spark = (vals, lbl, fmt) => {
    const max = Math.max(...vals, 1), latest = vals[vals.length - 1], prev = vals[vals.length - 2];
    const chg = prev ? ((latest - prev) / prev * 100).toFixed(1) : 0, up = Number(chg) >= 0;
    return `<div class="ri-panel" style="flex:1;min-width:120px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><div style="font-size:10px;color:#8a8796;font-weight:600;letter-spacing:.06em;text-transform:uppercase;">${esc(lbl)}</div><div style="font-size:11px;font-weight:700;color:${up ? "#2c7a4b" : "#a05a3c"};">${up ? "+" : ""}${chg}%</div></div><div style="font-size:22px;font-weight:700;color:#1c1d22;margin-bottom:14px;">${fmt(latest)}</div><div style="display:flex;align-items:flex-end;gap:3px;height:52px;">${vals.map((v, i) => { const isL = i === vals.length - 1; return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;height:100%;"><div style="width:100%;margin-top:auto;background:#371e28;border-radius:3px 3px 0 0;opacity:${isL ? 1 : 0.3 + i * 0.14};height:${Math.max(Math.round(v / max * 100), 4)}%;"></div><div style="font-size:9px;color:#8a8796;white-space:nowrap;">${esc(labels[i])}</div></div>`; }).join("")}</div></div>`;
  };
  const tRows = [["Followers (on report day)", (r) => Number((r.data || {}).profile?.followers || 0).toLocaleString()], ["New follows", (r) => (r.data || {}).profile?.newFollowers || "—"], ["Reach", (r) => Number((r.data || {}).profile?.reach || 0).toLocaleString()], ["Interactions", (r) => (r.data || {}).profile?.interactions || "—"], ["Eng. rate", (r) => (r.data || {}).profile?.interactionRate ? (r.data || {}).profile.interactionRate + "%" : "—"], ["Link taps", (r) => (r.data || {}).profile?.linkTaps ?? "—"]];
  return `<div class="ri-sec" style="margin-top:0;">Month-on-month trends</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">${spark(accR.map((r) => Number((r.data || {}).profile?.newFollowers) || 0), "New followers", (v) => v.toLocaleString())}${spark(rea, "Reach", (v) => v.toLocaleString())}${spark(eng, "Eng. Rate", (v) => v + "%")}${spark(inter, "Interactions", (v) => v || "—")}</div><div class="ri-sec">Full comparison table</div><div class="ri-panel" style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:${100 + accR.length * 90}px;"><thead><tr><th style="text-align:left;color:#8a8796;font-weight:600;font-size:10px;padding:6px 0;border-bottom:1px solid #e5e1e2;"></th>${accR.map((r) => `<th style="text-align:center;color:#8a8796;font-weight:600;font-size:10px;padding:6px 8px;border-bottom:1px solid #e5e1e2;">${esc(MONTHS[r.month].slice(0, 3))} ${r.year}</th>`).join("")}</tr></thead><tbody>${tRows.map(([lbl, fn]) => `<tr><td style="color:#8a8796;padding:8px 0;border-bottom:.5px solid #e5e1e2;white-space:nowrap;">${esc(lbl)}</td>${accR.map((r) => `<td style="font-weight:600;color:#1c1d22;text-align:center;padding:8px;border-bottom:.5px solid #e5e1e2;">${fn(r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

// ---- Platforms ---------------------------------------------------------------
// A month's report can cover Instagram, Facebook and LinkedIn. Each platform
// gets its own section on each tab, never their figures put together: the
// content, the audience and the results are different on each (Danielle,
// 10 Oct 2026).
const PLATFORMS = [["instagram", "Instagram", "#c13584"], ["facebook", "Facebook", "#1877f2"], ["linkedin", "LinkedIn", "#0a66c2"]];
export function reportPlatforms(d) {
  d = d || {};
  const has = {
    instagram: !!(d.profile || d.posts || d.reels || (Array.isArray(d.content) && d.content.length)),
    facebook: !!d.facebook,
    linkedin: !!d.linkedin,
  };
  return PLATFORMS.map(([k]) => k).filter((k) => has[k]);
}
const platHead = (key, first) => {
  const [, name, col] = PLATFORMS.find(([k]) => k === key);
  return `<div class="ri-plat${first ? " is-first" : ""}"><span class="ri-plat-dot" style="background:${col}"></span>${esc(name)}</div>`;
};
const dayShort = (iso) => { const t = new Date(String(iso || "") + "T12:00:00"); return isNaN(t) ? "" : t.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
// A platform's posts as a table, best reach first: six, then the rest.
function postTable(rows, cols) {
  const ranked = rows.filter((t) => t && t.title).slice().sort((a, b) => (nv(b.reach) || 0) - (nv(a.reach) || 0));
  if (!ranked.length) return "";
  const tr = (t, i) => `<tr><td class="ri-rank">${i + 1}</td><td class="ri-ttl"><span class="ri-ttl-t">${esc(t.title)}</span>${t.date ? `<span class="ri-ttl-d">${esc(dayShort(t.date))}</span>` : ""}</td>${cols.map(([, f]) => `<td class="ri-c">${f(t)}</td>`).join("")}</tr>`;
  const cg = `<colgroup><col style="width:34px"><col>${cols.map(() => '<col class="ri-eq">').join("")}</colgroup>`;
  const wrap = (inner, head = true) => `<table class="ri-tbl ri-tbl--fixed">${cg}${head ? `<thead><tr><th></th><th>Post</th>${cols.map(([h]) => `<th class="ri-c">${esc(h)}</th>`).join("")}</tr></thead>` : ""}<tbody>${inner}</tbody></table>`;
  const all = ranked.map(tr), top = all.slice(0, 6).join(""), rest = all.slice(6).join("");
  return `<div class="ri-panel ri-tblwrap">${wrap(top)}${rest ? `<details class="ri-more"><summary>Show all ${ranked.length}</summary>${wrap(rest, false)}</details>` : ""}</div>`;
}

// ---- Facebook ----------------------------------------------------------------
export function renderFacebook(tab, fb, vis) {
  const show = (k) => !vis || vis[k] !== false;
  fb = fb || {};
  const fp = fb.posts || {};
  if (tab === "audience") return `<p class="ri-note" style="margin:0;">SocialPilot's Facebook report has no audience breakdown, so there's nothing to show here for Facebook.</p>`;
  if (tab === "content") {
    if (!show("facebookPosts")) return "";
    const t = postTable(fb.content || [], [["Reach", (x) => nf(x.reach)], ["Eng. rate", (x) => nv(x.engagementRate) != null ? nv(x.engagementRate) + "%" : "–"], ["Reactions", (x) => nf(x.reactions)], ["Shares", (x) => nf(x.shares)], ["Video views", (x) => nv(x.videoViews) != null ? nf(x.videoViews) : "–"]]);
    return t ? sec("Facebook posts · ranked by reach", true) + t : `<p class="ri-note" style="margin:0;">No Facebook posts in this report.</p>`;
  }
  const out = [];
  const [rT, rC] = change(fb.pageReachChange), [vT, vC] = change(fb.pageViewsChange);
  out.push(sec("Page", true) + grid(3,
    kpi("Page likes", nf(fb.pageLikes), nv(fb.newFans) ? `+${nf(fb.newFans)} new this month` : "", "#2c7a4b")
    + kpi("Page reach", nf(fb.pageReach), rT || "People who saw anything from the Page", rT ? rC : "#8a8796")
    + kpi("Page views", nf(fb.pageViews), vT, vC)));
  const [pT, pC] = change(fp.publishedChange), [wT, wC] = change(fp.viewsChange), [eT, eC] = change(fp.engagementChange), [yT, yC] = change(fp.videoPlaysChange);
  const mix = [nv(fp.images) ? `${nf(fp.images)} images` : "", nv(fp.videos) ? `${nf(fp.videos)} videos` : ""].filter(Boolean).join(", ");
  out.push(sec("Posts") + grid(4,
    kpi("Published", nf(fp.published), pT || mix, pT ? pC : "#8a8796")
    + kpi("Post views", nf(fp.views), wT, wC)
    + kpi("Engagement", nf(fp.engagement), eT || "Reactions, comments and shares", eT ? eC : "#8a8796")
    + kpi("Video plays", nf(fp.videoPlays), yT, yC))
    + grid(3, kpi("Reactions", nf(fp.reactions), "", "") + kpi("Comments", nf(fp.comments), "", "") + kpi("Shares", nf(fp.shares), "", "")));
  return out.join("");
}

// ---- LinkedIn ----------------------------------------------------------------
// SocialPilot reports LinkedIn over the 30 days before the report was run.
export function renderLinkedIn(tab, li, vis) {
  const show = (k) => !vis || vis[k] !== false;
  li = li || {};
  const lp = li.posts || {}, lv = li.videos || {};
  const period = li.period ? `<p class="ri-note" style="margin:0 0 10px;">${esc(li.period)}: the 30 days before SocialPilot ran the report, not the calendar month.</p>` : "";
  if (tab === "audience") return `<p class="ri-note" style="margin:0;">SocialPilot's LinkedIn report has no audience breakdown, so there's nothing to show here for LinkedIn.</p>`;
  if (tab === "content") {
    if (!show("linkedinPosts")) return "";
    const t = postTable(li.content || [], [["Reach", (x) => nf(x.reach)], ["Engagement", (x) => nf(x.engagement)], ["Reactions", (x) => nf(x.reactions)], ["Comments", (x) => nf(x.comments)]]);
    return t ? period + sec("LinkedIn posts · ranked by reach", !period) + t : `<p class="ri-note" style="margin:0;">No LinkedIn posts in this report.</p>`;
  }
  const ch = (v) => { const x = nv(v); return x ? [`${x > 0 ? "↑" : "↓"} ${Math.abs(x)}% on the 30 days before`, x > 0 ? "#2c7a4b" : "#a05a3c"] : ["", ""]; };
  const imp = lp.impressions != null ? lp.impressions : li.impressions, impC = lp.impressions != null ? lp.impressionsChange : li.impressionsChange;
  const [iT, iC] = ch(impC), [rT, rC] = ch(lp.reachChange), [eT, eC] = ch(lp.engagementChange), [erT, erC] = ch(lp.engagementRateChange), [pT, pC] = ch(lp.publishedChange);
  const out = [period];
  out.push(sec("Profile", !period) + grid(3,
    kpi("Followers", nf(li.followers), nv(li.followerGrowth) ? `+${nf(li.followerGrowth)} new` : "", "#2c7a4b")
    + kpi("Connections", nf(li.connections), "", "")
    + kpi("Impressions", nf(imp), iT || "Times posts were seen", iT ? iC : "#8a8796")));
  out.push(sec("Posts") + grid(4,
    kpi("Published", nf(lp.published), pT, pC)
    + kpi("Post reach", nf(lp.reach), rT, rC)
    + kpi("Engagement", nf(lp.engagement), eT || "Reactions and comments", eT ? eC : "#8a8796")
    + kpi("Engagement rate", nv(lp.engagementRate) != null ? nv(lp.engagementRate) + "%" : "—", erT, erC))
    + grid(3, kpi("Reactions", nf(lp.reactions), "", "") + kpi("Comments", nf(lp.comments), "", "")
      + kpi("Videos", nf(lv.published), nv(lv.published) ? `${nf(lv.views)} views` : "", "#8a8796")));
  return out.join("");
}

// `opts` (optional) tailors a tab for the member view without changing admin's —
// admin calls this with no vis and no opts, so it keeps the full breakdown.
// With more than one platform in the month, each tab is a section per
// platform: Instagram, then Facebook, then LinkedIn.
export function renderTab(tab, d, r, vis, opts) {
  if (tab === "actions") return renderActions(d, r, vis);
  const ig = () => tab === "content" ? renderContent(d, vis, opts, r) : tab === "audience" ? renderAudience(d, vis) : renderOverview(d, r, vis);
  const plats = reportPlatforms(d).filter((k) => k === "instagram" || !vis || vis[k] !== false);
  if (!plats.length || (plats.length === 1 && plats[0] === "instagram")) return ig();
  return plats.map((k, i) => {
    const body = k === "instagram" ? ig() : k === "facebook" ? renderFacebook(tab, d.facebook, vis) : renderLinkedIn(tab, d.linkedin, vis);
    return `<section class="ri-platsec">${platHead(k, i === 0)}${body || `<p class="ri-note" style="margin:0;">Nothing for this platform on this tab.</p>`}</section>`;
  }).join("");
}
