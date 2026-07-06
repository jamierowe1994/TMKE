/**
 * TMKE email renderer — turns a saved template (a list of "blocks" + branding)
 * into self-contained, email-client-safe HTML, with mail-merge tokens resolved
 * per-recipient.
 *
 * Ported and trimmed from the Backed.CRM mass-emailer (lib/renderEmail.js +
 * lib/mailMerge.js). The recruitment-only blocks (candidate / job, which needed
 * a database round-trip) were dropped so this module is 100% pure — no imports,
 * no async, no Node APIs. That means the SAME file powers:
 *   • the live preview in the admin builder (runs in the browser), and
 *   • the actual send (re-used server-side in a later phase).
 *
 * Design rules for email HTML: inline styles only (most clients strip <style>),
 * table-based layout, no external CSS. Keep it boring and it renders everywhere.
 */

const ACCENT_DEFAULT = '#371e28'; // TMKE english-violet / plum

/* ───────────────────────── mail merge ───────────────────────── */

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/**
 * render('Hi {{firstName}}', { firstName: 'Alex' }) → 'Hi Alex'
 * Tokens with a null value resolve to ''. Unknown tokens fall through unchanged
 * so they're easy to spot in a preview.
 */
export function renderTokens(input, ctx) {
  if (input == null) return '';
  const str = String(input);
  if (!ctx || typeof ctx !== 'object') return str;
  return str.replace(TOKEN_RE, (match, key) => {
    const val = lookup(ctx, key);
    if (val === undefined) return match;
    if (val === null) return '';
    return String(val);
  });
}

