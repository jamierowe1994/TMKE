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
// `img` is either the name of one of the eight area pictures or, when a lesson
// has its own, a path from /public.
const rowImg = (img) => (!img ? null : img.charAt(0) === "/" ? img : areaImg(img));
const go = (items) => items.map(([t, b, href, img], i) => `<a class="ci-go" href="${href}"><span class="ci-go-card"><strong><span class="ci-no">${String(i + 1).padStart(2, "0")}</span>${t}</strong><span>${b}</span></span>${ph("Image", rowImg(img))}</a>`).join("");

// A row of small cards: a heading and a line, nothing numbered. Used for the
// three reasons, the four parts of a brand, and the four payoffs at the end.
const cards = (items, cols = 3) => `<div class="bk-cards bk-cards--${cols}">${items.map(([t, b, kind]) =>
  `<div class="bk-card${kind ? ` bk-card--${kind}` : ""}"><strong>${t}</strong><span>${b}</span></div>`).join("")}</div>`;
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
// A "Show me" offer that can sit anywhere in a lesson - including inside one
// of the pop-out cards, which the reader page wires up the same way. The
// reader replaces <!--WALK--> with the lesson's own walk box; this is for the
// ones that need a second, or a different, walk in the middle of the copy.
const showMe = (id, part, line) => `<div class="gr-walk">
  <span class="gr-walk-tx"><strong>See it on the page</strong><span>${line || "A guided look at the real thing. Finish brings you back here."}</span></span>
  <button type="button" class="ws-btn ws-btn--primary ws-btn--sm" data-walk="${id}" data-part="${part}">Show me &rarr;</button>
</div>`;
// A picture that deserves a proper look: a wide button in the lesson, the
// picture itself (and whatever goes with it) in the pop-out.
const shotOpen = (id, title, line, src, extra = "") => `<button type="button" class="bk-shot" data-bk-open="${id}">
    <img class="bk-shot-img" src="${src}" alt="" loading="lazy">
    <span class="bk-shot-tx"><span class="bk-shot-t">${title}</span><span class="bk-shot-b">${line}</span></span>
    <span class="bk-shot-go">Take a look &rarr;</span>
  </button><div class="bk-open-body" id="${id}" data-wide hidden><h3>${title}</h3>
    <figure class="bk-figure"><img src="${src}" alt="" loading="lazy"></figure>${extra}</div>`;
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
          p("Set it up before you start designing and the Studio can do more of the work for you. Templates can use your logo and business details, while Quick Edit can apply your colours and typography across an entire design in just a few clicks. Your tone of voice also gives the Creative Assistant more context when generating captions, helping its suggestions better reflect how your business communicates.") +
          p("<strong>Three reasons to set up your Brand Kit today.</strong>") +
          cards([
            ["Faster editing", "Apply your branding without changing every element individually."],
            ["More consistency", "Keep the same logos, colours and typography across your content."],
            ["Better AI output", "Give your Creative Assistant more context about your business."],
          ]) },

      { title: "Before You Build Your Brand Kit",
        body_html:
          p("<strong>First, know what you're building.</strong>") +
          p("Your brand isn't just your logo. It's the way your business looks, sounds and presents itself consistently, from the colours and typography you use to the language you communicate in.") +
          p("For an estate agent, that consistency matters.<br>People might see a For Sale board today, an Instagram post next week and a property listing months later. A clear brand helps those separate moments feel like they came from the same business.") +
          p("<strong>What makes up your brand?</strong>") +
          cards([
            ["How you look", "Your logo, colours, typography and imagery."],
            ["How you sound", "Your language, personality and tone of voice."],
            ["Who you're for", "The audience you're trying to reach and the market you operate in."],
            ["What you stand for", "The impression you want people to have of your business."],
          ], 2) +
          panel("Why does it matter for an estate agent?",
            p("Your brand does some of its work before you ever speak to someone. Sellers are forming an impression through your boards, listings, website, social media and marketing long before they book a valuation.<br>A consistent brand helps make that impression recognisable and intentional.")) +
          p("<strong>Do you already have brand guidelines?</strong>") +
          p("If you have brand guidelines, keep them nearby while setting up your Brand Kit. They should contain most of the information you'll need.<br>If you don't, don't guess your way through it. Take some time to decide how you want your business to look and sound before you start creating content.") +
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
            ["Tip", "That last one is worth keeping. Telling AI what you don't sound like can be just as useful as telling it what you do.", "tip"],
          ]) +
          example(
            p("We're a friendly, knowledgeable independent estate agency speaking mainly to homeowners and families in our local area. Our tone should feel confident and professional without being formal. We use straightforward language, keep property jargon to a minimum and want our social media to sound like a real person rather than corporate marketing. Avoid clich&eacute;s, excessive emojis and over-the-top sales language."),
            "Not a script to copy - it shows the kind of detail that's useful.") },

      { title: "Put Your Brand Kit to Work",
        body_html:
          p("Once your Brand Kit is set up, you don't need to rebuild your branding every time you create something.") +
          go([
            ["Open a template", "Your saved logo and business information can already be applied.", "/account/studio", "/images/learn/brand-kit/work-template-v1.jpg"],
            ["Quick Edit", "Apply your colours and typography across an entire design in a few clicks.", "/account/editor?new=1", "/images/learn/brand-kit/work-quick-edit-v1.jpg"],
            ["Create a caption", "Your tone of voice gives the Creative Assistant more context about how your business communicates.", "/account/editor?new=1", "/images/learn/brand-kit/work-caption-v1.jpg"],
            ["Add your details", "Use your saved headshot and contact information to quickly create calls to action and closing slides.", "/account/profile", "/images/learn/brand-kit/work-details-v1.jpg"],
          ]) +
          panel("Changed your branding?",
            p("Update your Brand Kit whenever you need to. Your latest details will then be ready for the next thing you create.")) },
    ],
  }),

  guide({
    slug: "training-studio",
    title: "Your First Design",
    summary: "Open your first template, make it your own and turn it into a finished post.",
    est_minutes: 10, sort_order: 3, art: "https://assets.tmke.co.uk/table.webp",
    lessons: [
      { title: "Start With a Template", walk: "studio-template", video_url: "",
        body_html:
          p("The Studio gives you everything you need to create content, whether you're starting with one of your templates or building something completely from scratch.") +
          p("For your first design, we're going to start with a template. Every Member Account includes a selection of demo templates, so you can learn how the Studio works before you need to create anything yourself.") +
          p("Even if you don't plan on using the finished post, we'd recommend editing one. It's the quickest way to get familiar with the Studio and the tools you'll use most often.") +
          shotOpen("bkx-studio", "Your Studio",
            "The Studio homepage, and what each part of it is for.",
            "/images/learn/demo/studio-page-v1.jpg",
            cards([
              ["Your packs", "Find the content packs you own, including your free demo templates."],
              ["Your designs", "Jump back into your most recent designs. Select See all designs to open your complete design library."],
              ["Create a design", "Start something completely new with a blank canvas."],
              ["Design tools", "Shortcuts to useful Studio tools, from the Caption Generator to your Brand Kit."],
            ], 2)) +
          p("<strong>Let's open your first template.</strong>") +
          p("Choose a pack to see all of the templates included within it. Select the template you want to use and the Studio will create your own editable copy, leaving the original untouched.") +
          "<!--WALK-->" +
          panel("Your demo templates are there to experiment with.",
            p("Change things, move things around and see what happens. You can always open the original template again and start fresh.")) +
          ctaBox("Ready to create your own?",
            "Once you're comfortable editing templates, our Creating in the Studio course takes you through starting from scratch and the wider creative tools available to you.",
            "/account/guides", "Explore the course") },

      { title: "Make It Your Brand", walk: "studio-make-yours",
        body_html:
          p("<strong>Start with the basics.</strong>") +
          p("Before you change the content, get the design looking like your brand.") +
          p("If you've already set up your Brand Kit, open <strong>Brand</strong> in the editor and select <strong>Make this design yours</strong>. From here, you can apply your saved colours and typography to the template without changing every element individually.") +
          p("Each row shows something the template already uses, a colour or a font, with your version beside it. Choose yours and everything using it updates in one go.") +
          p("Your saved logo and business information may already have been applied when your copy of the template was created.") +
          "<!--WALK-->" +
          ctaBox("Haven't set up your Brand Kit yet?",
            "It's worth doing that first. It'll make customising this template, and the ones you create afterwards, considerably quicker.",
            "/account/profile", "Set up your Brand Kit") },

      { title: "Make It Your Content",
        body_html:
          p("<strong>Now change what's actually on the page.</strong>") +
          p("Once the branding is in place, you can start adapting the template to the post you want to create.") +
          p("You don't need to learn every tool in the Studio yet. For now, concentrate on the things you'll use most often when editing a template.") +
          openers([
            ["Change the words", "Edit the text already in your design",
              p("Select any text on the canvas and type directly into it, or use the <strong>Text</strong> panel on the left to find and edit the text boxes within your design.") +
              p("<strong>Text selection</strong> lists every text box on the page, so nothing gets missed on a busy template. Select one and its font, size, colour and alignment appear in the same panel.") +
              p("You can also highlight part of a line to change only that part, and use <strong>Fonts</strong> to change the typeface across the whole design.") +
              showMe("studio-text", 3)],
            ["Change the background", "Replace the image behind everything else",
              p("Open <strong>Background</strong> and choose <strong>Change image</strong> to replace the existing background. Pick one of your own uploads, search free photos, or add an image from your device.") +
              p("Once your new image is in place, you can reposition it within the frame and adjust settings such as transparency to make it work with the rest of the design. <strong>Fill</strong> crops the photo to cover the whole page; <strong>Fit</strong> keeps all of it in view.") +
              p("A background doesn't have to be a photo. Your brand colours are in the same panel, along with a custom colour picker and a gradient.") +
              showMe("studio-background", 3)],
            ["Change an image", "Swap a photo inside the design",
              p("Where a template contains additional imagery, select the image you want to replace and choose <strong>Replace image</strong> from the panel beside the canvas. Your photo takes the place of the original at the same size and position.") +
              p("Once it's added, reposition and resize it until it sits correctly within the design.") +
              p("To add a photo that isn't there already, open <strong>Images</strong>: search the free photo libraries or upload your own, then click a picture to drop it onto the page.") +
              showMe("studio-image", 3)],
            ["Resize and reposition", "Make your words and pictures fit",
              p("Templates are designed as a starting point, so don't worry if your wording or imagery doesn't fit exactly like the original.") +
              p("Adjust font sizes, resize text boxes and move elements where necessary to make your version work.") +
              p("Click to select, drag to move and pull a corner to resize. Guides appear as you move something so it lines up with everything else on the page.") +
              showMe("studio-layout", 3)],
          ]) },

      { title: "A Few Things Worth Knowing",
        body_html:
          p("A handful of things that come up on almost everybody's first design.") +
          cards([
            ["Text not fitting?", "Try adjusting the font size first. You can also resize the text box or reposition it within the design."],
            ["Image not sitting right?", "Reposition or resize the image rather than immediately choosing another one. You can also adjust transparency where the design calls for it."],
            ["Made a mistake?", "Use <strong>Undo</strong> at the top of the editor, or Ctrl/Cmd&nbsp;+&nbsp;Z. Experimenting isn't going to ruin the original template, because you're working on your own copy."],
            ["Don't forget the other pages", "If you're editing a carousel, open <strong>Pages</strong> and check every one before downloading. Your branding, wording and contact details may need updating throughout."],
          ], 2) +
          panel("Need help while you're editing?",
            p("Open the <strong>Creative Assistant</strong> from inside the Studio. Ask a question about what you're trying to do, or choose one of the built-in tutorials under <strong>Show me</strong> to be shown how a feature works on the screen in front of you.")) },

      { title: "Finish Your Design", walk: "studio-finish",
        body_html:
          p("<strong>Happy with it? You've got a few options.</strong>") +
          p("Once your design is ready, you can download it immediately or turn it into a planned post.") +
          cards([
            ["Download", "Download your finished design when you're ready to publish or use it elsewhere. For social media graphics, we'd generally recommend PNG for the best balance of image quality and compatibility. Your file will be saved to your device's Downloads folder."],
            ["Plan your post", "Select the calendar button at the top of the editor to take your finished design into the Planner. From there, you can add the post details, get help creating your caption and choose when you want to publish it."],
          ], 2) +
          "<!--WALK-->" +
          panel("We'll cover this properly next.",
            p("The next Getting Started course takes you through the Planner, from adding your content to setting reminders for when it's time to post.")) },

      { title: "Saved and Ready When You Are", walk: "studio-designs",
        body_html:
          p("<strong>Your designs aren't going anywhere.</strong>") +
          p("The Studio automatically saves your work as you create, and your saved designs appear under <strong>Your designs</strong> on the Studio homepage.") +
          p("Your four most recent designs are shown there. Select <strong>See all designs</strong> to open your complete library, where you can return to previous designs, continue editing and download them again whenever you need to.") +
          cards([
            ["Tip", "Although the Studio autosaves your changes, we'd still recommend making sure the design has finished saving before you leave the editor. A marker at the top of the screen tells you when it has.", "tip"],
          ], 1) +
          "<!--WALK-->" +
          p("<strong>Your first design is done.</strong>") +
          p("You've opened a template, applied your branding, changed the content and created something of your own. The more you use the Studio, the more familiar the editor will become.") +
          ctaBox("Next: Planning and Posting",
            "Take your designs into the Planner: adding posts, writing your captions and building a rhythm you can keep to.",
            "/account/guides/read?g=training-planner&p=1", "Start the course") },
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
