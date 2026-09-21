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
    title: "Check how it looks on your grid",
    area: "Studio",
    where: "Studio → Guides → Safe zones → IG grid",
    what: "Your Instagram profile grid shows every post as a 3:4 crop. IG grid shades the part of your design that won't show there.",
    why: "A story cover or a square post can lose its headline on your grid. Now you can see it before you post.",
    tip: "Designing a reel or story cover? Keep the title and your face inside the green outline.",
    link: { href: "/account/editor", label: "Open the Studio" },
    media: "/images/learn/hub/areas/studio-v2.jpg",
  },
  {
    date: "2026-09-21",
    title: "Your contact details, on any design",
    area: "Studio & brand kit",
    where: "Studio → Elements → Your contact details",
    what: "Pick a contact footer and your name, photo, phone number and email drop onto your design, filled in from your brand kit.",
    why: "Every post can say who it's from and how to reach you, without typing it all out again.",
    tip: "Add your website and headshot to your brand kit first. A footer fills in whatever is there and leaves out what isn't.",
    link: { href: "/account/editor", label: "Open the Studio" },
    media: "/images/learn/hub/areas/brand-kit-v4.jpg",
  },
  {
    date: "2026-09-21",
    title: "Design for print",
    area: "Studio",
    where: "Studio → New design → Print",
    what: "A4, A5, business cards and A6 postcards, each with the 3mm bleed printers ask for already built in.",
    why: "Flyers, window cards and business cards can come from the same place as your posts, in your own brand.",
    tip: "Turn on Print under Guides → Safe zones to see where the printer trims, and keep your words inside the line.",
    link: { href: "/account/editor", label: "Open the Studio" },
    media: "/images/learn/hub/areas/start-design-v4.jpg",
  },
  {
    date: "2026-09-21",
    title: "Start again from the template",
    area: "Studio",
    where: "Studio → Start → Reset to the original template",
    what: "Any design that began as one of our templates can go back to the original, even one you saved weeks ago.",
    why: "If an edit goes wrong, you're one click from a clean start instead of hunting for the template again.",
    tip: "Reset can be undone, so it's safe to try.",
    link: { href: "/account/editor", label: "Open the Studio" },
    media: "/images/learn/hub/areas/studio-v4.jpg",
  },
  {
    date: "2026-09-19",
    title: "Resize without starting over",
    area: "Studio",
    where: "Studio → Resize",
    what: "Change a post to a square or a story and your design is rearranged to fit, on every page at once.",
    why: "One design becomes your post and your story, instead of two designs built from scratch.",
    tip: "Try sizes freely: nothing saves until you choose. Save as a copy keeps the post and the story side by side.",
    link: { href: "/account/editor", label: "Open the Studio" },
    media: "/images/learn/hub/areas/studio-v3.jpg",
  },
  {
    date: "2026-09-19",
    title: "See what Instagram covers",
    area: "Studio",
    where: "Studio → Guides → Safe zones",
    what: "Story and Reel overlays show where Instagram puts your name, its buttons and your caption.",
    why: "Nothing important ends up hidden behind the app once it's posted.",
    tip: "Check it before you save a story, and keep your key words and face in the clear area.",
    link: { href: "/account/editor", label: "Open the Studio" },
    media: "/images/learn/hub/areas/start-design-v3.jpg",
  },
];

export const whatsNewLatest = () => WHATS_NEW.slice(0, WHATS_NEW_COUNT);
