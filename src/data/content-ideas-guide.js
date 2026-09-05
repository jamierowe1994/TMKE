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

export const CONTENT_IDEAS_GUIDE = {
  slug: "content-ideas",
  title: "48 evergreen content ideas",
  topic: "content-strategy",
  kind: "course",
  audience: "members",
  status: "published",
  est_minutes: 12,
  summary: "Four pillars, twelve ideas each. Content that stays useful whenever it's posted — for the weeks you've nothing new on.",
  cover_url: "",
  lessons: [
    {
      title: "Start with the pillars",
      body_html: `
<p class="ci-lead">Evergreen content stays relevant, useful and engaging no matter when it's posted. It isn't tied to a date, a season or a trend; it's about the things that consistently matter to the people who might one day sell or let through you. Because it has no expiry date, it can be reused, refreshed and repurposed as your audience grows.</p>
<p>It's the answer to the quiet week. Rather than a blank planner, you have four pillars to pick from — and every idea here can be designed in the Studio in your own colours.</p>
<div class="ci-pillars">
  <a class="ci-pillar" href="#" data-go="2">${ph("Pillar image")}<strong>The person behind the business</strong><span>Before people buy into your service, they buy into you.</span></a>
  <a class="ci-pillar" href="#" data-go="3">${ph("Pillar image")}<strong>Educate and empower</strong><span>When people understand the process, they feel confident taking the next step.</span></a>
  <a class="ci-pillar" href="#" data-go="4">${ph("Pillar image")}<strong>Promote your service with purpose</strong><span>Show how you work and why it matters, without ever feeling 'sold to'.</span></a>
  <a class="ci-pillar" href="#" data-go="5">${ph("Pillar image")}<strong>Connect with the community</strong><span>You're not just an agent, you're part of the neighbourhood.</span></a>
</div>
<p class="ci-rhythm"><strong>A simple rhythm.</strong> One post from each pillar a week gives you four evergreen posts, leaving the rest of the week for listings and anything timely.</p>`,
    },
    {
      title: "The person behind the business",
      body_html: `
<div class="ci-intro">
  <div>
    <p class="ci-lead">Sharing personal stories, values and day-to-day moments helps your audience feel connected to the person behind the business.</p>
    <p>These posts build trust and relatability, they're low-effort and repeatable, and they remind people why they should work with you over any other agent.</p>
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
  card(9, "Three things I wish every seller knew", "Honest, useful, and it positions you as the agent who tells people the truth.", "ci-card--new"),
  card(10, "A lesson from my first ever sale", "What went wrong or right, and what you'd do differently now. Self-aware beats polished.", "ci-card--new"),
  card(11, "What clients are surprised by", "The small things people don't expect — the follow-ups, the honesty on price, the Saturday call.", "ci-card--new"),
  card(12, "The tools I couldn't work without", "The apps, the camera, the notebook. Practical, personal and easy to film.", "ci-card--new"),
])}`,
    },
    {
      title: "Educate and empower",
      body_html: `
<div class="ci-intro">
  <div>
    <p class="ci-lead">When people understand the process they feel confident taking the next step.</p>
    <p>Educational content demystifies everything from viewings and valuations to legal terms and moving day, and positions you as the go-to expert when it's time to move. Clarity, not complexity — helpful advice from a friend who knows their stuff.</p>
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
  card(12, "Stamp duty in thirty seconds", "The thresholds, who pays, and one worked example on a local price. Refresh when the rules change.", "ci-card--new"),
])}`,
    },
    {
      title: "Promote your service with purpose",
      body_html: `
<div class="ci-intro">
  <div>
    <p class="ci-lead">People don't just want to know that you're an estate agent — they want to understand how you work, what makes you different and why it matters to them.</p>
    <p>Explain your process clearly and confidently and you remove friction and build trust, turning followers into enquiries without ever feeling 'sold to'.</p>
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
])}`,
    },
    {
      title: "Connect with the community",
      body_html: `
<div class="ci-intro">
  <div>
    <p class="ci-lead">Community content highlights the people, places and businesses that make your local area special.</p>
    <p>It builds trust and visibility, supports other businesses, and shows you live in — and care about — where you work. Warm, grounded and approachable.</p>
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
])}`,
    },
    {
      title: "Make your content work harder",
      body_html: `
<p class="ci-lead">Good content strategies balance evergreen posts — the educational, trust-building pieces that stay relevant — with timely content tied to news, market shifts or the season. Knowing when to use each keeps you delivering value and top of mind.</p>
<div class="ci-cols">
  <section class="ci-col"><h3>Evergreen vs timely</h3><p>Evergreen posts stay valuable long-term: think 'How to prepare for a valuation'. Timely content covers news, market updates and seasonal moments, and dates quickly. You need both; the Studio's seasonal packs cover the second.</p></section>
  <section class="ci-col"><h3>Smart repurposing</h3><ul><li>Trim a Reel into a 15-second Story clip.</li><li>Design a static summary post for your grid.</li><li>Turn a Reel into a carousel.</li></ul></section>
  <section class="ci-col"><h3>Cross-platform</h3><ul><li><strong>LinkedIn</strong> — in-depth captions, professional tone.</li><li><strong>Instagram</strong> — branded visuals with short, punchy copy.</li><li><strong>Facebook</strong> — conversational, mixed media.</li></ul></section>
  <section class="ci-col"><h3>When to refresh</h3><p>Every three to six months, go back to your best-performing posts. Swap in fresh images, update any figures, tweak the caption. A simple refresh keeps it current long after it was first posted.</p></section>
  <section class="ci-col"><h3>Measure and iterate</h3><p>Compare original against repurposed: reach, saves, shares, comments. Double down on the versions that keep engaging, and refine from real numbers rather than instinct.</p></section>
</div>`,
    },
  ],
};
