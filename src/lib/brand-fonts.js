/* Uploaded brand fonts (/admin/fonts, the brand_fonts table), loaded the same
   way on every page that draws a design (Dani, 19 Oct: "uploaded fonts are
   being treated differently to Google Fonts ... we need to make sure uploaded
   fonts are always picked up").

   What went wrong before: the Studio fetched them only after the design had
   loaded, and the promise a render waits on didn't exist until then. A
   preview drawn in that gap waited for nothing and drew the title in another
   face; the editor's own font list never took them in; and the admin preview
   grids never loaded them at all.

   So: every face is registered once per page, the moment the page starts,
   and `window.__TMKE_BRAND_FONTS_READY__` resolves when they have all loaded
   (or failed, or 10 seconds have passed: a font is an improvement to a
   render, never a reason to hang one). A page can create that promise before
   anything else runs (the Studio does, in its head) so a script that looks
   for it early finds it; this resolves it.

   `window.__TMKE_BRAND_FONTS__` holds the rows, for the Studio's font list. */

/* The Seasons is NOT registered from the fonts table. The files there are the
   free DEMO build ("FSP DEMO - The Seasons"): 28 characters in each -- ! " #
   $ % & ' ( ) * + - / 4 < = > @ [ \ ] ^ _ ` { | } ~ -- are one ornament
   stamped DEMO, which is how "340" came out with DEMO in the middle. The
   licensed font comes whole from Typographer on every page (BaseLayout).
   Measured 12 Oct across the 112 live templates: the licensed letters are the
   same or slightly narrower, so nothing grows. */
const isDemoSeasons = (f) => /^the seasons$/i.test(String((f && f.family) || '').trim());

/* Fonts whose own line metrics sit the letters off-centre in a box, and the
   correction, applied wherever an uploaded font is registered (here and
   /admin/fonts) so the Studio, previews and downloads all agree.

   Chunk Five, Regular and Print (The Mortgage Experts, tested 12 Nov): its
   ascent is 750 and descent 250 on a 1000 em, but capitals are only 699 tall,
   so words centred in a box or strip sat about a tenth of their height high
   (29px above vs 40px below a 56px SOLD). 82 / 18 brings capitals within
   0.03em of centre and leaves room for g, p and y below. Nothing else
   changes: the letters themselves, their width and spacing are untouched. */
const FONT_METRICS = {
  chunkfive: { ascentOverride: '82%', descentOverride: '18%', lineGapOverride: '0%' },
  chunkfiveprint: { ascentOverride: '82%', descentOverride: '18%', lineGapOverride: '0%' },
};
export function fontFaceDescriptors(family, base) {
  const key = String(family || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return Object.assign({}, base || {}, FONT_METRICS[key] || {});
}

function readyPromise() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!window.__TMKE_BRAND_FONTS_READY__) {
    let resolve;
    window.__TMKE_BRAND_FONTS_READY__ = new Promise((r) => { resolve = r; });
    window.__TMKE_BRAND_FONTS_RESOLVE__ = resolve;
  }
  return window.__TMKE_BRAND_FONTS_READY__;
}

/* Start loading (once per page); returns the promise that says they're in. */
export function loadBrandFonts(supabase, { timeout = 10000 } = {}) {
  const ready = readyPromise();
  if (typeof window === 'undefined' || window.__TMKE_BRAND_FONTS_STARTED__) return ready;
  window.__TMKE_BRAND_FONTS_STARTED__ = true;
  const done = () => { const r = window.__TMKE_BRAND_FONTS_RESOLVE__; if (typeof r === 'function') r(); };
  setTimeout(done, timeout);
  (async () => {
    try {
      if (!supabase || typeof window.FontFace !== 'function') return;
      const { data, error } = await supabase
        .from('brand_fonts')
        .select('id, family, display_name, file_url, weight, style')
        .order('family', { ascending: true });
      if (error || !data || !data.length) return;
      const seen = new Set();
      const loads = [];
      for (const f of data) {
        if (!f || !f.family || !f.file_url) continue;
        const key = `${f.family}|${f.weight || 400}|${f.style || 'normal'}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (isDemoSeasons(f)) continue;
        try {
          const face = new FontFace(f.family, `url("${f.file_url}")`, fontFaceDescriptors(f.family, {
            weight: String(f.weight || 400), style: f.style || 'normal', display: 'swap',
          }));
          loads.push(face.load().then((l) => { document.fonts.add(l); }).catch(() => {}));
        } catch (_) { /* one bad file doesn't stop the rest */ }
      }
      window.__TMKE_BRAND_FONTS__ = data;
      await Promise.all(loads);
    } catch (_) { /* fonts are optional: the page works without them */ }
    finally { done(); }
  })();
  return ready;
}
