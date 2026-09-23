/**
 * The brand kit belongs to a login, not a browser.
 *
 * The kit lives on the server (member_brand_kits, one row per user) and is
 * cached in this browser under "tmke.brand" so the Studio opens with it at
 * once. The cache carries the owner's user id. On a shared machine, or after
 * signing out and in as someone else, a cache that belongs to another user, or
 * to nobody, is thrown away and the server copy is fetched fresh. Sign-out
 * clears it too (src/lib/supabase.js).
 */
const KEY = "tmke.brand";

/**
 * A kit, in the shape the hub reads.
 *
 * A brand's logos are stored as { url, name } (brand_profiles) while a
 * member's kit has always used { src }, so a kit that arrived from a brand
 * drew nothing: every tile pointed at url(undefined). Colours had the same
 * mismatch and are converted in the Worker; logos are converted here, on the
 * way in AND on the way out, so kits already saved with the wrong shape mend
 * themselves the next time they are read.
 */
export function normaliseKit(kit) {
  if (!kit || typeof kit !== "object") return kit;
  const logos = Array.isArray(kit.logos) ? kit.logos : null;
  if (!logos || !logos.length) return kit;
  const out = logos
    .map((l) => (typeof l === "string" ? { src: l } : l))
    .filter(Boolean)
    .map((l) => ({ ...l, src: l.src || l.url || "" }))
    .filter((l) => l.src);
  out.forEach((l) => { delete l.url; });
  if (out.length && !out.some((l) => l.primary)) out[0].primary = true;
  const same = out.length === logos.length && out.every((l, i) => logos[i] && l.src === logos[i].src);
  return same ? kit : { ...kit, logos: out };
}

/**
 * Is this kit their brand's, give or take the shapes the two are stored in?
 *
 * The Worker asks the same question, but compares logos object for object: a
 * brand's are { url, name } and a member's { src, primary }, so a kit that came
 * straight from the brand never matched and "Using your own branding" showed
 * to people who were using their brand's. Compared here by what the fields
 * actually say.
 */
export function kitMatchesBrand(mine, brandKit) {
  if (!mine || !brandKit) return false;
  const t = (v) => (v == null ? "" : String(v).trim());
  const web = (v) => t(v).replace(/^https?:\/\//i, "").replace(/\/$/, "");
  const hexes = (list) => (Array.isArray(list) ? list : [])
    .map((c) => t(c && typeof c === "object" ? c.hex : c).toUpperCase()).filter(Boolean).join(",");
  const srcs = (list) => (Array.isArray(list) ? list : [])
    .map((l) => t(l && (l.src || l.url))).filter(Boolean).sort().join(",");
  const f = (k) => [t((mine.fonts || {})[k]), t((brandKit.fonts || {})[k])];
  const pairs = [
    [t(mine.company), t(brandKit.company)],
    [t(mine.slogan), t(brandKit.slogan)],
    [web(mine.website), web(brandKit.website)],
    [t(mine.tone), t(brandKit.tone)],
    [hexes(mine.colors), hexes(brandKit.colors)],
    [srcs(mine.logos), srcs(brandKit.logos)],
    f("heading"), f("subheading"), f("body"),
  ];
  // A field the brand holds nothing for cannot be a difference.
  return pairs.every(([a, b]) => b === "" || a === b);
}

export function readBrandCache() {
  try { return normaliseKit(JSON.parse(localStorage.getItem(KEY) || "null")); } catch (_) { return null; }
}

/** Write the kit to the cache, stamped with its owner. */
export function writeBrandCache(kit, uid) {
  if (!kit || typeof kit !== "object") return;
  kit = normaliseKit(kit);
  try { localStorage.setItem(KEY, JSON.stringify({ ...kit, owner: uid || kit.owner || null })); } catch (_) {}
}

export function clearBrandCache() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + ".skipped"); } catch (_) {}
}

/**
 * Keep only a cache that belongs to this user. Returns the kit if it is
 * theirs, null otherwise (and removes what was there).
 */
export function adoptBrandCache(uid) {
  const kit = readBrandCache();
  if (!kit) return null;
  if (uid && kit.owner === uid) return kit;
  clearBrandCache();
  return null;
}

/**
 * The same, for a page that has already painted from the cache: if another
 * user's kit was thrown away, reload once so nothing of theirs stays on screen.
 */
export function adoptBrandCacheOrReload(uid) {
  const before = readBrandCache();
  const kit = adoptBrandCache(uid);
  if (before && !kit) {
    try {
      if (!sessionStorage.getItem("tmke.brand.adopted")) { sessionStorage.setItem("tmke.brand.adopted", "1"); location.reload(); }
    } catch (_) {}
  }
  return kit;
}

