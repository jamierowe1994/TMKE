/**
 * /knowledge.json — what TMKE has written, for the Creative Assistant.
 *
 * Built with the site, so it carries the courses and posts that live in the
 * code (src/data/training-guides.js, src/data/blog.js). The assistant's
 * function (supabase/functions/ask-expert) fetches this, adds the guides and
 * posts that live in Supabase, and hands the most relevant few to the
 * assistant with each question so it can answer from our own material and
 * point members to it by name. Nothing here is private: it is the published
 * training and the blog.
 */
import { TRAINING_GUIDES } from "../data/training-guides.js";
import { STATIC_POSTS, MEMBERS_STATIC_POSTS } from "../data/blog.js";

const strip = (html) => String(html || "")
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
  .replace(/<\/(p|h[1-6]|li|blockquote|div)>/gi, "\n")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&rsquo;|&#8217;/g, "’").replace(/&lsquo;/g, "‘")
  .replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”").replace(/&mdash;/g, "—").replace(/&hellip;/g, "…")
  .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

const md = (s) => String(s || "")
  .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/^#{1,6}\s+/gm, "").replace(/[*_`>]+/g, "")
  .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

export async function GET() {
  const courses = TRAINING_GUIDES.map((g) => ({
    kind: "course",
    slug: g.slug,
    title: g.title,
    summary: g.summary || "",
    url: `/account/guides/read?g=${encodeURIComponent(g.slug)}`,
    text: (g.lessons || []).map((l) => `${l.title ? l.title + ". " : ""}${strip(l.body_html)}`).join("\n"),
  }));
  const post = (p, url) => ({
    kind: "post",
    slug: p.slug,
    title: p.title,
    summary: p.standfirst || "",
    category: p.category || "",
    url,
    text: md(p.body),
  });
  const posts = [
    ...STATIC_POSTS.map((p) => post(p, `/blog/${p.slug}`)),
    ...MEMBERS_STATIC_POSTS.map((p) => post(p, `/account/blog#${p.slug}`)),
  ];
  return new Response(JSON.stringify({ generated: new Date().toISOString(), courses, posts }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
