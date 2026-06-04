// Videography section — data model
// ---------------------------------------------------------------------------
// ONE page (/videography) renders all products. Each product opens a slide-down
// modal "pop-out" with a hero image, photo gallery, price tiers, what's
// included, and example work. Adding a product = a new entry in PRODUCTS.
//
// Prices are in PENCE (matches gbpFromPence() in lib/supabase.js).
// Every product supports multiple price tiers (e.g. Half day / Full day).
//
// "Knowing the company without asking": partners arrive via a vanity link
// (e.g. /videography?p=fine-and-country). resolvePartnerSlug() reads the query
// param, persists it to localStorage, and the matching tier price renders.
// ---------------------------------------------------------------------------

export const PARTNERS = {
  "fine-and-country": { slug: "fine-and-country", name: "Fine & Country", tier: "premium", note: "Premium partner rates" },
  "property-experts": { slug: "property-experts", name: "The Property Experts", tier: "volume", note: "Volume partner rates" },
};
export const DIRECT = { slug: "direct", name: "Direct", note: "Standard rates" };

// Stock imagery — swap for real branded stills / Cloudflare Stream thumbnails.
const IMG = (id, w = 1400, h = 900) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
// The site's own on-brand property stills on Cloudflare R2.
const R2 = (name) => `https://assets.tmke.co.uk/${name}.webp`;

export const PRODUCTS = [
  {
    slug: "studio",
    name: "The Studio",
    tagline: "Our Rugby podcast & content studio — booked by the half or full day.",
    summary:
      "A fully kitted studio with Jack on hand to record everything you need. Multi-camera, broadcast audio, and a producer's eye — then we edit it and send it over ready to publish.",
    hero: "/assets/podcast-studio.jpeg",
    gallery: [
      "/assets/podcast-studio.jpeg",
      IMG("1598488035139-bdbb2231ce04"), IMG("1478737270239-2f02b77fc618"),
      IMG("1564424224827-cd24b8915874"), IMG("1505236858219-8359eb29e329"),
      IMG("1516223725307-6f76b9ec8742"),
    ],
    included: [
      "Half or full-day studio booking",
      "Jack on-hand to record everything",
      "Multi-camera + broadcast audio",
      "Full edit and delivery",
      "Same-day social clips (full day)",
    ],
    priceTiers: [
      { label: "2-hour session", minutes: 120, prices: { direct: 20000 } },
      { label: "Half day", minutes: 240, prices: { direct: 35000, "fine-and-country": 40000, "property-experts": 30000 } },
      { label: "Full day", minutes: 480, prices: { direct: 60000, "fine-and-country": 70000, "property-experts": 50000 } },
    ],
    // Studio is visible but not directly bookable yet — soft "enquire" CTA.
    bookable: false,
    // All pop-outs rise from the bottom, near full-screen, close top-right.
    modal: { from: "bottom", size: "tall", close: "right" },
    showcase: [
      { title: "Podcast set", poster: IMG("1589903308904-1010c2294adc") },
      { title: "Interview format", poster: IMG("1521737604893-d14cc237f11d") },
    ],
  },
  {
    slug: "personal-branding",
    name: "Personal Branded Content",
    tagline: "Intro & welcome videos that put a face to your name.",
    summary:
      "Perfect for an agent starting in a new patch — warm, natural intro and welcome videos. “Hi, I'm James, your local agent…” The content that builds trust before the first call.",
    hero: R2("living-1"),
    gallery: [R2("living-1"), R2("living-2"), R2("vibes")],
    included: [
      "Pre-shoot script & direction",
      "Intro / welcome video set",
      "On-screen captions + graphics",
      "Vertical + landscape exports",
    ],
    priceTiers: [
      { label: "Single video", minutes: 120, prices: { direct: 25000, "fine-and-country": 32000, "property-experts": 18000 } },
      { label: "Content day", minutes: 480, prices: { direct: 75000, "fine-and-country": 90000, "property-experts": 55000 } },
    ],
    bookable: true,
    // All pop-outs rise from the bottom, near full-screen, close top-right.
    modal: { from: "bottom", size: "tall", close: "right" },
    showcase: [
      { title: "Agent intro", poster: IMG("1560250097-0b93528c311a") },
      { title: "Welcome video", poster: IMG("1573497019940-1c28c88b4f3e") },
    ],
  },
  {
    slug: "property-tours",
    name: "Property Tours",
    tagline: "Cinematic walkthroughs that sell the home before the viewing.",
    summary:
      "A fully produced property film — establishing shots, smooth interior motion, and a paced edit that makes a listing feel like a place people want to live.",
    hero: R2("kitchen-1"),
    gallery: [R2("kitchen-1"), R2("kitchen-2"), R2("orange-1"), R2("table")],
    included: [
      "Full cinematic property film (60–90s)",
      "Vertical social cut-down",
      "10–15 edited hero stills",
      "Licensed music + colour grade",
    ],
    priceTiers: [
      { label: "Standard tour", minutes: 180, prices: { direct: 45000, "fine-and-country": 55000, "property-experts": 35000 } },
      { label: "Cinematic + aerial", minutes: 300, prices: { direct: 75000, "fine-and-country": 90000, "property-experts": 60000 } },
      { label: "Full production day", minutes: 480, prices: { direct: 95000 } },
    ],
    bookable: true,
    // Pop-out rises from the bottom, near full-screen, close top-right.
    modal: { from: "bottom", size: "tall", close: "right" },
    showcase: [
      { title: "Riverside townhouse", poster: IMG("1600585154340-be6161a56a0c") },
      { title: "Country manor", poster: IMG("1600596542815-ffad4c1539a9") },
    ],
  },
  {
    slug: "photo-headshots",
    name: "Photo Packs & Headshots",
    tagline: "Sharp headshots and a full photo pack for the whole team.",
    summary:
      "Professional headshots and branded photography for your website, socials and listings — consistent, on-brand, and shot in a single efficient session.",
    hero: R2("orange-2"),
    gallery: [R2("orange-2"), R2("white-1"), R2("white-2")],
    included: [
      "Studio or on-location session",
      "Retouched headshots per person",
      "Branded team + office photos",
      "Web + print-ready exports",
    ],
    priceTiers: [
      { label: "Headshots", minutes: 90, prices: { direct: 20000, "fine-and-country": 25000, "property-experts": 15000 } },
      { label: "Full photo pack", minutes: 240, prices: { direct: 45000, "fine-and-country": 55000, "property-experts": 35000 } },
    ],
    bookable: true,
    // Pop-out rises from the bottom, near full-screen, close top-right.
    modal: { from: "bottom", size: "tall", close: "right" },
    showcase: [],
  },
];

export function getProduct(slug) {
  return PRODUCTS.find((p) => p.slug === slug) || null;
}

export function getPartner(slug) {
  if (!slug || slug === "direct") return DIRECT;
  return PARTNERS[slug] || DIRECT;
}

/** Price (pence) for a tier under a partner, falling back to the direct rate. */
export function tierPrice(tier, partnerSlug) {
  if (!tier || !tier.prices) return null;
  return tier.prices[partnerSlug] ?? tier.prices.direct ?? null;
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
  } catch (_) { /* ignore */ }
  return "direct";
}

export function clearPartner() {
  try { window.localStorage.removeItem(STORE_KEY); } catch (_) { /* ignore */ }
}
