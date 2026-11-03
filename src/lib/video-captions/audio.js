// Video captions: the sound (Dani, 3 Nov 2026). Read once from the video,
// then (a) squeezed into a small 16kHz mono WAV for Whisper and (b) cut to
// the kept stretches, with short fades at every join, and levelled to
// Instagram's -14 LUFS.
import { AudioBufferSink } from "mediabunny";

// The whole soundtrack as one AudioBuffer.
export async function readAudio(input) {
  const track = await input.getPrimaryAudioTrack();
  if (!track) return null;
  const parts = [];
  for await (const wb of new AudioBufferSink(track).buffers()) parts.push(wb);
  if (!parts.length) return null;
  const sr = parts[0].buffer.sampleRate;
  const ch = parts[0].buffer.numberOfChannels;
  const start = parts[0].timestamp;
  const end = parts[parts.length - 1].timestamp + parts[parts.length - 1].duration;
  const len = Math.ceil((end - start) * sr);
  const out = new AudioBuffer({ length: len, numberOfChannels: ch, sampleRate: sr });
  for (const p of parts) {
    const at = Math.round((p.timestamp - start) * sr);
    for (let c = 0; c < ch; c++) {
      const src = p.buffer.getChannelData(Math.min(c, p.buffer.numberOfChannels - 1));
      out.getChannelData(c).set(src.subarray(0, Math.max(0, Math.min(src.length, len - at))), at);
    }
  }
  return out;
}

// Mono, 16kHz, 16-bit WAV: about 2MB a minute, which is what Whisper wants.
export async function speechWav(buffer) {
  const sr = 16000;
  const ctx = new OfflineAudioContext(1, Math.ceil(buffer.duration * sr), sr);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);   // down-mixed to mono by the 1-channel context
  src.start();
  const r = await ctx.startRendering();
  const pcm = r.getChannelData(0);
  const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); view.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sr, true); view.setUint32(28, sr * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, "data"); view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  return new Blob([view], { type: "audio/wav" });
}

// The kept stretches joined, each faded in and out so no join clicks.
export function cutAudio(buffer, keep, fadeIn = 0.015, fadeOut = 0.04) {
  const sr = buffer.sampleRate, ch = buffer.numberOfChannels;
  const ranges = keep.map((r) => [Math.max(0, Math.round(r.start * sr)), Math.min(buffer.length, Math.round(r.end * sr))]).filter(([a, b]) => b > a);
  const len = ranges.reduce((n, [a, b]) => n + (b - a), 0);
  const out = new AudioBuffer({ length: Math.max(1, len), numberOfChannels: ch, sampleRate: sr });
  for (let c = 0; c < ch; c++) {
    const src = buffer.getChannelData(c), dst = out.getChannelData(c);
    let at = 0;
    for (const [a, b] of ranges) {
      const n = b - a, fi = Math.min(n, Math.round(fadeIn * sr)), fo = Math.min(n, Math.round(fadeOut * sr));
      for (let i = 0; i < n; i++) {
        let g = 1;
        if (i < fi) g = i / fi;
        if (n - i < fo) g = Math.min(g, (n - i) / fo);
        dst[at + i] = src[a + i] * g;
      }
      at += n;
    }
  }
  return out;
}

/* Integrated loudness, ITU-R BS.1770: K-weighting, 400ms blocks overlapping
   by 75%, an absolute gate at -70 LUFS and a relative gate 10 below. */
