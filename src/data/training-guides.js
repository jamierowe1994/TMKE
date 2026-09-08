// Training — how to use the hub. Four short courses, one per part of the
// hub, each lesson a page of the reader with, where it helps, a "Show me"
// walkthrough on the real page (src/data/walkthroughs.js) and room for a
// video. They ship with the site; a published guide in the database with the
// same slug takes over, so any of them can be edited in Admin → Guides.
//
// `training: true` keeps them out of the Learn grid: they live in the
// Training section at the top of Learn instead.

const p = (t) => `<p>${t}</p>`;
const ph = (label) => `<figure class="ci-ph" data-ph="${label}"><span>${label}</span></figure>`;
const pillars = (items) => `<div class="ci-pillars">${items.map(([t, b]) => `<div class="ci-pillar ci-pillar--static">${ph("Image")}<strong>${t}</strong><span>${b}</span></div>`).join("")}</div>`;
const steps = (items) => `<div class="ci-grid">${items.map(([t, b], i) => `<article class="ci-card"><span class="ci-no">${String(i + 1).padStart(2, "0")}</span><h4>${t}</h4><p>${b}</p></article>`).join("")}</div>`;
const ul = (...items) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const tip = (t) => `<div class="ci-rhythm"><strong>Tip</strong><p>${t}</p></div>`;

const guide = (o) => ({
  kind: "course", topic: "getting-started", status: "published", audience: "members",
  training: true, cover_url: null, ...o,
});

