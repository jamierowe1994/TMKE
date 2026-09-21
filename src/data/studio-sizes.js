// The sizes the Studio offers, in the order it offers them. One list feeds both
// the "What are you making?" pop-out (NewDesignModal) and the Resize panel
// (account/editor.astro), so the two can't drift apart.
//
// Square is plain "Square" because it isn't an Instagram size we'd recommend -
// it's for Facebook, LinkedIn and anywhere else that wants one.
//
// Print sizes are UK standard (what VistaPrint and the like print), at 300 dpi;
// `mm` is what the printer calls them, and is what the cards show.
export const STUDIO_SIZES = [
  {
    label: "Social",
    sizes: [
      { name: "Instagram Portrait", w: 1080, h: 1440 },
      { name: "Square", w: 1080, h: 1080 },
      { name: "Story / Reel / TikTok", w: 1080, h: 1920 },
      { name: "Landscape", w: 1920, h: 1080 },
      { name: "Facebook Portrait", w: 1080, h: 1350 },
      { name: "Facebook Link", w: 1200, h: 628 },
      { name: "Facebook Cover", w: 820, h: 312 },
      { name: "LinkedIn Post", w: 1200, h: 627 },
    ],
  },
  {
    label: "Print",
    sizes: [
      { name: "A4 Portrait", w: 2480, h: 3508, mm: "210 × 297 mm" },
      { name: "A4 Landscape", w: 3508, h: 2480, mm: "297 × 210 mm" },
      { name: "Business Card", w: 1004, h: 650, mm: "85 × 55 mm" },
      { name: "Postcard A5", w: 1748, h: 2480, mm: "148 × 210 mm" },
      { name: "Postcard A6", w: 1240, h: 1748, mm: "105 × 148 mm" },
    ],
  },
];
