/* A Content Calendar month's Insights (Danielle, 17 Nov 2026). The fifth step
 * on a published month, after Final checks. Agreed on the mock-up
 * (docs/tmke-os/calendar-month-insights, v3).
 *
 * The Worker's /admin/month-insights gives the raw material (the usage log,
 * planner items, who had access and who's on Plus); every figure is worked
 * out here, so the Everyone / Content Calendar / Plus chips need no second
 * trip. What counts, as agreed with her:
 *   Opened a post      clicked a day and the post popped up (post_opened), or
 *                      opened its design straight from the Studio
 *   Made a copy        pressed Use This Template, or opened it from the Studio
 *                      (design_opened): their copy only exists once they change it
 *   Changed their copy their first change saved (copy_saved)
 *   Finished           downloaded, added to the planner, or scheduled
 *   Used it            opened at least one post. Signing in alone never counts.
 * Staff and test logins are left out by the Worker.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
// The day an event happened, in UK time: "2026-12-03".
const dayOf = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/London" });

export function initMonthInsights({ host, supabase, WORKER }) {
  const S = { who: "all", sort: "copies", data: null, monthId: null, loading: false, err: null };

  async function load(monthId) {
    S.monthId = monthId; S.loading = true; S.err = null; draw();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in again to see the Insights.");
      const res = await fetch(`${WORKER}/admin/month-insights?month_id=${encodeURIComponent(monthId)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.error || "Couldn't reach the Insights.");
      if (S.monthId !== monthId) return;
      S.data = d;
    } catch (e) { S.err = e.message || String(e); S.data = null; }
    S.loading = false; draw();
  }

  // Everything the page shows, for the chosen people.
  function work() {
    const D = S.data;
    const inGroup = (p) => S.who === "all" || (S.who === "plus" ? p.plus : !p.plus);
    const people = D.people.map((p, i) => ({ ...p, i, on: inGroup(p), opened: new Set(), copies: new Set(), changed: new Set(), downloaded: new Set(), planned: new Set(), scheduled: new Set(), posted: new Set(), days: new Map(), visited: false }));
    const [yy, mm] = D.month.month.split("-").map(Number);
    const first = D.month.month, last = new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10);
    const touch = (p, day, k, post) => {
      if (!p.days.has(day)) p.days.set(day, { viewed: false, opened: new Set(), finished: false });
      const d = p.days.get(day);
      if (k === "viewed") d.viewed = true; else if (k === "opened") d.opened.add(post); else if (k === "finished") d.finished = true;
    };
    for (const [u, ev, post, at] of D.events) {
      const p = people[u]; if (!p || !p.on) continue;
      const day = dayOf(at);
      if (ev === "month_viewed") { touch(p, day, "viewed"); continue; }
      if (ev === "post_opened" || ev === "design_opened") { p.opened.add(post); touch(p, day, "opened", post); }
      if (ev === "design_opened") p.copies.add(post);
      if (ev === "copy_saved") p.changed.add(post);
      if (ev === "downloaded") { p.downloaded.add(post); touch(p, day, "finished"); }
    }
    for (const [u, post, at, sched, posted] of D.items) {
      const p = people[u]; if (!p || !p.on) continue;
      p.planned.add(post); touch(p, dayOf(at), "finished");
      if (sched) p.scheduled.add(post);
      if (posted) p.posted.add(post);
    }
    for (const [u] of D.visits) { const p = people[u]; if (p) p.visited = true; }
    const on = people.filter((p) => p.on);
    const access = on.filter((p) => p.access);
    const users = on.filter((p) => p.opened.size);
    const finished = (p) => new Set([...p.downloaded, ...p.planned, ...p.scheduled]);

    // Day by day, the month's own days, up to today for the month in progress.
    const today = dayOf(new Date().toISOString());
    const days = [];
    for (let d = new Date(first + "T12:00:00Z"); ; d.setUTCDate(d.getUTCDate() + 1)) {
      const k = d.toISOString().slice(0, 10);
      if (k > last || k > today) break;
      days.push(k);
    }
    const daily = days.map((k) => {
      let n = 0, posts = 0;
      on.forEach((p) => { const d = p.days.get(k); if (d && d.opened.size) { n++; posts += d.opened.size; } });
      return { day: k, n, posts };
    });
    const early = on.filter((p) => [...p.days.keys()].some((k) => k < first && p.days.get(k).opened.size)).length;
    const weeks = [[1, 7], [8, 14], [15, 21], [22, 31]].map(([a, b]) => on.filter((p) => [...p.days.entries()].some(([k, d]) => d.opened.size && k >= first && k <= last && +k.slice(8) >= a && +k.slice(8) <= b)).length);

    // How many designs each person finished.
    const depth = [0, 0, 0, 0, 0];
    users.forEach((p) => { const n = finished(p).size; depth[n === 0 ? 0 : n === 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4]++; });

    // The first visit: the first day they came into the month.
    const firstV = { came: 0, viewOnly: 0, one: 0, more: 0, finished: 0 };
    on.forEach((p) => {
      const ks = [...p.days.keys()].sort(); if (!ks.length) return;
      const d = p.days.get(ks[0]);
      firstV.came++;
      if (!d.opened.size) firstV.viewOnly++; else if (d.opened.size === 1) firstV.one++; else firstV.more++;
      if (d.finished) firstV.finished++;
    });

    // Each design.
    const posts = D.posts.map((post) => {
      const c = (k) => on.filter((p) => p[k].has(post.id)).length;
      return { ...post, opened: c("opened"), copies: c("copies"), changed: c("changed"), downloaded: c("downloaded"), planned: c("planned"), scheduled: c("scheduled"), posted: c("posted") };
    });

    const never = access.filter((p) => !p.opened.size);
    return {
      access: access.length, accessPlus: access.filter((p) => p.plus).length,
      used: users.length, copies: on.reduce((n, p) => n + p.copies.size, 0), changed: on.reduce((n, p) => n + p.changed.size, 0),
      never: never.length, neverVisited: never.filter((p) => p.visited).length,
      funnel: [
        ["Had access", access.length],
        ["Opened a post", users.length],
        ["Made their own copy", on.filter((p) => p.copies.size).length],
        ["Changed their copy", on.filter((p) => p.changed.size).length],
        ["Downloaded or planned", on.filter((p) => p.downloaded.size || p.planned.size).length],
        ["Scheduled or posted", on.filter((p) => p.scheduled.size || p.posted.size).length],
      ],
      daily, early, weeks, depth, firstV, posts,
    };
  }

  /* Columns: one series, wine, 4px rounded tops, a hover tip per column and a
     hit area the full height of the plot (the mock-up's). */
  function columns(el, labels, values, opts = {}) {
    const W = opts.w || 760, H = opts.h || 220, L = 34, R = 8, T = 12, B = 26;
    const max = Math.max(...values, 1), step = Math.max(1, Math.ceil(max / 4)), top = step * 4;
    const pw = (W - L - R) / Math.max(values.length, 1), bw = Math.max(4, pw - (opts.gap ?? 4));
    const y = (v) => T + (H - T - B) * (1 - v / top);
    let g = "";
    for (let k = 0; k <= 4; k++) { const v = step * k, yy = y(v); g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="#eae5e1" stroke-width="1"/><text x="${L - 6}" y="${yy + 4}" text-anchor="end" font-size="12" fill="#7e6765">${v}</text>`; }
    values.forEach((v, i) => {
      const x = L + i * pw + (pw - bw) / 2, yy = y(v), h = H - B - yy, r = Math.min(4, bw / 2, h);
      if (h > 0) g += `<path d="M${x},${H - B} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + bw - r} Q${x + bw},${yy} ${x + bw},${yy + r} V${H - B} Z" fill="#371e28"/>`;
      if (!opts.every || i % opts.every === 0 || i === values.length - 1) g += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="12" fill="#7e6765">${labels[i]}</text>`;
      g += `<rect x="${L + i * pw}" y="${T}" width="${pw}" height="${H - T - B}" fill="transparent" data-i="${i}"/>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || "")}">${g}</svg><div class="ci-tip"></div>`;
    const svg = el.querySelector("svg"), tip = el.querySelector(".ci-tip");
    svg.addEventListener("mousemove", (e) => {
      const r = e.target.closest("[data-i]"); if (!r) { tip.classList.remove("on"); return; }
      const i = +r.dataset.i, sx = svg.getBoundingClientRect().width / W;
      tip.textContent = opts.tip(i, values[i]);
      tip.style.left = (L + i * pw + pw / 2) * sx + "px"; tip.style.top = y(values[i]) * sx + "px"; tip.classList.add("on");
    });
    svg.addEventListener("mouseleave", () => tip.classList.remove("on"));
  }
  const bars = (rows, max) => rows.map(([label, v]) => `<div class="ci-frow"><span>${esc(label)}</span><div class="ci-tr"><div style="width:${max ? Math.min(100, (v / max) * 100) : 0}%"></div></div><b>${v}<small>${pct(v, max)}%</small></b></div>`).join("");
  const fig = (cls, v, label, small) => `<div class="ci-fig ${cls}"><b>${v}</b><span>${esc(label)}</span>${small ? `<small>${esc(small)}</small>` : ""}</div>`;
  const thumb = (p) => p.thumb ? `<span class="ci-th" style="background-image:url('${esc(p.thumb)}')"></span>` : `<span class="ci-th is-none"></span>`;

  function draw() {
    if (S.loading && !S.data) { host.innerHTML = `<p class="cc-note">Working out the figures.</p>`; return; }
    if (S.err) { host.innerHTML = `<p class="cc-note">${esc(S.err)} <button type="button" class="mbtn" data-ci-retry>Try again</button></p>`; return; }
    if (!S.data) { host.innerHTML = ""; return; }
    const D = S.data, X = work();
    const mName = MONTHS[+D.month.month.slice(5, 7) - 1];
    const any = D.events.length || D.items.length;
    const updated = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const lastDay = X.daily.length ? X.daily[X.daily.length - 1].day : null;
    const span = lastDay ? `1 to ${+lastDay.slice(8)} ${mName}` : `${mName} hasn't started yet`;
    const ranked = X.posts.filter((p) => p.thumb || p.copies || p.opened).slice().sort((a, b) => b.copies - a.copies || b.opened - a.opened);
    const row = (p) => `<button type="button" class="ci-drow" data-ci-all>${thumb(p)}<span>${esc(p.title)}<small>${p.opened} opened · ${p.downloaded} downloaded · ${p.planned} planned</small></span><b>${p.copies} ${p.copies === 1 ? "copy" : "copies"}</b></button>`;

    host.innerHTML = `
      ${any ? "" : `<p class="ci-note"><b>Nothing recorded for ${esc(mName)} yet.</b> The usage log started on 17 November 2026. Members' activity shows here as they use the month.</p>`}
      <div class="ci-bar">
        <div class="chips" role="group" aria-label="Who">
          ${[["all", "Everyone with access"], ["cc", "Content Calendar"], ["plus", "Content Calendar Plus"]].map(([k, l]) => `<button type="button" data-ci-who="${k}" aria-pressed="${S.who === k}">${l}</button>`).join("")}
        </div>
        <p class="ci-asof">${esc(span)} · as of ${updated} <button type="button" class="mbtn" data-ci-retry>Refresh</button></p>
      </div>
      <p class="ci-hint"><b>What counts.</b> Opened a post: clicked a day in the calendar and the post popped up. Made a copy: pressed Use This Template. Finished: downloaded it, added it to the planner, or scheduled it. Signing in on its own never counts.</p>
      <div class="ci-figs">
        ${fig("lin", X.access, `Had access to ${mName}`, S.who === "all" ? `${X.access - X.accessPlus} Content Calendar · ${X.accessPlus} Plus` : "")}
        ${fig("lin", X.used, "Used it", `Opened at least one post · ${pct(X.used, X.access)}% of those with access`)}
        ${fig("lin", X.copies, "Copies made", `${X.changed} changed and saved`)}
        ${fig("dark", X.never, `Never opened a ${mName} post`, `${X.neverVisited} signed in and didn't · ${X.never - X.neverVisited} didn't sign in`)}
      </div>
      <div class="ci-card ci-wide">
        <div class="ci-bar" style="margin:0"><div class="ci-h">Members using it, day by day</div><div class="ci-legend"><span><i></i>Members who opened a post</span></div></div>
        <div class="ci-chart" id="ci-daily"></div>
        <p class="ci-hint">Counts each member once a day they open a post.${X.early ? ` ${X.early} member${X.early === 1 ? "" : "s"} opened posts before the 1st.` : ""}</p>
      </div>
      <div class="ci-grid">
        <div class="ci-card"><div class="ci-h">How far people get</div><p>Out of everyone who had the month: how many reached each step with at least one post.</p><div class="ci-funnel">${bars(X.funnel, Math.max(X.access, X.used, 1))}</div></div>
        <div class="ci-card"><div class="ci-h">Coming back</div><p>Members who opened a post in each week of the month. The drop shows when people stop coming back.</p><div class="ci-chart" id="ci-weeks"></div></div>
      </div>
      <div class="ci-grid">
        <div class="ci-card"><div class="ci-h">How many designs each person finishes</div><p>Of the members who opened a post: how many designs each one downloaded, added to the planner or scheduled.</p><div class="ci-chart" id="ci-depth"></div></div>
        <div class="ci-card"><div class="ci-h">The first visit</div><p>What members did the first day they came into the month.</p><div class="ci-funnel">${bars([[`Came into ${mName}`, X.firstV.came], ["Looked at the calendar only", X.firstV.viewOnly], ["Opened one post", X.firstV.one], ["Opened two or more", X.firstV.more], ["Finished one that day", X.firstV.finished]], Math.max(X.firstV.came, 1))}</div></div>
      </div>
      <div class="ci-grid">
        <div class="ci-card"><div class="ci-bar" style="margin:0"><div class="ci-h">Most used</div><button type="button" class="mbtn" data-ci-all>All ${X.posts.length} designs</button></div><div class="ci-dlist">${ranked.slice(0, 5).map(row).join("") || '<p class="cc-note">Nothing yet.</p>'}</div></div>
        <div class="ci-card"><div class="ci-bar" style="margin:0;min-height:30px"><div class="ci-h">Least used</div></div><div class="ci-dlist">${ranked.length > 5 ? ranked.slice(-5).reverse().map(row).join("") : '<p class="cc-note">Shows once there are more than five designs to compare.</p>'}</div></div>
      </div>
      <div id="ci-pop"></div>`;

    const d = X.daily;
    columns(host.querySelector("#ci-daily"), d.map((x) => +x.day.slice(8)), d.map((x) => x.n), { every: 2, aria: `Members opening ${mName} posts each day`, tip: (i, v) => `${+d[i].day.slice(8)} ${mName.slice(0, 3)} · ${v} member${v === 1 ? "" : "s"} · ${d[i].posts} post${d[i].posts === 1 ? "" : "s"} opened` });
    const w = X.weeks, short = mName.slice(0, 3);
    columns(host.querySelector("#ci-weeks"), [`1–7 ${short}`, `8–14 ${short}`, `15–21 ${short}`, `22+ ${short}`], w, { w: 470, h: 210, gap: 22, aria: "Members using the month each week", tip: (i, v) => `${v} member${v === 1 ? "" : "s"}${w[0] ? ` · ${pct(v, w[0])}% of week one` : ""}` });
    const why = ["looked but finished none", "finished one design", "finished 2 to 4", "finished 5 to 9", "finished 10 or more"];
    columns(host.querySelector("#ci-depth"), ["None", "1", "2 to 4", "5 to 9", "10 or more"], X.depth, { w: 470, h: 210, gap: 22, aria: "How many designs each member finished", tip: (i, v) => `${v} member${v === 1 ? "" : "s"} · ${why[i]}` });
    if (S.pop) drawPop(X, mName);
  }

  const COLS = [["title", "Design"], ["opened", "Opened"], ["copies", "Copies made"], ["changed", "Changed"], ["downloaded", "Downloaded"], ["planned", "Added to planner"], ["scheduled", "Scheduled"], ["posted", "Posted"]];
  function drawPop(X, mName) {
    const rows = X.posts.slice().sort((a, b) => S.sort === "title" ? a.title.localeCompare(b.title) : S.sort === "date" ? String(a.date).localeCompare(String(b.date)) : b[S.sort] - a[S.sort]);
    const who = { all: "Everyone with access", cc: "Content Calendar", plus: "Content Calendar Plus" }[S.who];
    const day = (p) => p.date ? new Date(p.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
    host.querySelector("#ci-pop").innerHTML = `<div class="cc-modal" data-ci-scrim><div class="cc-modal-box ci-pop" role="dialog" aria-modal="true" aria-label="Every design" data-lenis-prevent>
      <div class="cc-drawer-bar"><strong>Every design · ${esc(mName)} · ${esc(who)}</strong><button type="button" class="cc-x" data-ci-close aria-label="Close">&times;</button></div>
      <div class="ci-pop-b"><p class="cc-hint">Each figure counts members, once each. Click a heading to sort.</p>
        <div class="tablewrap"><table class="ci-sort"><thead><tr><th></th><th data-ci-sort="date" class="${S.sort === "date" ? "on" : ""}">Day</th>${COLS.map(([k, l]) => `<th data-ci-sort="${k}" class="${k === "title" ? "" : "n"}${S.sort === k ? " on" : ""}">${l}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((p) => `<tr><td>${thumb(p)}</td><td class="tx">${esc(day(p))}</td><td class="ci-name">${esc(p.title)}</td>${COLS.slice(1).map(([k]) => `<td class="n">${p[k]}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      </div>
      <div class="cc-modal-foot ci-pop-f"><button type="button" class="mbtn" data-ci-csv>Export</button><button type="button" class="mbtn primary" data-ci-close>Done</button></div>
    </div></div>`;
  }

  function csv() {
    const X = work(), D = S.data;
    const head = ["Day", ...COLS.map(([, l]) => l)];
    const lines = [head, ...X.posts.map((p) => [p.date || "", p.title, p.opened, p.copies, p.changed, p.downloaded, p.planned, p.scheduled, p.posted])]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = `Content Calendar ${D.month.month.slice(0, 7)} ${D.month.edition} insights.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  host.addEventListener("click", (e) => {
    const c = (s) => e.target.closest(s); let b;
    if ((b = c("[data-ci-who]"))) { S.who = b.dataset.ciWho; draw(); return; }
    if (c("[data-ci-retry]")) { load(S.monthId); return; }
    if ((b = c("[data-ci-sort]"))) { S.sort = b.dataset.ciSort; draw(); return; }
    if (c("[data-ci-csv]")) { csv(); return; }
    if (c("[data-ci-close]") || e.target.matches("[data-ci-scrim]")) { S.pop = false; host.querySelector("#ci-pop").innerHTML = ""; return; }
    if (c("[data-ci-all]")) { S.pop = true; draw(); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.pop) { S.pop = false; const p = host.querySelector("#ci-pop"); if (p) p.innerHTML = ""; } });

  return {
    show(monthId) { if (monthId !== S.monthId || !S.data) { S.data = null; S.pop = false; load(monthId); } else draw(); },
  };
}
