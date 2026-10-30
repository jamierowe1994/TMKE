import { areaImg } from "./hub-art.js";
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
// back on that lesson.
//
// EVERY walk has a `stage`, and runs in the pop-out: the training window,
// which is the training account and never the member's (src/lib/training.js).
// Until 14 Oct the area walks below ran on the member's own pages, in their
// own login. Dani: "Anything within those walkthroughs should be pulled from
// the training environment." Selectors are the pages' own ids and classes, so a
// page change here is the place to look when a step starts skipping.

// The Planner walks' openers: a tab, then a day from today in this month.
const PL_MP = '.cal-view-btn[data-view="all"]';
const PL_CC = '.cal-view-btn[data-view="posts"]';
const PL_DAY = ".cal-day:not(.is-past):not(.is-other-month)";

const DASHBOARD_STEPS = [
  // The whole bar, not the tab strip: on a phone the strip is hidden and the
  // sections live in the burger, and a hidden target skips the step.
  { path: "/account", target: ".ws-nav", placement: "bottom",
    eyebrow: "Dashboard", title: "Everything Within Reach",
    body: "Your main navigation stays at the top of the Member Hub, so Dashboard, Studio, Marketing Planner, Orders, Bookings, Your SMM, Community and Shop are always one tap away." },
  { path: "/account", target: ".ws-hero", placement: "bottom",
    eyebrow: "Dashboard", title: "Today, at a Glance",
    body: "The dashboard opens on what needs your attention: the day's date, what's planned, and a line or two about where you're up to." },
  { path: "/account", target: 'section[aria-labelledby="plan-h"]', placement: "top",
    eyebrow: "Dashboard", title: "What's Planned",
    body: "Your week's posts, pulled from your Marketing Planner. Anything you schedule shows here on the day it goes out." },
  { path: "/account", target: 'section[aria-labelledby="studio-h"]', placement: "top",
    eyebrow: "Dashboard", title: "Get Creative",
    body: "Access your packs and recent designs, with a shortcut into the Studio. Pick up where you left off or start something new." },
  // Dani, 17 Oct: one more, for what's going on.
  { path: "/account", target: 'section[aria-labelledby="new-h"]', placement: "top",
    eyebrow: "Dashboard", title: "See What's New",
    body: "The latest from TMKE: what's new in your hub, the newest pack and this month's content calendar, with quick links to the rest." },
  { path: "/account", target: ".ws-nav-right", placement: "bottom",
    eyebrow: "Dashboard", title: "Notifications, and You",
    body: "Order and booking updates land in the bell. Your name opens the menu with your Brand kit, billing and sign out." },
];

// The hub menu: one short walk per area. Each comes back here when it ends,
// and a tick marks the ones already done.
const HUB_MENU = {
  path: "*", target: null, placement: "center", menu: [
    { walk: "dashboard",   label: "Dashboard", note: "Home. See what's coming up, what's been planned and quickly jump back into the things you're working on." , art: areaImg("dashboard")},
    { walk: "studio-tour", label: "Studio",    note: "Create and customise your social media content. Access the packs you own, your saved designs and the Studio editor." , art: areaImg("studio")},
    { walk: "planner",     label: "Marketing Planner", note: "Plan all of your marketing on the day it happens, with a Content Calendar view of just what you're posting." , art: areaImg("planner")},
    { walk: "orders",      label: "Orders",    note: "Find everything you've purchased from The Edit, including your packs, order details and receipts." , art: areaImg("orders")},
    { walk: "bookings",    label: "Bookings",  note: "Manage your TMKE videography bookings, follow their progress and access your finished galleries." , art: areaImg("bookings")},
    { walk: "smm",         label: "Your SMM",  note: "Everything relating to Social Media Management, from what's included to your current package and monthly performance." , art: areaImg("smm")},
    { walk: "learn",       label: "Training Studio",     note: "Your training and insights library. Find practical guides, Member Hub courses and our latest social media trends." , art: areaImg("learn")},
    { walk: "brand-kit",   label: "Brand Kit", note: "Save your logo, colours and fonts so Studio templates automatically adapt to your brand." , art: areaImg("brand-kit")},
  ],
  eyebrow: "Around the hub", title: "Where Next?",
  body: "Pick an area for a short walk. Each brings you back here, with a tick on the ones you've done. Done returns to the lesson.",
};

