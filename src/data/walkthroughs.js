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
// back on that lesson. Selectors are the pages' own ids and classes, so a
// page change here is the place to look when a step starts skipping.

const DASHBOARD_STEPS = [
  { path: "/account", target: ".ws-tabs", placement: "bottom",
    eyebrow: "Dashboard", title: "Everything Within Reach.",
    body: "Your main navigation stays at the top of the Member Hub, so Dashboard, Studio, Planner, Orders, Bookings, Your SMM and Shop are always one click away." },
  { path: "/account", target: ".ws-hero", placement: "bottom",
    eyebrow: "Dashboard", title: "Today, at a Glance.",
    body: "The dashboard opens on what needs your attention: the day's date, what's planned, and a line or two about where you're up to." },
  { path: "/account", target: 'section[aria-labelledby="plan-h"]', placement: "top",
    eyebrow: "Dashboard", title: "What's Planned.",
    body: "Your week's posts, pulled from the Planner. Anything you schedule shows here on the day it goes out." },
  { path: "/account", target: 'section[aria-labelledby="studio-h"]', placement: "top",
    eyebrow: "Dashboard", title: "Get Creative.",
    body: "Access your packs and recent designs, with a shortcut into the Studio. Pick up where you left off or start something new." },
  { path: "/account", target: ".ws-nav-right", placement: "bottom",
    eyebrow: "Dashboard", title: "Notifications, and You.",
    body: "Order and booking updates land in the bell. Your name opens the menu with your Brand kit, billing and sign out." },
];

// The hub menu: one short walk per area. Each comes back here when it ends,
// and a tick marks the ones already done.
const HUB_MENU = {
  path: "*", target: null, placement: "center", menu: [
    { walk: "dashboard",   label: "Dashboard", note: "Home. See what's coming up, what's been planned and quickly jump back into the things you're working on." , art: areaImg("dashboard")},
    { walk: "studio-tour", label: "Studio",    note: "Create and customise your social media content. Access the packs you own, your saved designs and the Studio editor." , art: areaImg("studio")},
    { walk: "planner",     label: "Planner",   note: "See your content calendar, add upcoming posts and plan what you're publishing throughout the month." , art: areaImg("planner")},
    { walk: "orders",      label: "Orders",    note: "Find everything you've purchased from The Edit, including your packs, order details and receipts." , art: areaImg("orders")},
    { walk: "bookings",    label: "Bookings",  note: "Manage your TMKE videography bookings, follow their progress and access your finished galleries." , art: areaImg("bookings")},
    { walk: "smm",         label: "Your SMM",  note: "Everything relating to Social Media Management, from what's included to your current package and monthly performance." , art: areaImg("smm")},
    { walk: "learn",       label: "Learn",     note: "Your training and insights library. Find practical guides, Member Hub courses and our latest social media trends." , art: areaImg("learn")},
    { walk: "brand-kit",   label: "Brand Kit", note: "Save your logo, colours and fonts so Studio templates automatically adapt to your brand." , art: areaImg("brand-kit")},
  ],
  eyebrow: "Around the hub", title: "Where Next?",
  body: "Pick an area for a short walk. Each brings you back here, with a tick on the ones you've done. Done returns to the lesson.",
};

