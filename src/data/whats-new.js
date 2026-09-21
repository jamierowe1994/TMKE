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
    title: "Preview Before You Post",
    area: "Studio",
    where: "Studio → Guides → Safe zones",
    what: "New preview guides in the Studio show you which parts of your design will be visible across Instagram. Check how a post or Reel cover will crop on your profile grid, or switch to Story and Reel views to see where Instagram’s interface could cover your content.",
    why: "You can check your layout before you download, keeping important text, logos and faces where people will actually see them.",
    tip: "Check every format you plan to use. A design that works perfectly on your grid might need adjusting before you share it to Stories.",
    link: { href: "/account/editor", label: "Open the Studio" },
    media: "/images/learn/hub/areas/studio-v2.jpg",
  },
  {
    date: "2026-09-21",
    title: "Add Your Contact Details in One Click",
    area: "Brand Kit & Studio",
    where: "Brand Kit → About you, then Studio → Elements",
    what: "Your Brand Kit now stores your name, job title, telephone number, email and headshot. In the Studio, you can use these details to add ready-made contact footers to your designs, already formatted and filled in with your information.",
    why: "Add a professional call to action to carousel end slides and other content without rebuilding your contact details every time.",
    tip: "Complete all of your contact fields and add a headshot first. Your contact footers will then be ready whenever you need them.",
    link: { href: "/account/profile", label: "Update your Brand Kit" },
    media: "/images/learn/hub/areas/brand-kit-v4.jpg",
  },
  {
    date: "2026-09-21",
    title: "Reset Any Template in One Click",
    area: "Studio",
    where: "Studio → Start → Reset to the original template",
    what: "Taken an edit too far? Designs created from one of our templates can now be reset to the original from the Start menu. Your Brand Kit will still be applied, giving you a clean version of the template without having to find it and start again.",
    why: "Experiment as much as you like. If it doesn't work, you can get back to your original starting point without abandoning the design.",
    tip: "Changed your mind after resetting? Use Undo straight afterwards and your previous changes will come back.",
    link: { href: "/account/editor", label: "Open the Studio" },
    media: "/images/learn/hub/areas/studio-v4.jpg",
  },
  {
    date: "2026-09-16",
    title: "Getting Started Just Got Easier",
    area: "Learn",
    where: "Learn → Getting Started",
    what: "There's a new four-part Getting Started series in Learn, covering the essentials of using your Member Hub. Get familiar with the Hub, build your Brand Kit, edit your first template and learn how to start planning your content.",
    why: "Follow a clear route through the basics, with practical guidance and interactive walkthroughs that let you learn while using the Hub itself.",
    tip: "Start with Getting Around Your Hub and work through the four courses in order. Each one builds on what you've already set up.",
    link: { href: "/account/guides", label: "Go to Learn" },
    media: "/images/learn/hub/areas/learn-v4.jpg",
  },
  {
    date: "2026-09-10",
    title: "Your First Three Templates Are Free",
    area: "Studio",
    where: "Studio → Demo Pack",
    what: "Every Member now has three free templates inside their Studio, whether you've purchased a content pack or not. Find them in your Demo Pack, customise them with your own branding and content, then download and use them like any other template.",
    why: "Try the Studio properly on finished designs, learn how template editing works and create content you can actually use when you're done.",
    tip: "New to the Studio? Edit one of your Demo Pack templates before starting from scratch. It's the quickest way to learn how everything works.",
    link: { href: "/account/studio", label: "Go to the Studio" },
    media: "/images/learn/hub/areas/start-design-v4.jpg",
  },
];

export const whatsNewLatest = () => WHATS_NEW.slice(0, WHATS_NEW_COUNT);
