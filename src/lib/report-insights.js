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

// ---- Overview tab ----------------------------------------------------------
// `vis` (optional) = a { [fieldKey]: boolean } map from report-fields.js. When
// present, any field set to false is omitted (used for the client-facing view);
// when absent every field shows (admin view). Same pattern across the tabs.
export function renderOverview(d, r, vis) {
  const show = (k) => !vis || vis[k] !== false;
  const p = d.profile || {}, rc = d.reach || {};
  const kpiDefs = [
    ["followers", () => kpi("Total followers", p.followers != null ? Number(p.followers).toLocaleString() : "—", show("newFollowers") && p.newFollowers ? "+" + p.newFollowers + " this month" : "", "#8a8796")],
    ["reach", () => kpi("Total reach", p.reach != null ? Number(p.reach).toLocaleString() : "—", p.reachChange ? "↑ " + Number(p.reachChange) + "%" : "", p.reachChange > 0 ? "#2c7a4b" : "#a05a3c")],
    ["views", () => kpi("Total views", p.views != null ? Number(p.views).toLocaleString() : "—", "", "#8a8796")],
    ["interactions", () => kpi("Interactions", p.interactions != null ? p.interactions : "—", "", "#8a8796")],
    ["interactionRate", () => kpi("Interaction rate", p.interactionRate ? p.interactionRate + "%" : "—", p.interactionRate > 10 ? "Excellent ✓" : "Needs work", p.interactionRate > 10 ? "#2c7a4b" : "#9a6a04")],
    ["linkTaps", () => kpi("Link taps", p.linkTaps != null ? p.linkTaps : "—", p.linkTaps === 0 ? "Needs attention" : "", p.linkTaps === 0 ? "#a05a3c" : "#8a8796")],
  ];
  const kpis = kpiDefs.filter(([k]) => show(k)).map(([, f]) => f()).join("");
  const overviewSec = kpis ? `<div class="ri-sec" style="margin-top:0;">Profile overview</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">${kpis}</div>` : "";

  const maxR = Math.max(rc.reels || 0, rc.posts || 0, rc.stories || 0, rc.ads || 0, 1);
  const tot = (rc.nonFollower || 0) + (rc.follower || 0); const nfPct = tot ? Math.round((rc.nonFollower || 0) / tot * 100) : 0;
  const barsHtml = show("reachByFormat")
    ? `<div style="font-size:12px;font-weight:600;color:#1c1d22;margin-bottom:12px;">Reach by format</div>${bar("Reels", rc.reels || 0, maxR, "#371e28")}${bar("Posts", rc.posts || 0, maxR, "#8a8796")}${bar("Stories", rc.stories || 0, maxR, "#c9c3c6")}${rc.ads ? bar("Ads (Paid)", rc.ads, maxR, "#b9826a") : ""}`
    : "";
  const tiles = [];
  if (show("followerSplit")) {
    tiles.push(`<div style="background:#f4f2f1;border-radius:8px;padding:10px 12px;"><div style="font-size:18px;font-weight:700;color:#1c1d22;">${num(rc.nonFollower)}</div><div style="font-size:10px;color:#8a8796;margin-top:2px;">Non-follower reach</div><div style="font-size:10px;color:#b3adb0;">${nfPct}% of total</div></div>`);
    tiles.push(`<div style="background:#f4f2f1;border-radius:8px;padding:10px 12px;"><div style="font-size:18px;font-weight:700;color:#1c1d22;">${num(rc.follower)}</div><div style="font-size:10px;color:#8a8796;margin-top:2px;">Follower reach</div><div style="font-size:10px;color:#b3adb0;">${100 - nfPct}% of total</div></div>`);
  }
  if (show("ukFollowers") && p.ukFollowers) tiles.push(`<div style="background:#f4f2f1;border-radius:8px;padding:10px 12px;"><div style="font-size:18px;font-weight:700;color:#1c1d22;">${num(p.ukFollowers)}</div><div style="font-size:10px;color:#8a8796;margin-top:2px;">UK followers</div></div>`);
  const tilesHtml = tiles.length ? `<div style="display:grid;grid-template-columns:repeat(${tiles.length},1fr);gap:8px;margin-top:${barsHtml ? "16px" : "0"};">${tiles.join("")}</div>` : "";
  const split = (show("organicPaidReach") && (rc.organicReach != null || rc.paidReach != null))
    ? `<div style="margin-top:12px;padding-top:12px;border-top:.5px solid #e5e1e2;"><div style="font-size:11px;font-weight:700;color:#1c1d22;margin-bottom:8px;letter-spacing:.04em;">ORGANIC vs PAID SPLIT</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">${rc.organicReach != null ? `<div style="background:#eef1f4;border-radius:8px;padding:10px 12px;border-left:3px solid #5b7a9a;"><div style="font-size:18px;font-weight:700;color:#3f5a75;">${num(rc.organicReach)}</div><div style="font-size:10px;color:#8a8796;margin-top:2px;">Organic reach</div>${rc.organicReach && rc.paidReach ? `<div style="font-size:10px;color:#b3adb0;">${Math.round(rc.organicReach / (rc.organicReach + rc.paidReach) * 100)}% of total</div>` : ""}</div>` : ""}${rc.paidReach != null ? `<div style="background:#f6efe9;border-radius:8px;padding:10px 12px;border-left:3px solid #b9826a;"><div style="font-size:18px;font-weight:700;color:#a56a4e;">${num(rc.paidReach)}</div><div style="font-size:10px;color:#8a8796;margin-top:2px;">Paid reach (Ads)</div>${rc.paidReach && rc.organicReach ? `<div style="font-size:10px;color:#b3adb0;">${Math.round(rc.paidReach / (rc.organicReach + rc.paidReach) * 100)}% of total</div>` : ""}</div>` : ""}</div></div>`
    : "";
  const reachInner = barsHtml + tilesHtml + split;
  const reachSec = reachInner ? `<div class="ri-sec"${overviewSec ? "" : ' style="margin-top:0;"'}>Reach breakdown</div><div class="ri-panel">${reachInner}</div>` : "";
  return overviewSec + reachSec;
}

