/* Keep a member's kit in step with their brand, on arrival.
 *
 * Runs when somebody lands in the hub or opens the Studio. Cheap: one call,
 * and the Worker decides whether anything needs doing. Nothing to schedule,
 * nothing to push out to hundreds of members when a brand changes — the change
 * finds them next time they turn up.
 *
 * Three outcomes worth knowing about:
 *   seeded   they had no kit; their brand's is now theirs
 *   updated  a field they had not touched followed the brand
 *   offer    they built their own kit before brand kits existed. Nothing is
 *            changed. They are asked, on screen, and they choose.
 */

const WORKER = (import.meta.env.PUBLIC_R2_WORKER_URL || '').replace(/\/+$/, '');
const ASKED_KEY = 'tmke.brand.offer.declined.';

export async function syncBrandKit(supabase, { onOffer } = {}) {
  if (!WORKER) return null;
  let session = null;
  try { ({ data: { session } } = await supabase.auth.getSession()); } catch (_) {}
  const token = session?.access_token;
  const uid = session?.user?.id;
  if (!token || !uid) return null;

  let out = null;
  try {
    const res = await fetch(WORKER + '/member/brand-sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    });
    out = await res.json().catch(() => null);
  } catch (_) { return null; }
  if (!out || !out.ok) return null;

  // A kit that changed under them: the cache has to follow or the next save
  // writes the old values straight back over it.
  /* photoChanged matters on its own: the brand photo follows the brand in
     every state, including "offer" -- somebody who kept their own kit still
     gets their brand's photograph of them, and the cache has to hear about it
     or the studio keeps drawing the empty slot. */
  if (out.state === 'seeded' || out.state === 'updated' || out.photoChanged) {
    try {
      const { data } = await supabase
        .from('member_brand_kits').select('kit').eq('user_id', uid).maybeSingle();
      if (data && data.kit) {
        const { writeBrandCache } = await import('./brand-cache.js');
        writeBrandCache(data.kit, uid);
        try { window.dispatchEvent(new CustomEvent('tmke:brand-changed', { detail: data.kit })); } catch (_) {}
      }
    } catch (_) {}
  }

  // Asked once. Somebody who said "keep mine" is not asked again on every visit.
  if (out.state === 'offer' && typeof onOffer === 'function') {
    let declined = false;
    try { declined = !!localStorage.getItem(ASKED_KEY + uid); } catch (_) {}
    if (!declined) onOffer(out, { token, uid });
  }
  return out;
}

export async function adoptBrandKit(token, brand) {
  const res = await fetch(WORKER + '/member/brand-adopt', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand }),
  });
  return res.json().catch(() => ({}));
}

export async function keepOwnBrandKit(token, brand, uid) {
  try { localStorage.setItem(ASKED_KEY + uid, '1'); } catch (_) {}
  const res = await fetch(WORKER + '/member/brand-adopt', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand, decline: true }),
  });
  return res.json().catch(() => ({}));
}
