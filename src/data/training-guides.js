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
            ["Marketing Planner", "Plan all of your marketing on the day it happens, with a Content Calendar view of just what you're posting.", "planner"],
            ["Orders", "Find everything you've purchased from The Edit, including your packs, order details and receipts.", "orders"],
            ["Bookings", "Manage your TMKE videography bookings, follow their progress and access your finished galleries.", "bookings"],
            ["Your SMM", "Everything relating to Social Media Management, from what's included to your current package and monthly performance.", "smm"],
            ["Training Studio", "Your training and insights library. Find practical guides, Member Hub courses and our latest social media trends.", "learn"],
            // No picture until Dani's is in (public/images/learn/hub/areas/community-v5.jpg).
            ["Community", "Talk estate agency marketing with other members, join the fortnight's discussion and tell us what to build next.", null],
          ]) },
      { title: "Where to Go First",
        body_html:
          p("If you're new to the Member Hub, start with these three things. They'll set up the basics and make everything else considerably easier.") +
          go([
            ["Set up your Brand Kit", "Add your logo, colours and fonts once, then let the Studio apply them to your templates automatically.", "/account/profile", "start-brand-kit"],
            ["Plan a week", "Add a few posts to your Marketing Planner so you can see what's coming up and start building a consistent rhythm.", "/account/schedule", "start-plan"],
            ["Make a design", "Choose a template, make it your own and download your finished post. The more you use the Studio, the quicker it becomes.", "/account/editor?new=1", "start-design"],
          ]) +
          tip("Need help later? Head to the Training Studio for guides and training, or open the Help Centre from the menu if you can't find what you need.") },
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
          tip("The three boxes at the top of your Brand Kit keep track for you. They show what's still missing and take you straight to it. If your brand supplies your kit, you'll see that there too, with a button to confirm it's still up to date.") +
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
            ["Your details", "Headshot, contact details and review link",
              p("Add your headshot, email address, telephone number and review link. These details can then be used within selected Studio designs and your contact presets for calls to action and closing slides.") +
              ul("<strong>Headshot:</strong> a clear, recent image you're happy to use across your marketing. Square works best, around 600&times;600.",
                 "<strong>Email:</strong> the address you want customers to contact you on.",
                 "<strong>Telephone:</strong> the number you'd normally publish across your marketing.",
                 "<strong>Review link:</strong> where customers leave you a review, such as your Google reviews page. When you plan a testimonial request in your Marketing Planner, this is the link it sends.")],
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
    est_minutes: 10, sort_order: 3,
    // Dani, 15 Oct: the coffee and magazine, on the card and on the cover.
    art: "/images/learn/your-first-design-cover.webp",
    cover_url: "/images/learn/your-first-design-cover.webp",
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
              p("Select any text on your design to change the wording, or open the <strong>Text</strong> panel to edit it from the side menu.<br>From there, you can adjust the font, size, colour and alignment to suit your content.") +
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
          p("Once you're happy with your design, you can download it to your device or take it straight into your Marketing Planner.") +
          cards([
            ["Download", "Download your finished design when you're ready to publish it.<br>For social media graphics, we'd generally recommend PNG for a good balance of image quality and compatibility."],
            ["Plan your post", "Once your design is ready, you can add it to your content calendar and choose when you'd like to publish it. Set a reminder and your finished content will be sent directly to your chosen device, making it easy to post to your social media when the time comes."],
          ], 2) +
          panel("Coming Up: Planning Your Marketing",
            p("We'll cover the Marketing Planner, reminders and how to plan all of your marketing in more detail in the next course.")) +
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
          ctaBox("Up Next: Planning Your Marketing",
            "Plan your posts, print, events and campaigns in one calendar, with reminders when it's time.",
            "/account/guides/read?g=training-planner&p=1", "Start the course") },
    ],
  }),

  /* Rewritten 17 Oct 2026 for the Planner as it now is: a marketing calendar
     of posts AND activities in six groups, campaigns, ideas and key dates,
     reminders and calendar sync (src/data/marketing-activities.js). The why
     lives here; the walkthrough cards say where and how. */
  /* Dani's revised Planner course (18 Oct, "TMKE Training Wording - Revised
     Planner Course"), brought up to date with that evening's changes: the two
     tabs, posts planned in the Content Calendar, the content plan, the sync
     carrying posts, Save & add to my calendar. A short tour of the page, then
     a focused walk for each job (walkthroughs.js). */
  guide({
    slug: "training-planner",
    title: "Planning Your Marketing",
    summary: "Plan your social media, print, campaigns and everything else you do to market your agency, all in one place.",
    est_minutes: 11, sort_order: 4, art: "https://assets.tmke.co.uk/orange-1.webp",
    lessons: [
      { title: "More Than a Content Calendar", walk: "planner", video_url: "",
        body_html:
          p("Your Planner is more than somewhere to schedule social media posts. It brings your wider marketing together, from creating content and arranging photography to canvassing, property campaigns, networking and requesting reviews.") +
          p("Seeing it together makes it easier to plan ahead, keep track of what needs doing and make sure the different parts of your marketing work together. So the Planner has two tabs: the <strong>Marketing Planner</strong> for your marketing activities, and the <strong>Content Calendar</strong> for your posts. A post is something you design, write and publish; a leaflet drop or an open house is something you do on a day. Each is planned in its own way, in its own tab.") +
          p("Click a day to get started. The Planner already knows the date you selected, so you only need to add the details that matter.") +
          tip("You don't need to fill every day. Use the Planner to plan the marketing you can realistically deliver, not to create extra work.") },

      { title: "What Can You Plan?",
        body_html:
          p("In the Marketing Planner, select a day and choose what you're planning. Activities are organised into six groups, each with its own colour, so you can recognise different types of marketing at a glance.") +
          cards([
            ["Content & Social", "Content planning, Content Studio sessions, agent filming days, emails and paid advertising."],
            ["Property Marketing", "Property photography or filming, open houses and property events."],
            ["Print & Canvassing", "Creating print designs, ordering print marketing and planning leaflet drops."],
            ["Campaigns", "Story of the Sale, new listing, open house and seasonal campaigns."],
            ["Business & Community", "Local events, networking, testimonial requests and marketing follow-ups."],
            ["Something Else", "Any other marketing activity, with your own title and details."],
          ]) +
          p("Some activities only need a time and a note. Others offer useful extras, such as a checklist, linked designs, files or links. These are optional, so you can keep an entry as simple as you need.") +
          /* An example month, opening to both tabs (Dani, 18 Oct). Captured
             from the Planner with a realistic November supplied. */
          shotOpen("pl-key", "The Colour Key and Your Posts",
            "Each group in its own colour, and where your posts show.",
            "/images/learn/demo/shots/planner-key--marketing-planner@2x.webp",
            p("The colour key sits above the calendar. Your social media posts are planned in the Content Calendar; in the Marketing Planner, a day with posts shows how many, so you can still see the whole picture. A campaign runs across its days as a thin bar.") +
            bigShot("/images/learn/demo/shots/planner-key--content-calendar@2x.webp",
              "The same month in the Content Calendar: your posts on their days, with post ideas and key dates. A dashed post is still to design.")) },

      { title: "Planning Your Social Media", walk: "post-plan",
        body_html:
          p("Posts live in the <strong>Content Calendar</strong>, alongside the post ideas and key dates written for you. Open a day and choose <strong>Plan a post for this day</strong>. There are three ways to plan it, depending on whether your content is already made.") +
          cards([
            ["Use one of your designs", "Choose a design you've already saved in the Studio."],
            ["Design from a template", "Make it from your packs, then plan it from the Studio."],
            ["Upload a post", "Add a file made outside the Studio, or a link to it."],
          ]) +
          p("Then add the caption, with <strong>Generate with AI</strong> if you'd like a hand, and the time it goes out. Tick <strong>Remind me on the day</strong> and we'll email you the design and caption at 8am that morning, ready to post.") +
          p("The Content Calendar helps you prepare and remember your posts. It doesn't publish to your social media accounts for you.") +
          panel("Planning a month of posts?",
            p("We love an organised Ollie! Use your Content Planner to map out your month, decide what you're posting and when, and keep everything in one place. You can create new designs or link ones you've already made, so your content is ready when you need it.")) },
          /* The content plan gets a short guide of its own (Dani, 18 Oct); link
             it in the panel above once it's written. */

      { title: "Planning Your Marketing Activities",
        body_html:
          p("The Marketing Planner is where you organise the work that happens around your social media. Here are just a few of the ways you can use it to plan and manage your marketing, with plenty more to explore.") +
          cards([
            ["Photography and filming", "For property photography or filming, a Content Studio session or an agent filming day, explore TMKE's services, see the brochure or book with us. Already arranged it yourself? Add it to your calendar. Anything you book with TMKE appears on its own."],
            ["Print and canvassing", "Plan when you'll create a print design, order materials or deliver them. Open your print packs or start a print design in the Studio, and keep the details alongside the activity."],
            ["Campaigns", "Choose a campaign, add its details and work through a ready-made checklist you can change to suit you. Link designs you've already made, and Plan these posts puts each one on its day in your Content Calendar. The campaign lists them, with their dates and times."],
          ]) +
          "<!--WALK:plan-filming--><!--WALK:plan-print--><!--WALK:plan-campaign-->" },

      /* Dani's copy (19 Oct). Staying organised (the sync, Save & add) moved
         to the last part, with making the Planner work for you. */
      { title: "Requesting Reviews", walk: "plan-testimonial",
        body_html:
          p("<strong>A good review is worth asking for.</strong>") +
          p("Happy clients don't always think to leave a review, even when they've had a great experience. A simple follow-up after a successful sale or let can make all the difference.") +
          p("Your Marketing Planner makes that easier, with ready-written email and WhatsApp messages you can personalise and send to your clients.") +
          p("<strong>Choose how you'd like to ask</strong>") +
          p("Not every agent communicates in the same way, so we've included three different approaches:") +
          cards([
            ["Friendly &amp; Personal", "A warm, conversational message that feels natural and approachable."],
            ["Professional &amp; Appreciative", "A slightly more formal approach that thanks your client for choosing you."],
            ["Short &amp; Direct", "A quick, straightforward request that gets straight to the point."],
          ]) +
          p("Each option is available as an email or WhatsApp message, so you can choose whichever suits your relationship with the client.") +
          p("<strong>Your details, already included</strong>") +
          p("Your Planner uses the information saved in your Brand Kit to personalise the messages with your name, business details and review link.") +
          p("Whether you collect reviews through Google, Trustpilot or your own website, simply add the relevant link to your Brand Kit and it'll be included in your review requests.") +
          p("All you need to do is add your client's name, check the wording and copy the message into your email or WhatsApp.") +
          p("<strong>Plan it for later</strong>") +
          p("You don't need to send the request immediately. Add it to your Marketing Planner for a date that suits you, such as a few days after completion. You can also set a reminder so you don't forget to follow up.") +
          tip("The best time to ask for a review is when the experience is still fresh. Keep your message personal, thank your client for working with you and make it easy for them to leave their feedback.") },

      { title: "Make Your Planner Work for You",
        body_html:
          p("The Planner is there to help you plan, not to give you another list to keep up with.") +
          p("Look out for post ideas and key dates in your Content Calendar. If a prompt suits your audience, add it to your content plan or open it and start designing. If it doesn't, leave it. Your own marketing priorities come first.") +
          p("Select anything you've planned to review its details, make changes or check what's still outstanding. The colours, and the two tabs, show how your posts, campaigns, print and local activity fit together across the month.") +
          p("Start with the things you already know are coming up, then add the smaller tasks around them. A realistic plan you can follow is more useful than a packed calendar you never come back to.") +
          p("<strong>In the calendar you use every day</strong>") +
          p("<strong>Sync to my calendar</strong> adds both tabs to Apple Calendar, Google Calendar or Outlook. Your activities appear alongside your other commitments, and each post arrives with its design and caption, as a reminder to post it. Updates can take a little while to appear, depending on your calendar app.") +
          p("Not synced? When you add something, choose <strong>Save &amp; add to my calendar</strong> to put that entry in your calendar as you save it.") +
          tip("Try planning around your next property launch or local event. Add the main activity first, then the posts, print and follow-ups that support it.") +
          p("Need ideas? Explore this month's trends, the Evergreen Content course and practical guides in the Training Studio.") },
    ],
  }),
];

