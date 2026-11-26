/* Catalogue › Offers (Danielle, 26 Nov 2026).
 *
 * Where the shop's basket is switched on, and where every discount is set:
 * a site-wide percentage, a discount on one pack, a bundle price, the
 * members' price and the shop's banner. Each has its own Save, an On tick and
 * (where it makes sense) a start and an end, so an offer can begin and finish
 * without anyone being here at midnight.
 *
 * It only writes the settings (shop_settings, shop_offers; supabase/
 * shop_basket.sql). The Worker reads them and works every price out with
 * src/lib/shop-price.js, which this page uses too, for "Prices right now".
 *
 * Mounted by src/pages/admin/packs.astro.
 */
import { shopPrice, shopSells } from "./shop-price.js";

// The banner: one line across the top of The Edit and every pack page (src/components/ShopBasket.astro, paintBanner).
const BANNER_READY = true;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// A date and time box holds this computer's time; the database holds the moment itself.
const toBox = (iso) => { if (!iso) return ""; const d = new Date(iso); if (isNaN(d)) return ""; const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromBox = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d.toISOString(); };
const whenWords = (iso) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const pounds = (pence) => (pence == null ? "" : (pence / 100).toFixed(2).replace(/\.00$/, ""));
const penceOf = (v) => { const n = Number(String(v || "").replace(/[£,\s]/g, "")); return isFinite(n) && String(v).trim() !== "" ? Math.round(n * 100) : null; };