function lookup(obj, path) {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * Build the flat merge context for one recipient. Shape is intentionally flat so
 * tokens read naturally: {{firstName}}, {{email}}, {{company}}, {{senderName}}.
 */
export function mergeContextFor(recipient = {}, brand = {}) {
  const fullName = recipient.name || '';
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return {
    firstName: recipient.firstName || firstName || '',
    lastName: recipient.lastName || rest.join(' ') || '',
    fullName,
    email: recipient.email || '',
    company: recipient.company || '',
    phone: recipient.phone || '',
    // Purchase context — populated from the contact's last order at send time
    // (the automations engine passes it in), so "Thank you for buying {{packName}}" works.
    packName: recipient.packName || recipient.pack || '',
    orderTotal: recipient.orderTotal || '',
    senderName: brand.signatureName || '',
    senderCompany: brand.companyName || '',
  };
}

/** Tokens offered in the builder's merge-field menu (label shown to staff). */
export const MERGE_FIELDS = [
  { token: 'firstName', label: 'First name' },
  { token: 'lastName', label: 'Last name' },
  { token: 'fullName', label: 'Full name' },
  { token: 'email', label: 'Email address' },
  { token: 'company', label: 'Company name' },
  { token: 'phone', label: 'Mobile / phone' },
  { token: 'packName', label: 'Purchased pack' },
  { token: 'orderTotal', label: 'Order total' },
  { token: 'senderName', label: 'Sender name' },
  { token: 'senderCompany', label: 'Sender company' },
];

/** A dummy recipient so the live preview shows realistic merged values. */
export const SAMPLE_RECIPIENT = { name: 'Alex Morgan', email: 'alex@example.com', company: 'Acme Estates', phone: '07700 900123', packName: 'The Spring Collection', orderTotal: '£149' };

/* ───────────────────────── branding ───────────────────────── */

/** TMKE house brand — the defaults a fresh template starts from. */
export function defaultBrand() {
  return {
    companyName: 'TMKE',
    logo: '',
    accentColor: ACCENT_DEFAULT,
    signatureName: 'The TMKE Team',
    bgColor: '#f4f2f1',
    cardColor: '#ffffff',
    website: 'https://tmke.co.uk',
    reviewUrl: '',
    linkedin: '',
    instagram: '',
    facebook: '',
    twitter: '',
    youtube: '',
  };
}

/* ───────────────────────── block model ───────────────────────── */

/** Block palette shown in the builder. Order = order in the rail grid. */
export const BLOCK_TYPES = [
  { type: 'heading', label: 'Heading', hint: 'A big title' },
  { type: 'text', label: 'Text', hint: 'A paragraph of copy' },
  { type: 'image', label: 'Image', hint: 'A picture, optionally a link' },
  { type: 'button', label: 'Button', hint: 'A call-to-action' },
  { type: 'columns', label: 'Columns', hint: 'A multi-column row layout' },
  { type: 'divider', label: 'Divider', hint: 'A horizontal line' },
  { type: 'spacer', label: 'Spacer', hint: 'Vertical whitespace' },
  { type: 'logo', label: 'Logo', hint: 'Your brand logo' },
  { type: 'social', label: 'Social', hint: 'Social icon links' },
  { type: 'video', label: 'Video', hint: 'A clickable video thumbnail' },
  { type: 'footer', label: 'Footer', hint: 'Sign-off, address & unsubscribe' },
  { type: 'faq', label: 'FAQ', hint: 'Question & answer list' },
  { type: 'countdown', label: 'Countdown', hint: 'An offer / deadline date' },
  { type: 'reviewlink', label: 'Review link', hint: 'Ask for a review' },
  { type: 'products', label: 'Products', hint: 'A grid of packs' },
  { type: 'services', label: 'Services', hint: 'What you offer' },
  { type: 'slider', label: 'Image gallery', hint: 'A row of images' },
  { type: 'form', label: 'Form', hint: 'A prompt + button to a form' },
  { type: 'code', label: 'Custom HTML', hint: 'Paste your own HTML' },
];

/** The column splits offered in the builder. `cols` = how many cells; `w` =
 *  per-cell width %. Used by both the builder (cell count) and the renderer. */
export const COLUMN_LAYOUTS = [
  { key: 'full',     label: 'Full width',            cols: 1, w: [100] },
  { key: '50-50',    label: 'Two columns (50 / 50)', cols: 2, w: [50, 50] },
  { key: 'thirds',   label: 'Three columns (⅓ each)', cols: 3, w: [33.33, 33.33, 33.34] },
  { key: '33-67',    label: '⅓ + ⅔',                 cols: 2, w: [33.33, 66.67] },
  { key: '67-33',    label: '⅔ + ⅓',                 cols: 2, w: [66.67, 33.33] },
  { key: '25-75',    label: '¼ + ¾',                 cols: 2, w: [25, 75] },
  { key: '75-25',    label: '¾ + ¼',                 cols: 2, w: [75, 25] },
  { key: 'quarters', label: 'Four columns',          cols: 4, w: [25, 25, 25, 25] },
];

/** Email-safe font stacks — only fonts pre-installed across Outlook (Windows +
 *  Mac), Gmail, Apple Mail etc., so no web font is ever needed (they get
 *  stripped). `key` is stored on the block; `stack` is emitted as font-family. */
export const FONT_STACKS = [
  { key: 'arial',     label: 'Arial',           stack: "Arial, Helvetica, sans-serif" },
  { key: 'helvetica', label: 'Helvetica',       stack: "Helvetica, Arial, sans-serif" },
  { key: 'verdana',   label: 'Verdana',         stack: "Verdana, Geneva, sans-serif" },
  { key: 'tahoma',    label: 'Tahoma',          stack: "Tahoma, Segoe, sans-serif" },
  { key: 'trebuchet', label: 'Trebuchet MS',    stack: "'Trebuchet MS', Helvetica, sans-serif" },
  { key: 'georgia',   label: 'Georgia',         stack: "Georgia, 'Times New Roman', serif" },
  { key: 'times',     label: 'Times New Roman', stack: "'Times New Roman', Georgia, serif" },
  { key: 'courier',   label: 'Courier New',     stack: "'Courier New', Courier, monospace" },
];
function fontStack(key) { const f = FONT_STACKS.find((x) => x.key === key); return f ? f.stack : FONT_STACKS[0].stack; }
function pxNum(v, fallback) { const n = Number(v); return isFinite(n) ? Math.round(n) : fallback; }
function padStyle(pad) {
  if (!pad) return '';
  const t = pxNum(pad.t, 0), r = pxNum(pad.r, 0), b = pxNum(pad.b, 0), l = pxNum(pad.l, 0);
  if (!(t || r || b || l)) return '';
  return `padding:${t}px ${r}px ${b}px ${l}px;`;
}

/** Inline style for a heading block — shared by the renderer AND the editor's
 *  canvas so what you see is what sends. */
export function headingInlineStyle(block = {}) {
  const align = ['left', 'center', 'right'].includes(block.align) ? block.align : 'left';
  const size = pxNum(block.size, 28);
  const lh = Number(block.lineHeight) || 1.15;
  const weight = block.bold === false ? 400 : 800;
  const parts = [
    'margin:0', `font-family:${fontStack(block.font)}`, `font-size:${size}px`,
    `line-height:${lh}`, `font-weight:${weight}`, `color:${escapeHtml(block.color || '#1c1d22')}`,
    `text-align:${align}`,
  ];
  if (block.letterSpacing != null && block.letterSpacing !== '') parts.push(`letter-spacing:${Number(block.letterSpacing)}px`);
  else parts.push('letter-spacing:-0.01em');
  if (block.italic) parts.push('font-style:italic');
  if (block.underline) parts.push('text-decoration:underline');
  return parts.join(';') + ';' + padStyle(block.pad);
}

/** Inline style for a text block's wrapper (font/size/spacing/colour/align/
 *  padding + optional background tint). Shared by renderer + canvas. */
export function textInlineStyle(block = {}) {
  const align = ['left', 'center', 'right'].includes(block.align) ? block.align : 'left';
  const size = pxNum(block.size, 15);
  const lh = Number(block.lineHeight) || 1.6;
  const parts = [
    `font-family:${fontStack(block.font)}`, `font-size:${size}px`, `line-height:${lh}`,
    `color:${escapeHtml(block.color || '#1F2937')}`, `text-align:${align}`,
  ];
  if (block.letterSpacing != null && block.letterSpacing !== '') parts.push(`letter-spacing:${Number(block.letterSpacing)}px`);
  if (block.bold) parts.push('font-weight:700');
  if (block.italic) parts.push('font-style:italic');
  if (block.underline) parts.push('text-decoration:underline');
  let style = parts.join(';') + ';';
  const pad = padStyle(block.pad);
  if (block.bg) style += `background:${escapeHtml(block.bg)};border-radius:8px;` + (pad || 'padding:14px 18px;');
  else style += pad;
  return style;
}

/** The per-device responsive properties (block.mobile.* overrides the base,
 *  which is the desktop value). font family / colour / weight stay global. */
function responsiveDecls(block) {
  const m = (block && block.mobile) || {};
  const d = [];
  if (m.size != null && m.size !== '') d.push(`font-size:${pxNum(m.size, 15)}px !important`);
  if (m.lineHeight != null && m.lineHeight !== '') d.push(`line-height:${Number(m.lineHeight)} !important`);
  if (m.letterSpacing != null && m.letterSpacing !== '') d.push(`letter-spacing:${Number(m.letterSpacing)}px !important`);
  if (['left', 'center', 'right'].includes(m.align)) d.push(`text-align:${m.align} !important`);
  if (m.pad) {
    const t = pxNum(m.pad.t, 0), r = pxNum(m.pad.r, 0), b = pxNum(m.pad.b, 0), l = pxNum(m.pad.l, 0);
    if (t || r || b || l) d.push(`padding:${t}px ${r}px ${b}px ${l}px !important`);
  }
  return d;
}
function hasMobileOverrides(block) { return responsiveDecls(block).length > 0; }

/** A view of a block with its mobile overrides folded in — used by the editor
 *  canvas so the Mobile preview shows the mobile size/spacing/align/padding. */
export function effectiveBlock(block, device) {
  if (device !== 'mobile' || !block || !block.mobile) return block;
  const m = block.mobile;
  const out = { ...block };
  ['size', 'lineHeight', 'letterSpacing', 'align'].forEach((k) => { if (m[k] != null && m[k] !== '') out[k] = m[k]; });
  if (m.pad) out.pad = { ...(block.pad || {}), ...m.pad };
  return out;
}

let _uidCounter = 0;
function uid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return 'b_' + crypto.randomUUID().slice(0, 8);
  } catch (_) { /* fall through */ }
  _uidCounter += 1;
  return 'b_' + _uidCounter.toString(36) + '_' + (typeof performance !== 'undefined' ? Math.floor(performance.now()) : _uidCounter);
}

