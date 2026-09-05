// The Trending month — the shape of one month's "See what's working", and a
// sample month so the shell has something real-looking in it before Dani has
// written the first one. Admin → Insights → Trending month can start a month
// from this ("Load the sample") and overwrite every field.
//
// A topic reads top to bottom: the title, a fact strip (format · platform ·
// length · effort), then three short sections — What is it, Why it works, and
// the TMKE tip in the wine box — with one piece of media on the right that
// shows the thing being described. Two lines each is the aim.

export const TRENDING_FIELDS = [
  ["format",   "Format",   "e.g. Reel, Carousel, Story, Talking head"],
  ["platform", "Platform", "e.g. Instagram & TikTok"],
  ["length",   "Length",   "e.g. 12–18 seconds, 5 slides"],
  ["effort",   "Effort",   "Low · Medium · High"],
];

export const TRENDING_TOPIC_COUNT = 5;

export function emptyTopic() {
  return { title: "", format: "", platform: "", length: "", effort: "", what: "", about: "", tip: "", media_url: "", media_type: "image" };
}

export const TRENDING_SAMPLE = {
  month: "2026-09-01",
  status: "published",
  intro: "Five formats pulling reach for agents right now.",
  topics: [
    {
      title: "The 15-second walkthrough",
      format: "Reel", platform: "Instagram & TikTok", length: "12–18 seconds", effort: "Low",
      what: "One continuous shot, phone held steady, walking from the front door to the best room in the house. No music drop, no captions over the footage — the property is the point.",
      about: "Short walkthroughs are being finished far more often than 45-second tours, and a finished view is what the algorithm rewards. It also sets a rhythm your followers start to expect.",
      tip: "Film it at the photography appointment, while the house is already staged. Start on the door number so locals recognise the street before they read a word.",
      media_url: "https://assets.tmke.co.uk/living-1.webp", media_type: "image",
    },
    {
      title: "Sunday evening posting",
      format: "Any", platform: "Instagram & Facebook", length: "7–8pm, Sunday", effort: "Low",
      what: "Posting your strongest piece of the week between seven and eight on a Sunday evening, rather than on a weekday morning.",
      about: "That's when people plan the week ahead from the sofa, and browsing homes is part of it. Posts landing in that window reach more of your existing followers than the same post on a Tuesday.",
      tip: "Schedule the week's strongest listing for Sunday 7pm in the planner, then use Monday for the follow-up: 'the one everyone messaged about last night'.",
      media_url: "https://assets.tmke.co.uk/table.webp", media_type: "image",
    },
    {
      title: "The market minute",
      format: "Talking head", platform: "Instagram, Facebook & LinkedIn", length: "45–60 seconds", effort: "Medium",
      what: "You, to camera, with one number and what it means for someone thinking of moving locally. Not a market report — one fact, one implication, one line on what to do.",
      about: "Saves and shares are running well above listing content, because people forward these to whoever they're moving with. One number is easy to remember and easy to repeat.",
      tip: "Same spot, same framing every time so it becomes a series. Open with the number in the first two seconds and put it on screen as text.",
      media_url: "https://assets.tmke.co.uk/white-1.webp", media_type: "image",
    },
    {
      title: "Before and after",
      format: "Carousel", platform: "Instagram & Facebook", length: "4–6 slides", effort: "Medium",
      what: "A room as it was at the valuation, then as it looked on launch day. Staging, decluttering, a fresh coat of paint — the swipe does the storytelling.",
      about: "Carousels get a second showing to followers who didn't swipe the first time, which is why they're outperforming single images this month. And sellers see what you actually do.",
      tip: "Ask permission at the valuation and take the 'before' on your phone then and there. Slide one should be the after, so the feed shows the best version.",
      media_url: "https://assets.tmke.co.uk/kitchen-1.webp", media_type: "image",
    },
    {
      title: "Text-on-screen local facts",
      format: "Story or Reel", platform: "Instagram Stories", length: "3–5 frames", effort: "Low",
      what: "Plain footage of a street, a park or a high street with one line of text over it: the catchment, the walk to the station, the average time to sell on that road.",
      about: "It's the content people screenshot and send to partners, and it costs you a five-minute walk. Every frame is a small proof that you know the patch.",
      tip: "Use the Studio's story templates so the text sits in your brand fonts, and keep to one fact per frame — the tap-through is the engagement.",
      media_url: "https://assets.tmke.co.uk/orange-1.webp", media_type: "image",
    },
  ],
};

/** "September 2026" from a YYYY-MM-DD month value. */
export function monthLabel(month) {
  const d = new Date(String(month || "").slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}
