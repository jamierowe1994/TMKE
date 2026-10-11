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
/* Four numbered cards, two across, each carrying its own copy and its own
   walkthrough box along the bottom. Replaces the pop-out version: with only
   four of them there is nothing to save by hiding the copy, and a reader had
   to open every one to find out what was in it. Dani, 12 Oct: "rather than
   having the popouts ... we do two by two and actually have the content in the
   mini cards, and then have the red box at the bottom of each one." */
const toolCards = (items) => `<div class="bk-tools">${items.map(([title, body, walkId, part, line], i) =>
  `<div class="bk-tool">
     <span class="bk-tool-n">${String(i + 1).padStart(2, "0")}</span>
     <h3 class="bk-tool-t">${title}</h3>
     <div class="bk-tool-b">${body}</div>
     <div class="gr-walk gr-walk--in">
       <span class="gr-walk-tx"><strong>Walkthrough</strong><span>${line}</span></span>
       <button type="button" class="ws-btn ws-btn--primary ws-btn--sm" data-walk="${walkId}" data-part="${part}">Show me &rarr;</button>
     </div>
   </div>`).join("")}</div>`;
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
    // The course's own copy of the laptop photo: the "Make one design" card
    // uses the same picture, and neither should follow the other's changes.
    est_minutes: 4, sort_order: 1, art: "/images/learn/hub/cover-training-hub-v1.jpg",
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
    est_minutes: 8, sort_order: 2, art: "/images/learn/brand-kit/cover-training-brand-kit-v2.jpg",
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
          /* Dani's copy, 12 Oct. */
          p("The Studio is where you create and customise your social media content, whether you're working with one of our templates or creating something of your own.") +
          p("<strong>For your first design, we're going to start with a template.</strong>") +
          /* One paragraph, broken rather than split: what you get, then what to
             do with it. Dani, 12 Oct. */
          p("Every Member Hub account includes a free Demo Pack with three ready-made designs, so you can get familiar with the Studio without purchasing anything.<br>Choose a template, make a few changes and see how everything works. You don't even need to publish the finished post. This is simply an opportunity to explore the editor and learn the tools you'll use most often.") +
          shotOpen("bkx-studio", "Your Studio",
            "Take a look around the Studio homepage and see where your templates, saved designs and creative tools live.",
            "/images/learn/demo/studio-page-v1.jpg",
            cards([
              ["Your packs", "Find the content packs you own, including your free demo templates."],
              ["Your designs", "Jump back into your most recent designs. Select See all designs to open your complete design library."],
              ["Create a design", "Start something completely new with a blank canvas."],
              ["Design tools", "Shortcuts to useful Studio tools, from the Caption Generator to your Brand Kit."],
            ], 2)) +
          /* "Let's open your first template" is the walk box's own heading, and
             since 12 Oct it carries the experiment tip as its second line too:
             three coloured cards in a row on page one was too many, and the tip
             belongs with the thing it is a tip about (walkthroughs.js, `note`).

             "Ready to create your own?" has moved to the end of the course.
             Dani, 12 Oct: "at this point, they're not ready to create their
             own" — it is the last thing they read, not the first. */
          "<!--WALK-->" },

      { title: "Make It Your Brand", walk: "studio-make-yours",
        body_html:
          /* Dani's copy, 12 Oct. The order is hers too: the Brand Kit card
             comes before the walk, because somebody without a kit cannot do
             what the walk is about to show them. */
          p("<strong>Start with your branding.</strong>") +
          p("Before you start changing the content, let's make sure the design looks like it belongs to your business.") +
          p("To use the Studio's branding features, you'll first need to complete your Brand Kit. This stores your logos, colours and fonts, allowing the Studio to apply them to your designs automatically.") +
          /* One paragraph, broken rather than split: the second sentence is
             what you see once you have done the first. */
          p("Once your Brand Kit is complete, open the <strong>Brand</strong> tab in the editor and select <strong>Make this design yours</strong>.<br>You'll see the colours and fonts currently used in the template alongside those saved in your Brand Kit. Choose your replacements, and the Studio will update the matching elements throughout your design.") +
          ctaBox("Haven't completed your Brand Kit?",
            "You'll need to do this before using Make this design yours. It only takes a few minutes and means you won't have to manually update your branding every time you create something.",
            "/account/profile", "Set up your Brand Kit") +
          "<!--WALK-->" },

      { title: "Make It Your Content",
        body_html:
          /* Dani's copy, 12 Oct. */
          p("<strong>Making the content your own.</strong>") +
          p("With your branding in place, it's time to adapt the template to the post you want to create.<br>You don't need to learn every feature in the Studio straight away. For now, concentrate on the four things you'll probably use most often: changing text, replacing backgrounds, swapping images and adjusting the layout.") +
          toolCards([
            ["Change the words",
              p("Select any text on your design to change the wording, or open the <strong>Text</strong> panel to see all the text boxes on the page.<br>From there, you can adjust the font, size, colour and alignment to suit your content.") +
              p("You can also use <strong>Text selection</strong> to find individual text boxes, particularly useful when you're working with a busier template."),
              "studio-text", 3, "Changing text in the Studio."],
            ["Change the background",
              p("Open <strong>Background</strong> and select <strong>Change image</strong> to replace the existing background with one of your own photos or an image from the Studio's free libraries.") +
              p("Once added, you can reposition the image and adjust how it fits within the design.<br>You can also replace the background with a solid colour or gradient, including colours saved in your Brand Kit."),
              "studio-background", 3, "Changing your background."],
            ["Change an image",
              p("If your template contains an image, select it and choose <strong>Replace image</strong>. Your new photo will take its place, keeping the original size and position.") +
              p("You can then adjust the image to make sure it sits correctly.<br>Want to add another photo? Open <strong>Images</strong> to upload your own or browse the free image libraries."),
              "studio-image", 3, "Replacing and adding images."],
            ["Resize and reposition",
              p("Templates give you a starting point, but your wording and imagery won't always fit exactly like the original.") +
              p("Select an element to move it, drag its corners to resize it or adjust the font size to make your text fit.<br>The Studio also displays alignment guides as you move elements, helping you keep everything neatly positioned."),
              "studio-layout", 3, "Moving and resizing elements."],
          ]) },

      { title: "A Few Things Worth Knowing",
        body_html:
          p("A handful of things that come up on almost everybody's first design.") +
          /* Dani's copy, 12 Oct. */
          cards([
            ["Text not fitting?", "Try reducing the font size or resizing the text box. You can also move it slightly to give your wording more room."],
            ["Image not sitting right?", "Before choosing another photo, try repositioning or resizing the one you've added. Sometimes a small adjustment makes all the difference."],
            ["Made a mistake?", "Use <strong>Undo</strong> at the top of the editor or Ctrl/Cmd&nbsp;+&nbsp;Z. You're working on your own copy, so the original template is always there if you need it."],
            ["Don't forget the other pages", "Creating a carousel? Open <strong>Pages</strong> and check each slide before downloading. Make sure your branding, wording and contact details are correct throughout."],
          ], 2) +
          panel("Your Creative Assistant",
            p("Need a hand? Your Creative Assistant is there whenever you get stuck. Ask it how to use a feature, find your way around the Member Hub or get help with something you're working on.<br>It can also help with the creative side, from writing captions and refining copy to coming up with content ideas when you're not sure what to post.")) },

      { title: "Finish Your Design", walk: "studio-finish",
        body_html:
          /* Dani's copy, 12 Oct. Her order too: the next course is trailed
             before the walkthrough, so the page ends on the thing to go and
             do rather than on the thing to read later. */
          p("<strong>Your design is ready. What's next?</strong>") +
          p("Once you're happy with your design, you can download it to your device or take it straight into your Planner.") +
          cards([
            ["Download", "Download your finished design when you're ready to publish it.<br>For social media graphics, we'd generally recommend PNG for a good balance of image quality and compatibility."],
            ["Plan your post", "Once your design is ready, you can add it to your content calendar and choose when you'd like to publish it. Set a reminder and your finished content will be sent directly to your chosen device, making it easy to post to your social media when the time comes."],
          ], 2) +
          panel("Coming Up: Planning and Posting",
            p("We'll cover the Planner, reminders and how to organise your content in more detail in the next course.")) +
          "<!--WALK-->" },

      { title: "Saved and Ready When You Are", walk: "studio-designs",
        body_html:
          /* Dani's copy, 12 Oct. Her order too: the walkthrough comes after
             the sign-off, with the next course last. */
          p("The Studio automatically saves your work as you create, so you don't need to finish everything in one sitting.") +
          p("Your four most recent designs appear under <strong>Your designs</strong> on the Studio homepage. Select <strong>See all designs</strong> to open your complete library, where you can return to previous designs, continue editing or download them again whenever you need to.") +
          cards([
            ["TMKE Tip", "Although the Studio saves your changes automatically, check that saving has finished before leaving the editor. You'll see the saving status at the top of the screen.", "tip"],
          ], 1) +
          p("<strong>Your first design is done.</strong>") +
          p("You've opened a template, applied your branding, customised the content and created your first design in the Studio. And now you know the basics, the next one should feel considerably easier.") +
          "<!--WALK-->" +
          /* Moved off page one on 12 Oct: somebody opening their first template
             is not ready to create their own, somebody who has just finished
             one is. Dani's page-six copy does not list it — kept here pending
             her word, since she asked for it to be moved rather than dropped. */
          ctaBox("Ready to create your own?",
            "Once you're comfortable editing templates, our Creating in the Studio course takes you through starting from scratch and the wider creative tools available to you.",
            "/account/guides", "Explore the course") +
          ctaBox("Up Next: Planning and Posting",
            "Learn how to organise your content, prepare captions and plan what you're publishing.",
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
