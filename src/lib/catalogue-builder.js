/* The Catalogue as a pack builder (Danielle, 12 Nov 2026).
 *
 * Packs open on boxes, three to a row; each pack is built in five steps, the
 * Content Calendar's way: Initial planning, Creation, Prompts and guidance,
 * Final checks, then the Shop listing (what the pack editor used to hold).
 * Agreed on the mock-up at docs/tmke-os/catalogue/index.html.
 *
 * Tables: pack_plans, pack_plan_rows, packs.test_user_ids
 * (supabase/catalogue_builder.sql). A pack with no pack_plans row is a pack
 * made before this page: it opens on its Shop listing, and its designs become
 * plan rows the first time it's opened.
 *
 * Mounted by src/pages/admin/packs.astro, which keeps the Demo pack, Hub
 * notifications, Insights and Gift and hands them in through ctx.
 */
import { BRAND_ORDER, brandRank } from "../data/brands.js";
import { PILLARS } from "./content-months.js";

const PACK_IMAGES_BUCKET = "pack-images";
const STAGES = [[1, "Initial planning"], [2, "Creation"], [3, "Prompts and guidance"], [4, "Final checks"], [5, "Shop listing"]];
const TYPES = { single: "Single image", carousel: "Carousel", story: "Story", reel: "Reel" };
const CATEGORIES = ["On the Market", "Educate and Inform", "Behind the Brand", "In Season", "Local Life", "Service and Standards", "Starter Pack", "Complimentary"];
const TPL_COLS = "id, name, thumb_url, status, canvas, pages, pack_id, sort_order, collection";
const COPY_COLS = "id, name, category, thumb_url, render_url, canvas, elements, pages, size_variants, status, kind, block_variant, block_box";
const GRIP = '<svg viewBox="0 0 10 16" aria-hidden="true"><circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/></svg>';

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tplId = () => "tmpl-" + Math.random().toString(36).slice(2, 8);
const slugify = (s) => String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "pack";
const dayLabel = (iso) => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }) : ""; };

