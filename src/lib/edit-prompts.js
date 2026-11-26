/* Which rows a member is asked to fill in on a design's Edit tab, and
   whether each one has a prompt (Danielle, 25 Nov 2026).

   The Catalogue's "Editing fields set up" tick and the Content Calendar's
   "Edit prompts" column work themselves out from this, where they used to be
   ticked by hand: a design is set up once every row a member sees has a
   prompt, whether the author typed it or the row came with one.

   THE RULES ARE THE STUDIO'S, COPIED. They live in public/scripts/editor.js,
   which a page can't import, so each one here names the function it follows:
   isFieldWorthy, fieldElements, backgroundIsField, fieldDefaultPrompt,
   entryPrompt, bgDefaultPrompt, tagsInText, sizeFamily, lockState. Change one
   there (a new starting prompt, say) and change it here too. Until then this
   only errs one way: it says a row has no prompt when the Studio gives it
   one, so a design reads as not ready, never as ready when it isn't. */
import { STUDIO_SIZES } from "../data/studio-sizes.js";

const sizesOf = (family) => new Set(STUDIO_SIZES.filter((g) => g.family === family).flatMap((g) => g.sizes.map((z) => `${z.w}x${z.h}`)));
const PRINT_SIZES = sizesOf("print"), SOCIAL_SIZES = sizesOf("social");
const LEGACY_PRINT = ["2551x3579", "1819x2551", "1311x1819", "1075x720"];

// sizeFamily: is this page a print one?
function isPrint(cv) {
  const W = Math.round((cv && cv.width) || 0), H = Math.round((cv && cv.height) || 0);
  if (!W || !H) return false;
  if (PRINT_SIZES.has(`${W}x${H}`)) return true;
  if (SOCIAL_SIZES.has(`${W}x${H}`)) return false;
  const r = Math.max(W, H) / Math.min(W, H);
  if (Math.abs(r - Math.SQRT2) < 0.01 && Math.min(W, H) >= 1200) return true;
  return LEGACY_PRINT.includes(`${Math.min(W, H)}x${Math.max(W, H)}`);
}
// isFolded / isPostcard: a card or postcard, whose background row is its card colour.
const isFolded = (cv) => !!(cv && cv.fold && Math.round(cv.width) === Math.round(297 * 300 / 25.4) && Math.round(cv.height) === Math.round(210 * 300 / 25.4));
const isPostcard = (cv) => !!(cv && Math.abs(cv.width - 1748) <= 2 && Math.abs(cv.height - 1240) <= 2);

// lockState
const lockState = (el) => (!el ? null : el.lock === "dead" || el.lock === "light" ? el.lock : el.locked ? "dead" : null);

// isFieldWorthy: social offers everything with words or a picture in it.
function isFieldWorthy(el) {
  if (!el || el.hidden || el.fieldHidden) return false;
  if (el.type === "text" || el.type === "frame" || el.type === "screen") return true;
  if (el.type === "image") return !el.svgKey;
  return false;
}

// tagsInText: does the text carry a brand kit tag?
const TAG_MENU = ["company name", "area", "slogan", "website", "agent name", "agent first name", "agent surname", "job title", "local expert", "telephone", "email"];
const TAG_SYNONYM_OF = {
  "brand name": "company name", "brand": "company name", "company": "company name",
  "your name": "agent name", "name": "agent name",
  "first name": "agent first name",
  "surname": "agent surname", "last name": "agent surname",
  "role": "job title",
  "location": "area", "town": "area",
  "strapline": "slogan", "tagline": "slogan",
  "phone": "telephone",
};
function hasTag(text) {
  if (!text || typeof text !== "string") return false;
  const pattern = /([{(])\s*([a-zA-Z][a-zA-Z ]*?)\s*([})])/g;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    if (!((m[1] === "{" && m[3] === "}") || (m[1] === "(" && m[3] === ")"))) continue;
    let k = m[2].toLowerCase().replace(/\s+/g, " ").trim();
    k = TAG_SYNONYM_OF[k] || k;
    if (TAG_MENU.includes(k)) return true;
  }
  return false;
}

