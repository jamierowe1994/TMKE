/* The print materials guide's content, one entry per brand (Danielle, 30 Oct
   2026). A stand-in for the table the admin Design Studio will manage: the
   same fields, so the guide's layout can be judged now and fed from the
   database later. Taken from the live templates on 30 Oct; summaries and
   "when to use" are drafts for Dani to rewrite (docs/print-materials). */
const T = "https://tqqezhvjakohraiverei.supabase.co/storage/v1/object/public/calendar-assets/d1fb7525-4f2b-4ac4-86f8-47a03704dd38/templates/";
const pic = (f) => `${T}${f}.jpg`;

/* The words each kind of design gets, the same for every brand until the
   admin table lets each brand say its own. */
const SAY = {
  "Valuation Invitation": ["Invites homeowners to book a free, no-obligation valuation, with your details and a QR code on the back.", "When canvassing an area where you'd like more instructions, or following up a sale nearby."],
  "Sorry I Missed You": ["A friendly note for when you've called and nobody was home, inviting them to get in touch.", "Through the door after an unanswered knock, while door-knocking or calling by."],
  "New To Market": ["Announces a property you've just listed, with its photos, key details and guide price.", "Around a new listing, to find buyers and show neighbours you're active in their area."],
  "Open House Invitation": ["Invites people to an open house, with the date, time and the property's details.", "In the week or two before an open house, delivered around the property."],
  "Recently Sold": ["Shares a recent sale and tells nearby homeowners you have buyers looking for similar homes.", "Once a sale is agreed or completes, delivered to the streets around it."],
  "10 Ways To Attract More Buyers": ["A practical guide for sellers: ten ways to attract more buyers, from photography and staging to video and targeted adverts.", "For homeowners whose property hasn't sold, or to leave behind after a valuation."],
  "20 Reasons To Choose The Property Experts": ["Twenty reasons to choose The Property Experts, from one agent start to finish to marketing that reaches more buyers.", "At or after a valuation appointment, or alongside a pitch for an instruction."],
};
const item = (title, front, back, format) => ({ title, front: pic(front), back: pic(back), summary: SAY[title][0], when: SAY[title][1], ...(format ? { format } : {}) });
const cards = (packId, list) => ({
  key: "canvassing-cards", type: "Canvassing Cards", packId,
  line: "Double-sided cards to post through doors in your area, whether you're introducing yourself, promoting a listing or inviting a valuation.",
  format: "A5 landscape", sides: "Front and back",
  items: list.map(([t, f, b]) => item(t, f, b)),
});
const brochures = (packId, list) => ({
  key: "brochures", type: "Brochures", packId,
  line: "Longer reads to leave with homeowners: how to sell well, and why to choose us.",
  format: null, sides: "4 pages",            // each brochure says its own size
  items: list.map(([t, f, b, fmt]) => item(t, f, b, fmt)),
});

export const PRINT_MATERIALS = {
  tpe: {
    brand: "The Property Experts", short: "TPE", updated: "30 October 2026",
    packs: [
      cards("422cadb3-0e74-4f54-89aa-150e115e052f", [
        ["Valuation Invitation", "1ipjg0b-4zkz", "1rxnftw-47fn"],
        ["Sorry I Missed You", "19807nw-3fkb", "z4ivsb-3e0b"],
        ["New To Market", "cqkvsa-83rn", "1oxqsq7-4quf"],
        ["Open House Invitation", "tb8fnz-4lrj", "1niwaul-5s1v"],
        ["Recently Sold", "107tcje-74d7", "17jpl4s-4usr"],
      ]),
      brochures("77e2bf1a-a3cf-424c-98d1-d315434049e2", [
        ["10 Ways To Attract More Buyers", "1x1828g-5a93", "13iauhj-aktj", "A5 portrait"],
        ["20 Reasons To Choose The Property Experts", "11pap97-76j7", "1gofbcu-ai5v", "A4 portrait"],
      ]),
    ],
  },
  ppe: {
    brand: "Prestige Property Experts", short: "PPE", updated: "30 October 2026",
    packs: [
      cards("e741af78-8353-4298-b377-3332282d0efd", [
        ["Valuation Invitation", "ohlszx-8awj", "ect4c3-3h8j"],
        ["Sorry I Missed You", "1lqjv4z-33hj", "1j9ua8-2v1j"],
        ["New To Market", "1d50v2i-79ir", "8ynpwn-51ej"],
        ["Open House Invitation", "14vvg68-4xaf", "glmhee-52qb"],
        ["Recently Sold", "1tohjbz-5x1n", "1whk1bs-4tfb"],
      ]),
      brochures("ad1f3f17-bf3f-433a-8685-dc9a5c0d6132", [
        ["10 Ways To Attract More Buyers", "wacacq-5b1b", "umgdek-9jhr", "A5 portrait"],
        ["20 Reasons To Choose The Property Experts", "b0zab7-8s8v", "1jp39z1-9vfr", "A4 portrait"],
      ]),
    ],
  },
};

/* The guides as the Learn page lists them: one per brand, in Getting started,
   seen only by that brand's agents (guide-audience.js `brands`). Opening one
   goes to its A4 pages rather than the course reader. */
export const PRINT_MATERIAL_GUIDES = Object.entries(PRINT_MATERIALS).map(([key, g]) => ({
  slug: `print-materials-${key}`,
  title: "Your Print Materials",
  summary: `Every print design available to ${g.brand} agents, what each one is for and when to use it.`,
  topic: "getting-started", kind: "guide", training: false,
  audience: "teg", brands: [g.brand],
  href: `/account/guides/print/${key}/`,
  cover_url: "/images/learn/print-first-design-cover-v2.webp",
  est_minutes: 5, lessons: [],
  created_at: "2026-10-30T20:00:00Z",       // so it lands in Just landed
}));