export const WALKS = {
  // The full hub tour: a look at the dashboard, then the menu of areas.
  "hub-tour": {
    title: "Around the Hub",
    stage: "/account",
    steps: [
      { path: "/account", target: null, placement: "center", skipToMenu: true,
        eyebrow: "Around the hub", title: "Take a Look Around",
        body: "We'll start with a quick tour of your dashboard, then you can explore each area of the Member Hub in more detail. Nothing you do in this walkthrough will change your account." },
      ...DASHBOARD_STEPS,
      HUB_MENU,
    ],
  },
  "dashboard": { title: "Dashboard", stage: "/account", steps: DASHBOARD_STEPS },

  "studio-tour": {
    title: "Studio",
    stage: "/account/studio",
    steps: [
      { path: "/account/studio", target: ".ws-hero", placement: "bottom",
        eyebrow: "Studio", title: "Your Studio",
        body: "Start something new, open one of your packs or continue working on a design you've already saved." },
      { path: "/account/studio", target: 'section[aria-labelledby="packs-h"]', placement: "top",
        eyebrow: "Studio", title: "The Packs You Own",
        body: "Each pack is a set of ready-made templates. Open one and every design in it is already in your brand kit's colours." },
      { path: "/account/studio", target: 'section[aria-labelledby="designs-h"]', placement: "top",
        eyebrow: "Studio", title: "Your Saved Designs",
        body: "Everything you've saved lives here. Open a design to keep editing or duplicate it to create another version." },
      { path: "/account/studio", target: 'section[aria-labelledby="tools-h"]', placement: "top",
        eyebrow: "Studio", title: "Quick Tools",
        body: "Shortcuts for the jobs that don't need a full design." },
      { path: "/account/studio", target: 'section[aria-labelledby="inspo-h"]', placement: "top",
        eyebrow: "Studio", title: "Need Some Inspiration?",
        body: "Find content ideas, seasonal inspiration and shortcuts to useful resources when you're not sure what to create next." },
    ],
  },

  "orders": {
    title: "Orders",
    stage: "/account/orders",
    steps: [
      { path: "/account/orders", target: ".ord-hero", placement: "bottom",
        eyebrow: "Orders", title: "Everything You've Bought",
        body: "Packs, add-ons and anything else from The Edit, in one place." },
      { path: "/account/orders", target: 'section[aria-labelledby="ord-sum-h"]', placement: "top",
        eyebrow: "Orders", title: "The Totals",
        body: "How many packs you own and what you've spent, at a glance." },
      { path: "/account/orders", target: 'section[aria-labelledby="ord-list-h"]', placement: "top",
        eyebrow: "Orders", title: "Each Order",
        body: "Open one for its receipt and a link straight into the pack in the Studio." },
    ],
  },

  "bookings": {
    title: "Bookings",
    stage: "/account/bookings",
    steps: [
      { path: "/account/bookings", target: ".bk-hero", placement: "bottom",
        eyebrow: "Bookings", title: "Your Videography",
        body: "Shoots you've booked with us, and the button to book another." },
      { path: "/account/bookings", target: "#bk-upcoming-sec", placement: "top",
        eyebrow: "Bookings", title: "Upcoming",
        body: "Your booked shoots, with the date, time and location for each. Book another from here." },
      { path: "/account/bookings", target: "#bk-progress-sec", placement: "top",
        eyebrow: "Bookings", title: "In Progress",
        body: "A booked shoot moves through prep, the day itself, editing and delivery. Open it to see where it is and what we need from you." },
      { path: "/account/bookings", target: "#bk-past-sec", placement: "top",
        eyebrow: "Bookings", title: "Delivered",
        body: "Once your shoot is complete, you'll find the finished gallery and access details here, so your content is always easy to get back to." },
    ],
  },

  "smm": {
    title: "Your SMM",
    stage: "/account/social",
    steps: [
      { path: "/account/social", target: ".soc-hero", placement: "bottom",
        eyebrow: "Your SMM", title: "Managed Social Media",
        body: "If we manage your social media, this is where you can view your plan and keep track of how it's performing. If we don't, you can explore our Social Media Management packages and see how TMKE can support you." },
      { path: "/account/social", target: 'section[aria-labelledby="soc-svc-h"]', placement: "top", optional: true,
        eyebrow: "Your SMM", title: "What's Included",
        body: "The plans, what each covers, and the brochure. Ask us from here." },
      { path: "/account/social", target: 'section[aria-labelledby="soc-plan-h"]', placement: "top", optional: true,
        eyebrow: "Your SMM", title: "Your Plan",
        body: "The package you're on, what's in it, and who's looking after it." },
      { path: "/account/social", target: 'section[aria-labelledby="soc-perf-h"]', placement: "top", optional: true,
        eyebrow: "Your SMM", title: "How It's Going",
        body: "Your monthly performance in one place: reach, audience growth, top-performing content and what we're focusing on next." },
    ],
  },

  "learn": {
    title: "Your Training Studio",
    stage: "/account/guides",
    steps: [
      { path: "/account/guides", target: 'section[aria-labelledby="topics-h"]', placement: "bottom",
        eyebrow: "Training Studio", title: "Explore by Topic",
        body: "Training and resources are organised by subject, so you can find help with whatever you're working on. Or search for it at the top." },
      { path: "/account/guides", target: "#training", placement: "top",
        eyebrow: "Training Studio", title: "Getting Started",
        body: "Four short courses on using your Member Hub, each with a guided look at the real page. Your progress is saved as you go." },
      { path: "/account/guides", target: 'section[aria-labelledby="month-h"]', placement: "top",
        eyebrow: "Training Studio", title: "This Month",
        body: "Five social media trends we're watching this month: what they are, why they work and how you could use them in property." },
      { path: "/account/guides", target: 'section[aria-labelledby="cont-h"]', placement: "top",
        eyebrow: "Training Studio", title: "What's New",
        body: "The latest courses and guides, with a few good places to start. Every guide opens the full library." },
      { path: "/account/guides", target: "#notes", placement: "top",
        eyebrow: "Training Studio", title: "From the Blog",
        body: "Our latest blog posts, for a longer read on marketing and the property market. The full archive is under Blog in your menu." },
    ],
  },

  /* One step per card, in the order they appear down the page. Dani, 11 Oct:
     "I want a section for each card within the brand kit to explain it."
     Every card now has an id to aim at (src/pages/account/profile.astro), so a
     step lights one card and nothing either side of it. */
  "brand-kit": {
    title: "Your Brand Kit",
    stage: "/account/profile",
    steps: [
      { path: "/account/profile", target: null, placement: "center",
        eyebrow: "Brand kit", title: "Set It Once, Use It Everywhere",
        body: "Your logo, colours and fonts live here. Every template you open reads them, so a design is on-brand before you touch it." },
      { path: "/account/profile", target: "#bk-brief", placement: "bottom",
        eyebrow: "At a glance", title: "What's Left to Add",
        body: "These three boxes show what your Brand Kit is still missing. Click one to go straight to it. If your brand supplies your kit, Confirm tells us it's still up to date." },
      { path: "/account/profile", target: "#sec-company", placement: "right",
        eyebrow: "Company", title: "Your Company",
        body: "Your agency name, the area you cover, your strapline and your website. Templates pull these in wherever a design names the agency." },
      { path: "/account/profile", target: "#sec-logos", placement: "right",
        eyebrow: "Logos", title: "Your Logo",
        body: "Upload a PNG or SVG with a transparent background. Add more than one if you have a light and a dark version; the first is the one templates use." },
      { path: "/account/profile", target: "#sec-about", placement: "right",
        eyebrow: "About you", title: "Your Details",
        body: "Your name, job title, phone number, email and review link. Designs use your contact details, and testimonial requests you plan in the Marketing Planner send your review link." },
      { path: "/account/profile", target: "#sec-colours", placement: "right",
        eyebrow: "Colours", title: "Your Palette",
        body: "Add your brand colours as hex codes. The first two do most of the work: templates recolour their main fills and text with them." },
      { path: "/account/profile", target: "#sec-fonts", placement: "left",
        eyebrow: "Fonts", title: "Your Type",
        body: "Pick a heading font and a body font. The preview shows how they sit together; the Studio offers them first in every font list." },
      { path: "/account/profile", target: "#sec-tone", placement: "right",
        eyebrow: "Tone of voice", title: "How You Sound",
        body: "Describe the way your brand speaks. The caption generator blends this with our house rules, so captions come out in your voice rather than a generic one." },
      { path: "/account/profile", target: "#brand-save", placement: "bottom",
        eyebrow: "Saving", title: "It Saves as You Go",
        body: "Your Brand Kit saves changes as you make them. Once saving is complete, your latest colours, fonts and logos are ready to use in the Studio." },
    ],
  },

  // ---------------------------------------------------------------------
  // Your First Design - one walk per part of the course.
  //
  // Each has a `stage`: the real page opens in a pop-out ON the lesson rather
  // than taking the reader off it, so it always looks like part of the course
  // and closing the demo puts them back where they were.
  //
  // The editor ones open ?training=1, which loads the demo template and a
  // stand-in brand kit (src/data/training-demo.js). That matters: a walk about
  // changing the words needs words to change. `select` picks something on that
  // canvas; `open` clicks a control before the card shows.
  // ---------------------------------------------------------------------
  "studio-template": {
    title: "Opening a Template",
    // Dani, 22 Sep: this walk is one thing - Studio, your packs, open the demo
    // pack, and there are its templates. The blank canvas and "carry on with a
    // design you've already made" belong in a course of their own, not here.
    // The fewer things the spotlight boxes that a reader can already see, the
    // better: a page with three templates on it doesn't need a box drawn round
    // them.
    lead: "Let's open your first template",
    /* One continuous line. The tip used to be a tinted panel of its own under
       this box, then a second line set off by a rule; both drew a border
       across the middle of one thought. Dani, 12 Oct: "no line break". */
    line: "Find your Demo Pack, choose a design and open it in the editor. The Studio creates your own copy, leaving the original template untouched. Your demo templates are there to experiment with. Change the wording, swap the imagery and move things around. You can always return to the original and start again.",
    stage: "/account/studio",
    steps: [
      /* The first three are the live Studio page again (Dani, 17 Oct): the
         training window is the training account now, so there is nothing of
         anyone's to show, and a page that only scrolls and highlights needs no
         picture -- and no reshoot when the page changes. The editor steps
         below keep theirs. */
      { path: "/account/studio", target: ".ws-hero", placement: "bottom",
        eyebrow: "Studio", title: "Welcome to the Studio",
        body: "You'll find your template packs, saved designs and creative tools in the Studio." },
      { path: "/account/studio", target: 'section[aria-labelledby="packs-h"]', placement: "top",
        eyebrow: "Your packs", title: "Find Your Templates",
        body: "Your packs are displayed here, including the free Demo Pack that comes with every Member Hub account." },
      { path: "/account/studio", target: ".st-pack[data-demo-pack], .st-pack", placement: "bottom", padding: 8,
        eyebrow: "Your packs", title: "Open Your Demo Pack",
        body: "Select the Demo Pack to see the three templates included with your account." },
      /* The whole pack view, not just the grid of designs. The pack page
         scrolls inside its own container, and centring the GRID in it pushed
         "All packs", the pack's name and its line of description off the top.
         The section is the thing the step is about: the back link, the title
         and the designs together. Dani, 12 Oct: "include everything you see on
         that screen, from All Packs to the bottom of the template ... that
         whole content is basically central, not missing some off at the top." */
      { shot: "/images/learn/demo/shots/studio-template--demo-pack@2x.webp",
        href: "/account/editor?pack=demo", target: "#ed-onboard-step2, #ed-onboard-design-grid", placement: "right", box: false,
        eyebrow: "The pack", title: "Choose Your Template",
        body: "Browse the designs in your pack and select the one you'd like to customise." },
      /* The same picture as the opening step of Make This Design Yours: both are
         the design sitting in the editor, freshly opened. One file, two walks. */
      { shot: "/images/learn/demo/shots/editor--design-open@2x.webp",
        href: "/account/editor?training=1", target: "#ed-canvas-shadow", placement: "left",
        eyebrow: "Your copy", title: "Your Design Is Ready to Edit",
        body: "The Studio creates your own editable copy, leaving the original template untouched." },
    ],
  },

  "studio-make-yours": {
    title: "Make This Design Yours",
    // What the box on the lesson says, in Dani's words (12 Oct).
    lead: "Make a Design Yours",
    line: "See how to apply your saved brand colours and fonts to an existing template.",
    stage: "/account/editor?training=1",
    steps: [
      /* The rail's Brand tab is hidden for a member on a social design - the
         brand kit lives under Start, as "Make it yours". These steps pointed at
         the old tab, so the whole walk ran on a panel a member cannot open.
         Dani, 9 Oct. */
      /* The editor is an app shell: it does not scroll, so one frameful is the
         whole of it and no offset is needed. */
      { shot: "/images/learn/demo/shots/editor--design-open@2x.webp",
        target: '[data-start-tool="brand"]', placement: "right", padding: 8, open: '[data-tool="start"]',
        eyebrow: "Brand", title: "Your Brand Kit, in the Studio",
        body: "The Brand tab gives you access to your saved colours, fonts and logos. You'll need to complete your Brand Kit first to use these features." },
      { shot: "/images/learn/demo/shots/studio-make-yours--brand-panel@2x.webp",
        target: ".ed-rebrand", placement: "right", padding: 8, open: '[data-start-tool="brand"]',
        eyebrow: "Brand", title: "Make This Design Yours",
        body: "Open this section to see the colours and fonts used in your template alongside those saved in your Brand Kit." },
      { shot: "/images/learn/demo/shots/studio-make-yours--colours-applied@2x.webp",
        target: ".ed-rb-row[data-from]", placement: "right", padding: 8, open: '[data-start-tool="brand"]',
        eyebrow: "Brand", title: "Apply Your Colours",
        body: "Choose a replacement from your saved colours. Every element using the original colour will update together." },
      { shot: "/images/learn/demo/shots/studio-make-yours--fonts-applied@2x.webp",
        target: ".ed-rb-font", placement: "right", padding: 8, open: '[data-start-tool="brand"]',
        eyebrow: "Brand", title: "Update Your Fonts",
        body: "Replace the template's fonts with those saved in your Brand Kit, updating matching text throughout the design." },
      { shot: "/images/learn/demo/shots/studio-make-yours--one-colour@2x.webp",
        target: "#brand-colour-grid", placement: "right", padding: 8, select: "shape", open: '[data-start-tool="brand"]',
        eyebrow: "Brand", title: "Change Individual Colours",
        body: "Select an element first, then choose a colour to change just that element without affecting the rest of your design." },
      { shot: "/images/learn/demo/shots/studio-make-yours--logo-placed@2x.webp",
        target: "#brand-logo-grid", placement: "right", padding: 8, select: "", open: '[data-start-tool="brand"]',
        eyebrow: "Brand", title: "Add Your Logo",
        body: "Choose a logo from your Brand Kit to add it to the design. Your logo may already have been applied automatically." },
    ],
  },

  "studio-text": {
    title: "Changing the Words",
    stage: "/account/editor?training=1",
    steps: [
      { shot: "/images/learn/demo/shots/studio-text--1-text-selected@2x.webp",
        target: ".ed-element.is-selected", placement: "left", padding: 10, select: "heading",
        eyebrow: "Text", title: "Edit Text on the Design",
        body: "Double-click any text to edit it directly. You can replace the wording or highlight individual words to make smaller changes." },
      { shot: "/images/learn/demo/shots/studio-text--2-fonts@2x.webp",
        target: "#ed-context", placement: "bottom", padding: 8, select: "heading",
        eyebrow: "Text", title: "Font, Size and Colour",
        body: "Select a text box to change its font, size, colour, alignment and other formatting using the toolbar above your design." },
      { shot: "/images/learn/demo/shots/studio-text--3-wording-changed@2x.webp",
        target: '[data-tool="text"]', placement: "right", padding: 8, select: "",
        eyebrow: "Text", title: "Use the Text Panel",
        body: "Prefer not to edit directly on the design? The Text panel lets you find and change your wording from the side menu." },
      /* Every text on the page, in one list: the Edit pane, opened from Edit
         in the Start menu. The list moved there from the Text panel, which is
         why it went from this walk for an hour on 12 Oct and came back. */
      { shot: "/images/learn/demo/shots/studio-text--4-edit-pane@2x.webp",
        target: '.ed-panel-pane[data-pane="fields"]', placement: "right", padding: 8, open: '[data-start-tool="fields"]',
        eyebrow: "Text", title: "Find Every Text Box",
        body: "Use your Start menu to find all the text on your current page in one list. Edit the wording here, or select an item to locate it on your design." },
      { shot: "/images/learn/demo/shots/studio-text--5-add-text@2x.webp",
        target: ".ed-ttabs", placement: "right", padding: 8, open: '[data-tool="text"]',
        eyebrow: "Text", title: "Explore Your Text Tools",
        body: "Use Text Selection to edit existing wording, Add Text to create something new or Fonts to change typography across your design." },
    ],
  },

  "studio-background": {
    title: "Changing the Background",
    stage: "/account/editor?training=1",
    steps: [
      { shot: "/images/learn/demo/shots/studio-background--1-background@2x.webp",
        target: '[data-tool="background"]', placement: "right", padding: 8,
        eyebrow: "Background", title: "Your Background",
        body: "The background sits behind everything else in your design. It can be an image, solid colour or gradient." },
      { shot: "/images/learn/demo/shots/studio-background--2-panel@2x.webp",
        target: "#ed-bg-thumb", placement: "right", padding: 8, open: '[data-tool="background"]',
        eyebrow: "Background", title: "Background Settings",
        body: "Here you'll find the current background and the options available for changing how it looks." },
      { shot: "/images/learn/demo/shots/studio-background--3-replaced@2x.webp",
        target: "#ed-bg-change", placement: "right", padding: 8, open: '[data-tool="background"]',
        eyebrow: "Background", title: "Replace Your Background",
        body: "Select Change Image to upload your own photo or choose one from the Studio's image libraries. Your other design elements stay in place." },
      { shot: "/images/learn/demo/shots/studio-background--3-replaced@2x.webp",
        target: "#ed-bg-fit", placement: "right", padding: 8, open: '[data-tool="background"]',
        eyebrow: "Background", title: "Fill or Fit?",
        body: "Fill covers the entire background, cropping the image if necessary. Fit shows the whole image, which may leave space around the edges." },
      { shot: "/images/learn/demo/shots/studio-background--5-adjust@2x.webp",
        target: "#ed-bg-reposition", placement: "right", padding: 8, open: '[data-tool="background"]',
        eyebrow: "Background", title: "Adjust Your Image",
        body: "Reposition your image to show the right area, rotate it or adjust its transparency to help text stand out." },
    ],
  },

  "studio-image": {
    title: "Changing an Image",
    stage: "/account/editor?training=1",
    steps: [
      { shot: "/images/learn/demo/shots/studio-image--1-selected@2x.webp",
        target: ".ed-element.is-selected", placement: "left", padding: 10, select: "image",
        eyebrow: "Images", title: "Select an Image",
        body: "Click an image in your design to select it. You'll see its outline, resizing handles and editing options." },
      { shot: "/images/learn/demo/shots/studio-image--2-gallery@2x.webp",
        target: "#ed-replace-img", placement: "right", padding: 10, select: "image",
        eyebrow: "Images", title: "Replace the Image",
        body: "Select Change Image to replace it with one of your own photos or an image from the Studio's libraries. The new image takes the original's position." },
      { shot: "/images/learn/demo/shots/studio-image--3-reposition@2x.webp",
        target: ".ed-element.is-selected", placement: "left", padding: 10, select: "image",
        eyebrow: "Images", title: "Resize and Reposition",
        body: "Drag the corners to resize your image or move it into position. Alignment guides help you keep everything neatly arranged." },
      { shot: "/images/learn/demo/shots/studio-image--4-images-panel@2x.webp",
        target: '[data-tool="photos"]', placement: "right", padding: 8, select: "",
        eyebrow: "Images", title: "Add Another Image",
        body: "Open Images to upload a new photo or browse the available libraries. Select an image to add it to your design." },
    ],
  },

  "studio-layout": {
    title: "Resizing and Repositioning",
    stage: "/account/editor?training=1",
    steps: [
      { shot: "/images/learn/demo/shots/studio-layout--1-move@2x.webp",
        target: ".ed-element.is-selected", placement: "left", padding: 10, select: "heading",
        eyebrow: "Layout", title: "Move Things Around",
        body: "Select an element, then drag it to a new position or use the arrow keys for smaller adjustments. Alignment guides appear as you move it." },
      { shot: "/images/learn/demo/shots/studio-layout--2-fit@2x.webp",
        target: "#ed-context .ed-size-ctl", placement: "bottom", padding: 10, select: "heading",
        eyebrow: "Layout", title: "Make Your Text Fit",
        body: "If your wording is longer than the original, adjust the font size or resize the text box to give it more room." },
      { shot: "/images/learn/demo/shots/studio-layout--3-layers@2x.webp",
        target: '[data-tool="layers"]', placement: "right", padding: 8, select: "",
        eyebrow: "Layers", title: "Change What's in Front",
        body: "Elements can overlap. Use Layers to move something forwards or backwards when it's sitting behind another part of your design." },
      { shot: "/images/learn/demo/shots/studio-layout--4-undo@2x.webp",
        target: "#ed-undo", placement: "bottom", padding: 8,
        eyebrow: "Undo", title: "Made a Mistake?",
        body: "Use Undo or Ctrl / Cmd + Z to reverse your changes. Your original template is always available if you want to start again." },
    ],
  },

  "studio-finish": {
    title: "Finishing Your Design",
    // What the box on the lesson says, in Dani's words (12 Oct).
    lead: "Finishing your design",
    line: "See how to download your finished design or add it to your Marketing Planner.",
    stage: "/account/editor?training=1",
    steps: [
      { shot: "/images/learn/demo/shots/studio-finish--1-download@2x.webp",
        target: "#ed-download", placement: "bottom", padding: 8,
        eyebrow: "Download", title: "Download Your Design",
        body: "Choose how you'd like to download your finished design. For social media graphics, we generally recommend PNG." },
      { shot: "/images/learn/demo/shots/studio-finish--2-planner@2x.webp",
        target: "#ed-schedule", placement: "bottom", padding: 8,
        eyebrow: "Plan", title: "Add It to Your Marketing Planner",
        body: "Select the calendar button to choose a publishing date, platform and caption, then add your design to your content calendar." },
      /* Dani's step, 12 Oct. The reminder lives inside the scheduling panel,
         so this one opens that panel first (the same calendar button the step
         above points at) and then points at the reminder itself. */
      { shot: "/images/learn/demo/shots/studio-finish--3-reminder@2x.webp",
        target: ".ed-sched-remind", placement: "left", padding: 8, open: "#ed-schedule",
        eyebrow: "Remind", title: "Set a Posting Reminder",
        body: "Arrange for your finished content to be sent to your chosen device when it's time to post, making publishing easier." },
      /* Closes the scheduling panel again, so the step about saving is not
         talking over a sheet that covers the editor. */
      { shot: "/images/learn/demo/shots/studio-finish--4-save@2x.webp",
        target: "#ed-save", placement: "bottom", padding: 8, open: "#ed-schedule-close",
        eyebrow: "Saving", title: "Save Before You Leave",
        body: "The Studio automatically saves your work, but it's worth checking that your latest changes have finished saving before closing the editor." },
    ],
  },

  "studio-designs": {
    title: "Your Saved Designs",
    // What the box on the lesson says, in Dani's words (12 Oct).
    lead: "Your saved designs",
    line: "See where your designs are stored and how to reopen them.",
    stage: "/account/editor",
    steps: [
      { shot: "/images/learn/demo/shots/studio-designs--library@2x.webp",
        target: ".ed-ob-hero", placement: "bottom",
        eyebrow: "Your designs", title: "Your Design Library",
        body: "Find every design you've created in one place. Open one to continue editing or download it again whenever you need it." },
      { shot: "/images/learn/demo/shots/studio-designs--library@2x.webp",
        target: "#ed-ob-designs-q", placement: "bottom", padding: 8,
        eyebrow: "Your designs", title: "Find a Design",
        body: "Search by name to locate a particular design. Giving your designs clear names makes them easier to find later." },
      /* Starts lower, so the ticked design and the bar with Delete on it are
         in view, not just the sort menu (Dani, 13 Oct). */
      { shot: "/images/learn/demo/shots/studio-designs--3-selected@2x.webp", shotY: 180,
        target: "#ed-ob-sort", placement: "bottom", padding: 8,
        eyebrow: "Your designs", title: "Organise Your Designs",
        body: "Sort by date, name or format. You can also select designs to duplicate, organise into folders, add to your Marketing Planner or delete." },
    ],
  },

  /* ---- Your First Print Design (training-guides.js, PRINT_GUIDES) ----
     For The Experts Group's agents. Copy: Dani's review, 13 Oct. Pictures
     30 Oct, from the training account given The Property Experts for the
     day (pack-access.js TRAINING_BRANDS): Alex Mercer on TPE's Valuation
     Invitation canvassing card, with the brand photo Dani chose for him.
     Every step is a picture, so the walks never need the pack itself. */
  "print-find": {
    title: "Find Your Print Templates",
    lead: "Find your print templates",
    line: "Open the Studio, find your print packs and choose the canvassing card you'd like to personalise.",
    stage: "/account/studio",
    steps: [
      { shot: "/images/learn/demo/shots/print-find--1-print-packs-v3@2x.webp",
        target: ".st-kinds", placement: "bottom", padding: 8,
        eyebrow: "Your packs", title: "Find Your Print Packs",
        body: "Open the Studio and select Print under Your Packs to see the print templates available to you." },
      { shot: "/images/learn/demo/shots/print-find--2-open-pack-v3@2x.webp",
        target: ".st-row--print .st-pack", placement: "bottom", padding: 8,
        eyebrow: "Your packs", title: "Open Canvassing Cards",
        body: "Select the Canvassing Cards pack to see the designs included." },
      { shot: "/images/learn/demo/shots/print-find--3-pack-v3@2x.webp",
        target: "#ed-onboard-design-grid", placement: "top", padding: 8,
        eyebrow: "The pack", title: "Choose Your Template",
        body: "Each card has a different purpose. Select the design you'd like to personalise to open it in the editor." },
    ],
  },
  "print-details": {
    title: "Your Brand Details",
    lead: "Your brand details",
    line: "See which of your details are added for you, and where to check them.",
    stage: "/account/editor",
    steps: [
      { shot: "/images/learn/demo/shots/print-details--1-card@2x.webp",
        target: ".ed-panel-pane[data-pane=\"fields\"]", placement: "right", padding: 8, open: "[data-start-tool=\"fields\"]",
        eyebrow: "Your details", title: "Your Details, Already Added",
        body: "Your name, contact details and branding are added from your Brand Kit as soon as the card opens." },
      { shot: "/images/learn/demo/shots/print-details--2-brand-kit@2x.webp",
        path: "/account/profile", target: "#sec-about", placement: "bottom", padding: 8,
        eyebrow: "Brand Kit", title: "Need to Make a Change?",
        body: "Open your Brand Kit to check or change your details. Any change you make there comes through when you reopen the template." },
    ],
  },
  "print-edit": {
    title: "Edit Your Card",
    lead: "Edit your card",
    line: "Use the Edit panel to change the wording and photography on both sides of your card.",
    stage: "/account/editor",
    /* The front first, as people do (Dani, 30 Oct), then the back. The
       wording is the template's own message with its blanks filled in, as
       long as the original, so the card looks the way it should. */
    steps: [
      { shot: "/images/learn/demo/shots/print-edit--1-panel-front@2x.webp",
        target: ".ed-panel-pane[data-pane=\"fields\"]", placement: "right", padding: 8, open: "[data-start-tool=\"fields\"]",
        eyebrow: "Edit", title: "Your Edit Panel",
        body: "Open Edit to see every part of your card you can change, front and back." },
      { shot: "/images/learn/demo/shots/print-edit--2-add-photo@2x.webp",
        target: ".ed-panel-pane[data-pane=\"fields\"]", placement: "right", padding: 8,
        eyebrow: "Edit", title: "Replace a Photo",
        body: "In the Edit panel, select Add a picture (or Change, once there's one in place), then click to upload your own property photo or drag one in." },
      { shot: "/images/learn/demo/shots/print-edit--3-adjust-photo-v3@2x.webp",
        target: ".ed-sel-reposition", placement: "right", padding: 8,
        eyebrow: "Edit", title: "Adjust the Photo",
        body: "Select the photo on your card, then Reposition, to choose which part of it shows." },
      { shot: "/images/learn/demo/shots/print-edit--4-wording@2x.webp",
        target: ".ed-panel-pane[data-pane=\"fields\"]", placement: "right", padding: 8,
        eyebrow: "Edit", title: "Change the Wording",
        body: "On the back of your card, select a text box in the Edit panel and type your own wording. Your card updates as you type." },
      { shot: "/images/learn/demo/shots/print-edit--5-assistant-v2@2x.webp",
        target: "#ed-rail-assistant", placement: "right", padding: 8,
        eyebrow: "Creative Assistant", title: "Help With the Wording",
        body: "Select Assistant, then What to write, and tell it what your card is for. It will help you draft your message." },
    ],
  },
  "print-qr": {
    title: "Set Up Your QR Code",
    lead: "Set up your QR code",
    line: "Choose where your QR code takes people, then update it and test it before you download.",
    stage: "/account/editor",
    steps: [
      { shot: "/images/learn/demo/shots/print-qr--1-destination-v2@2x.webp",
        target: ".ed-field-pic.is-qr", placement: "right", padding: 8, open: "[data-start-tool=\"fields\"]",
        eyebrow: "QR code", title: "Add Your Link",
        body: "Your QR code takes people to your brand website unless you change it. To send them somewhere more relevant, such as a property listing or your valuation page, add the link in the Edit panel." },
      { shot: "/images/learn/demo/shots/print-qr--2-whatsapp-v2@2x.webp",
        target: ".ed-field-pic.is-qr", placement: "right", padding: 8,
        eyebrow: "QR code", title: "Or Use WhatsApp",
        body: "Select WhatsApp, check your mobile number and add an optional opening message." },
      { shot: "/images/learn/demo/shots/print-qr--3-update-v2@2x.webp",
        target: ".ed-field-pic.is-qr .ed-qr-go", placement: "right", padding: 8,
        eyebrow: "QR code", title: "Update and Test",
        body: "Select Update QR code to save your change. Then test it: open your phone's camera, point it at the QR code on your screen and check the link that appears takes you to the right place." },
    ],
  },
  "print-download": {
    title: "Download Your Print Design",
    lead: "Download your print design",
    line: "Download your finished card as a PDF with both sides in one file.",
    stage: "/account/editor",
    steps: [
      { shot: "/images/learn/demo/shots/print-download--front@2x.webp",
        target: "#ed-download", placement: "bottom", padding: 8, open: "#ed-download-trigger",
        eyebrow: "Download", title: "Download Your Design",
        body: "Open Download. PDF is already selected for print designs, so choose Download to save your finished file." },
      { shot: "/images/learn/demo/shots/print-download--front@2x.webp",
        target: "#ed-download-menu", placement: "left", padding: 8,
        eyebrow: "Download", title: "Both Sides, One File",
        body: "Your PDF contains the front and back of your canvassing card, ready to send to your printer." },
    ],
  },

  /* Dani's revised Planner course (18 Oct): a short tour of the page, then a
     focused walk for each job. Every step sets up its own pop-out from the
     page (`open` clicks each in turn: the tab, a day from today, the button,
     the activity), so stepping back lands right. Optional fields aren't
     walked one by one. */
  "planner": {
    title: "Around Your Planner",
    lead: "Around your Planner",
    stage: "/account/schedule",
    steps: [
      { path: "/account/schedule", target: null, placement: "center", open: PL_MP,
        eyebrow: "Plan", title: "Your Planner",
        body: "Your posts, campaigns, shoots, print and the rest of your marketing, together in one place." },
      { path: "/account/schedule", target: ".cal-view", placement: "bottom", open: PL_MP,
        eyebrow: "Two tabs", title: "Marketing Planner or Content Calendar",
        body: "Marketing Planner for your marketing activities. Content Calendar for your posts, post ideas and key dates." },
      { path: "/account/schedule", target: ".cal-brief", placement: "bottom", open: PL_MP,
        eyebrow: "At a glance", title: "What's Coming Up",
        body: "Your activities and posts coming up, and your next activity. The posts box opens the Content Calendar." },
      { path: "/account/schedule", target: "#cal-sync", placement: "bottom", open: PL_MP,
        eyebrow: "Your calendar", title: "Sync Your Calendar",
        body: "Add both tabs to Apple Calendar, Google Calendar or Outlook, alongside your other commitments." },
      /* The colour key is hidden at the training window's width, so the
         colours are told here, on the month itself. */
      { path: "/account/schedule", target: "#cal-grid", placement: "top", open: PL_MP,
        eyebrow: "The month", title: "Choose a Day",
        body: "Select a day to add a marketing activity; the date is filled in. Each group of activity has its own colour." },
      { path: "/account/schedule", target: ".cal-brief", placement: "bottom", open: PL_CC,
        eyebrow: "Content Calendar", title: "Your Content Plan",
        body: "The first box opens this month's content plan, or creates it. Then your posts coming up, and the next one." },
      { path: "/account/schedule", target: ".day-panel", placement: "left", open: [PL_CC, PL_DAY],
        eyebrow: "Your day", title: "See What's Planned",
        body: "Open a day to see what's on it and its post idea when there is one. Select anything planned to check it or make changes." },
    ],
  },

  "post-plan": {
    title: "Plan Your Social Media Post",
    lead: "Plan your social media post",
    stage: "/account/schedule",
    steps: [
      { path: "/account/schedule", target: "#day-pick", placement: "top", open: [PL_CC, PL_DAY],
        eyebrow: "Content Calendar", title: "Plan a Post for This Day",
        body: "Open a day in your Content Calendar and choose Plan a post for this day." },
      { path: "/account/schedule", target: "#act-form .act-book-cards", placement: "bottom", open: [PL_CC, PL_DAY, "#day-pick"],
        eyebrow: "Choose your route", title: "Three Ways to a Post",
        body: "Use a saved Studio design, start from a template, or upload a post made elsewhere." },
      { path: "/account/schedule", target: "#pick-step-upload", placement: "left", open: [PL_CC, PL_DAY, "#day-pick", '[data-post-route="upload"]'],
        eyebrow: "Made elsewhere", title: "Upload a Post",
        body: "Add a PNG, JPEG or PDF, or a link to it, then continue to plan it." },
      { path: "/account/schedule", target: "#pick-continue", placement: "top", open: [PL_CC, PL_DAY, "#day-pick", '[data-post-route="upload"]'],
        eyebrow: "Finish your post", title: "Caption, Time and Reminder",
        body: "Next, add your caption, with Generate with AI if you like, and the time. Remind me on the day emails you the design and caption at 8am." },
    ],
  },

  "plan-filming": {
    title: "Add a Filming Session",
    lead: "Add a filming session",
    stage: "/account/schedule",
    steps: [
      { path: "/account/schedule", target: '#act-choose .act-cat:has([data-act="property_shoot"])', placement: "left", open: [PL_MP, PL_DAY, "#day-plan"],
        eyebrow: "Choose a session", title: "Photography and Filming",
        body: "Property photography or filming sits in Property Marketing. Studio sessions and filming days sit in Content & Social." },
      { path: "/account/schedule", target: "#act-form .act-book-cards", placement: "bottom", open: [PL_MP, PL_DAY, "#day-plan", '[data-act="property_shoot"]'],
        eyebrow: "Book or add", title: "Book It With Us, or Add It",
        body: "Book with TMKE, see what's included or download the brochure. Already arranged? Add it yourself." },
      { path: "/account/schedule", target: "#act-form", placement: "left", open: [PL_MP, PL_DAY, "#day-plan", '[data-act="property_shoot"]', '[data-act-log="0"]'],
        eyebrow: "Check your calendar", title: "Arranged It Yourself",
        body: "Add the date, time and address, then save. A booking made with TMKE appears on its own." },
    ],
  },

  "plan-campaign": {
    title: "Plan a Campaign",
    lead: "Plan a campaign",
    stage: "/account/schedule",
    steps: [
      { path: "/account/schedule", target: '#act-choose .act-cat:has([data-act="story_of_sale"])', placement: "left", open: [PL_MP, PL_DAY, "#day-plan"],
        eyebrow: "Choose your campaign", title: "Four Campaigns",
        body: "Story of the Sale, a new listing, an open house or a seasonal campaign. Pick the one that fits." },
      { path: "/account/schedule", target: "#act-form .act-check", placement: "left", open: [PL_MP, PL_DAY, "#day-plan", '[data-act="property_launch"]'],
        eyebrow: "Make it yours", title: "A Checklist to Adapt",
        body: "Tick steps off as you go, take out what you don't need and add your own." },
      { path: "/account/schedule", target: '#act-form [data-designs="linkedDesigns"]', placement: "left", open: [PL_MP, PL_DAY, "#day-plan", '[data-act="property_launch"]'],
        eyebrow: "Link your designs", title: "Designs and Posts",
        body: "Link designs from your Studio, then Plan these posts puts each one on its day in your Content Calendar." },
    ],
  },

  "plan-print": {
    title: "Plan Print Marketing",
    lead: "Plan print marketing",
    stage: "/account/schedule",
    steps: [
      { path: "/account/schedule", target: '#act-choose .act-cat:has([data-act="print_design"])', placement: "left", open: [PL_MP, PL_DAY, "#day-plan"],
        eyebrow: "Choose a print activity", title: "Print & Canvassing",
        body: "Create a print design, order print marketing or plan a leaflet drop." },
      { path: "/account/schedule", target: "#act-form .act-btns", placement: "bottom", open: [PL_MP, PL_DAY, "#day-plan", '[data-act="print_design"]'],
        eyebrow: "Your print tools", title: "Straight to Your Print Packs",
        body: "Open your print packs, or start a new print design in the Studio." },
      { path: "/account/schedule", target: "#act-form .act-files", placement: "left", open: [PL_MP, PL_DAY, "#day-plan", '[data-act="print_design"]'],
        eyebrow: "Keep it together", title: "Files, Links and Notes",
        body: "Add the files, links, notes and checklist items you'll want to hand, then save." },
    ],
  },

  "plan-testimonial": {
    title: "Prepare a Testimonial Request",
    lead: "Prepare a testimonial request",
    stage: "/account/schedule",
    steps: [
      { path: "/account/schedule", target: "#act-form .act-testi-tones", placement: "bottom", open: [PL_MP, PL_DAY, "#day-plan", '[data-act="review_request"]'],
        eyebrow: "Choose a style", title: "Three Ways to Ask",
        body: "Friendly and Personal, Professional and Appreciative, or Short and Direct." },
      { path: "/account/schedule", target: "#act-form .act-testi-channel", placement: "bottom", open: [PL_MP, PL_DAY, "#day-plan", '[data-act="review_request"]', "#act-form [data-testi-tone]"],
        eyebrow: "Email or WhatsApp", title: "Choose How You'll Send It",
        body: "Switch between the email and WhatsApp versions and check the wording." },
      { path: "/account/schedule", target: "#act-form .act-testi-out", placement: "top", open: [PL_MP, PL_DAY, "#day-plan", '[data-act="review_request"]', "#act-form [data-testi-tone]"],
        eyebrow: "Personalise and copy", title: "Ready to Send",
        body: "Add the client's name, check the review link from your Brand Kit, then copy the message and send it yourself." },
    ],
  },
};

export const WALK_LIST = Object.keys(WALKS).map((id) => ({ id, title: WALKS[id].title }));
