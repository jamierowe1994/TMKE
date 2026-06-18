// Estate-agency website templates — showcase registry.
//
// Three design directions live here. Each entry drives:
//   - the showcase card on /estate-agency
//   - the preview route /estate-agency/preview/<slug>
// The preview route looks up the slug here and renders the matching
// template component from src/components/estate-agency/templates/.

const UNSPLASH = (id, w = 1600, h = 1000) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

/**
 * @typedef {Object} EstateTemplate
 * @property {string}  slug
 * @property {string}  name
 * @property {string}  category   "Classy" | "Countryside" | "Everyday"
 * @property {string}  tagline
 * @property {string}  summary
 * @property {string}  audience
 * @property {string}  thumbnail
 * @property {string}  accent     CSS colour for tonal accents on the showcase card
 * @property {string[]} features
 * @property {"draft"|"ready"} status
 */

/** @type {EstateTemplate[]} */
export const templates = [
  {
    slug: "belgrave",
    name: "Belgrave",
    category: "Classy",
    tagline: "Cinematic, prime-market, editorial pace",
    summary:
      "A high-end homepage for prime independents. Wordmark hero, slow editorial scroll, polaroid-stacked feature, and a curated selected-projects strip.",
    audience: "Prime London & Home Counties independents",
    thumbnail: UNSPLASH("1512917774080-9991f1c4c750", 1200, 900),
    accent: "#1c1d22",
    features: [
      "Full-bleed cinematic hero",
      "Editorial copy block",
      "Polaroid-stacked feature",
      "Selected projects strip",
    ],
    status: "ready",
  },
  {
    slug: "wold",
    name: "Wold",
    category: "Countryside",
    tagline: "Cream-and-oak, regional, slow",
    summary:
      "A warm, traditional-but-minimal homepage for country agencies. Cream palette, regional collections, period-property listings, and a quiet country-living story.",
    audience: "Country & village specialists",
    thumbnail: UNSPLASH("1505693416388-ac5ce068fe85", 1200, 900),
    accent: "#6f6147",
    features: [
      "Cream / oak palette",
      "Regional collections",
      "Period-property listings",
      "Country-living story",
    ],
    status: "ready",
  },
  {
    slug: "tle",
    name: "The Letting Experts",
    category: "Lettings",
    tagline: "Airy editorial white-and-red, lettings-led",
    summary:
      "A bright, editorial rebuild of a lettings agency homepage — white and red (#e31f36) in Montserrat, with framed photography, a property showcase, services, testimonials, team, blog and accreditations. Dynamic and free-flowing; a world away from the flat original.",
    audience: "Lettings agencies & property managers",
    thumbnail: UNSPLASH("1560448204-e02f11c3d0e2", 1200, 900),
    accent: "#e31f36",
    features: [
      "Editorial white-and-red palette",
      "Property showcase + rent CTAs",
      "Services, testimonials & team",
      "Accreditations strip",
    ],
    status: "ready",
  },
];

/** Lookup by slug — used by the dynamic preview route. */
export function getTemplate(slug) {
  return templates.find((t) => t.slug === slug);
}
