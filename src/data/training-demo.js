// The training demo: one template and one brand kit, so a course walkthrough
// has something real to point at.
//
// The walks in the Studio course used to open a blank canvas, which meant
// "click the text on your design" with nothing on the design to click. The
// editor loads this instead when it is opened with ?training=1 - a finished
// property post, in a brand that is deliberately NOT the reader's, so "Make
// this design yours" has something to change.
//
// Nothing here is ever saved: editor.astro leaves the design-save hook
// undefined in training mode, so the demo cannot reach anyone's library.

const IMG = "/images/learn/demo/";

// A text block, shaped the way editor.js builds them (see addText).
const t = (id, o) => ({
  id, type: "text", rotation: 0, opacity: 1, align: "center",
  font: "Cormorant Garamond", weight: 500, italic: false,
  color: "#ffffff", letterSpacing: 0, lineHeight: 1.15, ...o,
});

export const TRAINING_DESIGN = {
  id: "training-demo",
  name: "Demo template",
  canvas: {
    width: 1080, height: 1440,
    background: "#241a1d",
    backgroundImage: IMG + "room-a-v1.jpg",
    bgFit: "cover", bgPosX: 50, bgPosY: 50, bgNatW: 1080, bgNatH: 1440,
  },
  elements: [
    // A light scrim over the photo, so white type holds wherever the picture
    // is bright, and a solid band for the words underneath it.
    { id: "demo-scrim", type: "rect", x: 0, y: 0, w: 1080, h: 1440, rotation: 0, opacity: 0.18,
      fill: "#1C1D22", stroke: "transparent", strokeWidth: 0, radius: 0 },
    { id: "demo-band", type: "rect", x: 0, y: 1000, w: 1080, h: 440, rotation: 0, opacity: 1,
      fill: "#371E28", stroke: "transparent", strokeWidth: 0, radius: 0 },
    // The photo inside the design - the one "change an image" replaces.
    { id: "demo-inset", type: "image", x: 96, y: 120, w: 260, h: 260, rotation: 0, opacity: 1,
      src: IMG + "detail-v1.jpg" },
    t("demo-eyebrow", { x: 140, y: 470, w: 800, h: 44, text: "NEW TO MARKET",
      font: "Darker Grotesque", size: 26, weight: 700, letterSpacing: 8 }),
    t("demo-heading", { x: 90, y: 1040, w: 900, h: 140, text: "Chapel Street", size: 104, lineHeight: 1.02 }),
    t("demo-sub", { x: 140, y: 1200, w: 800, h: 56, text: "Four bedrooms  \u00b7  Guide price \u00a3425,000",
      font: "Darker Grotesque", size: 34, weight: 400, letterSpacing: 1 }),
    t("demo-foot", { x: 140, y: 1300, w: 800, h: 40, text: "01234 567 890  \u00b7  yourbusiness.co.uk",
      font: "Darker Grotesque", size: 22, weight: 500, letterSpacing: 4, color: "#E9E2D8" }),
  ],
};

// The other photo, for the walk that changes the background.
export const TRAINING_BG_ALT = IMG + "room-b-v1.jpg";

// The demo's logo: an SVG wordmark as a data URI, so it needs no file and no
// network of its own.
const wordmark = (ink) => "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 120"><g fill="${ink}" font-family="Georgia, 'Times New Roman', serif">` +
  `<text x="210" y="62" font-size="48" letter-spacing="2" text-anchor="middle">Your Agency</text>` +
  `<text x="210" y="96" font-size="17" letter-spacing="9" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">ESTATE AGENTS</text>` +
  `</g></svg>`);

// A stand-in brand kit, used only when the reader hasn't built their own.
// Different colours and fonts from the template above, so every rebrand row
// has a visible before and after.
export const TRAINING_KIT = {
  company: "Your Agency",
  location: "Your town",
  demo: true,
  colors: [
    { hex: "#1F3B4D", name: "Navy" },
    { hex: "#C7A17A", name: "Sand" },
    { hex: "#F4F2F1", name: "Paper" },
    { hex: "#1C1D22", name: "Ink" },
  ],
  fonts: { heading: "Playfair Display", body: "Inter" },
  // A plain wordmark, drawn here rather than uploaded, so the logo row and the
  // logo grid have something in them during the walk.
  logos: [
    { name: "Wordmark", primary: true, src: wordmark("#1C1D22") },
    { name: "Wordmark, reversed", src: wordmark("#FFFFFF") },
  ],
};