/**
 * Make sure this browser holds the signed-in member's kit: fetch it from the
 * server and cache it, unless the cache is genuinely newer (edited on this
 * device and not yet synced up). A new laptop starts with no cache at all, so
 * without this the dashboard and the caption generator had no kit until the
 * Studio or the profile page happened to be opened first.
 *
 * Resolves true when the cache changed, so a page that has already drawn from
 * it can redraw. One fetch per page load however many callers ask. The demo
 * keeps its own kit and is left alone.
 */
/**
 * The brand-approved photo of this member, for the brand they design under.
 *
 * It is ours, not theirs: someone at TMKE sets it per person per brand in
 * Contacts, on `agent_profiles.brand_photo_url`, and it is the only picture
 * print may use. So it is read alongside the kit rather than kept in it — an
 * admin changing it reaches the member without them re-saving anything, and
 * there is no field in the Brand Kit for them to edit it away.
 *
 * Returns undefined when we could not look (no link from this login to a
 * contact, or the row is not readable), which means "leave whatever the kit
 * already says". Returns null when we looked and there is no photo.
 */
async function fetchBrandPhoto(supabase, uid, company) {
  try {
    const { data: contact, error: cErr } = await supabase
      .from("contacts").select("id").eq("user_id", uid).maybeSingle();
    if (cErr || !contact) return undefined;
    const { data: rows, error: aErr } = await supabase
      .from("agent_profiles")
      .select("brand, is_primary, brand_photo_url, left_at")
      .eq("contact_id", contact.id);
    if (aErr || !Array.isArray(rows)) return undefined;
    const here = rows.filter((r) => !r.left_at);
    if (!here.length) return null;
    const t = (v) => (v == null ? "" : String(v).trim().toLowerCase());
    // The brand they are designing under, then the one they mainly work for.
    const pick = here.find((r) => company && t(r.brand) === t(company))
      || here.find((r) => r.is_primary)
      || here[0];
    return (pick && pick.brand_photo_url) || null;
  } catch (_) { return undefined; }
}

let _sync = null;
export function syncBrandCache(supabase, uid) {
  if (!_sync) _sync = (async () => {
    try { if (localStorage.getItem("tmke_demo")) return false; } catch (_) { return false; }
    try {
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session ? session.user.id : null;
      }
      // Signed out: nobody's kit stays in the browser.
      if (!uid) { adoptBrandCache(null); return false; }
      const local = adoptBrandCache(uid);
      const { data } = await supabase.from("member_brand_kits").select("kit").eq("user_id", uid).maybeSingle();
      const kit = data && data.kit;
      if (!kit || typeof kit !== "object" || !Object.keys(kit).length) return false;
      /* Ours to set, so it is refreshed on every sync rather than trusted from
         whatever the kit was last saved with — including when the cache on
         this device is the newer one. A member who edited their kit an hour
         ago still gets the photo TMKE added five minutes ago. */
      const newerHere = local && Number(local.updatedAt || 0) > Number(kit.updatedAt || 0);
      const base = newerHere ? local : kit;
      const photo = await fetchBrandPhoto(supabase, uid, base.company);
      const full = photo === undefined ? base : { ...base, brandPhoto: photo };
      const strip = (k) => { const c = { ...(k || {}) }; delete c.owner; return JSON.stringify(c); };
      if (local && strip(local) === strip(full)) return false;
      writeBrandCache(full, uid);
      return true;
    } catch (_) { return false; }
  })();
  return _sync;
}

/**
 * A brand kit made in the demo (tmke.brand.demo) becomes the kit of the first
 * account that signs in on this browser with no kit of its own: written to
 * the server and to the cache, stamped with the owner. Returns true when it
 * did so, so the page can redraw.
 */
export async function claimDemoBrandKit(supabase, uid) {
  if (!uid) return false;
  let demo = null;
  try { demo = JSON.parse(localStorage.getItem("tmke.brand.demo") || "null"); } catch (_) {}
  if (!demo || typeof demo !== "object") return false;
  try {
    const { data } = await supabase.from("member_brand_kits").select("kit").eq("user_id", uid).maybeSingle();
    if (data && data.kit && typeof data.kit === "object" && Object.keys(data.kit).length) {
      localStorage.removeItem("tmke.brand.demo");   // they already have one; the demo's is not needed
      return false;
    }
    const kit = { ...demo, updatedAt: Date.now() };
    delete kit.owner;
    await supabase.from("member_brand_kits").upsert({ user_id: uid, kit, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    writeBrandCache(kit, uid);
    localStorage.removeItem("tmke.brand.demo");
    return true;
  } catch (_) { return false; }
}
