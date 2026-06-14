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
    firstName: firstName || '',
    lastName: rest.join(' ') || '',
    fullName,
    email: recipient.email || '',
    company: recipient.company || '',
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
  { token: 'company', label: 'Company' },
  { token: 'senderName', label: 'Sender name' },
  { token: 'senderCompany', label: 'Sender company' },
];

/** A dummy recipient so the live preview shows realistic merged values. */
export const SAMPLE_RECIPIENT = { name: 'Alex Morgan', email: 'alex@example.com', company: 'Acme Estates' };

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
    linkedin: '',
    instagram: '',
    facebook: '',
    twitter: '',
    youtube: '',
  };
}

/* ───────────────────────── block model ───────────────────────── */

/** Block palette shown in the builder. Order = order in the "Add block" row. */
export const BLOCK_TYPES = [
  { type: 'text', label: 'Text', hint: 'A paragraph of copy' },
  { type: 'image', label: 'Image', hint: 'A picture, optionally a link' },
  { type: 'button', label: 'Button', hint: 'A call-to-action' },
  { type: 'logo', label: 'Logo', hint: 'Your brand logo' },
  { type: 'divider', label: 'Divider', hint: 'A horizontal line' },
  { type: 'spacer', label: 'Spacer', hint: 'Vertical whitespace' },
  { type: 'social', label: 'Social', hint: 'Social icon links' },
  { type: 'video', label: 'Video', hint: 'A clickable video thumbnail' },
];

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
    case 'text':
      return { type, id, text: 'Hi {{firstName}},\n\nWrite your message here.', bg: '' };
    case 'image':
      return { type, id, url: '', alt: '', linkUrl: '', align: 'center' };
    case 'button':
      return { type, id, text: 'View more', url: 'https://tmke.co.uk', color: '', align: 'center' };
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

function renderText(block, ctx) {
  const src = block.html != null ? block.html : plainToHtml(block.text || '');
  const inner = renderTokens(src, ctx);
  if (!inner) return '';
  if (!block.bg) {
    return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1F2937;">${inner}</div>`;
  }
  return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1F2937;background:${escapeHtml(block.bg)};padding:14px 18px;border-radius:8px;">${inner}</div>`;
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

function renderBlock(block, brand, ctx) {
  switch (block.type) {
    case 'text': return renderText(block, ctx);
    case 'image': return renderImage(block);
    case 'button': return renderButton(block, brand, ctx);
    case 'divider': return renderDivider(block);
    case 'spacer': return renderSpacer(block);
    case 'logo': return renderLogo(block, brand);
    case 'social': return renderSocial(block, brand);
    case 'video': return renderVideo(block);
    default: return '';
  }
}

/* ───────────────────────── document shell ───────────────────────── */

function brandHeader(brand) {
  const accent = brand.accentColor || ACCENT_DEFAULT;
  const headerLogo = brand.logo
    ? `<img src="${escapeHtml(brand.logo)}" alt="${escapeHtml(brand.companyName || '')}" style="max-height:42px;width:auto;display:block;border:0;outline:none;" />`
    : brand.companyName
      ? `<span style="font-family:Helvetica,Arial,sans-serif;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${escapeHtml(accent)};font-size:18px;">${escapeHtml(brand.companyName)}</span>`
      : '';
  return headerLogo ? `<div style="padding:24px 24px 0;">${headerLogo}</div>` : '';
}

function brandFooter(brand) {
  const sigName = brand.signatureName;
  return sigName
    ? `<div style="padding:8px 24px 24px;font-family:Helvetica,Arial,sans-serif;color:#475569;font-size:14px;">— ${escapeHtml(sigName)}</div>`
    : '';
}

function shell(brand, bodyHtml, preheader) {
  const pageBg = brand.bgColor || '#f4f2f1';
  const cardBg = brand.cardColor || '#ffffff';
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>`
    : '';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
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
  const bodyHtml = blocks
    .map((b) => renderBlock(b, brand, ctx))
    .filter(Boolean)
    .join('\n<div style="height:16px;line-height:16px;">&nbsp;</div>\n');

  return { subject, html: shell(brand, bodyHtml, template.preheader) };
}
