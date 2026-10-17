/* The pull-out menu's extras (Dani, 17 Oct): the notifications inside it,
   and the card for the newest pack the member hasn't bought. Used by the
   shared header (WorkspaceHeader.astro) and the dashboard's own copy.

   The notifications themselves are drawn by lib/notifications.js, which fills
   every .ws-notif-list on the page and minds every "Mark all read" -- this
   only opens and closes the menu's copy. */
import { ownedPacks, shopPacks, memberBrandsFor } from "./pack-access.js";
import { fillPackCovers } from "./pack-cover.js";
import { MENU_CARDS } from "../data/menu-cards.js";

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
      // A picture made for the menu wins over the pack's cover (src/data/menu-cards.js).
      const img = (MENU_CARDS.packs && MENU_CARDS.packs[pick.slug]) || pick.cover_image_url;
      if (pic && img) pic.style.backgroundImage = `url('${esc(img)}')`;
      const t = card.querySelector("strong"); if (t) t.textContent = pick.title;
      card.hidden = false;
    });
  } catch (_) { /* no card is better than a wrong one */ }
}

/* The menu's carousel (Dani, 17 Oct), under Help Centre: one 16:9 picture
   at a time, turning on its own, with the line under it.
     1. the newest pack in The Edit they don't have (the newest at all, if
        they have every one)
     2. What's New in the hub
     3. the latest post on the members' blog
     4. agents of The Experts Group: their print pack; everyone else: the
        demo pack, to try the Studio
   A slide with no picture is left out. Nothing shows until every picture is
   in, so it never fills in in front of anyone. */
