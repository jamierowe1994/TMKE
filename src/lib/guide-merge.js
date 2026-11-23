/* A built-in course copied into the guides table (Danielle, 20 Nov: "copy
 * them into the database so I can edit them").
 *
 * The database row is what she edits: title, summary, lessons, cover, audience,
 * minutes, order. The built-in keeps what the table has no column for: `held`
 * (off Learn until launch), `training` (the Getting Started series, kept out of
 * the general grid), `art`, `cover_pos`, `brands`, `href`. So a copy is the
 * built-in with the row's filled-in fields laid over it.
 *
 * created_at stays the built-in's: a copy made today is not new, and must not
 * jump to the top of "Just landed". */
export function withBuiltIn(row, builtIn) {
  if (!builtIn) return row;
  if (!row) return builtIn;
  const out = { ...builtIn };
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) continue;
    if (k === 'lessons' && (!Array.isArray(v) || !v.length)) continue;
    out[k] = v;
  }
  out.created_at = builtIn.created_at || null;
  return out;
}

/* What a copy starts as: the built-in's own words, published, so nothing
 * changes for members until she edits it. */
export function copyRowFor(g) {
  return {
    slug: g.slug,
    title: g.title,
    topic: g.topic || 'getting-started',
    kind: g.kind === 'course' ? 'course' : 'guide',
    summary: g.summary || null,
    cover_url: g.cover_url || g.art || null,
    lessons: (g.lessons || []).map((l) => {
      const r = { title: l.title || '', body_html: l.body_html || '' };
      if (l.video_url) r.video_url = l.video_url;
      if (l.walk) r.walk = l.walk;
      return r;
    }),
    est_minutes: g.est_minutes || null,
    audience: g.audience || 'members',
    sort_order: g.sort_order || 0,
    level: g.level || 'free',
    status: 'published',
  };
}
