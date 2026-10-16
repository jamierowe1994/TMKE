/* Chapter 05 on the dashboard, Learn (Dani, 16 Oct): a section that holds
   still while you scroll through it. The titles roll up on the left -- the one
   that's up, with a line about it, and one either side -- and the pictures
   roll up with them on the right, 16:9, with what the course covers across
   the top and its length at the foot.

   The Getting Started series, in its own order, then the latest blog. A new
   course in the series (src/data/training-guides.js) joins on its own. */
import { TRAINING_GUIDES } from "./training-guides.js";

export function learnSlides({ blogTitle, blogHref } = {}) {
  const series = TRAINING_GUIDES
    .filter((g) => g.topic === "getting-started" && g.training && g.audience === "members" && g.status === "published")
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const courses = series.map((g, i) => {
    const lessons = (g.lessons || []).map((l) => l.title).filter(Boolean);
    return {
      key: g.slug,
      title: g.title,
      summary: g.summary || "",
      href: `/account/guides/read?g=${encodeURIComponent(g.slug)}`,
      art: g.art || g.cover_url || "/assets/chapter-04.jpg",
      // Across the top: what's in it. The rest of the corners: where it sits.
      top: lessons.slice(0, 3),   // one line across the top
      corner: [`Getting started`, `${i + 1} of ${series.length}`],
      foot: [g.est_minutes ? `${g.est_minutes} minutes` : "", `${lessons.length} lesson${lessons.length === 1 ? "" : "s"}`].filter(Boolean),
    };
  });
  return [
    ...courses,
    {
      key: "blog",
      title: "Five minutes well spent",
      summary: blogTitle || "Practical marketing for estate agents, a few minutes at a time.",
      href: blogHref || "/account/blog",
      art: "/assets/chapter-04.jpg",
      top: ["From the blog"],
      corner: ["Read our latest blog"],
      foot: ["A few minutes", "Something you can use"],
      blog: true,
    },
  ];
}
