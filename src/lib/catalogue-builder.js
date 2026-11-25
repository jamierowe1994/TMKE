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
import { editRows } from "./edit-prompts.js";

const PACK_IMAGES_BUCKET = "pack-images";
const STAGES = [[1, "Initial planning"], [2, "Creation"], [3, "Prompts and guidance"], [4, "Final checks"], [5, "Shop listing"]];
// A brand designer's last step isn't a shop: their packs go to their own
// brand, once we've checked them (Danielle, 24 Nov 2026).
const DESIGNER_STAGES = [...STAGES.slice(0, 4), [5, "Details and approval"]];
const WORKER = (import.meta.env.PUBLIC_R2_WORKER_URL || "").replace(/\/+$/, "");
const TYPES = { single: "Single image", carousel: "Carousel", story: "Story", reel: "Reel" };
const CATEGORIES = ["On the Market", "Educate and Inform", "Behind the Brand", "In Season", "Local Life", "Service and Standards", "Starter Pack", "Complimentary"];
// elements and updated_at: what the Edit tab asks for, and whether the last changes saved.
const TPL_COLS = "id, name, thumb_url, status, canvas, elements, pages, pack_id, sort_order, collection, updated_at";
const COPY_COLS = "id, name, category, thumb_url, render_url, canvas, elements, pages, size_variants, status, kind, block_variant, block_box";
const GRIP = '<svg viewBox="0 0 10 16" aria-hidden="true"><circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/><circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/></svg>';

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tplId = () => "tmpl-" + Math.random().toString(36).slice(2, 8);
const slugify = (s) => String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "pack";
const whenLabel = (ms) => new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const dayLabel = (iso) => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }) : ""; };

