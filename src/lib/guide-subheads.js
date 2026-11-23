// A paragraph that is nothing but bold words is a subheading (Danielle,
// 23 Nov 2026): it sits straight on the paragraph under it, and the usual
// paragraph gap comes at the end of the section. Lessons are written as
// <p><strong>…</strong></p>, in the site's code and in Admin › Guides, so the
// class is worked out when a lesson is drawn rather than saved with it.
// Styled in src/styles/guide-reader.css (.gr-subhead).
export function markSubheads(root) {
  root.querySelectorAll("p").forEach((p) => {
    const kids = [...p.childNodes].filter((n) => !(n.nodeType === 3 && !n.textContent.trim()));
    const is = kids.length === 1 && kids[0].nodeType === 1 && /^(STRONG|B)$/.test(kids[0].tagName) && !!kids[0].textContent.trim();
    p.classList.toggle("gr-subhead", is);
    if (!p.getAttribute("class")) p.removeAttribute("class");
  });
  return root;
}
export function subheadsHtml(html) {
  if (!html || typeof document === "undefined") return html || "";
  const t = document.createElement("template");
  t.innerHTML = html;
  markSubheads(t.content);
  return t.innerHTML;
}
