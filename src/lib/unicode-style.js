/* Bold, italic and underline that survive a paste into Instagram, Facebook
   or LinkedIn (Dani, 17 Oct; as textspacer.com does). Those boxes take plain
   text only, so the style is in the letters themselves: the Unicode
   "mathematical" sans-serif alphabets (𝗯𝗼𝗹𝗱, 𝘪𝘵𝘢𝘭𝘪𝘤, 𝙗𝙤𝙩𝙝) and a combining
   low line after each character for u̲n̲d̲e̲r̲l̲i̲n̲e̲. Applying a style the
   selection already has takes it off again.

   Worth knowing, and said beside the buttons: screen readers and search
   don't read these letters as words, so they're for a word or a line, not
   the whole caption. */

const RANGES = {
  // style: [A, a, 0] start code points (0 = digits have no italic form)
  b:  [0x1D5D4, 0x1D5EE, 0x1D7EC],
  i:  [0x1D608, 0x1D622, 0],
  bi: [0x1D63C, 0x1D656, 0x1D7EC],
};
const UNDER = "̲";

// One character -> { ch: plain letter, b, i }
function read(cp) {
  for (const [key, [A, a, d]] of Object.entries(RANGES)) {
    const flags = { b: key.includes("b"), i: key.includes("i") };
    if (cp >= A && cp < A + 26) return { ch: String.fromCharCode(65 + cp - A), ...flags };
    if (cp >= a && cp < a + 26) return { ch: String.fromCharCode(97 + cp - a), ...flags };
    if (d && cp >= d && cp < d + 10) return { ch: String.fromCharCode(48 + cp - d), b: true, i: false };
  }
  return { ch: String.fromCodePoint(cp), b: false, i: false };
}
function write({ ch, b, i }) {
  const key = b && i ? "bi" : b ? "b" : i ? "i" : "";
  if (!key) return ch;
  const [A, a, d] = RANGES[key];
  const c = ch.charCodeAt(0);
  if (c >= 65 && c <= 90) return String.fromCodePoint(A + c - 65);
  if (c >= 97 && c <= 122) return String.fromCodePoint(a + c - 97);
  if (c >= 48 && c <= 57) return d ? String.fromCodePoint(d + c - 48) : ch;   // italic digits don't exist
  return ch;
}
// Split into characters, each with whether a low line follows it.
function chars(text) {
  const out = [];
  for (const piece of Array.from(String(text || ""))) {
    if (piece === UNDER) { if (out.length) out[out.length - 1].u = true; continue; }
    out.push({ ...read(piece.codePointAt(0)), u: false });
  }
  return out;
}
const isLetterish = (ch) => /[A-Za-z0-9]/.test(ch);

/* Toggle `style` ("b", "i" or "u") across `text`: on if any part lacks it,
   off if all of it has it. */
export function toggleStyle(text, style) {
  const list = chars(text);
  const targets = style === "u" ? list.filter((c) => !/\s/.test(c.ch)) : list.filter((c) => isLetterish(c.ch));
  if (!targets.length) return text;
  const on = !targets.every((c) => c[style]);
  targets.forEach((c) => { c[style] = on; });
  return list.map((c) => write(c) + (c.u ? UNDER : "")).join("");
}

// The plain letters back, for anything that must not carry the styling.
export function plainText(text) {
  return chars(text).map((c) => c.ch).join("");
}
