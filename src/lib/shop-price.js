/* What a pack costs in the shop right now (Danielle, 26 Nov 2026).
 *
 * One set of rules, used by the Worker, which is the only thing that decides
 * what anyone is charged (worker/src/index.js: /shop/offers, /shop/quote,
 * /shop/checkout). It lives here, not in the Worker, so it can be tested on
 * its own and so the admin's Offers page can show what an offer will do.
 *
 * A pack gets ONE discount, the one that leaves it cheapest. Discounts never
 * go on top of each other:
 *   sitewide  a percentage off everything, bar the packs it leaves out (pack_ids)
 *   pack      a percentage, or a sale price, on the one pack (pack_id)
 *   member    a percentage for anyone signed in
 *   bundle    a set price for one pack (pack_id) while the basket also holds a
 *             pack from its group (pack_ids). That price is never reduced
 *             further. If the pack's own discount is already lower than the
 *             bundle price, it keeps that instead, so a bundle can never cost
 *             a customer more. The other pack in the bundle is priced like
 *             any other pack: leave it out of the site-wide discount if it
 *             shouldn't have both.
 *
 * Then, across the whole basket (Danielle, 26 Nov, for Black Friday):
 *   bogof     buy one, get one free, on every pack bar the ones it leaves out
 *             (pack_ids). The packs pair up, dearest first: in each pair the
 *             dearer is paid for at its USUAL price and the other is free.
 *             A pack in a pair gets no other discount. With an odd number,
 *             one pack is left over and keeps its own discount (20% off the
 *             Christmas pack; a member's 25%), and the one left over is
 *             whichever makes the basket cheapest. If the packs' own
 *             discounts would come to less than pairing them, the basket
 *             gets those instead: buy one, get one free never costs more.
 *
 *   Her table, core packs £24, the Christmas pack £15 with 20% off, members 25%:
 *     Christmas only            £12       member £11.25
 *     one core                  £24       member £18
 *     core + Christmas          £24       member £24
 *     two core                  £24       member £24
 *     two core + Christmas      £36       member £35.25
 *     three core                £48       member £42
 *
 * Prices are pence, before VAT. `offers` are the ones that count now: switched
 * on and inside their dates (the Worker filters them).
 */
export const shopPctOff = (pence, pct) => Math.max(0, Math.round(pence * (100 - Number(pct)) / 100));
export const shopPctWords = (p) => `${Number(p)}% off`;

export function shopPrice(packs, offers, member) {
  const ids = packs.map((p) => p.id);
  const lines = packs.map((p) => {
    const list = Math.max(0, Math.round(Number(p.price_pence) || 0));
    let best = { pence: list, kind: null, label: null };
    const take = (pence, kind, label) => { if (pence < best.pence) best = { pence: Math.max(0, Math.round(pence)), kind, label }; };
    for (const o of offers) {
      if (o.kind === "sitewide" && o.percent && !(o.pack_ids || []).includes(p.id)) take(shopPctOff(list, o.percent), "sitewide", o.label || shopPctWords(o.percent));
      else if (o.kind === "pack" && o.pack_id === p.id) {
        if (o.price_pence != null) take(o.price_pence, "pack", o.label || "Sale price");
        else if (o.percent) take(shopPctOff(list, o.percent), "pack", o.label || shopPctWords(o.percent));
      } else if (o.kind === "member" && member && o.percent) take(shopPctOff(list, o.percent), "member", o.label || "Members' price");
    }
    for (const o of offers) {
      if (o.kind !== "bundle" || o.pack_id !== p.id || o.price_pence == null) continue;
      if ((o.pack_ids || []).some((id) => id !== p.id && ids.includes(id))) take(o.price_pence, "bundle", o.label || "Bundle price");
    }
    return { pack_id: p.id, slug: p.slug, title: p.title, cover_image_url: p.cover_image_url || null, list_pence: list, pence: best.pence, kind: best.kind, label: best.label };
  });
  return shopBogof(lines, offers);
}

// Buy one, get one free, over lines already carrying each pack's own price.
function shopBogof(lines, offers) {
  const deal = offers.find((o) => o.kind === "bogof");
  if (!deal) return lines;
  const out = (deal.pack_ids || []);
  const elig = lines.map((l, i) => i).filter((i) => !out.includes(lines[i].pack_id) && lines[i].list_pence > 0);
  if (elig.length < 2) return lines;
  const sum = (arr) => arr.reduce((n, l) => n + l.pence, 0);
  // Pair these up, dearest first (the basket's own order settles a tie): pays, free, pays, free.
  const paired = (idx) => {
    const order = [...idx].sort((a, b) => lines[b].list_pence - lines[a].list_pence || a - b);
    const next = lines.map((l) => ({ ...l }));
    for (let k = 0; k + 1 < order.length; k += 2) {
      const pay = order[k], free = order[k + 1];
      next[pay] = { ...next[pay], pence: next[pay].list_pence, kind: null, label: null, pays_for: next[free].title };
      next[free] = { ...next[free], pence: 0, kind: "bogof", label: deal.label || "Buy one, get one free", free_with: next[pay].title };
    }
    return next;
  };
  // An even number all pair. An odd number leaves one pack to its own discount: try each.
  const tries = elig.length % 2 === 0 ? [paired(elig)] : elig.map((left) => paired(elig.filter((i) => i !== left)));
  let best = lines;
  for (const t of tries) if (sum(t) < sum(best)) best = t;
  return best;
}

// The packs the shop sells: the same rule as the shop page (pack-access.js, shopPacks).
export const shopSells = (p) => !!p && (p.kind || "social") !== "print" && (p.access || "buy") === "buy" && p.demo !== true;

// "A", "A and B", "A, B and C".
export const shopNames = (titles) => (titles.length > 1 ? titles.slice(0, -1).join(", ") + " and " + titles[titles.length - 1] : titles[0] || "");
