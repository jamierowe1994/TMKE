/* The pull-out menu's extras (Dani, 17 Oct): the notifications inside it,
   and the card for the newest pack the member hasn't bought. Used by the
   shared header (WorkspaceHeader.astro) and the dashboard's own copy.

   The notifications themselves are drawn by lib/notifications.js, which fills
   every .ws-notif-list on the page and minds every "Mark all read" -- this
   only opens and closes the menu's copy. */
import { ownedPacks, shopPacks, memberBrandsFor } from "./pack-access.js";
import { fillPackCovers } from "./pack-cover.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function wireDrawerBell() {
  document.querySelectorAll("[data-drawer]").forEach((dr) => {
    const bell = dr.querySelector("[data-drawer-bell]");
    const panel = dr.querySelector("[data-drawer-notifs]");
    const nav = dr.querySelector(".ws-drawer-nav");
    if (!bell || !panel || !nav) return;
    const show = (on) => {
      panel.hidden = !on; nav.hidden = on;
      bell.setAttribute("aria-expanded", on ? "true" : "false");
      bell.classList.toggle("is-on", on);
    };
    bell.addEventListener("click", () => show(panel.hidden));
    // Closing the menu brings it back to the menu next time.
    dr.querySelectorAll("[data-drawer-close]").forEach((c) => c.addEventListener("click", () => show(false)));
  });
}

/* The newest pack (by launch, then by when it was made) that is on sale and
   the member doesn't have. No such pack, no card. */
export async function fillDrawerPack(supabase) {
  const cards = [...document.querySelectorAll("[data-drawer-pack]")];
  if (!cards.length) return;
  try {
    let session = null;
    try { session = (await supabase.auth.getSession()).data.session; } catch (_) {}
    const email = (session && session.user.email) || "";
    const [packsRes, ordersRes, brands] = await Promise.all([
      supabase.from("packs").select("*").eq("status", "active"),
      session ? supabase.from("orders").select("pack_id, status").or(`user_id.eq.${session.user.id},buyer_email.ilike.${email}`) : Promise.resolve({ data: [] }),
      session ? memberBrandsFor(supabase) : Promise.resolve(undefined),
    ]);
    if (packsRes.error) return;
    const all = packsRes.data || [];
    const paid = new Set(((ordersRes && ordersRes.data) || []).filter((o) => o.status === "paid" && o.pack_id).map((o) => o.pack_id));
    const owned = new Set(ownedPacks(all, paid, brands).map((p) => p.id));
    const when = (p) => Date.parse(p.launched_at || p.created_at || "") || 0;
    const pick = shopPacks(all).filter((p) => !owned.has(p.id)).sort((a, b) => when(b) - when(a))[0];
    if (!pick) return;
    await fillPackCovers(supabase, [pick]);
    cards.forEach((card) => {
      card.href = `/edit/${encodeURIComponent(pick.slug)}`;
      const pic = card.querySelector(".ws-drawer-card-pic");
      if (pic && pick.cover_image_url) pic.style.backgroundImage = `url('${esc(pick.cover_image_url)}')`;
      const t = card.querySelector("strong"); if (t) t.textContent = pick.title;
      card.hidden = false;
    });
  } catch (_) { /* no card is better than a wrong one */ }
}