/** Make a new block of the given type, pre-filled with friendly defaults. */
export function makeBlock(type) {
  const id = uid();
  switch (type) {
    case 'heading':
      return { type, id, text: 'A bold headline', align: 'left', color: '' };
    case 'text':
      return { type, id, text: 'Hi {{firstName}},\n\nWrite your message here.', bg: '' };
    case 'image':
      return { type, id, url: '', alt: '', linkUrl: '', align: 'center' };
    case 'button':
      return { type, id, text: 'View more', url: 'https://tmke.co.uk', color: '', align: 'center' };
    case 'columns':
      return { type, id, layout: '50-50', cells: [
        { title: 'Column one', text: 'Some copy here.' },
        { title: 'Column two', text: 'Some copy here.' },
      ] };
    case 'divider':
      return { type, id, color: '#E2E8F0' };
    case 'spacer':
      return { type, id, height: 24 };
    case 'logo':
      return { type, id, size: 'md', align: 'center', linkUrl: 'https://tmke.co.uk' };
    case 'social':
      return { type, id, align: 'center', show: { linkedin: true, instagram: true, facebook: true, website: true, twitter: true, youtube: true } };
    case 'video':
      return { type, id, url: '', thumbnail: '', align: 'center' };
    case 'footer':
      return { type, id, address: '', showSocial: true, unsubscribe: true, note: 'You\'re receiving this because you\'re part of the TMKE community.' };
    case 'faq':
      return { type, id, title: 'Frequently asked', items: [{ q: 'A question people often ask?', a: 'A clear, friendly answer.' }] };
    case 'countdown':
      return { type, id, label: 'Offer ends', deadline: '', align: 'center' };
    case 'reviewlink':
      return { type, id, text: 'Leave us a review', url: '', align: 'center', prompt: 'Enjoyed working with us?' };
    case 'products':
      return { type, id, columns: 2, items: [
        { title: 'A pack', price: '£49', image: '', url: 'https://tmke.co.uk/account', cta: 'View pack' },
      ] };
    case 'services':
      return { type, id, columns: 3, items: [
        { title: 'The Studio', text: 'On-brand templates, yours in minutes.', btnText: 'Explore', btnUrl: 'https://tmke.co.uk/editor' },
        { title: 'Videography', text: 'Property & agent video, done for you.', btnText: 'See more', btnUrl: 'https://tmke.co.uk/videography' },
        { title: 'Managed socials', text: 'We run the channel end to end.', btnText: 'Learn more', btnUrl: 'https://tmke.co.uk/account/services' },
      ] };
    case 'slider':
      return { type, id, columns: 3, images: [] };
    case 'form':
      return { type, id, heading: 'Tell us what you need', intro: 'A couple of quick questions and we\'ll be in touch.', fields: ['Name', 'Email', 'What are you after?'], btnText: 'Open the form', url: 'https://tmke.co.uk/contact' };
    case 'code':
      return { type, id, html: '<!-- Paste your own email-safe HTML here -->' };
    default:
      return { type: 'text', id, text: '', bg: '' };
  }
}

