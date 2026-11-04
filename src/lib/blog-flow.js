/* Blog spacing: what you type is what you get (Danielle, 4 Nov 2026).

   An article body is a run of blocks (paragraphs, headings, quotes, lists),
   and every block is followed by the same gap: the article's paragraph
   spacing. Nothing adds space of its own. A heading has no extra room above
   or below it, and Word's "space after" is overridden. More space is a blank
   line you type (an empty paragraph), and a blank line is always one line
   high. The editor draws the same rules, so what it shows is what publishes.

   Articles written before this carry no `flow` mark in body_styles and keep
   their old look until they are opened in the editor, which converts them
   (toFlow) and marks them on save. */

export const FLOW_DEFAULT_GAP = "0.7em";
const GAP_OK = /^(0|\d(\.\d+)?em)$/;

/* The gap in pixels, measured against the body text: "0.4em" written on a
   heading would be measured against the heading's bigger size, and the gap
   under it would come out larger than the rest. */
export function flowGap(styles) {
  const g = styles && styles.p && styles.p.gap;
  const em = parseFloat(GAP_OK.test(g || "") ? g : FLOW_DEFAULT_GAP) || 0;
  const size = parseFloat(styles && styles.p && styles.p.size) || 18;   // the body's default size
  return Math.round(em * size * 10) / 10 + "px";
}

/* The spacing rules for one article body. `force` draws them whatever the
   article's mark (the editor, which converts on open). */
export function blogFlowCss(styles, scope, force) {
  if (!force && !(styles && styles.flow)) return "";
  const gap = flowGap(styles);
  const blocks = ":is(p,h1,h2,h3,h4,blockquote,ul,ol,div,figure)";
  return [
    // !important: Word puts its own margins inline on every paragraph.
    `${scope} > ${blocks}{margin:0 0 ${gap} !important}`,
    `${scope} > :last-child{margin-bottom:0 !important}`,
    // A blank line is one line of body text, whatever it sits between.
    `${scope} > p:empty{min-height:1lh}`,
  ].join("\n");
}

const isBlankBlock = (el) =>
  !!el && el.nodeType === 1 && /^(P|DIV)$/.test(el.tagName) &&
  !el.querySelector("img, iframe, video, hr") &&
  el.textContent.replace(/[ ​\s]/g, "") === "";

function blankP(doc) {
  const p = doc.createElement("p");
  p.appendChild(doc.createElement("br"));
  return p;
}

// The <br>s in a block, grouped into runs with no text between them.
function brRuns(block) {
  const doc = block.ownerDocument;
  const walker = doc.createTreeWalker(block, 5 /* elements + text */);
  const runs = [];
  let run = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 1 && n.tagName === "BR") { (run = run || []).push(n); continue; }
    if (n.nodeType === 3 && n.nodeValue.replace(/[​\s]/g, "") === "") continue;
    if (n.nodeType === 3 || /^(IMG|IFRAME|VIDEO|HR)$/.test(n.tagName)) {
      if (run) { runs.push({ brs: run, textAfter: true }); run = null; }
    }
  }
  if (run) runs.push({ brs: run, textAfter: false });
  return runs;
}

/* Tidy a body into the shape the spacing rules expect, without changing what
   the writer meant:
   - two or more line breaks inside a paragraph are a paragraph break plus
     blank lines (one fewer than the breaks), so "text<br><br>" at the end of
     a paragraph is that paragraph followed by one blank line;
   - a single line break stays a line break;
   - top-level <div>s (Chrome's Enter) become paragraphs;
   - an empty heading is a blank line, and blank lines at the very end go. */
export function normalizeBody(root) {
  const doc = root.ownerDocument;
  [...root.children].forEach((el) => {
    if (el.tagName === "DIV" && !el.querySelector("p,h1,h2,h3,h4,ul,ol,blockquote,div")) {
      const p = doc.createElement("p");
      if (el.getAttribute("style")) p.setAttribute("style", el.getAttribute("style"));
      while (el.firstChild) p.appendChild(el.firstChild);
      el.replaceWith(p);
    }
  });
  [...root.children].forEach((el) => {
    if (/^H[1-4]$/.test(el.tagName) && el.textContent.replace(/[ ​\s]/g, "") === "") el.replaceWith(blankP(doc));
  });
  [...root.children].forEach((block) => {
    if (!/^(P|H1|H2|H3|H4)$/.test(block.tagName)) return;
    let cur = block;
    for (let guard = 0; guard < 50; guard++) {
      const runs = brRuns(cur);
      const split = runs.find((r) => r.textAfter && r.brs.length >= 2);
      if (!split) {
        const tail = runs.find((r) => !r.textAfter);
        if (tail && !isBlankBlock(cur)) {
          tail.brs.forEach((br) => br.remove());
          let at = cur;
          for (let i = 1; i < tail.brs.length; i++) { const b = blankP(doc); at.after(b); at = b; }
        }
        break;
      }
      // Everything before the run becomes its own block; the rest carries on.
      const range = doc.createRange();
      range.setStart(cur, 0);
      range.setEndBefore(split.brs[0]);
      const head = cur.cloneNode(false);
      head.appendChild(range.extractContents());
      split.brs.forEach((br) => br.remove());
      cur.before(head);
      for (let i = 1; i < split.brs.length; i++) cur.before(blankP(doc));
      // A heading split this way keeps its tag on the first part only.
      if (/^H/.test(cur.tagName)) {
        const p = doc.createElement("p");
        while (cur.firstChild) p.appendChild(cur.firstChild);
        cur.replaceWith(p);
        cur = p;
      }
    }
  });
  // Formatting wrappers left with nothing in them by the split.
  root.querySelectorAll("strong:empty, b:empty, em:empty, i:empty, span:empty").forEach((e) => e.remove());
  while (root.lastElementChild && isBlankBlock(root.lastElementChild)) root.lastElementChild.remove();
  return root;
}

/* An article from before: headings used to bring their own room above them.
   Keep that look by putting a blank line before each heading that has text
   straight above it, where it can now be seen and taken out. */
export function toFlow(root) {
  const doc = root.ownerDocument;
  normalizeBody(root);
  [...root.children].forEach((el) => {
    if (!/^H[1-4]$/.test(el.tagName)) return;
    const prev = el.previousElementSibling;
    if (prev && !isBlankBlock(prev)) el.before(blankP(doc));
  });
  return root;
}
