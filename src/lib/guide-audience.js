/* Who a guide is for (Dani, 13 Oct; 30 Oct).
 *
 *   public    everyone
 *   members   any signed-in member (the default)
 *   teg       agents of The Experts Group, apart from Fine & Country: anybody
 *             our CRM has in a TEG brand other than F&C -- the same
 *             member_brands() that decides who sees the brand print packs
 *             (src/lib/pack-access.js). Dani, 30 Oct: the print training is
 *             "available to TEG members only, excluding Fine and Country".
 *             An agent in F&C and another brand counts through the other.
 *
 * A guide can also carry `brands`, a list: then only agents in one of those
 * brands see it -- the print materials guides, one per brand.
 *
 * The Learn page leaves a guide out of the list, and the reader shows a short
 * note instead of the guide, for anyone it is not for. Nothing in a guide is
 * secret, so this is about showing people what is relevant to them. */
import { memberBrandsFor } from './pack-access.js';

const norm = (b) => String(b || '').trim().toLowerCase().replace(/\s+and\s+/g, ' & ');
const NOT_PRINT = new Set(['fine & country']);

export async function guideViewer(supabase) {
  // Local testing only: ?asTeg shows the site as an Experts Group agent sees it.
  try { if (import.meta.env.DEV && new URLSearchParams(location.search).has('asTeg')) return { teg: true, brands: ['the property experts'] }; } catch (_) {}
  const list = await memberBrandsFor(supabase);
  const brands = (Array.isArray(list) ? list : []).map(norm).filter(Boolean);
  return { teg: brands.some((b) => !NOT_PRINT.has(b)), brands };
}

export function guideVisibleTo(guide, viewer) {
  if (!guide) return true;
  if (Array.isArray(guide.brands) && guide.brands.length) {
    const mine = new Set((viewer && viewer.brands) || []);
    return guide.brands.some((b) => mine.has(norm(b)));
  }
  if (guide.audience !== 'teg') return true;
  return !!(viewer && viewer.teg);
}