/* ───────────────────────── HTML helpers ───────────────────────── */

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Turn the plain text a marketer types into simple paragraph HTML. A blank line
// starts a new paragraph; a single newline is a line break. Inline HTML the user
// writes (e.g. <strong>, <a>) is passed through — this is an admin-only tool used
// by trusted staff, so we don't escape their copy (matches the source CRM).
function plainToHtml(text) {
  const paras = String(text || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (!paras.length) return '';
  return paras.map((p) => `<p style="margin:0 0 12px;">${p.replace(/\n/g, '<br />')}</p>`).join('');
}

/* ───────────────────────── per-block renderers ───────────────────────── */

function renderHeading(block, ctx) {
  const text = renderTokens(block.text || '', ctx);
  if (!text) return '';
  const cls = hasMobileOverrides(block) ? ` class="eb-b-${escapeHtml(block.id)}"` : '';
  return `<h1${cls} style="${headingInlineStyle(block)}">${escapeHtml(text)}</h1>`;
}

function renderText(block, ctx) {
  // block.html holds rich content (bold/italic/underline/bullets from the inline
  // toolbar); plain text falls back to auto-paragraphing.
  const src = block.html != null && block.html !== '' ? block.html : plainToHtml(block.text || '');
  const inner = renderTokens(src, ctx);
  if (!inner) return '';
  const cls = hasMobileOverrides(block) ? ` class="eb-b-${escapeHtml(block.id)}"` : '';
  return `<div${cls} style="${textInlineStyle(block)}">${inner}</div>`;
}

function renderImage(block) {
  const url = block.url;
  if (!url) return '';
  const alt = escapeHtml(block.alt || '');
  const align = ['left', 'center', 'right'].includes(block.align) ? block.align : 'center';
  const img = `<img src="${escapeHtml(url)}" alt="${alt}" style="max-width:100%;border-radius:8px;display:inline-block;border:0;outline:none;text-decoration:none;" />`;
  const wrapped = block.linkUrl
    ? `<a href="${escapeHtml(block.linkUrl)}" style="text-decoration:none;">${img}</a>`
    : img;
  return `<div style="text-align:${align};">${wrapped}</div>`;
}

function renderButton(block, brand, ctx) {
  const text = renderTokens(block.text || 'Click here', ctx);
  const url = renderTokens(block.url || '#', ctx);
  const color = block.color || brand.accentColor || ACCENT_DEFAULT;
  const align = ['left', 'center', 'right'].includes(block.align) ? block.align : 'center';
  return `
    <div style="text-align:${align};margin:8px 0;">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:11px 24px;background:${escapeHtml(color)};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;font-family:Helvetica,Arial,sans-serif;">${escapeHtml(text)}</a>
    </div>`;
}

function renderDivider(block) {
  const color = block.color || '#E2E8F0';
  return `<hr style="border:none;border-top:1px solid ${escapeHtml(color)};margin:8px 0;" />`;
}

function renderSpacer(block) {
  const h = Math.max(4, Math.min(160, Number(block.height) || 24));
  return `<div style="height:${h}px;line-height:${h}px;">&nbsp;</div>`;
}

const LOGO_SIZE = { sm: 28, md: 42, lg: 64 };
function renderLogo(block, brand) {
  const url = brand.logo;
  if (!url) return '';
  const size = LOGO_SIZE[block.size] || LOGO_SIZE.md;
  const align = ['left', 'center', 'right'].includes(block.align) ? block.align : 'center';
  const img = `<img src="${escapeHtml(url)}" alt="${escapeHtml(brand.companyName || 'Logo')}" style="height:${size}px;width:auto;display:inline-block;border:0;outline:none;" />`;
  const wrapped = block.linkUrl
    ? `<a href="${escapeHtml(block.linkUrl)}" style="text-decoration:none;">${img}</a>`
    : img;
  return `<div style="text-align:${align};">${wrapped}</div>`;
}

// Inline SVG icons so the social block works even in clients that strip remote
// images. currentColor is set on the link, so the glyphs inherit white.
const SOCIAL_ICON_SVG = {
  linkedin: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>',
  twitter: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>',
  instagram: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>',
  facebook: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
  youtube: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>',
  website: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
};
const SOCIAL_ORDER = ['linkedin', 'instagram', 'facebook', 'twitter', 'youtube', 'website'];

function renderSocial(block, brand) {
  const show = block.show || {};
  const align = ['left', 'center', 'right'].includes(block.align) ? block.align : 'center';
  const items = SOCIAL_ORDER
    .filter((k) => show[k] !== false && brand[k])
    .map((k) => {
      const url = brand[k];
      return `<a href="${escapeHtml(url)}" style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:16px;background:${escapeHtml(brand.accentColor || ACCENT_DEFAULT)};color:#fff;text-decoration:none;margin:0 6px;">${SOCIAL_ICON_SVG[k]}</a>`;
    })
    .join('');
  if (!items) return '';
  return `<div style="text-align:${align};margin:8px 0;">${items}</div>`;
}

function renderVideo(block) {
  const thumb = block.thumbnail;
  const url = block.url || '#';
  if (!thumb) return '';
  const align = ['left', 'center', 'right'].includes(block.align) ? block.align : 'center';
  // Email-safe video pattern: a clickable thumbnail with a play overlay.
  return `
    <div style="text-align:${align};margin:8px 0;">
      <a href="${escapeHtml(url)}" style="position:relative;display:inline-block;text-decoration:none;border-radius:12px;overflow:hidden;max-width:100%;">
        <img src="${escapeHtml(thumb)}" alt="Watch video" style="display:block;max-width:100%;border-radius:12px;border:0;outline:none;" />
        <span style="position:absolute;top:50%;left:50%;margin-left:-32px;margin-top:-32px;width:64px;height:64px;border-radius:32px;background:rgba(220,38,38,0.95);display:inline-block;text-align:center;line-height:64px;color:#fff;font-size:24px;">&#9658;</span>
      </a>
    </div>`;
}

function renderFooter(block, brand) {
  const accent = brand.accentColor || ACCENT_DEFAULT;
  const year = new Date().getFullYear();
  const social = block.showSocial !== false ? renderSocial({ show: {} }, brand) : '';
  const note = block.note ? `<p style="margin:0 0 8px;">${escapeHtml(block.note)}</p>` : '';
  const address = block.address ? `<p style="margin:0 0 8px;">${escapeHtml(block.address)}</p>` : '';
  const web = brand.website ? `<a href="${escapeHtml(brand.website)}" style="color:${escapeHtml(accent)};text-decoration:none;">${escapeHtml(String(brand.website).replace(/^https?:\/\//, ''))}</a>` : '';
  const unsub = block.unsubscribe !== false
    ? `<p style="margin:8px 0 0;">{{unsubscribe}}<a href="{{unsubscribe_url}}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a></p>`
    : '';
  return `
    <div style="border-top:1px solid #E2E8F0;margin-top:8px;padding-top:18px;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#94a3b8;">
      ${social}
      ${note}
      ${address}
      <p style="margin:0 0 4px;">&copy; ${year} ${escapeHtml(brand.companyName || 'TMKE')}${web ? ' · ' + web : ''}</p>
      ${unsub}
    </div>`;
}

function renderFaq(block, ctx) {
  const items = Array.isArray(block.items) ? block.items : [];
  const rows = items.filter((it) => it && (it.q || it.a)).map((it) => `
    <div style="margin:0 0 14px;">
      <p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#1c1d22;">${renderTokens(escapeHtml(it.q || ''), ctx)}</p>
      <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#475569;">${renderTokens(escapeHtml(it.a || ''), ctx)}</p>
    </div>`).join('');
  if (!rows) return '';
  const title = block.title ? `<h2 style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:20px;font-weight:800;color:#1c1d22;">${escapeHtml(block.title)}</h2>` : '';
  return `<div>${title}${rows}</div>`;
}

function renderCountdown(block) {
  const dl = block.deadline ? new Date(block.deadline) : null;
  if (!dl || isNaN(dl.getTime())) return '';
  const days = Math.max(0, Math.ceil((dl.getTime() - Date.now()) / 86400000));
  const dateStr = dl.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const align = ['left', 'center', 'right'].includes(block.align) ? block.align : 'center';
  return `
    <div style="text-align:${align};margin:8px 0;">
      <div style="display:inline-block;padding:14px 26px;border:1px solid #E2E8F0;border-radius:12px;background:#faf9f8;font-family:Helvetica,Arial,sans-serif;">
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#94a3b8;">${escapeHtml(block.label || 'Offer ends')}</div>
        <div style="font-size:28px;font-weight:800;color:#1c1d22;margin:4px 0 2px;">${days} day${days === 1 ? '' : 's'} left</div>
        <div style="font-size:13px;color:#475569;">${escapeHtml(dateStr)}</div>
      </div>
    </div>`;
}

function renderReviewLink(block, brand, ctx) {
  const accent = brand.accentColor || ACCENT_DEFAULT;
  const url = renderTokens(block.url || brand.reviewUrl || (brand.website ? brand.website.replace(/\/+$/, '') + '/review' : '#'), ctx);
  const align = ['left', 'center', 'right'].includes(block.align) ? block.align : 'center';
  const stars = '<div style="font-size:22px;letter-spacing:2px;color:#f5b301;margin:0 0 6px;">&#9733;&#9733;&#9733;&#9733;&#9733;</div>';
  const prompt = block.prompt ? `<p style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#1c1d22;">${escapeHtml(block.prompt)}</p>` : '';
  return `
    <div style="text-align:${align};margin:8px 0;">
      ${stars}${prompt}
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:11px 24px;background:${escapeHtml(accent)};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;font-family:Helvetica,Arial,sans-serif;">${escapeHtml(renderTokens(block.text || 'Leave a review', ctx))}</a>
    </div>`;
}

function renderCode(block, ctx) {
  return renderTokens(String(block.html || ''), ctx);
}

// One column cell — a small stacked unit (image → title → text → button), which
// covers feature grids, product/service rows, etc. without a nested editor.
function renderCell(c, brand, ctx) {
  if (!c) return '';
  let h = '';
  if (c.image) h += `<img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.alt || '')}" style="max-width:100%;border-radius:8px;display:block;border:0;outline:none;margin:0 0 8px;" />`;
  if (c.title) h += `<p style="margin:0 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#1c1d22;">${renderTokens(escapeHtml(c.title), ctx)}</p>`;
  if (c.text) h += `<p style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#475569;">${renderTokens(escapeHtml(c.text), ctx).replace(/\n/g, '<br />')}</p>`;
  if (c.btnText) h += `<a href="${escapeHtml(renderTokens(c.btnUrl || '#', ctx))}" style="display:inline-block;padding:8px 16px;background:${escapeHtml(brand.accentColor || ACCENT_DEFAULT)};color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;font-family:Helvetica,Arial,sans-serif;">${escapeHtml(renderTokens(c.btnText, ctx))}</a>`;
  return h || '<div style="min-height:36px;"></div>';
}

// Email-safe responsive-ish grid: rows of `cols`, each cell rendered by cellFn.
function cardGrid(items, cols, cellFn) {
  const n = Math.min(Math.max(Number(cols) || 2, 1), 4);
  const w = (100 / n).toFixed(3);
  let rows = '';
  for (let i = 0; i < items.length; i += n) {
    const slice = items.slice(i, i + n);
    const tds = slice.map((it, j) => {
      const pad = n === 1 ? '0 0 16px' : `0 ${j < slice.length - 1 ? 8 : 0}px 16px ${j > 0 ? 8 : 0}px`;
      return `<td valign="top" width="${w}%" style="width:${w}%;padding:${pad};vertical-align:top;font-family:Helvetica,Arial,sans-serif;">${cellFn(it)}</td>`;
    }).join('');
    const padCells = Array.from({ length: n - slice.length }, () => `<td width="${w}%" style="width:${w}%;"></td>`).join('');
    rows += `<tr>${tds}${padCells}</tr>`;
  }
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>`;
}

function renderProducts(block, brand, ctx) {
  const items = (Array.isArray(block.items) ? block.items : []).filter((it) => it && (it.title || it.image));
  if (!items.length) return '';
  const accent = brand.accentColor || ACCENT_DEFAULT;
  return cardGrid(items, block.columns || 2, (it) => {
    let h = '';
    if (it.image) h += `<img src="${escapeHtml(it.image)}" alt="${escapeHtml(it.title || '')}" style="max-width:100%;border-radius:8px;display:block;border:0;margin:0 0 8px;" />`;
    if (it.title) h += `<p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#1c1d22;">${renderTokens(escapeHtml(it.title), ctx)}</p>`;
    if (it.price) h += `<p style="margin:0 0 8px;font-size:14px;color:${escapeHtml(accent)};font-weight:600;">${escapeHtml(it.price)}</p>`;
    h += `<a href="${escapeHtml(it.url || '#')}" style="display:inline-block;padding:7px 14px;background:${escapeHtml(accent)};color:#fff;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600;">${escapeHtml(it.cta || 'View')}</a>`;
    return h;
  });
}

