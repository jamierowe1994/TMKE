// "Content ideas" — the Studio's inspiration card, served as a guide.
//
// Built from the TMKE Evergreen Content Guide (the PPE edition): four content
// pillars, eight ideas each in the original, made up to twelve here. The eight
// from the guide come first under each pillar; the four we've added sit under
// "Four more from us" so Dani can see at a glance which is which and rewrite
// or drop them. Plays in the guides reader as a course — one pillar per slide.
//
// Lives here as a static guide so it works before it's in the database. The
// reader (/account/guides/read?g=content-ideas) uses this when no published
// guide with that slug exists; once one does, the database wins.

const idea = (title, body) => `<li><strong>${title}</strong> — ${body}</li>`;
const more = (items) => `<h3>Four more from us</h3><ul>${items.join("")}</ul>`;

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
<p>Evergreen content stays relevant, useful and engaging no matter when it's posted. It isn't tied to a date, a season or a trend; it's about the things that consistently matter to the people who might one day sell or let through you. Because it has no expiry date, it can be reused, refreshed and repurposed as your audience grows.</p>
<p>It's the answer to the quiet week. Rather than a blank planner, you have four pillars to pick from — and every idea here can be designed in the Studio in your own colours.</p>
<h3>The four pillars</h3>
<ul>
<li><strong>The person behind the business</strong> — before people buy into your service, they buy into you.</li>
<li><strong>Educate and empower</strong> — when people understand the process, they feel confident taking the next step.</li>
<li><strong>Promote your service with purpose</strong> — show how you work and why it matters, without ever feeling 'sold to'.</li>
<li><strong>Connect with the community</strong> — you're not just an agent, you're part of the neighbourhood.</li>
</ul>
<p>A simple rhythm: one post from each pillar a week gives you four evergreen posts, leaving the rest of the week for listings and anything timely.</p>`,
    },
    {
      title: "The person behind the business",
      body_html: `
<p>Sharing personal stories, values and day-to-day moments helps your audience feel connected to the person behind the business. These posts build trust and relatability, they're low-effort and repeatable, and they remind people why they should work with you over any other agent.</p>
<ul>
${idea("Why you became an agent", "film a short Reel or write a heartfelt caption on what motivated you and what makes your approach different. Keep it real.")}
${idea("Favourite part of the job", "one simple moment that makes it worth it: handing over the keys, a kind client message, a problem solved.")}
${idea("Then vs now", "where you started and where you are, kept short with a clear takeaway: what you learned and how it shapes how you work today.")}
${idea("Introduce yourself", "one of the few posts you can recycle every couple of months. Who you are, where you work, what you do, why you love it.")}
${idea("A day in the life", "a photo series or voiceover Reel through a typical working day — emails to viewings to the dog walk.")}
${idea("The moment I knew property was for me", "the story of what first drew you in: a career switch, a personal experience, a long-standing passion.")}
${idea("Your local roots", "where you grew up, where you live now, and what makes your connection to the area meaningful. Avoid time-specific phrases so it lasts.")}
${idea("What working for yourself has given me", "the wins and lessons: flexibility, purpose, stronger client relationships. New followers are curious about the 'why'.")}
</ul>
${more([
  idea("Three things I wish every seller knew", "honest, useful, and it positions you as the agent who tells people the truth."),
  idea("A lesson from my first ever sale", "what went wrong or right, and what you'd do differently now. Self-aware beats polished."),
  idea("What clients are surprised by", "the small things people don't expect — the follow-ups, the honesty on price, the Saturday call."),
  idea("The tools I couldn't work without", "the apps, the camera, the notebook. Practical, personal and easy to film."),
])}`,
    },
    {
      title: "Educate and empower",
      body_html: `
<p>When people understand the process they feel confident taking the next step. Educational content demystifies everything from viewings and valuations to legal terms and moving day, and positions you as the go-to expert when it's time to move. Clarity, not complexity — helpful advice from a friend who knows their stuff.</p>
<ul>
${idea("Guide to EPC ratings", "what an EPC is, why it matters, how ratings are calculated, and tips to improve efficiency and cut bills.")}
${idea("Offer to completion", "each stage from acceptance to exchange and completion — typical timeframes, who does what, and the common delays.")}
${idea("Renting vs buying", "the financial, lifestyle and long-term considerations: upfront costs, ongoing expenses, flexibility, the market.")}
${idea("How auctions work", "a myth-busting carousel or explainer: the speed and transparency, and the risks like non-refundable deposits.")}
${idea("What affects a property's value", "location, condition, amenities, market trends, legal considerations — so pricing conversations start from realistic expectations.")}
${idea("First-time buyer checklist", "a simple one-page checklist: pre-approval, solicitor, viewings, surveys, conveyancing, stamp duty and moving costs.")}
${idea("Step-by-step guide to listing your home", "pricing, photography, the listing copy, viewings and offers, broken into clear actionable steps.")}
${idea("How to prepare for a valuation", "a checklist walking homeowners through getting the house ready — the kind of post people save.")}
</ul>
${more([
  idea("Jargon buster", "one term a post: exchange, chain, gazumping, under offer. A series that never runs out."),
  idea("What a survey actually checks", "the difference between the levels, what's included, and what to do with the findings."),
  idea("Leasehold vs freehold, plainly", "what each means day to day: ground rent, service charges, what you can change and what you can't."),
  idea("Stamp duty in thirty seconds", "the thresholds, who pays, and one worked example on a local price. Refresh when the rules change."),
])}`,
    },
    {
      title: "Promote your service with purpose",
      body_html: `