const DC_CSS = `
.ws-dc { position: relative; margin: 14px 0 0; border-radius: 4px; overflow: hidden; background: #c9bcb7; }
.ws-dc[hidden] { display: none; }
/* Stronger than the menu's own ".ws-drawer-nav a", which would show every slide. */
.ws-dc a.ws-dc-slide, .ws-dc a.ws-dc-slide:hover { display: none; padding: 0; border-radius: 0; background: none; box-shadow: none; font-weight: 400; color: #371e28; text-decoration: none; }
.ws-dc a.ws-dc-slide.is-on { display: block; animation: wsDcIn 0.45s ease both; }
@keyframes wsDcIn { from { opacity: 0; } to { opacity: 1; } }
.ws-dc-pic { display: block; aspect-ratio: 16 / 9; background: #b9aab0 center / cover no-repeat; }
.ws-dc-tx { display: flex; flex-direction: column; gap: 2px; padding: 10px 14px 12px; }
.ws-dc-tx em { font-style: normal; font-size: 9.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(55,30,40,0.62); }
.ws-dc-tx strong { font-size: 13.5px; font-weight: 600; line-height: 1.25; color: #371e28; }
.ws-dc-slide:hover .ws-dc-tx strong { text-decoration: underline; text-underline-offset: 3px; }
.ws-dc-slide:focus-visible { outline: 2px solid #371e28; outline-offset: -2px; }
.ws-dc-dots { position: absolute; right: 12px; bottom: 14px; display: flex; gap: 5px; }
.ws-dc-dot { all: unset; cursor: pointer; width: 7px; height: 7px; border-radius: 50%; background: rgba(55,30,40,0.25); transition: background 0.2s, transform 0.2s; }
.ws-dc-dot.is-on { background: #371e28; transform: scale(1.15); }
.ws-dc-dot:focus-visible { outline: 2px solid #371e28; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .ws-dc a.ws-dc-slide.is-on { animation: none; } }
`;
export async function fillDrawerCarousel(supabase) {
  const boxes = [...document.querySelectorAll("[data-drawer-carousel]")];
  if (!boxes.length) return;
  try {
    let session = null;
    try { session = (await supabase.auth.getSession()).data.session; } catch (_) {}
    const email = (session && session.user.email) || "";
    const [packsRes, ordersRes, brands, blogRes] = await Promise.all([
      supabase.from("packs").select("*").eq("status", "active"),
      session ? supabase.from("orders").select("pack_id, status").or(`user_id.eq.${session.user.id},buyer_email.ilike.${email}`) : Promise.resolve({ data: [] }),
      session ? memberBrandsFor(supabase) : Promise.resolve(undefined),
      supabase.from("blog_posts").select("slug, title, hero_image_url").eq("status", "published").in("audience", ["members", "both"]).order("publish_date", { ascending: false }).limit(1),
    ]);
    const all = (packsRes && packsRes.data) || [];
    const paid = new Set(((ordersRes && ordersRes.data) || []).filter((o) => o.status === "paid" && o.pack_id).map((o) => o.pack_id));
    const mine = ownedPacks(all, paid, brands);
    const owned = new Set(mine.map((p) => p.id));
    const when = (p) => Date.parse(p.launched_at || p.created_at || "") || 0;
    const onSale = shopPacks(all).sort((a, b) => when(b) - when(a));
    const newest = onSale.find((p) => !owned.has(p.id)) || onSale[0] || null;
    const teg = Array.isArray(brands) && brands.length > 0;
    const print = teg ? mine.find((p) => p.access === "brands") : null;
    const demo = all.find((p) => p.demo === true) || null;
    const fourth = print || demo;
    await fillPackCovers(supabase, [newest, fourth].filter(Boolean)).catch(() => {});
    const post = blogRes && blogRes.data && blogRes.data[0];

    boxes.forEach(async (box) => {
      const slides = [
        newest && { eyebrow: "New in The Edit", title: newest.title, img: newest.cover_image_url, href: `/edit/${encodeURIComponent(newest.slug)}` },
        { eyebrow: "Just landed", title: "What’s New in Your Member Hub", img: box.getAttribute("data-news-img"), href: "/account?inspo=news" },
        post && { eyebrow: "From the blog", title: post.title, img: post.hero_image_url, href: `/account/blog#${encodeURIComponent(post.slug)}` },
        fourth && (print
          ? { eyebrow: "Your print pack", title: print.title, img: print.cover_image_url, href: `/account/editor?pack=${encodeURIComponent(print.id)}` }
          : { eyebrow: "Try the Studio", title: demo.title || "The demo pack", img: demo.cover_image_url, href: `/account/editor?pack=${encodeURIComponent(demo.id)}` }),
      ].filter((s) => s && s.img && s.title);
      if (!slides.length) return;
      // Every picture in before it shows.
      await Promise.all(slides.map((s) => new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = s.img; })));
      if (!document.getElementById("ws-dc-css")) {
        const st = document.createElement("style"); st.id = "ws-dc-css"; st.textContent = DC_CSS; document.head.appendChild(st);
      }
      box.className = "ws-dc";
      box.setAttribute("aria-roledescription", "carousel");
      box.setAttribute("aria-label", "Highlights");
      box.innerHTML = slides.map((s, i) => `<a class="ws-dc-slide${i === 0 ? " is-on" : ""}" href="${esc(s.href)}" aria-label="${esc(s.eyebrow + ": " + s.title)}"${i ? ' tabindex="-1"' : ""}>
          <span class="ws-dc-pic" style="background-image:url('${esc(s.img)}')"></span>
          <span class="ws-dc-tx"><em>${esc(s.eyebrow)}</em><strong>${esc(s.title)}</strong></span>
        </a>`).join("") + (slides.length > 1 ? `<div class="ws-dc-dots">${slides.map((s, i) => `<button type="button" class="ws-dc-dot${i === 0 ? " is-on" : ""}" data-dc="${i}" aria-label="Show ${esc(s.eyebrow)}"></button>`).join("")}</div>` : "");
      box.hidden = false;
      if (slides.length < 2) return;
      let at = 0, timer = null;
      const go = (n) => {
        at = (n + slides.length) % slides.length;
        box.querySelectorAll(".ws-dc-slide").forEach((a, i) => { a.classList.toggle("is-on", i === at); a.tabIndex = i === at ? 0 : -1; });
        box.querySelectorAll(".ws-dc-dot").forEach((d, i) => d.classList.toggle("is-on", i === at));
      };
      const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const start = () => { if (!still && !timer) timer = setInterval(() => go(at + 1), 5000); };
      const stop = () => { clearInterval(timer); timer = null; };
      box.addEventListener("mouseenter", stop); box.addEventListener("mouseleave", start);
      box.addEventListener("focusin", stop); box.addEventListener("focusout", start);
      box.addEventListener("click", (e) => { const d = e.target.closest("[data-dc]"); if (d) { e.preventDefault(); go(+d.dataset.dc); } });
      start();
    });
  } catch (_) { /* no carousel is better than a wrong one */ }
}
