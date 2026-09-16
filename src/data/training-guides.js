import { areaImg } from "./hub-art.js";
// Training — how to use the hub. Four short courses, one per part of the
// hub, each lesson a page of the reader with, where it helps, a "Show me"
// walkthrough on the real page (src/data/walkthroughs.js) and room for a
// video. They ship with the site; a published guide in the database with the
// same slug takes over, so any of them can be edited in Admin → Guides.
//
// `training: true` keeps them out of the Learn grid: they live in the
// Getting Started row on Learn instead.

const p = (t) => `<p>${t}</p>`;
const ph = (label, src) => src
  ? `<figure class="ci-ph ci-ph--img"><img src="${src}" alt="" loading="lazy"></figure>`
  : `<figure class="ci-ph" data-ph="${label}"><span>${label}</span></figure>`;
const pillars = (items) => `<div class="ci-pillars">${items.map(([t, b, img]) => `<div class="ci-pillar ci-pillar--static">${ph("Image", img && areaImg(img))}<strong>${t}</strong><span>${b}</span></div>`).join("")}</div>`;
const steps = (items) => `<div class="ci-grid">${items.map(([t, b], i) => `<article class="ci-card"><span class="ci-no">${String(i + 1).padStart(2, "0")}</span><h4>${t}</h4><p>${b}</p></article>`).join("")}</div>`;
const ul = (...items) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const tip = (t) => `<p class="ci-rhythm"><strong>Tip.</strong> ${t}</p>`;
// "Where to go first": a wide card with a picture beside it, the whole row a
// link to the place it talks about.
const go = (items) => items.map(([t, b, href, img], i) => `<a class="ci-go" href="${href}"><span class="ci-go-card"><strong><span class="ci-no">${String(i + 1).padStart(2, "0")}</span>${t}</strong><span>${b}</span></span>${ph("Image", img && areaImg(img))}</a>`).join("");

// A row of small cards: a heading and a line, nothing numbered. Used for the
// three reasons, the four parts of a brand, and the four payoffs at the end.
const cards = (items, cols = 3) => `<div class="bk-cards bk-cards--${cols}">${items.map(([t, b]) =>
  `<div class="bk-card"><strong>${t}</strong><span>${b}</span></div>`).join("")}</div>`;
// A quiet panel for an aside that is not an instruction.
const panel = (h, body) => `<div class="bk-panel">${h ? `<strong>${h}</strong>` : ""}${body}</div>`;
// Something to go and read, at the end of a lesson.
const ctaBox = (h, body, href, label) =>
  `<a class="bk-cta" href="${href}"><span class="bk-cta-tx"><strong>${h}</strong><span>${body}</span></span><span class="bk-cta-go">${label} &rarr;</span></a>`;
// The six parts of the kit: a card each, opening onto the detail.
const openers = (items) => `<div class="bk-open-grid">${items.map(([t, b, detail], i) =>
  `<button type="button" class="bk-open" data-bk-open="bk-${i}">
     <span class="bk-open-t">${t}</span><span class="bk-open-b">${b}</span><span class="bk-open-go">Read more &rarr;</span>
   </button><div class="bk-open-body" id="bk-${i}" hidden><h3>${t}</h3>${detail}</div>`).join("")}</div>`;
