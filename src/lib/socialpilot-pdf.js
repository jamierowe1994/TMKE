// Reads what the AI can't from a SocialPilot PDF: each post's Instagram link
// and its thumbnail. Both are really in the file — the link as a clickable
// annotation beside the title in the Post / Reels Performance tables, the
// thumbnail as an embedded image at the start of the same row — so they're
// lifted out exactly rather than described by a model.
//
// Runs in the admin browser. pdf.js is loaded on demand from jsDelivr, the
// only time any admin page needs it.

const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build";
let pdfjsP = null;
function loadPdfjs() {
  if (!pdfjsP) {
    pdfjsP = import(/* @vite-ignore */ `${PDFJS}/pdf.min.mjs`).then((m) => {
      m.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.mjs`;
      return m;
    });
  }
  return pdfjsP;
}

// [a b c d e f] — apply m, then ctm.
const mul = (m, t) => [
  m[0] * t[0] + m[1] * t[2], m[0] * t[1] + m[1] * t[3],
  m[2] * t[0] + m[3] * t[2], m[2] * t[1] + m[3] * t[3],
  m[4] * t[0] + m[5] * t[2] + t[4], m[4] * t[1] + m[5] * t[3] + t[5],
];

// Where every image on the page was drawn, in PDF space.
async function imageBoxes(page, OPS) {
  const ops = await page.getOperatorList();
  const boxes = [], stack = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = mul(args, ctm);
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageXObjectRepeat) {
      const xs = [ctm[4], ctm[0] + ctm[4], ctm[2] + ctm[4], ctm[0] + ctm[2] + ctm[4]];
      const ys = [ctm[5], ctm[1] + ctm[5], ctm[3] + ctm[5], ctm[1] + ctm[3] + ctm[5]];
      boxes.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
    }
  }
  return boxes;
}

/**
 * @param {File|Blob|ArrayBuffer} file  the SocialPilot PDF
 * @returns {Promise<Array<{ url, type, title, date, page, thumb: Blob|null }>>}
 *   one entry per post/reel link, in the order the report prints them.
 */
export async function extractPostLinks(file) {
  const pdfjs = await loadPdfjs();
  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const out = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const seen = new Set();
    const links = (await page.getAnnotations())
      .filter((a) => a.subtype === "Link" && a.url && /instagram\.com\/(p|reel|tv)\//i.test(a.url))
      .filter((a) => (seen.has(a.url) ? false : (seen.add(a.url), true)))
      // Top of the page first — PDF y runs upwards.
      .sort((a, b) => b.rect[3] - a.rect[3]);
    if (!links.length) continue;

    const text = (await page.getTextContent()).items.filter((t) => t.str && t.str.trim());
    const imgs = await imageBoxes(page, pdfjs.OPS);
    // The thumbnails are drawn about 26pt square; at 6x they come out ~160px,
    // enough for a sharp 80px tile on a retina screen.
    const viewport = page.getViewport({ scale: 6 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;

    for (const l of links) {
      const [lx0, ly0, lx1, ly1] = l.rect, cy = (ly0 + ly1) / 2, h = ly1 - ly0;
      // The title is the text on the link's line, to its left.
      // The date sits on the line under it and gets caught too — take it out
      // and keep it.
      let title = text
        .filter((t) => Math.abs(t.transform[5] + (t.height || h) / 2 - cy) < h && t.transform[4] < lx0)
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((t) => t.str).join(" ").replace(/\s+/g, " ").trim();
      let date = null;
      const dm = /([A-Z][a-z]{2}) (\d{1,2}), (\d{4})(?: (\d{2}:\d{2}))?/.exec(title);
      if (dm) {
        const mi = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(dm[1]);
        if (mi >= 0) date = `${dm[3]}-${String(mi + 1).padStart(2, "0")}-${dm[2].padStart(2, "0")}`;
        title = title.replace(dm[0], "").replace(/\s+/g, " ").trim();
      }
      // The thumbnail is the image left of the link whose rows it shares.
      const img = imgs
        .filter((b) => b[2] <= lx0 + 1 && b[1] - h <= cy && cy <= b[3] + h && (b[2] - b[0]) > 10)
        .sort((a, b) => Math.abs((a[1] + a[3]) / 2 - cy) - Math.abs((b[1] + b[3]) / 2 - cy))[0];
      let thumb = null;
      if (img) {
        const r = viewport.convertToViewportRectangle(img);
        const x = Math.min(r[0], r[2]), y = Math.min(r[1], r[3]);
        const w = Math.abs(r[2] - r[0]), hh = Math.abs(r[3] - r[1]);
        const c = document.createElement("canvas");
        c.width = Math.round(w); c.height = Math.round(hh);
        c.getContext("2d").drawImage(canvas, x, y, w, hh, 0, 0, c.width, c.height);
        thumb = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.86));
      }
      out.push({ url: l.url, type: /\/(reel|tv)\//i.test(l.url) ? "Reel" : "Post", title, date, page: n, thumb });
    }
  }
  return out;
}

// Pair the links with the rows the AI read, by title first (the PDF truncates
// titles with "…", so compare the start), then by order within Posts / Reels.
const norm = (s) => String(s || "").toLowerCase().replace(/[…\.]+$/, "").replace(/[^a-z0-9]+/g, " ").trim();
export function matchLinks(content, links) {
  const left = links.slice();
  const take = (i) => left.splice(i, 1)[0];
  const rows = (content || []).map((row) => ({ row, link: null }));
  for (const r of rows) {
    const t = norm(r.row.title);
    if (!t) continue;
    const i = left.findIndex((l) => {
      const lt = norm(l.title);
      if (!lt) return false;
      const k = Math.min(t.length, lt.length, 18);
      return k >= 6 && t.slice(0, k) === lt.slice(0, k);
    });
    if (i >= 0) r.link = take(i);
  }
  for (const r of rows.filter((x) => !x.link && x.row.date)) {
    const i = left.findIndex((l) => l.date === r.row.date && l.type === (r.row.type || "Post"));
    if (i >= 0) r.link = take(i);
  }
  for (const type of ["Post", "Reel"]) {
    for (const r of rows.filter((x) => !x.link && (x.row.type || "Post") === type)) {
      const i = left.findIndex((l) => l.type === type);
      if (i >= 0) r.link = take(i);
    }
  }
  return rows;
}