<p>People don't just want to know that you're an estate agent — they want to understand how you work, what makes you different and why it matters to them. Explain your process clearly and confidently and you remove friction and build trust, turning followers into enquiries without ever feeling 'sold to'.</p>
<ul>
${idea("Services you offer", "your key services, who they're for and the benefit of each. A visual, easy-to-read post that invites the enquiry.")}
${idea("What happens when you book a valuation", "walk them through what to expect, so the first step feels approachable rather than uncertain.")}
${idea("Why I always follow up every viewing", "feedback, care, spotting opportunities early. A short Reel, carousel or caption on why it adds value for both sides.")}
${idea("Reasons people choose to list with me", "your strengths and your service style, in the words of the people who chose you.")}
${idea("What makes you different", "a short, honest video or caption on your values, approach and experience.")}
${idea("Step-by-step of your client process", "a behind-the-scenes carousel from first enquiry to final result, with a clear call to action at the end.")}
${idea("The value of local expertise", "how knowing your patch guides pricing, finds the hidden gems and reaches the right buyers — versus a faceless online agent.")}
${idea("My approach to marketing your home", "photography, social media, portals, viewings — the plan that gets the best result, not just a listing online.")}
</ul>
${more([
  idea("A recent result, told as a story", "the home, the challenge, what you did, how it ended. No numbers needed; the story is the proof."),
  idea("What's included in my fee", "spell it out. Transparency here removes the biggest objection before it's raised."),
  idea("How I prepare a home for photographs", "the ten minutes before the photographer arrives. Useful to sellers, and it shows your standards."),
  idea("Questions to ask any agent before you instruct", "and your answers to each. Confident, generous, and it frames the comparison in your favour."),
])}`,
    },
    {
      title: "Connect with the community",
      body_html: `
<p>Community content highlights the people, places and businesses that make your local area special. It builds trust and visibility, supports other businesses, and shows you live in — and care about — where you work. Warm, grounded and approachable.</p>
<ul>
${idea("Local business shoutouts", "a nearby café, shop or service you love, and what makes it special. Goodwill that tends to be returned.")}
${idea("Local charities and initiatives", "a community project or volunteer group making a difference — its mission, its impact, how to get involved.")}
${idea("Area spotlight", "'Why people love [area]' — the standout features and the lifestyle that make it unique for buyers and sellers.")}
${idea("Local must-sees for newcomers", "the hidden gems: a walking trail, a landmark, a must-try café, the weekend market. Photos with quick tips.")}
${idea("What's great about living in [area]", "parks, cafés, schools, culture — a concise 'top reasons' post that helps people picture life there.")}
${idea("How I stay connected to the community", "networking events, groups and meet-ups: your investment in the area's wellbeing.")}
${idea("Local living — what's nearby", "one neighbourhood's essentials on a simple map or carousel: shops, schools, parks, the best coffee.")}
${idea("Dog-friendly spots in [area]", "parks, cafés and trails where dogs are welcome. Playful, shareable, and it taps a passionate audience.")}
</ul>
${more([
  idea("The school-run reality", "the areas parents ask about and why — catchments, walking routes, the morning traffic. Honest and useful."),
  idea("The best walk within ten minutes", "one route, filmed on your phone, with where to stop for coffee. Repeatable for every patch you cover."),
  idea("Commute check", "[area] to the city, door to door, timed. The question every relocating buyer asks first."),
  idea("Weekend in [area]", "Saturday morning to Sunday night: the market, the pub, the park. Sell the life, not the house."),
])}`,
    },
    {
      title: "Make your content work harder",
      body_html: `
<p>Good content strategies balance evergreen posts — the educational, trust-building pieces that stay relevant — with timely content tied to news, market shifts or the season. Knowing when to use each keeps you delivering value and top of mind.</p>
<h3>Evergreen vs timely</h3>
<p>Evergreen posts stay valuable long-term: think 'How to prepare for a valuation'. Timely content covers news, market updates and seasonal moments, and dates quickly. You need both; the Studio's seasonal packs cover the second.</p>
<h3>Smart repurposing</h3>
<ul>
<li>Trim a Reel into a 15-second Story clip.</li>
<li>Design a static summary post for your grid.</li>
<li>Turn a Reel into a carousel.</li>
</ul>
<h3>Cross-platform</h3>
<ul>
<li><strong>LinkedIn</strong> — in-depth captions, professional tone.</li>
<li><strong>Instagram</strong> — branded visuals with short, punchy copy.</li>
<li><strong>Facebook</strong> — conversational, mixed media.</li>
</ul>
<h3>When to refresh</h3>
<p>Every three to six months, go back to your best-performing posts. Swap in fresh images, update any figures, tweak the caption. A simple refresh keeps it current long after it was first posted.</p>
<h3>Measure and iterate</h3>
<p>Compare original against repurposed: reach, saves, shares, comments. Double down on the versions that keep engaging, and refine from real numbers rather than instinct.</p>`,
    },
  ],
};
