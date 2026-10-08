/**
 * The demo's brand kit — a fictional agency.
 *
 * Training screenshots need a hub that looks like a real member's: templates
 * in a real palette, a real logo, real details pulling through. Using anyone's
 * actual account puts their branding in front of every other agency, and
 * making a fake member just to take pictures leaves a fake row in the CRM
 * forever. So the demo wears this instead: nobody's brand, no account, no
 * database row. Dani, 8 Oct.
 *
 * Seeded by /demo?brand=demo. Without that the demo behaves as it always has
 * and a visitor builds their own kit.
 */
export const DEMO_BRAND = {
  company: "Rimberio Homes",
  // "Area you cover" on the profile form saves as `location`, not `area` —
  // checked against the form's own save routine rather than guessed.
  location: "Devon",
  website: "rimberiohomes.co.uk",
  slogan: "",
  colors: [
    { hex: "#2e3236", name: "Ink" },
    { hex: "#8d98a7", name: "Primary" },
    { hex: "#a59983", name: "Accent" },
    { hex: "#d6cfc2", name: "Colour 04" },
    { hex: "#f3f1ed", name: "Colour 05" },
  ],
  fonts: { heading: "Prata", subheading: "Tangerine", body: "Poppins" },
  headshot: null,
  /* The shape the profile form itself writes — { name, src, primary } —
     rather than one of our own, so the kit round-trips through the page
     without being normalised away. */
  logos: [
    { name: "Rimberio (dark)", src: "/images/demo-brand/rimberio-dark.svg", primary: true },
    { name: "Rimberio (light)", src: "/images/demo-brand/rimberio-light.svg", primary: false },
  ],
  about: {
    name: "Alex Mercer",
    role: "Sales Director",
    phone: "01295 123456",
    email: "alex@rimberiohomes.co.uk",
  },
  /* Coastal Devon, high end, and deliberately not shouty about it — the voice
     the AI caption generator blends with the house rules. */
  tone:
    "Assured, warm and quietly premium. We sell coastal and country homes in Devon " +
    "to people who already know what good looks like, so we never oversell and we " +
    "never gush. Write plainly and let the house and the light do the talking: " +
    "short sentences, concrete detail, no estate-agent inflation. Say “the terrace " +
    "faces south-west”, not “breathtaking sun-drenched entertaining space”. " +
    "Confident but never grand — our buyers are discerning, not impressed by " +
    "adjectives. Minimal and modern in style: glass, concrete, pale neutrals, sea " +
    "light. Avoid exclamation marks, hard sell, luxury clichés (“stunning”, " +
    "“dream home”, “nestled”) and anything that sounds like a brochure trying too " +
    "hard. Warm, human and local — we live here too.",
};