export const TRAINING_GUIDES = [
  guide({
    slug: "training-hub",
    title: "Getting around your hub",
    summary: "Where everything lives, what each area is for, and where to go first.",
    est_minutes: 4, sort_order: 1, art: "https://assets.tmke.co.uk/living-1.webp",
    lessons: [
      { title: "The hub at a glance", walk: "hub-tour", video_url: "",
        body_html:
          p("Your Member Hub brings your TMKE tools, content and services together in one place. From creating designs and planning content to managing bookings and accessing training, everything has its own area and is always easy to get back to.") +
          p("The quickest way to get familiar with it is to explore it. Use <strong>Show me</strong> for a guided tour of the dashboard, then choose the areas you'd like to look at in more detail. You can explore them in any order and return here whenever you're ready.") +
          tip("Nothing in the walkthrough will make changes to your account, so click around and get familiar with where everything lives.") },
      { title: "Eight areas, one job each",
        body_html:
          p("Everything in your Member Hub has a clear purpose. Once you know what each area does, finding what you need becomes much quicker.") +
          pillars([
            ["Dashboard", "Home. See what's coming up, what's been planned and quickly jump back into the things you're working on."],
            ["Studio", "Create and customise your social media content. Access the packs you own, your saved designs and the Studio editor."],
            ["Planner", "See your content calendar, add upcoming posts and plan what you're publishing throughout the month."],
            ["Orders", "Find everything you've purchased from The Edit, including your packs, order details and receipts."],
            ["Bookings", "Manage your TMKE videography bookings, follow their progress and access your finished galleries."],
            ["Your SMM", "Everything relating to Social Media Management, from what's included to your current package and monthly performance."],
            ["Learn", "Your training and insights library. Find practical guides, Member Hub courses and our latest social media trends."],
            ["Brand kit", "Save your logo, colours and fonts so Studio templates automatically adapt to your brand."],
          ]) },
      { title: "Where to go first",
        body_html:
          p("If you're new to the Member Hub, start with these three things. They'll set up the basics and make everything else considerably easier.") +
          steps([
            ["Set up your brand kit", "Add your logo, colours and fonts once, then let the Studio apply them to your templates automatically."],
            ["Make one design", "Choose a template, make it your own and download your finished post. The more you use the Studio, the quicker it becomes."],
            ["Plan a week", "Add a few posts to your Planner so you can see what's coming up and start building a consistent rhythm."],
          ]) +
          tip("Need help later? Head to Learn for guides and training, or contact the TMKE team from your dashboard if you can't find what you need.") },
    ],
  }),

  guide({
    slug: "training-brand-kit",
    title: "Your brand kit",
    summary: "Logo, colours and fonts, set once, so every design opens looking like you.",
    est_minutes: 6, sort_order: 2, art: "https://assets.tmke.co.uk/white-1.webp",
    lessons: [
      { title: "Why it matters", walk: "brand-kit", video_url: "",
        body_html:
          p("Every template in the Studio reads your brand kit. Open one and the logo is yours, the colours are yours, the fonts are yours. Without a kit you'd be doing that by hand on every design.") +
          p("<strong>Show me</strong> opens your Brand kit page and points out each section. Then come back and the next three lessons cover them one by one.") },
      { title: "Your logo",
        body_html:
          p("Upload a PNG or SVG with a transparent background, so it sits on any colour. A JPG has a white box behind it and will look wrong on a dark template.") +
          ul("Add a light and a dark version if you have them. The first one is the one templates use automatically; you can swap in the Studio.",
             "A wide wordmark and a square mark are both fine. Templates fit the logo to the space, whole, never cropped.") +
          tip("If your logo is only in a Word document or an email signature, ask whoever made it for the original file. It's worth the ask.") },
      { title: "Your colours",
        body_html:
          p("Add your brand colours as hex codes, the six characters after a hash, like <code>#371E28</code>. If you only know them by sight, the picker lets you choose on screen.") +
          ul("The first two colours do most of the work: templates use them for the main fills and the text on them.",
             "Add a light neutral (an off-white or pale grey) as well as your strong colours. It gives designs somewhere to breathe.",
             "Order matters. Put the colour you'd paint the office first.") },
      { title: "Fonts, and saving",
        body_html:
          p("Pick a heading font and a body font. The preview shows them together, so you can see whether they get on. If you're unsure, a serif heading with a plain sans body is a safe, expensive-looking pair.") +
          p("The kit saves as you go. The dot next to the title shows it working; once it's settled, open the Studio and your next template is already yours.") +
          tip("You can change the kit any time. Designs you've already saved keep their look; new ones pick up the change.") },
    ],
  }),

  guide({
    slug: "training-studio",
    title: "Your first design",
    summary: "From a pack to a finished post: open, edit, make it yours, download.",
    est_minutes: 8, sort_order: 3, art: "https://assets.tmke.co.uk/table.webp",
    lessons: [
      { title: "The Studio page", walk: "studio-first-design", video_url: "",
        body_html:
          p("The Studio has two parts. The Studio page is your shelf: packs you own and designs you've saved. The editor is where a design is actually made.") +
          p("<strong>Show me</strong> walks the shelf, then opens a blank canvas in the editor and points out the toolbox, the panel, the canvas and the Download button. It's the longest walk in Training, about two minutes.") },
      { title: "Open a template, or start blank",
        body_html:
          ul("<strong>From a pack:</strong> open the pack on the Studio page and click a design. It opens already in your brand kit.",
             "<strong>From nothing:</strong> Create a design, pick a size (Instagram post, story, square), and you're on a blank canvas.",
             "<strong>From a prompt:</strong> the dashboard's content ideas open the editor with a brief to work to.") +
          p("Either way, the Start panel on the left lists the handful of things people change most, so you don't have to hunt.") },
      { title: "Changing what's there",
        body_html:
          ul("<strong>Text:</strong> double-click it and type. The font, size and colour are in the panel beside the canvas. Highlight part of a line to change just that part.",
             "<strong>Photos:</strong> click one and use Replace, or drop a new one on from Images. Search free photos at the top of the panel; your own uploads sit below.",
             "<strong>Moving things:</strong> click to select, drag to move, pull a corner to resize. Guides snap it into line with everything else.") +
          tip("Gone wrong? Undo is at the top, or Ctrl+Z. You cannot break a template: Start over is always there.") },
      { title: "Make it yours",
        body_html:
          p("A pack design opens in your colours already. If you've changed your kit since, or you're on a design from before you had one, the Brand tab has <strong>Make this design yours</strong>: one click recolours every fill and every line of text into your palette.") +
          p("The same tab lists the fonts on the design and offers your brand fonts in their place.") },
      { title: "Save, download, schedule",
        body_html:
          ul("<strong>Save</strong> keeps it in your designs on the Studio page, so you can come back to it.",
             "<strong>Download</strong> gives you a PNG or JPG ready to post, a PNG with a transparent background, or a PDF for print.",
             "<strong>Schedule</strong> sends it to your Planner on the day you choose, with a caption, so posting is one job rather than two.") +
          p("On a phone, Download opens the share sheet: Save Image puts it straight in your Photos.") },
    ],
  }),

  guide({
    slug: "training-planner",
    title: "Planning and posting",
    summary: "A calendar of what goes out and when, and a rhythm you can keep to.",
    est_minutes: 5, sort_order: 4, art: "https://assets.tmke.co.uk/orange-1.webp",
    lessons: [
      { title: "The Planner", walk: "planner", video_url: "",
        body_html:
          p("The Planner is a month of days. Every post you plan sits on its day, so you can see at a glance where the gaps are and what's coming up.") +
          p("<strong>Show me</strong> opens the Planner and points out the month, the grid and how to move around it.") },
      { title: "Adding a post",
        body_html:
          p("Click a day. Give the post a caption, choose the platform, and attach a design from your Studio if there is one. It appears on the day; click it again to edit or move it.") +
          tip("Write the caption when you plan it, not on the day. Future you will thank present you.") },
      { title: "Scheduling from the Studio",
        body_html:
          p("The faster route: finish a design in the Studio and press <strong>Schedule</strong>. Pick the day and platform, add the caption, and it's in the Planner without leaving the editor.") +
          p("The dashboard's This week strip shows the next few days from the Planner, so what's due is the first thing you see.") },
      { title: "A rhythm you can keep",
        body_html:
          p("Three posts a week, planned a week ahead, beats seven posts one week and none the next. A simple pattern that works for most agents:") +
          ul("<strong>Monday:</strong> something on the market or just sold.",
             "<strong>Wednesday:</strong> something useful: a tip, a local fact, a myth busted.",
             "<strong>Friday:</strong> something human: you, the team, the area.") +
          p("The 48 Evergreen Content Ideas guide in Learn fills the useful and human days for months.") },
    ],
  }),
];
