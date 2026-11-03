// Video captions: drawing one frame (Dani, 3 Nov 2026). The preview and the
// export both come through here, so what the preview shows is what the file
// gets. Sizes are for a 1080x1920 frame, from the style's `look`.

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (p) => 1 - Math.pow(1 - clamp01(p), 3);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// The segmenter wants ever-rising timestamps across everything that uses it
// (the preview and then the export), so there is one counter for the page.
let SEG_TS = 1;

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

export class CaptionRenderer {
  constructor({ look, timeline, segmenter = null, W = 1080, H = 1920 }) {
    this.look = look; this.tl = timeline; this.seg = segmenter;
    this.W = W; this.H = H;
    this.out = canvas(W, H); this.o = this.out.getContext("2d");
    this.base = canvas(W, H); this.b = this.base.getContext("2d");
    this.person = canvas(W, H); this.p = this.person.getContext("2d");
    this.segIn = canvas(288, 512); this.si = this.segIn.getContext("2d", { willReadFrequently: true });
    this.maskC = canvas(1, 1); this.m = this.maskC.getContext("2d");
    this.maskErrors = 0;             // frames where the cut-out failed: reported, never hidden
    this.layouts = new Map();
    const g = look.gradient;
    this.grad = this.o.createLinearGradient(0, g.from, 0, H);
    for (let i = 0; i <= 8; i++) this.grad.addColorStop(i / 8, `rgba(0,0,0,${(Math.pow(i / 8, g.curve) * g.alpha).toFixed(3)})`);
  }

  // Calm motion: a gentle push-in through the hook, then a still frame; a
  // stretch after a same-angle cut is punched in so the jump doesn't show.
  zoomAt(t) {
    const z = this.look.zoom, seg = this.tl.clock.segAt(t);
    const hook = seg === 0 && t < this.tl.hookEnd ? 1 + (z.hook - 1) * easeOut(t / this.tl.hookEnd) : z.hook;
    return seg % 2 === 1 ? hook * z.punch : hook;
  }

  drawBase(src, sw, sh, t) {
    const { W, H } = this, z = this.zoomAt(t), ay = H * this.look.zoom.anchorY;
    const sc = Math.max(W / sw, H / sh), dw = sw * sc, dh = sh * sc;
    this.b.setTransform(z, 0, 0, z, (W / 2) * (1 - z), ay * (1 - z));
    this.b.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
    this.b.setTransform(1, 0, 0, 1, 0, 0);
  }

