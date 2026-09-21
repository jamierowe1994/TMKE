/* Wiring for BrandKitForm.astro — used by Brands and by Studio branding.
 *
 * One form, one set of behaviour: read a brand_profiles row into the fields,
 * read the fields back out, upload a logo. Kept out of the pages so the two
 * can't drift into two slightly different forms.
 */

const LOGO_BUCKET = 'pack-images';   // public already, and already holds artwork

export function fillForm(root, row) {
  const r = row || {};
  const set = (f, v) => {
    const el = root.querySelector(`[data-f="${f}"]`);
    if (el) el.value = v || '';
  };
  set('company', r.company || r.brand || '');
  set('website', r.website || '');
  set('slogan', r.slogan || '');
  set('tone', r.tone || '');
  const fonts = r.fonts || {};
  set('font_heading', fonts.heading || '');
  set('font_body', fonts.body || '');
  drawColors(root, Array.isArray(r.colors) ? r.colors : []);
  drawLogos(root, Array.isArray(r.logos) ? r.logos : []);
}

export function readForm(root, brand) {
  const get = (f) => (root.querySelector(`[data-f="${f}"]`)?.value || '').trim();
  return {
    brand,
    company: get('company') || null,
    website: get('website').replace(/^https?:\/\//i, '').replace(/\/$/, '') || null,
    slogan: get('slogan') || null,
    tone: get('tone') || null,
    fonts: { heading: get('font_heading') || null, body: get('font_body') || null },
    colors: currentColors(root).filter(Boolean),
    logos: currentLogos(root),
    updated_at: new Date().toISOString(),
  };
}

/* ---- colours ---- */

function drawColors(root, colors) {
  const box = root.querySelector('[data-colors]');
  if (!box) return;
  const six = colors.concat(Array(6).fill('')).slice(0, 6);
  box.innerHTML = six.map((hex, i) => `
    <div class="bkf-swatch">
      <input type="color" data-color="${i}" value="${hex || '#ffffff'}" aria-label="Colour ${i + 1}" />
      <input type="text" data-hex="${i}" value="${hex || ''}" placeholder="—" maxlength="7" aria-label="Colour ${i + 1} hex" />
      <button type="button" data-color-clear="${i}"${hex ? '' : ' style="visibility:hidden"'}>clear</button>
    </div>`).join('');
}

function currentColors(root) {
  return [...root.querySelectorAll('[data-hex]')].map((el) => el.value.trim());
}

/* The colour well and its hex box are two views of one value: type in either
   and the other follows, so nobody has to know which one is "real". */
export function wireColors(root) {
  root.addEventListener('input', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    const i = el.getAttribute('data-color') ?? el.getAttribute('data-hex');
    if (i == null) return;
    const v = el.value.trim();
    if (el.hasAttribute('data-hex') && v && !/^#[0-9a-f]{3,8}$/i.test(v)) return;
    const pair = el.hasAttribute('data-hex')
      ? root.querySelector(`[data-color="${i}"]`)
      : root.querySelector(`[data-hex="${i}"]`);
    if (pair && v) pair.value = v;
    const clear = root.querySelector(`[data-color-clear="${i}"]`);
    if (clear) clear.style.visibility = v ? '' : 'hidden';
  });
  root.addEventListener('click', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    const i = el.getAttribute('data-color-clear');
    if (i == null) return;
    const hex = root.querySelector(`[data-hex="${i}"]`);
    const well = root.querySelector(`[data-color="${i}"]`);
    if (hex) hex.value = '';
    if (well) well.value = '#ffffff';
    el.style.visibility = 'hidden';
  });
}

/* ---- logos ---- */

function drawLogos(root, logos) {
  [0, 1].forEach((i) => {
    const slot = root.querySelector(`[data-logo="${i}"]`);
    if (!slot) return;
    const url = (logos[i] && logos[i].url) || '';
    const img = slot.querySelector('.bkf-logo-img');
    if (img) img.style.backgroundImage = url ? `url('${url}')` : '';
    slot.setAttribute('data-url', url);
    const clear = slot.querySelector(`[data-logo-clear="${i}"]`);
    if (clear) clear.hidden = !url;
  });
}

function currentLogos(root) {
  return [0, 1]
    .map((i) => root.querySelector(`[data-logo="${i}"]`)?.getAttribute('data-url') || '')
    .filter(Boolean)
    .map((url) => ({ url }));
}

export function wireLogos(root, supabase, onStatus) {
  root.addEventListener('change', async (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    const i = el.getAttribute('data-logo-file');
    if (i == null) return;
    const file = el.files && el.files[0];
    if (!file) return;
    onStatus?.('Uploading…');
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `brand-logos/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error } = await supabase.storage.from(LOGO_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
    if (error) { onStatus?.('Upload failed: ' + error.message); return; }
    const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
    const slot = root.querySelector(`[data-logo="${i}"]`);
    slot.setAttribute('data-url', data.publicUrl);
    slot.querySelector('.bkf-logo-img').style.backgroundImage = `url('${data.publicUrl}')`;
    const clear = slot.querySelector(`[data-logo-clear="${i}"]`);
    if (clear) clear.hidden = false;
    onStatus?.('Uploaded — press Save to keep it.');
  });

  root.addEventListener('click', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    const i = el.getAttribute('data-logo-clear');
    if (i == null) return;
    const slot = root.querySelector(`[data-logo="${i}"]`);
    slot.setAttribute('data-url', '');
    slot.querySelector('.bkf-logo-img').style.backgroundImage = '';
    el.hidden = true;
  });
}

/* Offer the fonts that actually exist: the uploaded ones first, since those
   are the ones a brand had to send us, then the Google catalogue. */
export async function fillFontList(root, supabase, googleFonts) {
  const list = root.querySelector('[data-fontlist]');
  if (!list) return;
  let custom = [];
  try {
    const { data } = await supabase.from('brand_fonts').select('family').order('family');
    custom = (data || []).map((r) => r.family).filter(Boolean);
  } catch (_) {}
  const all = custom.concat(googleFonts || []);
  list.innerHTML = all.map((f) => `<option value="${String(f).replace(/"/g, '&quot;')}"></option>`).join('');
}
