// The sizes the Studio offers, in the order it offers them. One list feeds both
// the "What are you making?" pop-out (NewDesignModal) and the Resize panel
// (account/editor.astro), so the two can't drift apart.
//
// Square is plain "Square" because it isn't an Instagram size we'd recommend -
// it's for Facebook, LinkedIn and anywhere else that wants one.
//
// Print sizes are UK standard (what VistaPrint and the like print), at 300 dpi,
// with PRINT_BLEED_MM added on every edge: the canvas is the size the printer
// wants the file, and the card shows the finished (trimmed) size in mm.
//
// `family` keeps social and print apart in Resize: a post doesn't become a
// business card, and the other way round, so each only offers its own.

export const PRINT_DPI = 300;
export const PRINT_BLEED_MM = 3;

const px = (mm) => Math.round((mm * PRINT_DPI) / 25.4);
const print = (name, wMm, hMm) => ({
  name,
  w: px(wMm + 2 * PRINT_BLEED_MM),
  h: px(hMm + 2 * PRINT_BLEED_MM),
  mm: `${wMm} × ${hMm} mm`,
  bleed: px(PRINT_BLEED_MM),
});

/* The social formats we no longer OFFER, but still want to look at.
   Members can't resize to these — a post squeezed into a banner is worse than
   the post it came from — but the admin size check shows them, because seeing
   what a design does at a landscape shape is how you find out whether a
   LinkedIn or cover pack is worth drawing properly one day. */
export const ADMIN_EXTRA_SOCIAL = [
  { name: "Landscape", w: 1920, h: 1080 },
  { name: "Facebook Link", w: 1200, h: 628 },
  { name: "Facebook Cover", w: 820, h: 312 },
  { name: "LinkedIn Post", w: 1200, h: 627 },
];

export const STUDIO_SIZES = [
  {
    label: "Social",
    family: "social",
    // Four, on purpose. A design redrawn from portrait to square needs a
    // nudge; the same design forced into landscape needs rebuilding, and the
    // result is worse than the template it came from. Nobody buying an
    // Instagram pack needs a banner, so we don't offer one. If a LinkedIn or
    // cover pack is ever worth drawing, it gets drawn at that shape from the
    // start rather than squeezed out of this one.
    sizes: [
      { name: "Instagram Portrait", w: 1080, h: 1440 },
      { name: "Facebook Portrait", w: 1080, h: 1350 },
      { name: "Square", w: 1080, h: 1080 },
      { name: "Story / Reel / TikTok", w: 1080, h: 1920 },
    ],
  },
  {
    label: "Print",
    family: "print",
    note: `Print sizes include a ${PRINT_BLEED_MM}mm bleed on every edge, ready for the printer.`,
    sizes: [
      print("A4 Portrait", 210, 297),
      print("A4 Landscape", 297, 210),
      // A5 portrait is also the standard A5 postcard.
      print("A5 Portrait", 148, 210),
      print("A5 Landscape", 210, 148),
      print("Business Card", 85, 55),
      print("Postcard A6", 105, 148),
    ],
  },
];
