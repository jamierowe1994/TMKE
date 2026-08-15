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
  // ---------------------------------------------------------------------
  // September to December, supplied by James. `brief` is his wording, kept
  // verbatim — it is what the member reads. `angle` is the short hook the
  // card shows, drawn from the brief rather than invented alongside it.
  // ---------------------------------------------------------------------
  {
    on: "09-01", name: "Back to School",
    angle: "What the return to routine teaches you about your space",
    brief: "Share how the return to routine can often make people rethink their home. Ask your audience what they've learnt about their space over the summer and pair it with a photo of your workspace, local school or a family-friendly home.",
  },
  {
    on: "09-05", name: "International Day of Charity",
    angle: "A local cause worth knowing about",
    brief: "Shine a light on a local charity, fundraiser or community cause that's close to your heart. Share why it matters to you and encourage your audience to get involved or support them.",
  },
  {
    on: "09-06", name: "Read a Book Day",
    angle: "The book you'd actually recommend",
    brief: "Recommend a book you've enjoyed, whether it's business, mindset, property or fiction. A simple photo of the book with a few words about why you'd recommend it works perfectly.",
  },
  {
    on: "09-11", name: "Make Your Bed Day",
    angle: "The small routines behind a productive day",
    brief: "Talk about the little routines that help you have a productive day. Keep it personal and share a photo of your morning coffee, workspace or something that helps you start the day well.",
  },
  {
    on: "09-13", name: "Positive Thinking Day",
    angle: "The outlook that carries you through the job",
    brief: "Share a positive mindset that's helped you in business or life. Keep it authentic and explain how that outlook helps you support your clients every day.",
  },
  {
    on: "09-21", name: "Recycle Day",
    angle: "Giving something in the home a second life",
    brief: "Highlight a simple way to live more sustainably, whether that's recycling, upcycling furniture or giving household items a second life. A before-and-after or home inspiration post works well.",
  },
  {
    on: "09-23", name: "Autumn Equinox",
    angle: "What you love most about the season turning",
    brief: "Mark the first day of autumn by sharing what you love most about the season. Think cosy homes, autumn walks, local scenery or your favourite seasonal traditions.",
  },
  {
    // Macmillan set this each year; it has landed on the last Friday of
    // September. Confirm against their date before the week itself.
    nth: { month: 9, weekday: 5, n: -1 }, name: "World's Biggest Coffee Morning",
    angle: "Back a Coffee Morning near you",
    brief: "Support Macmillan by promoting a local Coffee Morning or encouraging your audience to get involved. If you're attending one yourself, share a photo and tag the organisers.",
  },
  {
    on: "09-27", name: "World Tourism Day",
    angle: "The one place every local should visit",
    brief: "Recommend one place every local should visit, whether it's a landmark, cafe, beach, walk or hidden gem. Share a photo and explain why it's worth a visit.",
  },
  {
    on: "09-30", name: "World Podcast Day",
    angle: "What you have been listening to",
    brief: "Recommend a podcast you've enjoyed recently, whether it's business, property or something completely different. Tell people why you like it and invite them to share their own recommendations.",
  },
  {
    on: "10-01", name: "Black History Month",
    angle: "A local story worth telling",
    brief: "Celebrate a local person, place or story that has contributed to your community's history. Keep it respectful, informative and relevant to your local area.",
  },
  {
    on: "10-02", name: "World Smile Day",
    angle: "The moment that made you smile this week",
    brief: "Share something that's made you smile recently, whether it's a client moment, a key handover or something that happened in your community. A genuine story will always outperform a generic quote.",
  },
  {
    // UK Grandparents' Day — first Sunday of October.
    nth: { month: 10, weekday: 0, n: 1 }, name: "Grandparents' Day",
    angle: "The advice you got from someone older and wiser",
    brief: "Share a memory, lesson or piece of advice you've learnt from a grandparent or older family member. A personal photo works well if you're comfortable sharing one.",
  },
  {
    on: "10-10", name: "World Mental Health Day",
    angle: "How you actually switch off",
    brief: "Talk honestly about looking after your wellbeing. Share a habit, routine or place that helps you switch off and encourage others to do the same.",
  },
  {
    on: "10-12", name: "Coffee Week",
    angle: "Your local, and your usual order",
    brief: "Give a shout-out to your favourite local coffee shop or cafe. Share what you always order and encourage your audience to support local businesses.",
  },
  {
    // Last Sunday of October.
    nth: { month: 10, weekday: 0, n: -1 }, name: "Clocks Go Back",
    angle: "Making a home feel warm when the evenings draw in",
    brief: "Mark the arrival of darker evenings with autumn home inspiration. Share simple ways to make your home feel warm, cosy and inviting during the colder months.",
  },
  {
    on: "10-26", name: "Pumpkin Day",
    angle: "Your pumpkin, or the patch you found it at",
    brief: "Show off your pumpkin carving, favourite autumn decoration or a local pumpkin patch. Keep it light-hearted and seasonal.",
  },
  {
    on: "10-31", name: "Halloween",
    angle: "Join in without trying too hard",
    brief: "Join in with Halloween by sharing a decorated office, carved pumpkin or a fun community event. If appropriate, ask your audience to vote for their favourite costume or pumpkin.",
  },
  {
    on: "11-01", name: "Movember",
    angle: "Why men's health is worth a month",
    brief: "If you're taking part, share why you're supporting Movember and the importance of men's health. If not, help raise awareness by sharing where people can find out more.",
  },
  {
    on: "11-05", name: "Bonfire Night",
    angle: "Where to watch, and a word about pets",
    brief: "Share your favourite local fireworks display or Bonfire Night event. If you have pets, include a reminder about keeping them safe during fireworks.",
  },
  {
    // Second Sunday of November.
    nth: { month: 11, weekday: 0, n: 2 }, name: "Remembrance Sunday",
    angle: "A simple message of remembrance",
    brief: "Mark the day respectfully with a simple message of remembrance. Keep the focus on reflection rather than promotion.",
  },
  {
    on: "11-11", name: "Armistice Day",
    angle: "Observe the silence",
    brief: "Observe the two-minute silence and share a respectful message recognising those who served. Avoid promotional content alongside this post.",
  },
  {
    on: "11-13", name: "World Kindness Day",
    angle: "A small kindness worth passing on",
    brief: "Share a small act of kindness you've experienced or encourage your audience to support someone in their local community. Simple stories often resonate the most.",
  },
  {
    on: "11-19", name: "International Men's Day",
    angle: "The men who taught you something",
    brief: "Celebrate positive male role models, whether that's a family member, colleague or friend. Share what you've learnt from them or why you appreciate them.",
  },
  {
    // Friday after the fourth Thursday of November.
    nth: { month: 11, weekday: 4, n: 4, offset: 1 }, name: "Black Friday",
    angle: "Independents worth your money this week",
    brief: "Instead of focusing on discounts, share your favourite local independent businesses that deserve support during the busy shopping season.",
  },
  {
    // The Saturday after Black Friday.
    nth: { month: 11, weekday: 4, n: 4, offset: 2 }, name: "Small Business Saturday",
    angle: "The independent you would send a friend to",
    brief: "Shine a light on an independent business you love. Share why you'd recommend them and encourage your audience to shop local where they can.",
  },
  {
    on: "11-30", name: "St Andrew's Day",
    angle: "What makes your patch worth living in",
    brief: "If you're based in Scotland, celebrate what makes your local area special. If not, share your favourite Scottish destination, memory or tradition.",
  },
  {
    on: "12-01", name: "First Day of Advent",
    angle: "The one thing you are looking forward to",
    brief: "Mark the countdown to Christmas by sharing one thing you're looking forward to this festive season. A festive workspace or local decoration makes a great visual.",
  },
  {
    on: "12-05", name: "International Volunteer Day",
    angle: "The volunteers who hold your area together",
    brief: "Recognise the volunteers who make a difference in your local community or share a cause you've supported yourself.",
  },
  {
    on: "12-09", name: "Christmas Card Day",
    angle: "Cards, and the people who make them",
    brief: "Share a photo of your Christmas cards, your team's festive setup or encourage people to support local card makers this Christmas.",
  },
  {
    on: "12-10", name: "Christmas Jumper Day",
    angle: "Wear the jumper, ask for theirs",
    brief: "Join in by wearing your favourite Christmas jumper and encourage your audience to do the same. If you're fundraising, let people know how they can support you.",
  },
  {
    on: "12-21", name: "First Day of Winter",
    angle: "A cosy home, or a frosty morning",
    brief: "Celebrate the start of winter with a cosy home, frosty morning or beautiful local landscape. Ask your audience what they love most about the season.",
  },
  {
    on: "12-24", name: "Christmas Eve",
    angle: "Thank the people who made the year",
    brief: "Share a warm festive message thanking your clients, followers and local community for their support throughout the year.",
  },
  {
    on: "12-25", name: "Christmas Day",
    angle: "Merry Christmas, and nothing else",
    brief: "Wish everyone a Merry Christmas with a simple, heartfelt message. Keep the focus on spending time with loved ones and enjoying the day.",
  },
  {
    on: "12-26", name: "Boxing Day",
    angle: "Walk, leftovers, or the sofa?",
    brief: "Ask your audience how they're spending Boxing Day, whether it's a walk, leftovers or a day on the sofa. Keep it relaxed and conversational.",
  },
  {
    on: "12-31", name: "New Year's Eve",
    angle: "The year in one highlight and one lesson",
    brief: "Reflect on the year, share a highlight or lesson you've learnt and thank your clients and community for their support. End by wishing everyone a happy New Year.",
  },
  {
    // World Book Day (UK) — first Thursday of March.
    nth: { month: 3, weekday: 4, n: 1 }, name: "World Book Day",
    angle: "Reading corners: the small spaces that sell a family home",
    hint: "Find the nook in your current listings. One shot each.",
  },
];

