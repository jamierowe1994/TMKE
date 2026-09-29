// The approved figures for the four headline cards on a client report's
// "What it means" page. The drafting AI picks which four tell this month's
// story (by key only); the numbers are always worked out here, from the
// report's own data, so a card can never show a figure the AI made up.
//
// Keep the keys and one-line descriptions in step with HEADLINE_KEYS in the
// Worker's /smm/report/draft prompt.

export const DEFAULT_HEADLINE = ["reach", "views", "interactions", "netFollowers"];

const n = (v) => { if (v == null || v === "") return null; const x = Number(String(v).replace(/[^0-9.\-]/g, "")); return Number.isFinite(x) ? x : null; };
const fmt = (v) => Number(v).toLocaleString("en-GB");
const one = (x) => (Math.abs(x) < 10 ? Math.round(x * 10) / 10 : Math.round(x));

/**
 * @param ctx { d: this month's data, prev: last month's data or null, month: "September", pm: "August" or null }
 * Each returns { label, value, sub, dir } (dir: 1 up, -1 down, 0 neither) or null when the data isn't there.
 */
export const HEADLINE_METRICS = {
  reach: { label: "Profile reach", about: "different people who saw the account",
    get: ({ d, prev, pm }) => pctCard("Profile reach", n(d.profile?.reach), n(d.profile?.reachChange), n(prev?.profile?.reach), pm) },
  views: { label: "Views", about: "total views, repeats included",
    get: ({ d, prev, pm }) => pctCard("Views", n(d.profile?.views), n(d.profile?.viewsChange), n(prev?.profile?.views), pm) },
  interactions: { label: "Interactions", about: "likes, comments, saves and shares",
    get: ({ d, prev, pm }) => pctCard("Interactions", n(d.profile?.interactions), n(d.profile?.interactionsChange), n(prev?.profile?.interactions), pm) },
  // SocialPilot's follower total is "Lifetime Data": the count on the day
  // the report is RUN, not at month end. Two months' totals are two days'
  // snapshots (August's PDF was run on 28 Sep), so they're never compared.
  // New followers, which is bound to the month, carries the change.
  netFollowers: { label: "Followers", about: "total followers on the day the report was run, with the month's new followers",
    get: ({ d, month }) => {
      const c = n(d.profile?.followers); if (c == null) return null;
      const x = n(d.profile?.newFollowers);
      return { label: "Followers", value: fmt(c), sub: x ? `${fmt(x)} new in ${month}` : "Total followers", dir: x > 0 ? 1 : 0 };
    } },
  newFollowers: { label: "New followers", about: "people who followed during the month (not net of anyone who unfollowed)",
    get: ({ d, month }) => { const x = n(d.profile?.newFollowers); return x == null ? null : { label: "New followers", value: `+${fmt(x)}`, sub: `Followed you in ${month}`, dir: x > 0 ? 1 : 0 }; } },
  interactionRate: { label: "Interaction rate", about: "interactions as a share of profile reach",
    get: ({ d, prev, pm }) => {
      const c = n(d.profile?.interactionRate); if (c == null) return null;
      const o = n(prev?.profile?.interactionRate);
      const x = o == null ? null : c - o;
      return { label: "Interaction rate", value: `${c}%`, sub: x == null ? "Of the people reached" : x ? `${x > 0 ? "Up" : "Down"} ${one(Math.abs(x))} points on ${pm}` : `Same as ${pm}`, dir: x == null ? 0 : Math.sign(x) };
    } },
  reelRate: { label: "Reel interaction rate", about: "reels' interaction rate, beside posts' for comparison",
    get: ({ d }) => { const r = n(d.reels?.interactionRate); if (r == null) return null; const p = n(d.posts?.interactionRate);
      return { label: "Reel interaction rate", value: `${r}%`, sub: p != null ? `Posts: ${p}%` : "On your reels", dir: p != null ? Math.sign(r - p) : 0 }; } },
  postRate: { label: "Post interaction rate", about: "feed posts' interaction rate, beside reels' for comparison",
    get: ({ d }) => { const p = n(d.posts?.interactionRate); if (p == null) return null; const r = n(d.reels?.interactionRate);
      return { label: "Post interaction rate", value: `${p}%`, sub: r != null ? `Reels: ${r}%` : "On your posts", dir: r != null ? Math.sign(p - r) : 0 }; } },
  nonFollowerShare: { label: "Non-follower reach", about: "share of content reach that was people who don't follow them (content reach, never profile reach)",
    get: ({ d }) => { const nf = n(d.reach?.nonFollower), f = n(d.reach?.follower); if (nf == null || f == null || nf + f <= 0) return null;
      return { label: "Non-follower reach", value: `${Math.round(nf / (nf + f) * 100)}%`, sub: "Of your content's reach", dir: 0 }; } },
  published: { label: "Content published", about: "posts and reels published",
    get: ({ d }) => { const p = n(d.posts?.published), r = n(d.reels?.published); if (p == null && r == null) return null;
      return { label: "Content published", value: fmt((p || 0) + (r || 0)), sub: [p != null ? `${p} post${p === 1 ? "" : "s"}` : "", r != null ? `${r} reel${r === 1 ? "" : "s"}` : ""].filter(Boolean).join(", "), dir: 0 }; } },
  reelViews: { label: "Reel views", about: "total views of the month's reels",
    get: ({ d }) => { const v = n(d.reels?.views); return v == null ? null : { label: "Reel views", value: fmt(v), sub: n(d.reels?.published) != null ? `Across ${n(d.reels.published)} reels` : "", dir: 0 }; } },
  linkTaps: { label: "Website taps", about: "taps on the link in their Instagram profile",
    get: ({ d, prev, pm }) => { const c = n(d.profile?.linkTaps); if (c == null) return null; const o = n(prev?.profile?.linkTaps);
      return { label: "Website taps", value: fmt(c), sub: o == null ? "From your Instagram profile" : c === o ? `Same as ${pm}` : `${c > o ? "Up" : "Down"} from ${fmt(o)} in ${pm}`, dir: o == null ? 0 : Math.sign(c - o) }; } },
  topPost: { label: "Best post's reach", about: "the reach of the month's best-reaching post or reel",
    get: ({ d }) => { const rows = (Array.isArray(d.content) && d.content.length ? d.content : (d.topContent || [])).filter((t) => n(t.reach) != null);
      if (!rows.length) return null; const t = rows.slice().sort((a, b) => n(b.reach) - n(a.reach))[0];
      return { label: "Best post's reach", value: fmt(n(t.reach)), sub: String(t.title || "").replace(/\s*…$/, "…"), dir: 0 }; } },
};

