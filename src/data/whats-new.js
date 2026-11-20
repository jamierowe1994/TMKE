// What's new in the Member Hub - the dashboard's "What's new" card opens these
// in the same step-through pop-out as the Trending month (StudioInspo, view
// "news"). Newest first; only the latest WHATS_NEW_COUNT are shown, so adding
// one retires the oldest.
//
// Since 20 Nov 2026 these are written in Admin › Member hub › What's new (table
// public.whats_new, supabase/whats_new.sql). The site reads the published rows
// when it builds, and Publish there rebuilds the site. The list below is what
// the table was seeded with; the build only uses it while the table isn't
// there yet, or if Supabase can't be reached, and says so in the build log.
//
// Each entry, in the hub's plain voice:
//   date   when it went live (YYYY-MM-DD)
//   title  what you can now do, not what we built
//   area   the part of the hub it's in
//   where  the clicks to reach it
//   what   what it is, in two sentences at most
//   why    what it saves or makes possible
//   tip    one practical pointer (the wine box)
//   link   { href, label } - where the button goes
//   media  1080 x 1350 (4:5) image; the dashboard card uses the first entry's

import { WHATS_NEW_COUNT } from "../lib/whats-new-audience.js";
export { WHATS_NEW_COUNT };
// How many published updates the hub pages carry; each member's browser keeps
// the latest five meant for them.
const CARRIED = 30;

const SEED = [
  {
    date: "2026-10-18",
    title: "Meet Your Marketing Planner",
    area: "Marketing Planner",
    where: "Marketing Planner \u2192 Marketing Planner | Content Calendar",
    what: "The Planner is now your Marketing Planner, with two views at the top. Marketing Planner shows everything you\u2019ve planned: posts, print, events, shoots, campaigns and follow-ups. Content Calendar shows just what you\u2019re posting, with your post ideas and key dates.",
    why: "Your marketing is more than your social media, but some days you only want to see what\u2019s going out. One view for all of it, one for your content, and nothing you\u2019ve planned is ever lost between them.",
    tip: "Plan your month in the Marketing Planner, then switch to the Content Calendar when you sit down to create your posts.",
    link: { href: "/account/schedule", label: "Open your Marketing Planner" },
    media: "/images/learn/hub/areas/planner-v5.jpg",
  },
  {
    date: "2026-10-01",
    title: "October\u2019s See What\u2019s Working Is Here",
    area: "Studio",
    where: "Studio \u2192 See what\u2019s working",
    what: "October\u2019s edition of See What\u2019s Working is here, featuring five social media trends worth exploring this month. Discover what each trend involves, why it\u2019s gaining attention and how you can adapt it to create relevant content for your estate agency.",
    why: "You don\u2019t need to spend hours researching trends or figuring out how they fit into property. We\u2019ve done the research and broken down the ideas, so you can focus on creating content that works for your business.",
    tip: "You don\u2019t need to try every trend. Choose the ones that suit your personality, audience and brand, then make them your own. A trend should complement your content, not dictate it.",
    link: { href: "/account/studio", label: "Open the Studio" },
    media: "/images/learn/hub/areas/whats-new-trending-oct26.jpg",
  },
  {
    date: "2026-09-21",
    title: "Preview Before You Post",
    area: "Studio",
    where: "Studio → Guides → Safe zones",
    what: "New preview guides in the Studio show you which parts of your design will be visible across Instagram. Check how a post or Reel cover will crop on your profile grid, or switch to Story and Reel views to see where Instagram’s interface could cover your content.",
    why: "You can check your layout before you download, keeping important text, logos and faces where people will actually see them.",
    tip: "Check every format you plan to use. A design that works perfectly on your grid might need adjusting before you share it to Stories.",
    link: { href: "/account/editor", label: "Open the Studio" },
    media: "/images/learn/hub/areas/studio-v2.jpg",
  },
  {
    date: "2026-09-21",
    title: "Add Your Contact Details in One Click",
    area: "Brand Kit & Studio",
    where: "Brand Kit → About you, then Studio → Elements",
    what: "Your Brand Kit now stores your name, job title, telephone number, email and headshot. In the Studio, you can use these details to add ready-made contact footers to your designs, already formatted and filled in with your information.",
    why: "Add a professional call to action to carousel end slides and other content without rebuilding your contact details every time.",
    tip: "Complete all of your contact fields and add a headshot first. Your contact footers will then be ready whenever you need them.",
    link: { href: "/account/profile", label: "Update your Brand Kit" },
    media: "/images/learn/hub/areas/brand-kit-v4.jpg",
  },
  {
    date: "2026-09-21",
    title: "Reset Any Template in One Click",
    area: "Studio",
    where: "Studio → Start → Reset to the original template",
    what: "Taken an edit too far? Designs created from one of our templates can now be reset to the original from the Start menu. Your Brand Kit will still be applied, giving you a clean version of the template without having to find it and start again.",
    why: "Experiment as much as you like. If it doesn't work, you can get back to your original starting point without abandoning the design.",
    tip: "Changed your mind after resetting? Use Undo straight afterwards and your previous changes will come back.",
    link: { href: "/account/editor", label: "Open the Studio" },
    media: "/images/learn/hub/areas/studio-v4.jpg",
  },
  {
    date: "2026-09-16",
    title: "Getting Started Just Got Easier",
    area: "Learn",
    where: "Learn → Getting Started",
    what: "There's a new four-part Getting Started series in Learn, covering the essentials of using your Member Hub. Get familiar with the Hub, build your Brand Kit, edit your first template and learn how to start planning your content.",
    why: "Follow a clear route through the basics, with practical guidance and interactive walkthroughs that let you learn while using the Hub itself.",
    tip: "Start with Getting Around Your Hub and work through the four courses in order. Each one builds on what you've already set up.",
    link: { href: "/account/guides", label: "Go to Learn" },
    media: "/images/learn/hub/areas/learn-v4.jpg",
  },
  {
    date: "2026-09-10",
    title: "Your First Three Templates Are Free",
    area: "Studio",
    where: "Studio → Demo Pack",
    what: "Every Member now has three free templates inside their Studio, whether you've purchased a content pack or not. Find them in your Demo Pack, customise them with your own branding and content, then download and use them like any other template.",
    why: "Try the Studio properly on finished designs, learn how template editing works and create content you can actually use when you're done.",
    tip: "New to the Studio? Edit one of your Demo Pack templates before starting from scratch. It's the quickest way to learn how everything works.",
    link: { href: "/account/studio", label: "Go to the Studio" },
    media: "/images/learn/hub/areas/start-design-v4.jpg",
  },
];

