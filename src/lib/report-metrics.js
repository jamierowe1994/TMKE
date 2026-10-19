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
// Percentages show two decimal places at most.
export const pct2 = (x) => Math.round(x * 100) / 100;

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
    get: ({ d, month }) => { const x = n(d.profile?.newFollowers); return x == null ? null : { label: "New followers", value: `+${fmt(x)}`, sub: "Followed you", dir: x > 0 ? 1 : 0 }; } },
  interactionRate: { label: "Interaction rate", about: "interactions as a share of profile reach",
    get: ({ d, prev, pm }) => {
      const c = n(d.profile?.interactionRate); if (c == null) return null;
      const o = n(prev?.profile?.interactionRate);
      const x = o == null ? null : c - o;
      return { label: "Interaction rate", value: `${pct2(c)}%`, sub: x == null ? "Of the people reached" : x ? `${x > 0 ? "Up" : "Down"} ${one(Math.abs(x))} points on ${pm}` : `Same as ${pm}`, dir: x == null ? 0 : Math.sign(x) };
    } },
  reelRate: { label: "Reel interaction rate", about: "reels' interaction rate, beside posts' for comparison",
    get: ({ d }) => { const r = n(d.reels?.interactionRate); if (r == null) return null; const p = n(d.posts?.interactionRate);
      return { label: "Reel interaction rate", value: `${pct2(r)}%`, sub: p != null ? `Posts: ${pct2(p)}%` : "On your reels", dir: p != null ? Math.sign(r - p) : 0 }; } },
  postRate: { label: "Post interaction rate", about: "feed posts' interaction rate, beside reels' for comparison",
    get: ({ d }) => { const p = n(d.posts?.interactionRate); if (p == null) return null; const r = n(d.reels?.interactionRate);
      return { label: "Post interaction rate", value: `${pct2(p)}%`, sub: r != null ? `Reels: ${pct2(r)}%` : "On your posts", dir: r != null ? Math.sign(p - r) : 0 }; } },
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

/* Facebook's, LinkedIn's and all platforms together (Danielle, 19 Oct 2026):
   with several platforms in a month, each of the four can be one platform's
   figure or a combined one. Every metric says which platform it's from, and
   the card shows it under the figure. Instagram's are the ones above. */
