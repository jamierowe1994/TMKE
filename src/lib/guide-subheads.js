// A paragraph that is nothing but bold words is a subheading (Danielle,
// 23 Nov 2026): it sits straight on the paragraph under it, and the usual
// paragraph gap comes at the end of the section. Lessons are written as
// <p><strong>…</strong></p>, in the site's code and in Admin › Guides, so the
// class is worked out when a lesson is drawn rather than saved with it.
// Styled in src/styles/guide-reader.css (.gr-subhead).
//
// The same pass tidies the blocks (Dani, 23 Nov: the gaps between headings
// and words weren't even). An edited lesson came back with some paragraphs
// as bare <div>s (no paragraph gap under them), <div><br></div> blank lines
// and empty <p></p>s (extra gaps). With { divsToP } a plain <div> holding
// only words becomes a <p>; with { dropEmpty } a block with no words and no
// picture is taken out. The reader does both. Admin Guides only turns divs
// into paragraphs when it draws a page: an empty paragraph there is a place
// to type, and nothing is swapped under the caret while she edits.
const BLOCKY = "div,p,ul,ol,li,figure,img,video,iframe,svg,table,blockquote,h1,h2,h3,h4,h5,h6,section,button,hr";
export function tidyBlocks(root, { divsToP = false, dropEmpty = false } = {}) {
  [...root.children].forEach((el) => {
    const plain = !el.attributes.length;
    if (divsToP && plain && el.tagName === "DIV" && !el.querySelector(BLOCKY)) {
      const p = el.ownerDocument.createElement("p");
      while (el.firstChild) p.appendChild(el.firstChild);
      el.replaceWith(p); el = p;
    }
    if (dropEmpty && plain && /^(P|DIV)$/.test(el.tagName) && !el.textContent.trim() && !el.querySelector("img,video,iframe,svg,button,input,hr")) el.remove();
  });
  return root;
}
export function markSubheads(root, tidy) {
  if (tidy) tidyBlocks(root, tidy);
  root.querySelectorAll("p").forEach((p) => {
    const kids = [...p.childNodes].filter((n) => !(n.nodeType === 3 && !n.textContent.trim()));
    const is = kids.length === 1 && kids[0].nodeType === 1 && /^(STRONG|B)$/.test(kids[0].tagName) && !!kids[0].textContent.trim();
    p.classList.toggle("gr-subhead", is);
    if (!p.getAttribute("class")) p.removeAttribute("class");
  });
  return root;
}
export const READER_TIDY = { divsToP: true, dropEmpty: true };
export function subheadsHtml(html) {
  if (!html || typeof document === "undefined") return html || "";
  const t = document.createElement("template");
  t.innerHTML = html;
  markSubheads(t.content, READER_TIDY);
  return t.innerHTML;
}
