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
//   eyebrow / title / body   the card's copy; <em> in the title goes violet
//
// A walk is opened from a training lesson's "Show me" button and finishes
// back on that lesson. Selectors are the pages' own ids and classes, so a
// page change here is the place to look when a step starts skipping.

const DASHBOARD_STEPS = [
  { path: "/account", target: ".ws-tabs", placement: "bottom",
    eyebrow: "Dashboard", title: "Everything is <em>along the top.</em>",
    body: "Dashboard, Studio, Planner, Orders, Bookings, Your SMM and the Shop. Wherever you are in the hub, these take you anywhere else in one click." },
  { path: "/account", target: ".ws-hero", placement: "bottom",
    eyebrow: "Dashboard", title: "Today, <em>at a glance.</em>",
    body: "The dashboard opens on what needs your attention: the day's date, what's planned, and a line or two about where you're up to." },
  { path: "/account", target: 'section[aria-labelledby="plan-h"]', placement: "top",
    eyebrow: "Dashboard", title: "What's <em>planned.</em>",
    body: "Your week's posts, pulled from the Planner. Anything you schedule shows here on the day it goes out." },
  { path: "/account", target: 'section[aria-labelledby="studio-h"]', placement: "top",
    eyebrow: "Dashboard", title: "Where you <em>make things.</em>",
    body: "Your packs and recent designs, with a shortcut into the Studio. Pick up where you left off or start something new." },
  { path: "/account", target: ".ws-nav-right", placement: "bottom",
    eyebrow: "Dashboard", title: "Notifications, and <em>you.</em>",
    body: "Order and booking updates land in the bell. Your name opens the menu with your Brand kit, billing and sign out." },
];

// The hub menu: one short walk per area. Each comes back here when it ends,
// and a tick marks the ones already done.
const HUB_MENU = {
  path: "*", target: null, placement: "center", menu: [
    { walk: "dashboard",   label: "Dashboard",  note: "Home, and today at a glance" },
    { walk: "studio-tour", label: "Studio",     note: "Packs, designs and the editor" },
    { walk: "planner",     label: "Planner",    note: "The month, and adding a post" },
    { walk: "orders",      label: "Orders",     note: "Packs you've bought, receipts" },
    { walk: "bookings",    label: "Bookings",   note: "Shoots booked and delivered" },
    { walk: "smm",         label: "Your SMM",   note: "Managed social, if we run yours" },
    { walk: "learn",       label: "Learn",      note: "Guides, training, this month" },
  ],
  eyebrow: "Around the hub", title: "Where <em>next?</em>",
  body: "Pick an area for a short walk of it. Each one brings you back here; Done takes you back to the lesson.",
};