  // The person, as a soft alpha mask the size of the frame. null without a segmenter.
  maskFrame() {
    if (!this.seg) return null;
    this.si.drawImage(this.base, 0, 0, this.segIn.width, this.segIn.height);
    let res;
    try { res = this.seg.segmentForVideo(this.segIn, SEG_TS++); } catch (e) { this.maskErrors++; if (this.maskErrors === 1) console.warn("[captions] cut-out failed", e); return null; }
    const mk = res && res.confidenceMasks && res.confidenceMasks[0];
    if (!mk) { res && res.close && res.close(); return null; }
    const w = mk.width, h = mk.height, f = mk.getAsFloat32Array();
    if (this.maskC.width !== w || this.maskC.height !== h) { this.maskC.width = w; this.maskC.height = h; }
    const img = this.m.createImageData(w, h);
    let top = -1;
    const x0 = Math.floor(w * 0.2), x1 = Math.ceil(w * 0.8);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = f[y * w + x];
        img.data[(y * w + x) * 4 + 3] = Math.round(smooth(0.35, 0.65, v) * 255);
        if (top < 0 && v > 0.5 && x >= x0 && x <= x1) top = y;
      }
    }
    this.m.putImageData(img, 0, 0);
    res.close && res.close();
    return { top: top < 0 ? null : (top / h) * this.H };
  }

  heroAt(t) {
    const L = this.look.hero;
    for (const h of this.tl.heroes) if (t >= h.s && t <= h.e + L.fadeOut) return h;
    return null;
  }

  // Size and place a statement word once, the first time it is drawn: as big
  // as the width allows, with the head covering about its lower third.
  placeHero(h, headTop) {
    const { W, H } = this, L = this.look.hero, o = this.o;
    o.font = L.font.replace("{size}", 100);
    o.letterSpacing = "0px";
    const w100 = Math.max(1, o.measureText(h.text).width);
    h.size = Math.min(L.maxSize, (L.widthShare * W * 100) / w100);
    o.font = L.font.replace("{size}", Math.round(h.size));
    const m = o.measureText(h.text);
    h.asc = m.actualBoundingBoxAscent || h.size * 0.68;
    const top = headTop == null ? H * 0.42 : headTop;
    h.baseline = Math.max(h.asc + (h.label ? 150 : 90), top + h.asc / 3);
  }

  drawHero(h, t) {
    const L = this.look.hero, LB = this.look.label, o = this.o, W = this.W;
    const a = Math.min(clamp01((t - h.s) / L.fadeIn), clamp01((h.e + L.fadeOut - t) / L.fadeOut));
    if (a <= 0) return;
    const sc = L.settleFrom + (1 - L.settleFrom) * easeOut((t - h.s) / L.fadeIn);
    const cy = h.baseline - h.asc / 2;
    o.save();
    o.globalAlpha = a;
    o.translate(W / 2, cy); o.scale(sc, sc); o.translate(-W / 2, -cy);
    o.font = L.font.replace("{size}", Math.round(h.size));
    o.letterSpacing = "0px";
    o.textAlign = "center"; o.textBaseline = "alphabetic";
    o.fillStyle = L.color;
    o.fillText(h.text, W / 2, h.baseline);
    if (h.label) {
      const y = h.baseline - h.asc - LB.gap;
      o.font = LB.font; o.letterSpacing = LB.tracking; o.fillStyle = LB.color;
      o.fillText(h.label, W / 2, y);
      const lw = o.measureText(h.label).width;
      o.fillRect(W / 2 - lw / 2 - 26 - LB.rule, y - 13, LB.rule, 2);
      o.fillRect(W / 2 + lw / 2 + 26, y - 13, LB.rule, 2);
    }
    o.restore();
  }

  // Lines for a phrase: every word on its line's fixed baseline; line 1 at
  // the same height whether there is one line or two.
  layout(ph) {
    if (this.layouts.has(ph)) return this.layouts.get(ph);
    const C = this.look.caption, o = this.o, W = this.W;
    const items = ph.words.map((w) => {
      const st = w.serif ? C.serif : C.plain;
      o.font = st.font; o.letterSpacing = st.tracking;
      return { w, st, width: o.measureText(w.text).width };
    });
    const lines = [[]];
    let lw = 0;
    for (const it of items) {
      if (lines[lines.length - 1].length && lw + it.width > C.maxWidth) { lines.push([]); lw = 0; }
      lines[lines.length - 1].push(it); lw += it.width + C.gap;
    }
    lines.forEach((ln, i) => {
      const tot = ln.reduce((n, it) => n + it.width, 0) + C.gap * (ln.length - 1);
      let x = (W - tot) / 2;
      for (const it of ln) { it.x = x; it.y = C.line1 + i * C.pitch; x += it.width + C.gap; }
    });
    const lay = items;
    this.layouts.set(ph, lay);
    return lay;
  }

  drawCaptions(t) {
    const C = this.look.caption, o = this.o;
    const ph = this.tl.phrases.find((p) => t >= p.s && t < p.end);
    if (!ph) return;
    const out = clamp01((ph.end - t) / C.fadeOut);
    o.save();
    o.textAlign = "left"; o.textBaseline = "alphabetic";
    o.fillStyle = C.color;
    o.shadowColor = C.shadow.color; o.shadowBlur = C.shadow.blur; o.shadowOffsetY = C.shadow.y;
    for (const it of this.layout(ph)) {
      const a = Math.min(clamp01((t - it.w.s) / C.fadeIn), out);
      if (a <= 0) continue;
      o.globalAlpha = a;
      o.font = it.st.font; o.letterSpacing = it.st.tracking;
      o.fillText(it.w.text, it.x, it.y);
    }
    o.restore();
  }

  // One frame at time t (seconds, on the cut video's clock) from the source frame.
  render(src, sw, sh, t) {
    const { W, H, o } = this;
    this.drawBase(src, sw, sh, t);
    o.clearRect(0, 0, W, H);
    o.drawImage(this.base, 0, 0);
    const h = this.heroAt(t);
    if (h) {
      const mask = this.maskFrame();
      if (h.baseline == null) this.placeHero(h, mask && mask.top);
      this.drawHero(h, t);
      if (mask) {
        // The person cut out of the frame and laid back over the word.
        this.p.globalCompositeOperation = "source-over";
        this.p.clearRect(0, 0, W, H);
        this.p.drawImage(this.base, 0, 0);
        this.p.globalCompositeOperation = "destination-in";
        this.p.imageSmoothingEnabled = true; this.p.imageSmoothingQuality = "high";
        this.p.filter = "blur(2px)";
        this.p.drawImage(this.maskC, 0, 0, W, H);
        this.p.filter = "none";
        this.p.globalCompositeOperation = "source-over";
        o.drawImage(this.person, 0, 0);
      }
    }
    o.fillStyle = this.grad;
    o.fillRect(0, this.look.gradient.from, W, H - this.look.gradient.from);
    this.drawCaptions(t);
    return this.out;
  }
}

// Google's person-cutout model, in the browser. Its code and model load from
// their published homes the first time; null if they can't.
export async function createSegmenter() {
  try {
    const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm");
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite", delegate },
      runningMode: "VIDEO", outputConfidenceMasks: true, outputCategoryMask: false,
    });
    try { return await ImageSegmenter.createFromOptions(files, opts("GPU")); }
    catch (_) { return await ImageSegmenter.createFromOptions(files, opts("CPU")); }
  } catch (e) {
    console.warn("[captions] person cutout unavailable", e);
    return null;
  }
}
