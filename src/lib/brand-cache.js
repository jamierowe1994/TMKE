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

export function readBrandCache() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { return null; }
}

/** Write the kit to the cache, stamped with its owner. */
export function writeBrandCache(kit, uid) {
  if (!kit || typeof kit !== "object") return;
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
