// UK content calendar — dated hooks with an estate agency angle.
//
// This exists so a member who opens the hub on a quiet week is never looking at
// a blank page. It is deliberately plain data, checked into the repo, so nobody
// has to remember to load next month's dates: the year rolls over and the same
// list serves again.
//
// The `angle` is the point of the whole file. "National Pet Day" is not a post
// an estate agent can make. "What buyers with dogs actually look for" is. Every
// entry has to survive that test or it does not belong here.
//
// Dates are either fixed (`on: "MM-DD"`) or an nth-weekday rule
// (`nth: { month, weekday, n }`, weekday 0=Sun). Anything that needs Easter to
// resolve is deliberately absent — a wrong date is worse than a missing one.

export const CONTENT_DAYS = [
  {
    on: "01-01", name: "New Year's Day",
    angle: "The three things to sort now if you're selling this year",
    hint: "Straight to camera. One thing per point, thirty seconds total.",
  },
  {
    on: "01-25", name: "Burns Night",
    angle: "Homes built for a long dinner with friends",
    hint: "Kitchen and dining shots only. Warm lamps on, overheads off.",
  },
  {
    on: "02-14", name: "Valentine's Day",
    angle: "The homes we fell in love with this year",
    hint: "Three listings, one detail each. Say what made you look twice.",
  },
  {
    on: "03-01", name: "St David's Day",
    angle: "What makes a house feel like it belongs where it stands",
    hint: "Exterior shots. Show the street, not just the front door.",
  },
  {
    on: "03-08", name: "International Women's Day",
    angle: "The women who built this agency — and what they'd tell a first-time seller",
    hint: "Let them speak to camera themselves. No script.",
  },
  {
    on: "04-11", name: "National Pet Day",
    angle: "What buyers with dogs actually look for in a home",
    hint: "Garden gates, hard floors, boot rooms. Film them, don't list them.",
  },
  {
    on: "04-22", name: "Earth Day",
    angle: "The efficiency upgrades that actually move an EPC rating",
    hint: "Use a real certificate. Before and after, on screen.",
  },
  {
    on: "04-23", name: "St George's Day",
    angle: "Period features worth keeping — and what they add",
    hint: "Close-ups: cornicing, fireplaces, sash windows. Hold each shot.",
  },
  {
    on: "05-01", name: "May Day",
    angle: "Getting a garden viewing-ready before the bank holiday",
    hint: "Film the jobs being done, not a list of them.",
  },
  {
    on: "06-05", name: "World Environment Day",
    angle: "Homes that cost less to run — and how you spot one",
    hint: "One property, three features, real numbers if you have them.",
  },
  {
    on: "08-19", name: "World Photography Day",
    angle: "The difference good photography makes to a sale price",
    hint: "Your own before and after. Phone shot beside the professional one.",
  },
  {
    on: "09-01", name: "Back to school",
    angle: "Buying for the catchment — what parents ask us first",
    hint: "Talk to camera outside the school gates, not in the office.",
  },
  {
    on: "10-10", name: "World Mental Health Day",
    angle: "Moving is stressful — the five things we take off your plate",
    hint: "Honest and unpolished. One take beats five.",
  },
  {
    on: "10-31", name: "Halloween",
    angle: "The listing photo mistakes that genuinely scare buyers off",
    hint: "Show real examples, anonymised. Light-hearted, not cruel.",
  },
  {
    on: "11-05", name: "Bonfire Night",
    angle: "Gardens made for autumn evenings",
    hint: "Shoot at dusk. Outside lights on, one wide and one close.",
  },
  {
    on: "11-30", name: "St Andrew's Day",
    angle: "Why winter viewings tell you more about a house than summer ones",
    hint: "Film on a grey day on purpose. Heating, light, draughts.",
  },
  {
    on: "12-01", name: "First of December",
    angle: "Should you list before Christmas or wait for January?",
    hint: "Give a real answer with a reason. Thirty seconds.",
  },
  {
    on: "12-31", name: "New Year's Eve",
    angle: "What the local market actually did this year",
    hint: "Three numbers you can stand behind. Say where they came from.",
  },
  {
    // World Book Day (UK) — first Thursday of March.
    nth: { month: 3, weekday: 4, n: 1 }, name: "World Book Day",
    angle: "Reading corners: the small spaces that sell a family home",
    hint: "Find the nook in your current listings. One shot each.",
  },
];

// Resolve an entry to a Date in a given year.
function resolve(entry, year) {
  if (entry.on) {
    const [m, d] = entry.on.split("-").map(Number);
    return new Date(year, m - 1, d);
  }
  const { month, weekday, n } = entry.nth;
  const first = new Date(year, month - 1, 1);
  const shift = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month - 1, 1 + shift + (n - 1) * 7);
}

/**
 * The next `count` dated hooks on or after `from`, rolling into next year so
 * late December never comes back empty.
 */
export function upcomingDays(from = new Date(), count = 2) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const year = start.getFullYear();
  const dated = [];
  for (const y of [year, year + 1]) {
    for (const entry of CONTENT_DAYS) {
      const when = resolve(entry, y);
      if (when >= start) dated.push({ ...entry, when });
    }
  }
  dated.sort((a, b) => a.when - b.when);
  return dated.slice(0, count);
}