function biquad(x, b0, b1, b2, a1, a2) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
function kWeight(x, fs) {
  // Stage 1: the head's high-shelf.
  let G = 4.0, Q = 1 / Math.SQRT2, fc = 1681.974450955533;
  let A = Math.pow(10, G / 40), w0 = 2 * Math.PI * fc / fs, al = Math.sin(w0) / (2 * Q), cs = Math.cos(w0), sA = Math.sqrt(A);
  let a0 = (A + 1) - (A - 1) * cs + 2 * sA * al;
  let y = biquad(x,
    A * ((A + 1) + (A - 1) * cs + 2 * sA * al) / a0, -2 * A * ((A - 1) + (A + 1) * cs) / a0, A * ((A + 1) + (A - 1) * cs - 2 * sA * al) / a0,
    2 * ((A - 1) - (A + 1) * cs) / a0, ((A + 1) - (A - 1) * cs - 2 * sA * al) / a0);
  // Stage 2: the high-pass.
  Q = 0.5003270373238773; fc = 38.13547087602444;
  w0 = 2 * Math.PI * fc / fs; al = Math.sin(w0) / (2 * Q); cs = Math.cos(w0); a0 = 1 + al;
  return biquad(y, (1 + cs) / 2 / a0, -(1 + cs) / a0, (1 + cs) / 2 / a0, -2 * cs / a0, (1 - al) / a0);
}
export function loudness(buffer) {
  const fs = buffer.sampleRate, block = Math.round(0.4 * fs), hop = Math.round(0.1 * fs);
  const chans = [];
  for (let c = 0; c < Math.min(2, buffer.numberOfChannels); c++) chans.push(kWeight(buffer.getChannelData(c), fs));
  const z = [];
  for (let s = 0; s + block <= buffer.length; s += hop) {
    let sum = 0;
    for (const y of chans) { let m = 0; for (let i = s; i < s + block; i++) m += y[i] * y[i]; sum += m / block; }
    z.push(sum);
  }
  const L = (v) => -0.691 + 10 * Math.log10(v);
  const abs = z.filter((v) => L(v) > -70);
  if (!abs.length) return -70;
  const rel = L(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const gated = abs.filter((v) => L(v) > rel);
  return L(gated.reduce((a, b) => a + b, 0) / Math.max(1, gated.length));
}

/* Level to `target` LUFS. Turning it up that far usually pushes the odd
   peak over the top, so a look-ahead limiter holds peaks at `ceiling` dBFS:
   it sees a peak 5ms early, eases the gain down for it, and lets it back up
   over 120ms, which is too quick and too small to hear on speech. Measured
   again afterwards, and nudged once if the limiter took a little off. */
function limit(buffer, ceiling) {
  const sr = buffer.sampleRate, ch = buffer.numberOfChannels, n = buffer.length;
  const ceil = Math.pow(10, ceiling / 20), look = Math.max(1, Math.round(0.005 * sr));
  const rel = Math.exp(-1 / (0.12 * sr));
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let p = 0;
    for (let c = 0; c < ch; c++) { const a = Math.abs(buffer.getChannelData(c)[i]); if (a > p) p = a; }
    need[i] = p > ceil ? ceil / p : 1;
  }
  // The lowest gain needed anywhere in the next `look` samples (a running minimum).
  const ahead = new Float32Array(n);
  const q = []; let h = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (q.length > h && need[q[q.length - 1]] >= need[i]) q.pop();
    q.push(i);
    while (q[h] > i + look) h++;
    ahead[i] = need[q[h]];
  }
  let g = 1;
  for (let i = 0; i < n; i++) {
    g = ahead[i] < g ? ahead[i] : ahead[i] + (g - ahead[i]) * rel;
    for (let c = 0; c < ch; c++) buffer.getChannelData(c)[i] *= g;
  }
}
function gain(buffer, db) {
  const g = Math.pow(10, db / 20);
  for (let c = 0; c < buffer.numberOfChannels; c++) { const d = buffer.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= g; }
}
export function level(buffer, target = -14, ceiling = -1.5) {
  const before = loudness(buffer);
  if (before <= -69) return { before, gainDb: 0, after: before };
  gain(buffer, target - before);
  limit(buffer, ceiling);
  let after = loudness(buffer);
  if (target - after > 0.3) { gain(buffer, target - after); limit(buffer, ceiling); after = loudness(buffer); }
  return { before, gainDb: after - before, after };
}
