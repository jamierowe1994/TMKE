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
const tip = (t) => `<p class="ci-rhythm"><strong>Tip.</strong> ${t}</p>`;
// "Where to go first": a wide card with a picture beside it, the whole row a
// link to the place it talks about.
const go = (items) => items.map(([t, b, href], i) => `<a class="ci-go" href="${href}"><span class="ci-go-card"><span class="ci-no">${String(i + 1).padStart(2, "0")}</span><strong>${t}</strong><span>${b}</span></span>${ph("Image")}</a>`).join("");

const guide = (o) => ({
  kind: "course", topic: "getting-started", status: "published", audience: "members",
  training: true, cover_url: null, ...o,
});

export const TRAINING_GUIDES = [
  guide({
    slug: "training-hub",
    title: "Getting Around Your Hub",
    summary: "Where everything lives, what each area is for, and where to go first.",
    est_minutes: 4, sort_order: 1, art: "https://assets.tmke.co.uk/living-1.webp",
    lessons: [
      { title: "The Hub at a Glance", walk: "hub-tour", video_url: "",
        body_html:
          p("Your Member Hub brings your TMKE tools, content and services together in one place. From creating designs and planning content to managing bookings and accessing training, everything has its own area and is always easy to get back to.") +
          p("The quickest way to get familiar with it is to explore it. Use <strong>Show me</strong> for a guided tour of the dashboard, then choose the areas you'd like to look at in more detail. You can explore them in any order and return here whenever you're ready.") +
          tip("Nothing in the walkthrough will make changes to your account, so click around and get familiar with where everything lives.") },
      { title: "What's Where",
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
      { title: "Where to Go First",
        body_html:
          p("If you're new to the Member Hub, start with these three things. They'll set up the basics and make everything else considerably easier.") +
          go([
            ["Set up your Brand Kit", "Add your logo, colours and fonts once, then let the Studio apply them to your templates automatically.", "/account/profile"],
            ["Make one design", "Choose a template, make it your own and download your finished post. The more you use the Studio, the quicker it becomes.", "/account/editor?new=1"],
            ["Plan a week", "Add a few posts to your Planner so you can see what's coming up and start building a consistent rhythm.", "/account/schedule"],
          ]) +
          tip("Need help later? Head to Learn for guides and training, or contact the TMKE team from your dashboard if you can't find what you need.") },
    ],
  }),

  guide({
    slug: "training-brand-kit",
    title: "Your Brand Kit",
    summary: "Logo, colours and fonts, set once, so every design opens looking like you.",
    est_minutes: 6, sort_order: 2, art: "https://assets.tmke.co.uk/white-1.webp",
    lessons: [
      { title: "Why It Matters", walk: "brand-kit", video_url: "",
        body_html:
          p("Your Brand Kit stores the visual ingredients that make your content recognisably yours: your logo, colours and fonts.") +
          p("Once they're added, the Studio can automatically apply them when you open compatible templates. That means less time changing colours and fonts manually, and a much more consistent look across your content.") },
      { title: "Your Logo",
        body_html:
          p("Upload the highest-quality version of your logo you have, ideally a PNG or SVG with a transparent background. This allows it to sit cleanly over different colours and images without a white box around it.") +
          p("If your branding includes alternative versions, such as light, dark, landscape or icon versions, add those too. You'll then have the right version available when you need it.") +
          tip("Only have your logo in a document or email signature? Ask whoever created your branding for the original files. They'll give you much better results.") },
      { title: "Your Colours",
        body_html:
          p("Add your main brand colours using their hex codes, such as <code>#371E28</code>. If you don't know the codes, you can also use the colour picker to find the closest match.") +
          p("Start with the colours you use most often, then add any supporting or neutral colours in your palette. A lighter neutral can be particularly useful for backgrounds and creating contrast in your designs.") +
          p("The order matters because your primary colours will be prioritised when templates adapt to your brand.") },
      { title: "Fonts, and Saving",
        body_html:
          p("Choose a heading font and a body font that reflect your existing branding. The preview lets you see how they work together before you start using them across your designs.") +
          p("Your Brand Kit saves automatically as you make changes. Once everything is set, head into the Studio and your brand will be ready to use.") +
          tip("You can update your brand kit any time. Existing saved designs will keep their current styling, while new designs will use your latest settings.") },
    ],
  }),

  guide({
    slug: "training-studio",
    title: "Your First Design",
    summary: "From a pack to a finished post: open, edit, make it yours, download.",
    est_minutes: 8, sort_order: 3, art: "https://assets.tmke.co.uk/table.webp",
    lessons: [
      { title: "The Studio Page", walk: "studio-first-design", video_url: "",
        body_html:
          p("The Studio is where your content comes together. From the main Studio page, you can access the packs you own, return to designs you've already started or create something new.") +
          p("Once you open a design, you'll move into the editor. That's where you can change the text, imagery, colours and other elements before saving or downloading your finished content.") },
      { title: "Open a Template, or Start Blank",
        body_html:
          ul("<strong>From a pack:</strong> open the pack on the Studio page and click a design. It opens already in your brand kit.",
             "<strong>Start from scratch:</strong> Create a design, pick a size (Instagram post, story, square), and you're on a blank canvas.",
             "<strong>From a prompt:</strong> the dashboard's content ideas open the editor with a brief to work to.") +
          p("Either way, the Start panel on the left lists the handful of things people change most, so you don't have to hunt.") },
      { title: "Changing What's There",
        body_html:
          ul("<strong>Text:</strong> double-click it and type. The font, size and colour are in the panel beside the canvas. Highlight part of a line to change just that part.",
             "<strong>Photos:</strong> click one and use Replace, or drop a new one on from Images. Search free photos at the top of the panel; your own uploads sit below.",
             "<strong>Moving things:</strong> click to select, drag to move, pull a corner to resize. Guides snap it into line with everything else.") +
          tip("Made a mistake? Use Undo at the top of the editor or Ctrl/Cmd + Z. Don't worry about experimenting, you can always undo a change or start again.") },
      { title: "Make It Yours",
        body_html:
          p("Templates from your packs will usually open using the colours saved in your Brand Kit. If they don't, or you've updated your branding since the design was created, open the Brand tab and select <strong>Make this design yours</strong>.") +
          p("The Studio will adapt the design to your current colour palette, and you can also replace the existing fonts with those saved in your Brand Kit.") },
      { title: "Save, Download, Schedule",
        body_html:
          ul("<strong>Save</strong> keeps it in your designs on the Studio page, so you can come back to it.",
             "<strong>Download</strong> gives you a PNG or JPG ready to post, a PNG with a transparent background, or a PDF for print.",
             "<strong>Schedule</strong> sends it to your Planner on the day you choose, with a caption, so posting is one job rather than two.") +
          p("On a phone, Download opens the share sheet: Save Image puts it straight in your Photos.") },
    ],
  }),

  guide({
    slug: "training-planner",
    title: "Planning and Posting",
    summary: "A calendar of what goes out and when, and a rhythm you can keep to.",
    est_minutes: 5, sort_order: 4, art: "https://assets.tmke.co.uk/orange-1.webp",
    lessons: [
      { title: "The Planner", walk: "planner", video_url: "",
        body_html:
          p("The Planner gives you one place to see what you're posting and when. Each planned post sits on its publishing date, making it easy to spot gaps, balance different types of content and see what's coming up.") +
          p("<strong>Show me</strong> opens the Planner and points out the month, the grid and how to move around it.") },
      { title: "Adding a Post",
        body_html:
          p("Click a day. Give the post a caption, choose the platform, and attach a design from your Studio if there is one. It appears on the day; click it again to edit or move it.") +
          tip("Add your caption while you're planning the post. It means everything is ready when publishing day arrives.") },
      { title: "Scheduling from the Studio",
        body_html:
          p("The faster route: finish a design in the Studio and press <strong>Schedule</strong>. Pick the day and platform, add the caption, and it's in the Planner without leaving the editor.") +
          p("The dashboard's This week strip shows the next few days from the Planner, so what's due is the first thing you see.") },
      { title: "A Rhythm You Can Keep",
        body_html:
          p("Consistency doesn't mean posting every day. It means finding a rhythm you can realistically maintain.") +
          p("Use the Planner to balance different types of content across the month. You might combine properties and results with educational posts, local content, personal posts and timely updates.") +
          p("Don't worry about filling every day. Start with a manageable plan, stay consistent with it and build from there.") +
          p("Need ideas? Head to Learn for our Evergreen Content course, monthly social trends and practical content guides.") },
    ],
  }),
];
