// Video captions: from Whisper's words and Claude's plan to a timeline the
// renderer draws (Dani, 3 Nov 2026). Everything here is plain data; no
// drawing, no network.

/* Whisper splits some words into tokens: "like" "-minded", "£200" ",000",
   "15" "-year" "-old". Joined back before Claude sees them, so the indices it
   plans with are whole words. */
export function mergeTokens(raw) {
  const out = [];
  for (const t of raw || []) {
    const w = String(t.w || "").trim();
    if (!w) continue;
    const prev = out[out.length - 1];
    if (prev && /^[-,'’]/.test(w) && !/[.!?]$/.test(prev.w)) {
      prev.w += w; prev.e = t.e;
    } else out.push({ w, s: t.s, e: t.e });
  }
  return out;
}

// The kept stretches, tidied: in order, inside the video, none overlapping.
export function cleanKeep(keep, duration) {
  const k = (keep || [])
    .map((r) => ({ start: Math.max(0, Number(r.start) || 0), end: Math.min(duration || 1e9, Number(r.end) || 0) }))
    .filter((r) => r.end - r.start > 0.2)
    .sort((a, b) => a.start - b.start);
  const out = [];
  for (const r of k) {
    const last = out[out.length - 1];
    if (last && r.start < last.end) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out.length ? out : [{ start: 0, end: duration || 0 }];
}

// Original time -> time in the cut video; null when that moment is cut out.
export function makeClock(keep) {
  const segs = [];
  let off = 0;
  for (const r of keep) { segs.push({ start: r.start, end: r.end, off }); off += r.end - r.start; }
  const total = off;
  return {
    segs, total,
    toOut(t) {
      for (const s of segs) if (t >= s.start - 1e-6 && t <= s.end + 1e-6) return s.off + (Math.min(Math.max(t, s.start), s.end) - s.start);
      return null;
    },
    toSrc(tOut) {
      for (const s of segs) if (tOut < s.off + (s.end - s.start) - 1e-9) return { t: s.start + Math.max(0, tOut - s.off), seg: segs.indexOf(s) };
      const last = segs[segs.length - 1];
      return { t: last ? last.end : 0, seg: Math.max(0, segs.length - 1) };
    },
    segAt(tOut) {
      for (let i = 0; i < segs.length; i++) if (tOut < segs[i].off + (segs[i].end - segs[i].start)) return i;
      return segs.length - 1;
    },
  };
}

function shown(text, serif) {
  const t = String(text || "").replace(/["“”]/g, "").replace(/[.,:;?!]+$/, "");
  if (serif) return /^[0-9£$]/.test(t) ? t : t.toLowerCase();
  // Caps, but a plural after a number stays small: 911s, 1990s.
  return t.toUpperCase().replace(/(\d)S\b/g, "$1s");
}

/* The whole timeline: the clock, the caption phrases (each word with its
   out-time and style) and the statement words, all on the cut video's time. */
export function buildTimeline(words, plan, duration) {
  const ws = words.map((w) => ({ ...w }));
  for (const f of plan.fixes || []) if (ws[f.index] && String(f.text || "").trim()) ws[f.index].w = String(f.text).trim();
  const keep = cleanKeep(plan.keep, duration);
  const clock = makeClock(keep);

  const phrases = [];
  for (const p of plan.phrases || []) {
    const em = new Set(p.emphasis || []);
    const list = [];
    for (let i = Math.max(0, p.first); i <= Math.min(ws.length - 1, p.last); i++) {
      const w = ws[i];
      const s = clock.toOut(w.s), e = clock.toOut(w.e);
      if (s == null) continue;                       // cut out
      const serif = em.has(i);
      list.push({ i, text: shown(w.w, serif), serif, s, e: e == null ? s + 0.3 : e });
    }
    if (list.length) phrases.push({ words: list, s: list[0].s, e: list[list.length - 1].e });
  }
  phrases.sort((a, b) => a.s - b.s);

  // Each phrase stays up until the next starts, at most `hold` past its last
  // word, and never across a cut.
  for (let j = 0; j < phrases.length; j++) {
    const ph = phrases[j];
    const next = phrases[j + 1];
    let end = ph.e + 0.6;
    if (next) end = Math.min(end, next.s);
    const seg = clock.segs[clock.segAt(ph.s)];
    if (seg) end = Math.min(end, seg.off + (seg.end - seg.start));
    ph.end = Math.max(ph.e, end);
  }

  const heroes = (plan.heroes || []).map((h) => {
    let s = clock.toOut(Number(h.start)), e = clock.toOut(Number(h.end));
    if (s == null && e == null) return null;
    if (s == null) s = Math.max(0, e - 1.5);
    if (e == null) e = s + 1.5;
    return { text: String(h.text || "").toUpperCase(), label: String(h.label || "").toUpperCase(), s, e: Math.max(s + 0.6, e), baseline: null, size: null };
  }).filter(Boolean).sort((a, b) => a.s - b.s);
  for (let j = 1; j < heroes.length; j++) if (heroes[j].s < heroes[j - 1].e) heroes[j - 1].e = heroes[j].s;

  return { keep, clock, phrases, heroes, total: clock.total, hookEnd: phrases[0] ? phrases[0].end : 3 };
}
