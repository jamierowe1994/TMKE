// Walkthroughs — spotlight tours of the real hub, one per training lesson.
//
// Each step is the same shape the first-login tour uses (src/lib/tour.js):
//   path      the page it lives on (pathname), so the runner can carry a walk
//             across pages and resume after navigation
//   href      where to navigate when the walk moves to this page (defaults to
//             path; use it when the page needs a query, e.g. a blank canvas)
//   target    CSS selector to spotlight; null for a centred card
//   placement top | bottom | left | right | center | auto
//   pre       name of a runner-side setup step ("dismissEditorOnboarding")
//   eyebrow / title / body   the card's copy. One heading, one idea, one or two
//             sentences: what you're looking at and why you'd use it.
//
// A walk is opened from a training lesson's "Show me" button and finishes
// back on that lesson. Selectors are the pages' own ids and classes, so a
// page change here is the place to look when a step starts skipping.

const DASHBOARD_STEPS = [
  { path: "/account", target: ".ws-tabs", placement: "bottom",
    eyebrow: "Dashboard", title: "Everything within reach.",
    body: "Your main navigation stays at the top of the Member Hub, so Dashboard, Studio, Planner, Orders, Bookings, Your SMM and Shop are always one click away." },
  { path: "/account", target: ".ws-hero", placement: "bottom",
    eyebrow: "Dashboard", title: "Today, at a glance.",
    body: "The dashboard opens on what needs your attention: the day's date, what's planned, and a line or two about where you're up to." },
  { path: "/account", target: 'section[aria-labelledby="plan-h"]', placement: "top",
    eyebrow: "Dashboard", title: "What's planned.",
    body: "Your week's posts, pulled from the Planner. Anything you schedule shows here on the day it goes out." },
  { path: "/account", target: 'section[aria-labelledby="studio-h"]', placement: "top",
    eyebrow: "Dashboard", title: "Get creative.",
    body: "Access your packs and recent designs, with a shortcut into the Studio. Pick up where you left off or start something new." },
  { path: "/account", target: ".ws-nav-right", placement: "bottom",
    eyebrow: "Dashboard", title: "Notifications, and you.",
    body: "Order and booking updates land in the bell. Your name opens the menu with your Brand kit, billing and sign out." },
];

// The hub menu: one short walk per area. Each comes back here when it ends,
// and a tick marks the ones already done.
const HUB_MENU = {
  path: "*", target: null, placement: "center", menu: [
    { walk: "dashboard",   label: "Dashboard", note: "Home. See what's coming up, what's been planned and quickly jump back into the things you're working on." },
    { walk: "studio-tour", label: "Studio",    note: "Create and customise your social media content. Access the packs you own, your saved designs and the Studio editor." },
    { walk: "planner",     label: "Planner",   note: "See your content calendar, add upcoming posts and plan what you're publishing throughout the month." },
    { walk: "orders",      label: "Orders",    note: "Find everything you've purchased from The Edit, including your packs, order details and receipts." },
    { walk: "bookings",    label: "Bookings",  note: "Manage your TMKE videography bookings, follow their progress and access your finished galleries." },
    { walk: "smm",         label: "Your SMM",  note: "Everything relating to Social Media Management, from what's included to your current package and monthly performance." },
    { walk: "learn",       label: "Learn",     note: "Your training and insights library. Find practical guides, Member Hub courses and our latest social media trends." },
    { walk: "brand-kit",   label: "Brand kit", note: "Save your logo, colours and fonts so Studio templates automatically adapt to your brand." },
  ],
  eyebrow: "Around the hub", title: "Where next?",
  body: "Pick an area for a short walk of it. Each one brings you back to this page, with a tick on the ones you've done. Done takes you back to the lesson.",
};

