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

/* Sizes a contact block is never offered at. A footer is a strip of details
   that sits on a design; a Facebook cover is 820 × 312 of almost nothing but
   strip, so a footer scaled onto one stops being a footer. */
export const NO_BLOCK_SIZES = ["Facebook Cover"];

/* The wide social shapes. A design drawn upright (portrait, square, story) has
   to be rebuilt to work as a banner, not nudged, so a member's Resize panel
   offers only the shapes near the one they are on: upright to upright, wide to
   wide. New design still offers all eight - a banner drawn as a banner is
   fine - and so does admin mode, which is where every size gets checked. */
export const WIDE_SIZES = ["Landscape", "Facebook Link", "Facebook Cover", "LinkedIn Post"];

export const STUDIO_SIZES = [
  {
    label: "Social",
    family: "social",
    // Every social shape a member can make a design at — and so every shape
    // they can resize one into. The portraits and the square are the ones
    // most designs are drawn for; the wide shapes below them ask more of a
    // resize, which is what the admin size check is for.
    sizes: [
      { name: "Instagram Portrait", w: 1080, h: 1440 },
      { name: "Facebook Portrait", w: 1080, h: 1350 },
      { name: "Square", w: 1080, h: 1080 },
      { name: "Story / Reel / TikTok", w: 1080, h: 1920 },
      { name: "Landscape", w: 1920, h: 1080 },
      { name: "Facebook Link", w: 1200, h: 628 },
      { name: "Facebook Cover", w: 820, h: 312 },
      { name: "LinkedIn Post", w: 1200, h: 627 },
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
      /* A6 is the postcard size, and a postcard is as often landscape as it
         is upright -- an invitation with a cut-out down one edge and the copy
         beside it only works the wide way round. Both, like A4 and A5. */
      print("A6 Postcard Portrait", 105, 148),
      print("A6 Postcard Landscape", 148, 105),
      print("Business Card", 85, 55),
    ],
  },
];