function renderServices(block, brand, ctx) {
  const items = (Array.isArray(block.items) ? block.items : []).filter((it) => it && (it.title || it.text));
  if (!items.length) return '';
  return cardGrid(items, block.columns || 3, (it) => renderCell({ title: it.title, text: it.text, btnText: it.btnText, btnUrl: it.btnUrl }, brand, ctx));
}

function renderSlider(block) {
  const images = (Array.isArray(block.images) ? block.images : []).filter(Boolean);
  if (!images.length) return '';
  return cardGrid(images.map((url) => ({ url })), block.columns || 3, (it) =>
    `<img src="${escapeHtml(it.url)}" alt="" style="max-width:100%;border-radius:8px;display:block;border:0;" />`);
}

function renderForm(block, brand, ctx) {
  const accent = brand.accentColor || ACCENT_DEFAULT;
  const fields = (Array.isArray(block.fields) ? block.fields : []).filter(Boolean);
  // Email clients strip real <form> posts, so this is a styled prompt that links
  // out to a hosted form. The fields preview what the form will ask.
  const fieldRows = fields.map((f) => `<div style="border:1px solid #E2E8F0;border-radius:6px;padding:9px 12px;margin:0 0 8px;color:#94a3b8;font-size:13px;">${escapeHtml(f)}</div>`).join('');
  return `
    <div style="border:1px solid #E2E8F0;border-radius:12px;padding:20px;font-family:Helvetica,Arial,sans-serif;">
      ${block.heading ? `<p style="margin:0 0 4px;font-size:18px;font-weight:800;color:#1c1d22;">${renderTokens(escapeHtml(block.heading), ctx)}</p>` : ''}
      ${block.intro ? `<p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#475569;">${renderTokens(escapeHtml(block.intro), ctx)}</p>` : ''}
      ${fieldRows}
      <a href="${escapeHtml(block.url || '#')}" style="display:inline-block;margin-top:6px;padding:11px 24px;background:${escapeHtml(accent)};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(block.btnText || 'Open the form')}</a>
    </div>`;
}

function renderColumns(block, brand, ctx) {
  const layout = (COLUMN_LAYOUTS.find((l) => l.key === block.layout)) || COLUMN_LAYOUTS[1];
  const widths = layout.w;
  const cells = Array.isArray(block.cells) ? block.cells : [];
  const tds = widths.map((w, i) => {
    const pad = widths.length === 1 ? '0' : i === 0 ? '0 8px 0 0' : i === widths.length - 1 ? '0 0 0 8px' : '0 8px';
    return `<td valign="top" width="${w}%" style="width:${w}%;padding:${pad};vertical-align:top;font-family:Helvetica,Arial,sans-serif;">${renderCell(cells[i], brand, ctx)}</td>`;
  }).join('');
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${tds}</tr></table>`;
}

