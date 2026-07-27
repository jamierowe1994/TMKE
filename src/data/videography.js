// Videography section — data model
// ---------------------------------------------------------------------------
// ONE page (/videography) renders all products. Each product opens a slide-down
// modal "pop-out" with a hero image, photo gallery, what's included, optional
// extras, pricing, and an "about" bio. Adding a product = a new entry in PRODUCTS.
//
// Prices are in PENCE (matches gbpFromPence() in lib/supabase.js).
// A product is priced one of two ways:
//   • "tiers"  — a grid of priced sessions (The Studio: single / half / full day)
//   • "prose"  — a single "from" price + a short pricing write-up + extras
//                (The Property, The Agent — quote is calculated per membership)
// priceTiers[0] always carries the headline "from" price and feeds the booking
// wizard (DiscoveryPanel), regardless of which display mode is used.
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

// ---- Brochure ("Download a Brochure" card + form) --------------------------
// Mirrors the Social Media brochure flow. `url` is a PLACEHOLDER — drop the
// finished videography brochure PDF at this path on the assets CDN (or swap the
// URL) and it's live; nothing else needs to change.
export const VIDEOGRAPHY_BROCHURE = {
  // Short copy for the final-slide card.
  cardBody:
    "Everything you need to know about our property videography and photography services, in one place. A full breakdown of what's included, how it works, and what it costs.",
  // Lead shown inside the form modal.
  formBody:
    "Pop your details in and we'll email the brochure straight over — a full breakdown of our videography and photography services, what's included, and what it costs.",
  // Help under the optional password field.
  accountHelp:
    "Create a TMKE account to manage your brochures, downloads, and bookings in one place.",
  // Live videography services brochure (PDF).
  url: "https://assets.tmke.co.uk/TMKE%20-%20Videography%20Services.pdf",
};

// Gated-access work-email domains. The Studio (and other gated sections) only
// accept a work email on one of these domains. Subdomains are allowed too
// (e.g. rugby.fineandcountry.com) — see emailDomainAllowed() in DiscoveryPanel.
// Extend this list as new partner groups are onboarded.
export const GATED_DOMAINS = ["fineandcountry.com", "thepropertyexperts.co.uk"];

// Stock imagery — swap for real branded stills / Cloudflare Stream thumbnails.
const IMG = (id, w = 1400, h = 900) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
// The site's own on-brand property stills on Cloudflare R2.
const R2 = (name) => `https://assets.tmke.co.uk/${name}.webp`;

