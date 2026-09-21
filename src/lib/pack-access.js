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

// Packs the member can open in their Studio.
export function ownedPacks(packs, paidPackIds) {
  const paid = paidPackIds instanceof Set ? paidPackIds : new Set(paidPackIds || []);
  return (packs || []).filter((p) => p && (
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
