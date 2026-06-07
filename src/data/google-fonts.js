// A curated set of the most-used Google Fonts, for the brand-kit typography
// picker. Searchable in the UI; each family is loaded on demand via the
// Google Fonts CSS API when previewed/selected. Not literally every family in
// the catalogue, but covers the overwhelming majority of real-world choices.
// Brand defaults (Cormorant Garamond, Darker Grotesque) are included.

export const GOOGLE_FONTS = [
  "Abel", "Abril Fatface", "Advent Pro", "Aleo", "Alfa Slab One", "Alegreya",
  "Alegreya Sans", "Alata", "Albert Sans", "Anton", "Antonio", "Archivo",
  "Archivo Black", "Archivo Narrow", "Arimo", "Arsenal", "Arvo", "Asap",
  "Assistant", "Barlow", "Barlow Condensed", "Barlow Semi Condensed",
  "Be Vietnam Pro", "Bebas Neue", "Bitter", "Bodoni Moda", "Cabin",
  "Cairo", "Cardo", "Catamaran", "Caveat", "Chivo", "Cinzel", "Comfortaa",
  "Cormorant", "Cormorant Garamond", "Cormorant Infant", "Courier Prime",
  "Crimson Pro", "Crimson Text", "DM Mono", "DM Sans", "DM Serif Display",
  "DM Serif Text", "Dancing Script", "Darker Grotesque", "Dosis",
  "EB Garamond", "Eczar", "Encode Sans", "Epilogue", "Exo", "Exo 2",
  "Figtree", "Fira Code", "Fira Sans", "Fjalla One", "Frank Ruhl Libre",
  "Fraunces", "Gelasio", "Gloock", "Golos Text", "Gothic A1", "Hahmlet",
  "Heebo", "Hind", "Hind Siliguri", "IBM Plex Mono", "IBM Plex Sans",
  "IBM Plex Serif", "Inconsolata", "Inder", "Inria Serif", "Inter",
  "Inter Tight", "Italiana", "Jost", "Josefin Sans", "Josefin Slab",
  "Kanit", "Karla", "Kaushan Script", "Kumbh Sans", "Lato", "League Spartan",
  "Lexend", "Lexend Deca", "Libre Baskerville", "Libre Caslon Text",
  "Libre Franklin", "Lilita One", "Lobster", "Lora", "Luckiest Guy",
  "Macondo", "Manrope", "Marcellus", "Martel", "Maven Pro", "Merriweather",
  "Merriweather Sans", "Messina", "Michroma", "Montserrat",
  "Montserrat Alternates", "Mukta", "Mulish", "Nanum Gothic", "Newsreader",
  "Noto Sans", "Noto Serif", "Nunito", "Nunito Sans", "Old Standard TT",
  "Omnes", "Onest", "Open Sans", "Orbitron", "Oswald", "Outfit", "Overpass",
  "Oxygen", "PT Sans", "PT Serif", "Pacifico", "Padauk", "Petrona",
  "Philosopher", "Piazzolla", "Plus Jakarta Sans", "Poetsen One", "Poppins",
  "Prata", "Prompt", "Public Sans", "Quattrocento", "Quattrocento Sans",
  "Questrial", "Quicksand", "Rajdhani", "Raleway", "Readex Pro", "Recursive",
  "Red Hat Display", "Red Hat Text", "Roboto", "Roboto Condensed",
  "Roboto Flex", "Roboto Mono", "Roboto Serif", "Roboto Slab", "Rokkitt",
  "Rubik", "Sacramento", "Saira", "Saira Condensed", "Sansita", "Satisfy",
  "Sora", "Source Code Pro", "Source Sans 3", "Source Serif 4", "Space Grotesk",
  "Space Mono", "Spectral", "Spline Sans", "Style Script", "Syne",
  "Tajawal", "Teko", "Tenor Sans", "Tinos", "Titillium Web", "Truculenta",
  "Ubuntu", "Ubuntu Mono", "Unbounded", "Unna", "Urbanist", "Vollkorn",
  "Work Sans", "Yanone Kaffeesatz", "Yantramanav", "Yeseva One", "Zilla Slab",
  "Zen Kaku Gothic New", "Zen Maru Gothic",
  // System / web-safe fallbacks (always render, no download needed)
  "Georgia", "Times New Roman", "Helvetica", "Arial", "Trebuchet MS",
  "Verdana", "Courier New", "Garamond", "Palatino Linotype", "Tahoma",
];

// Families that ship with the OS / browser — no Google Fonts download needed.
export const SYSTEM_FONTS = new Set([
  "Georgia", "Times New Roman", "Helvetica", "Arial", "Trebuchet MS",
  "Verdana", "Courier New", "Garamond", "Palatino Linotype", "Tahoma",
]);

/**
 * Inject a Google Fonts stylesheet for a family (once). System fonts skip the
 * network. Safe to call repeatedly — it de-dupes by family.
 */
export function loadGoogleFont(family) {
  if (!family || SYSTEM_FONTS.has(family)) return;
  if (typeof document === "undefined") return;
  const id = "gf-" + family.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=" +
    encodeURIComponent(family).replace(/%20/g, "+") +
    ":wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}