// A database row in the shape the hub reads.
export function whatsNewFromRow(r) {
  return {
    date: String(r.live_on || "").slice(0, 10),
    title: r.title || "",
    area: r.area || "",
    where: r.find_it || "",
    what: r.what || "",
    why: r.why || "",
    tip: r.tip || "",
    link: r.link_href ? { href: r.link_href, label: r.link_label || "Take a look" } : null,
    media: r.media_url || "",
    audience: Array.isArray(r.audience) ? r.audience.filter(Boolean) : [],
  };
}

async function load() {
  const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
  const penv = (typeof process !== "undefined" && process.env) || {};
  const base = String(env.PUBLIC_SUPABASE_URL || penv.PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = env.PUBLIC_SUPABASE_ANON_KEY || penv.PUBLIC_SUPABASE_ANON_KEY || "";
  if (!base || !key) return SEED;
  const url = `${base}/rest/v1/whats_new?status=eq.published&select=live_on,title,area,find_it,what,why,tip,link_href,link_label,media_url,audience&order=live_on.desc,created_at.desc&limit=${CARRIED}`;
  let why = "";
  for (let tries = 0; tries < 3; tries++) {
    try {
      const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      if (res.ok) return (await res.json()).map(whatsNewFromRow);
      const body = await res.text().catch(() => "");
      if (res.status === 404 || /PGRST205|42P01|does not exist|schema cache/i.test(body)) {
        console.warn("[whats-new] The whats_new table isn't there yet - run supabase/whats_new.sql. Using the list in src/data/whats-new.js.");
        return SEED;
      }
      why = `HTTP ${res.status} ${body.slice(0, 160)}`;
    } catch (e) { why = String((e && e.message) || e); }
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.warn(`[whats-new] COULDN'T READ What's New from Supabase (${why}). This build shows the list in src/data/whats-new.js; publish again to rebuild.`);
  return SEED;
}

export const WHATS_NEW = await load();
// Every carried update, for the member's browser to choose from by brand.
export const whatsNewCarried = () => WHATS_NEW;
// For a picture or card that every member sees: the newest update for everyone.
export const whatsNewForEveryone = () => WHATS_NEW.find((t) => !(t.audience && t.audience.length)) || {};
export const whatsNewLatest = () => WHATS_NEW.filter((t) => !(t.audience && t.audience.length)).slice(0, WHATS_NEW_COUNT);