export function initBuilder(ctx) {
  const { supabase, rebuildSite, toast, openGift, openResults, gbpFromPence } = ctx;
  const $ = (id) => document.getElementById(id);
  const main = $("pb-main"), pop = $("pb-pop");

  const url = new URL(location.href);
  const S = {
    kind: url.searchParams.get("kind") === "print" ? "print" : "social",
    show: "all",
    packId: url.searchParams.get("pack") || null,
  };
  let PACKS = [], PLANS = new Map(), ROWS = [], TPL = new Map(), COUNTS = new Map(), MISSING = false;
  let PLAN_COUNTS = new Map();

  /* ---------------- Loading ---------------- */
  async function loadAll() {
    const [packsRes, plansRes, rowsRes] = await Promise.all([
      supabase.from("packs").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false }),
      supabase.from("pack_plans").select("pack_id, stage, about"),
      supabase.from("pack_plan_rows").select("pack_id, template_id"),
    ]);
    if (packsRes.error) { main.innerHTML = `<p class="pb-state">Couldn't load the packs: ${esc(packsRes.error.message)}</p>`; return false; }
    PACKS = (packsRes.data || []).filter((p) => p.demo !== true);
    ctx.setPacks(packsRes.data || []);
    MISSING = !!plansRes.error;
    PLANS = new Map((plansRes.data || []).map((p) => [p.pack_id, p]));
    PLAN_COUNTS = new Map();
    (rowsRes.data || []).forEach((r) => {
      const c = PLAN_COUNTS.get(r.pack_id) || { n: 0, made: 0 };
      c.n++; if (r.template_id) c.made++;
      PLAN_COUNTS.set(r.pack_id, c);
    });
    // How many designs each pack has, paged past the 1,000-row cap.
    COUNTS = new Map();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("templates").select("pack_id").not("pack_id", "is", null).range(from, from + 999);
      if (error || !data) break;
      data.forEach((t) => COUNTS.set(t.pack_id, (COUNTS.get(t.pack_id) || 0) + 1));
      if (data.length < 1000) break;
    }
    return true;
  }

  const packOf = (id) => PACKS.find((p) => p.id === id);
  const stageOf = (p) => (PLANS.get(p.id) ? PLANS.get(p.id).stage : 5);
  const isLive = (p) => p.status === "active";
  const isBuilding = (p) => !isLive(p) && p.status !== "archived";

  function setUrl() {
    const u = new URL(location.href);
    if (S.kind === "print") u.searchParams.set("kind", "print"); else u.searchParams.delete("kind");
    if (S.packId) u.searchParams.set("pack", S.packId); else u.searchParams.delete("pack");
    history.replaceState(null, "", u);
  }

  function priceLabel(p) {
    if (p.access === "brands") return "Their brands, free";
    if (p.access === "members") return "Free to members";
    return gbpFromPence(p.price_pence);
  }

  /* ---------------- The packs ---------------- */
  let homeSortable = null;
  function drawHome() {
    const list = PACKS.filter((p) => (p.kind || "social") === S.kind).filter((p) =>
      S.show === "all" ? p.status !== "archived" : S.show === "progress" ? isBuilding(p) : S.show === "live" ? isLive(p) : p.status === "archived");
    const chip = (p) => isLive(p) ? '<span class="chip good">Live</span>'
      : p.status === "archived" ? '<span class="chip wait">Out of the shop</span>'
      : PLANS.get(p.id) ? `<span class="chip plain">Stage ${PLANS.get(p.id).stage} of 5</span>` : '<span class="chip plain">Draft</span>';
    const card = (p) => {
      const pc = PLAN_COUNTS.get(p.id);
      const rows = isLive(p) || p.status === "archived"
        ? [[isLive(p) ? "Live since" : "Created", dayLabel(p.launched_at || p.created_at)], ["Designs", COUNTS.get(p.id) || 0], ["Price", priceLabel(p)]]
        : [["Step", STAGES[stageOf(p) - 1][1]], ["Designs made", pc ? `${pc.made} of ${pc.n}` : String(COUNTS.get(p.id) || 0)], ["Price", priceLabel(p)]];
      return `<button type="button" class="pb-card" data-pack="${esc(p.id)}">${p.cover_image_url ? `<img src="${esc(p.cover_image_url)}" alt="" loading="lazy">` : ""}<div class="pb-card-h"><div><div class="pb-card-t">${esc(p.title)}</div><div class="pb-card-k">${p.kind === "print" ? "Print pack" : "Social pack"}</div></div>${chip(p)}</div><dl>${rows.map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join("")}</dl></button>`;
    };
    const pressed = (k, v) => `aria-pressed="${S[k] === v}"`;
    main.innerHTML = `${MISSING ? '<div class="pb-missing"><p><strong>The pack builder\'s tables aren\'t in the database yet.</strong></p><p>Run <code>supabase/catalogue_builder.sql</code> in the Supabase SQL editor, then reload this page. Until then packs open on their Shop listing.</p></div>' : ""}
    <div class="pb-bar">
      <div class="chips" role="group" aria-label="Kind"><button type="button" data-kind="social" ${pressed("kind", "social")}>Social</button><button type="button" data-kind="print" ${pressed("kind", "print")}>Print</button></div>
      <div class="chips" role="group" aria-label="Show"><button type="button" data-show="all" ${pressed("show", "all")}>All</button><button type="button" data-show="progress" ${pressed("show", "progress")}>Being made</button><button type="button" data-show="live" ${pressed("show", "live")}>Live</button><button type="button" data-show="archived" ${pressed("show", "archived")}>Out of the shop</button></div>
      <div class="pb-acts"><button type="button" class="mbtn primary" data-new>Start new pack</button></div>
    </div>
    <div class="pb-cards" id="pb-cards">${list.map(card).join("") || `<div class="pb-empty">${S.show === "all" ? "No packs here yet. Start new pack makes one." : "None here."}</div>`}</div>
    ${S.show === "all" && list.length > 1 ? '<p class="pb-hint pb-foot">Drag a box to change the order packs show in the shop and the Studio.</p>' : ""}`;
    if (homeSortable) { homeSortable.destroy(); homeSortable = null; }
    const Sortable = window.Sortable;
    if (Sortable && S.show === "all" && list.length > 1) {
      homeSortable = Sortable.create($("pb-cards"), { animation: 180, draggable: ".pb-card", ghostClass: "sortable-ghost", onEnd: saveHomeOrder });
    }
  }
  async function saveHomeOrder() {
    const ids = [...document.querySelectorAll("#pb-cards [data-pack]")].map((el) => el.dataset.pack);
    // Keep the shown packs in the slots they already held, so packs of the
    // other kind (and those out of the shop) keep theirs.
    const slots = ids.map((id) => packOf(id).sort_order ?? 0).sort((a, b) => a - b);
    const res = await Promise.all(ids.map((id, i) => { packOf(id).sort_order = slots[i]; return supabase.from("packs").update({ sort_order: slots[i] }).eq("id", id); }));
    const bad = res.filter((r) => r.error).length;
    if (bad) { toast(`Couldn't save the order (${bad} failed). Reload to see it as it is.`); return; }
    const m = await rebuildSite(supabase);
    toast("Order saved." + (m ? " " + m : ""));
  }

  /* ---------------- One pack ---------------- */
  let P = null, PLAN = null;
  async function openPack(id) {
    S.packId = id; setUrl();
    P = packOf(id);
    if (!P) { S.packId = null; setUrl(); return drawHome(); }
    main.innerHTML = '<p class="pb-state">Opening the pack…</p>';
    window.scrollTo(0, 0);
    PLAN = PLANS.get(id) || null;
    ROWS = [];
    if (!MISSING) {
      const { data, error } = await supabase.from("pack_plan_rows").select("*").eq("pack_id", id).order("sort_order", { ascending: true });
      if (!error) ROWS = data || [];
    }
    await loadTemplates();
    // A pack made before the builder: its designs become its rows.
    if (!MISSING && !ROWS.length) {
      const mine = [...TPL.values()].filter((t) => t.pack_id === id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      if (mine.length) {
        const done = isLive(P);
        const ins = mine.map((t, i) => ({ pack_id: id, sort_order: i, idea: t.name, post_type: "single", template_id: t.id, fields_ok: done, preview_ok: done, member_ok: done }));
        const { data, error } = await supabase.from("pack_plan_rows").insert(ins).select("*");
        if (!error) ROWS = data || [];
      }
    }
    if (MISSING) ROWS = [...TPL.values()].filter((t) => t.pack_id === id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((t, i) => ({ id: "v" + i, template_id: t.id, idea: t.name, post_type: "single" }));
    drawPack();
  }
  async function loadTemplates() {
    TPL = new Map();
    const ids = ROWS.map((r) => r.template_id).filter(Boolean);
    const [a, b] = await Promise.all([
      supabase.from("templates").select(TPL_COLS).eq("pack_id", P.id),
      ids.length ? supabase.from("templates").select(TPL_COLS).in("id", ids) : Promise.resolve({ data: [] }),
    ]);
    [...(a.data || []), ...(b.data || [])].forEach((t) => TPL.set(t.id, t));
  }
  const tplFor = (r) => (r && r.template_id ? TPL.get(r.template_id) : null);
  const capOf = (t) => { const c = (t && (t.canvas || (t.pages && t.pages[0] && t.pages[0].canvas))) || {}; return c.captionPrompt || ""; };
  const aiOf = (t) => { const c = (t && t.pages && t.pages[0] && t.pages[0].canvas) || (t && t.canvas) || {}; return c.aiHelper || null; };
  const thumb = (r, big) => { const t = tplFor(r); return t && t.thumb_url ? `<span class="pb-thumb${big ? " big" : ""}" style="background-image:url('${esc(t.thumb_url)}')"></span>` : t ? `<span class="pb-thumb${big ? " big" : ""} none">${esc((t.name || "").slice(0, 1))}</span>` : `<span class="pb-thumb${big ? " big" : ""} none">+</span>`; };
  const cnt = (f) => ROWS.filter(f).length;
  const stage = () => (PLAN ? PLAN.stage : 5);

  async function setStage(n) {
    if (MISSING) return toast("Run supabase/catalogue_builder.sql first.");
    n = Math.max(1, Math.min(5, n));
    const was = PLAN;
    PLAN = { pack_id: P.id, stage: n, about: (PLAN && PLAN.about) || null };
    PLANS.set(P.id, PLAN);
    drawPack();
    const { error } = await supabase.from("pack_plans").upsert({ pack_id: P.id, stage: n, about: PLAN.about, updated_at: new Date().toISOString() });
    if (error) { PLAN = was; if (was) PLANS.set(P.id, was); else PLANS.delete(P.id); drawPack(); toast("Couldn't save the step: " + error.message); }
  }

  function timeline() {
    const n = STAGES.length, st = stage(), fill = (st - 1) / (n - 1) * 100;
    return `<div class="pb-tl"><div class="pb-tl-track"><div style="width:${fill}%"></div></div>${STAGES.map(([s, l], i) => `<button type="button" class="pb-tl-step${i === 0 ? " first" : ""}${i === n - 1 ? " last" : ""}${s <= st ? " done" : ""}${s === st ? " cur" : ""}" style="left:${i / (n - 1) * 100}%" data-stage="${s}"><span class="pb-tl-dot"></span><span>${l}</span></button>`).join("")}</div>`;
  }
  function callout() {
    const n = ROWS.length, st = stage(), item = (ok, t) => `<li class="${ok ? "ok" : ""}">${t}</li>`;
    const box = (title, items, acts, hint) => `<div class="pb-call"><div><h4>${title}</h4><ul>${items.join("")}</ul>${hint ? `<p>${hint}</p>` : ""}</div><div class="pb-call-acts">${acts}</div></div>`;
    const copy = '<button type="button" class="mbtn" data-copy>Copy designs from another pack</button>';
    const add = '<button type="button" class="mbtn" data-add>Add a design</button>';
    const set = '<button type="button" class="mbtn" data-set>See them together</button>';
    if (st === 1) {
      const planned = cnt((r) => (r.idea || "").trim());
      return box("Initial planning", [item(!!(PLAN && PLAN.about), "What the pack is about"), item(n > 0 && planned === n, `${planned} of ${n} designs planned`)], add + copy, "A row for each design the pack will have: its name, content pillar, format and a note for whoever makes it.");
    }
    if (st === 2) {
      const made = cnt((r) => r.template_id);
      return box("Creation", [item(n > 0 && made === n, `${made} of ${n} designs made`)], add + copy + set, "Make each design in the Studio, choose one you already have, or copy one from another pack or a Content Calendar month.");
    }
    if (st === 3) {
      const f = cnt((r) => r.fields_ok), c = cnt((r) => capOf(tplFor(r))), a = cnt((r) => aiOf(tplFor(r)) && aiOf(tplFor(r)).on);
      return box("Prompts and guidance", [item(n > 0 && f === n, `${f} of ${n} with editing fields set up`), item(true, `${c} with a caption prompt (optional)`), item(true, `AI helper on ${a} design${a === 1 ? "" : "s"}`)], "", "Each design's editing fields are what members fill in on the Edit tab, so every text box needs naming. The caption prompt and AI helper are optional and come from the design itself: change them in the Studio and they show here.");
    }
    if (st === 4) {
      const t = cnt((r) => r.preview_ok), m = cnt((r) => r.member_ok);
      const sent = (P.test_user_ids || []).length > 0;
      const acts = isLive(P) ? '<button type="button" class="mbtn primary" data-gift>Gift the pack</button>'
        : sent ? '<a class="mbtn" href="/account/studio" target="_blank" rel="noopener">Open the Studio</a><button type="button" class="mbtn" data-test="0">Take the test pack back</button>'
        : '<button type="button" class="mbtn primary" data-test="1">Send me the test pack</button>';
      const lead = isLive(P) ? "It's live, so it's already in the Studio for everyone it's for. Gift the pack puts it in someone's library for free, such as another admin. "
        : sent ? "Sent to your test login: it's in that account's Studio as a test pack, and nobody else can see it. "
        : "Send me the test pack puts just this pack in your test login's Studio, so you can try every design as a member before it goes in the shop. ";
      return box("Final checks", [item(n > 0 && t === n, `${t} of ${n} previews made`), item(n > 0 && m === n, `${m} of ${n} tested as a member`)], acts + set, lead + "Preview made: the design has been saved, so its preview picture in the Studio and the shop is up to date. Tested as a member: opened on the test login and edited the way an agent would, so the brand kit fills in, photos swap and the words fit.");
    }
    const live = isLive(P);
    return box("Shop listing", [item(!!P.cover_image_url, "Cover image"), item(P.access !== "buy" || (P.price_pence || 0) > 0, "Price"), item(!!(P.description || "").trim(), "Description"), item(cnt((r) => r.template_id) > 0, "Designs in order")],
      live ? '<button type="button" class="mbtn primary" data-save>Save changes</button><button type="button" class="mbtn" data-unpublish>Take out of the shop</button>'
        : '<button type="button" class="mbtn" data-save>Save</button><button type="button" class="mbtn primary" data-publish>Publish to the shop</button>',
      "Everything buyers see. The words down the left; the cover, hover gallery and preview order down the right.");
  }
  function table() {
    const st = stage(), yes = (v) => `<span class="pb-tick${v ? " ok" : ""}"></span>`;
    const grip = '<td class="pb-grip-cell"><span class="pb-grip" title="Drag to change the order">' + GRIP + "</span></td>";
    let head, body;
    if (st === 1) {
      head = "<th></th><th>#</th><th>Design</th><th>Content pillar</th><th>Format</th><th>Note</th>";
      body = ROWS.map((r, i) => `<tr data-row="${esc(r.id)}">${grip}<td class="pb-num">${i + 1}</td><td>${esc(r.idea) || '<span class="pb-tx">Untitled</span>'}</td><td>${esc(r.pillar) || '<span class="pb-tx">None</span>'}</td><td>${TYPES[r.post_type] || "Single image"}</td><td class="pb-note">${esc(r.note) || '<span class="pb-tx">None</span>'}</td></tr>`);
    } else if (st === 2) {
      head = "<th></th><th>#</th><th></th><th>Design</th><th>Format</th><th>Made</th>";
      body = ROWS.map((r, i) => `<tr data-row="${esc(r.id)}">${grip}<td class="pb-num">${i + 1}</td><td>${thumb(r)}</td><td>${esc(r.idea) || '<span class="pb-tx">Untitled</span>'}${r.copied_from ? `<small>Copied from ${esc(r.copied_from)}</small>` : ""}</td><td>${TYPES[r.post_type] || "Single image"}</td><td>${r.template_id ? '<span class="chip good">Made</span>' : '<span class="chip wait">To make</span>'}</td></tr>`);
    } else if (st === 3) {
      head = "<th>#</th><th></th><th>Design</th><th>Editing fields</th><th>Caption prompt <span class='pb-tx'>(optional)</span></th><th>AI helper</th>";
      body = ROWS.map((r, i) => { const t = tplFor(r), ai = aiOf(t); return `<tr data-row="${esc(r.id)}"><td class="pb-num">${i + 1}</td><td>${thumb(r)}</td><td>${esc(r.idea)}</td><td>${yes(r.fields_ok)}</td><td class="pb-note">${esc(capOf(t)) || '<span class="pb-tx">None</span>'}</td><td>${ai && ai.on ? '<span class="chip plain">On</span>' : '<span class="chip off">Off</span>'}</td></tr>`; });
    } else {
      head = "<th>#</th><th></th><th>Design</th><th>Preview made</th><th>Tested as a member</th><th></th>";
      body = ROWS.map((r, i) => { const ok = r.preview_ok && r.member_ok; return `<tr data-row="${esc(r.id)}"><td class="pb-num">${i + 1}</td><td>${thumb(r)}</td><td>${esc(r.idea)}</td><td>${yes(r.preview_ok)}</td><td>${yes(r.member_ok)}</td><td>${ok ? '<span class="chip good">Ready</span>' : '<span class="chip wait">To check</span>'}</td></tr>`; });
    }
    return `<div class="pb-tablewrap" data-lenis-prevent><table class="pb-table"><thead><tr>${head}</tr></thead><tbody id="pb-rows">${body.join("") || `<tr class="pb-norow"><td colspan="6">No designs yet. Add one, or copy some from another pack.</td></tr>`}</tbody></table></div>`;
  }

  function drawPack() {
    if (!P) return;
    const st = stage(), made = cnt((r) => r.template_id), live = isLive(P);
    const back = st > 1 ? '<button type="button" class="pb-vbtn" data-step="-1">Move back a step</button>' : "";
    const next = st < 5 ? `<button type="button" class="pb-vbtn primary" data-step="1">Next: ${STAGES[st][1]} →</button>` : "";
    const tag = live ? `Live since ${dayLabel(P.launched_at || P.created_at)}` : P.status === "archived" ? "Out of the shop" : "Draft";
    main.innerHTML = `<button type="button" class="pb-back" data-home>&lsaquo; All packs</button>
    <div class="pb-banner"${P.cover_image_url ? ` style="background-image:url('${esc(P.cover_image_url)}')"` : ""}>
      <div class="pb-tags"><span>${esc(tag)}</span><span>${P.kind === "print" ? "Print pack" : "Social pack"}</span><span>Stage ${st} of 5</span>${(P.test_user_ids || []).length ? "<span>Test pack sent</span>" : ""}</div>
      <div class="pb-ban-row"><div><h2>${esc(P.title)}</h2><p>${ROWS.length} design${ROWS.length === 1 ? "" : "s"} planned · ${made} made</p></div>
        <div class="pb-ban-acts">${live ? '<button type="button" class="pb-vbtn" data-insights>Insights</button><button type="button" class="pb-vbtn primary" data-gift>Gift the pack</button>'
          : `<button type="button" class="pb-vbtn" data-delete>Delete pack</button>${back}${next}`}</div></div>
    </div>
    <div class="pb-prog">${timeline()}${callout()}</div>
    ${st === 1 ? `<label class="pb-about"><span>About this pack</span><textarea id="pb-about" rows="2" placeholder="A line or two about the pack: what it's for and when.">${esc(PLAN && PLAN.about)}</textarea></label>` : ""}
    ${st === 5 ? listing() : table()}`;
    wireRows();
    if (st === 5) wireListing();
  }

  let rowSortable = null;
  function wireRows() {
    if (rowSortable) { rowSortable.destroy(); rowSortable = null; }
    const tb = $("pb-rows"), Sortable = window.Sortable;
    if (tb && Sortable && stage() <= 2 && ROWS.length > 1 && !MISSING) {
      rowSortable = Sortable.create(tb, { animation: 160, handle: ".pb-grip", ghostClass: "sortable-ghost", onEnd: () => saveRowOrder([...tb.querySelectorAll("[data-row]")].map((el) => el.dataset.row)) });
    }
  }
  /* One order: the rows', which is also the designs' order in the shop and
     the Studio (templates.sort_order). */
  async function saveRowOrder(ids) {
    ROWS = ids.map((id) => ROWS.find((r) => r.id === id)).filter(Boolean);
    ROWS.forEach((r, i) => { r.sort_order = i; });
    drawPack();
    const jobs = ROWS.map((r, i) => supabase.from("pack_plan_rows").update({ sort_order: i }).eq("id", r.id));
    ROWS.filter((r) => r.template_id).forEach((r, i) => jobs.push(supabase.from("templates").update({ sort_order: i }).eq("id", r.template_id)));
    const bad = (await Promise.all(jobs)).filter((x) => x.error).length;
    if (bad) toast(`Couldn't save the order (${bad} failed).`);
  }

  /* ---------------- Rows ---------------- */
  async function addRow(fields = {}) {
    if (MISSING) return toast("Run supabase/catalogue_builder.sql first.");
    const row = { pack_id: P.id, sort_order: ROWS.length, idea: "", post_type: "single", ...fields };
    const { data, error } = await supabase.from("pack_plan_rows").insert(row).select("*").single();
    if (error) { toast("Couldn't add it: " + error.message); return null; }
    ROWS.push(data);
    if (!PLAN) await setStage(stage());
    drawPack();
    return data;
  }
  /* Edits to a row wait half a second and go together, so typing the name
     then the note saves both (it used to save only the last one). */
  const saveTimers = new Map(), pending = new Map();
  async function flushRow(id) {
    clearTimeout(saveTimers.get(id)); saveTimers.delete(id);
    let patch = pending.get(id); pending.delete(id);
    if (!patch) return;
    let { error } = await supabase.from("pack_plan_rows").update(patch).eq("id", id);
    // Before supabase/catalogue_builder_pillar.sql has run there's no pillar.
    if (error && /pillar/.test(error.message || "") && "pillar" in patch) {
      const { pillar, ...rest } = patch; patch = rest;
      if (Object.keys(rest).length) ({ error } = await supabase.from("pack_plan_rows").update(rest).eq("id", id));
      else error = null;
      toast("The pillar can't be saved until supabase/catalogue_builder_pillar.sql has run.");
    }
    if (error) toast("Couldn't save: " + error.message);
  }
  function patchRow(r, patch, now) {
    Object.assign(r, patch);
    pending.set(r.id, { ...(pending.get(r.id) || {}), ...patch });
    clearTimeout(saveTimers.get(r.id));
    if (now) flushRow(r.id); else saveTimers.set(r.id, setTimeout(() => flushRow(r.id), 500));
  }
  const flushAll = () => Promise.all([...pending.keys()].map(flushRow));

  function openRow(id) {
    const i = ROWS.findIndex((r) => r.id === id);
    if (i < 0 || MISSING) return;
    const r = ROWS[i], st = stage(), t = tplFor(r);
    let b = "";
    if (st <= 2) b += `<label class="pb-field"><span>Design name</span><input data-f="idea" value="${esc(r.idea)}" placeholder="e.g. Christmas countdown"></label>
      <div class="pb-two"><label class="pb-field"><span>Content pillar</span><select data-f="pillar"><option value="">Choose a pillar</option>${PILLARS.map((x) => `<option${x === r.pillar ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></label><label class="pb-field"><span>Format</span><select data-f="post_type">${Object.entries(TYPES).map(([k, l]) => `<option value="${k}"${k === r.post_type ? " selected" : ""}>${l}</option>`).join("")}</select></label></div>`;
    if (st >= 2) {
      b += `<div class="pb-dz">${t && t.thumb_url ? `<div class="pb-dz-pic" style="background-image:url('${esc(t.thumb_url)}')"></div>` : `<div class="pb-dz-pic none">${t ? esc(t.name) : "No design yet"}</div>`}
        <div class="pb-dz-r"><p class="pb-hint">${!t ? "Make it in the Studio, choose one you already have, or copy one from another pack." : r.copied_from ? `${esc(t.name)}. Copied from ${esc(r.copied_from)}; changes here don't touch the original.` : esc(t.name)}</p>
        <div class="pb-dz-acts">${!t ? '<button type="button" class="mbtn primary" data-make>Create a design</button><button type="button" class="mbtn" data-choose>Choose a design</button><button type="button" class="mbtn" data-copy>Copy from another pack</button>'
          : `<a class="mbtn primary" href="/account/editor?id=${encodeURIComponent(t.id)}&mode=admin">Open in the Studio</a><button type="button" class="mbtn" data-unlink>Choose a different one</button>`}</div></div></div>`;
    }
    b += `<label class="pb-field"><span>Note <em>(team only)</em></span><textarea data-f="note" rows="3" placeholder="Anything whoever makes it needs to know">${esc(r.note)}</textarea></label>`;
    if (st === 3) {
      const ai = aiOf(t);
      b += `<label class="pb-check"><input type="checkbox" data-f="fields_ok"${r.fields_ok ? " checked" : ""}> Editing fields set up: every text box named, the way members see it on the Edit tab</label>
      <div class="pb-field"><span>Caption prompt <em>(optional, from the design)</em></span><p class="pb-ro">${esc(capOf(t)) || "None on this design."}</p></div>
      <div class="pb-field"><span>AI helper <em>(from the design)</em></span><p class="pb-ro">${ai && ai.on ? "On." + (ai.brief ? " " + esc(ai.brief) : "") : "Off."}</p></div>
      <p class="pb-hint">To change the caption prompt or the AI helper, open the design in the Studio. What you save there shows here.</p>`;
    }
    if (st === 4) b += `<label class="pb-check"><input type="checkbox" data-f="preview_ok"${r.preview_ok ? " checked" : ""}> Preview made: saved, so its picture in the Studio and the shop is up to date</label><label class="pb-check"><input type="checkbox" data-f="member_ok"${r.member_ok ? " checked" : ""}> Tested as a member: opened on the test login and edited as an agent would</label>`;
    const foot = `<button type="button" class="mbtn" data-remove style="margin-right:auto">Remove from pack</button>${st === 3 && t ? `<a class="mbtn" href="/account/editor?id=${encodeURIComponent(t.id)}&mode=admin">Open in the Studio</a>` : ""}<button type="button" class="mbtn" data-go="${i - 1}"${i ? "" : " disabled"}>&lsaquo; Previous</button><button type="button" class="mbtn" data-go="${i + 1}"${i < ROWS.length - 1 ? "" : " disabled"}>Next &rsaquo;</button><button type="button" class="mbtn primary" data-close>Done</button>`;
    showPop(esc(r.idea || "Untitled design"), `Design ${i + 1} of ${ROWS.length} · ${STAGES[st - 1][1]}`, b, foot);
    pop.dataset.row = r.id;
  }
  const openRowObj = () => ROWS.find((r) => r.id === pop.dataset.row);

  async function makeDesign(r) {
    const tall = r.post_type === "story" || r.post_type === "reel";
    const id = tplId(), name = (r.idea || "").trim() || "Untitled design";
    const { error } = await supabase.from("templates").insert({
      id, name, category: null, thumb_url: null, pack_id: P.id,
      canvas: { width: 1080, height: tall ? 1920 : 1350, background: "#f4f2f1", sizeChosen: true },
      elements: [], status: "draft", sort_order: ROWS.indexOf(r),
    });
    if (error) return toast("Couldn't create the design: " + error.message);
    patchRow(r, { template_id: id }, true);
    location.href = `/account/editor?id=${encodeURIComponent(id)}&mode=admin&title=${encodeURIComponent(name)}`;
  }
  async function unlink(r) {
    const t = tplFor(r);
    patchRow(r, { template_id: null, copied_from: null }, true);
    if (t && t.pack_id === P.id) await supabase.from("templates").update({ pack_id: null }).eq("id", t.id);
    toast("Taken out of this pack. The design stays in the Design studio.");
    drawPack(); openRow(r.id);
  }
  async function removeRow(r) {
    const t = tplFor(r);
    const { error } = await supabase.from("pack_plan_rows").delete().eq("id", r.id);
    if (error) return toast("Couldn't remove it: " + error.message);
    if (t && t.pack_id === P.id) await supabase.from("templates").update({ pack_id: null }).eq("id", t.id);
    ROWS = ROWS.filter((x) => x.id !== r.id);
    closePop(); drawPack();
    toast(t ? "Removed from the pack. The design stays in the Design studio." : "Removed.");
  }

  /* Choose a design that isn't in a pack yet. */
  async function openChoose(r) {
    showPop("Choose a design", "Designs not in a pack", '<p class="pb-hint">Loading…</p>', '<button type="button" class="mbtn" data-close>Cancel</button>', true);
    const { data } = await supabase.from("templates").select("id, name, thumb_url, status, collection").is("pack_id", null).neq("status", "archived").order("updated_at", { ascending: false }).limit(300);
    const list = (data || []).filter((t) => t.collection !== "calendar");
    const body = pop.querySelector(".pb-pop-b");
    body.innerHTML = `<input type="search" class="pb-search" id="pb-choose-q" placeholder="Search…"><p class="pb-hint">Designs already in a pack or a Content Calendar month: use Copy from another pack.</p><div class="pb-pick" id="pb-choose-grid">${list.map((t) => `<button type="button" data-pick="${esc(t.id)}" data-name="${esc((t.name || "").toLowerCase())}"><span class="pb-pick-pic"${t.thumb_url ? ` style="background-image:url('${esc(t.thumb_url)}')"` : ""}></span><span>${esc(t.name)}</span></button>`).join("") || '<p class="pb-hint">No loose designs.</p>'}</div>`;
    pop.dataset.row = r.id;
    pop.dataset.mode = "choose";
  }
  async function choose(r, id) {
    const { error } = await supabase.from("templates").update({ pack_id: P.id, sort_order: ROWS.indexOf(r) }).eq("id", id);
    if (error) return toast("Couldn't add it: " + error.message);
    patchRow(r, { template_id: id }, true);
    await loadTemplates(); closePop(); drawPack(); openRow(r.id);
  }

  /* Copy designs from another pack or a Content Calendar month. Each comes in
     as a copy, so the original stays as it is where it was. */
  let COPY_SRC = [];
  async function openCopy(forRow) {
    showPop("Copy designs from", esc(P.title), '<p class="pb-hint">Loading…</p>', '<button type="button" class="mbtn" data-tickall>Tick all</button><button type="button" class="mbtn primary" data-docopy>Copy designs</button>', true);
    pop.dataset.row = forRow ? forRow.id : "";
    const packs = PACKS.filter((p) => p.id !== P.id && (COUNTS.get(p.id) || 0) > 0).map((p) => ({ id: p.id, title: p.title, group: "Packs" }));
    let months = [];
    try {
      const { data } = await supabase.from("content_months").select("id, month, edition").eq("status", "published").order("month", { ascending: false });
      const multi = new Set((data || []).map((m) => m.edition)).size > 1;
      const ED = { property: "TPE", prestige: "PPE", independent: "Independent", lettings: "TLE" };
      months = (data || []).map((m) => ({ id: "cc:" + m.id, month: m.id, group: "Content Calendar",
        title: new Date(m.month + "T12:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" }) + (multi ? " · " + (ED[m.edition] || m.edition) : "") }));
    } catch (_) {}
    COPY_SRC = [...packs, ...months];
    if (!COPY_SRC.length) { pop.querySelector(".pb-pop-b").innerHTML = '<p class="pb-hint">No other packs or months with designs yet.</p>'; return; }
    drawCopy(COPY_SRC[0].id);
  }
  async function drawCopy(srcId) {
    const src = COPY_SRC.find((s) => s.id === srcId) || COPY_SRC[0];
    const body = pop.querySelector(".pb-pop-b");
    const groups = ["Packs", "Content Calendar"].map((g) => { const o = COPY_SRC.filter((s) => s.group === g); return o.length ? `<optgroup label="${g}">${o.map((s) => `<option value="${esc(s.id)}"${s === src ? " selected" : ""}>${esc(s.title)}</option>`).join("")}</optgroup>` : ""; }).join("");
    body.innerHTML = `<label class="pb-field"><span>From</span><select id="pb-copy-from">${groups}</select></label><p class="pb-hint">Each one comes in as a copy, with its editing fields and caption prompt, so the original stays as it is in ${esc(src.title)}.</p><div class="pb-pick" id="pb-copy-grid"><p class="pb-hint">Loading…</p></div>`;
    let list = [];
    if (src.month) {
      const { data: posts } = await supabase.from("content_month_posts").select("template_id, post_date, sort_order").eq("month_id", src.month).order("post_date").order("sort_order");
      const ids = [...new Set((posts || []).map((p) => p.template_id).filter(Boolean))];
      if (ids.length) { const { data } = await supabase.from("templates").select("id, name, thumb_url").in("id", ids); list = ids.map((id) => (data || []).find((t) => t.id === id)).filter(Boolean); }
    } else {
      const { data } = await supabase.from("templates").select("id, name, thumb_url").eq("pack_id", src.id).order("sort_order");
      list = data || [];
    }
    const grid = $("pb-copy-grid");
    if (grid) grid.innerHTML = list.map((t) => `<label class="pb-pick-l"><span class="pb-pick-pic"${t.thumb_url ? ` style="background-image:url('${esc(t.thumb_url)}')"` : ""}><input type="checkbox" value="${esc(t.id)}"></span><span>${esc(t.name)}</span></label>`).join("") || '<p class="pb-hint">No designs in it.</p>';
    pop.dataset.src = src.id;
  }
  async function doCopy() {
    const src = COPY_SRC.find((s) => s.id === pop.dataset.src);
    const ids = [...pop.querySelectorAll("#pb-copy-grid input:checked")].map((x) => x.value);
    if (!src || !ids.length) return toast("Tick the designs to copy first.");
    const btn = pop.querySelector("[data-docopy]"); if (btn) { btn.disabled = true; btn.textContent = "Copying…"; }
    const { data: tpls, error } = await supabase.from("templates").select(COPY_COLS).in("id", ids);
    if (error) { toast("Couldn't read those designs: " + error.message); if (btn) { btn.disabled = false; btn.textContent = "Copy designs"; } return; }
    const ordered = ids.map((id) => (tpls || []).find((t) => t.id === id)).filter(Boolean);
    const copies = ordered.map((t, i) => {
      const row = { ...t, id: tplId(), pack_id: P.id, status: "draft", sort_order: ROWS.length + i };
      // Names run "Design - Pack - Static": the middle part becomes this pack.
      const parts = String(t.name || "").split(" - ");
      if (parts.length >= 3) { parts[1] = P.title; row.name = parts.join(" - "); }
      Object.keys(row).forEach((k) => { if (row[k] === undefined) delete row[k]; });
      return row;
    });
    const { error: e2 } = await supabase.from("templates").insert(copies);
    if (e2) { toast("Couldn't copy them: " + e2.message); if (btn) { btn.disabled = false; btn.textContent = "Copy designs"; } return; }
    // The open row takes the first copy; the rest get rows of their own.
    const forRow = ROWS.find((r) => r.id === pop.dataset.row && !r.template_id);
    let rest = copies;
    if (forRow) { patchRow(forRow, { template_id: copies[0].id, copied_from: src.title, ...(forRow.idea ? {} : { idea: copies[0].name }) }, true); rest = copies.slice(1); }
    if (rest.length) {
      const ins = rest.map((c, i) => ({ pack_id: P.id, sort_order: ROWS.length + i, idea: c.name, post_type: "single", template_id: c.id, copied_from: src.title }));
      const { data, error: e3 } = await supabase.from("pack_plan_rows").insert(ins).select("*");
      if (e3) toast("The designs were copied, but their rows couldn't be added: " + e3.message);
      else ROWS.push(...(data || []));
    }
    if (!PLAN) await setStage(stage());
    await loadTemplates(); closePop(); drawPack();
    toast(`${copies.length} design${copies.length === 1 ? "" : "s"} copied from ${src.title}.`);
  }

  function openSet() {
    showPop("How the pack looks", esc(P.title), `<p class="pb-hint">In the order members will see them in the Studio. Rows still to make show as gaps.</p><div class="pb-set">${ROWS.map((r) => { const t = tplFor(r); return t && t.thumb_url ? `<div style="background-image:url('${esc(t.thumb_url)}')"></div>` : `<div class="none">${esc(r.idea || (t && t.name) || "To make")}</div>`; }).join("")}</div>`, '<button type="button" class="mbtn primary" data-close>Done</button>', true);
  }

  /* ---------------- Test pack ---------------- */
  async function sendTest(on) {
    let ids = [];
    if (on) {
      const { data, error } = await supabase.from("content_calendar_settings").select("test_user_ids").eq("id", 1).maybeSingle();
      ids = (data && data.test_user_ids) || [];
      if (error || !ids.length) return toast("Add your test login in Content calendar › Overview › Test logins first.");
      // The test login can only open designs that are live.
      const tids = ROWS.map((r) => r.template_id).filter(Boolean);
      if (tids.length) await supabase.from("templates").update({ status: "active" }).in("id", tids);
    }
    const { error } = await supabase.from("packs").update({ test_user_ids: ids }).eq("id", P.id);
    if (error) return toast(/test_user_ids/.test(error.message) ? "Run supabase/catalogue_builder.sql first." : "Couldn't send it: " + error.message);
    P.test_user_ids = ids;
    drawPack();
    toast(on ? `${P.title} is in your test login's Studio. Only that account can see it.` : "Taken back. It's no longer in your test login's Studio.");
  }

  /* ---------------- Delete (a draft only) ---------------- */
  let delArmed = 0;
  async function deletePack(btn) {
    if (Date.now() - delArmed > 4000) { delArmed = Date.now(); btn.textContent = "Press again to delete"; return; }
    const tids = ROWS.map((r) => r.template_id).filter(Boolean);
    const { error } = await supabase.from("packs").delete().eq("id", P.id);
    if (error) return toast("Couldn't delete it: " + error.message);
    if (tids.length) await supabase.from("templates").update({ pack_id: null }).in("id", tids);
    PACKS = PACKS.filter((p) => p.id !== P.id);
    P = null; S.packId = null; setUrl(); drawHome();
    toast("Pack deleted. Its designs stay in the Design studio.");
  }

  /* ---------------- New pack ---------------- */
  function openNew() {
    const opts = PACKS.map((p) => `<option value="${esc(p.id)}">${esc(p.title)}</option>`).join("");
    showPop("Start new pack", "Catalogue", `<label class="pb-field"><span>Name</span><input id="pb-new-name" placeholder="e.g. The Christmas Edit"></label><div class="pb-two"><label class="pb-field"><span>Kind</span><select id="pb-new-kind"><option value="social"${S.kind === "social" ? " selected" : ""}>Social</option><option value="print"${S.kind === "print" ? " selected" : ""}>Print</option></select></label><label class="pb-field"><span>Start from</span><select id="pb-new-from"><option value="">A blank plan</option>${opts}</select></label></div><p class="pb-hint">Starting from another pack brings its rows across as the plan, without the designs. Copy designs in at Creation.</p>`, '<button type="button" class="mbtn primary" data-create>Start pack</button>');
    setTimeout(() => $("pb-new-name") && $("pb-new-name").focus(), 30);
  }
  async function createPack() {
    if (MISSING) return toast("Run supabase/catalogue_builder.sql first.");
    const title = ($("pb-new-name").value || "").trim();
    if (!title) return $("pb-new-name").focus();
    const kind = $("pb-new-kind").value, fromId = $("pb-new-from").value;
    const btn = pop.querySelector("[data-create]"); btn.disabled = true;
    const taken = new Set(PACKS.map((p) => p.slug));
    let slug = slugify(title); while (taken.has(slug)) slug = slugify(title) + "-" + Math.random().toString(36).slice(2, 5);
    const top = Math.min(0, ...PACKS.map((p) => p.sort_order ?? 0)) - 1;
    const { data: pack, error } = await supabase.from("packs").insert({ title, slug, kind, access: kind === "print" ? "brands" : "buy", brands: [], status: "draft", price_pence: 0, contents: [], sort_order: top }).select("*").single();
    if (error) { btn.disabled = false; return toast("Couldn't start it: " + error.message); }
    await supabase.from("pack_plans").insert({ pack_id: pack.id, stage: 1 });
    if (fromId) {
      let src = [];
      const { data: rows } = await supabase.from("pack_plan_rows").select("*").eq("pack_id", fromId).order("sort_order");
      if (rows && rows.length) src = rows;
      else { const { data: t } = await supabase.from("templates").select("name").eq("pack_id", fromId).order("sort_order"); src = (t || []).map((x) => ({ idea: x.name, post_type: "single", note: null })); }
      if (src.length) await supabase.from("pack_plan_rows").insert(src.map((r, i) => ({ pack_id: pack.id, sort_order: i, idea: r.idea, post_type: r.post_type || "single", note: r.note, ...(r.pillar ? { pillar: r.pillar } : {}) })));
    }
    PACKS.unshift(pack); PLANS.set(pack.id, { pack_id: pack.id, stage: 1, about: null });
    S.kind = kind; closePop(); openPack(pack.id);
  }

  /* ---------------- Shop listing ---------------- */
  let L = null;   // the listing being edited
  function listing() {
    if (!L || L.id !== P.id) {
      L = { id: P.id, kind: P.kind || "social", access: P.access || "buy", brands: [...(P.brands || [])], title: P.title || "", slug: P.slug || "", description: P.description || (PLAN && PLAN.about) || "",
        story_heading: P.story_heading || "", story_body: P.story_body || "", contents: (P.contents || []).join("\n"), price: ((P.price_pence || 0) / 100).toFixed(2), category: P.category || "",
        reveal: P.preview_reveal_count ?? 3, cover: P.cover_image_url || "", gallery: Array.isArray(P.preview_images) ? P.preview_images.filter(Boolean) : [],
        from: ymd(P.available_from), until: ymd(P.available_until, true) };
    }
    const sel = (o, v) => o.map(([k, l]) => `<option value="${esc(k)}"${k === v ? " selected" : ""}>${esc(l)}</option>`).join("");
    const brands = [...new Set([...BRAND_ORDER, ...L.brands])].sort((a, b) => brandRank(a) - brandRank(b) || a.localeCompare(b));
    const made = ROWS.filter((r) => tplFor(r));
    const priced = L.kind !== "print" && L.access === "buy";
    return `<div class="pb-shop">
      <div class="pb-col">
        <div class="strip"><span class="strip-t">The pack</span></div>
        <div class="pb-two">
          <label class="pb-field"><span>Kind</span><select data-l="kind">${sel([["social", "Social: posts and stories"], ["print", "Print: boards, brochures, cards"]], L.kind)}</select></label>
          <label class="pb-field"><span>Who gets it</span><select data-l="access">${sel([["buy", "Anyone who buys it"], ["members", "Every member, free"], ["brands", "Only chosen brands"]], L.access)}</select></label>
        </div>
        ${L.access === "brands" ? `<div class="pb-field"><span>Brands</span><div class="pb-brands">${brands.map((b) => `<label class="pb-check"><input type="checkbox" data-brand value="${esc(b)}"${L.brands.includes(b) ? " checked" : ""}> ${esc(b)}</label>`).join("")}</div><p class="pb-hint">Only agents with one of these brands on their profile see the pack.</p></div>` : ""}
        ${L.access === "members" ? `<div class="pb-two"><label class="pb-field"><span>Free from <em>(optional)</em></span><input type="date" data-l="from" value="${esc(L.from)}"></label><label class="pb-field"><span>Free until <em>(optional)</em></span><input type="date" data-l="until" value="${esc(L.until)}"></label></div><p class="pb-hint">A promotional pack, free for a time. It goes live at 8am on the first day with a bell notice, and goes at midnight on the last. Leave both empty to keep it free.</p>` : ""}
        <div class="strip"><span class="strip-t">Basics</span></div>
        <div class="pb-two">
          <label class="pb-field"><span>Title</span><input data-l="title" value="${esc(L.title)}" maxlength="120"></label>
          <label class="pb-field"><span>Slug</span><input data-l="slug" value="${esc(L.slug)}" maxlength="80"></label>
        </div>
        <p class="pb-hint">The slug is the end of the pack's web address. Lowercase, hyphens only.</p>
        <label class="pb-field"><span>Description</span><textarea data-l="description" rows="3" maxlength="500" placeholder="One short paragraph shown on the shop card.">${esc(L.description)}</textarea></label>
        ${L.access === "members" ? '<p class="pb-hint">On a free pack this is also the bell notice: the first line is its heading, the second the smaller text under it.</p>' : ""}
        <label class="pb-field"><span>Story heading</span><input data-l="story_heading" value="${esc(L.story_heading)}" maxlength="160" placeholder="The Autumn Edit takes its cues from the season itself."></label>
        <label class="pb-field"><span>Story</span><textarea data-l="story_body" rows="4" maxlength="1200" placeholder="The idea behind the pack, in a few sentences.">${esc(L.story_body)}</textarea></label>
        <p class="pb-hint">Shown centred under the sliding designs on the pack's shop page, heading first. Leave both empty to show nothing there.</p>
        <label class="pb-field"><span>Contents <em>(one bullet per line)</em></span><textarea data-l="contents" rows="4" placeholder="20 Instagram post templates">${esc(L.contents)}</textarea></label>
        ${L.kind === "print" ? "" : `<div class="strip"><span class="strip-t">Price and category</span></div>
        <div class="pb-three">
          <label class="pb-field"><span>Price (£)</span><input type="number" min="0" step="0.01" data-l="price" value="${priced ? esc(L.price) : "0"}"${priced ? "" : " disabled"}></label>
          <label class="pb-field"><span>Category</span><select data-l="category"><option value="">None</option>${sel(CATEGORIES.map((c) => [c, c]), L.category)}</select></label>
          <label class="pb-field"><span>Unlocked before buying</span><input type="number" min="0" max="24" data-l="reveal" value="${esc(L.reveal)}"></label>
        </div>`}
        <p class="pb-err" id="pb-err" hidden></p>
      </div>
      <div class="pb-col">
        <div class="strip"><span class="strip-t">Cover image</span></div>
        <p class="pb-hint">The first thing buyers see on the shop card.</p>
        <div class="pb-cover"${L.cover ? ` style="background-image:url('${esc(L.cover)}')"` : ""}>${L.cover ? "" : "No image yet"}</div>
        <div class="pb-acts-row"><label class="mbtn"><input type="file" accept="image/*" id="pb-cover-file" hidden>Upload cover</label><button type="button" class="mbtn" data-pickcover>Pick from a design</button>${L.cover ? '<button type="button" class="mbtn" data-nocover>Remove</button>' : ""}<span class="pb-hint" id="pb-up"></span></div>
        <div class="strip"><span class="strip-t">Hover gallery</span></div>
        <p class="pb-hint">Photos that cycle behind the cover when a buyer hovers the card. Drag to reorder.</p>
        <div class="pb-gal" id="pb-gal">${L.gallery.map((u, i) => `<div data-gi="${i}" style="background-image:url('${esc(u)}')"><button type="button" data-ungal="${i}" aria-label="Remove">&times;</button></div>`).join("") || '<p class="pb-hint">No hover photos yet.</p>'}</div>
        <div class="pb-acts-row"><label class="mbtn"><input type="file" accept="image/*" multiple id="pb-gal-file" hidden>Upload photos</label><button type="button" class="mbtn" data-pickgal>Pull from a design</button></div>
        <div class="strip"><span class="strip-t">Preview order</span></div>
        <p class="pb-hint">Drag to reorder. The first ${esc(L.reveal)} show unlocked in the shop; the rest stay locked. The first is the cover when there's no cover image.</p>
        <div class="pb-order" id="pb-order">${made.map((r, i) => { const t = tplFor(r); return `<div class="${i < L.reveal ? "is-shown" : "is-locked"}" data-row="${esc(r.id)}"><b>${i + 1}</b><span class="pb-order-pic"${t.thumb_url ? ` style="background-image:url('${esc(t.thumb_url)}')"` : ""}></span><em>${i < L.reveal ? "Preview" : "Locked"}</em></div>`; }).join("") || '<p class="pb-hint">No designs yet.</p>'}</div>
      </div>
    </div>`;
  }
  function ymd(iso, lastDay) {
    if (!iso) return "";
    const t = Date.parse(iso) - (lastDay ? 1 : 0);
    return isNaN(t) ? "" : new Date(t).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  }
  function londonAtIso(day, addDays = 0, hour = 0) {
    const [y, m, d] = day.split("-").map(Number);
    const base = new Date(Date.UTC(y, m - 1, d + addDays, hour));
    const want = String(hour).padStart(2, "0") + ":00";
    for (const off of [0, 1]) {
      const at = new Date(base.getTime() - off * 3600000);
      if (at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/London" }) === want) return at.toISOString();
    }
    return base.toISOString();
  }
  let galSortable = null, orderSortable = null;
  function wireListing() {
    const Sortable = window.Sortable;
    if (galSortable) galSortable.destroy(); if (orderSortable) orderSortable.destroy();
    galSortable = orderSortable = null;
    if (!Sortable) return;
    if ($("pb-gal") && L.gallery.length > 1) galSortable = Sortable.create($("pb-gal"), { animation: 160, draggable: "[data-gi]", onEnd: () => {
      L.gallery = [...$("pb-gal").querySelectorAll("[data-gi]")].map((el) => L.gallery[+el.dataset.gi]); drawPack(); } });
    if ($("pb-order") && ROWS.length > 1) orderSortable = Sortable.create($("pb-order"), { animation: 160, draggable: "[data-row]", onEnd: () => {
      const shown = [...$("pb-order").querySelectorAll("[data-row]")].map((el) => el.dataset.row);
      const rest = ROWS.filter((r) => !shown.includes(r.id)).map((r) => r.id);
      saveRowOrder([...shown, ...rest]); } });
  }
  async function upload(file, folder) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(PACK_IMAGES_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) { toast("Upload failed: " + error.message); return null; }
    return supabase.storage.from(PACK_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
  }
  function pickImage(forWhat) {
    const made = ROWS.map(tplFor).filter((t) => t && t.thumb_url);
    showPop(forWhat === "cover" ? "Pick the cover" : "Pull into the gallery", "From this pack's designs", `<div class="pb-pick">${made.map((t) => `<button type="button" data-img="${esc(t.thumb_url)}"><span class="pb-pick-pic" style="background-image:url('${esc(t.thumb_url)}')"></span><span>${esc(t.name)}</span></button>`).join("") || '<p class="pb-hint">No design has a preview yet.</p>'}</div>`, '<button type="button" class="mbtn" data-close>Cancel</button>', true);
    pop.dataset.mode = "img-" + forWhat;
  }
  function listingError(msg) { const e = $("pb-err"); if (e) { e.textContent = msg; e.hidden = !msg; if (msg) e.scrollIntoView({ block: "center" }); } else toast(msg); }

  async function saveListing(publish, unpublish) {
    listingError("");
    const title = L.title.trim(), slug = L.slug.trim();
    if (!title) return listingError("The pack needs a title.");
    if (!/^[a-z0-9-]+$/.test(slug)) return listingError("The slug can only have lowercase letters, numbers and hyphens.");
    if (PACKS.some((p) => p.id !== P.id && p.slug === slug)) return listingError("Another pack already uses that slug.");
    if (L.access === "brands" && !L.brands.length) return listingError("Tick at least one brand, or change who gets it.");
    if (L.from && L.until && L.until < L.from) return listingError("Free until can't be before Free from.");
    const priced = L.kind !== "print" && L.access === "buy";
    if (publish && priced && !(Number(L.price) > 0)) return listingError("Set a price before it goes in the shop.");
    const status = unpublish ? "archived" : publish ? "active" : P.status;
    const payload = {
      title, slug, kind: L.kind, access: L.access, brands: L.access === "brands" ? L.brands : [],
      price_pence: priced ? Math.round(Number(L.price || 0) * 100) : 0,
      category: L.kind === "print" ? null : (L.category || null), status,
      description: L.description.trim() || null,
      contents: L.contents.split("\n").map((x) => x.trim()).filter(Boolean),
      cover_image_url: L.cover || null, preview_images: L.gallery,
      preview_reveal_count: Math.max(0, Math.min(24, Number(L.reveal) || 0)),
      story_heading: L.story_heading.trim() || null, story_body: L.story_body.trim() || null,
    };
    if (L.access === "members" || P.available_from || P.available_until) {
      payload.available_from = L.access === "members" && L.from ? londonAtIso(L.from, 0, 8) : null;
      payload.available_until = L.access === "members" && L.until ? londonAtIso(L.until, 1) : null;
    }
    if (publish) payload.test_user_ids = [];
    const btn = main.querySelector(publish ? "[data-publish]" : unpublish ? "[data-unpublish]" : "[data-save]");
    if (btn) { btn.disabled = true; btn.textContent = publish ? "Publishing…" : unpublish ? "Taking it out…" : "Saving…"; }
    const wasFree = P.access === "members";
    const { data, error } = await supabase.from("packs").update(payload).eq("id", P.id).select("*").single();
    if (error) { if (btn) btn.disabled = false; drawPack(); return listingError("Couldn't save: " + error.message); }
    Object.assign(P, data);
    if (publish) {
      try { await supabase.from("packs").update({ launched_at: new Date().toISOString() }).eq("id", P.id).is("launched_at", null); } catch (_) {}
      const tids = ROWS.map((r) => r.template_id).filter(Boolean);
      if (tids.length) await supabase.from("templates").update({ status: "active" }).in("id", tids);
      await saveRowOrder(ROWS.map((r) => r.id));
    }
    let bell = "";
    if (L.access === "members" || wasFree) { try { bell = await syncFreePackNotice(P, payload); } catch (_) {} }
    const shopChanged = publish || unpublish || P.status === "active";
    const m = shopChanged ? await rebuildSite(supabase) : "";
    L = null;
    drawPack();
    toast([publish ? `${P.title} is in the shop.` : unpublish ? `${P.title} is out of the shop. Members who bought it keep it.` : "Saved.", bell, m].filter(Boolean).join(" "));
  }

  /* A free pack's bell notice, booked for the moment it goes live (as the
     pack editor did; supabase/member_broadcasts.sql). */
  async function syncFreePackNotice(pack, payload) {
    const href = `/account/editor?pack=${encodeURIComponent(pack.id)}`;
    const { data: rows, error } = await supabase.from("member_broadcasts").select("id, status").eq("href", href).in("status", ["scheduled", "sending", "sent"]);
    if (error) return "The bell notice couldn't be booked: " + error.message;
    const booked = (rows || []).find((r) => r.status === "scheduled");
    const lines = String(payload.description || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (payload.access !== "members" || payload.status !== "active" || !lines.length) {
      if (booked) await supabase.from("member_broadcasts").update({ status: "cancelled" }).eq("id", booked.id).eq("status", "scheduled");
      return booked ? "Its booked bell notice is cancelled." : "";
    }
    if (!booked && (rows || []).length) return "";
    const fromIso = payload.available_from;
    const at = fromIso && Date.parse(fromIso) > Date.now() ? fromIso : new Date().toISOString();
    const row = { title: lines[0].slice(0, 80), body: lines.slice(1).join(" ").slice(0, 200) || null, href, link_label: payload.title, send_at: at, status: "scheduled" };
    const res = booked ? await supabase.from("member_broadcasts").update(row).eq("id", booked.id).eq("status", "scheduled") : await supabase.from("member_broadcasts").insert(row);
    if (res.error) return "The bell notice couldn't be booked: " + res.error.message;
    return "Bell notice booked for " + new Date(at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Europe/London" }) + ".";
  }

  /* ---------------- Pop-out ---------------- */
  function showPop(title, eye, body, foot, wide) {
    pop.innerHTML = `<div class="pb-scrim" data-scrim><div class="pb-popbox${wide ? " wide" : ""}" role="dialog" aria-modal="true" data-lenis-prevent><div class="pb-pop-h"><div><p class="mo-eye">${eye}</p><p class="pb-pop-title">${title}</p></div><button type="button" class="pb-x" data-close aria-label="Close">&times;</button></div><div class="pb-pop-b">${body}</div><div class="pb-pop-f">${foot}</div></div></div>`;
    pop.dataset.mode = ""; pop.dataset.row = "";
    document.documentElement.style.overflow = "hidden";
  }
  function closePop() { flushAll(); pop.innerHTML = ""; document.documentElement.style.overflow = ""; }

  /* ---------------- Events ---------------- */
  main.addEventListener("click", async (e) => {
    const c = (s) => e.target.closest(s);
    let b;
    if ((b = c("[data-kind]"))) { S.kind = b.dataset.kind; setUrl(); return drawHome(); }
    if ((b = c("[data-show]"))) { S.show = b.dataset.show; return drawHome(); }
    if (c("[data-new]")) return openNew();
    if ((b = c("[data-pack]"))) return openPack(b.dataset.pack);
    if (c("[data-home]")) { P = null; S.packId = null; L = null; setUrl(); await loadAll(); return drawHome(); }
    if ((b = c("[data-stage]"))) return setStage(+b.dataset.stage);
    if ((b = c("[data-step]"))) return setStage(stage() + +b.dataset.step);
    if (c("[data-add]")) { const r = await addRow(); if (r) openRow(r.id); return; }
    if (c("[data-copy]")) return openCopy(null);
    if (c("[data-set]")) return openSet();
    if ((b = c("[data-test]"))) return sendTest(b.dataset.test === "1");
    if (c("[data-gift]")) return openGift(P.id);
    if (c("[data-insights]")) return openResults(P);
    if ((b = c("[data-delete]"))) return deletePack(b);
    if (c("[data-save]")) return saveListing(false, false);
    if (c("[data-publish]")) return saveListing(true, false);
    if (c("[data-unpublish]")) return saveListing(false, true);
    if (c("[data-pickcover]")) return pickImage("cover");
    if (c("[data-pickgal]")) return pickImage("gal");
    if (c("[data-nocover]")) { L.cover = ""; return drawPack(); }
    if ((b = c("[data-ungal]"))) { L.gallery.splice(+b.dataset.ungal, 1); return drawPack(); }
    if ((b = c("tr[data-row]"))) return openRow(b.dataset.row);
  });
  main.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "pb-about") {
      PLAN = { ...(PLAN || { pack_id: P.id, stage: 1 }), about: t.value }; PLANS.set(P.id, PLAN);
      // Tick "What the pack is about" as you type; only the box above redraws, so the field keeps focus.
      const call = main.querySelector(".pb-call"); if (call) call.outerHTML = callout();
      clearTimeout(t._tm); t._tm = setTimeout(() => supabase.from("pack_plans").upsert({ pack_id: P.id, stage: PLAN.stage, about: t.value.trim() || null, updated_at: new Date().toISOString() }).then(({ error }) => { if (error) toast("Couldn't save: " + error.message); }), 600);
      return;
    }
    if (t.dataset.l && L) { L[t.dataset.l] = t.value; if (t.dataset.l === "title" && !P.launched_at && !L._slugTouched) { L.slug = slugify(t.value); const s = main.querySelector('[data-l="slug"]'); if (s) s.value = L.slug; } if (t.dataset.l === "slug") L._slugTouched = true; }
  });
  main.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.dataset.l === "kind" || t.dataset.l === "access" || t.dataset.l === "reveal") { L[t.dataset.l] = t.dataset.l === "reveal" ? Math.max(0, +t.value || 0) : t.value; return drawPack(); }
    if (t.matches("[data-brand]")) { L.brands = [...main.querySelectorAll("[data-brand]:checked")].map((x) => x.value); return; }
    if (t.id === "pb-cover-file" && t.files[0]) { $("pb-up").textContent = "Uploading…"; const u = await upload(t.files[0], "covers"); if (u) L.cover = u; return drawPack(); }
    if (t.id === "pb-gal-file" && t.files.length) { $("pb-up").textContent = "Uploading…"; for (const f of t.files) { const u = await upload(f, "gallery"); if (u) L.gallery.push(u); } return drawPack(); }
  });

  pop.addEventListener("click", async (e) => {
    const c = (s) => e.target.closest(s);
    let b;
    if (c("[data-close]") || e.target.matches("[data-scrim]")) return closePop();
    if (c("[data-create]")) return createPack();
    if (c("[data-tickall]")) { pop.querySelectorAll("#pb-copy-grid input").forEach((x) => { x.checked = true; }); return; }
    if (c("[data-docopy]")) return doCopy();
    if ((b = c("[data-img]"))) { if (pop.dataset.mode === "img-cover") L.cover = b.dataset.img; else if (!L.gallery.includes(b.dataset.img)) L.gallery.push(b.dataset.img); closePop(); return drawPack(); }
    const r = openRowObj();
    if ((b = c("[data-pick]")) && r) return choose(r, b.dataset.pick);
    if (!r) return;
    if (c("[data-make]")) return makeDesign(r);
    if (c("[data-choose]")) return openChoose(r);
    if (c("[data-copy]")) return openCopy(r);
    if (c("[data-unlink]")) return unlink(r);
    if (c("[data-remove]")) return removeRow(r);
    if ((b = c("[data-go]")) && !b.disabled) return openRow(ROWS[+b.dataset.go].id);
  });
  pop.addEventListener("input", (e) => {
    const t = e.target, r = openRowObj();
    if (t.id === "pb-choose-q") { const q = t.value.trim().toLowerCase(); pop.querySelectorAll("#pb-choose-grid [data-pick]").forEach((x) => { x.hidden = q && !x.dataset.name.includes(q); }); return; }
    if (!r || !t.dataset.f) return;
    const v = t.type === "checkbox" ? t.checked : t.value;
    patchRow(r, { [t.dataset.f]: v }, t.type === "checkbox" || t.tagName === "SELECT");
    drawPack();
  });
  pop.addEventListener("change", (e) => { if (e.target.id === "pb-copy-from") drawCopy(e.target.value); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pop.innerHTML) closePop(); });

  /* ---------------- Start ---------------- */
  return {
    async start() {
      if (!(await loadAll())) return;
      if (S.packId && packOf(S.packId)) openPack(S.packId); else { S.packId = null; setUrl(); drawHome(); }
    },
    async refresh() { await loadAll(); if (P) { P = packOf(P.id) || P; drawPack(); } else drawHome(); },
  };
}