function pctCard(label, c, sp, o, pm) {
  if (c == null) return null;
  // SocialPilot's own change on the previous period wins: worked out from
  // exact figures, where ours would come from rounded ones ("2.5K").
  const x = sp ?? (o ? (c - o) / Math.abs(o) * 100 : null);
  return { label, value: fmt(c), sub: x == null ? "" : `${x >= 0 ? "Up" : "Down"} ${one(Math.abs(x))}%${pm ? ` on ${pm}` : ""}`, dir: x == null ? 0 : Math.sign(x) };
}

/** Four headline cards: the month's chosen keys, topped up from the defaults. */
export function headlineCards(keys, ctx, vis) {
  const want = [...(Array.isArray(keys) ? keys : []), ...DEFAULT_HEADLINE].filter((k, i, a) => HEADLINE_METRICS[k] && a.indexOf(k) === i);
  const out = [];
  for (const k of want) {
    if (vis && vis[k] === false) continue;
    const c = HEADLINE_METRICS[k].get(ctx);
    if (c) out.push({ key: k, ...c });
    if (out.length === 4) break;
  }
  return out;
}

// Insight categories, in the order they read.
export const INSIGHT_CATEGORIES = {
  working: "What's working",
  learning: "What we're learning",
  watch: "One to watch",
  previous: "From last month",
};

/** Normalise an insight, including ones drafted in the earlier shape. */
export function normaliseInsight(i) {
  if (!i) return null;
  const legacy = { win: "working", trend: "learning", watch: "watch", previous_action: "previous" };
  const category = INSIGHT_CATEGORIES[i.category] ? i.category : (legacy[i.type] || "working");
  const headline = String(i.headline || i.title || "").trim();
  if (!headline) return null;
  const analysis = String(i.analysis || [i.interpretation, i.response].filter(Boolean).join(" ")).trim();
  const evidence = Array.isArray(i.evidence) ? i.evidence.filter(Boolean).map(String) : (i.evidence ? [String(i.evidence)] : []);
  return { category, headline, analysis, evidence, confidence: i.confidence === "emerging" ? "emerging" : "strong" };
}

/** The same platform's report for the calendar month before r, or null. */
export function lastMonthOf(r, all) {
  const want = r.year * 12 + r.month - 1;
  return (all || []).find((x) => (x.platform || "") === (r.platform || "") && x.year * 12 + x.month === want) || null;
}

/**
 * Month-on-month lines for the two figures SocialPilot gives no change for:
 * interaction rate (in points, since it's already a percentage) and total
 * published (a count). Empty when last month's figure isn't there.
 */
export function numbersMoves(d, prevData) {
  const p = d?.profile || {}, o = prevData?.profile || {};
  const out = { interactionRate: "", published: "" };
  const c = n(p.interactionRate), was = n(o.interactionRate);
  if (c != null && was != null) {
    const x = Math.round((c - was) * 10) / 10;
    out.interactionRate = x ? `${x > 0 ? "Up" : "Down"} ${Math.abs(x)} point${Math.abs(x) === 1 ? "" : "s"} on last month` : "Same as last month";
  }
  const tot = (v) => { const a = n(v?.posts?.published), b = n(v?.reels?.published); return a == null && b == null ? null : (a || 0) + (b || 0); };
  const now = tot(d), then = tot(prevData);
  if (now != null && then != null) {
    const x = now - then;
    out.published = x ? `${x > 0 ? "Up" : "Down"} ${Math.abs(x)} on last month` : "Same as last month";
  }
  return out;
}
