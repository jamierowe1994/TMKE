// Meet the TMKE team (Dani, 17 Oct 2026) -- the Community's chapter of three
// cards, each opening a pop-out: the website's bio (src/pages/about.astro),
// then 20 questions, "a little bit funner".
//
// THE ANSWERS ARE YOURS TO WRITE. A question with no answer doesn't show, and
// the 20 questions part only appears once someone has at least one answered,
// so nothing goes out half-filled. Change the questions freely; each person
// can have their own.

const Q = [
  "Coffee order?",
  "First job ever?",
  "Favourite property you've ever seen?",
  "Dream house in three words?",
  "Go-to karaoke song?",
  "The app you open most?",
  "Best marketing campaign of all time?",
  "Morning person or night owl?",
  "Most-used emoji?",
  "Favourite book?",
  "The one thing on your desk you can't work without?",
  "Biggest pet peeve on a property listing?",
  "Your hidden talent?",
  "Last thing you bought that made you happy?",
  "Favourite place in the UK?",
  "Instagram or TikTok?",
  "The best advice you've ever been given?",
  "What would you do if you weren't in marketing?",
  "Sweet or savoury?",
  "Describe TMKE in three words.",
];
const blank = () => Q.map((q) => ({ q, a: "" }));

export const TEAM = [
  {
    key: "samantha",
    name: "Samantha Thornicroft",
    short: "Sam",
    role: "Managing Director",
    photo: "https://assets.tmke.co.uk/TMKE%20About%20Us/Samantha%20-%20About%20Us.png",
    bio: "Samantha founded TMKE on a simple belief: estate agents deserve marketing as polished as the homes they sell. She sets the standard and steers the strategy, so every client feels like the only one on the books.",
    questions: blank(),
  },
  {
    key: "danni",
    name: "Danni Law",
    short: "Danni",
    role: "Operations Manager",
    photo: "https://assets.tmke.co.uk/TMKE%20About%20Us/Danni%20-%20About%20Us.png",
    bio: "Danni keeps TMKE running like clockwork — part planner, part problem-solver, she turns ambitious ideas into work that actually ships, on time and on brand. Whatever you need, she's already three steps ahead.",
    questions: blank(),
  },
  {
    key: "abigail",
    name: "Abigail Saunders",
    short: "Abigail",
    role: "Social Media Manager",
    photo: "https://assets.tmke.co.uk/TMKE%20About%20Us/Abbie%20-%20About%20Us.png",
    bio: "Abigail lives where the scroll happens — turning listings into content that actually stops the thumb. Reels, captions, the lot: if it's on your feed and it's working, chances are it's hers.",
    questions: blank(),
  },
];

// TMKE's own socials, for the chapter's Explore links. Only the ones with a
// link show. (The website's footer icons point nowhere yet either.)
export const TMKE_SOCIALS = [
  { label: "Instagram", href: "" },
  { label: "Facebook", href: "" },
  { label: "LinkedIn", href: "" },
  { label: "TikTok", href: "" },
  { label: "YouTube", href: "" },
];
