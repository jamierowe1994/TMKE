// "Content ideas" — the Studio's inspiration card, served as a guide.
//
// Built from the TMKE Evergreen Content Guide (the PPE edition): four content
// pillars, eight ideas each in the original, made up to twelve here. The eight
// from the guide come first under each pillar; the four we've added sit under
// "Four more from us" so Dani can see at a glance which is which and rewrite
// or drop them. Plays in the guides reader as a course — one pillar per slide.
//
// Layout classes (ci-*) are styled in the reader (guides/read.astro). Every
// <figure class="ci-ph"> is an image placeholder: swap the figure for an <img>
// (or set data-src) once there's a picture for it.
//
// Lives here as a static guide so it works before it's in the database. The
// reader (/account/guides/read?g=content-ideas) uses this when no published
// guide with that slug exists; once one does, the database wins.

const ph = (label) => `<figure class="ci-ph" data-ph="${label}"><span>${label}</span></figure>`;
const card = (n, title, body, extra = "") => `<article class="ci-card ${extra}"><span class="ci-no">${String(n).padStart(2, "0")}</span><h4>${title}</h4><p>${body}</p></article>`;
const grid = (items) => `<div class="ci-grid">${items.join("")}</div>`;
const more = (items) => `<h3 class="ci-more">Four more from us</h3>${grid(items)}`;
// The pack that carries this pillar's templates. `slug` empty until the pack
// exists in The Edit; the card then links to the shop rather than nowhere.
const packCard = (title, slug, line) => `<a class="ci-pack" href="${slug ? `/edit/${slug}` : "/edit"}">${ph("Pack image")}<span class="ci-pack-tx"><span class="ci-pack-eyebrow">Templates for this pillar</span><strong>${title}</strong><span>${line}</span><em>${slug ? "See the pack" : "Coming to The Edit"} &rarr;</em></span></a>`;

