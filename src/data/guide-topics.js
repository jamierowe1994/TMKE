// TMKE member hub — Learn / Guides topic taxonomy.
// Single source of truth: the admin editor dropdown, the Learn landing grouping,
// and the reader breadcrumb all read from here. `slug` is stored on guides.topic.
export const GUIDE_TOPICS = [
  { slug: "getting-started",     label: "Getting started",        blurb: "Find your way around the hub and set up.",
    icon: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5c-.7.7-1 1.2-1 2.5H9c0-1.3-.3-1.8-1-2.5A6 6 0 0 1 12 3z"/>' },
  // "Social media" since 23 Nov 2026 (was "Intro to social media"; the slug stays).
  // It also covers what the Instagram & Facebook topic was for.
  { slug: "social-intro",        label: "Social media",           blurb: "The platforms, and how to use each.",
    icon: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>' },
  // hideEmpty: the Learn pill only shows to a member who has something in it,
  // so nobody without the Content Calendar sees an empty topic.
  { slug: "content-calendar",    label: "Content calendar",       blurb: "Your monthly posts, and how to use them.", hideEmpty: true,
    icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>' },
  { slug: "content-strategy",    label: "Content strategy",       blurb: "Pillars, value content and marketing.",
    icon: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h7M9 17h7"/>' },
  { slug: "design-branding",     label: "Design & branding",      blurb: "Your brand, applied consistently.",
    icon: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2s-.6-2-1-2.5.4-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-3.9-4-6-9-6z"/><circle cx="7.5" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/>' },
  { slug: "reels-video",         label: "Reels & video",          blurb: "Short-form video that gets reach.",
    icon: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9l5 3-5 3z"/>' },
  { slug: "analytics",           label: "Analytics",              blurb: "Read your numbers and improve.",
    icon: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>' },
];

export const GUIDE_TOPIC_MAP = Object.fromEntries(GUIDE_TOPICS.map((t) => [t.slug, t]));
export const GUIDE_TOPIC_LABEL = (slug) => (GUIDE_TOPIC_MAP[slug] || {}).label || "Guides";