export const WALKS = {
  // The full hub tour: a look at the dashboard, then the menu of areas.
  "hub-tour": {
    title: "Around the Hub",
    steps: [
      { path: "/account", target: null, placement: "center", skipToMenu: true,
        eyebrow: "Around the hub", title: "Take a Look Around.",
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
        eyebrow: "Studio", title: "The Packs You Own.",
        body: "Each pack is a set of ready-made templates. Open one and every design in it is already in your brand kit's colours." },
      { path: "/account/studio", target: 'section[aria-labelledby="designs-h"]', placement: "top",
        eyebrow: "Studio", title: "Your Saved Designs.",
        body: "Everything you've saved lives here. Open a design to keep editing or duplicate it to create another version." },
      { path: "/account/studio", target: 'section[aria-labelledby="tools-h"]', placement: "top",
        eyebrow: "Studio", title: "Quick Tools.",
        body: "Shortcuts for the jobs that don't need a full design." },
      { path: "/account/studio", target: 'section[aria-labelledby="inspo-h"]', placement: "top",
        eyebrow: "Studio", title: "Need Some Inspiration?",
        body: "Find content ideas, seasonal inspiration and shortcuts to useful resources when you're not sure what to create next." },
    ],
  },

  "orders": {
    title: "Orders",
    steps: [
      { path: "/account/orders", target: ".ord-hero", placement: "bottom",
        eyebrow: "Orders", title: "Everything You've Bought.",
        body: "Packs, add-ons and anything else from The Edit, in one place." },
      { path: "/account/orders", target: 'section[aria-labelledby="ord-sum-h"]', placement: "top",
        eyebrow: "Orders", title: "The Totals.",
        body: "How many packs you own and what you've spent, at a glance." },
      { path: "/account/orders", target: 'section[aria-labelledby="ord-list-h"]', placement: "top",
        eyebrow: "Orders", title: "Each Order.",
        body: "Open one for its receipt and a link straight into the pack in the Studio." },
    ],
  },

  "bookings": {
    title: "Bookings",
    steps: [
      { path: "/account/bookings", target: ".bk-hero", placement: "bottom",
        eyebrow: "Bookings", title: "Your Videography.",
        body: "Shoots you've booked with us, and the button to book another." },
      { path: "/account/bookings", target: "#bk-upcoming-sec", placement: "top",
        eyebrow: "Bookings", title: "Upcoming.",
        body: "Your booked shoots, with the date, time and location for each. Book another from here." },
      { path: "/account/bookings", target: "#bk-progress-sec", placement: "top",
        eyebrow: "Bookings", title: "In Progress.",
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
        eyebrow: "Your SMM", title: "Managed Social Media.",
        body: "If we manage your social media, this is where you can view your plan and keep track of how it's performing. If we don't, you can explore our Social Media Management packages and see how TMKE can support you." },
      { path: "/account/social", target: 'section[aria-labelledby="soc-svc-h"]', placement: "top",
        eyebrow: "Your SMM", title: "What's Included.",
        body: "The plans, what each covers, and the brochure. Ask us from here." },
      { path: "/account/social", target: 'section[aria-labelledby="soc-plan-h"]', placement: "top",
        eyebrow: "Your SMM", title: "Your Plan.",
        body: "The package you're on, what's in it, and who's looking after it." },
      { path: "/account/social", target: 'section[aria-labelledby="soc-perf-h"]', placement: "top",
        eyebrow: "Your SMM", title: "How It's Going.",
        body: "Your monthly performance in one place: reach, audience growth, top-performing content and what we're focusing on next." },
    ],
  },

  "learn": {
    title: "Learn",
    steps: [
      { path: "/account/guides", target: 'section[aria-labelledby="topics-h"]', placement: "bottom",
        eyebrow: "Learn", title: "Explore by Topic.",
        body: "Training and resources are organised by subject, making it easy to find help with whatever you're working on." },
      { path: "/account/guides", target: "#training", placement: "top",
        eyebrow: "Learn", title: "Getting Started.",
        body: "Four short courses on using your Member Hub, each with a guided look at the real page. Your progress is saved as you go." },
      { path: "/account/guides", target: 'section[aria-labelledby="month-h"]', placement: "top",
        eyebrow: "Learn", title: "What's Trending.",
        body: "Five social media trends we're watching this month, including what they are, why they work and how you could use them in property." },
      { path: "/account/guides", target: "#notes", placement: "top",
        eyebrow: "Learn", title: "Notes from the Desk.",
        body: "Our latest blog posts, for a longer read on marketing and the property market. The full archive is under Blog in your menu." },
      { path: "/account/guides", target: "#lrn-guides", placement: "top",
        eyebrow: "Learn", title: "Guides and Insights.",
        body: "Practical advice covering content, social media and marketing strategy. Use them when you want to learn something new or need some inspiration." },
    ],
  },

  "brand-kit": {
    title: "Your Brand Kit",
    steps: [
      { path: "/account/profile", target: null, placement: "center",
        eyebrow: "Brand kit", title: "Set It Once, Use It Everywhere.",
        body: "Your logo, colours and fonts live here. Every template you open reads them, so a design is on-brand before you touch it." },
      { path: "/account/profile", target: "#logo-grid", placement: "right",
        eyebrow: "Logos", title: "Your Logo.",
        body: "Upload a PNG or SVG with a transparent background. Add more than one if you have a light and a dark version; the first is the one templates use." },
      { path: "/account/profile", target: "#colour-grid", placement: "right",
        eyebrow: "Colours", title: "Your Palette.",
        body: "Add your brand colours as hex codes. The first two do most of the work: templates recolour their main fills and text with them." },
      { path: "/account/profile", target: "#type-preview", placement: "left",
        eyebrow: "Fonts", title: "Your Type.",
        body: "Pick a heading font and a body font. The preview shows how they sit together; the Studio offers them first in every font list." },
      { path: "/account/profile", target: "#brand-save", placement: "bottom",
        eyebrow: "Saving", title: "It Saves as You Go.",
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
    line: "Choose a pack to see the templates inside it. Pick one and the Studio makes you your own copy, leaving the original untouched.",
    stage: "/account/studio",
    steps: [
      { target: ".ws-hero", placement: "bottom",
        eyebrow: "Studio", title: "Where It All Starts.",
        body: "The Studio homepage. Your packs, your designs and the tools you'll use, all on one page." },
      { target: 'section[aria-labelledby="packs-h"]', placement: "top",
        eyebrow: "Your packs", title: "Start From a Template.",
        body: "Every pack you own sits on this shelf, along with the demo templates that come with your Member Account." },
      { target: ".st-pack[data-demo-pack], .st-pack", placement: "bottom", padding: 8,
        eyebrow: "Your packs", title: "Open the Demo Pack.",
        body: "The templates that come with every account. Click a pack to see everything inside it." },
      // No box: the card sits beside the templates and leaves them in plain view.
      { href: "/account/editor?pack=demo", target: "#ed-onboard-design-grid", placement: "right", box: false,
        eyebrow: "The pack", title: "Every Template in It.",
        body: "The designs in this pack, ready to use. Choose the one that suits the post you want to make." },
      { href: "/account/editor?training=1", target: "#ed-canvas-shadow", placement: "left",
        eyebrow: "Your copy", title: "And It Opens.",
        body: "The Studio makes you your own copy and opens it here. The original template is untouched, so you can always come back and start it again." },
    ],
  },

  "studio-make-yours": {
    title: "Make This Design Yours",
    stage: "/account/editor?training=1",
    steps: [
      { target: '[data-tool="brand"]', placement: "right", padding: 8,
        eyebrow: "Brand", title: "Your Kit, Inside the Editor.",
        body: "Brand holds everything saved in your Brand Kit: your colours, your fonts and your logos, ready to use on the design." },
      { target: ".ed-rebrand", placement: "right", padding: 8, open: '[data-tool="brand"]',
        eyebrow: "Brand", title: "Make This Design Yours.",
        body: "One list: the colours and fonts this template uses, each with your versions beside it." },
      { target: ".ed-rb-row[data-from]", placement: "right", padding: 8, open: '[data-tool="brand"]',
        eyebrow: "Brand", title: "One Row, One Colour.",
        body: "This row is one colour the design uses and how many items carry it. Pick one of your swatches on the right and all of them change together - nothing else moves." },
      { target: ".ed-rb-font", placement: "right", padding: 8, open: '[data-tool="brand"]',
        eyebrow: "Brand", title: "And the Fonts.",
        body: "The same for type: the font the template uses, with a button to put yours in its place across every line set in it." },
      { target: "#brand-colour-grid", placement: "right", padding: 8, select: "shape", open: '[data-tool="brand"]',
        eyebrow: "Brand", title: "Or Recolour One Element.",
        body: "Select something on the design first - one is selected now - then choose a colour here to recolour just that. With nothing selected, the colour goes on the background." },
      { target: "#brand-logo-grid", placement: "right", padding: 8, select: "", open: '[data-tool="brand"]',
        eyebrow: "Brand", title: "Your Logos.",
        body: "Select a logo to place it on the design. Templates from your packs will usually have put one on already." },
    ],
  },

  "studio-text": {
    title: "Changing the Words",
    stage: "/account/editor?training=1",
    steps: [
      { target: ".ed-element.is-selected", placement: "left", padding: 10, select: "heading",
        eyebrow: "Text", title: "Type Straight Onto It.",
        body: "Click a line on the design to select it, as this one is now. Double-click and you're typing - highlight part of a line to change only that part." },
      { target: "#ed-context", placement: "bottom", padding: 8, select: "heading",
        eyebrow: "Text", title: "Font, Size and Colour.",
        body: "With a line selected, the bar above the design is its type: the font, the size, the colour, bold and italic, and how it lines up." },
      { target: '[data-tool="text"]', placement: "right", padding: 8, select: "",
        eyebrow: "Text", title: "Or Use the Text Panel.",
        body: "On a busy template the panel is quicker: it finds the words for you rather than you hunting for them on the design." },
      { target: "#ed-textlist", placement: "right", padding: 8, open: '[data-tool="text"]',
        eyebrow: "Text", title: "Every Line, Listed.",
        body: "Every piece of text on this page, in one list. Type into a row to change the wording, or press Select to jump to it on the design." },
      { target: ".ed-ttabs", placement: "right", padding: 8, open: '[data-tool="text"]',
        eyebrow: "Text", title: "Three Tabs.",
        body: "Text selection is the list you're looking at. Add text drops in a new heading or paragraph. Fonts changes the typeface across the whole design." },
    ],
  },

  "studio-background": {
    title: "Changing the Background",
    stage: "/account/editor?training=1",
    steps: [
      { target: '[data-tool="background"]', placement: "right", padding: 8,
        eyebrow: "Background", title: "The Background Panel.",
        body: "The background sits behind everything else on the page. On this template it's the photo; it could be a flat colour or a gradient instead." },
      { target: "#ed-bg-thumb", placement: "right", padding: 8, open: '[data-tool="background"]',
        eyebrow: "Background", title: "What's In There Now.",
        body: "The photo currently on the design, with everything you can do to it beside it." },
      { target: "#ed-bg-change", placement: "right", padding: 8, open: '[data-tool="background"]',
        eyebrow: "Background", title: "Change Image.",
        body: "Opens the pictures to choose from inside the panel: your own uploads, free stock photos, or one from your device. Everything else on the design stays exactly where it is." },
      { target: "#ed-bg-fit", placement: "right", padding: 8, open: '[data-tool="background"]',
        eyebrow: "Background", title: "Fill or Fit.",
        body: "Fill crops the photo to cover the whole page. Fit shows all of it, letterboxed. Fill is what a template expects." },
      { target: "#ed-bg-reposition", placement: "right", padding: 8, open: '[data-tool="background"]',
        eyebrow: "Background", title: "Move It in the Frame.",
        body: "Reposition lets you drag the photo about behind the design until the part you want is showing. Rotate turns it, and the transparency slider underneath softens it behind your words." },
    ],
  },

  "studio-image": {
    title: "Changing an Image",
    stage: "/account/editor?training=1",
    steps: [
      { target: ".ed-element.is-selected", placement: "left", padding: 10, select: "image",
        eyebrow: "Images", title: "Select What You're Replacing.",
        body: "Anything the designer placed on top of the background - a photo, a badge, a mark - can be selected with one click. This one is selected now: border, corner handles, and its own controls beside the canvas." },
      { target: "#ed-replace-img", placement: "right", padding: 10, select: "image",
        eyebrow: "Images", title: "Change Image.",
        body: "Change image opens the same chooser the background uses - your uploads, free stock, or a file from your device - and drops your picture in at the size and position the designer set." },
      { target: ".ed-element.is-selected", placement: "left", padding: 10, select: "image",
        eyebrow: "Images", title: "Then Size It.",
        body: "Drag a corner handle to resize it - corners keep the proportions, so the picture never stretches - and drag the middle to move it. Guides show when it lines up with the rest." },
      { target: '[data-tool="photos"]', placement: "right", padding: 8, select: "",
        eyebrow: "Images", title: "Adding a New One.",
        body: "Images searches free photo libraries and holds everything you've uploaded. Click a picture to drop it onto the page, then drag it where you want it." },
    ],
  },

  "studio-layout": {
    title: "Resizing and Repositioning",
    stage: "/account/editor?training=1",
    steps: [
      { target: ".ed-element.is-selected", placement: "left", padding: 10, select: "heading",
        eyebrow: "Layout", title: "Drag, Pull, Nudge.",
        body: "Selected, like this line is, anything can be moved: drag it to reposition, pull a corner to resize its box, or nudge it with the arrow keys. Guides appear as you go." },
      { target: "#ed-context .ed-size-ctl", placement: "bottom", padding: 10, select: "heading",
        eyebrow: "Layout", title: "When Your Words Don't Fit.",
        body: "This is the font size. Longer wording than the template's? Bring it down a few points here - quicker than rewriting what you wanted to say, and it keeps the design's shape." },
      { target: '[data-tool="layers"]', placement: "right", padding: 8, select: "",
        eyebrow: "Layers", title: "What's in Front of What.",
        body: "If something disappears behind the photo or a band of colour, Layers is where you move it back in front." },
      { target: "#ed-undo", placement: "bottom", padding: 8,
        eyebrow: "Undo", title: "Nothing Is Permanent.",
        body: "Undo steps back through your changes, and Ctrl or Cmd + Z does the same. You're working on your own copy, so the original template is never at risk." },
    ],
  },

  "studio-finish": {
    title: "Finishing Your Design",
    stage: "/account/editor?training=1",
    steps: [
      { target: "#ed-download", placement: "bottom", padding: 8,
        eyebrow: "Download", title: "Take It With You.",
        body: "Download offers PNG, JPG, a PNG with no background, and a print-ready PDF. For social media, PNG is the one to choose." },
      { target: "#ed-schedule", placement: "bottom", padding: 8,
        eyebrow: "Plan post", title: "Or Send It to the Planner.",
        body: "The calendar button opens the post details: the date, the platform and the caption. Plan post puts it on that day in your Planner." },
      { target: "#ed-save", placement: "bottom", padding: 8,
        eyebrow: "Saving", title: "Save Is There Too.",
        body: "The Studio saves as you work, so this is only for when you want to be certain before closing the tab." },
    ],
  },

  "studio-designs": {
    title: "Your Saved Designs",
    stage: "/account/editor",
    steps: [
      { target: ".ed-ob-hero", placement: "bottom",
        eyebrow: "Your designs", title: "Your Design Library.",
        body: "Every design you've made, newest first. Open one to carry on editing, or download it again whenever you need it." },
      { target: "#ed-ob-designs-q", placement: "bottom", padding: 8,
        eyebrow: "Your designs", title: "Find One Quickly.",
        body: "Search by name once you have a few. Naming designs as you make them pays off here." },
      { target: "#ed-ob-sort", placement: "bottom", padding: 8,
        eyebrow: "Your designs", title: "Sort the Shelf.",
        body: "Most recent, name, or format. Tick a design and you can duplicate it, move it into a folder, add it to the planner or delete it." },
    ],
  },

  "planner": {
    title: "Planning and Posting",
    steps: [
      { path: "/account/schedule", target: null, placement: "center",
        eyebrow: "Planner", title: "Your Month, Laid Out.",
        body: "The Planner gives you a clear view of what's going out and when, so you can plan ahead and spot any gaps." },
      { path: "/account/schedule", target: ".cal-hero", placement: "bottom",
        eyebrow: "The month", title: "One Month at a Time.",
        body: "The header tells you which month you're looking at and how much is planned in it." },
      { path: "/account/schedule", target: "#cal-grid", placement: "top",
        eyebrow: "The grid", title: "Click a Day to Add a Post.",
        body: "Every day is a slot. Click one to add a post: a caption, the design it goes with, and the platform. Designs you've scheduled from the Studio land here on their day." },
      { path: "/account/schedule", target: "#cal-today", placement: "bottom",
        eyebrow: "Moving around", title: "Back to Today.",
        body: "Use these controls to move between months or jump straight back to today. You don't need to fill every day, just plan a schedule you can realistically maintain." },
    ],
  },
};

export const WALK_LIST = Object.keys(WALKS).map((id) => ({ id, title: WALKS[id].title }));
