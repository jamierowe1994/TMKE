// Mock purchased library — would come from a database in production.
// Single fake package containing 30 templates, each backed by an Unsplash photo.

const UNSPLASH = (id, w = 1080, h = 1350) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

// Curated set of stable Unsplash photo IDs (interiors, exteriors, lifestyle).
const PHOTOS = [
  "1502672260266-1c1ef2d93688", // bright living room
  "1493809842364-78817add7ffb", // cosy bedroom
  "1560448204-e02f11c3d0e2",    // modern living
  "1505691938895-1758d7feb511", // marble kitchen
  "1484154218962-a197022b5858", // white kitchen
  "1567016432779-094069958ea5", // sofa & plant
  "1554995207-c18c203602cb",    // dim bedroom
  "1505693416388-ac5ce068fe85", // cottage exterior
  "1512917774080-9991f1c4c750", // modern facade
  "1430285561322-7808604715df", // urban street
  "1448630360428-65456885c650", // brutalist
  "1583847268964-b28dc8f51f92", // mid-century
  "1600585154340-be6161a56a0c", // luxury kitchen
  "1600596542815-ffad4c1539a9", // dining room
  "1600210492486-724fe5c67fb0", // outdoor pool
  "1600607687939-ce8a6c25118c", // bedroom suite
  "1600566753190-17f0baa2a6c3", // open plan
  "1600585154526-990dced4db0d", // exterior at dusk
  "1600210491892-03d54c0aaf87", // staircase
  "1600573472556-e636c2acda88", // bathroom
  "1600121848594-d8644e57abab", // garden
  "1505842465776-3d90f616310d", // study nook
  "1519710164239-da123dc03ef4", // hallway
  "1513694203232-719a280e022f", // window light
  "1494526585095-c41746248156", // attic bedroom
  "1469854523086-cc02fe5d8800", // forest cabin
  "1518733057094-95b53143d2a7", // garden path
  "1501183638710-841dd1904471", // grand entrance
  "1493663284031-b7e3aefcae8e", // home library
  "1503174971373-b1f69850bded", // pendant lights
];

const TEMPLATE_CATEGORIES = [
  "Just Listed",
  "Just Sold",
  "Open House",
  "Under Offer",
  "Coming Soon",
  "Price Reduced",
  "Testimonial",
  "Market Update",
  "Meet The Team",
  "Tip Tuesday",
];

const TEMPLATE_HEADLINES = [
  "Just Listed",
  "New To Market",
  "Open House Sunday",
  "Sold In One Week",
  "Under Offer",
  "Coming Soon",
  "Price Just Reduced",
  "What Our Clients Say",
  "Market Snapshot — May",
  "Meet The Team",
  "Tip Of The Week",
  "Behind The Scenes",
  "Featured Property",
  "Now Showing",
  "Last Chance",
  "Recently Sold",
  "Spotlight Listing",
  "Hot Off The Press",
  "Step Inside",
  "Exclusive Reveal",
  "Three Bed Terrace",
  "Garden Of The Week",
  "Kitchen Goals",
  "Home Tour",
  "Five Star Service",
  "Property Of The Day",
  "Saturday Viewings",
  "Investment Opportunity",
  "Period Charm",
  "Modern Living",
];

const TEMPLATE_SUBS = [
  "Tap for a closer look at this week's new arrivals.",
  "Three bedrooms, south-facing garden, ready to view.",
  "Sunday, 11am–1pm. No appointment needed.",
  "Another happy client moved in this month.",
  "A beautifully kept family home — coming soon.",
  "Be the first to know when it hits the market.",
  "Reduced by £15,000 — book your viewing today.",
  "Real words from real sellers.",
  "Average sale price, days on market, and trends.",
  "The people behind your next move.",
  "Small change, big difference to your listing.",
  "How we shoot, stage and stage every property.",
  "An editor's pick from this week's selection.",
  "Open for viewings from this weekend.",
  "Final viewings before completion.",
  "Sold above asking — congratulations to our sellers.",
  "Why this one is turning heads.",
  "Fresh listings, dropping today.",
  "A guided tour through every room.",
  "The reveal you've been waiting for.",
  "Tucked away on a quiet residential street.",
  "Mature planting, sun all afternoon.",
  "The heart of the home, beautifully done.",
  "Take the full tour — link in bio.",
  "What it's like to work with us.",
  "Stand-out home of the day.",
  "Pre-booked slots filling fast.",
  "Yield, growth potential, full numbers inside.",
  "Original features throughout, sympathetically restored.",
  "Clean lines, considered finishes, light-filled rooms.",
];

