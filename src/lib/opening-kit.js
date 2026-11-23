/**
 * The kit a member's designs open in, when it is not the one this browser
 * holds (Danielle, 23 Nov 2026).
 *
 * Someone in two brands has a kit for each. The Brand Kit page lets them pick
 * one "to see and edit it", and makes that brand's kit the saved one, naming
 * it in `activeBrand` and keeping the others beside it under `byBrand`. So the
 * kit in "tmke.brand" is whichever brand they last LOOKED at, not the one
 * their work opens in. That one is their main brand, set on their contact
 * ("Open their Studio in this brand"), and only the Worker knows it.
 *
 * Resolves { brand, kit } when the main brand's kit should be used instead of
 * the cached one, and null when the cached kit is already right: one brand,
 * never switched, or the Worker could not be asked. A kit with no
 * `activeBrand` has never been switched, so nobody in one brand pays for the
 * question.
 */
import { normaliseKit } from "./brand-cache.js";

export async function openingKit(supabase, cached) {
  try {
    const shown = cached && cached.activeBrand;
    if (!shown) return null;
    const WORKER = (import.meta.env.PUBLIC_R2_WORKER_URL || "").replace(/\/+$/, "");
    const { data: { session } } = await supabase.auth.getSession();
    const token = session && session.access_token;
    if (!WORKER || !token) return null;
    const r = await fetch(WORKER + "/member/brand-prefill", { headers: { Authorization: "Bearer " + token } });
    const first = await r.json().catch(() => null);
    const brands = (first && first.ok && Array.isArray(first.brands)) ? first.brands : [];
    const main = first && first.brand;
    if (brands.length < 2 || !main || main === shown) return null;
    // Theirs for that brand if they have edited it; the brand's own otherwise.
    const mine = cached.byBrand && cached.byBrand[main];
    const kit = normaliseKit(mine || first.kit);
    return kit && typeof kit === "object" ? { brand: main, kit } : null;
  } catch (_) { return null; }
}

/**
 * Which brand the Studio opens a design in, and whether a kit has to be put
 * on to get there. Three answers, in order: what a saved design was made as
 * or the brand its pack was drawn for (`want`), then their main brand.
 *
 * `shown` is the brand of the kit this browser holds (see above). A new
 * design never opens in it just because it was the last one looked at. A
 * saved design with no brand on it was drawn in that kit, so it stays in it
 * and the chip says so; nothing of theirs is redrawn.
 */
export function openingBrand({ want, shown, main, brands, savedDesign }) {
  const list = Array.isArray(brands) ? brands : [];
  const held = shown && list.includes(shown) ? shown : null;
  const target = want || ((savedDesign && held) ? held : (main || list[0] || null));
  const holds = held || main || null;   // the brand of the kit already on
  return { target, apply: !!((want && want !== main) || (target && target !== holds)) };
}
