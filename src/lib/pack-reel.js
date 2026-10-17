/* The moving strip of pack designs (Dani, 16 Oct 2026): the dashboard's Be
   inspired and the Studio's Chapter 04.

   Dani's mockups when there are some (src/data/inspiration-reel.js), the
   packs' own templates until then. Each picture opens its pack in the Studio
   for someone who has it, or its page in The Edit for someone who hasn't. The
   strip stays empty until the first pictures have loaded -- nothing stands in
   for them -- and the styles are .ws-reel in ws-system.css.

   `runs` is how many from one pack sit together before the next pack: [1] on
   the dashboard (never two of a pack side by side), [2, 3] in the Studio
   (two, then three, then two... -- Dani). `perPack` caps each pack's share. */
import { INSPIRATION_REEL } from "../data/inspiration-reel.js";
import { ownedPacks, visibleToMember, memberBrandsFor } from "./pack-access.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function fillPackReel(supabase, reel, { runs = [1], perPack = 4 } = {}) {
  const track = reel && reel.querySelector(".ws-reel-track");
  if (!reel || !track) return false;
  try {
    let session = null;
    try { session = (await supabase.auth.getSession()).data.session; } catch (_) {}
    const email = (session && session.user.email) || "";
    const [packsRes, ordersRes, brands] = await Promise.all([
      supabase.from("packs").select("*").eq("status", "active").order("sort_order", { ascending: true }),
      session ? supabase.from("orders").select("pack_id, status").or(`user_id.eq.${session.user.id},buyer_email.ilike.${email}`) : Promise.resolve({ data: [] }),
      session ? memberBrandsFor(supabase) : Promise.resolve(undefined),
    ]);
    if (packsRes.error) return false;
    const all = packsRes.data || [];
    const paid = new Set(((ordersRes && ordersRes.data) || []).filter((o) => o.status === "paid" && o.pack_id).map((o) => o.pack_id));
    const owned = new Set(ownedPacks(all, paid, brands).map((p) => p.id));
    // Social packs on sale or already theirs; never the demo pack.
    const packs = visibleToMember(all, brands).filter((p) => !p.demo && (p.kind || "social") !== "print"
      && (owned.has(p.id) || (p.access || "buy") === "buy"));
    const bySlug = new Map(packs.map((p) => [p.slug, p]));
    const hrefFor = (p) => !p ? "/edit" : owned.has(p.id) ? `/account/editor?pack=${encodeURIComponent(p.id)}` : `/edit/${encodeURIComponent(p.slug)}`;
    const goFor = (p) => p && owned.has(p.id) ? "Open your pack" : "See the pack";

    let tiles = [];
    if (INSPIRATION_REEL.length) {
      tiles = INSPIRATION_REEL.filter((r) => r && r.image).map((r) => {
        const p = bySlug.get(r.pack);
        return { img: r.image, label: r.line || (p && p.title) || "", sub: r.line && p ? p.title : "", href: hrefFor(p), go: goFor(p) };
      });
    } else if (packs.length) {
      const { data: tpls } = await supabase.from("templates").select("pack_id, name, thumb_url, sort_order")
        .in("pack_id", packs.map((p) => p.id)).eq("status", "active").order("sort_order", { ascending: true });
      const byPack = new Map();
      (tpls || []).forEach((t) => { if (!t.thumb_url) return; const l = byPack.get(t.pack_id) || []; if (l.length < perPack) l.push(t); byPack.set(t.pack_id, l); });
      const lists = packs.map((p) => (byPack.get(p.id) || []).map((t) => ({ p, t }))).filter((l) => l.length);
      // Each pack in turn, a run of `runs[n]` from it each time round.
      const at = lists.map(() => 0);
      for (let turn = 0; lists.some((l, i) => at[i] < l.length); turn++) {
        const k = runs[turn % runs.length];
        lists.forEach((l, i) => { for (let j = 0; j < k && at[i] < l.length; j++) tiles.push(l[at[i]++]); });
      }
      // "Local Favourite - Community - Static" is shown as "Local Favourite".
      tiles = tiles.map(({ p, t }) => ({ img: t.thumb_url, label: p.title, sub: String(t.name || "").split(" - ")[0], href: hrefFor(p), go: goFor(p) }));
    }
    if (!tiles.length) { reel.setAttribute("aria-busy", "false"); return false; }

    return await drawReel(reel, tiles);
  } catch (_) { reel.setAttribute("aria-busy", "false"); return false; }
}

/* Draw a strip from tiles { img, label, href, go, sub?, caption? } and set
   it moving once the first pictures are in. Enough to fill a wide screen,
   then the whole set again, so sliding back by half lands on the same
   picture and the loop has no seam. `caption` puts the title under the
   picture (blog posts); packs go without. */
export async function drawReel(reel, tiles) {
  const track = reel && reel.querySelector(".ws-reel-track");
  if (!track || !tiles || !tiles.length) { reel && reel.setAttribute("aria-busy", "false"); return false; }
  let set = tiles.slice();
  while (set.length < 10) set = set.concat(tiles);
  // `inspo`: the tile opens that StudioInspo pop-out (Learn's This month).
  const tile = (t, copy) => `<a class="ws-reel-tile" href="${esc(t.href)}"${t.inspo ? ` data-inspo="${esc(t.inspo)}"` : ""}${copy ? ' data-copy aria-hidden="true" tabindex="-1"' : ""}>
      <span class="ws-reel-label">${esc(t.label)}</span>
      <span class="ws-reel-pic">${t.img ? `<img src="${esc(t.img)}" alt="${copy ? "" : esc(t.sub || t.label)}" decoding="async">` : ""}<span class="ws-reel-go">${esc(t.go)} &rarr;${t.desc ? `<span class="ws-reel-go-desc">${esc(t.desc)}</span>` : ""}</span></span>
      ${t.caption ? `<span class="ws-reel-cap">${esc(t.caption)}</span>` : ""}
    </a>`;
  track.innerHTML = set.map((t) => tile(t, false)).join("") + set.map((t) => tile(t, true)).join("");
  // About 12 seconds a picture: slow enough to read as it passes (Dani, 16 Oct).
  track.style.setProperty("--reel-dur", `${set.length * 12}s`);
  // Shown once the first few on screen have their pictures.
  const first = [...track.querySelectorAll("img")].slice(0, 5);
  await Promise.race([
    Promise.all(first.map((im) => im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  reel.classList.add("is-ready");
  reel.setAttribute("aria-busy", "false");
  return true;
}

/* The members' blog as a strip: every published piece for members, newest
   first, its category above and its title under. */
export async function fillPostReel(supabase, reel) {
  try {
    const { data, error } = await supabase.from("blog_posts")
      .select("slug, title, eyebrow, category, standfirst, hero_image_url, publish_date")
      .eq("status", "published").in("audience", ["members", "both"])
      .order("publish_date", { ascending: false }).limit(24);
    if (error || !data || !data.length) { reel.setAttribute("aria-busy", "false"); return false; }
    return await drawReel(reel, data.filter((p) => p.hero_image_url).map((p) => ({
      // The piece's own tag above it (its eyebrow: "Personal Branding"), and
      // what it's about under Read on hover (Dani, 17 Oct).
      img: p.hero_image_url, label: p.eyebrow || p.category || "Insights", caption: p.title, sub: p.title, desc: p.standfirst || "",
      href: `/account/blog#${encodeURIComponent(p.slug)}`, go: "Read",
    })));
  } catch (_) { reel.setAttribute("aria-busy", "false"); return false; }
}