const palettes = [
  { bg: "#1c1d22", fg: "#F0EEEB", accent: "#B9826A" },
  { bg: "#f4f2f1", fg: "#1c1d22", accent: "#371e28" },
  { bg: "#371e28", fg: "#F0EEEB", accent: "#BCB3B9" },
  { bg: "#DFDCDE", fg: "#333747", accent: "#B9826A" },
  { bg: "#B9826A", fg: "#F0EEEB", accent: "#1c1d22" },
];

function pick(arr, i) { return arr[i % arr.length]; }

export const templates = PHOTOS.map((photoId, i) => {
  const palette = palettes[i % palettes.length];
  const headline = TEMPLATE_HEADLINES[i];
  const sub = TEMPLATE_SUBS[i];
  const category = pick(TEMPLATE_CATEGORIES, i);
  const id = `tmpl-${String(i + 1).padStart(2, "0")}`;
  return {
    id,
    name: `${headline} — 0${i + 1}`,
    category,
    thumb: UNSPLASH(photoId, 600, 750),
    canvas: { width: 1080, height: 1350, background: palette.bg },
    elements: [
      {
        id: "bg-photo",
        type: "image",
        x: 0, y: 0, w: 1080, h: 1350, rotation: 0,
        src: UNSPLASH(photoId, 1080, 1350),
        opacity: i % 3 === 0 ? 1 : 0.85,
        locked: false,
      },
      {
        id: "tint",
        type: "rect",
        x: 0, y: 0, w: 1080, h: 1350, rotation: 0,
        fill: palette.bg, opacity: 0.18, stroke: "transparent", strokeWidth: 0, radius: 0,
      },
      {
        id: "eyebrow",
        type: "text",
        x: 80, y: 110, w: 540, h: 32, rotation: 0,
        text: category.toUpperCase(),
        font: "Darker Grotesque",
        size: 18, weight: 700, italic: false,
        color: palette.fg,
        align: "left", letterSpacing: 6, lineHeight: 1.2,
      },
      {
        id: "headline",
        type: "text",
        x: 80, y: 980, w: 920, h: 220, rotation: 0,
        text: headline,
        font: "Cormorant Garamond",
        size: 96, weight: 500, italic: false,
        color: palette.fg,
        align: "left", letterSpacing: -1, lineHeight: 1,
      },
      {
        id: "sub",
        type: "text",
        x: 80, y: 1210, w: 800, h: 80, rotation: 0,
        text: sub,
        font: "Cormorant Garamond",
        size: 26, weight: 400, italic: true,
        color: palette.fg,
        align: "left", letterSpacing: 0, lineHeight: 1.35,
      },
      {
        id: "rule",
        type: "rect",
        x: 80, y: 950, w: 80, h: 2, rotation: 0,
        fill: palette.accent, opacity: 1, stroke: "transparent", strokeWidth: 0, radius: 0,
      },
    ],
  };
});

export const packages = [
  {
    id: "pkg-property-story",
    title: "The Property Story Pack",
    subtitle: "30 editorial templates for UK estate agents",
    purchased: "2026-05-04",
    version: "1.0",
    cover: UNSPLASH(PHOTOS[0], 800, 1000),
    templateIds: templates.map((t) => t.id),
  },
];

export function getTemplate(id) {
  return templates.find((t) => t.id === id) || null;
}