export const WALKS = {
  // The full hub tour: a look at the dashboard, then the menu of areas.
  "hub-tour": {
    title: "Around the hub",
    steps: [
      { path: "/account", target: null, placement: "center", skipToMenu: true,
        eyebrow: "Around the hub", title: "Take a look around.",
        body: "We'll start with a quick tour of your dashboard, then you can explore each area of the Member Hub in more detail. Nothing you do in this walkthrough will change your account." },
      ...DASHBOARD_STEPS,
      HUB_MENU,
    ],
  },
  "dashboard": { title: "Dashboard", steps: DASHBOARD_STEPS },

  "studio-tour": {
    title: "Studio",
    steps: [
      { path: "/account/studio", target: ".ws-hero", placement: "bottom",
        eyebrow: "Studio", title: "Your Studio.",
        body: "Start something new, open one of your packs or continue working on a design you've already saved." },
      { path: "/account/studio", target: 'section[aria-labelledby="packs-h"]', placement: "top",
        eyebrow: "Studio", title: "The packs you own.",
        body: "Each pack is a set of ready-made templates. Open one and every design in it is already in your brand kit's colours." },
      { path: "/account/studio", target: 'section[aria-labelledby="designs-h"]', placement: "top",
        eyebrow: "Studio", title: "Your saved designs.",
        body: "Everything you've saved lives here. Open a design to keep editing or duplicate it to create another version." },
      { path: "/account/studio", target: 'section[aria-labelledby="tools-h"]', placement: "top",
        eyebrow: "Studio", title: "Quick tools.",
        body: "Shortcuts for the jobs that don't need a full design." },
      { path: "/account/studio", target: 'section[aria-labelledby="inspo-h"]', placement: "top",
        eyebrow: "Studio", title: "Need some inspiration?",
        body: "Find content ideas, seasonal inspiration and shortcuts to useful resources when you're not sure what to create next." },
    ],
  },

  "orders": {
    title: "Orders",
    steps: [
      { path: "/account/orders", target: ".ord-hero", placement: "bottom",
        eyebrow: "Orders", title: "Everything you've bought.",
        body: "Packs, add-ons and anything else from The Edit, in one place." },
      { path: "/account/orders", target: 'section[aria-labelledby="ord-sum-h"]', placement: "top",
        eyebrow: "Orders", title: "The totals.",
        body: "How many packs you own and what you've spent, at a glance." },
      { path: "/account/orders", target: 'section[aria-labelledby="ord-list-h"]', placement: "top",
        eyebrow: "Orders", title: "Each order.",
        body: "Open one for its receipt and a link straight into the pack in the Studio." },
    ],
  },

  "bookings": {
    title: "Bookings",
    steps: [
      { path: "/account/bookings", target: ".bk-hero", placement: "bottom",
        eyebrow: "Bookings", title: "Your videography.",
        body: "Shoots you've booked with us, and the button to book another." },
      { path: "/account/bookings", target: "#bk-progress-sec", placement: "top",
        eyebrow: "Bookings", title: "In progress.",
        body: "A booked shoot moves through prep, the day itself, editing and delivery. Open it to see where it is and what we need from you." },
      { path: "/account/bookings", target: "#bk-past-sec", placement: "top",
        eyebrow: "Bookings", title: "Delivered.",
        body: "Once your shoot is complete, you'll find the finished gallery and access details here, so your content is always easy to get back to." },
    ],
  },

  "smm": {
    title: "Your SMM",
    steps: [
      { path: "/account/social", target: ".soc-hero", placement: "bottom",
        eyebrow: "Your SMM", title: "Managed social media.",
        body: "If we manage your social media, this is where you can view your plan and keep track of how it's performing. If we don't, you can explore our Social Media Management packages and see how TMKE can support you." },
      { path: "/account/social", target: 'section[aria-labelledby="soc-svc-h"]', placement: "top",
        eyebrow: "Your SMM", title: "What's included.",
        body: "The plans, what each covers, and the brochure. Ask us from here." },
      { path: "/account/social", target: 'section[aria-labelledby="soc-plan-h"]', placement: "top",
        eyebrow: "Your SMM", title: "Your plan.",
        body: "The package you're on, what's in it, and who's looking after it." },
      { path: "/account/social", target: 'section[aria-labelledby="soc-perf-h"]', placement: "top",
        eyebrow: "Your SMM", title: "How it's going.",
        body: "Your monthly performance in one place: reach, audience growth, top-performing content and what we're focusing on next." },
    ],
  },

  "learn": {
    title: "Learn",
    steps: [
      { path: "/account/guides", target: 'section[aria-labelledby="topics-h"]', placement: "bottom",
        eyebrow: "Learn", title: "Explore by topic.",
        body: "Training and resources are organised by subject, making it easy to find help with whatever you're working on." },
      { path: "/account/guides", target: "#training", placement: "top",
        eyebrow: "Learn", title: "Training courses.",
        body: "Short, practical courses designed to help you get more from your Member Hub and your marketing. Your progress is saved as you go." },
      { path: "/account/guides", target: 'section[aria-labelledby="month-h"]', placement: "top",
        eyebrow: "Learn", title: "What's trending.",
        body: "Five social media trends we're watching this month, including what they are, why they work and how you could use them in property." },
      { path: "/account/guides", target: "#lrn-guides", placement: "top",
        eyebrow: "Learn", title: "Guides and insights.",
        body: "Practical advice covering content, social media and marketing strategy. Use them when you want to learn something new or need some inspiration." },
    ],
  },

  "brand-kit": {
    title: "Your brand kit",
    steps: [
      { path: "/account/profile", target: null, placement: "center",
        eyebrow: "Brand kit", title: "Set it once, use it everywhere.",
        body: "Your logo, colours and fonts live here. Every template you open reads them, so a design is on-brand before you touch it." },
      { path: "/account/profile", target: "#logo-grid", placement: "right",
        eyebrow: "Logos", title: "Your logo.",
        body: "Upload a PNG or SVG with a transparent background. Add more than one if you have a light and a dark version; the first is the one templates use." },
      { path: "/account/profile", target: "#colour-grid", placement: "right",
        eyebrow: "Colours", title: "Your palette.",
        body: "Add your brand colours as hex codes. The first two do most of the work: templates recolour their main fills and text with them." },
      { path: "/account/profile", target: "#type-preview", placement: "left",
        eyebrow: "Fonts", title: "Your type.",
        body: "Pick a heading font and a body font. The preview shows how they sit together; the Studio offers them first in every font list." },
      { path: "/account/profile", target: "#brand-save", placement: "bottom",
        eyebrow: "Saving", title: "It saves as you go.",
        body: "Your Brand Kit saves changes as you make them. Once saving is complete, your latest colours, fonts and logos are ready to use in the Studio." },
    ],
  },

  "studio-first-design": {
    title: "Your first design",
    steps: [
      { path: "/account/studio", target: null, placement: "center",
        eyebrow: "Studio", title: "Choose where to start.",
        body: "Open one of your template packs, continue a saved design or start something completely new. We'll use a blank canvas to show you around the editor." },
      { path: "/account/studio", target: 'section[aria-labelledby="packs-h"]', placement: "bottom",
        eyebrow: "Packs", title: "The packs you own.",
        body: "Each pack is a set of ready-made templates. Open one and every design in it is already in your brand kit's colours." },
      { path: "/account/studio", target: 'section[aria-labelledby="designs-h"]', placement: "top",
        eyebrow: "Designs", title: "Your saved designs.",
        body: "Everything you've created and saved lives here. Open one to continue editing or duplicate it to create another version." },
      { path: "/account/editor", href: "/account/editor?blank=1", target: ".ed-rail", placement: "right", padding: 10, pre: "dismissEditorOnboarding",
        eyebrow: "The editor", title: "Your toolbox.",
        body: "Everything you can add or change runs down this rail: Start, Brand, Elements, Text, Images, Background, Layers. Click one and its panel opens beside it." },
      { path: "/account/editor", target: "#ed-panel", placement: "right", pre: "dismissEditorOnboarding",
        eyebrow: "The panel", title: "Where the options live.",
        body: "Whatever you've selected, its controls appear here: fonts and sizes for text, fill and corners for shapes, crop and fit for photos." },
      { path: "/account/editor", target: "#ed-canvas-shadow", placement: "left", pre: "dismissEditorOnboarding",
        eyebrow: "The canvas", title: "Your design.",
        body: "Click anything on it to select it, drag to move, pull a corner to resize. Double-click text to type. Nothing is permanent - Undo is always there." },
      { path: "/account/editor", target: "#ed-download", placement: "bottom", pre: "dismissEditorOnboarding",
        eyebrow: "Finishing", title: "Save, then Download.",
        body: "Save keeps it in your designs. Download gives you a PNG or JPG ready to post, or a PDF for print. Schedule sends it straight to your Planner." },
    ],
  },

  "planner": {
    title: "Planning and posting",
    steps: [
      { path: "/account/schedule", target: null, placement: "center",
        eyebrow: "Planner", title: "Your month, laid out.",
        body: "The Planner gives you a clear view of what's going out and when, so you can plan ahead and spot any gaps." },
      { path: "/account/schedule", target: ".cal-hero", placement: "bottom",
        eyebrow: "The month", title: "One month at a time.",
        body: "The header tells you which month you're looking at and how much is planned in it." },
      { path: "/account/schedule", target: "#cal-grid", placement: "top",
        eyebrow: "The grid", title: "Click a day to add a post.",
        body: "Every day is a slot. Click one to add a post: a caption, the design it goes with, and the platform. Designs you've scheduled from the Studio land here on their day." },
      { path: "/account/schedule", target: "#cal-today", placement: "bottom",
        eyebrow: "Moving around", title: "Back to today.",
        body: "Use these controls to move between months or jump straight back to today. You don't need to fill every day, just plan a schedule you can realistically maintain." },
    ],
  },
};

export const WALK_LIST = Object.keys(WALKS).map((id) => ({ id, title: WALKS[id].title }));