// entryPrompt: words a member types over, known by the template's stand-ins.
function hasEntryPrompt(el) {
  if (!el || el.type !== "text") return false;
  const t = String(el.text || "").replace(/\s+/g, " ").trim();
  if (!t || t.length > 60) return false;
  if (/^\[\s*location\s*\]$/i.test(t)) return true;
  if (/^\[\s*(business|event|attraction)\s+name\s*\]$/i.test(t)) return true;
  if (/^\W*(guide price|offers?\s+(over|in excess of|in the region of|around)|oieo|oiro|asking price)\b/i.test(t) && t.indexOf("£") !== -1) return true;
  if (/street/i.test(t) && /post\s?code/i.test(t)) return true;
  if (/^[\s\-–—]*[A-Za-z][A-Za-z'’. ]*,\s*[A-Z]{1,2}\d{1,2}[A-Z]?\s*$/.test(t)) return true;
  return false;
}

// fieldDefaultPrompt, as the author sees it: does the row start with a prompt?
function hasDefaultPrompt(el) {
  if (el.brandRole === "logo") return true;
  if (el.type !== "text") return false;
  return hasTag(el.mergeSrc != null ? el.mergeSrc : el.text) || hasEntryPrompt(el);
}

// What to call a row that has no prompt, so it can be found in the Studio (fieldLabelFor).
function nameOf(el) {
  if (el.type === "text") {
    const words = String(el.text || "").replace(/\s+/g, " ").trim();
    return words ? `“${words.length > 42 ? words.slice(0, 42) + "…" : words}”` : "A text box";
  }
  if (el.brandRole === "photo") return "The photograph of the agent";
  if (el.brandRole === "headshot") return "The headshot";
  if (el.brandRole === "qr") return "The QR code";
  if (el.type === "wframe") return "The frame";
  if (/^(rect|ellipse|triangle|star)$/.test(el.type) && !el.src) return "A box's colour";
  return el.type === "image" || el.type === "frame" || el.type === "screen" ? "A picture" : "An item";
}

/**
 * The Edit rows of a design, as a member sees them.
 * @param t a templates row with canvas, elements and pages
 * @returns null when the design's contents weren't loaded, else
 *          { total, missing: [{ page, name }], pages }
 */
export function editRows(t) {
  if (!t) return null;
  const pages = Array.isArray(t.pages) && t.pages.length ? t.pages
    : (t.canvas && Array.isArray(t.elements) ? [{ canvas: t.canvas, elements: t.elements }] : null);
  if (!pages) return null;
  const card = pages.some((p) => p && p.canvas && (isFolded(p.canvas) || isPostcard(p.canvas)));
  let total = 0;
  const missing = [];
  pages.forEach((pg, i) => {
    const cv = (pg && pg.canvas) || {}, els = (pg && pg.elements) || [], print = isPrint(cv);
    // backgroundIsField, for a member; bgDefaultPrompt
    const bg = print ? !!cv.bgField && !cv.bgFieldHidden : !cv.bgFieldHidden && (!!cv.backgroundImage || !!cv.bgPattern);
    if (bg) {
      total++;
      const starts = !(card && !cv.bgPattern);   // a card's own colours keep "Card colour", which isn't a prompt
      if (!String(cv.bgFieldLabel || "").trim() && !starts) missing.push({ page: i + 1, name: "The card colour" });
    }
    // fieldElements
    const rows = print ? els.filter((el) => el && !el.hidden && !el.fieldHidden && lockState(el) === "light") : els.filter(isFieldWorthy);
    rows.forEach((el) => {
      total++;
      if (!String(el.fieldLabel || "").trim() && !hasDefaultPrompt(el)) missing.push({ page: i + 1, name: nameOf(el) });
    });
  });
  return { total, missing, pages: pages.length };
}