export function renderBlock(block, brand, ctx) {
  switch (block.type) {
    case 'heading': return renderHeading(block, ctx);
    case 'text': return renderText(block, ctx);
    case 'image': return renderImage(block);
    case 'button': return renderButton(block, brand, ctx);
    case 'divider': return renderDivider(block);
    case 'spacer': return renderSpacer(block);
    case 'logo': return renderLogo(block, brand);
    case 'social': return renderSocial(block, brand);
    case 'video': return renderVideo(block);
    case 'columns': return renderColumns(block, brand, ctx);
    case 'footer': return renderFooter(block, brand);
    case 'faq': return renderFaq(block, ctx);
    case 'countdown': return renderCountdown(block);
    case 'reviewlink': return renderReviewLink(block, brand, ctx);
    case 'products': return renderProducts(block, brand, ctx);
    case 'services': return renderServices(block, brand, ctx);
    case 'slider': return renderSlider(block);
    case 'form': return renderForm(block, brand, ctx);
    case 'code': return renderCode(block, ctx);
    default: return '';
  }
}

/* ───────────────────────── document shell ───────────────────────── */

function brandHeader(brand) {
  const accent = brand.accentColor || ACCENT_DEFAULT;
  const headerLogo = brand.logo
    ? `<img src="${escapeHtml(brand.logo)}" alt="${escapeHtml(brand.companyName || '')}" style="max-height:42px;width:auto;display:block;border:0;outline:none;" />`
    : brand.companyName
      // Editorial serif wordmark — the closest email-safe nod to The Seasons
      // (custom webfonts get stripped by most email clients, so we use a Didone
      // serif stack rather than ship a font that won't load).
      ? `<span style="font-family:'Didot','Bodoni MT',Georgia,'Times New Roman',serif;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:${escapeHtml(accent)};font-size:22px;">${escapeHtml(brand.companyName)}</span>`
      : '';
  return headerLogo ? `<div style="padding:24px 24px 0;">${headerLogo}</div>` : '';
}

