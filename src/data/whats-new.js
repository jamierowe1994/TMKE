// What's new in the Member Hub - the dashboard's "What's new" card opens these
// in the same step-through pop-out as the Trending month (StudioInspo, view
// "news"). Newest first; only the latest WHATS_NEW_COUNT are shown, so adding
// one at the top quietly retires the oldest.
//
// When Dani says "add this to What's New", an entry goes at the TOP of this
// list. Each one says where the thing is and what to do with it, in the hub's
// plain voice:
//
//   date   when it went live (YYYY-MM-DD)
//   title  what you can now do, not what we built
//   area   the part of the hub it's in
//   where  the clicks to reach it
//   what   what it is, in two sentences at most
//   why    what it saves or makes possible
//   tip    one practical pointer (the wine box)
//   link   { href, label } - where the button goes
//   media  1080 x 1350 (4:5) image; the dashboard card uses the first entry's

export const WHATS_NEW_COUNT = 5;

export const WHATS_NEW = [
  {
    date: "2026-09-21",
    title: "See what shows before you post",
    area: "Studio",
    where: "Studio → Guides → Safe zones",
    what: "Safe zones now show you where your design gets cut off. IG grid outlines the part that appears on your Instagram profile grid, which shows every post as a 3:4 crop. Story and Reel shade the areas Instagram covers with its own name, buttons and caption.",
    why: "A headline that looks perfect in the Studio can lose its top line on your grid, or sit under the reply bar on a story. Checking before you save means what you designed is what your followers actually see.",
    tip: "Designing a reel or story cover? Turn on IG grid and keep the title and your face inside the green outline, then switch to Story or Reel to check nothing important sits in the red.",
    link: { href: "/account/editor", label: "Open the Studio" },
    media: "/images/learn/hub/areas/studio-v2.jpg",
  },
  {
    date: "2026-09-21",
    title: "Your contact details, on any design",
    area: "Brand kit & Studio",
    where: "Brand kit → Company and About you, then Studio → Elements",
    what: "Your brand kit now asks for a little more: your website under Company, and your name, job title, phone number, email and headshot under About you. Those details now power contact footers, a strip you can drop onto any design from Elements, filled in for you.",
    why: "Every post can say who it's from and how to reach you, without typing it out each time. Update your brand kit once and every footer you add from then on is already right.",
    tip: "Haven't looked at your brand kit lately? Open it and fill in the new fields first. A footer fills in whatever is there and leaves out what isn't.",
    link: { href: "/account/profile", label: "Update your brand kit" },
    media: "/images/learn/hub/areas/brand-kit-v4.jpg",
  },
  {
    date: "2026-09-21",
    title: "Start again from your template",
    area: "Studio",
    where: "Studio → Start → Reset to the original template",
    what: "Any design that began as one of our templates can now go back to the original in one click, even one you saved weeks ago. It comes back with your brand kit filled in, just as it did the first time you opened it.",
    why: "If an edit goes wrong or a design has drifted too far, you have a clean start straight away instead of hunting through your packs for the template again.",
    tip: "Reset can be undone, so it's safe to try. Press undo straight after and your changes come back.",
    link: { href: "/account/editor", label: "Open the Studio" },
    media: "/images/learn/hub/areas/studio-v4.jpg",
  },
  {
    date: "2026-09-16",
    title: "Two training courses, rewritten",
    area: "Learn",
    where: "Learn → Your Brand Kit and Your First Design",
    what: "Your Brand Kit and Your First Design have been rewritten from start to finish. Each part now explains why before it shows how, and the Show me walkthroughs open a real template beside the lesson, so you practise on the real thing without leaving the course.",
    why: "Your brand kit and your first design are the two things that make everything else in the hub work. Getting both right early means every template after that opens already looking like yours.",
    tip: "Start with Your Brand Kit. Everything Your First Design shows you fills in from it.",
    link: { href: "/account/guides", label: "Go to Learn" },
    media: "/images/learn/hub/areas/learn-v4.jpg",
  },
  {
    date: "2026-09-10",
    title: "Three free templates to try",
    area: "Studio",
    where: "Studio → your packs → Demo pack",
    what: "Every member now has a free Demo pack in the Studio with three ready-made templates: New to Market, a client testimonial and an autumn post. They sit with your other packs and open like any template, with your brand kit filled in.",
    why: "You can try the Studio properly on real, finished designs before you buy a pack, and post them as your own when they're done.",
    tip: "Open New to Market first. It shows how a listing post takes your photo, your colours and your logo.",
    link: { href: "/account/studio", label: "Go to the Studio" },
    media: "/images/learn/hub/areas/start-design-v4.jpg",
  },
];

export const whatsNewLatest = () => WHATS_NEW.slice(0, WHATS_NEW_COUNT);