export function initOffers(ctx) {
  const { supabase, toast, gbp } = ctx;
  const root = document.getElementById("pb-tab-offers");
  if (!root) return { show() {} };
  let PACKS = [], OFFERS = [], SET = null, MISSING = false, loaded = false;
  // An offer being written that isn't in the database yet, by kind.
  let DRAFTS = [];

  async function load() {
    const [p, o, s] = await Promise.all([
      supabase.from("packs").select("id, title, slug, price_pence, kind, access, demo, status, sort_order").eq("status", "active").order("sort_order", { ascending: true }),
      supabase.from("shop_offers").select("*").order("created_at", { ascending: true }),
      supabase.from("shop_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    MISSING = !!(o.error || s.error || !s.data);
    PACKS = (p.data || []).filter(shopSells);
    OFFERS = o.data || [];
    SET = s.data || null;
    loaded = true;
  }
  const title = (id) => (PACKS.find((p) => p.id === id) || {}).title || "A pack no longer in the shop";

  /* When an offer counts, in words: the same test the Worker makes. */
  function state(o) {
    if (!o.active) return ["Off", "off"];
    const now = Date.now();
    if (o.starts_at && Date.parse(o.starts_at) > now) return [`Starts ${whenWords(o.starts_at)}`, "wait"];
    if (o.ends_at && Date.parse(o.ends_at) <= now) return [`Ended ${whenWords(o.ends_at)}`, "off"];
    return [o.ends_at ? `On until ${whenWords(o.ends_at)}` : "On", "good"];
  }
  const liveNow = () => OFFERS.filter((o) => state(o)[1] === "good");
  // The offers that count at a given moment, by the Worker's own test: on, and inside their dates.
  const liveAt = (t) => OFFERS.filter((o) => o.active && (!o.starts_at || Date.parse(o.starts_at) <= t) && (!o.ends_at || Date.parse(o.ends_at) > t));

  const field = (label, inner, hint) => `<label class="pb-field"><span>${label}</span>${inner}${hint ? `<small class="so-small">${hint}</small>` : ""}</label>`;
  const dates = (o) => `<div class="pb-two">${field("Starts <em>(optional)</em>", `<input type="datetime-local" data-k="starts_at" value="${esc(toBox(o.starts_at))}">`)}${field("Ends <em>(optional)</em>", `<input type="datetime-local" data-k="ends_at" value="${esc(toBox(o.ends_at))}">`)}</div>`;
  const onTick = (o, words) => `<label class="pb-check"><input type="checkbox" data-k="active"${o.active ? " checked" : ""}> ${words}</label>`;
  const ticks = (o, skip) => `<div class="so-ticks">${PACKS.filter((p) => p.id !== skip).map((p) => `<label class="pb-check"><input type="checkbox" data-pack="${esc(p.id)}"${(o.pack_ids || []).includes(p.id) ? " checked" : ""}> ${esc(p.title)}</label>`).join("") || '<p class="pb-hint">No packs in the shop yet.</p>'}</div>`;
  const packSelect = (o) => `<select data-k="pack_id"><option value="">Choose a pack</option>${PACKS.map((p) => `<option value="${esc(p.id)}"${p.id === o.pack_id ? " selected" : ""}>${esc(p.title)} (${esc(gbp(p.price_pence))})</option>`).join("")}</select>`;
  const nameBox = (o, eg) => field("What customers see it called <em>(optional)</em>", `<input type="text" data-k="label" maxlength="40" value="${esc(o.label)}" placeholder="${eg}">`);

  function card(o) {
    const key = o.id || o._draft, st = o.id ? state(o) : ["Not saved yet", "wait"];
    const head = { bogof: "Buy one, get one free", sitewide: "Site-wide discount", member: "Members' price", bundle: "Bundle price", pack: "Discount on one pack" }[o.kind];
    let body = "";
    if (o.kind === "bogof") body = `${onTick(o, "On")}
      <div class="pb-two">${nameBox(o, "e.g. Black Friday: buy one, get one free")}<span></span></div>
      ${dates(o)}
      <div class="pb-field"><span>Packs left out of it</span>${ticks(o)}</div>
      <p class="pb-hint">The packs in a basket pair up, dearest first. In each pair the dearer is paid for at its usual price and the other is free; neither gets another discount. A pack left over, when there's an odd number, keeps its own discount. A basket never costs more this way than with the packs' own discounts.</p>`;
    if (o.kind === "sitewide") body = `${onTick(o, "On")}
      <div class="pb-two">${field("Percentage off", `<input type="number" data-k="percent" min="1" max="100" step="0.5" value="${esc(o.percent)}" placeholder="e.g. 20">`)}${nameBox(o, "e.g. Black Friday")}</div>
      ${dates(o)}
      <div class="pb-field"><span>Packs left out of it</span>${ticks(o)}</div>`;
    if (o.kind === "member") body = `${onTick(o, "On")}
      <div class="pb-two">${field("Percentage off", `<input type="number" data-k="percent" min="1" max="100" step="0.5" value="${esc(o.percent)}" placeholder="e.g. 10">`)}${nameBox(o, "e.g. Members' price")}</div>
      ${dates(o)}
      <p class="pb-hint">For anyone signed in to a member account, on every pack. It's checked by their sign-in, so it can't be had from a shared link. Leave the dates empty for a price that's always on.</p>`;
    if (o.kind === "bundle") body = `${onTick(o, "On")}
      <div class="pb-two">${field("The pack that drops in price", packSelect(o))}${field("Its price in the bundle, before VAT", `<input type="text" inputmode="decimal" data-k="price_pence" value="${esc(pounds(o.price_pence))}" placeholder="e.g. 6">`)}</div>
      <div class="pb-field"><span>When the basket also holds any one of</span>${ticks(o, o.pack_id)}</div>
      <div class="pb-two">${nameBox(o, "e.g. Christmas bundle")}<span></span></div>
      ${dates(o)}`;
    if (o.kind === "pack") body = `${onTick(o, "On")}
      <div class="pb-three">${field("Pack", packSelect(o))}${field("Percentage off", `<input type="number" data-k="percent" min="1" max="100" step="0.5" value="${esc(o.percent)}" placeholder="e.g. 15">`)}${field("Or a sale price, before VAT", `<input type="text" inputmode="decimal" data-k="price_pence" value="${esc(pounds(o.price_pence))}" placeholder="e.g. 18">`)}</div>
      <div class="pb-two">${nameBox(o, "e.g. Launch price")}<span></span></div>
      ${dates(o)}`;
    const many = o.kind === "bundle" || o.kind === "pack";
    return `<div class="so-card" data-offer="${esc(key)}" data-kind="${o.kind}">
      <div class="strip"><div class="strip-t">${head}${many && o.pack_id ? `<span>${esc(title(o.pack_id))}</span>` : ""}</div><span class="chip ${st[1]}">${esc(st[0])}</span></div>
      <div class="so-body">${body}<p class="so-msg" hidden></p>
        <div class="so-acts">${many ? `<button type="button" class="mbtn" data-so-remove>${o.id ? "Delete" : "Cancel"}</button>` : ""}<button type="button" class="mbtn primary" data-so-save>Save</button></div></div>
    </div>`;
  }

  /* Try a basket (26 Nov): tick packs and see what the basket comes to, for
     anyone and for a signed-in member, by the Worker's own rules. It's how a
     plan like "buy one, get one free, 20% off the Christmas pack, 25% for
     members" is checked against the table it was agreed on, before it's on. */
  /* And on a day of your choosing (Danielle, 26 Nov): offers that start on
     different days (members from Friday, buy one, get one free on Monday)
     can each be checked before they begin, without touching their dates. */
  const TRY = new Set();
  let TRY_AT = "";
  // The Edit as it will be on that day (an empty as_of goes back to now).
  const tryShopHref = () => `/edit?as_of=${encodeURIComponent(fromBox(TRY_AT) || "")}`;
  function tryOut() {
    const packs = PACKS.filter((p) => TRY.has(p.id));
    if (!packs.length) return "Tick the packs to put in the basket.";
    const at = fromBox(TRY_AT), offers = at ? liveAt(Date.parse(at)) : liveNow();
    const say = (member) => {
      const ls = shopPrice(packs, offers, member), total = ls.reduce((n, l) => n + l.pence, 0);
      const parts = ls.map((l) => `${esc(l.title)} ${l.pence === 0 ? "free" : esc(gbp(l.pence))}${l.label && l.pence > 0 && l.pence < l.list_pence ? ` <span class="pb-tx">${esc(l.label)}</span>` : ""}`);
      return `<b>${esc(gbp(total))}</b> <span class="pb-tx">(${parts.join(", ")})</span>`;
    };
    return `${at ? `On ${esc(whenWords(at))}:<br>` : ""}Anyone pays ${say(false)}<br>A signed-in member pays ${say(true)}`;
  }
  // What everything costs this minute, by the Worker's own rules.
  function pricesNow() {
    const live = liveNow();
    const row = (p) => {
      const a = shopPrice([p], live, false)[0], m = shopPrice([p], live, true)[0];
      const cell = (l) => (l.pence < l.list_pence ? `${esc(gbp(l.pence))} <span class="pb-tx">${esc(l.label || "")}</span>` : esc(gbp(l.pence)));
      return `<tr><td>${esc(p.title)}</td><td class="tx">${esc(gbp(a.list_pence))}</td><td>${cell(a)}</td><td>${cell(m)}</td></tr>`;
    };
    const bundles = live.filter((o) => o.kind === "bundle" && o.pack_id && o.price_pence != null);
    return `<div class="so-card"><div class="strip"><div class="strip-t">Prices right now</div><span class="aside">Before VAT</span></div>
      <div class="so-body"><div class="tablewrap" data-lenis-prevent><table><thead><tr><th>Pack</th><th>Usual price</th><th>Anyone</th><th>Signed-in member</th></tr></thead><tbody>${PACKS.map(row).join("") || '<tr><td colspan="4" class="tx">No packs in the shop yet.</td></tr>'}</tbody></table></div>
      ${bundles.map((b) => `<p class="pb-hint">${esc(title(b.pack_id))} is ${esc(gbp(b.price_pence))} in a basket with ${esc((b.pack_ids || []).filter((id) => id !== b.pack_id).map(title).join(", ") || "no pack chosen yet")}.</p>`).join("")}
      ${live.some((o) => o.kind === "bogof") ? '<p class="pb-hint">Buy one, get one free is on. It doesn\'t change a pack\'s own price, so it doesn\'t show in the table: it works across the basket. Try one below.</p>' : ""}
      <p class="pb-hint">A pack gets one discount, whichever leaves it cheapest. They never add together, and a bundle price is never reduced further.</p>
      <div class="pb-two">${field("Try a basket on <em>(empty for now)</em>", `<input type="datetime-local" id="so-try-at" value="${esc(TRY_AT)}">`)}<span></span></div>
      <div class="pb-field"><span>Try a basket</span><div class="so-ticks">${PACKS.map((p) => `<label class="pb-check"><input type="checkbox" data-try="${esc(p.id)}"${TRY.has(p.id) ? " checked" : ""}> ${esc(p.title)}</label>`).join("")}</div></div>
      <p class="so-try" id="so-try-out">${tryOut()}</p>
      <div class="so-acts so-acts--left"><a class="mbtn" id="so-try-open" href="${esc(tryShopHref())}" target="_blank" rel="noopener">Open the shop on this day</a></div>
      <p class="pb-hint">Opens The Edit with prices as they'll be on the day above, for you and the test logins only, paying in Stripe's test mode. Packs you already have can go in the basket again there, so any basket can be tried. Customers aren't affected.</p></div></div>`;
  }

  function draw() {
    if (!loaded) { root.innerHTML = '<p class="pb-state">Loading the offers…</p>'; return; }
    if (MISSING) { root.innerHTML = '<p class="pb-state">Offers aren\'t set up on the database yet. Run supabase/shop_basket.sql in the Supabase SQL editor, then reload this page.</p>'; return; }
    const one = (kind) => OFFERS.find((o) => o.kind === kind) || DRAFTS.find((o) => o.kind === kind) || { kind, _draft: `new-${kind}`, active: false, pack_ids: [] };
    const many = (kind) => [...OFFERS.filter((o) => o.kind === kind), ...DRAFTS.filter((o) => o.kind === kind)];
    const banner = SET.banner_on && String(SET.banner_text || "").trim() ? state({ active: true, starts_at: SET.banner_starts_at, ends_at: SET.banner_ends_at }) : ["Off", "off"];
    root.innerHTML = `
      <div class="so-card" id="so-basket"><div class="strip"><div class="strip-t">The basket</div><span class="chip ${SET.basket_live ? "good" : "wait"}">${SET.basket_live ? "On for everyone" : "Being tried"}</span></div>
        <div class="so-body"><p class="pb-hint">${SET.basket_live
          ? "Everyone has the basket: Add to basket and Buy now on every pack, one payment for several packs, and the offers below."
          : "The shop is as it was for everyone else. The team and the test logins have the basket, so it can be tried first: a test login pays in Stripe's test mode with a test card, and no money is taken. The offers below only reach people who have the basket."}</p>
        <div class="so-acts"><button type="button" class="mbtn${SET.basket_live ? "" : " primary"}" data-so-basket="${SET.basket_live ? "0" : "1"}">${SET.basket_live ? "Take the basket away again" : "Switch the basket on for everyone"}</button></div></div></div>
      ${pricesNow()}
      ${card(one("bogof"))}
      ${card(one("sitewide"))}
      ${many("bundle").map(card).join("")}
      <div class="so-add"><button type="button" class="mbtn" data-so-new="bundle">Add a bundle</button></div>
      ${card(one("member"))}
      ${many("pack").map(card).join("")}
      <div class="so-add"><button type="button" class="mbtn" data-so-new="pack">Add a discount on one pack</button></div>
      ${BANNER_READY ? `<div class="so-card" id="so-banner"><div class="strip"><div class="strip-t">Shop banner</div><span class="chip ${banner[1]}">${esc(banner[0])}</span></div>
        <div class="so-body"><label class="pb-check"><input type="checkbox" data-b="banner_on"${SET.banner_on ? " checked" : ""}> On</label>
        ${field("What it says", `<input type="text" data-b="banner_text" maxlength="120" value="${esc(SET.banner_text)}" placeholder="e.g. 20% off every pack this weekend">`, "One line, across the top of The Edit and every pack page.")}
        <div class="pb-two">${field("Starts <em>(optional)</em>", `<input type="datetime-local" data-b="banner_starts_at" value="${esc(toBox(SET.banner_starts_at))}">`)}${field("Ends <em>(optional)</em>", `<input type="datetime-local" data-b="banner_ends_at" value="${esc(toBox(SET.banner_ends_at))}">`)}</div>
        <p class="so-msg" hidden></p><div class="so-acts"><button type="button" class="mbtn primary" data-so-banner>Save</button></div></div></div>` : ""}`;
  }

  const say = (el, text) => { const m = el.querySelector(".so-msg"); if (m) { m.textContent = text || ""; m.hidden = !text; } };
  const offerOf = (key) => OFFERS.find((o) => o.id === key) || DRAFTS.find((o) => o._draft === key) || { kind: key.replace(/^new-/, ""), _draft: key, active: false, pack_ids: [] };

  // What the card's boxes say, checked. Returns the row to save, or the reason it can't be.
  function read(el, o) {
    const v = (k) => { const i = el.querySelector(`[data-k="${k}"]`); return i ? (i.type === "checkbox" ? i.checked : i.value.trim()) : undefined; };
    const row = { kind: o.kind, active: !!v("active"), label: v("label") || null, percent: null, price_pence: null, pack_id: null,
      pack_ids: [...el.querySelectorAll("[data-pack]:checked")].map((i) => i.dataset.pack), starts_at: fromBox(v("starts_at")), ends_at: fromBox(v("ends_at")), updated_at: new Date().toISOString() };
    const pct = v("percent") === undefined || v("percent") === "" ? null : Number(v("percent"));
    const price = v("price_pence") === undefined ? null : penceOf(v("price_pence"));
    if (pct != null && !(pct > 0 && pct <= 100)) return { error: "The percentage needs to be between 1 and 100." };
    if (v("price_pence") && price == null) return { error: "That price isn't a number. Type it in pounds, such as 6 or 18.50." };
    if (row.starts_at && row.ends_at && Date.parse(row.ends_at) <= Date.parse(row.starts_at)) return { error: "The end is before the start." };
    if (o.kind === "bogof") { row.percent = null; row.price_pence = null; }
    if (o.kind === "sitewide" || o.kind === "member") { if (pct == null) return { error: "Add the percentage off." }; row.percent = pct; if (o.kind === "member") row.pack_ids = []; }
    if (o.kind === "bundle") {
      row.pack_id = v("pack_id") || null; row.price_pence = price;
      if (!row.pack_id) return { error: "Choose the pack that drops in price." };
      if (price == null) return { error: "Add its price in the bundle." };
      row.pack_ids = row.pack_ids.filter((id) => id !== row.pack_id);
      if (!row.pack_ids.length) return { error: "Tick at least one pack it has to be bought with." };
      const p = PACKS.find((x) => x.id === row.pack_id);
      if (p && price >= p.price_pence) return { error: `That's not below its usual price of ${gbp(p.price_pence)}.` };
    }
    if (o.kind === "pack") {
      row.pack_id = v("pack_id") || null; row.pack_ids = [];
      if (!row.pack_id) return { error: "Choose the pack." };
      if (pct == null && price == null) return { error: "Add a percentage off or a sale price." };
      if (pct != null && price != null) return { error: "Use the percentage or the sale price, not both." };
      row.percent = pct; row.price_pence = price;
      const p = PACKS.find((x) => x.id === row.pack_id);
      if (p && price != null && price >= p.price_pence) return { error: `That's not below its usual price of ${gbp(p.price_pence)}.` };
    }
    return { row };
  }

  // Try a basket: only its answer is redrawn, so nothing typed in the boxes below is lost.
  root.addEventListener("change", (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.id === "so-try-at") { TRY_AT = t.value; const out = document.getElementById("so-try-out"); if (out) out.innerHTML = tryOut(); const a = document.getElementById("so-try-open"); if (a) a.href = tryShopHref(); return; }
    if (!(t instanceof HTMLInputElement) || !t.dataset.try) return;
    if (t.checked) TRY.add(t.dataset.try); else TRY.delete(t.dataset.try);
    const out = document.getElementById("so-try-out"); if (out) out.innerHTML = tryOut();
  });
  root.addEventListener("click", async (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    let b;
    if ((b = t.closest("[data-so-new]"))) { DRAFTS.push({ kind: b.dataset.soNew, _draft: `new-${b.dataset.soNew}-${Date.now()}`, active: false, pack_ids: [] }); return draw(); }
    if ((b = t.closest("[data-so-basket]"))) {
      const on = b.dataset.soBasket === "1";
      // Two presses: it changes the shop for everyone.
      if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = on ? "Press again to switch it on for everyone" : "Press again to take it away"; setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; draw(); } }, 5000); return; }
      b.disabled = true;
      const { data, error } = await supabase.from("shop_settings").update({ basket_live: on, updated_at: new Date().toISOString() }).eq("id", 1).select("basket_live");
      if (error || !data || !data.length) { toast("That didn't save: " + ((error && error.message) || "nothing came back")); return draw(); }
      SET.basket_live = data[0].basket_live;
      draw();
      return toast(on ? "The basket is on for everyone." : "The basket is off. The shop is as it was for everyone but the team and the test logins.");
    }
    if (t.closest("[data-so-banner]")) {
      const el = document.getElementById("so-banner"), g = (k) => el.querySelector(`[data-b="${k}"]`);
      const patch = { banner_on: g("banner_on").checked, banner_text: g("banner_text").value.trim() || null, banner_starts_at: fromBox(g("banner_starts_at").value), banner_ends_at: fromBox(g("banner_ends_at").value), updated_at: new Date().toISOString() };
      if (patch.banner_on && !patch.banner_text) return say(el, "Add what the banner says.");
      if (patch.banner_starts_at && patch.banner_ends_at && Date.parse(patch.banner_ends_at) <= Date.parse(patch.banner_starts_at)) return say(el, "The end is before the start.");
      const { data, error } = await supabase.from("shop_settings").update(patch).eq("id", 1).select("*");
      if (error || !data || !data.length) return say(el, "That didn't save: " + ((error && error.message) || "nothing came back"));
      SET = data[0]; draw();
      return toast("Banner saved.");
    }
    const el = t.closest("[data-offer]");
    if (!el) return;
    const o = offerOf(el.dataset.offer);
    if (t.closest("[data-so-remove]")) {
      if (!o.id) { DRAFTS = DRAFTS.filter((d) => d._draft !== o._draft); return draw(); }
      const btn = t.closest("[data-so-remove]");
      if (btn.dataset.armed !== "1") { btn.dataset.armed = "1"; btn.textContent = "Press again to delete"; return; }
      const { data, error } = await supabase.from("shop_offers").delete().eq("id", o.id).select("id");
      if (error || !data || !data.length) return say(el, "That didn't delete: " + ((error && error.message) || "nothing came back"));
      OFFERS = OFFERS.filter((x) => x.id !== o.id); draw();
      return toast("Deleted.");
    }
    if (t.closest("[data-so-save]")) {
      const { row, error: why } = read(el, o);
      if (why) return say(el, why);
      say(el, "");
      const q = o.id ? supabase.from("shop_offers").update(row).eq("id", o.id).select("*") : supabase.from("shop_offers").insert(row).select("*");
      const { data, error } = await q;
      // "Saved" only when the database hands the row back.
      if (error && /shop_offers_kind_check/.test(error.message || "")) return say(el, "The database doesn't know this kind of offer yet. Run supabase/shop_bogof.sql in the Supabase SQL editor, then save again.");
      if (error || !data || !data.length) return say(el, "That didn't save: " + ((error && error.message) || "nothing came back"));
      if (o.id) OFFERS = OFFERS.map((x) => (x.id === o.id ? data[0] : x)); else { OFFERS.push(data[0]); DRAFTS = DRAFTS.filter((d) => d._draft !== o._draft); }
      draw();
      const st = state(data[0]);
      toast(`Saved. ${st[1] === "good" ? "It's on now." : st[1] === "wait" ? st[0] + "." : "It's off."}`);
    }
  });

  return {
    async show() {
      if (!loaded) { draw(); await load(); }
      draw();
    },
  };
}
