/* Who a guide is for (Dani, 13 Oct).
 *
 *   public    everyone
 *   members   any signed-in member (the default)
 *   teg       agents of The Experts Group only: anybody our CRM has in one of
 *             the TEG brands -- the same member_brands() that decides who sees
 *             the brand print packs (src/lib/pack-access.js).
 *
 * The Learn page leaves a guide out of the list, and the reader shows a short
 * note instead of the guide, for anyone it is not for. Nothing in a guide is
 * secret, so this is about showing people what is relevant to them. */
import { memberBrandsFor } from './pack-access.js';

export async function guideViewer(supabase) {
  // Local testing only: ?asTeg shows the site as an Experts Group agent sees it.
  try { if (import.meta.env.DEV && new URLSearchParams(location.search).has('asTeg')) return { teg: true }; } catch (_) {}
  const brands = await memberBrandsFor(supabase);
  return { teg: Array.isArray(brands) && brands.length > 0 };
}

export function guideVisibleTo(guide, viewer) {
  if (!guide || guide.audience !== 'teg') return true;
  return !!(viewer && viewer.teg);
}
