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
      if (local && Number(local.updatedAt || 0) > Number(kit.updatedAt || 0)) return false;
      const strip = (k) => { const c = { ...(k || {}) }; delete c.owner; return JSON.stringify(c); };
      if (local && strip(local) === strip(kit)) return false;
      writeBrandCache(kit, uid);
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