export const WALKS = {
  // The full hub tour: a look at the dashboard, then the menu of areas.
  "hub-tour": {
    title: "Around the hub",
    steps: [
      { path: "/account", target: null, placement: "center", skipToMenu: true,
        eyebrow: "Around the hub", title: "Your hub, <em>one area at a time.</em>",
        body: "First a quick look at the dashboard, then a menu of the hub's areas so you can walk the ones you want. Nothing here changes anything. Press Next to begin, or skip straight to the menu." },
      ...DASHBOARD_STEPS,
      HUB_MENU,
    ],
  },
  "dashboard": { title: "Dashboard", steps: DASHBOARD_STEPS },

  "studio-tour": {
    title: "Studio",
    steps: [
      { path: "/account/studio", target: ".ws-hero", placement: "bottom",
        eyebrow: "Studio", title: "Your <em>shelf.</em>",
        body: "The Studio page is where designs start. Create a new one from here, or open something below." },
      { path: "/account/studio", target: 'section[aria-labelledby="packs-h"]', placement: "top",
        eyebrow: "Studio", title: "The packs <em>you own.</em>",
        body: "Each pack is a set of ready-made templates. Open one and every design in it is already in your brand kit's colours." },
      { path: "/account/studio", target: 'section[aria-labelledby="designs-h"]', placement: "top",
        eyebrow: "Studio", title: "The ones <em>you've made.</em>",
        body: "Anything you've saved sits here. Open it to carry on, or duplicate it for a variation." },
      { path: "/account/studio", target: 'section[aria-labelledby="tools-h"]', placement: "top",
        eyebrow: "Studio", title: "Quick <em>tools.</em>",
        body: "Shortcuts for the jobs that don't need a full design." },
      { path: "/account/studio", target: 'section[aria-labelledby="inspo-h"]', placement: "top",
        eyebrow: "Studio", title: "When you're <em>stuck.</em>",
        body: "What's working this month, the seasonal pack, 48 content ideas, and our templates in your colours. The Your first design course covers the editor itself." },
    ],
  },

  "orders": {
    title: "Orders",
    steps: [
      { path: "/account/orders", target: ".ord-hero", placement: "bottom",
        eyebrow: "Orders", title: "Everything <em>you've bought.</em>",
        body: "Packs, add-ons and anything else from The Edit, in one place." },
      { path: "/account/orders", target: 'section[aria-labelledby="ord-sum-h"]', placement: "top",
        eyebrow: "Orders", title: "The <em>totals.</em>",
        body: "How many packs you own and what you've spent, at a glance." },
      { path: "/account/orders", target: 'section[aria-labelledby="ord-list-h"]', placement: "top",
        eyebrow: "Orders", title: "Each <em>order.</em>",
        body: "Open one for its receipt and a link straight into the pack in the Studio." },
    ],
  },

  "bookings": {
    title: "Bookings",
    steps: [
      { path: "/account/bookings", target: ".bk-hero", placement: "bottom",
        eyebrow: "Bookings", title: "Your <em>videography.</em>",
        body: "Shoots you've booked with us, and the button to book another." },
      { path: "/account/bookings", target: "#bk-progress-sec", placement: "top",
        eyebrow: "Bookings", title: "In <em>progress.</em>",
        body: "A booked shoot moves through prep, the day itself, editing and delivery. Open it to see where it is and what we need from you." },
      { path: "/account/bookings", target: "#bk-past-sec", placement: "top",
        eyebrow: "Bookings", title: "<em>Delivered.</em>",
        body: "Finished shoots keep their gallery link and PIN here, so you can always get back to your content." },
    ],
  },

  "smm": {
    title: "Your SMM",
    steps: [
      { path: "/account/social", target: ".soc-hero", placement: "bottom",
        eyebrow: "Your SMM", title: "Managed <em>social media.</em>",
        body: "If we run your channels, this is your window into it. If we don't yet, this page is where to see what's included." },
      { path: "/account/social", target: 'section[aria-labelledby="soc-svc-h"]', placement: "top",
        eyebrow: "Your SMM", title: "What's <em>included.</em>",
        body: "The plans, what each covers, and the brochure. Ask us from here." },
      { path: "/account/social", target: 'section[aria-labelledby="soc-plan-h"]', placement: "top",
        eyebrow: "Your SMM", title: "Your <em>plan.</em>",
        body: "The package you're on, what's in it, and who's looking after it." },
      { path: "/account/social", target: 'section[aria-labelledby="soc-perf-h"]', placement: "top",
        eyebrow: "Your SMM", title: "How it's <em>going.</em>",
        body: "Your monthly report: reach, followers, what did best, and what we're doing next." },
    ],
  },

  "learn": {
    title: "Learn",
    steps: [
      { path: "/account/guides", target: 'section[aria-labelledby="topics-h"]', placement: "bottom",
        eyebrow: "Learn", title: "By <em>topic.</em>",
        body: "Guides are grouped by what they're about. Click a tile to see just that topic." },
      { path: "/account/guides", target: "#training", placement: "top",
        eyebrow: "Learn", title: "<em>Training.</em>",
        body: "Four short courses on using the hub, with these guided walks. Your progress shows on each card." },
      { path: "/account/guides", target: 'section[aria-labelledby="month-h"]', placement: "top",
        eyebrow: "Learn", title: "This <em>month.</em>",
        body: "What's working on social right now, updated monthly: five formats, why they work, and how to use them." },
      { path: "/account/guides", target: "#lrn-guides", placement: "top",
        eyebrow: "Learn", title: "The <em>guides.</em>",
        body: "Articles and courses on posting, platforms and strategy. Start with the 48 Evergreen Content Ideas when you need something to post." },
    ],
  },

  "brand-kit": {
    title: "Your brand kit",
    steps: [
      { path: "/account/profile", target: null, placement: "center",
        eyebrow: "Brand kit", title: "Set it once, <em>use it everywhere.</em>",
        body: "Your logo, colours and fonts live here. Every template you open reads them, so a design is on-brand before you touch it." },
      { path: "/account/profile", target: "#logo-grid", placement: "right",
        eyebrow: "Logos", title: "Your <em>logo.</em>",
        body: "Upload a PNG or SVG with a transparent background. Add more than one if you have a light and a dark version; the first is the one templates use." },
      { path: "/account/profile", target: "#colour-grid", placement: "right",
        eyebrow: "Colours", title: "Your <em>palette.</em>",
        body: "Add your brand colours as hex codes. The first two do most of the work: templates recolour their main fills and text with them." },
      { path: "/account/profile", target: "#type-preview", placement: "left",
        eyebrow: "Fonts", title: "Your <em>type.</em>",
        body: "Pick a heading font and a body font. The preview shows how they sit together; the Studio offers them first in every font list." },
      { path: "/account/profile", target: "#brand-save", placement: "bottom",
        eyebrow: "Saving", title: "It saves <em>as you go.</em>",
        body: "This dot shows the kit saving. Once it's white, your next design in the Studio opens in your colours and fonts." },
    ],
  },

  "studio-first-design": {
    title: "Your first design",
    steps: [
      { path: "/account/studio", target: null, placement: "center",
        eyebrow: "Studio", title: "From a pack, or <em>from nothing.</em>",
        body: "The Studio page is your shelf: the packs you own, the designs you've saved, and a way into the editor. Then we'll open a blank canvas." },
      { path: "/account/studio", target: 'section[aria-labelledby="packs-h"]', placement: "bottom",
        eyebrow: "Packs", title: "The packs <em>you own.</em>",
        body: "Each pack is a set of ready-made templates. Open one and every design in it is already in your brand kit's colours." },
      { path: "/account/studio", target: 'section[aria-labelledby="designs-h"]', placement: "top",
        eyebrow: "Designs", title: "The ones <em>you've made.</em>",
        body: "Anything you've saved sits here. Open it to carry on, or duplicate it for a variation." },
      { path: "/account/editor", href: "/account/editor?blank=1", target: ".ed-rail", placement: "right", padding: 10, pre: "dismissEditorOnboarding",
        eyebrow: "The editor", title: "Your <em>toolbox.</em>",
        body: "Everything you can add or change runs down this rail: Start, Brand, Elements, Text, Images, Background, Layers. Click one and its panel opens beside it." },
      { path: "/account/editor", target: "#ed-panel", placement: "right", pre: "dismissEditorOnboarding",
        eyebrow: "The panel", title: "Where the <em>options</em> live.",
        body: "Whatever you've selected, its controls appear here: fonts and sizes for text, fill and corners for shapes, crop and fit for photos." },
      { path: "/account/editor", target: "#ed-canvas-shadow", placement: "left", pre: "dismissEditorOnboarding",
        eyebrow: "The canvas", title: "Your <em>design.</em>",
        body: "Click anything on it to select it, drag to move, pull a corner to resize. Double-click text to type. Nothing is permanent - Undo is always there." },
      { path: "/account/editor", target: "#ed-download", placement: "bottom", pre: "dismissEditorOnboarding",
        eyebrow: "Finishing", title: "Save, then <em>Download.</em>",
        body: "Save keeps it in your designs. Download gives you a PNG or JPG ready to post, or a PDF for print. Schedule sends it straight to your Planner." },
    ],
  },

  "planner": {
    title: "Planning and posting",
    steps: [
      { path: "/account/schedule", target: null, placement: "center",
        eyebrow: "Planner", title: "Your month, <em>laid out.</em>",
        body: "The Planner is a calendar of what's going out and when. A plan you can see is a plan you'll keep to." },
      { path: "/account/schedule", target: ".cal-hero", placement: "bottom",
        eyebrow: "The month", title: "One month <em>at a time.</em>",
        body: "The header tells you which month you're looking at and how much is planned in it." },
      { path: "/account/schedule", target: "#cal-grid", placement: "top",
        eyebrow: "The grid", title: "Click a day to <em>add a post.</em>",
        body: "Every day is a slot. Click one to add a post: a caption, the design it goes with, and the platform. Designs you've scheduled from the Studio land here on their day." },
      { path: "/account/schedule", target: "#cal-today", placement: "bottom",
        eyebrow: "Moving around", title: "Back to <em>today.</em>",
        body: "The arrows step through the months and Today brings you straight back. That's the Planner - from here it's a case of filling the days." },
    ],
  },
};

export const WALK_LIST = Object.keys(WALKS).map((id) => ({ id, title: WALKS[id].title }));