export function initBuilder(ctx) {
  const { supabase, rebuildSite, toast, openGift, openResults, gbpFromPence } = ctx;
  /* Who's here. ctx.who is filled in by the page once the sign-in is known,
     before start(). A designer (src/lib/admin-gate.js) sees and changes their
     own packs only, for their own brands, and sends a finished pack to us
     instead of putting it live. supabase/designers.sql enforces all of it. */
  const D = () => (ctx.who && ctx.who.designer) || null;
  const myId = () => (ctx.who && ctx.who.userId) || null;
  const stages = () => (D() ? DESIGNER_STAGES : STAGES);
  // To the team: whose pack this is, when a designer made it.
  let MAKERS = new Map();
  const makerOf = (p) => (p && p.created_by && MAKERS.get(p.created_by)) || "";
  const asked = (p) => !!(p && p.review_requested_at && p.status === "draft");
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
    const packsQ = supabase.from("packs").select("*");
    const [packsRes, plansRes, rowsRes, makersRes] = await Promise.all([
      (D() ? packsQ.eq("created_by", myId()) : packsQ).order("sort_order", { ascending: true }).order("created_at", { ascending: false }),
      supabase.from("pack_plans").select("pack_id, stage, about"),
      supabase.from("pack_plan_rows").select("pack_id, template_id"),
      D() ? Promise.resolve({ data: [] }) : supabase.from("designers").select("user_id, full_name, email"),
    ]);
    // Before supabase/designers.sql has run there's no such table: nobody is one.
    MAKERS = new Map(((makersRes && makersRes.data) || []).map((d) => [d.user_id, d.full_name || d.email || "A designer"]));
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
      const tq = supabase.from("templates").select("pack_id").not("pack_id", "is", null);
      const { data, error } = await (D() ? tq.eq("created_by", myId()) : tq).range(from, from + 999);
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
      : asked(p) ? `<span class="chip wait">${D() ? "Sent for approval" : "Waiting for approval"}</span>`
      : PLANS.get(p.id) ? `<span class="chip plain">Stage ${PLANS.get(p.id).stage} of 5</span>` : '<span class="chip plain">Draft</span>';
    // The last line of a box: the price; who it's for, to a designer; and
    // who made it, to us, when a designer did.
    const last = (p) => D() ? ["For", (p.brands || []).join(", ") || "No brand yet"] : makerOf(p) ? ["Made by", makerOf(p)] : ["Price", priceLabel(p)];
    const card = (p) => {
      const pc = PLAN_COUNTS.get(p.id);
      const rows = isLive(p) || p.status === "archived"
        ? [[isLive(p) ? "Live since" : "Created", dayLabel(p.launched_at || p.created_at)], ["Designs", COUNTS.get(p.id) || 0], last(p)]
        : [["Step", stages()[stageOf(p) - 1][1]], ["Designs made", pc ? `${pc.made} of ${pc.n}` : String(COUNTS.get(p.id) || 0)], last(p)];
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
    ${S.show === "all" && list.length > 1 && !D() ? '<p class="pb-hint pb-foot">Drag a box to change the order packs show in the shop and the Studio.</p>' : ""}`;
    if (homeSortable) { homeSortable.destroy(); homeSortable = null; }
    const Sortable = window.Sortable;
    if (Sortable && S.show === "all" && list.length > 1 && !D()) {
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
    await loadUnsaved();
  }
  const tplFor = (r) => (r && r.template_id ? TPL.get(r.template_id) : null);

  /* Has every design saved? (Danielle, 25 Nov: flagged at Creation, before
     a pack gets as far as publishing.) Four things can be seen from here:
       - changes kept in THIS browser that are newer than the saved design,
         by the Studio's own rule (loadTemplate in public/scripts/editor.js),
         so this says what the Studio would say on opening it;
       - a save from anyone's Studio that didn't go through, with nothing
         saved since (site_events 'studio_save_failed', sent by editor.astro);
       - a design with nothing on it;
       - a design with no preview picture, so its picture never uploaded.
     Changes sitting in someone else's browser with no failed save (a tab
     shut mid-edit and offline) can't be seen from here. */
  let UNSAVED = new Map();   // template id -> [a few words for the table, the whole of it for the pop-out]
  async function loadUnsaved() {
    UNSAVED = new Map();
    const made = [...new Set(ROWS.map((r) => r.template_id).filter((id) => id && TPL.has(id)))];
    if (!made.length) return;
    const savedAt = (t) => (t.updated_at ? Date.parse(t.updated_at) : NaN);
    made.forEach((id) => {
      const t = TPL.get(id);
      try {
        const kept = JSON.parse(localStorage.getItem("tmke.editor." + id) || "null");
        const at = kept && Number(kept.savedAt);
        if (at && (!isFinite(savedAt(t)) || at > savedAt(t) + 2000)) return UNSAVED.set(id, ["Changes in this browser haven't saved", `Changes in this browser haven't saved, last edited ${whenLabel(at)}. Open it in the Studio and save.`, "here"]);
      } catch (_) {}
      const pages = Array.isArray(t.pages) && t.pages.length ? t.pages : [{ canvas: t.canvas, elements: t.elements }];
      const drawn = pages.some((pg) => pg && (((pg.elements || []).length) || (pg.canvas && pg.canvas.backgroundImage)));
      if (!drawn) UNSAVED.set(id, ["Nothing on it yet", "There's nothing on this design yet."]);
      else if (!t.thumb_url) UNSAVED.set(id, ["No preview picture yet", "This design has no preview picture yet. Open it in the Studio and save."]);
    });
    try {
      const since = new Date(Date.now() - 14 * 864e5).toISOString();
      const { data } = await supabase.from("site_events").select("user_id, props, created_at")
        .eq("name", "studio_save_failed").in("props->>template", made).gte("created_at", since)
        .order("created_at", { ascending: false }).limit(300);
      const last = new Map();
      (data || []).forEach((e) => { const id = e.props && e.props.template; if (id && !last.has(id)) last.set(id, e); });
      const stuck = [...last.entries()].filter(([id, e]) => {
        const t = TPL.get(id), at = Date.parse(e.created_at);
        return t && !(UNSAVED.has(id) && UNSAVED.get(id)[2] === "here") && (!isFinite(savedAt(t)) || at > savedAt(t) + 2000);
      });
      if (!stuck.length) return;
      const who = new Map();
      const uids = [...new Set(stuck.map(([, e]) => e.user_id).filter(Boolean))];
      if (uids.length) {
        const { data: cs } = await supabase.from("contacts").select("user_id, first_name").in("user_id", uids);
        (cs || []).forEach((c) => { if (c.first_name) who.set(c.user_id, c.first_name); });
      }
      stuck.forEach(([id, e]) => {
        const name = e.user_id === myId() ? "Your" : who.get(e.user_id) ? `${who.get(e.user_id)}'s` : "Someone's";
        const why = String((e.props && e.props.why) || "").trim();
        UNSAVED.set(id, [`${name} changes didn't save`, `${name} changes didn't save at ${whenLabel(Date.parse(e.created_at))}, and nothing has saved since.${why ? " " + why : ""}`]);
      });
    } catch (_) { /* the list of failed saves couldn't be read: the checks above still stand */ }
  }
  const unsavedOf = (r, whole) => { const u = r && r.template_id && UNSAVED.get(r.template_id); return u ? u[whole ? 1 : 0] : ""; };

  /* Editing fields set up: worked out from the design, where it was a tick
     box (Danielle, 25 Nov). Done once every row a member sees on the Edit tab
     has a prompt, typed or one the row starts with (src/lib/edit-prompts.js). */
  const fieldsOf = (r) => editRows(tplFor(r));
  const fieldsOk = (r) => { const f = fieldsOf(r); return !!f && f.missing.length === 0; };
  // copied_from holds a pack's or month's name; a duplicate made inside the pack marks it with the design's.
  const DUPE_OF = "dup:";
  const fromLine = (r) => (String(r.copied_from).startsWith(DUPE_OF) ? "Duplicated from " + esc(String(r.copied_from).slice(DUPE_OF.length)) : "Copied from " + esc(r.copied_from));
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
    // A designer looking back through a pack that's live: nothing to save.
    if (D() && P.status !== "draft") return;
    const { error } = await supabase.from("pack_plans").upsert({ pack_id: P.id, stage: n, about: PLAN.about, updated_at: new Date().toISOString() });
    if (error) { PLAN = was; if (was) PLANS.set(P.id, was); else PLANS.delete(P.id); drawPack(); toast("Couldn't save the step: " + error.message); }
  }

  function timeline() {
    const n = stages().length, st = stage(), fill = (st - 1) / (n - 1) * 100;
    return `<div class="pb-tl"><div class="pb-tl-track"><div style="width:${fill}%"></div></div>${stages().map(([s, l], i) => `<button type="button" class="pb-tl-step${i === 0 ? " first" : ""}${i === n - 1 ? " last" : ""}${s <= st ? " done" : ""}${s === st ? " cur" : ""}" style="left:${i / (n - 1) * 100}%" data-stage="${s}"><span class="pb-tl-dot"></span><span>${l}</span></button>`).join("")}</div>`;
  }
  function callout() {
    const n = ROWS.length, st = stage(), item = (ok, t) => `<li class="${ok ? "ok" : ""}">${t}</li>`;
    const box = (title, items, acts, hint) => `<div class="pb-call"><div><h4>${title}</h4><ul>${items.join("")}</ul>${hint ? `<p>${hint}</p>` : ""}</div><div class="pb-call-acts">${acts}</div></div>`;
    // Copying from another pack is ours only: it would put our own packs' designs in a brand's.
    const copy = D() ? "" : '<button type="button" class="mbtn" data-copy>Copy designs from another pack</button>';
    const add = '<button type="button" class="mbtn" data-add>Add a design</button>';
    const set = '<button type="button" class="mbtn" data-set>See them together</button>';
    if (st === 1) {
      const planned = cnt((r) => (r.idea || "").trim());
      return box("Initial planning", [item(!!(PLAN && PLAN.about), "What the pack is about"), item(n > 0 && planned === n, `${planned} of ${n} designs planned`)], add + copy, "A row for each design the pack will have: its name, content pillar, format and a note for whoever makes it.");
    }
    if (st === 2) {
      const made = cnt((r) => r.template_id), bad = cnt((r) => unsavedOf(r));
      return box("Creation", [item(n > 0 && made === n, `${made} of ${n} designs made`), ...(made ? [item(!bad, bad ? `${bad} design${bad === 1 ? "" : "s"} not saved properly` : "Every design saved")] : [])], add + copy + set, (bad ? "The designs marked Not saved or Empty say what's wrong underneath. " : "") + (D() ? "Make each design in the Studio, or choose one you've already made that isn't in a pack." : "Make each design in the Studio, choose one you already have, or copy one from another pack or a Content Calendar month."));
    }
    if (st === 3) {
      const f = cnt(fieldsOk), c = cnt((r) => capOf(tplFor(r))), a = cnt((r) => aiOf(tplFor(r)) && aiOf(tplFor(r)).on);
      return box("Prompts and guidance", [item(n > 0 && f === n, `${f} of ${n} with editing fields set up`), item(true, `${c} with a caption prompt (optional)`), item(true, `AI helper on ${a} design${a === 1 ? "" : "s"}`)], "", "Editing fields ticks itself once every row a member sees on the design's Edit tab has a prompt, whether you wrote it or the row came with one. Open a design to see which rows still need one. The caption prompt and AI helper are optional and come from the design itself: change them in the Studio and they show here.");
    }
    if (st === 4 && D()) {
      const t = cnt((r) => r.preview_ok);
      return box("Final checks", [item(n > 0 && t === n, `${t} of ${n} previews made`)], set,
        "Open each design in the Studio and save it once it's finished, so its preview picture is up to date, then tick Preview made. We try every design as a member before the pack goes live, so you don't need to.");
    }
    if (st === 4) {
      const t = cnt((r) => r.preview_ok), m = cnt((r) => r.member_ok);
      const sent = (P.test_user_ids || []).length > 0;
      const acts = isLive(P) ? '<button type="button" class="mbtn primary" data-gift>Gift the pack</button>'
        : (sent ? '<a class="mbtn" href="/account/studio" target="_blank" rel="noopener">Open the Studio</a><button type="button" class="mbtn" data-test="0">Take the test pack back</button>'
          : '<button type="button" class="mbtn primary" data-test="1">Send me the test pack</button>') + '<button type="button" class="mbtn" data-sendto>Send to a team member</button>';
      const lead = isLive(P) ? "It's live, so it's already in the Studio for everyone it's for. Gift the pack puts it in someone's library for free, such as another admin. "
        : sent ? "Sent to your test login: it's in that account's Studio as a test pack, and nobody else can see it. "
        : "Send me the test pack puts just this pack in your test login's Studio, so you can try every design as a member before it goes in the shop. ";
      return box("Final checks", [item(n > 0 && t === n, `${t} of ${n} previews made`), item(n > 0 && m === n, `${m} of ${n} tested as a member`)], acts + set, lead + "Preview made: the design has been saved, so its preview picture in the Studio and the shop is up to date. Tested as a member: opened on the test login and edited the way an agent would, so the brand kit fills in, photos swap and the words fit.");
    }
    const live = isLive(P);
    if (D()) {
      const made = cnt((r) => r.template_id);
      const items = [item(!!P.cover_image_url, "Cover image"), item((P.brands || []).length > 0, "Who it's for"), item(!!(P.description || "").trim(), "Description"), item(made > 0, "Designs in order")];
      if (P.status !== "draft") return box("Details and approval", items, "", live
        ? "This pack is live, so it's in the Studio for everyone it's for. It can't be changed here now. If something needs changing, ask The Marketing Experts."
        : "This pack has been taken down. Ask The Marketing Experts if it should come back.");
      return box("Details and approval", items,
        `<button type="button" class="mbtn" data-save>Save</button><button type="button" class="mbtn primary" data-approve>${asked(P) ? "Send again" : "Send for approval"}</button>`,
        asked(P)
          ? `Sent for approval on ${dayLabel(P.review_requested_at)}. The Marketing Experts check every design works as it should, then put the pack live. You can keep making changes until then.`
          : "When the pack is finished, send it for approval. The Marketing Experts check every design works as it should, then put it live for the brands you've chosen. Nothing goes to agents until then.");
    }
    return box("Shop listing", [item(!!P.cover_image_url, "Cover image"), item(P.access !== "buy" || (P.price_pence || 0) > 0, "Price"), item(!!(P.description || "").trim(), "Description"), item(cnt((r) => r.template_id) > 0, "Designs in order")],
      live ? '<button type="button" class="mbtn primary" data-save>Save changes</button><button type="button" class="mbtn" data-unpublish>Take out of the shop</button>'
        : '<button type="button" class="mbtn" data-save>Save</button><button type="button" class="mbtn primary" data-publish>Publish to the shop</button>',
      (makerOf(P) ? `Made by ${esc(makerOf(P))}${asked(P) ? `, who sent it for approval on ${dayLabel(P.review_requested_at)}` : ""}. It only goes live when you publish it. ` : "") + "Everything buyers see. The words down the left; the cover, hover gallery and preview order down the right.");
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
      body = ROWS.map((r, i) => `<tr data-row="${esc(r.id)}">${grip}<td class="pb-num">${i + 1}</td><td>${thumb(r)}</td><td>${esc(r.idea) || '<span class="pb-tx">Untitled</span>'}${unsavedOf(r) ? `<small class="pb-warn">${esc(unsavedOf(r))}</small>` : r.copied_from ? `<small>${fromLine(r)}</small>` : ""}</td><td>${TYPES[r.post_type] || "Single image"}</td><td>${!r.template_id ? '<span class="chip wait">To make</span>' : unsavedOf(r) ? `<span class="chip wait">${unsavedOf(r) === "Nothing on it yet" ? "Empty" : "Not saved"}</span>` : '<span class="chip good">Made</span>'}</td></tr>`);
    } else if (st === 3) {
      head = "<th>#</th><th></th><th>Design</th><th>Editing fields</th><th>Caption prompt <span class='pb-tx'>(optional)</span></th><th>AI helper</th>";
      body = ROWS.map((r, i) => { const t = tplFor(r), ai = aiOf(t); return `<tr data-row="${esc(r.id)}"><td class="pb-num">${i + 1}</td><td>${thumb(r)}</td><td>${esc(r.idea)}</td><td>${yes(fieldsOk(r))}</td><td class="pb-note">${esc(capOf(t)) || '<span class="pb-tx">None</span>'}</td><td>${ai && ai.on ? '<span class="chip plain">On</span>' : '<span class="chip off">Off</span>'}</td></tr>`; });
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
    const next = st < 5 ? `<button type="button" class="pb-vbtn primary" data-step="1">Next: ${stages()[st][1]} →</button>` : "";
    const tag = live ? `Live since ${dayLabel(P.launched_at || P.created_at)}` : P.status === "archived" ? "Out of the shop" : asked(P) ? (D() ? "Sent for approval" : "Waiting for approval") : "Draft";
    // A designer's pack that isn't a draft any more is read-only to them.
    const shut = !!D() && P.status !== "draft";
    main.innerHTML = `<button type="button" class="pb-back" data-home>&lsaquo; All packs</button>
    <div class="pb-banner"${P.cover_image_url ? ` style="background-image:url('${esc(P.cover_image_url)}')"` : ""}>
      <div class="pb-tags"><span>${esc(tag)}</span><span>${P.kind === "print" ? "Print pack" : "Social pack"}</span><span>Stage ${st} of 5</span>${(P.test_user_ids || []).length && !D() ? "<span>Test pack sent</span>" : ""}${makerOf(P) ? `<span>Made by ${esc(makerOf(P))}</span>` : ""}</div>
      <div class="pb-ban-row"><div><h2>${esc(P.title)}</h2><p>${ROWS.length} design${ROWS.length === 1 ? "" : "s"} planned · ${made} made</p></div>
        <div class="pb-ban-acts">${shut ? "" : live ? '<button type="button" class="pb-vbtn" data-insights>Insights</button><button type="button" class="pb-vbtn primary" data-gift>Gift the pack</button>'
          : `<button type="button" class="pb-vbtn" data-delete>Delete pack</button>${back}${next}`}</div></div>
    </div>
    <div class="pb-prog">${timeline()}${callout()}</div>
    ${st === 1 ? `<label class="pb-about"><span>About this pack</span><textarea id="pb-about" rows="2" placeholder="A line or two about the pack: what it's for and when.">${esc(PLAN && PLAN.about)}</textarea></label>` : ""}
    ${st === 5 ? listing() : table()}`;
    wireRows();
    if (st === 5) wireListing();
    // Live, so read-only to its designer: the details show but don't change.
    if (shut) main.querySelectorAll(".pb-shop input, .pb-shop select, .pb-shop textarea, .pb-shop button, #pb-about").forEach((el) => { el.disabled = true; });
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
    const own = ROWS.some((x) => x !== r && tplFor(x));   // something in this pack to duplicate
    let b = "";
    if (st <= 2) b += `<label class="pb-field"><span>Design name</span><input data-f="idea" value="${esc(r.idea)}" placeholder="e.g. Christmas countdown"></label>
      <div class="pb-two"><label class="pb-field"><span>Content pillar</span><select data-f="pillar"><option value="">Choose a pillar</option>${PILLARS.map((x) => `<option${x === r.pillar ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></label><label class="pb-field"><span>Format</span><select data-f="post_type">${Object.entries(TYPES).map(([k, l]) => `<option value="${k}"${k === r.post_type ? " selected" : ""}>${l}</option>`).join("")}</select></label></div>`;
    if (st >= 2) {
      b += `<div class="pb-dz">${t && t.thumb_url ? `<div class="pb-dz-pic" style="background-image:url('${esc(t.thumb_url)}')"></div>` : `<div class="pb-dz-pic none">${t ? esc(t.name) : "No design yet"}</div>`}
        <div class="pb-dz-r"><p class="pb-hint">${!t ? (D() ? (own ? "Make it in the Studio, choose one you've already made, or duplicate one from this pack." : "Make it in the Studio, or choose one you've already made.") : (own ? "Make it in the Studio, choose one you already have, duplicate one from this pack, or copy one from another pack." : "Make it in the Studio, choose one you already have, or copy one from another pack.")) : r.copied_from ? `${esc(t.name)}. ${fromLine(r)}; changes here don't touch the original.` : esc(t.name)}</p>
        <div class="pb-dz-acts">${!t ? '<button type="button" class="mbtn primary" data-make>Create a design</button><button type="button" class="mbtn" data-choose>Choose a design</button>' + (own ? '<button type="button" class="mbtn" data-dupe>Duplicate one from this pack</button>' : "") + (D() ? "" : '<button type="button" class="mbtn" data-copy>Copy from another pack</button>')
          : `<a class="mbtn primary" href="/account/editor?id=${encodeURIComponent(t.id)}&mode=admin">Open in the Studio</a><button type="button" class="mbtn" data-unlink>Choose a different one</button>`}</div></div></div>`;
    }
    if (st >= 2 && unsavedOf(r)) b += `<p class="pb-warn">${esc(unsavedOf(r, true))}</p>`;
    b += `<label class="pb-field"><span>Note <em>(team only)</em></span><textarea data-f="note" rows="3" placeholder="Anything whoever makes it needs to know">${esc(r.note)}</textarea></label>`;
    if (st === 3) {
      const ai = aiOf(t);
      b += fieldsBox(r);
      b += `
      <div class="pb-field"><span>Caption prompt <em>(optional, from the design)</em></span><p class="pb-ro">${esc(capOf(t)) || "None on this design."}</p></div>
      <div class="pb-field"><span>AI helper <em>(from the design)</em></span><p class="pb-ro">${ai && ai.on ? "On." + (ai.brief ? " " + esc(ai.brief) : "") : "Off."}</p></div>
      <p class="pb-hint">To change the caption prompt or the AI helper, open the design in the Studio. What you save there shows here.</p>`;
    }
    if (st === 4) b += `<label class="pb-check"><input type="checkbox" data-f="preview_ok"${r.preview_ok ? " checked" : ""}> Preview made: saved, so its picture in the Studio and the shop is up to date</label>${D() ? "" : `<label class="pb-check"><input type="checkbox" data-f="member_ok"${r.member_ok ? " checked" : ""}> Tested as a member: opened on the test login and edited as an agent would</label>`}`;
    const foot = `<button type="button" class="mbtn" data-remove style="margin-right:auto">Remove from pack</button>${st === 3 && t ? `<a class="mbtn" href="/account/editor?id=${encodeURIComponent(t.id)}&mode=admin">Open in the Studio</a>` : ""}<button type="button" class="mbtn" data-go="${i - 1}"${i ? "" : " disabled"}>&lsaquo; Previous</button><button type="button" class="mbtn" data-go="${i + 1}"${i < ROWS.length - 1 ? "" : " disabled"}>Next &rsaquo;</button><button type="button" class="mbtn primary" data-close>Done</button>`;
    showPop(esc(r.idea || "Untitled design"), `Design ${i + 1} of ${ROWS.length} · ${stages()[st - 1][1]}`, b, foot);
    pop.dataset.row = r.id;
  }
  // The Editing fields line of a design's pop-out: ticked by the design, not by hand.
  function fieldsBox(r) {
    const f = fieldsOf(r), line = (ok, t) => `<div class="pb-check is-auto"><span class="pb-tick${ok ? " ok" : ""}"></span><span>${t}</span></div>`;
    if (!tplFor(r)) return line(false, "Editing fields: no design yet.");
    if (!f) return line(false, "Editing fields: this design's contents couldn't be read. Open it in the Studio and save it.");
    if (!f.total) return line(true, "Editing fields set up: there's nothing on this design for members to change.");
    if (!f.missing.length) return line(true, `Editing fields set up: ${f.total === 1 ? "the one row" : `all ${f.total} rows`} on the Edit tab ${f.total === 1 ? "has" : "have"} a prompt.`);
    const n = f.missing.length;
    return line(false, `Editing fields: ${n} of ${f.total} row${f.total === 1 ? "" : "s"} on the Edit tab ${n === 1 ? "has" : "have"} no prompt yet.`)
      + `<ul class="pb-missing">${f.missing.map((m) => `<li>${f.pages > 1 ? `Page ${m.page}: ` : ""}${esc(m.name)}</li>`).join("")}</ul>
      <p class="pb-hint">Open the design in the Studio and write a prompt on each of these, or take it off the list. This ticks itself once they all have one.</p>`;
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
    const cq = supabase.from("templates").select("id, name, thumb_url, status, collection").is("pack_id", null).neq("status", "archived");
    const { data } = await (D() ? cq.eq("created_by", myId()) : cq).order("updated_at", { ascending: false }).limit(300);
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
  const ownSrc = () => ({ id: P.id, title: "This pack", group: "", own: true });
  const copyGo = (own) => (own ? "Duplicate designs" : "Copy designs");
  /* own: only this pack's designs, to duplicate into another row (Danielle,
     25 Nov). Open to brand designers too, as nothing leaves their pack. */
  async function openCopy(forRow, own) {
    showPop(own ? "Duplicate designs in this pack" : "Copy designs from", esc(P.title), '<p class="pb-hint">Loading…</p>', `<button type="button" class="mbtn" data-tickall>Tick all</button><button type="button" class="mbtn primary" data-docopy>${copyGo(own)}</button>`, true);
    pop.dataset.row = forRow ? forRow.id : "";
    if (own) { COPY_SRC = [ownSrc()]; pop.dataset.own = "1"; return drawCopy(P.id); }
    pop.dataset.own = "";
    // The same sections as the Design studio's pack menu (Danielle, 12 Nov).
    let demo = [];
    try { const { data } = await supabase.from("packs").select("id, title").eq("demo", true); demo = data || []; } catch (_) {}
    const has = (p) => p.id !== P.id && (COUNTS.get(p.id) || 0) > 0;
    const byTitle = (a, b) => String(a.title).localeCompare(String(b.title));
    const packs = [
      ...(ROWS.some((r) => tplFor(r)) ? [ownSrc()] : []),
      ...demo.filter(has).map((p) => ({ id: p.id, title: p.title, group: "" })),
      { id: "loose", title: "Not in a pack", group: "", loose: true },
      ...PACKS.filter((p) => has(p) && p.kind !== "print").sort(byTitle).map((p) => ({ id: p.id, title: p.title, group: "The Edit packs" })),
      ...PACKS.filter((p) => has(p) && p.kind === "print").sort(byTitle).map((p) => ({ id: p.id, title: p.title, group: "Print packs" })),
    ];
    let months = [];
    try {
      const { data } = await supabase.from("content_months").select("id, month, edition, status").order("month", { ascending: false });
      const multi = new Set((data || []).map((m) => m.edition)).size > 1;
      const ED = { property: "TPE", prestige: "PPE", independent: "Independent", lettings: "TLE" };
      months = (data || []).map((m) => ({ id: "cc:" + m.id, month: m.id, group: "Content Calendar",
        title: new Date(m.month + "T12:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" }) + (multi ? " · " + (ED[m.edition] || m.edition) : "") + (m.status === "published" ? "" : " (draft)") }));
    } catch (_) {}
    COPY_SRC = [...packs, ...months];
    if (!COPY_SRC.length) { pop.querySelector(".pb-pop-b").innerHTML = '<p class="pb-hint">No other packs or months with designs yet.</p>'; return; }
    drawCopy((COPY_SRC.find((x) => x.group === "The Edit packs") || COPY_SRC[0]).id);
  }
  async function drawCopy(srcId) {
    const src = COPY_SRC.find((s) => s.id === srcId) || COPY_SRC[0];
    const body = pop.querySelector(".pb-pop-b");
    const o = (s) => `<option value="${esc(s.id)}"${s === src ? " selected" : ""}>${esc(s.title)}</option>`;
    const groups = COPY_SRC.filter((s) => !s.group).map(o).join("") + ["The Edit packs", "Print packs", "Content Calendar"].map((g) => { const l = COPY_SRC.filter((s) => s.group === g); return l.length ? `<optgroup label="${g}">${l.map(o).join("")}</optgroup>` : ""; }).join("");
    const from = pop.dataset.own ? "" : `<label class="pb-field"><span>From</span><select id="pb-copy-from">${groups}</select></label>`;
    body.innerHTML = `${from}<p class="pb-hint">${src.own ? "Each one comes in as a separate copy, with its editing fields and caption prompt, so changing it never changes the original." : `Each one comes in as a copy, with its editing fields and caption prompt, so the original stays as it is${src.loose ? "" : " in " + esc(src.title)}.`}</p><div class="pb-pick" id="pb-copy-grid"><p class="pb-hint">Loading…</p></div>`;
    const go = pop.querySelector("[data-docopy]"); if (go) go.textContent = copyGo(src.own);
    let list = [];
    if (src.own) {
      // In the pack's own order.
      list = [...new Set(ROWS.map((r) => r.template_id).filter(Boolean))].map((id) => TPL.get(id)).filter(Boolean);
    } else if (src.loose) {
      const { data } = await supabase.from("templates").select("id, name, thumb_url, collection").is("pack_id", null).neq("status", "archived").order("updated_at", { ascending: false }).limit(300);
      list = (data || []).filter((t) => t.collection !== "calendar");
    } else if (src.month) {
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
    const own = !!src && !!src.own;
    if (!src || !ids.length) return toast(own ? "Tick the designs to duplicate first." : "Tick the designs to copy first.");
    const btn = pop.querySelector("[data-docopy]"); if (btn) { btn.disabled = true; btn.textContent = own ? "Duplicating…" : "Copying…"; }
    const again = () => { if (btn) { btn.disabled = false; btn.textContent = copyGo(own); } };
    const { data: tpls, error } = await supabase.from("templates").select(COPY_COLS).in("id", ids);
    if (error) { toast("Couldn't read those designs: " + error.message); again(); return; }
    const ordered = ids.map((id) => (tpls || []).find((t) => t.id === id)).filter(Boolean);
    const forRow = ROWS.find((r) => r.id === pop.dataset.row && !r.template_id);
    const copies = ordered.map((t, i) => {
      const row = { ...t, id: tplId(), pack_id: P.id, status: "draft", sort_order: ROWS.length + i };
      // Names run "Design - Pack - Static": the middle part becomes this pack.
      const parts = String(t.name || "").split(" - ");
      if (own) {
        // A duplicate takes its row's name, so two designs in a pack never share one.
        const mine = i === 0 && forRow ? (forRow.idea || "").trim() : "";
        if (mine) { if (parts.length >= 3) parts[0] = mine; else parts.splice(0, parts.length, mine); }
        else parts[0] = (parts[0] || "Untitled design") + " copy";
        row.name = parts.join(" - ");
      } else if (parts.length >= 3) { parts[1] = P.title; row.name = parts.join(" - "); }
      Object.keys(row).forEach((k) => { if (row[k] === undefined) delete row[k]; });
      return row;
    });
    const { error: e2 } = await supabase.from("templates").insert(copies);
    if (e2) { toast(`Couldn't ${own ? "duplicate" : "copy"} them: ` + e2.message); again(); return; }
    // The open row takes the first copy; the rest get rows of their own.
    // A duplicate says which design it came from, and its new row keeps that row's format and pillar.
    const from = (i) => (own ? DUPE_OF + (ordered[i].name || "Untitled design") : src.title);
    const srcRow = (i) => (own ? ROWS.find((r) => r.template_id === ordered[i].id) : null) || {};
    let rest = copies.map((c, i) => ({ c, i }));
    if (forRow) { patchRow(forRow, { template_id: copies[0].id, copied_from: from(0), ...(forRow.idea ? {} : { idea: copies[0].name }) }, true); rest = rest.slice(1); }
    if (rest.length) {
      const ins = rest.map(({ c, i }, n) => ({ pack_id: P.id, sort_order: ROWS.length + n, idea: c.name, post_type: srcRow(i).post_type || "single", ...(srcRow(i).pillar ? { pillar: srcRow(i).pillar } : {}), template_id: c.id, copied_from: from(i) }));
      const { data, error: e3 } = await supabase.from("pack_plan_rows").insert(ins).select("*");
      if (e3) toast(`The designs were ${own ? "duplicated" : "copied"}, but their rows couldn't be added: ` + e3.message);
      else ROWS.push(...(data || []));
    }
    if (!PLAN) await setStage(stage());
    const openAgain = forRow ? forRow.id : "";
    await loadTemplates(); closePop(); drawPack();
    if (own && openAgain) openRow(openAgain);   // back on the row, with Open in the Studio
    toast(own ? (copies.length === 1 ? "1 design duplicated in this pack." : `${copies.length} designs duplicated in this pack.`) : `${copies.length} design${copies.length === 1 ? "" : "s"} copied from ${src.title}.`);
  }

  /* See them together: four to a row as the Studio lists them, or three to a
     row cropped the way an Instagram profile shows them (Danielle, 25 Nov). */
  let SET_VIEW = "rows";
  const IG_ICON = { carousel: '<svg class="pb-ig-type" viewBox="0 0 16 16" fill="#fff" stroke="#371e28" stroke-width="1" aria-label="Carousel"><rect x="5" y="1" width="10" height="10" rx="1.5"/><rect x="1" y="5" width="10" height="10" rx="1.5"/></svg>', reel: '<svg class="pb-ig-type" viewBox="0 0 16 16" fill="#fff" stroke="#371e28" stroke-width="1" aria-label="Reel"><path d="M3 1.5v13l11-6.5z"/></svg>' };
  function setBody() {
    const ig = SET_VIEW === "ig";
    const on = (v) => `aria-pressed="${SET_VIEW === v}"`;
    const tile = (r) => { const t = tplFor(r); return t && t.thumb_url ? `<div style="background-image:url('${esc(t.thumb_url)}')">${ig ? IG_ICON[r.post_type] || "" : ""}</div>` : `<div class="none">${esc(r.idea || (t && t.name) || "To make")}</div>`; };
    const rows = ig ? ROWS.filter((r) => r.post_type !== "story") : ROWS;   // stories never reach a profile grid
    return `<div class="chips pb-set-views" role="group" aria-label="View"><button type="button" data-setview="rows" ${on("rows")}>All designs</button><button type="button" data-setview="ig" ${on("ig")}>Instagram grid</button></div>
      <p class="pb-hint">${ig ? "In the pack's order from the top left, each cropped to the shape Instagram's profile grid uses, so a little is trimmed off the sides. Stories are left out, because they don't appear on a profile grid. Rows still to make show as gaps." : "In the order members will see them in the Studio. Rows still to make show as gaps."}</p>
      <div class="${ig ? "pb-ig" : "pb-set"}">${rows.map(tile).join("")}</div>`;
  }
  function openSet() {
    showPop("How the pack looks", esc(P.title), setBody(), '<button type="button" class="mbtn primary" data-close>Done</button>', true);
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

  /* A team member's own login, staff included (Danielle, 18 Nov: Sam needed
     to see the Christmas cards, and Test logins refuses staff). Found by
     their email in Contacts; the pack goes on that login's Studio as a test
     pack, the same as the test login's. */
  async function openSendTo() {
    const ids = P.test_user_ids || [];
    let who = [];
    if (ids.length) {
      const { data } = await supabase.from("contacts").select("email,first_name,last_name,user_id").in("user_id", ids);
      who = ids.map((id) => { const c = (data || []).find((x) => x.user_id === id); return { id, name: c ? ([c.first_name, c.last_name].filter(Boolean).join(" ") || c.email) : "A login", email: c ? c.email : "" }; });
    }
    const list = who.length
      ? `<p class="pb-hint">It's in these Studios now:</p><ul class="pb-sendto-list">${who.map((w) => `<li><span>${esc(w.name)}${w.email && w.email !== w.name ? ` <em>${esc(w.email)}</em>` : ""}</span><button type="button" class="mbtn" data-unsend="${esc(w.id)}">Take it back</button></li>`).join("")}</ul>`
      : '<p class="pb-hint">Nobody has it yet.</p>';
    showPop("Send to a team member", "Final checks", `${list}<div id="pb-quick"></div><label class="pb-field"><span>Their email</span><input type="email" id="pb-sendto-email" placeholder="e.g. sam@tmke.co.uk" autocomplete="off"></label><p class="pb-hint">It goes in their own Studio as a test pack, so they can look through it before it's in the shop. Nobody else sees it.</p>`, '<button type="button" class="mbtn primary" data-dosendto>Send it</button>');
    const f = pop.querySelector("#pb-sendto-email"); if (f) f.focus();
    drawQuick(ids);
  }
  /* One press for the two it's nearly always sent to (Danielle, 25 Nov):
     Samantha and Abigail, found in Contacts by first name among the team's
     own addresses, so no address is written here and a changed one still
     works. Only shown once they have a Hub login, and not when they
     already have the pack. */
  const QUICK = [["Samantha", /^sam(antha)?$/i], ["Abigail", /^(abigail|abbie|abby)$/i]];
  let quickTeam = null;
  async function drawQuick(have) {
    if (!quickTeam) {
      const { data, error } = await supabase.from("contacts").select("user_id, first_name, email")
        .or("email.ilike.*@themarketingexperts.co.uk,email.ilike.*@tmke.co.uk").not("user_id", "is", null).limit(200);
      if (error) return;
      quickTeam = data || [];
    }
    const box = pop.querySelector("#pb-quick");
    if (!box) return;
    const btns = QUICK.flatMap(([label, re]) => {
      const found = quickTeam.filter((c) => re.test(String(c.first_name || "").trim()) && !have.includes(c.user_id));
      // Two logins under one name: say which is which.
      return found.map((c) => `<button type="button" class="mbtn" data-quick="${esc(c.user_id)}" data-name="${label}">${label}${found.length > 1 ? ` <em>${esc(c.email)}</em>` : ""}</button>`);
    });
    box.innerHTML = btns.length ? `<p class="pb-hint">Quick add</p><div class="pb-quick">${btns.join("")}</div>` : "";
  }
  async function quickSend(b) {
    b.disabled = true;
    const ids = [...new Set([...(P.test_user_ids || []), b.dataset.quick])];
    if (await setTestIds(ids, `Sent. ${P.title} is in ${b.dataset.name}'s Studio as a test pack.`)) openSendTo(); else b.disabled = false;
  }
  async function setTestIds(ids, msg) {
    const tids = ROWS.map((r) => r.template_id).filter(Boolean);
    if (ids.length && tids.length) await supabase.from("templates").update({ status: "active" }).in("id", tids);
    const { error } = await supabase.from("packs").update({ test_user_ids: ids }).eq("id", P.id);
    if (error) { toast(/test_user_ids/.test(error.message) ? "Run supabase/catalogue_builder.sql first." : "Couldn't send it: " + error.message); return false; }
    P.test_user_ids = ids;
    drawPack();
    toast(msg);
    return true;
  }
  async function doSendTo() {
    const inp = pop.querySelector("#pb-sendto-email");
    const email = (inp && inp.value || "").trim().toLowerCase();
    if (!email) { if (inp) inp.focus(); return; }
    const btn = pop.querySelector("[data-dosendto]"); if (btn) btn.disabled = true;
    const { data, error } = await supabase.from("contacts").select("user_id,first_name").ilike("email", email).limit(1);
    if (btn) btn.disabled = false;
    const c = !error && data && data[0];
    if (!c) return toast(`There's no contact with the email ${email}.`);
    if (!c.user_id) return toast(`${email} hasn't signed in to the Hub yet. They need to sign in once first.`);
    const ids = [...new Set([...(P.test_user_ids || []), c.user_id])];
    if (await setTestIds(ids, `Sent. ${P.title} is in ${c.first_name || email}'s Studio as a test pack.`)) openSendTo();
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
    // A designer's pack is for their brands from the start; with one brand it's already chosen.
    const d = D();
    const row = { title, slug, kind, access: d || kind === "print" ? "brands" : "buy", brands: d && d.brands.length === 1 ? [...d.brands] : [], status: "draft", price_pence: 0, contents: [], sort_order: top };
    let { data: pack, error } = await supabase.from("packs").insert(row).select("*").single();
    // A designer can't see our packs, so the name may already be someone's web address.
    if (error && /duplicate|unique/i.test(error.message || "")) {
      row.slug = slugify(title).slice(0, 64) + "-" + Math.random().toString(36).slice(2, 6);
      ({ data: pack, error } = await supabase.from("packs").insert(row).select("*").single());
    }
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
    // A designer's pack is always for chosen brands, and only theirs.
    if (D()) L.access = "brands";
    const brands = [...new Set(D() ? D().brands : [...BRAND_ORDER, ...L.brands])].sort((a, b) => brandRank(a) - brandRank(b) || a.localeCompare(b));
    const made = ROWS.filter((r) => tplFor(r));
    const priced = L.kind !== "print" && L.access === "buy";
    return `<div class="pb-shop">
      <div class="pb-col">
        <div class="strip"><span class="strip-t">The pack</span></div>
        <div class="pb-two">
          <label class="pb-field"><span>Kind</span><select data-l="kind">${sel([["social", "Social: posts and stories"], ["print", "Print: boards, brochures, cards"]], L.kind)}</select></label>
          ${D() ? '<div class="pb-field"><span>Who gets it</span><p class="pb-ro">Only the brands you tick below, free.</p></div>'
            : `<label class="pb-field"><span>Who gets it</span><select data-l="access">${sel([["buy", "Anyone who buys it"], ["members", "Every member, free"], ["brands", "Only chosen brands"]], L.access)}</select></label>`}
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
          ${D() ? "" : `<label class="pb-field"><span>Price (£)</span><input type="number" min="0" step="0.01" data-l="price" value="${priced ? esc(L.price) : "0"}"${priced ? "" : " disabled"}></label>`}
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

  async function saveListing(publish, unpublish, quiet) {
    if (D()) { publish = false; unpublish = false; L.access = "brands"; }
    listingError("");
    const title = L.title.trim(), slug = L.slug.trim();
    if (!title) return listingError("The pack needs a title.");
    if (!/^[a-z0-9-]+$/.test(slug)) return listingError("The slug can only have lowercase letters, numbers and hyphens.");
    if (PACKS.some((p) => p.id !== P.id && p.slug === slug)) return listingError("Another pack already uses that slug.");
    if (L.access === "brands" && !L.brands.length) return listingError(D() ? "Tick the brand this pack is for." : "Tick at least one brand, or change who gets it.");
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
    if (error) {
      if (btn) btn.disabled = false; drawPack();
      return listingError(/duplicate|unique/i.test(error.message || "") ? "Another pack already uses that slug. Change it and save again." : "Couldn't save: " + error.message);
    }
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
    if (!quiet) toast([publish ? `${P.title} is in the shop.` : unpublish ? `${P.title} is out of the shop. Members who bought it keep it.` : "Saved.", bell, m].filter(Boolean).join(" "));
    return true;
  }

  /* A designer's last step (Danielle, 24 Nov 2026): save it, then tell us
     it's ready. The Worker checks it's theirs, marks the pack and puts a
     notification in our bell. Only one of us can put it live. */
  async function sendForApproval() {
    if (!D()) return;
    if (!ROWS.some((r) => r.template_id)) return listingError("Make at least one design before sending the pack for approval.");
    if (!L.brands.length) return listingError("Tick the brand this pack is for.");
    if (!(await saveListing(false, false, true))) return;
    const btn = main.querySelector("[data-approve]");
    if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${WORKER}/designer/submit`, { method: "POST", headers: { Authorization: `Bearer ${session ? session.access_token : ""}`, "Content-Type": "application/json" }, body: JSON.stringify({ pack_id: P.id }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't send it.");
      P.review_requested_at = d.review_requested_at || new Date().toISOString();
      drawPack();
      toast(`Sent. The Marketing Experts will check ${P.title} and put it live.`);
    } catch (err) {
      drawPack();
      listingError(err.message || "Couldn't send it. Try again.");
    }
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
  // Back from the Studio without the page loading again: read the designs afresh,
  // so what's saved and which prompts are written is as it stands now.
  window.addEventListener("pageshow", async (e) => {
    if (!e.persisted || !S.packId || !P || pop.innerHTML) return;
    await loadTemplates();
    drawPack();
  });
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
    if (c("[data-sendto]")) return openSendTo();
    if (c("[data-gift]")) return openGift(P.id);
    if (c("[data-insights]")) return openResults(P);
    if ((b = c("[data-delete]"))) return deletePack(b);
    if (c("[data-save]")) return saveListing(false, false);
    if (c("[data-approve]")) return sendForApproval();
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
    if (c("[data-dosendto]")) return doSendTo();
    if ((b = c("[data-quick]"))) return quickSend(b);
    if ((b = c("[data-unsend]"))) { const ids = (P.test_user_ids || []).filter((x) => x !== b.dataset.unsend); if (await setTestIds(ids, "Taken back from that Studio.")) openSendTo(); return; }
    if (c("[data-tickall]")) { pop.querySelectorAll("#pb-copy-grid input").forEach((x) => { x.checked = true; }); return; }
    if (c("[data-docopy]")) return doCopy();
    if ((b = c("[data-setview]"))) { SET_VIEW = b.dataset.setview; pop.querySelector(".pb-pop-b").innerHTML = setBody(); pop.querySelector(".pb-pop-b").scrollTop = 0; return; }
    if ((b = c("[data-img]"))) { if (pop.dataset.mode === "img-cover") L.cover = b.dataset.img; else if (!L.gallery.includes(b.dataset.img)) L.gallery.push(b.dataset.img); closePop(); return drawPack(); }
    const r = openRowObj();
    if ((b = c("[data-pick]")) && r) return choose(r, b.dataset.pick);
    if (!r) return;
    if (c("[data-make]")) return makeDesign(r);
    if (c("[data-choose]")) return openChoose(r);
    if (c("[data-copy]")) return openCopy(r);
    if (c("[data-dupe]")) return openCopy(r, true);
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