// ---- Content tab -----------------------------------------------------------
export function renderContent(d, vis, opts) {
  const o = opts || {};
  const show = (k) => !vis || vis[k] !== false;
  const reels = d.reels || {}, posts = d.posts || {}, ads = d.ads || {};
  const hasAds = d.ads && (d.ads.reach || d.ads.interactions || d.ads.spend != null);
  // Members get the top N, ranked; admin (no opts) still gets the full list.
  const tc = o.topN ? (d.topContent || []).slice(0, o.topN) : (d.topContent || []);
  const hts = d.hashtags || [], maxH = hts.length ? Math.max(...hts.map((h) => h.reach || 0), 1) : 1;
  const typeColors = { Reel: ["#efedf0", "#371e28"], Post: ["#eef1f4", "#3f5a75"], Ad: ["#f6efe9", "#a56a4e"], Story: ["#f4f2f1", "#55565b"] };
  // The five a client actually asks about: how many did we put out, how far did they
  // go, how many watched, how many did something, and what share that is. Likes /
  // comments / saves / shares are the working behind "interactions" — admin keeps them
  // (no opts), members don't need the same number counted five ways. Paid keeps its
  // full set either way: spend and cost-per-click are the point of an ad.
  const COMPACT_ROWS = ["Published", "Reach", "Views", "Interactions", "Interaction rate"];
  const mkCard = (lbl, dat, col, isPaid) => {
    let rows = [["Published", dat.published], ["Reach", dat.reach != null ? Number(dat.reach).toLocaleString() : null], ["Views", dat.views != null ? Number(dat.views).toLocaleString() : null], ["Interactions", dat.interactions], ["Likes", dat.likes], ["Comments", dat.comments], ["Saves", dat.saves], ["Shares", dat.shares], ["Interaction rate", dat.interactionRate], ["Clicks", dat.clicks], ["Cost per click", dat.cpc ? "£" + dat.cpc : null], ["Impressions", dat.impressions != null ? Number(dat.impressions).toLocaleString() : null], ["Spend", dat.spend != null ? "£" + dat.spend : null]].filter(([, v]) => v != null);
    if (o.compactCards && !isPaid) rows = rows.filter(([k]) => COMPACT_ROWS.includes(k));
    return `<div class="ri-panel" style="flex:1;min-width:0;${isPaid ? "border-top:3px solid #b9826a;" : ""}">${isPaid ? `<div style="font-size:9px;font-weight:700;color:#b9826a;letter-spacing:.08em;margin-bottom:8px;">● PAID</div>` : ""}<div style="font-size:13px;font-weight:700;color:${col};margin-bottom:12px;">${esc(lbl)}</div>${rows.map(([k, v]) => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:.5px solid #e5e1e2;"><span style="color:#8a8796;">${esc(k)}</span><span style="font-weight:600;color:#1c1d22;">${esc(v)}</span></div>`).join("")}</div>`;
  };
  const orgI = (reels.interactions || 0) + (posts.interactions || 0); const paidI = ads.interactions || 0; const totI = orgI + paidI;
  const splitHtml = hasAds && totI ? `<div class="ri-panel"><div style="font-size:11px;font-weight:700;color:#1c1d22;margin-bottom:12px;letter-spacing:.04em;">ORGANIC vs PAID — INTERACTIONS</div><div style="display:flex;gap:8px;margin-bottom:10px;"><div style="flex:1;background:#eef1f4;border-radius:8px;padding:10px 12px;border-left:3px solid #5b7a9a;"><div style="font-size:20px;font-weight:700;color:#3f5a75;">${orgI}</div><div style="font-size:10px;color:#8a8796;margin-top:2px;">Organic</div><div style="font-size:10px;color:#b3adb0;">${Math.round(orgI / totI * 100)}% of total</div></div><div style="flex:1;background:#f6efe9;border-radius:8px;padding:10px 12px;border-left:3px solid #b9826a;"><div style="font-size:20px;font-weight:700;color:#a56a4e;">${paidI}</div><div style="font-size:10px;color:#8a8796;margin-top:2px;">Paid (Ads)</div><div style="font-size:10px;color:#b3adb0;">${Math.round(paidI / totI * 100)}% of total</div></div></div><div style="background:#f4f2f1;border-radius:4px;height:6px;overflow:hidden;"><div style="width:${Math.round(orgI / totI * 100)}%;height:100%;background:#371e28;border-radius:4px;"></div></div></div>` : "";
  // Ranked 1..N for members (opts.rankTop) — a "top five" that doesn't say which is
  // first isn't a ranking. Admin keeps the plain table.
  const rank = !!o.rankTop;
  const tcCols = rank ? "22px 1fr 56px 56px 52px" : "1fr 56px 56px 52px";
  const tcHeads = rank ? ["", "CONTENT", "REACH", "INTER.", "FORMAT"] : ["CONTENT", "REACH", "INTER.", "TYPE"];
  const tcRows = tc.length ? `<div class="ri-panel"><div style="display:grid;grid-template-columns:${tcCols};gap:8px;padding:4px 0 8px;border-bottom:.5px solid #e5e1e2;margin-bottom:4px;">${tcHeads.map((h) => `<div style="font-size:10px;color:#8a8796;letter-spacing:.06em;text-align:${h === "CONTENT" ? "left" : "center"};">${h}</div>`).join("")}</div>${tc.map((p, i) => { const c = typeColors[p.type] || typeColors.Post; return `<div style="display:grid;grid-template-columns:${tcCols};gap:8px;padding:9px 0;border-bottom:${i < tc.length - 1 ? ".5px solid #e5e1e2" : "none"};align-items:center;">${rank ? `<div style="font-size:12px;font-weight:700;color:#371e28;text-align:center;">${i + 1}</div>` : ""}<div style="font-size:12px;color:#1c1d22;">${esc(p.title || p.content || "")}</div><div style="font-size:13px;font-weight:600;text-align:center;color:#1c1d22;">${p.reach || "—"}</div><div style="font-size:13px;font-weight:600;text-align:center;color:#1c1d22;">${p.interactions || "—"}</div><div style="text-align:center;"><span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;background:${c[0]};color:${c[1]};">${esc(p.type || "Post")}</span></div></div>`; }).join("")}</div>` : "";
  const htRows = hts.length ? `<div class="ri-panel"><div style="font-size:12px;font-weight:600;color:#1c1d22;margin-bottom:14px;">Avg reach & interactions by hashtag</div>${hts.map((h) => `<div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span style="font-weight:700;color:#371e28;">${esc(h.name)}</span><span style="color:#8a8796;">reach <strong style="color:#1c1d22;">${h.reach || 0}</strong> · inter. <strong style="color:#1c1d22;">${h.interactions || 0}</strong></span></div><div style="background:#f4f2f1;border-radius:3px;height:5px;overflow:hidden;"><div style="width:${Math.round((h.reach || 0) / maxH * 100)}%;height:100%;background:#371e28;border-radius:3px;opacity:.7;"></div></div></div>`).join("")}</div>` : "";
  const secs = [];
  if (show("organicContent")) secs.push(`<div class="ri-sec">Organic content</div><div style="display:flex;gap:12px;">${mkCard("Reels", reels, "#371e28", false)}${mkCard("Posts", posts, "#8a8796", false)}</div>`);
  if (show("paidContent") && hasAds) secs.push(`<div class="ri-sec">Paid advertising</div>${mkCard("Ads", ads, "#b9826a", true)}`);
  if (show("organicPaidInteractions") && hasAds) secs.push(`<div class="ri-sec">Organic vs paid</div>${splitHtml}`);
  if (show("topContent") && tc.length) secs.push(`<div class="ri-sec">Top performing content</div>${tcRows}`);
  if (show("hashtags") && hts.length) secs.push(`<div class="ri-sec">Hashtag performance</div>${htRows}`);
  // First visible section loses its top margin so the tab body sits flush.
  return secs.join("").replace(/^<div class="ri-sec"/, '<div class="ri-sec" style="margin-top:0;"');
}

// ---- Audience tab ----------------------------------------------------------
export function renderAudience(d, vis) {
  const show = (k) => !vis || vis[k] !== false;
  const pt = d.peakTimes || {}, slots = pt.slots || [], grid = pt.grid || [], timing = d.timing || "";
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hmColors = ["#f4f2f1", "#d8d2d5", "#9a8f94", "#371e28"], hmLabels = ["Low", "Moderate", "Good", "Peak"];
  let hm = '<div style="font-size:12px;color:#8a8796;">No heatmap data for this report.</div>';
  if (grid.length && slots.length) {
    hm = `<div style="display:grid;grid-template-columns:36px repeat(${slots.length},1fr);gap:3px;margin-bottom:4px;"><div></div>${slots.map((s) => `<div style="font-size:9px;color:#8a8796;text-align:center;">${esc(s)}</div>`).join("")}</div>${grid.map((row, di) => `<div style="display:grid;grid-template-columns:36px repeat(${slots.length},1fr);gap:3px;margin-bottom:3px;"><div style="font-size:11px;color:#8a8796;line-height:20px;">${days[di] || ""}</div>${row.map((val) => `<div style="height:20px;border-radius:3px;background:${hmColors[Math.min(val, 3)] || hmColors[0]};"></div>`).join("")}</div>`).join("")}<div style="display:flex;gap:14px;margin-top:10px;">${hmColors.map((c, i) => `<div style="display:flex;align-items:center;gap:5px;font-size:10px;color:#8a8796;"><div style="width:10px;height:10px;border-radius:2px;background:${c};border:1px solid #e5e1e2;"></div>${hmLabels[i]}</div>`).join("")}</div>`;
  }
  const bd = d.bestDays || "", mw = d.morningWindow || "", ew = d.eveningWindow || "";
  const wCards = (bd || mw || ew) ? `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:16px;">${bd ? `<div style="background:#f4f2f1;border-radius:8px;padding:10px 12px;"><div style="font-size:10px;color:#8a8796;margin-bottom:4px;">Best days</div><div style="font-size:13px;font-weight:700;color:#1c1d22;">${esc(bd)}</div></div>` : ""}${mw ? `<div style="background:#f4f2f1;border-radius:8px;padding:10px 12px;"><div style="font-size:10px;color:#8a8796;margin-bottom:4px;">Morning window</div><div style="font-size:13px;font-weight:700;color:#1c1d22;">${esc(mw)}</div></div>` : ""}${ew ? `<div style="background:#f4f2f1;border-radius:8px;padding:10px 12px;"><div style="font-size:10px;color:#8a8796;margin-bottom:4px;">Evening window</div><div style="font-size:13px;font-weight:700;color:#1c1d22;">${esc(ew)}</div></div>` : ""}</div>` : "";
  const dem = d.demographics || {}, genders = dem.gender || [], cities = dem.topCities || [], countries = dem.topCountries || [];
  const maxCity = cities.length ? Math.max(...cities.map((c) => c.count || 0), 1) : 1, maxCountry = countries.length ? Math.max(...countries.map((c) => c.count || 0), 1) : 1;
  const gColors = ["#371e28", "#8a8796", "#c9c3c6"];
  const gHtml = (show("gender") && genders.length) ? `<div class="ri-panel"><div style="font-size:12px;font-weight:600;color:#1c1d22;margin-bottom:14px;">Gender split</div>${genders.map((g, i) => `<div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span style="color:#8a8796;">${esc(g.label)}</span><span style="font-weight:600;color:#1c1d22;">${g.pct}% <span style="color:#8a8796;font-weight:400;">(${g.count})</span></span></div><div style="background:#f4f2f1;border-radius:3px;height:6px;"><div style="width:${g.pct}%;height:100%;background:${gColors[i] || "#c9c3c6"};border-radius:3px;"></div></div></div>`).join("")}</div>` : "";
  const cHtml = (show("cities") && cities.length) ? `<div class="ri-panel"><div style="font-size:12px;font-weight:600;color:#1c1d22;margin-bottom:14px;">Top cities</div>${cities.map((c, i) => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:${i < cities.length - 1 ? ".5px solid #e5e1e2" : "none"};align-items:center;"><span style="color:#8a8796;">${esc(c.city)}</span><div style="display:flex;align-items:center;gap:8px;"><div style="width:60px;background:#f4f2f1;border-radius:3px;height:5px;"><div style="width:${Math.round(c.count / maxCity * 100)}%;height:100%;background:#371e28;border-radius:3px;opacity:.6;"></div></div><span style="font-weight:600;color:#1c1d22;width:26px;text-align:right;">${c.count}</span></div></div>`).join("")}</div>` : "";
  const coHtml = (show("countries") && countries.length) ? `<div class="ri-panel"><div style="font-size:12px;font-weight:600;color:#1c1d22;margin-bottom:14px;">Followers by country</div>${countries.map((c) => `<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;"><span style="color:#8a8796;">${esc(c.country)}</span><span style="font-weight:600;color:#1c1d22;">${c.count}</span></div><div style="background:#f4f2f1;border-radius:3px;height:5px;"><div style="width:${Math.round(c.count / maxCountry * 100)}%;height:100%;background:#371e28;border-radius:3px;opacity:.6;"></div></div></div>`).join("")}</div>` : "";
  const demHtml = (gHtml || cHtml || coHtml) ? `<div class="ri-sec">Audience demographics</div><div style="display:grid;grid-template-columns:${gHtml && cHtml ? "1fr 1fr" : "1fr"};gap:12px;margin-bottom:12px;">${gHtml}${cHtml}</div>${coHtml}` : "";
  const showPeak = show("peakTimes"), showWin = show("postingWindows");
  const topPanel = (showPeak || showWin)
    ? `<div class="ri-sec" style="margin-top:0;">Follower activity — best posting times</div>${showPeak && timing ? `<div style="font-size:12px;color:#8a8796;margin-bottom:12px;line-height:1.6;">${esc(timing)}</div>` : ""}<div class="ri-panel">${showPeak ? hm : ""}${showWin ? wCards : ""}</div>`
    : "";
  // If the peak-times panel is hidden, let the demographics section sit flush.
  const demSec = topPanel ? demHtml : demHtml.replace(/^<div class="ri-sec"/, '<div class="ri-sec" style="margin-top:0;"');
  return topPanel + demSec;
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
export function renderTrends(accR) {
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
  const tRows = [["Followers", (r) => Number((r.data || {}).profile?.followers || 0).toLocaleString()], ["New follows", (r) => (r.data || {}).profile?.newFollowers || "—"], ["Reach", (r) => Number((r.data || {}).profile?.reach || 0).toLocaleString()], ["Interactions", (r) => (r.data || {}).profile?.interactions || "—"], ["Eng. rate", (r) => (r.data || {}).profile?.interactionRate ? (r.data || {}).profile.interactionRate + "%" : "—"], ["Link taps", (r) => (r.data || {}).profile?.linkTaps ?? "—"]];
  return `<div class="ri-sec" style="margin-top:0;">Month-on-month trends</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">${spark(fol, "Followers", (v) => v.toLocaleString())}${spark(rea, "Reach", (v) => v.toLocaleString())}${spark(eng, "Eng. Rate", (v) => v + "%")}${spark(inter, "Interactions", (v) => v || "—")}</div><div class="ri-sec">Full comparison table</div><div class="ri-panel" style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:${100 + accR.length * 90}px;"><thead><tr><th style="text-align:left;color:#8a8796;font-weight:600;font-size:10px;padding:6px 0;border-bottom:1px solid #e5e1e2;"></th>${accR.map((r) => `<th style="text-align:center;color:#8a8796;font-weight:600;font-size:10px;padding:6px 8px;border-bottom:1px solid #e5e1e2;">${esc(MONTHS[r.month].slice(0, 3))} ${r.year}</th>`).join("")}</tr></thead><tbody>${tRows.map(([lbl, fn]) => `<tr><td style="color:#8a8796;padding:8px 0;border-bottom:.5px solid #e5e1e2;white-space:nowrap;">${esc(lbl)}</td>${accR.map((r) => `<td style="font-weight:600;color:#1c1d22;text-align:center;padding:8px;border-bottom:.5px solid #e5e1e2;">${fn(r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

// `opts` (optional) tailors a tab for the member view without changing admin's —
// admin calls this with no vis and no opts, so it keeps the full breakdown.
export function renderTab(tab, d, r, vis, opts) {
  if (tab === "content") return renderContent(d, vis, opts);
  if (tab === "audience") return renderAudience(d, vis);
  if (tab === "actions") return renderActions(d, r, vis);
  return renderOverview(d, r, vis);
}
