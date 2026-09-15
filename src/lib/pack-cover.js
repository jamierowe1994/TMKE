// A pack with no cover image set in admin shows as a blank tile in the hub.
// Rather than leave a hole, fall back to one of the pack's own templates:
// the "New to Market" static where the pack has one (Dani's pick for the demo
// pack), otherwise the first template in the pack's order. Only touches packs
// that have no cover of their own, and only costs a query when one turns up.
export async function fillPackCovers(supabase, packs) {
  const list = Array.isArray(packs) ? packs : [];
  const need = list.filter((p) => p && p.id && !p.cover_image_url);
  if (!need.length) return list;
  try {
    const { data } = await supabase
      .from("templates")
      .select("pack_id, name, thumb_url, render_url, sort_order")
      .in("pack_id", need.map((p) => p.id))
      .eq("status", "active")
      .order("sort_order", { ascending: true });
    const byPack = new Map();
    (data || []).forEach((t) => { const l = byPack.get(t.pack_id) || []; l.push(t); byPack.set(t.pack_id, l); });
    need.forEach((p) => {
      const tpls = byPack.get(p.id) || [];
      const pick = tpls.find((t) => /new to market/i.test(t.name || "")) || tpls[0];
      if (pick) p.cover_image_url = pick.thumb_url || pick.render_url || null;
    });
  } catch (_) { /* a blank tile is better than a broken page */ }
  return list;
}
