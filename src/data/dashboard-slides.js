/* Chapter 04 on the dashboard: a carousel of ways to learn (Dani, 16 Oct).
   Each slide goes to one place and says where it goes. Add a slide by adding
   an entry to SLIDES; the blog slide is first and names the latest piece. */

const SLIDES = [
  {
    key: "studio-series",
    flag: "Getting started",
    title: "Learning to navigate the Studio.",
    desc: "Open your first template, make it your own and turn it into a finished post.",
    cta: "Start the series",
    href: "/account/guides/read?g=training-studio",
    art: "/images/learn/your-first-design-cover.webp",
  },
];

export function learnSlides({ blogTitle, blogHref } = {}) {
  return [
    {
      key: "blog",
      flag: "From the blog",
      title: "Five minutes well spent.",
      desc: blogTitle || "Practical marketing for estate agents, a few minutes at a time.",
      cta: "Read our latest blog",
      href: blogHref || "/account/blog",
      art: "/assets/chapter-04.jpg",
    },
    ...SLIDES,
  ];
}