/* ---- Print ---------------------------------------------------------------
   Your First Print Design: a canvassing card from the print pack, start to
   PDF. For The Experts Group's agents only (`audience: "teg"`, checked on the
   Learn page and in the reader). It sits in the Guides grid, not the
   Training row (`training: false`). Copy: Dani's review, 13 Oct, with three
   changes for accuracy -- the Brand Kit is opened from the hub's menu, the
   PDF is not called "print-ready" (the Studio exports no bleed), and no card
   size is given until the Canvassing Cards' size is confirmed.
   The walkthroughs are in walkthroughs.js (print-*), held back with
   `pending` until their pictures are taken. */
export const PRINT_GUIDES = [
  guide({
    slug: "print-first-design",
    title: "Your First Print Design",
    summary: "Create your first canvassing card using the print templates available to agents of The Experts Group.",
    topic: "getting-started", audience: "teg", training: false,
    est_minutes: 10, sort_order: 5,
    lessons: [
      { title: "Finding Your Print Templates", walk: "print-find",
        body_html:
          p("<strong>Your print templates, ready to personalise.</strong>") +
          p("Your print templates live in the Studio alongside your social media designs. They're organised into packs, with each pack containing templates created for a particular purpose.") +
          p("In this course, we'll use the Canvassing Cards pack. Each card gives you a starting point for reaching homeowners in your area, whether you're introducing yourself, promoting a property or encouraging someone to book a valuation.") +
          "<!--WALK-->" },

      { title: "Where Your Details Come From", walk: "print-details",
        body_html:
          p("<strong>Your Brand Kit is already set up.</strong>") +
          p("As an agent of The Experts Group, your Brand Kit was filled in for you when you joined the Member Hub, using the details The Experts Group holds for you.") +
          cards([
            ["Your brand", "Your company name, logo, brand colours, fonts, website and tone of voice."],
            ["Your details", "Your name, job title, the area you cover, your phone number, your email address and your approved headshot."],
          ], 2) +
          p("Your print templates use these details automatically, so every card is personalised from the moment you open it.") +
          p("Before you create your first card, take a moment to check they're correct. If anything needs updating, change it in your Brand Kit, then reopen your template to bring the update through.") +
          ctaBox("Check your Brand Kit",
            "Open your Brand Kit to confirm your contact details, area and branding before you start.",
            "/account/profile", "View your Brand Kit") +
          "<!--WALK-->" },

      /* Three steps rather than a walkthrough or a picture (Dani, 30 Oct):
         there is little to show, and a drag can't be shown in a still. */
      { title: "Your Headshot",
        body_html:
          p("<strong>A consistent face for your personal brand.</strong>") +
          p("Your canvassing cards automatically include your approved headshot, helping keep your printed marketing consistent with The Experts Group's branding.") +
          p("Your headshot is managed centrally, so you can't upload or replace it yourself. You can, however, adjust how it sits within the design, making sure it looks right before you download.") +
          cards([
            ["1. Select Your Photo", "Select your photo on the card. The panel on the left shows what you can change."],
            ["2. Select Reposition", "Select Reposition in the panel to start adjusting your photo."],
            ["3. Drag and Zoom", "Drag to move your photo within its box, and scroll to make it bigger or smaller. Click away, or press Enter or Esc, when you're done."],
          ], 3) },

      { title: "Editing Your Card", walk: "print-edit",
        body_html:
          p("<strong>Everything you can change, in one place.</strong>") +
          p("When a print template opens, the Edit panel lists every part of the card you can change, on both sides. The layout and branding stay as they are, so your card keeps its professional finish, while the wording and photography are yours to update.") +
          p("The front of your card catches someone's attention. The back is where you explain why you're contacting them and what you'd like them to do next, so most cards have two pieces of wording to personalise: the message and the call to action.") +
          p("Replace the placeholder photography with your own pictures of the property, so the card shows the home you're promoting.") +
          p("If you're not sure what to write, your Creative Assistant can help. It's designed for estate agency marketing and writes in the tone of voice saved in your Brand Kit. Tell it what the card is for, who you're writing to and what you want them to do, then refine its suggestion and add it to your card.") +
          cards([
            ["TMKE Tip", "Keep your message short and focused. Your text adjusts to fit the space available, but that doesn't mean you need to fill every line.", "tip"],
          ], 1) +
          "<!--WALK-->" },

      { title: "Your QR Code", walk: "print-qr",
        body_html:
          p("<strong>Make it easy to take the next step.</strong>") +
          p("Every canvassing card includes a QR code, giving homeowners a quick way to find out more or get in touch.") +
          p("By default, your QR code links to your website. You can change it to something more relevant to the card, such as a particular property listing or valuation page.") +
          p("You can also choose WhatsApp, so somebody can open a conversation with you directly. Add your mobile number and, if you'd like, a short message ready for them to send.") +
          p("Once you've chosen the destination, select <strong>Update QR code</strong> to apply your changes.") +
          panel("Always test your QR code",
            p("Test your QR code before downloading your design. Once your cards are printed, the destination can't be changed, so make sure it takes people to the right place.")) +
          "<!--WALK-->" },

      { title: "Downloading for Print", walk: "print-download",
        body_html:
          p("<strong>Ready to print?</strong>") +
          p("Once you've finished personalising your card, take a moment to check both sides. Make sure your contact details are correct, the photography is right, your message reads naturally and your QR code takes people to the intended destination.") +
          p("When you're happy with everything, open <strong>Download</strong>. The Studio automatically selects PDF for print designs, giving you one file containing both sides of your card.") +
          "<!--WALK-->" +
          panel("Getting your cards printed",
            p("Your print design is supplied as a PDF containing both sides of the card. When ordering, make sure you select the correct dimensions and double-sided printing.<br>You can find the dimensions of your design in the Studio, next to the design's name.")) +
          p("<strong>Your first print design is ready.</strong>") +
          p("You've chosen a template, checked your details, personalised your card and prepared it for printing. Next time, you'll know exactly where to start.") },
    ],
  }),
];
