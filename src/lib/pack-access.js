/* Who has which packs.
 *
 * Until print, the answer was simple: you have the packs you paid for, plus
 * the demo. Print packs are not bought — they are drawn for a TEG brand and
 * handed to its agents — so "owned" has to mean three more things:
 *
 *   demo              free with every account
 *   access 'members'  free to any member
 *   access 'brands'   free to the agents of the brands it names
 *
 * The brand check is NOT done here. The database does it: a member can only
 * read a brand pack their own brand is named on (supabase/print_packs.sql).
 * So by the time a pack row reaches this file, the member is allowed it — and
 * a rule that lives in one place can't drift from the other copy of itself.
 */

/* Packs the member can open in their Studio.
 *
 * `visibleToMember` is the rule on its own, for the places that are not asking
 * "which packs do they have" but "which packs exist as far as they are
 * concerned" — the dashboard's new-pack card, for one.
 *
 * `memberBrand` is the brand this account actually belongs to, from the
 * database's own member_brand(). It is needed because the RLS above lets
 * STAFF read every pack — right for the Admin Centre, wrong for their own
 * Studio, where somebody at TMKE was being shown a Property Experts print
 * pack they are not a Property Expert in. Trusting the database alone was
 * only ever true for people who are not staff.
 *
 *   a string     they are in that brand: brand packs naming it, and no others
 *   null         we asked and they are in no brand: no brand packs at all
 *   undefined    we could not ask. Fall back to what the database allowed,
 *                so a lookup that fails takes nobody's pack away from them.
 */
/* `memberBrand` may also be a LIST: an agent in two brands sees both brands'
 * packs. Dani, 13 Oct: "say somebody is a Prestige agent but they're also a
 * TPE, but Prestige is their main one, then they should be able to see TPE's
 * packs as well." The database already allowed it (member_brands()); this
 * page-side check only ever asked for the main brand. */
export function visibleToMember(packs, memberBrand) {
  const norm = (v) => (v == null ? '' : String(v).trim().toLowerCase());
  const mine = new Set((Array.isArray(memberBrand) ? memberBrand : [memberBrand]).map(norm).filter(Boolean));
  return (packs || []).filter((p) => {
    if (!p || p.access !== 'brands') return !!p;
    if (memberBrand === undefined) return true;            // could not ask
    if (!mine.size) return false;                          // asked: no brand
    return (Array.isArray(p.brands) ? p.brands : []).some((b) => mine.has(norm(b)));
  });
}

/* Every brand this account is in, from the database: an array (empty when
 * none), or undefined when it could not be asked -- which takes nobody's pack
 * away. Falls back to the single main brand if member_brands() is missing. */
export async function memberBrandsFor(supabase) {
  try {
    const r = await supabase.rpc('member_brands');
    if (!r.error && Array.isArray(r.data)) return r.data;
  } catch (_) {}
  try {
    const r = await supabase.rpc('member_brand');
    if (!r.error) return r.data ? [r.data] : [];
  } catch (_) {}
  return undefined;
}

export function ownedPacks(packs, paidPackIds, memberBrand) {
  const paid = paidPackIds instanceof Set ? paidPackIds : new Set(paidPackIds || []);
  return visibleToMember(packs, memberBrand).filter((p) => (
    paid.has(p.id)
    || p.demo === true
    || p.access === 'members'
    || p.access === 'brands'
  ));
}

/* Packs the shop may offer. A pack given to a brand is not for sale at £0 to
 * everyone else who happens to be in that brand — it isn't for sale at all,
 * and print packs have no place in a shop built for social designs. */
export function shopPacks(packs) {
  return (packs || []).filter((p) => p
    && (p.kind || 'social') !== 'print'
    && (p.access || 'buy') === 'buy'
    && p.demo !== true);
}
