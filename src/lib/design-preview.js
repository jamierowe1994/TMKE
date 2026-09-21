/* Shared mini-renderer for admin pages that show designs without opening them.
   The Design studio grid and the Contact blocks page both draw the same kind of
   preview — positioned divs scaled by percentage, font sizes in cqw so type
   scales with the thumbnail — so the maths lives here rather than in two
   copies that quietly disagree. */

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function fontStack(f) {
  const s = String(f || '');
  return /garamond|seasons|helios|times|serif/i.test(s)
    ? `'${s}', Georgia, serif`
    : `'${s}', 'Darker Grotesque', system-ui, sans-serif`;
}

/* One element as a positioned div/img. W/H are the units the element's
   coordinates are measured in — a canvas for a template, a bounding box for a
   block. The thumb must be a container (container-type: size) for the cqw
   font sizes to resolve. */
export function renderEl(el, W, H) {
  if (!el || el.x == null) return '';
  const pos = `position:absolute;left:${(el.x / W * 100).toFixed(3)}%;top:${(el.y / H * 100).toFixed(3)}%;width:${(el.w / W * 100).toFixed(3)}%;height:${(el.h / H * 100).toFixed(3)}%;`;
  const rot = el.rotation ? `transform:rotate(${el.rotation}deg);` : '';
  if ((el.type === 'image' || el.type === 'frame') && el.src) {
    const rad = el.frameShape === 'circle' ? 'border-radius:50%;' : '';
    return `<img src="${escapeHtml(el.src)}" alt="" loading="lazy" style="${pos}${rot}${rad}object-fit:cover;opacity:${el.opacity ?? 1};" />`;
  }
  // An unfilled brand slot still has to show up, or a footer designed round a
  // headshot previews as a hole.
  if ((el.type === 'image' || el.type === 'frame') && el.brandRole) {
    const rad = el.frameShape === 'circle' ? 'border-radius:50%;' : 'border-radius:2px;';
    return `<div style="${pos}${rot}${rad}background:rgba(28,29,34,0.07);border:1px dashed rgba(28,29,34,0.28);box-sizing:border-box;"></div>`;
  }
  if (el.type === 'rect') {
    const rad = el.radius ? `border-radius:${(el.radius / W * 100).toFixed(2)}cqw;` : '';
    return `<div style="${pos}${rot}background:${escapeHtml(el.fill || 'transparent')};opacity:${el.opacity ?? 1};${rad}"></div>`;
  }
  if (el.type === 'text') {
    const fs = (Number(el.size) || 16) / W * 100;
    const ls = (Number(el.letterSpacing) || 0) / W * 100;
    return `<div style="${pos}${rot}color:${escapeHtml(el.color || '#1c1d22')};font-family:${fontStack(el.font)};font-size:${fs.toFixed(3)}cqw;font-weight:${el.weight || 400};font-style:${el.italic ? 'italic' : 'normal'};text-align:${el.align || 'left'};letter-spacing:${ls.toFixed(3)}cqw;line-height:${el.lineHeight || 1.2};overflow:hidden;">${escapeHtml(el.text || '')}</div>`;
  }
  return '';
}

/* ---- Contact blocks ---------------------------------------------------- */

export const VARIANT_LABEL = {
  'contact-small': 'Small footer — no photo',
  'contact-small-photo': 'Small footer — with headshot',
  'contact-full': 'Full-page contact details',
  'contact-other': 'Contact block',
};

export const VARIANT_ORDER = [
  'contact-small-photo', 'contact-small', 'contact-full', 'contact-other',
];

/* The tight box round every element, in the drawing canvas's own units, plus
   the canvas it was drawn on. This is the whole of what insert needs: a block
   fills the same share of the width it filled here. */
export function blockBoxOf(t) {
  const cv = (t && t.canvas) || {};
  const canvasW = Number(cv.width) || 1080;
  const canvasH = Number(cv.height) || 1350;
  const els = (Array.isArray(t && t.elements) ? t.elements : []).filter((el) => el && el.x != null);
  if (!els.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  els.forEach((el) => {
    const x = Number(el.x) || 0, y = Number(el.y) || 0;
    const w = Number(el.w) || 0, h = Number(el.h) || 0;
    if (x < x1) x1 = x;
    if (y < y1) y1 = y;
    if (x + w > x2) x2 = x + w;
    if (y + h > y2) y2 = y + h;
  });
  return {
    x: Math.round(x1), y: Math.round(y1),
    w: Math.round(x2 - x1), h: Math.round(y2 - y1),
    canvasW, canvasH,
  };
}

// Two boxes are the same block if every number matches.
export function sameBox(a, b) {
  if (!a || !b) return false;
  return ['x', 'y', 'w', 'h', 'canvasW', 'canvasH'].every((k) => Number(a[k]) === Number(b[k]));
}

/* A block's preview shows the block, not the canvas it was drawn on — which
   is exactly what a member gets when they drop it in. */
export function renderBlockPreview(t, box) {
  const b = box || (t && t.block_box) || {};
  const W = Number(b.w) || 0, H = Number(b.h) || 0;
  const els = Array.isArray(t && t.elements) ? t.elements : [];
  if (!W || !H || !els.length) return '';
  const shifted = els.map((el) => (el && el.x != null
    ? Object.assign({}, el, { x: (Number(el.x) || 0) - (Number(b.x) || 0), y: (Number(el.y) || 0) - (Number(b.y) || 0) })
    : el));
  return shifted.map((el) => renderEl(el, W, H)).join('');
}