export const PRODUCTS = [
  {
    slug: "studio",
    num: "01",
    name: "The Studio",
    // ---- Slide (deck) ----
    slideCopy: "Short-form video content, professionally filmed in our Rugby Studio for your socials",
    slideBlurb:
      "A professional filming space in Rugby where you come in, film a batch of content, and leave with weeks of social media sorted. Sessions are available to members.",
    ctaLabel: "Discover the Studio",
    // Hand-ordered gallery from the "Jack - headshots/Content Studio/" R2 folder.
    hero: "https://assets.tmke.co.uk/Jack%20-%20headshots/Content%20Studio/1.png",
    media: [
      { type: "image", src: "https://assets.tmke.co.uk/Jack%20-%20headshots/Content%20Studio/1.png" },
      { type: "image", src: "https://assets.tmke.co.uk/Jack%20-%20headshots/Content%20Studio/2.png" },
      { type: "image", src: "https://assets.tmke.co.uk/Jack%20-%20headshots/Content%20Studio/3.png" },
      { type: "image", src: "https://assets.tmke.co.uk/Jack%20-%20headshots/Content%20Studio/4.png" },
      { type: "image", src: "https://assets.tmke.co.uk/Jack%20-%20headshots/Content%20Studio/5.png" },
    ],
    // ---- Pop-out ----
    popLede: "Our Rugby content studio, available exclusively to members.",
    popIntro: [
      "The Studio was built for agents who know they should be showing up on video, but don't have the time, space, or setup to make it happen consistently.",
      "A fully equipped professional filming space in Rugby, The Studio provides you with everything you need to batch-record weeks of content in a single session — without the guesswork, the awkward lighting, or the blank screen panic.",
    ],
    included: [
      "Pre-session video brief and prompt set prepared by our marketing team",
      "Professional multi-camera setup with broadcast audio",
      "Jack on-hand to direct and record throughout",
      "Full edit and digital delivery",
    ],
    pricingMode: "tiers",
    pricingHeading: "Booking and Pricing",
    priceTiers: [
      { label: "Single Session", sub: "1.5 hours of filming · 12 short-form videos", minutes: 90, prices: { direct: 16500 } },
      { label: "Half Day", sub: "3 hours of filming · 24 short-form videos", minutes: 180, prices: { direct: 32500 } },
      { label: "Full Day", sub: "8 hours of filming · 60 short-form videos", minutes: 480, prices: { direct: 78500 } },
    ],
    bookCtaLabel: "Book a Session",
    // Gated waitlist flow: pick package -> work-email-gated details -> preferred
    // date/time -> "fully booked, register for a cancellation". Studio access is
    // limited to the GATED_DOMAINS partner groups.
    bookMode: "waitlist",
    aboutHeading: "About The Studio",
    about: [
      "The Studio is a professionally equipped content space in Rugby, designed specifically for agents who want high-quality short-form video without the complexity of a traditional shoot. The space is clean, neutral, and camera-ready, built to keep sessions moving efficiently without sacrificing the quality of the finish.",
      "Every session is run by Jack, whose background in property and lifestyle content means he understands both the technical side of filming and what actually performs on social media. The kit is broadcast-standard — multi-camera, professional audio, controlled lighting — and the whole setup is designed to put you at ease from the moment you arrive, whether you're a seasoned presenter or you've never spoken to a camera before.",
    ],
    bookable: true,
    modal: { from: "bottom", size: "tall", close: "right" },
    showcase: [],
  },
  {
    slug: "property",
    num: "02",
    name: "The Property",
    slideCopy: "Professional photography and videography for listings that need to perform",
    slideBlurb:
      "From presenter-led video tours and drone footage to portal-ready photography and 360 virtual tours — everything a property needs to generate more clicks, more enquiries, and more viewings.",
    ctaLabel: "Discover our Property Packages",
    // Hand-ordered gallery from the "Jack - headshots/Property/" R2 folder.
    // `media` is the source of truth for the pop-out (order + mix of stills and
    // film); the stage leads with the first item.
    hero: "https://assets.tmke.co.uk/Jack%20-%20headshots/Property/LeahMusana-9%20(1).jpg",
    media: [
      { type: "image", src: "https://assets.tmke.co.uk/Jack%20-%20headshots/Property/LeahMusana-9%20(1).jpg" },
      { type: "image", src: "https://assets.tmke.co.uk/Jack%20-%20headshots/Property/LeahMusana-14.jpg" },
      { type: "image", src: "https://assets.tmke.co.uk/Jack%20-%20headshots/Property/FC2-9%20(1).jpg" },
      { type: "image", src: "https://assets.tmke.co.uk/Jack%20-%20headshots/Property/FC2-13%20(1).jpg" },
      { type: "image", src: "https://assets.tmke.co.uk/Jack%20-%20headshots/Property/CV311WHCompressed21%20(1).jpg" },
      { type: "video", src: "https://assets.tmke.co.uk/Jack%20-%20headshots/Property/MainVideo%20(1).mp4", thumb: "https://assets.tmke.co.uk/Jack%20-%20headshots/Property/CV311WHCompressed8.jpg" },
    ],
    popLede: "First impressions are made online, long before anyone steps through the door.",
    popIntro: [
      "On the portals, that impression comes down entirely to the quality of the media. Listings with professional photography and video consistently outperform those without, generating more clicks, more enquiries, and more viewings.",
      "Professional media doesn't just help a listing perform — it protects it. A property that looks its best from day one generates momentum, and momentum matters.",
    ],
    // The Gold package — the entry tier, matching the "from £550" headline below.
    // Fine & Country agents receive Platinum (premium floor plan, three reels,
    // up to 60 photos); the difference is called out in pricingProse.
    // Source of truth for both tiers: packagesByTier in lib/videography-config.js.
    includedHeading: "What's Included — Gold Package",
    included: [
      "Presenter-led video tour (landscape)",
      "Drone videography and photography",
      "360 virtual tour",
      "Floor plan",
      "Two 60-second reels (portrait)",
      "Professional photography — up to 25 photos",
      "10 × 5:4 photos (grid/newsfeed) & 10 × 16:9 photos (story/reels)",
      "YouTube thumbnail",
    ],
    extrasHeading: "Optional Extras",
    extras: [
      { label: "Local area video tour", price: "£100 +VAT" },
      { label: "Twilight shoot — Winter (Oct–Mar)", price: "£100 +VAT" },
      { label: "Twilight shoot — Summer (Apr–Sep)", price: "£200 +VAT" },
      { label: "Faux twilight", price: "£25 +VAT / image" },
    ],
    pricingMode: "prose",
    pricingHeading: "Bookings and Pricing",
    pricingProse: [
      "Property packages start from £550 +VAT for the Gold package. Fine & Country agents receive the Platinum package — a premium floor plan, three 60-second reels and photography up to 60 images — from £625 +VAT. Your rate is calculated automatically based on your membership or network, so just click below for a personalised quote.",
      "Jack covers a 40-mile radius of NN14, Kettering. Outside of that area? No problem — travel expenses apply for anything beyond the 40 miles, and we'll factor that into your quote automatically.",
    ],
    priceTiers: [
      // Gold (TEG brands) is the headline "from" rate; Fine & Country agents get
      // the Platinum package — see propertyTierForBrand in lib/videography-config.js.
      { label: "Property package", sub: "Full media package", minutes: 240, prices: { direct: 55000, "fine-and-country": 62500 } },
    ],
    bookCtaLabel: "Check Availability",
    aboutHeading: "About",
    about: [
      "Jack specialises in property and lifestyle content, bringing a calm, considered approach and a consistent focus on quality to every shoot. He understands what makes a property perform on the portals — not just how to make it look good, but how to make it work hard across every channel it appears on.",
      "Every shoot begins with a brief, so Jack understands the property, the target buyer, and the impression you want to create. From there, the shoot is efficient and considered, focused on getting the media that matters at the standard your listings deserve.",
      "Once edited, everything is delivered in clean, ready-to-use formats — optimised for property portals, social media, and print marketing, ready to go from the moment it lands in your inbox.",
    ],
    bookable: true,
    modal: { from: "bottom", size: "tall", close: "right" },
    showcase: [],
  },
  {
    slug: "agent",
    num: "03",
    name: "The Agent",
    slideCopy: "Professional video and photography content built around you, not just your listings",
    slideBlurb:
      "Elevator pitch videos, lifestyle portraits, and professional headshots — created on location to keep you visible, credible, and front of mind in your local market.",
    ctaLabel: "Discover our Agent Edit",
    // Hand-ordered gallery from the "Jack - headshots/Agent/" R2 folder:
    // video, four stills, video. `media` is the source of truth for the pop-out.
    hero: "https://assets.tmke.co.uk/Jack%20-%20headshots/Agent/DonnaPlumb-19.jpg",
    media: [
      { type: "video", src: "https://assets.tmke.co.uk/Jack%20-%20headshots/Agent/IntroVideoWide.mp4", thumb: "https://assets.tmke.co.uk/Jack%20-%20headshots/Agent/Z63_2333-62.jpg" },
      { type: "image", src: "https://assets.tmke.co.uk/Jack%20-%20headshots/Agent/DonnaPlumb-19.jpg" },
      { type: "image", src: "https://assets.tmke.co.uk/Jack%20-%20headshots/Agent/12-June-6.jpg" },
      { type: "image", src: "https://assets.tmke.co.uk/Jack%20-%20headshots/Agent/AM-40.jpg" },
      { type: "image", src: "https://assets.tmke.co.uk/Jack%20-%20headshots/Agent/EMay-61.jpg" },
      { type: "video", src: "https://assets.tmke.co.uk/Jack%20-%20headshots/Agent/Widescreen.mp4", thumb: "https://assets.tmke.co.uk/Jack%20-%20headshots/Agent/ADMay-28.jpg" },
    ],
    popLede: "Professional video and photography content built around you, not just your listings.",
    popIntro: [
      "The agents who win instructions consistently aren't always the most experienced — they're the ones who show up, stay visible, and build genuine trust with their audience over time.",
      "Being good at your job isn't enough if the people who need you don't know you exist. Professional video and photography content gives you the tools to change that. A strong elevator pitch introduces you to potential clients before you've ever met them. Consistent, well-produced content keeps you front of mind in your local market. And professional headshots ensure that every touchpoint — from your social media to your valuation pack — reflects the standard of the service you actually deliver.",
      "This isn't content for content's sake. It's a long-term investment in how you're perceived, how you're remembered, and how you win more business.",
    ],
    includedHeading: "What's Included — The Agent Edit",
    included: [
      "Landscape elevator pitch video",
      "Portrait elevator pitch video",
      "Five professional headshots",
      "10 lifestyle photographs",
    ],
    extrasHeading: "Optional Add-Ons",
    extras: [
      { label: "10 × 60-second B-roll scenes", price: "£155 +VAT" },
    ],
    pricingMode: "prose",
    pricingHeading: "Booking & Pricing",
    pricingProse: [
      "Agent videography starts from £295 +VAT. Your rate is calculated automatically based on your membership to our network — just click below for a personalised quote.",
      "Jack covers a 40-mile radius of NN14, Kettering. Outside of that area? No problem — travel expenses apply for anything beyond the 40 miles, and we'll factor that into your quote automatically.",
    ],
    priceTiers: [
      { label: "Agent Edit", sub: "Video & photography", minutes: 120, prices: { direct: 29500 } },
    ],
    bookCtaLabel: "Check Availability",
    aboutHeading: "About",
    about: [
      "Jack specialises in property and lifestyle content, bringing a calm, considered approach and a consistent focus on quality to every shoot. He understands what agents need to communicate online — not just how to look good on camera, but how to come across as credible, approachable, and worth calling.",
      "Every session is relaxed and structured, designed to put you at ease whether you're a confident presenter or you've never spoken to a camera before. You bring yourself. Jack handles the rest.",
    ],
    bookable: true,
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