const fbm = (d) => d.facebook || {}, lim = (d) => d.linkedin || {};
const liImp = (li) => n((li.posts || {}).impressions ?? li.impressions);
const plural = (x, one, many) => `${fmt(x)} ${x === 1 ? one : many}`;
// A total across the platforms the month has: null when none of them has it.
const total = (vals) => { const v = vals.filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
const ALL_PARTS = {
  reach: (d) => [d.profile ? n(d.profile.reach) : null, d.facebook ? n(fbm(d).pageReach) : null, d.linkedin ? n((lim(d).posts || {}).reach) : null],
  views: (d) => [d.profile ? n(d.profile.views) : null, d.facebook ? n((fbm(d).posts || {}).views) : null, d.linkedin ? liImp(lim(d)) : null],
  engagement: (d) => [d.profile ? n(d.profile.interactions) : null, d.facebook ? n((fbm(d).posts || {}).engagement) : null, d.linkedin ? n((lim(d).posts || {}).engagement) : null],
  followers: (d) => [d.profile ? n(d.profile.followers) : null, d.facebook ? n(fbm(d).pageLikes) : null, d.linkedin ? n(lim(d).followers) : null],
  newFollowers: (d) => [d.profile ? n(d.profile.newFollowers) : null, d.facebook ? n(fbm(d).newFans) : null, d.linkedin ? n(lim(d).followerGrowth) : null],
  published: (d) => [n(d.posts?.published) != null || n(d.reels?.published) != null ? (n(d.posts?.published) || 0) + (n(d.reels?.published) || 0) : null, d.facebook ? n((fbm(d).posts || {}).published) : null, d.linkedin ? n((lim(d).posts || {}).published) : null],
};
// A figure across every platform the month has (Your Socials' cover, Dani
// 20 Oct), and whether last month can be set against it: only when it had
// the same platforms, or a new account would read as growth.
export const combined = (d, part) => total(ALL_PARTS[part](d || {}));
export const comparable = (d, prev, part) => !!prev && ALL_PARTS[part](prev).every((x, i) => (x == null) === (ALL_PARTS[part](d)[i] == null));
// This month against last, only when last month had the same platforms.
const allCard = (label, part, { d, prev, pm }, sub) => {
  const c = total(ALL_PARTS[part](d)); if (c == null) return null;
  const same = prev && ALL_PARTS[part](prev).every((x, i) => (x == null) === (ALL_PARTS[part](d)[i] == null));
  const o = same ? total(ALL_PARTS[part](prev)) : null;
  const card = pctCard(label, c, null, o, pm);
  if (sub && !card.sub) card.sub = sub;
  return card;
};
const MORE_METRICS = {
  all_reach: { platform: "all", label: "Reach", about: "Instagram profile reach, Facebook Page reach and LinkedIn post reach added together",
    get: (ctx) => allCard("Reach", "reach", ctx, "Across your accounts") },
  all_views: { platform: "all", label: "Views", about: "Instagram views, Facebook post views and LinkedIn impressions added together",
    get: (ctx) => allCard("Views", "views", ctx, "Across your accounts") },
  all_engagement: { platform: "all", label: "Engagement", about: "Instagram interactions and Facebook and LinkedIn engagement added together",
    get: (ctx) => allCard("Engagement", "engagement", ctx, "Across your accounts") },
  all_followers: { platform: "all", label: "Followers", about: "Instagram followers, Facebook Page likes and LinkedIn followers added together, with the month's new ones",
    get: ({ d, month }) => { const c = total(ALL_PARTS.followers(d)); if (c == null) return null; const x = total(ALL_PARTS.newFollowers(d));
      return { label: "Followers", value: fmt(c), sub: x ? `${fmt(x)} new in ${month}` : "Across your accounts", dir: x > 0 ? 1 : 0 }; } },
  all_newFollowers: { platform: "all", label: "New followers", about: "new Instagram followers, Facebook Page likes and LinkedIn followers added together",
    get: ({ d }) => { const x = total(ALL_PARTS.newFollowers(d)); return x == null ? null : { label: "New followers", value: `+${fmt(x)}`, sub: "Across your accounts", dir: x > 0 ? 1 : 0 }; } },
  all_published: { platform: "all", label: "Content published", about: "everything published on every platform",
    get: ({ d }) => { const x = total(ALL_PARTS.published(d)); return x == null ? null : { label: "Content published", value: fmt(x), sub: "Across your accounts", dir: 0 }; } },

  fb_pageLikes: { platform: "facebook", label: "Page likes", about: "people who like the Facebook Page, with the month's new likes",
    get: ({ d, month }) => { const c = n(fbm(d).pageLikes); if (c == null) return null; const x = n(fbm(d).newFans);
      return { label: "Page likes", value: fmt(c), sub: x ? `${fmt(x)} new in ${month}` : "People who like your Page", dir: x > 0 ? 1 : 0 }; } },
  fb_newLikes: { platform: "facebook", label: "New Page likes", about: "people who liked the Facebook Page during the month",
    get: ({ d }) => { const x = n(fbm(d).newFans); return x == null ? null : { label: "New Page likes", value: `+${fmt(x)}`, sub: "Liked your Page", dir: x > 0 ? 1 : 0 }; } },
  fb_pageReach: { platform: "facebook", label: "Page reach", about: "different people who saw anything from the Facebook Page",
    get: ({ d, prev, pm }) => pctCard("Page reach", n(fbm(d).pageReach), n(fbm(d).pageReachChange), prev ? n(fbm(prev).pageReach) : null, pm) },
  fb_pageViews: { platform: "facebook", label: "Page views", about: "visits to the Facebook Page itself",
    get: ({ d, prev, pm }) => pctCard("Page views", n(fbm(d).pageViews), n(fbm(d).pageViewsChange), prev ? n(fbm(prev).pageViews) : null, pm) },
  fb_postViews: { platform: "facebook", label: "Post views", about: "times the Facebook posts were seen",
    get: ({ d, prev, pm }) => pctCard("Post views", n((fbm(d).posts || {}).views), n((fbm(d).posts || {}).viewsChange), prev ? n((fbm(prev).posts || {}).views) : null, pm) },
  fb_engagement: { platform: "facebook", label: "Engagement", about: "reactions, comments and shares on the Facebook posts",
    get: ({ d, prev, pm }) => pctCard("Engagement", n((fbm(d).posts || {}).engagement), n((fbm(d).posts || {}).engagementChange), prev ? n((fbm(prev).posts || {}).engagement) : null, pm) },
  fb_videoPlays: { platform: "facebook", label: "Video plays", about: "plays of the month's Facebook videos",
    get: ({ d, prev, pm }) => pctCard("Video plays", n((fbm(d).posts || {}).videoPlays), n((fbm(d).posts || {}).videoPlaysChange), prev ? n((fbm(prev).posts || {}).videoPlays) : null, pm) },
  fb_published: { platform: "facebook", label: "Posts published", about: "Facebook posts published",
    get: ({ d }) => { const fp = fbm(d).posts || {}, x = n(fp.published); if (x == null) return null; const i = n(fp.images), v = n(fp.videos);
      return { label: "Posts published", value: fmt(x), sub: [i ? plural(i, "image", "images") : "", v ? plural(v, "video", "videos") : ""].filter(Boolean).join(", "), dir: 0 }; } },

  li_followers: { platform: "linkedin", label: "Followers", about: "LinkedIn followers, with the new ones",
    get: ({ d }) => { const c = n(lim(d).followers); if (c == null) return null; const x = n(lim(d).followerGrowth);
      return { label: "Followers", value: fmt(c), sub: x ? `${fmt(x)} new` : "People following you", dir: x > 0 ? 1 : 0 }; } },
  li_newFollowers: { platform: "linkedin", label: "New followers", about: "new LinkedIn followers in the period",
    get: ({ d }) => { const x = n(lim(d).followerGrowth); return x == null ? null : { label: "New followers", value: `+${fmt(x)}`, sub: "Followed you", dir: x > 0 ? 1 : 0 }; } },
  li_impressions: { platform: "linkedin", label: "Impressions", about: "times the LinkedIn posts were seen",
    get: ({ d, prev, pm }) => { const li = lim(d); return pctCard("Impressions", liImp(li), n((li.posts || {}).impressions != null ? li.posts.impressionsChange : li.impressionsChange), prev ? liImp(lim(prev)) : null, pm); } },
  li_reach: { platform: "linkedin", label: "Post reach", about: "different people who saw the LinkedIn posts",
    get: ({ d, prev, pm }) => pctCard("Post reach", n((lim(d).posts || {}).reach), n((lim(d).posts || {}).reachChange), prev ? n((lim(prev).posts || {}).reach) : null, pm) },
  li_engagement: { platform: "linkedin", label: "Engagement", about: "reactions and comments on the LinkedIn posts",
    get: ({ d, prev, pm }) => pctCard("Engagement", n((lim(d).posts || {}).engagement), n((lim(d).posts || {}).engagementChange), prev ? n((lim(prev).posts || {}).engagement) : null, pm) },
  li_engagementRate: { platform: "linkedin", label: "Engagement rate", about: "the share of people reached on LinkedIn who engaged",
    get: ({ d, prev, pm }) => { const c = n((lim(d).posts || {}).engagementRate); if (c == null) return null; const o = prev ? n((lim(prev).posts || {}).engagementRate) : null; const x = o == null ? null : c - o;
      return { label: "Engagement rate", value: `${pct2(c)}%`, sub: x == null ? "Of the people reached" : x ? `${x > 0 ? "Up" : "Down"} ${one(Math.abs(x))} points on ${pm}` : `Same as ${pm}`, dir: x == null ? 0 : Math.sign(x) }; } },
  li_videoViews: { platform: "linkedin", label: "Video views", about: "views of the LinkedIn videos",
    get: ({ d }) => { const v = lim(d).videos || {}, x = n(v.views); return x == null ? null : { label: "Video views", value: fmt(x), sub: n(v.published) ? `Across ${plural(n(v.published), "video", "videos")}` : "", dir: 0 }; } },
  li_published: { platform: "linkedin", label: "Posts published", about: "LinkedIn posts published",
    get: ({ d }) => { const x = n((lim(d).posts || {}).published); return x == null ? null : { label: "Posts published", value: fmt(x), sub: "On LinkedIn", dir: 0 }; } },
};
Object.values(HEADLINE_METRICS).forEach((m) => { m.platform = m.platform || "instagram"; });
Object.assign(HEADLINE_METRICS, MORE_METRICS);

// The four a month starts from: Instagram's for an Instagram account, the
// combined four when there are several platforms, the platform's own otherwise.
export function defaultHeadline(d) {
  const ps = platformsOf(d || {});
  if (ps.length > 1) return ["all_reach", "all_views", "all_engagement", "all_newFollowers"];
  if (ps[0] === "facebook") return ["fb_pageReach", "fb_postViews", "fb_engagement", "fb_newLikes"];
  if (ps[0] === "linkedin") return ["li_impressions", "li_reach", "li_engagement", "li_newFollowers"];
  return DEFAULT_HEADLINE;
}
/** The metrics a month can use, by platform: only its own platforms, and
 *  the combined ones when there's more than one. */
export function headlineOptions(d) {
  const ps = platformsOf(d || {});
  const want = new Set([...ps, ...(ps.length > 1 ? ["all"] : [])]);
  return Object.entries(HEADLINE_METRICS).filter(([, m]) => want.has(m.platform)).map(([key, m]) => ({ key, ...m }));
}

function pctCard(label, c, sp, o, pm) {
  if (c == null) return null;
  // SocialPilot's own change on the previous period wins: worked out from
  // exact figures, where ours would come from rounded ones ("2.5K").
  const x = sp ?? (o ? (c - o) / Math.abs(o) * 100 : null);
  return { label, value: fmt(c), sub: x == null ? "" : `${x >= 0 ? "Up" : "Down"} ${one(Math.abs(x))}%${pm ? ` on ${pm}` : ""}`, dir: x == null ? 0 : Math.sign(x) };
}

/** Four headline cards: the month's chosen keys, topped up from the defaults. */
export function headlineCards(keys, ctx, vis) {
  const want = [...(Array.isArray(keys) ? keys : []), ...defaultHeadline(ctx.d), ...DEFAULT_HEADLINE].filter((k, i, a) => HEADLINE_METRICS[k] && a.indexOf(k) === i);
  const out = [];
  for (const k of want) {
    if (vis && vis[k] === false) continue;
    const c = HEADLINE_METRICS[k].get(ctx);
    if (c) out.push({ key: k, platform: HEADLINE_METRICS[k].platform, ...c });
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
  return { category, headline, analysis, evidence, confidence: i.confidence === "emerging" ? "emerging" : "strong", platform: PLATFORM_LABELS[i.platform] ? i.platform : null };
}

/* Platforms (Danielle, 10 Oct 2026). A month's report can cover Instagram,
   Facebook and LinkedIn; every insight and next-month item says which one
   it's about ("all" for one that spans them). */
export const PLATFORM_LABELS = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", all: "All platforms" };

// A headline figure's label when the report covers several platforms: the
// platform leads it ("Instagram profile reach"), and a figure across all of
// them keeps its plain name ("New followers"), so no pill under each figure
// repeats the insights' pills (Danielle, 20 Oct 2026).
export function chipLabel(c, multi) {
  const p = c.platform || "instagram";
  return multi && p !== "all" && PLATFORM_LABELS[p] ? `${PLATFORM_LABELS[p]} ${c.label.charAt(0).toLowerCase()}${c.label.slice(1)}` : c.label;
}
/** The platforms a report's data covers, in report order. */
export function platformsOf(d) {
  d = d || {};
  return [
    (d.profile || d.posts || d.reels || (Array.isArray(d.content) && d.content.length)) ? "instagram" : null,
    d.facebook ? "facebook" : null,
    d.linkedin ? "linkedin" : null,
  ].filter(Boolean);
}
/** An item's platform, defaulting to the report's first (Instagram for older items). */
export function itemPlatform(item, d) {
  const p = item && item.platform;
  if (PLATFORM_LABELS[p]) return p;
  return platformsOf(d)[0] || "instagram";
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

/* The team's notes (What it means, Trends) as points (Danielle, 19 Oct 2026).
   Written as lines starting "- ", under a platform line ("Instagram:") when
   there's more than one platform. Returns blocks of { platform, points,
   prose }: points are the "- " lines; anything else (notes written before
   this, as paragraphs) is kept as prose, so old text still reads. */
export function pointBlocks(text) {
  const blocks = [];
  let cur = null;
  const open = (platform) => { cur = { platform, points: [], prose: [] }; blocks.push(cur); };
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const head = /^(instagram|facebook|linkedin)\s*:\s*(.*)$/i.exec(line);
    if (head) { open(head[1].toLowerCase()); if (head[2]) cur.prose.push(head[2]); continue; }
    if (!cur) open(null);
    const pt = /^[-•*]\s+(.*)$/.exec(line);
    if (pt) cur.points.push(pt[1]); else cur.prose.push(line);
  }
  return blocks.filter((b) => b.points.length || b.prose.length);
}
