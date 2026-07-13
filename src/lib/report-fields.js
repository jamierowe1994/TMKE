// Canonical registry of every field/section in the monthly SMM report that a
// super-admin (James / Danny) can show or hide in the CLIENT-facing view on
// /account/social. This is the backbone for Phase C:
//   1. the super-admin visibility settings UI reads these groups to draw toggles;
//   2. the client-facing report render checks a { [key]: boolean } map before
//      drawing each field/section.
//
// `client` is the sensible default for a client-facing report — super-admins
// can tune any of it. Internal/granular metrics (link taps, ad spend/CPC,
// exact country counts) default OFF; the clear, encouraging metrics default ON.

export const REPORT_FIELD_GROUPS = [
  {
    tab: "overview", label: "Overview",
    fields: [
      { key: "followers",         label: "Total followers",              client: true },
      { key: "newFollowers",      label: "New followers this month",     client: true },
      { key: "reach",             label: "Total reach",                  client: true },
      { key: "views",             label: "Total views",                  client: true },
      { key: "interactions",      label: "Interactions",                 client: true },
      { key: "interactionRate",   label: "Interaction rate",             client: true },
      { key: "linkTaps",          label: "Link taps",                    client: false },
      { key: "reachByFormat",     label: "Reach by format (Reels / Posts / Stories / Ads)", client: true },
      { key: "followerSplit",     label: "Follower vs non-follower reach", client: true },
      { key: "ukFollowers",       label: "UK followers",                 client: false },
      { key: "organicPaidReach",  label: "Organic vs paid reach split",  client: true },
    ],
  },
  {
    tab: "content", label: "Content",
    fields: [
      { key: "organicContent",         label: "Organic content (Reels & Posts breakdown)", client: true },
      { key: "paidContent",            label: "Paid advertising (Ads breakdown)",          client: false },
      { key: "organicPaidInteractions",label: "Organic vs paid interactions",              client: false },
      { key: "topContent",             label: "Top performing content",                    client: true },
      { key: "hashtags",               label: "Hashtag performance",                       client: true },
    ],
  },
  {
    tab: "audience", label: "Audience",
    fields: [
      { key: "peakTimes",       label: "Best posting times (heatmap)",   client: true },
      { key: "postingWindows",  label: "Best days & posting windows",    client: true },
      { key: "gender",          label: "Gender split",                   client: true },
      { key: "cities",          label: "Top cities",                     client: true },
      { key: "countries",       label: "Followers by country",           client: false },
    ],
  },
  {
    tab: "actions", label: "Recommendations",
    fields: [
      { key: "priorities",      label: "Next-month priorities",          client: true },
      { key: "comingSoon",      label: "Coming-soon content",            client: true },
    ],
  },
  {
    tab: "trends", label: "Trends",
    fields: [
      { key: "trends",          label: "Month-on-month trends",          client: true },
    ],
  },
  {
    tab: "summary", label: "Summary",
    fields: [
      { key: "summary",         label: "Written summary",                client: true },
    ],
  },
];

export const REPORT_FIELD_KEYS = REPORT_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

// The out-of-the-box client-facing defaults (used until a super-admin saves).
export function defaultClientVisibility() {
  const out = {};
  REPORT_FIELD_GROUPS.forEach((g) => g.fields.forEach((f) => { out[f.key] = f.client; }));
  return out;
}

// Merge a saved settings map over the defaults (unknown/missing keys fall back).
export function resolveVisibility(saved) {
  const base = defaultClientVisibility();
  if (saved && typeof saved === "object") {
    for (const k of REPORT_FIELD_KEYS) if (typeof saved[k] === "boolean") base[k] = saved[k];
  }
  return base;
}
