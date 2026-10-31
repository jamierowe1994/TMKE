/* The print materials guide, one per brand (Danielle, 30 Oct 2026). Its words
   live in the database since 31 Oct: print_guide (title, summary, when to
   use, per template) and packs.print_type (which page a pack goes on), edited
   in Admin > Design studio > Print > Print materials. The guide reads them
   when it opens, so a new design shows up without a deploy. This file only
   says which brands have a guide, and how each kind of pack is introduced. */

/* A brand gets a guide once it has print packs. The key is the guide's
   address: /account/guides/print/<key>/. */
export const PRINT_MATERIALS = {
  tpe: { brand: "The Property Experts", short: "TPE" },
  ppe: { brand: "Prestige Property Experts", short: "PPE" },
};

/* A pack's page, by packs.print_type. `sides` is said where every design of
   that kind is the same; otherwise each design says its own (front only, or
   front and back). `perPage` is how many designs fit one A4 page before the
   chapter runs on to the next. */
export const PRINT_TYPES = {
  "canvassing-cards": {
    label: "Canvassing Cards", perPage: 5,
    line: "Double-sided cards to post through doors in your area, whether you're introducing yourself, promoting a listing or inviting a valuation.",
  },
  brochures: {
    label: "Brochures", perPage: 2, sides: "4 pages",
    line: "Longer reads to leave with homeowners: how to sell well, and why to choose us.",
  },
  leaflets: {
    label: "Leaflets", perPage: 4,
    line: "Single sheets to hand out or post, for when there's one thing to say.",
  },
  other: { label: "Other Print", perPage: 4, line: "" },
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