function brandFooter(brand) {
  const sigName = brand.signatureName;
  return sigName
    ? `<div style="padding:8px 24px 24px;font-family:Helvetica,Arial,sans-serif;color:#475569;font-size:14px;">— ${escapeHtml(sigName)}</div>`
    : '';
}

// Per-block device visibility. Wraps a block's HTML so it can be hidden on
// mobile, on desktop, or (edge case) skipped entirely.
//   • hide on mobile  → `.eb-hide-mobile`, visible by default; the head media
//     query hides it under 600px. Outlook desktop ignores media queries, so it
//     stays visible there — correct for a desktop-only block.
//   • hide on desktop → `.eb-mobile-only`, hidden by default via inline
//     display:none + `mso-hide:all` (which the Outlook/Word engine DOES obey);
//     the media query reveals it on mobile. So Outlook desktop keeps it hidden.
function wrapVisibility(html, block) {
  const hide = block && block.hide ? block.hide : {};
  const hideMobile = hide.mobile === true;
  const hideDesktop = hide.desktop === true;
  if (hideMobile && hideDesktop) return '';   // hidden everywhere → skip
  if (!hideMobile && !hideDesktop) return html;
  if (hideDesktop) {
    return `<div class="eb-mobile-only" style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${html}</div>`;
  }
  return `<div class="eb-hide-mobile">${html}</div>`;
}

