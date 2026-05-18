// Insights — SEO-driven blog posts for estate agency / property marketing.
// Each post is self-contained: front-matter style metadata + HTML body.

const UNSPLASH = (id, w = 1600, h = 900) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export const categories = ["Branding", "Strategy", "Content", "Industry"];

export const posts = [
  // ──────────────────────────────────────────────────────────────────
  {
    slug: "why-personal-branding-works-in-estate-agency",
    title: "Why personal branding has become so effective in estate agency",
    eyebrow: "Personal brand · UK property",
    category: "Branding",
    standfirst:
      "Buyers and sellers don't pick agencies the way they used to. They pick agents — by name, by face, by feed. Here's why the personal brand has become the most valuable asset on a property professional's balance sheet.",
    hero: UNSPLASH("1573497019940-1c28c88b4f3e", 1800, 1000),
    date: "2026-05-12",
    readTime: 6,
    keywords: [
      "personal branding estate agent",
      "estate agency marketing UK",
      "property branding",
      "estate agent social media",
    ],
    body: `
      <p class="lede">Buyers and sellers have changed. The high-street brand on the sign at the end of the drive doesn't carry the weight it once did — instead, the agent's name, face, and voice carry it. That shift is why personal branding has quietly become the single most effective marketing strategy in UK estate agency.</p>

      <h2>People buy from people</h2>
      <p>A pivotal home decision — sometimes the biggest financial decision of a person's life — rarely starts with a corporate brand. It starts with a search, a recommendation, or a name that keeps appearing on someone's feed. The agent who looks like a real, capable, considered human almost always wins the instruction. The agency name on the letterhead is secondary.</p>
      <p>This is why independent agents and team leads inside larger firms are increasingly outperforming their own brand. Their followers, recognisability, and authority sit with the person, not the office.</p>

      <h2>Trust is built in public, not pitched in private</h2>
      <p>Vendors no longer call three agents, read three valuations, and pick the middle one. They quietly observe — for weeks, sometimes months — before they ever make contact. A consistent, on-brand social presence is the silent valuation they're running on you.</p>
      <p>If a homeowner watches your content for six weeks before reaching out, they've already pre-qualified you against every other agent in the area. By the time you walk through their door, the trust is established. The valuation becomes a conversation, not a pitch.</p>

      <blockquote>The agent who shows up consistently in someone's feed for six weeks has already won the instruction before the valuation is booked.</blockquote>

      <h2>Recognisability compounds</h2>
      <p>One post means almost nothing. Fifty posts, across six months, with a consistent voice and a recognisable face, builds something an agency logo can never replicate: <em>visual familiarity</em>. The brain registers familiarity as trust — it's a quirk of how we're wired, and it's the engine behind why a personal brand outperforms a corporate one in a hyperlocal, high-trust market like property.</p>

      <h2>The market has moved online — your brand should too</h2>
      <p>The traditional agency moats — the high-street window, the local paper, the For Sale board — still matter, but they're no longer where the decision gets made. The decision is now made on a phone, in the evening, by a person who's already scrolled past your post twice this week.</p>
      <p>The agents winning the next decade of property are the ones who treat their brand as an editorial product: regular, considered, identifiable. Not a hard sell, not a flood of listings, but a presence — built around their face, their voice, and their point of view on the market.</p>

      <h2>How to start (without overthinking it)</h2>
      <ul>
        <li><strong>Show your face.</strong> Not just listings — you. Standing in front of houses, talking to camera, sat at your desk. Recognisability is the currency.</li>
        <li><strong>Pick a voice and hold it.</strong> Confident, calm, considered, opinionated — choose one and don't drift. Consistency over cleverness.</li>
        <li><strong>Talk about the market, not just your stock.</strong> Local insight, price commentary, neighbourhood detail. This is what positions you as the expert in the area.</li>
        <li><strong>Post weekly, minimum.</strong> Visibility is a discipline, not a campaign. A consistent twice-a-week feed beats a viral burst every time.</li>
      </ul>

      <p>Personal branding isn't a vanity project. In estate agency, it's the most measurable, durable, and compounding marketing asset you can build. The agency name will fade. The face won't.</p>
    `,
  },

  // ──────────────────────────────────────────────────────────────────
  {
    slug: "whats-killing-your-social-media-presence",
    title: "What's killing your social media presence",
    eyebrow: "Diagnostic · Social media",
    category: "Strategy",
    standfirst:
      "Engagement isn't dying because the algorithm hates you. It's dying because of five very specific, very fixable things — most of which estate agents are doing without realising.",
    hero: UNSPLASH("1611162616475-46b635cb6868", 1800, 1000),
    date: "2026-05-08",
    readTime: 7,
    keywords: [
      "estate agent social media tips",
      "what kills social media engagement",
      "property social media UK",
      "social media for estate agencies",
    ],
    body: `
      <p class="lede">If you've felt your engagement quietly slip over the last twelve months — fewer comments, smaller reach, slower DMs — it's almost never the platform's fault. It's a stack of small, fixable habits that, taken together, have made your feed forgettable.</p>

      <h2>1. You only post when you have a listing</h2>
      <p>The single most common pattern we see on estate agent feeds: a flurry of listing posts for two days, then silence for a week, then another flurry. The algorithm reads this as low-effort, low-relevance content — because that's exactly what it is. Listings alone do not build an audience. They convert one.</p>
      <p>Your feed is your storefront. If the only thing in your window is property sheets, no one walks past slowly enough to look at the windows next door.</p>

      <h2>2. Your content has no recognisable voice</h2>
      <p>Half your captions sound like the manager wrote them. The other half sound like a template. Tone drifts post to post. Your followers can't tell, with the sound off, that a piece of content is yours. That's the death of personal brand recognition.</p>
      <p>A consistent voice — confident, calm, specific, opinionated — is what makes content sticky. It's also what gets people to send your posts to a friend with "you should follow this lot."</p>

      <h2>3. You're using stock imagery and platform templates</h2>
      <p>The Canva templates that flooded property in 2023 have done their damage. A scroll-blind buyer can spot a templated post in under a second and is trained to skip it. If your content looks like everyone else's, the algorithm has no reason to show it to anyone who isn't already following you.</p>

      <blockquote>Templated content is the visual equivalent of a generic sales call. People are very good at not picking up.</blockquote>

      <h2>4. You're posting at random</h2>
      <p>Cadence is half the work. Three posts one week, none the next, six the following — the algorithm scores you on consistency before it scores you on quality. A steady twice-a-week schedule, held for six months, will outperform brilliant content posted unpredictably.</p>
      <p>The simple rule: post less, but on a calendar you actually keep.</p>

      <h2>5. You're not in any of the content</h2>
      <p>If a prospective vendor opens your grid and can't tell who you are or what you stand for in under five seconds, they bounce. Faceless feeds — all property, no people — feel like adverts. Faces, voices, personality, behind-the-scenes — these feel like brands.</p>

      <h2>What actually fixes it</h2>
      <ul>
        <li><strong>Pick a posting rhythm and protect it.</strong> Twice a week, every week, for six months. Block the time, batch the content.</li>
        <li><strong>Mix the content stack.</strong> Listings, local market insight, behind-the-scenes, team, opinion. Roughly one of each, per fortnight.</li>
        <li><strong>Drop the templates.</strong> Move to design-led, brand-specific content. Even simple photography with one consistent overlay beats a polished template.</li>
        <li><strong>Show your face.</strong> Aim for one talking-head video per fortnight. Phone camera is fine; consistency matters more than production value.</li>
        <li><strong>Audit your last 30 days.</strong> If you cannot describe your feed's voice in one sentence, neither can your audience.</li>
      </ul>

      <p>Social media reach isn't a mystery box. It's the natural output of consistent, branded, person-led content. Fix the five things above and the numbers come back — usually within a quarter.</p>
    `,
  },

  // ──────────────────────────────────────────────────────────────────
  {
    slug: "best-tips-to-be-found-on-social-media",
    title: "The best tips to be found on social media",
    eyebrow: "Visibility playbook",
    category: "Content",
    standfirst:
      "Reach isn't luck. It's a stack of small, deliberate choices about how you write, where you tag, and what you post. Here's the visibility playbook for property professionals who want to be found before they reach out.",
    hero: UNSPLASH("1556761175-5973dc0f32e7", 1800, 1000),
    date: "2026-05-05",
    readTime: 6,
    keywords: [
      "be found on social media",
      "estate agent SEO social",
      "property hashtag strategy",
      "social media discoverability",
    ],
    body: `
      <p class="lede">"How do I get found?" is the most-asked question in property marketing. The honest answer: visibility is a system, not a stroke of luck. Here's the playbook that actually moves the needle for estate agents and property brands.</p>

      <h2>1. Geo-tag every post</h2>
      <p>It is staggering how many estate agents publish content with no location data attached. Geo-tagging is the single highest-leverage thing you can do for local discoverability. Instagram, TikTok, and Facebook all serve geo-tagged content to users browsing nearby. If you're a Cobham agent and you're not tagging Cobham — and the four villages around it — you're invisible.</p>

      <h2>2. Think in keywords, not just hashtags</h2>
      <p>The platforms now read the caption. Whole sentences. Properly. Which means a caption that says "three-bedroom semi in Sevenoaks with original Victorian features" is doing real SEO work for you. A caption that says "✨ NEW LISTING ✨" is doing none.</p>
      <p>Write captions like a buyer would search: location, type, key feature. Then add hashtags as a secondary layer.</p>

      <h2>3. Use a hashtag stack, not a hashtag dump</h2>
      <p>Twenty hashtags shotgunned at the end of a post used to work. It doesn't any more. The current best practice is a tight stack — six to ten — split across:</p>
      <ul>
        <li><strong>2–3 geographic</strong> (#SevenoaksHomes, #SurreyProperty)</li>
        <li><strong>2–3 niche</strong> (#PeriodHomesUK, #LettingsLondon)</li>
        <li><strong>2 brand</strong> (your own + your agency's)</li>
      </ul>

      <blockquote>A tight stack of relevant tags outperforms a wall of broad ones — every time, on every platform.</blockquote>

      <h2>4. Post in the formats the platforms reward</h2>
      <p>Reels and short-form video on Instagram and TikTok are still receiving 3-5× the organic reach of a static post. Whether you like making video or not, the maths is unambiguous. One reel a week — even a simple piece-to-camera — will outperform five static posts.</p>

      <h2>5. Hook the first three seconds</h2>
      <p>Most scrolls are killed in three seconds. Your opening frame, your opening line, your opening image — these are doing 80% of the work. "Three things buyers asked me this week" beats "Here at TMKE Property…" every single time.</p>

      <h2>6. Reply to everything for the first hour</h2>
      <p>The first 60 minutes after a post goes live is when the algorithm decides whether to push it. Comments, replies, DMs in that window are weighted heavily. Block ten minutes on either side of every post to reply to everything that comes in.</p>

      <h2>7. Repurpose ruthlessly</h2>
      <p>One piece of content should appear in four places: feed post, story, reel, and LinkedIn. The audience overlap is much smaller than people assume. You are not annoying anyone by reusing your own work — you're just being seen.</p>

      <h2>8. Build a content niche, then widen it</h2>
      <p>The fastest way to grow is to be known for one specific thing first. "The lettings agent who explains the rules" or "the Sevenoaks agent who knows period houses." Once you own the niche, you can widen out. Trying to be everything from day one is what keeps accounts flat.</p>

      <p>Visibility isn't about working harder. It's about a small set of disciplined choices, made consistently. Pick three of the above and protect them for six months. The growth follows.</p>
    `,
  },

  // ──────────────────────────────────────────────────────────────────
  {
    slug: "why-traditional-estate-agency-is-failing",
    title: "Why the traditional estate agency market is failing",
    eyebrow: "Industry analysis",
    category: "Industry",
    standfirst:
      "The high-street model isn't dying. But the version of it that survives the next decade looks very different to the one most agencies are still operating. A clear-eyed look at what's broken — and what replaces it.",
    hero: UNSPLASH("1568605114967-8130f3a36994", 1800, 1000),
    date: "2026-04-29",
    readTime: 8,
    keywords: [
      "traditional estate agency failing",
      "estate agent industry UK",
      "future of estate agency",
      "online vs high street agents",
    ],
    body: `
      <p class="lede">Walk down any UK high street and you'll still see them: the estate agent windows, the bright property cards, the brand colours that haven't changed since 2008. The model isn't extinct — but the cracks are widening, and the agencies pretending otherwise are losing market share by the quarter.</p>

      <h2>The vendor journey has moved entirely online</h2>
      <p>The defining shift of the last decade isn't online agents — it's online vendors. Today, more than 80% of homeowners begin the decision to sell from their sofa, not the high street. They search, they scroll, they compare, they shortlist — and by the time they engage an agent, they've already mostly decided.</p>
      <p>The traditional agency model is calibrated for a customer who walks into the branch. That customer has largely disappeared. The vendor of 2026 visits a website, watches three or four agents on social, asks the neighbour, and then makes contact.</p>

      <h2>Brand recognition is at the agent level, not the agency level</h2>
      <p>Twenty years ago, the agency name carried the deal. Today, it's the agent's name, and increasingly, their face. Vendors don't list with Foxtons or Strutt & Parker because of the logo — they list with the specific agent who's been in their feed, in their inbox, or in their neighbour's living room.</p>
      <p>This is an existential issue for traditional agencies whose marketing budget still sits with the corporate brand rather than with their best agents. The talent walks, the followers walk with them, and the brand loses ground.</p>

      <blockquote>Agencies still spending six figures on logo placement and zero on their best agent's content are losing market share they can't see in the P&amp;L yet.</blockquote>

      <h2>The price-fee model is under sustained pressure</h2>
      <p>Online and hybrid agencies cracked the fee ceiling. Fixed-fee, low-fee, and tiered models are now mainstream. Traditional 1.5%+ commission can still be justified — but only by an obviously differentiated service. The middle of the market, where the service feels generic and the fee feels arbitrary, is collapsing.</p>
      <p>The successful traditional agencies of the next decade are the ones who can articulate, plainly, what their fee is buying — and prove it.</p>

      <h2>The branch as a cost centre, not an asset</h2>
      <p>High-street rent, business rates, and staff costs are no longer offset by walk-in business. The branch has quietly become a brand statement that costs £80–120k a year to keep open. Some agencies have made peace with that and reframed the branch as a brand asset. Many haven't — and are bleeding margin while pretending otherwise.</p>

      <h2>What survives</h2>
      <p>Traditional agency isn't going extinct. The version that survives looks like this:</p>
      <ul>
        <li><strong>Agent-led brand.</strong> The best people are the brand. Their faces, their content, their reputation. The agency wraps around them, not the other way round.</li>
        <li><strong>Hyperlocal expertise.</strong> Not "covering Surrey" — owning one village. Deep specialism beats broad coverage.</li>
        <li><strong>Service that justifies the fee.</strong> Premium pricing only works with premium delivery. The vague promise of "personal service" no longer cuts it.</li>
        <li><strong>Digital-first marketing.</strong> Social, content, video, structured CRM — funded properly, run consistently, owned by people who care.</li>
        <li><strong>A leaner physical footprint.</strong> Branches as brand experiences rather than transactional centres.</li>
      </ul>

      <p>The agencies that thrive through the next decade aren't the ones who fight the shift. They're the ones who notice the customer has already moved, and rebuild around where the customer actually is — phone in hand, scrolling, deciding before the conversation even starts.</p>
    `,
  },

  // ──────────────────────────────────────────────────────────────────
  {
    slug: "content-cadence-that-moves-listings",
    title: "The content cadence that actually moves listings",
    eyebrow: "Strategy · Cadence",
    category: "Strategy",
    standfirst:
      "Most estate agents post too often, too inconsistently, or with no real plan. The cadence that actually moves listings is built on a simple weekly stack — and it's almost certainly less than you think.",
    hero: UNSPLASH("1454165804606-c3d57bc86b40", 1800, 1000),
    date: "2026-04-22",
    readTime: 5,
    keywords: [
      "estate agent content schedule",
      "social media cadence property",
      "how often should estate agents post",
      "content plan estate agency",
    ],
    body: `
      <p class="lede">"How often should we post?" is the wrong question. The right one is: <em>what should we post, in what order, with what intent?</em> Here's the weekly cadence that consistently produces inbound enquiries for UK property businesses.</p>

      <h2>The weekly stack</h2>
      <p>The simplest, highest-performing weekly content stack we've seen across UK estate agency looks like this:</p>
      <ul>
        <li><strong>Monday — Market beat.</strong> A short take on what's happening in your local market. One stat, one observation, one opinion.</li>
        <li><strong>Wednesday — Listing or feature.</strong> A property or a deep-dive on a single room/feature. Strong photography, considered caption.</li>
        <li><strong>Friday — Face and voice.</strong> Talking head video, behind the scenes, team feature, or opinion piece. This is the trust-builder.</li>
      </ul>
      <p>Three posts a week. Plus stories every working day for top-of-mind. That's the entire engine.</p>

      <h2>Why three works and five doesn't</h2>
      <p>Most agents who try to post daily either burn out by week four or quietly drop quality. Three considered posts a week, held for six months, will outperform five mediocre posts a week, every time. Cadence has to be sustainable to compound.</p>

      <blockquote>A schedule you can keep for six months beats a perfect schedule you abandon in eight weeks.</blockquote>

      <h2>The role of video</h2>
      <p>One of the three weekly posts should be video. It does not have to be polished. Phone camera, natural light, ninety seconds of useful or interesting content. Video earns 3–5× the organic reach of static — declining to make video is now a measurable commercial cost.</p>

      <h2>Stories: the daily heartbeat</h2>
      <p>Stories sit underneath the main feed and serve a different purpose: top-of-mind, behind-the-scenes, real-time. One or two a working day is plenty. They don't need to be polished — they need to be there.</p>

      <h2>What to do in the weeks you have nothing</h2>
      <p>Every agent has weeks where listings are quiet and the market feels flat. This is when most accounts go silent — exactly when they should be doubling down on the non-listing content (market beat, opinion, team, behind-the-scenes). Silence in slow weeks is what trains the algorithm to deprioritise you. Showing up in the quiet weeks is what makes you the obvious call when the market turns.</p>

      <p>Three considered posts a week, daily stories, one video per week. That's the cadence. Hold it for two quarters. The phone starts ringing.</p>
    `,
  },

  // ──────────────────────────────────────────────────────────────────
  {
    slug: "five-seconds-how-prospects-judge-your-agency",
    title: "Five seconds: how prospects judge your agency before they call",
    eyebrow: "Brand audit",
    category: "Branding",
    standfirst:
      "Before a vendor calls, emails, or fills in a contact form, they've spent about five seconds on your profile. Here's what they're scoring you on — and the audit that fixes it before they bounce.",
    hero: UNSPLASH("1551434678-e076c223a692", 1800, 1000),
    date: "2026-04-15",
    readTime: 5,
    keywords: [
      "estate agent first impression",
      "property brand audit",
      "instagram bio estate agent",
      "social media first impression property",
    ],
    body: `
      <p class="lede">A prospective vendor finds you. They open your Instagram or LinkedIn, glance for five seconds, and decide whether you make their shortlist. The decision is largely made before they've even read a caption. Here's what's being scored — and how to make sure you're scoring well.</p>

      <h2>The five-second checklist</h2>
      <p>This is roughly what runs through the scrolling brain in the first five seconds:</p>
      <ul>
        <li><strong>Can I tell who they are?</strong> Logo, face, agency, area — clear in under a second?</li>
        <li><strong>Does it feel current?</strong> Last post within the week, or a graveyard from three months ago?</li>
        <li><strong>Does the grid look intentional?</strong> A scrolling glance — does the visual identity hold together, or feel chaotic?</li>
        <li><strong>Is there a person in there?</strong> Faces signal trust. Faceless feeds signal a corporate account.</li>
        <li><strong>Is the bio doing any work?</strong> Or is it a one-liner with no link, no positioning, no proof?</li>
      </ul>

      <h2>The audit you should run this week</h2>
      <p>Open your account on a phone — not desktop. The phone view is the only view that matters. Then run through this:</p>

      <h2>1. Profile photo</h2>
      <p>A face, not a logo. Brain studies are unambiguous: profile pictures with a clear human face get 40%+ more engagement than logo-only profile pictures. Crop tight, well-lit, eyes visible.</p>

      <h2>2. Name field (not handle)</h2>
      <p>The name field is searchable. Most agents waste it. "Jamie · Sevenoaks Property" works much harder than "Jamie Rowe." It tells the algorithm and the human, in one glance, what you do and where.</p>

      <h2>3. Bio</h2>
      <p>Three lines, used hard:</p>
      <ul>
        <li>Line 1: who you help and where</li>
        <li>Line 2: a single proof point or specialism</li>
        <li>Line 3: a clear call-to-action with a link</li>
      </ul>

      <blockquote>If your bio could belong to any of fifty other agents in your county, it's not doing any work.</blockquote>

      <h2>4. The first nine tiles</h2>
      <p>The top three rows are the entire first impression. Audit them ruthlessly. Is there a face in there? A listing? Variety? Or is it nine identical listing cards in a row?</p>

      <h2>5. The link</h2>
      <p>One link, going to one useful destination. A landing page, a recent valuation tool, a featured property. Not your homepage with eleven menu items. Make the path obvious.</p>

      <p>This audit takes thirty minutes and improves your inbound rate within a week. Most agents don't run it once a year. The ones who run it once a quarter are quietly winning the instructions.</p>
    `,
  },
];

export function getPost(slug) {
  return posts.find((p) => p.slug === slug) || null;
}

export function postsByCategory(category) {
  if (!category || category === "all") return posts;
  return posts.filter((p) => p.category === category);
}