// An example, set apart so nobody reads it as an instruction.
const example = (body, note) => `<div class="bk-eg"><span class="bk-eg-l">For example</span><blockquote>${body}</blockquote>${note ? `<span class="bk-eg-n">${note}</span>` : ""}</div>`;
// One picture, given room, at the end of a lesson.
const bigShot = (src, caption) => `<figure class="bk-figure"><img src="${src}" alt="" loading="lazy">${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;

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
            ["Dashboard", "Home. See what's coming up, what's been planned and quickly jump back into the things you're working on.", "dashboard"],
            ["Studio", "Create and customise your social media content. Access the packs you own, your saved designs and the Studio editor.", "studio"],
            ["Planner", "See your content calendar, add upcoming posts and plan what you're publishing throughout the month.", "planner"],
            ["Orders", "Find everything you've purchased from The Edit, including your packs, order details and receipts.", "orders"],
            ["Bookings", "Manage your TMKE videography bookings, follow their progress and access your finished galleries.", "bookings"],
            ["Your SMM", "Everything relating to Social Media Management, from what's included to your current package and monthly performance.", "smm"],
            ["Learn", "Your training and insights library. Find practical guides, Member Hub courses and our latest social media trends.", "learn"],
            ["Brand kit", "Save your logo, colours and fonts so Studio templates automatically adapt to your brand.", "brand-kit"],
          ]) },
      { title: "Where to Go First",
        body_html:
          p("If you're new to the Member Hub, start with these three things. They'll set up the basics and make everything else considerably easier.") +
          go([
            ["Set up your Brand Kit", "Add your logo, colours and fonts once, then let the Studio apply them to your templates automatically.", "/account/profile", "start-brand-kit"],
            ["Make one design", "Choose a template, make it your own and download your finished post. The more you use the Studio, the quicker it becomes.", "/account/editor?new=1", "start-design"],
            ["Plan a week", "Add a few posts to your Planner so you can see what's coming up and start building a consistent rhythm.", "/account/schedule", "start-plan"],
          ]) +
          tip("Need help later? Head to Learn for guides and training, or contact the TMKE team from your dashboard if you can't find what you need.") },
    ],
  }),

  guide({
    slug: "training-brand-kit",
    title: "Your Brand Kit",
    summary: "Set up the logos, colours and fonts behind your brand, then use them to personalise your designs, content and Creative Assistant.",
    est_minutes: 8, sort_order: 2, art: "https://assets.tmke.co.uk/white-1.webp",
    lessons: [
      { title: "Why Your Brand Kit Matters", walk: "brand-kit", video_url: "",
        body_html:
          p("<strong>Set it once. Use it everywhere.</strong>") +
          p("Your Brand Kit gives the Member Hub the information it needs to recognise your business, from your logo and colours to the way your brand sounds.") +
          p("Set it up before you start designing and the Studio can do more of the work for you. Templates can use your logo and business details, while Quick Edit can apply your colours and typography across an entire design in just a few clicks.") +
          p("Your tone of voice also gives the Creative Assistant more context when generating captions, helping its suggestions better reflect how your business communicates.") +
          p("<strong>Three reasons to set up your Brand Kit today.</strong>") +
          cards([
            ["Faster editing", "Apply your branding without changing every element individually."],
            ["More consistency", "Keep the same logos, colours and typography across your content."],
            ["Better AI output", "Give the Creative Assistant more context about your business and how you communicate."],
          ]) },

      { title: "Before You Build Your Brand Kit",
        body_html:
          p("<strong>First, know what you're building.</strong>") +
          p("Your brand isn't just your logo. It's the way your business looks, sounds and presents itself consistently, from the colours and typography you use to the language you communicate in.") +
          p("For an estate agent, that consistency matters. People might see a For Sale board today, an Instagram post next week and a property listing months later. A clear brand helps those separate moments feel like they came from the same business.") +
          p("<strong>What makes up your brand?</strong>") +
          cards([
            ["How you look", "Your logo, colours, typography and imagery."],
            ["How you sound", "Your language, personality and tone of voice."],
            ["Who you're for", "The audience you're trying to reach and the market you operate in."],
            ["What you stand for", "The impression you want people to have of your business."],
          ], 2) +
          panel("Why does it matter for an estate agent?",
            p("Your brand does some of its work before you ever speak to someone. Sellers are forming an impression through your boards, listings, website, social media and marketing long before they book a valuation. A consistent brand helps make that impression recognisable and intentional.")) +
          p("<strong>Do you already have brand guidelines?</strong>") +
          p("If you have brand guidelines, keep them nearby while setting up your Brand Kit. They should contain most of the information you'll need.") +
          p("If you don't, don't guess your way through it. Take some time to decide how you want your business to look and sound before you start creating content.") +
          ctaBox("Need to create your brand?",
            "Our Before You Post series covers the foundations behind your marketing, including your audience, positioning, brand and content strategy.",
            "/account/guides", "Read the series") },

      { title: "Build Your Brand Kit",
        body_html:
          p("Six parts to fill in. Open any of them for what to add and why it matters.") +
          openers([
            ["Business", "Your name, location and slogan",
              p("Add your business name, the area you cover and your slogan if you use one.") +
              p("Make sure they're written exactly as you'd want them to appear publicly. Your business information can be used elsewhere in the Member Hub and within your content.")],
            ["Logos", "Light and dark versions of your logo",
              p("Upload at least two versions of your logo: one dark and one light. This gives you an option that works against both light and dark backgrounds.") +
              p("Use high-quality files with transparent backgrounds wherever possible. This avoids unwanted boxes around your logo and gives you much more flexibility when designing.") +
              tip("Templates you've purchased can automatically use the logo saved in your Brand Kit, so it's worth getting this right before you start creating.")],
            ["Colours", "Up to six brand colours",
              p("Add up to six colours from your existing brand palette. Enter the hex code for each colour to make sure you're using the exact shade.") +
              panel("What's a hex code?",
                p("A hex code is the six-character reference used to identify a specific digital colour, for example <code>#E32237</code>. You'll usually find yours in your brand guidelines, or you can ask whoever created your branding.")) +
              tip("You don't need to fill all six spaces. Add the colours your business actually uses, including any neutral shades that regularly appear in your designs.")],
            ["Typography", "Your heading and body fonts",
              p("Choose one font for headings and one for body copy. The Studio uses Google Fonts, so start by searching for the fonts already used in your branding.") +
              p("Can't find yours? Look for a similar Google Font rather than choosing something completely different. Aim for a similar shape, weight and overall feel.") +
              tip("If you already have brand guidelines, use them as your starting point rather than choosing new fonts simply because you prefer them.")],
            ["Tone of voice", "How your brand should sound",
              p("Your tone of voice describes how your business communicates, from the personality behind your writing to the language you use with your audience.") +
              p("Add as much useful detail as you can. The Creative Assistant uses this information alongside its knowledge of property when generating captions, helping the content it creates better reflect your business.") +
              p("Not sure what to write? The next part covers what makes a useful tone of voice, what to include and an example.")],
            ["Your details", "Headshot, email and telephone number",
              p("Add your headshot, email address and telephone number. These details can then be used within selected Studio designs and your contact presets for calls to action and closing slides.") +
              ul("<strong>Headshot:</strong> a clear, recent image you're happy to use across your marketing. Square works best, around 600&times;600.",
                 "<strong>Email:</strong> the address you want customers to contact you on.",
                 "<strong>Telephone:</strong> the number you'd normally publish across your marketing.")],
          ]) },

      { title: "Finding Your Voice",
        body_html:
          p("<strong>Your tone of voice is how your business sounds.</strong>") +
          p("Tell us how you communicate with your audience and the Creative Assistant can use that context when helping you write captions. The more useful detail you provide, the better it can understand how your business should sound.") +
          p("<strong>Think about:</strong>") +
          cards([
            ["Your audience", "Who are you usually speaking to? First-time buyers, families, landlords, downsizers, premium homeowners or a broad local market?"],
            ["Your personality", "Should you sound friendly, confident, knowledgeable, conversational, polished, direct or something else?"],
            ["Your language", "Do you keep things simple and informal, or is your communication more considered and professional?"],
            ["Your market position", "Are you a premium agency, an approachable local independent, a personal agent or something different?"],
            ["What to avoid", "Are there words, phrases, clich&eacute;s, emojis or styles of writing that simply don't sound like you?"],
          ]) +
          tip("That last one is worth keeping. Telling AI what you don't sound like can be just as useful as telling it what you do.") +
          example(
            p("We're a friendly, knowledgeable independent estate agency speaking mainly to homeowners and families in our local area. Our tone should feel confident and professional without being formal. We use straightforward language, keep property jargon to a minimum and want our social media to sound like a real person rather than corporate marketing. Avoid clich&eacute;s, excessive emojis and over-the-top sales language."),
            "Not a script to copy - it shows the kind of detail that's useful.") },

      { title: "Put Your Brand Kit to Work",
        body_html:
          p("Once your Brand Kit is set up, you don't need to rebuild your branding every time you create something.") +
          cards([
            ["Open a template", "Your saved logo and business information can already be applied."],
            ["Quick Edit", "Apply your colours and typography across an entire design in a few clicks."],
            ["Create a caption", "Your tone of voice gives the Creative Assistant more context about how your business communicates."],
            ["Add your details", "Use your saved headshot and contact information to quickly create calls to action and closing slides."],
          ], 2) +
          bigShot(areaImg("brand-kit"), "Your Brand Kit, saved once and used everywhere") +
          panel("Changed your branding?",
            p("Update your Brand Kit whenever you need to. Your latest details will then be ready for the next thing you create.")) },
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
