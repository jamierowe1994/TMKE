// Videography section — data model
// ---------------------------------------------------------------------------
// ONE templated page set is driven entirely by this file. Adding a service is
// a new entry in SERVICES; adding a partner price tier is a new entry in
// PARTNERS plus a `prices` key on each service. No new pages required.
//
// Prices are in PENCE (matches gbpFromPence() in lib/supabase.js).
//
// "Knowing the company without asking": partners arrive via a vanity link
// (e.g. /videography?p=fine-and-country). resolvePartnerSlug() reads the query
// param, persists it to localStorage, and falls back to the logged-in account
// brand later. The matching price tier then renders automatically.
// ---------------------------------------------------------------------------

/** Partner price tiers. `null`/absent = the public "direct" tier. */
export const PARTNERS = {
  "fine-and-country": {
    slug: "fine-and-country",
    name: "Fine & Country",
    tier: "premium",
    note: "Premium partner rates",
  },
  "property-experts": {
    slug: "property-experts",
    name: "The Property Experts",
    tier: "volume",
    note: "Volume partner rates",
  },
};

/** The public "direct" pricing label when no partner is resolved. */
export const DIRECT = { slug: "direct", name: "Direct", note: "Standard rates" };

// Stock posters — swap for real branded stills / Cloudflare Stream thumbnails.
const POSTER = (id, w = 1200, h = 800) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export const SERVICES = [
  {
    slug: "property-films",
    name: "Property Films",
    tagline: "Cinematic walkthroughs that sell the home before the viewing.",
    summary:
      "A fully produced property film — establishing shots, smooth interior motion, and a paced edit that makes a listing feel like a place people want to live.",
    deliverables: [
      "Full cinematic property film (60–90s)",
      "Vertical social cut-down for Reels / TikTok",
      "10–15 edited hero stills",
      "Licensed music + colour grade",
    ],
    // prices in pence
    prices: { direct: 60000, "fine-and-country": 75000, "property-experts": 45000 },
    poster: POSTER("1512917774080-9991f1c4c750"),
    showcase: [
      { title: "Riverside townhouse", poster: POSTER("1568605114967-8130f3a36994") },
      { title: "Country manor", poster: POSTER("1570129477492-45c003edd2be") },
      { title: "City penthouse", poster: POSTER("1502672260266-1c1ef2d93688") },
    ],
  },
  {
    slug: "social-reels",
    name: "Social Reels",
    tagline: "Short, scroll-stopping vertical content built for reach.",
    summary:
      "High-tempo vertical films designed for Instagram, TikTok and YouTube Shorts — agent-to-camera, listing teasers, and market updates that actually get watched.",
    deliverables: [
      "3× vertical reels (15–30s each)",
      "On-screen captions + hooks",
      "Trending-audio sync",
      "Ready-to-post exports",
    ],
    prices: { direct: 30000, "fine-and-country": 40000, "property-experts": 22500 },
    poster: POSTER("1611162617213-7d7a39e9b1d7"),
    showcase: [
      { title: "Listing teaser", poster: POSTER("1605276374104-dee2a0ed3cd6") },
      { title: "Agent to camera", poster: POSTER("1521577352947-9bb58764b69a") },
    ],
  },
  {
    slug: "brand-films",
    name: "Brand & Lifestyle Films",
    tagline: "The film that tells people why you, not the agent down the road.",
    summary:
      "A considered brand film — your team, your story, your local market. The piece that sits on your homepage and pitches you while you sleep.",
    deliverables: [
      "Brand film (90–120s)",
      "Interview direction + scripting support",
      "Multi-location shoot day",
      "Social cut-downs + stills",
    ],
    prices: { direct: 90000, "fine-and-country": 120000, "property-experts": 70000 },
    poster: POSTER("1492691527719-9d1e07e534b4"),
    showcase: [
      { title: "Agency brand film", poster: POSTER("1497366216548-37526070297c") },
      { title: "Founder story", poster: POSTER("1556761175-5973dc0f32e7") },
    ],
  },
  {
    slug: "aerial",
    name: "Aerial & Drone",
    tagline: "Context, scale and drama from above — fully licensed.",
    summary:
      "CAA-licensed aerial cinematography for estates, developments and location context. The shots that make a property feel like an event.",
    deliverables: [
      "Licensed drone operation",
      "4K aerial footage + stills",
      "Reveal + context shots",
      "Graded social-ready exports",
    ],
    prices: { direct: 45000, "fine-and-country": 55000, "property-experts": 35000 },
    poster: POSTER("1473968512647-3e447244af8f"),
    showcase: [
      { title: "Estate reveal", poster: POSTER("1518780664697-55e3ad937233") },
      { title: "Development overview", poster: POSTER("1449844908441-8829872d2607") },
    ],
  },
];

/** Unlisted — not in SERVICES, not in nav, not in the sitemap. */
export const STUDIO = {
  slug: "studio",
  name: "The Rugby Podcast Studio",
  tagline: "A fully kitted podcast & content studio — partners only.",
  summary:
    "Our private podcast studio in Rugby: multi-cam, broadcast audio, and a producer on hand. Available to partner brands by arrangement.",
  deliverables: [
    "Multi-camera podcast capture",
    "Broadcast-quality audio",
    "Same-day social clips",
    "Producer + editor included",
  ],
  poster: POSTER("1590602847861-f357a9332bbc"),
};

export function getService(slug) {
  return SERVICES.find((s) => s.slug === slug) || null;
}

export function getPartner(slug) {
  if (!slug || slug === "direct") return DIRECT;
  return PARTNERS[slug] || DIRECT;
}

/** Price (pence) for a service under a partner tier, falling back to direct. */
export function priceFor(service, partnerSlug) {
  if (!service || !service.prices) return null;
  return service.prices[partnerSlug] ?? service.prices.direct ?? null;
}

// --- Client-only helpers (safe to import in a browser <script>) -------------
const STORE_KEY = "tmke.vid.partner";

/** Resolve the active partner slug: ?p= query → localStorage → direct. */
export function resolvePartnerSlug() {
  if (typeof window === "undefined") return "direct";
  try {
    const q = new URLSearchParams(window.location.search).get("p");
    if (q && PARTNERS[q]) {
      window.localStorage.setItem(STORE_KEY, q);
      return q;
    }
    const stored = window.localStorage.getItem(STORE_KEY);
    if (stored && PARTNERS[stored]) return stored;
  } catch (_) {
    /* ignore */
  }
  return "direct";
}

export function clearPartner() {
  try {
    window.localStorage.removeItem(STORE_KEY);
  } catch (_) {
    /* ignore */
  }
}