export const CONTENT_IDEAS_GUIDE = {
  slug: "content-ideas",
  title: "48 Evergreen Content Ideas",
  topic: "content-strategy",
  kind: "course",
  audience: "members",
  status: "published",
  est_minutes: 12,
  summary: "Four pillars, twelve ideas each. Content that stays useful whenever it's posted — for the weeks you've nothing new on.",
  cover_url: "",
  lessons: [
    {
      title: "Start With the Pillars",
      body_html: `
<p class="ci-lead">Evergreen content stays useful long after it's posted. It isn't tied to a particular date, season or trend. Instead, it focuses on the things your audience consistently cares about, giving you a reliable foundation for what to post throughout the year.</p>
<p>For an estate agent, most of that content can be built around four simple pillars: you, your expertise, your service and your community. Together, they help people get to know you, trust what you know, understand why they should choose you and associate your name with the area you serve.</p>
<p>And because these subjects don't expire, you don't need to constantly reinvent them. Revisit the same ideas with a new story, example, format or perspective, then layer in listings, market updates and timely content around them.</p>
<div class="ci-pillars">
  <a class="ci-pillar" href="#" data-go="2">${ph("Pillar image")}<strong>The Person Behind the Business</strong><span>Before people buy into your service, they buy into you.</span></a>
  <a class="ci-pillar" href="#" data-go="3">${ph("Pillar image")}<strong>Educate and Empower</strong><span>When people understand the process, they feel confident taking the next step.</span></a>
  <a class="ci-pillar" href="#" data-go="4">${ph("Pillar image")}<strong>Promote Your Service With Purpose</strong><span>Show how you work and why it matters, without ever feeling 'sold to'.</span></a>
  <a class="ci-pillar" href="#" data-go="5">${ph("Pillar image")}<strong>Connect With the Community</strong><span>You're not just an agent, you're part of the neighbourhood.</span></a>
</div>
<p class="ci-rhythm"><strong>A simple rhythm.</strong> Rotate through the four pillars consistently and you'll always have something relevant to talk about, without starting from scratch every week.</p>`,
    },
    {
      title: "The Person Behind the Business",
      body_html: `
<div class="ci-intro">
  <div>
    <p class="ci-lead">People might need an estate agent, but ultimately they choose a person. This pillar is about making sure your audience gets to know the individual behind the listings, valuations and For Sale boards.</p>
    <p>That doesn't mean sharing every part of your private life. Personal content can be your story, experiences, opinions, values, motivations and the everyday moments that show how you work and what matters to you.</p>
    <p>Over time, those small insights create familiarity. And when someone eventually needs an agent, being the person they already recognise, understand and trust gives you a considerable head start.</p>
  </div>
  ${ph("Hero image")}
</div>
${grid([
  card(1, "Why you became an agent", "Film a short Reel or write a heartfelt caption on what motivated you and what makes your approach different. Keep it real."),
  card(2, "Favourite part of the job", "One simple moment that makes it worth it: handing over the keys, a kind client message, a problem solved."),
  card(3, "Then vs now", "Where you started and where you are, kept short with a clear takeaway: what you learned and how it shapes how you work today."),
  card(4, "Introduce yourself", "One of the few posts you can recycle every couple of months. Who you are, where you work, what you do, why you love it."),
  card(5, "A day in the life", "A photo series or voiceover Reel through a typical working day — emails to viewings to the dog walk."),
  card(6, "The moment I knew property was for me", "The story of what first drew you in: a career switch, a personal experience, a long-standing passion."),
  card(7, "Your local roots", "Where you grew up, where you live now, and what makes your connection to the area meaningful. Avoid time-specific phrases so it lasts."),
  card(8, "What working for yourself has given me", "The wins and lessons: flexibility, purpose, stronger client relationships. New followers are curious about the 'why'."),
])}
${more([
  card(9, "Three things I've learned working in property", "The lessons that have shaped how you work today. Personal experience, rather than generic advice.", "ci-card--new"),
  card(10, "A lesson from my first ever sale", "What went wrong or right, and what you'd do differently now. Self-aware beats polished.", "ci-card--new"),
  card(11, "What clients are surprised by", "The small things people don't expect — the follow-ups, the honesty on price, the Saturday call.", "ci-card--new"),
  card(12, "The tools I couldn't work without", "The apps, the camera, the notebook. Practical, personal and easy to film.", "ci-card--new"),
])}
${packCard("The Self-Employed Pack", "", "Introductions, day-in-the-life and story posts, ready for your face and your words.")}`,
    },
    {
      title: "Educate and Empower",
      body_html: `
<div class="ci-intro">
  <div>
    <p class="ci-lead">Your audience doesn't deal with property every day. You do. Processes, terminology and decisions that feel completely normal to you can be confusing or intimidating to someone who hasn't moved home for years.</p>
    <p>This pillar turns your knowledge into useful content. Think common questions, confusing terminology, buying and selling processes, misconceptions and the things you regularly find yourself explaining to clients.</p>
    <p>The goal isn't to prove how much you know. It's to make property feel easier to understand. Do that consistently and you're demonstrating your expertise long before someone needs to instruct an agent.</p>
  </div>
  ${ph("Hero image")}
</div>
${grid([
  card(1, "Guide to EPC ratings", "What an EPC is, why it matters, how ratings are calculated, and tips to improve efficiency and cut bills."),
  card(2, "Offer to completion", "Each stage from acceptance to exchange and completion — typical timeframes, who does what, and the common delays."),
  card(3, "Renting vs buying", "The financial, lifestyle and long-term considerations: upfront costs, ongoing expenses, flexibility, the market."),
  card(4, "How auctions work", "A myth-busting carousel or explainer: the speed and transparency, and the risks like non-refundable deposits."),
  card(5, "What affects a property's value", "Location, condition, amenities, market trends, legal considerations — so pricing conversations start from realistic expectations."),
  card(6, "First-time buyer checklist", "A simple one-page checklist: pre-approval, solicitor, viewings, surveys, conveyancing, stamp duty and moving costs."),
  card(7, "Step-by-step guide to listing your home", "Pricing, photography, the listing copy, viewings and offers, broken into clear actionable steps."),
  card(8, "How to prepare for a valuation", "A checklist walking homeowners through getting the house ready — the kind of post people save."),
])}
${more([
  card(9, "Jargon buster", "One term a post: exchange, chain, gazumping, under offer. A series that never runs out.", "ci-card--new"),
  card(10, "What a survey actually checks", "The difference between the levels, what's included, and what to do with the findings.", "ci-card--new"),
  card(11, "Leasehold vs freehold, plainly", "What each means day to day: ground rent, service charges, what you can change and what you can't.", "ci-card--new"),
  card(12, "Stamp duty, explained", "The thresholds, who pays, and one worked example on a local price. Refresh when the rules change.", "ci-card--new"),
])}
<blockquote class="ci-quote">Expertise isn't demonstrated by making something sound complicated.<br>It's demonstrated by making something complicated feel simple.</blockquote>`,
    },
    {
      title: "Promote Your Service With Purpose",
      body_html: `
<div class="ci-intro">
  <div>
    <p class="ci-lead">Promoting your service isn't something you need to avoid. People following you should understand what you offer, how you work and why choosing you could make a difference to their move.</p>
    <p>The strongest service content goes beyond saying "book a valuation." It shows the process behind your service, the standards you work to, the decisions you make and the things a client actually gets when they choose you.</p>
    <p>Done consistently, this content turns everything you've already built through personality and expertise into a reason to enquire. You're not just telling people you're different. You're giving them the evidence to decide for themselves.</p>
  </div>
  ${ph("Hero image")}
</div>
${grid([
  card(1, "Services you offer", "Your key services, who they're for and the benefit of each. A visual, easy-to-read post that invites the enquiry."),
  card(2, "What happens when you book a valuation", "Walk them through what to expect, so the first step feels approachable rather than uncertain."),
  card(3, "Why I always follow up every viewing", "Feedback, care, spotting opportunities early. A short Reel, carousel or caption on why it adds value for both sides."),
  card(4, "Reasons people choose to list with me", "Your strengths and your service style, in the words of the people who chose you."),
  card(5, "What makes you different", "A short, honest video or caption on your values, approach and experience."),
  card(6, "Step-by-step of your client process", "A behind-the-scenes carousel from first enquiry to final result, with a clear call to action at the end."),
  card(7, "The value of local expertise", "How knowing your patch guides pricing, finds the hidden gems and reaches the right buyers — versus a faceless online agent."),
  card(8, "My approach to marketing your home", "Photography, social media, portals, viewings — the plan that gets the best result, not just a listing online."),
])}
${more([
  card(9, "A recent result, told as a story", "The home, the challenge, what you did, how it ended. No numbers needed; the story is the proof.", "ci-card--new"),
  card(10, "What's included in my fee", "Spell it out. Transparency here removes the biggest objection before it's raised.", "ci-card--new"),
  card(11, "How I prepare a home for photographs", "The ten minutes before the photographer arrives. Useful to sellers, and it shows your standards.", "ci-card--new"),
  card(12, "Questions to ask any agent before you instruct", "And your answers to each. Confident, generous, and it frames the comparison in your favour.", "ci-card--new"),
])}
${packCard("The Proof Is in the Posts", "the-proof-is-in-the-posts", "Testimonials, results and service-led posts that make the case for you.")}`,
    },
    {
      title: "Connect With the Community",
      body_html: `
<div class="ci-intro">
  <div>
    <p class="ci-lead">Local expertise is about more than knowing house prices. People don't just buy a property, they buy into the area around it, and community content helps you demonstrate that you understand both.</p>
    <p>This pillar covers the people, places, businesses and everyday details that make your patch what it is. Think schools, independent businesses, walks, commutes, neighbourhoods, events and the things only somebody who genuinely knows the area would think to mention.</p>
    <p>It also gives people a reason to follow you when they aren't thinking about moving. Over time, consistently useful local content builds an association between you and your area, so when property eventually enters the conversation, you're already a familiar local voice.</p>
  </div>
  ${ph("Hero image")}
</div>
${grid([
  card(1, "Local business shoutouts", "A nearby café, shop or service you love, and what makes it special. Goodwill that tends to be returned."),
  card(2, "Local charities and initiatives", "A community project or volunteer group making a difference — its mission, its impact, how to get involved."),
  card(3, "Area spotlight", "'Why people love [area]' — the standout features and the lifestyle that make it unique for buyers and sellers."),
  card(4, "Local must-sees for newcomers", "The hidden gems: a walking trail, a landmark, a must-try café, the weekend market. Photos with quick tips."),
  card(5, "What's great about living in [area]", "Parks, cafés, schools, culture — a concise 'top reasons' post that helps people picture life there."),
  card(6, "How I stay connected to the community", "Networking events, groups and meet-ups: your investment in the area's wellbeing."),
  card(7, "Local living — what's nearby", "One neighbourhood's essentials on a simple map or carousel: shops, schools, parks, the best coffee."),
  card(8, "Dog-friendly spots in [area]", "Parks, cafés and trails where dogs are welcome. Playful, shareable, and it taps a passionate audience."),
])}
${more([
  card(9, "The school-run reality", "The areas parents ask about and why — catchments, walking routes, the morning traffic. Honest and useful.", "ci-card--new"),
  card(10, "The best walk within ten minutes", "One route, filmed on your phone, with where to stop for coffee. Repeatable for every patch you cover.", "ci-card--new"),
  card(11, "Commute check", "[Area] to the city, door to door, timed. The question every relocating buyer asks first.", "ci-card--new"),
  card(12, "Weekend in [area]", "Saturday morning to Sunday night: the market, the pub, the park. Sell the life, not the house.", "ci-card--new"),
])}
${packCard("The Local Life Pack", "", "Area spotlights, shout-outs and neighbourhood guides in your colours.")}`,
    },
    {
      title: "Make Your Content Work Harder",
      body_html: `
<p class="ci-lead">You now have four content pillars and dozens of ideas to work from. But the goal isn't to publish each one once, tick it off and start searching for another idea. The best content strategies get more from the ideas that already work.</p>
<p>Combine your evergreen pillars with listings, market updates, seasonal moments and timely content. Then revisit your strongest evergreen ideas regularly, changing the format, example, hook or perspective rather than constantly starting again. One good idea shouldn't create one post. It should give you somewhere to keep going.</p>
<div class="ci-pillars">
  <div class="ci-pillar ci-pillar--static">${ph("Image")}<strong>Evergreen vs Timely</strong><span>Evergreen content stays useful long-term. Timely content responds to market changes, seasons, news and what's happening now. You need both. Evergreen gives your strategy consistency; timely content keeps it current.</span></div>
  <div class="ci-pillar ci-pillar--static">${ph("Image")}<strong>Smart Repurposing</strong><span>One idea can become several posts. Turn a Reel into a carousel, pull one point into a Story, expand it on LinkedIn or revisit the same subject with a different example. Repurpose the idea, don't simply repost it.</span></div>
  <div class="ci-pillar ci-pillar--static">${ph("Image")}<strong>When to Refresh</strong><span>Return to your strongest evergreen posts every few months. Update anything that's changed, replace the imagery, rewrite the hook or approach the subject from another angle. Your newer followers probably never saw the original anyway.</span></div>
  <div class="ci-pillar ci-pillar--static">${ph("Image")}<strong>Measure and Iterate</strong><span>Look at what people respond to. Saves and shares can highlight useful educational content, while comments, profile activity and enquiries tell you something different. Use those signals to decide which subjects deserve another version.</span></div>
</div>
<p class="ci-rhythm">You don't need 100 new ideas. You need a handful of good ones that you know how to use.</p>`,
    },
  ],
};