// Resolve an entry to a Date in a given year.
//
//   on:  "MM-DD"                       a genuinely fixed date
//   nth: { month, weekday, n }         nth weekday of a month; n: -1 means last
//        { ..., offset: 1 }            that many days after it
//
// The rules exist because several observances move: Remembrance Sunday is the
// second Sunday of November, the clocks go back on the last Sunday of October,
// and Black Friday is the day after the fourth Thursday. Pinning those to the
// date they happen to fall on this year would be wrong from next year on.
function resolve(entry, year) {
  if (entry.on) {
    const [m, d] = entry.on.split("-").map(Number);
    return new Date(year, m - 1, d);
  }
  const { month, weekday, n, offset = 0 } = entry.nth;
  let day;
  if (n === -1) {
    const last = new Date(year, month, 0);            // last day of the month
    day = last.getDate() - ((last.getDay() - weekday + 7) % 7);
  } else {
    const first = new Date(year, month - 1, 1);
    day = 1 + ((weekday - first.getDay() + 7) % 7) + (n - 1) * 7;
  }
  return new Date(year, month - 1, day + offset);
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

// Evergreen prompts — the daily idea on the dashboard, and the fallback when a
// quiet day has no dated occasion of its own. Same shape as the dated hooks:
// something to say, and a line on how to actually shoot it.
//
// Lives here rather than in the page because two separate <script> blocks need
// it, and an Astro script block is its own module scope.
export const EVERGREEN_PROMPTS = [
    ["Three questions every buyer asks during a viewing — and how you answer them.", "Talk straight to camera. One question per line on screen."],
    ["The one room that sells the home. Show buyers why.", "Slow pan of the room, then a close-up of the detail that does the work."],
    ["What a little styling actually adds to a sale price.", "Before and after on the same shot. Hold each for two seconds."],
    ["A 60-second tour of your favourite listing this week.", "Walk it in one take. Start outside the front door."],
    ["Five things buyers notice in the first ten seconds of a viewing.", "Five quick cuts, one per point. Caption each on screen."],
    ["Behind the scenes: how we shoot a property that sells.", "Film yourself setting up. Off-the-cuff beats scripted here."],
    ["Sell the lifestyle, not just the house — the cafe, the school, the park.", "Three clips from the street, none of them inside the property."],
    ["Just listed: tease it before the portal goes live.", "One detail shot only. Give nothing else away."],
    ["A day in the life of an agent who actually answers the phone.", "Film four moments across one day. Keep them short."],
    ["Why the right asking price sells faster than the highest one.", "Straight to camera, thirty seconds. Use a real example, no names."],
    ["Myth vs fact: what really adds value before you sell.", "Split the screen. Myth on the left, fact on the right."],
    ["Client win of the week — let the result do the talking.", "Photo of the sold board, and their words as the caption."],
    ["Your honest take on the local market this month, in 30 seconds.", "One take, no notes. Film it in the car if that is where you are."],
    ["First-time buyer? The one thing to sort before you offer.", "Direct address. Say the one thing in the first three seconds."],
    ["Sold fast — the story behind the result.", "Three beats: what it was, what you changed, what it sold for."],
    ["Three quick wins to get a home viewing-ready this weekend.", "Film each one being done, not described."],
  ];

// ---------------------------------------------------------------------------
// Naming a prompt in a URL.
//
// The dashboard sends a key, not the text: /account/editor?blank=1&prompt=<key>
// keeps the wording in one place, so editing a brief here changes what the
// editor shows without touching a link.
//
//   a dated day   the slug of its name    "back-to-school"
//   an evergreen  its position            "ev-3"
// ---------------------------------------------------------------------------

export function slugOf(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function keyForDay(day) {
  return slugOf(day && day.name);
}

export function keyForEvergreen(index) {
  return "ev-" + index;
}

/**
 * The prompt behind a key, or null. Returns one shape whichever list it came
 * from: what to say, and the guidance that goes with it.
 */
export function findPrompt(key) {
  if (!key) return null;
  const ev = /^ev-(\d+)$/.exec(key);
  if (ev) {
    const pair = EVERGREEN_PROMPTS[Number(ev[1])];
    return pair ? { name: "Today's prompt", angle: pair[0], brief: pair[1] } : null;
  }
  const day = CONTENT_DAYS.find((d) => slugOf(d.name) === key);
  return day ? { name: day.name, angle: day.angle, brief: day.brief || day.hint || "" } : null;
}