function shell(brand, bodyHtml, preheader, responsiveCss) {
  const pageBg = brand.bgColor || '#f4f2f1';
  const cardBg = brand.cardColor || '#ffffff';
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>`
    : '';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  @media only screen and (max-width:600px) {
    .eb-hide-mobile { display:none !important; max-height:0 !important; overflow:hidden !important; mso-hide:all; }
    .eb-mobile-only { display:block !important; max-height:none !important; overflow:visible !important; }
    ${responsiveCss || ''}
  }
</style></head>
<body style="margin:0;padding:0;background:${escapeHtml(pageBg)};">
  ${pre}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${escapeHtml(pageBg)};">
    <tr><td align="center" style="padding:24px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;background:${escapeHtml(cardBg)};border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
        <tr><td>
          ${brandHeader(brand)}
          <div style="padding:24px;">
            ${bodyHtml}
          </div>
          ${brandFooter(brand)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/* ───────────────────────── public entry point ───────────────────────── */

/**
 * Render a whole template for one recipient.
 *
 * @param {object} template - { subject, preheader, mode: 'blocks'|'html', blocks, customHtml }
 * @param {object} [opts]
 * @param {object} [opts.brand]    - branding (falls back to defaultBrand()).
 * @param {object} [opts.mergeCtx] - merge context (see mergeContextFor); defaults to the sample recipient.
 * @returns {{ subject: string, html: string }}
 */
export function renderTemplate(template = {}, opts = {}) {
  const brand = { ...defaultBrand(), ...(opts.brand || template.branding || {}) };
  const ctx = opts.mergeCtx || mergeContextFor(SAMPLE_RECIPIENT, brand);
  const subject = renderTokens(template.subject || '', ctx);

  // HTML mode — staff wrote raw HTML. A full document (<!doctype/<html) is sent
  // verbatim after token merge; a fragment gets wrapped in the branded shell so
  // they don't have to repeat boilerplate.
  if (template.mode === 'html') {
    const merged = renderTokens(String(template.customHtml || ''), ctx);
    const isFullDoc = /^\s*(<!doctype|<html)/i.test(merged);
    return { subject, html: isFullDoc ? merged : shell(brand, merged, template.preheader) };
  }

  const blocks = Array.isArray(template.blocks) ? template.blocks : [];
  // Assemble the body. The 16px gap between blocks rides INSIDE the following
  // block's wrapper, so when a block is hidden on a device its spacer hides with
  // it (no orphaned gaps).
  const spacer = '<div style="height:16px;line-height:16px;">&nbsp;</div>';
  const parts = [];
  const responsive = [];
  blocks.forEach((b) => {
    const inner = renderBlock(b, brand, ctx);
    if (!inner) return;
    // Collect the mobile media-query rule for any block with device overrides.
    const decls = responsiveDecls(b);
    if (decls.length) responsive.push(`.eb-b-${b.id}{${decls.join(';')};}`);
    const withSpacer = parts.length ? spacer + '\n' + inner : inner;
    const wrapped = wrapVisibility(withSpacer, b);
    if (wrapped) parts.push(wrapped);
  });
  const bodyHtml = parts.join('\n');

  return { subject, html: shell(brand, bodyHtml, template.preheader, responsive.join('\n    ')) };
}
