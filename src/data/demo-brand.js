/**
 * The demo's brand kit — a fictional agency.
 *
 * Training screenshots need a hub that looks like a real member's: templates
 * in a real palette, a real logo, real contact details pulling through. Using
 * anyone's actual account puts their branding in front of every other agency,
 * and making a fake member just to take pictures leaves a fake row in the CRM
 * forever. So the demo wears this instead: nobody's brand, no account, no
 * database row. Dani, 8 Oct.
 *
 * Seeded by /demo?brand=demo. Without that the demo behaves as it always has
 * and a visitor builds their own kit.
 */
export const DEMO_BRAND = {
  company: "Brackenvale Property",
  colors: [
    { hex: "#1F2A2E", name: "Ink" },
    { hex: "#2F5D50", name: "Primary" },
    { hex: "#C9A227", name: "Accent" },
    { hex: "#EDE8E0", name: "Warm neutral" },
    { hex: "#FAF8F5", name: "Paper" },
  ],
  fonts: { heading: "Fraunces", body: "Inter" },
  logos: [
    { url: "/images/demo-brand/brackenvale-dark.svg", kind: "dark" },
    { url: "/images/demo-brand/brackenvale-light.svg", kind: "light" },
  ],
  // No email: a plausible address on a domain we don't own, shown to a hundred
  // agents, is a way to send a stranger's inbox somebody else's post.
  about: { name: "Alex Mercer", role: "Sales Director", phone: "01295 123456" },
};
