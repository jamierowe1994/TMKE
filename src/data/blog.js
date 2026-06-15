// Insights — blog posts for estate agency / property marketing.
//
// Posts can live in either of two places:
//   1. The admin (Supabase `blog_posts` table) — what the marketing team
//      actually uses day-to-day. Queried at build time via getStaticPaths.
//   2. The STATIC_POSTS array below — fallback used when Supabase isn't
//      configured (e.g. local dev without an .env), so the site never
//      ships with an empty /blog.
//
// All public-facing reads should go through the async helpers at the
// bottom of this file (getPublishedPosts / getPost / getCategories).

import { marked } from "marked";
import { supabase, isConfigured } from "../lib/supabase.js";

const UNSPLASH = (id, w = 1600, h = 900) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export const categories = ["Branding", "Strategy", "Content", "Industry"];

// Pre-configure marked for clean, semantic HTML
marked.setOptions({ gfm: true, breaks: false });

export const STATIC_POSTS = [
  // ──────────────────────────────────────────────────────────────────
  {
    slug: "why-personal-branding-works-in-estate-agency",
    title: "Why personal branding has become so effective in estate agency",
    eyebrow: "Personal brand · UK property",
    category: "Branding",
    standfirst:
      "Buyers and sellers don't pick agencies the way they used to. They pick agents — by name, by face, by feed. Here's why the personal brand has become the most valuable asset on a property professional's balance sheet.",
    hero: "/assets/personal-brand.jpg",
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
    hero: "/assets/home%20window.jpg",
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
    hero: "/assets/coming-soon.png",
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
    hero: "/assets/vibes.jpg",
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

  // ══════════════════════════════════════════════════════════════════
  // INTERIM IMAGERY NOTE: the seven posts below use existing R2 property
  // photos as placeholders (assets.tmke.co.uk/*.webp). Swap each `hero` (and
  // add `video:` where wanted) to the client's newly-uploaded R2 files once the
  // filenames are confirmed — one unique image/video per post, no reuse.
  // ══════════════════════════════════════════════════════════════════

  {
    slug: "hyperlocal-facebook-groups-win-instructions",
    title: "How hyperlocal Facebook groups quietly win instructions",
    eyebrow: "Community · Local marketing",
    category: "Strategy",
    standfirst:
      "Almost every village and neighbourhood in the UK has its own Facebook group — and most agents ignore them. Done right, they're the warmest, most trusted route to local instructions there is.",
    hero: "https://assets.tmke.co.uk/white-1.webp",
    date: "2026-04-12",
    readTime: 6,
    keywords: [
      "estate agent facebook group",
      "local community marketing property",
      "hyperlocal estate agency",
      "village facebook group estate agent",
    ],
    body: `
      <p class="lede">Open Facebook and search your patch — the village, the estate, the postcode. You'll almost always find a group: "Cobham Community," "Life in Sevenoaks," "Spotters of [your town]." A few thousand locals, posting about lost cats, road closures, school fairs, and recommendations. This is the most trusted marketing channel in your area, and most agents never touch it.</p>

      <h2>Why these groups matter so much</h2>
      <p>Estate agency is a hyperlocal, high-trust business. People don't instruct a stranger with a megaphone — they instruct the agent the neighbour mentioned, the one who sponsored the summer fête, the face they recognise from the group. A village Facebook group is where that trust is built in public, slowly, before anyone is thinking about moving.</p>

      <blockquote>You're not trying to sell to the group. You're trying to become a known, useful, local face — so that when someone <em>does</em> decide to sell, you're the obvious call.</blockquote>

      <h2>The rules of the road</h2>
      <p>These groups have admins, and they have a finely-tuned allergy to advertising. Drop a listing with a phone number and you'll be removed by lunchtime. The whole game is being a genuine local first and an agent a distant second.</p>
      <ul>
        <li><strong>Be a person, not a brand.</strong> Post from your own profile, not the agency page. People connect with Jamie who lives two villages over, not "TMKE Property Ltd."</li>
        <li><strong>Give before you take.</strong> Local market snippets, "what sold and for how much" without the hard sell, answers to "is now a good time to sell?" questions. Be the helpful one.</li>
        <li><strong>Show up offline too.</strong> The school fair, the quiz night, the litter pick. The group is the digital shadow of a real community — be in both.</li>
        <li><strong>Read the room on promotion.</strong> Most groups allow a genuine local business an occasional, tasteful post. Earn it first, ask the admin, keep it rare.</li>
      </ul>

      <h2>The compounding effect</h2>
      <p>One helpful comment does nothing. Six months of being the recognisable, generous local face in three or four area groups builds something no boosted post can buy: you become "our" agent in the minds of a few thousand people who haven't moved yet — but one day will. When that day comes, you're not competing on fee. You're already the trusted name.</p>

      <p>It costs nothing but time and genuine presence. In a business built on local trust, that's the highest return on effort available.</p>
    `,
  },

  {
    slug: "the-follow-method-done-properly",
    title: "The follow method, done properly (and without the spam)",
    eyebrow: "Growth · Social media",
    category: "Content",
    standfirst:
      "Following local accounts to grow your own is one of the oldest tactics in the book — and one of the most abused. Here's how to use it deliberately to build a genuinely local audience, not a vanity number.",
    hero: "https://assets.tmke.co.uk/orange-1.webp",
    date: "2026-04-08",
    readTime: 5,
    keywords: [
      "grow instagram following estate agent",
      "follow unfollow method property",
      "local audience social media",
      "estate agent instagram growth",
    ],
    body: `
      <p class="lede">The follow method gets a bad name because most people do it badly: mass-follow a thousand random accounts, unfollow them all a week later, repeat. That's spam, the platforms throttle it, and it builds an audience of no one. Done with intent, though, deliberately following the <em>right</em> local accounts is still one of the most effective ways to build a genuinely local following.</p>

      <h2>The point is relevance, not volume</h2>
      <p>A property business doesn't need 50,000 followers in Manila. It needs 2,000 followers who live within ten miles. The follow method, used properly, is simply a way to put yourself in front of the right local people and let the genuinely interested ones follow back.</p>

      <h2>How to do it deliberately</h2>
      <ul>
        <li><strong>Build a target list.</strong> Local cafés, gyms, schools, interiors shops, community groups, "things to do in [town]" accounts. Follow the businesses, then the people who engage with them.</li>
        <li><strong>Engage before you follow.</strong> A thoughtful comment on a local café's post does more than a silent follow. You become a familiar name in the local feed.</li>
        <li><strong>Keep it human and slow.</strong> Ten to twenty intentional follows a day, not two hundred. The platforms reward natural behaviour and punish bursts.</li>
        <li><strong>Don't mass-unfollow.</strong> The aggressive follow-then-dump cycle is what tanks accounts. If you followed relevant local accounts, why would you want to unfollow them? Keep the ones that matter.</li>
      </ul>

      <blockquote>Following is just the knock on the door. What makes someone follow back — and stay — is content worth following.</blockquote>

      <h2>It only works on top of good content</h2>
      <p>This is the part everyone skips. The follow method gets eyes on your profile; your grid decides whether they stay. If your last nine tiles are nine identical listing cards, a curious local takes one look and leaves. Pair deliberate local following with a feed that has a face, a voice, and useful local content, and you'll grow a small, dense, genuinely local audience — which, in property, is worth a hundred times more than a big anonymous one.</p>
    `,
  },

  {
    slug: "how-long-to-build-a-property-following",
    title: "How long it really takes to build a property following",
    eyebrow: "Strategy · Expectations",
    category: "Strategy",
    standfirst:
      "Everyone wants the audience; almost no one is told the honest timeline. Here's what actually happens, month by month, when an estate agent commits to building a social presence properly.",
    hero: "https://assets.tmke.co.uk/living-2.webp",
    date: "2026-04-03",
    readTime: 6,
    keywords: [
      "how long to grow social media following",
      "estate agent social media timeline",
      "building an audience property",
      "realistic social media growth",
    ],
    body: `
      <p class="lede">The single biggest reason estate agents quit social media is a mismatch of expectations. They post consistently for six weeks, see little, and conclude it doesn't work. The truth is that the timeline for building a real, local, trust-based following is measured in quarters, not weeks — and it follows a fairly predictable curve.</p>

      <h2>Month 0–2: the quiet build</h2>
      <p>Almost nothing visible happens. You're posting into what feels like a void. Numbers barely move. This is normal and it is not failure — you are laying down the back catalogue and the habit. The work here is establishing a voice and a cadence you can actually keep.</p>

      <h2>Month 3–4: the first signals</h2>
      <p>Comments start. A DM here and there. Someone mentions they "saw your post." The algorithm has enough consistent data to start showing your content beyond your existing followers. This is the stage most people never reach because they quit in month two.</p>

      <blockquote>The agents who win aren't the ones with the best content. They're the ones who were still posting in month four.</blockquote>

      <h2>Month 5–8: compounding</h2>
      <p>Now the back catalogue is doing work. New followers binge old posts. Recognisability kicks in — people have seen your face enough times that it registers as trust. The first "I've been watching your stuff for a while and we're thinking of selling" message arrives. This is the inflection point.</p>

      <h2>Month 9–12: the asset</h2>
      <p>By the end of a year of consistent, person-led posting, you have something an agency logo can't buy: a local audience that knows your face, trusts your read on the market, and thinks of you first. Inbound enquiries become a steady trickle rather than a fluke.</p>

      <h2>The honest summary</h2>
      <ul>
        <li><strong>Weeks 1–8:</strong> build the habit. Expect silence.</li>
        <li><strong>Months 3–4:</strong> first real signals. Don't quit here.</li>
        <li><strong>Months 5–8:</strong> compounding and first enquiries.</li>
        <li><strong>Months 9–12:</strong> a genuine local asset.</li>
      </ul>

      <p>None of this works without consistency, and none of it works fast. But twelve months of steady, person-led posting reliably beats two years of stop-start brilliance. The agents who treat it as a slow build, not a quick campaign, are the ones still standing when it pays off.</p>
    `,
  },

  {
    slug: "five-video-editing-tools-for-estate-agents",
    title: "Five video editing tools every estate agent should know",
    eyebrow: "Toolkit · Video",
    category: "Content",
    standfirst:
      "Video earns the reach, but the editing is where most agents get stuck. These five tools cover everything from a thirty-second phone reel to a polished property film — most of them free to start.",
    hero: "https://assets.tmke.co.uk/kitchen-2.webp",
    date: "2026-03-28",
    readTime: 5,
    keywords: [
      "video editing tools estate agents",
      "best video editing apps property",
      "property reel editing",
      "estate agent video software",
    ],
    body: `
      <p class="lede">You don't need a production company to make video that performs — you need the right tool for the job and the discipline to actually publish. Here are five we'd put in any estate agent's kit, from "edit on the train home" to "proper property film."</p>

      <h2>1. CapCut — the everyday workhorse</h2>
      <p>Free, fast, and built for exactly the vertical, captioned, social-first video the platforms reward. Auto-captions, trendy templates, easy text and music. If you make one reel a week on your phone, this is almost certainly all you need. Start here.</p>

      <h2>2. Adobe Premiere Rush — a step up, still simple</h2>
      <p>When you outgrow CapCut and want more control over colour, audio, and multi-clip edits without learning full Premiere Pro, Rush is the bridge. Works across phone and desktop, syncs projects, and produces a noticeably more "finished" result.</p>

      <h2>3. DaVinci Resolve — free, but properly powerful</h2>
      <p>The free version of Resolve is genuinely professional-grade, particularly for colour. If you're filming polished property walkthroughs and want them to look cinematic — the warm, graded look that makes an interior sing — this is the tool. Steeper learning curve, worth it for hero content.</p>

      <blockquote>Match the tool to the job: CapCut for the weekly reel, Resolve for the property film. Don't open the cinema camera to cut a thirty-second clip.</blockquote>

      <h2>4. Descript — editing by editing the words</h2>
      <p>Descript transcribes your video and lets you edit it like a document — delete a sentence, the footage goes with it. For talking-head content (the trust-building piece-to-camera), it's a revelation. It also strips out "ums" automatically. A huge time-saver for agents who talk to camera.</p>

      <h2>5. Canva — the quick-and-cohesive option</h2>
      <p>Not a deep editor, but for stitching clips, adding on-brand text and your colours, and turning a few phone snaps into a tidy listing reel, it's fast and keeps everything consistent with the rest of your brand. Best when speed and brand-consistency matter more than fine control.</p>

      <h2>The honest advice</h2>
      <p>Pick one, learn it properly, and ship. The agent who masters CapCut and posts weekly will always beat the one who bought the expensive software and never published. The tool is not the bottleneck — the publishing habit is.</p>
    `,
  },

  {
    slug: "filming-a-property-walkthrough-on-your-phone",
    title: "Filming a property walkthrough on just your phone",
    eyebrow: "How-to · Video",
    category: "Content",
    standfirst:
      "You don't need a gimbal, a drone, or a videographer to make a walkthrough that sells. You need a phone, a bit of technique, and a repeatable routine. Here's the whole thing.",
    hero: "https://assets.tmke.co.uk/white-2.webp",
    date: "2026-03-22",
    readTime: 6,
    keywords: [
      "property walkthrough video phone",
      "how to film a house tour",
      "estate agent video tips",
      "phone property videography",
    ],
    body: `
      <p class="lede">The best property video isn't always the most expensive one. A confident, well-lit, steady phone walkthrough — with a real agent talking through the home — often outperforms a glossy drone production, because it feels honest and human. Here's how to shoot one that actually moves a buyer.</p>

      <h2>Before you press record</h2>
      <ul>
        <li><strong>Open every curtain and turn on every light.</strong> Light is everything. A bright room photographs and films twice as well as a dim one.</li>
        <li><strong>Tidy ruthlessly.</strong> Clear surfaces, square the cushions, hide the bins. The camera exaggerates clutter.</li>
        <li><strong>Plan the route.</strong> Walk the home the way a buyer would experience it — in the front door, through to the heart of the house, finish on the best feature.</li>
        <li><strong>Wipe the lens.</strong> The single most common reason phone footage looks foggy. Ten seconds, every time.</li>
      </ul>

      <h2>Shooting technique</h2>
      <p>Hold the phone in both hands, elbows tucked into your body for stability, and <em>walk heel-to-toe</em>, slowly, like you're carrying a full cup of coffee. Move the camera deliberately — slow pans, no whip-arounds. Film in landscape for the website and portrait for social; if in doubt, shoot a vertical pass for reels and a horizontal pass for the listing.</p>

      <blockquote>Slow and steady reads as premium. Fast and shaky reads as amateur — even in a beautiful home.</blockquote>

      <h2>The agent-led version</h2>
      <p>The version that builds your brand as well as selling the house is the one with you in it. Walk and talk: "Through here is the kitchen — and this is the bit everyone falls for…" It's harder, it takes a couple of takes, and it's worth it. A face and a voice turn a property tour into a piece of personal-brand content that works long after the house is sold.</p>

      <h2>A simple, repeatable routine</h2>
      <p>Natural light, lens wiped, both hands, slow heel-to-toe, best feature last, one vertical pass and one horizontal. Edit in CapCut, add captions, keep it under sixty seconds for social. Do it on every instruction and within a month you'll have a body of work — and a noticeably stronger feed — for the price of fifteen extra minutes per viewing.</p>
    `,
  },

  {
    slug: "the-reviews-engine-google-business-profile",
    title: "The reviews engine most agents are leaving switched off",
    eyebrow: "Local SEO · Reputation",
    category: "Strategy",
    standfirst:
      "Before a vendor calls, they Google you — and what they find is your star rating. A steady stream of recent, genuine reviews is the cheapest, highest-trust marketing an agency can build. Most agents barely touch it.",
    hero: "https://assets.tmke.co.uk/orange-2.webp",
    date: "2026-03-16",
    readTime: 5,
    keywords: [
      "google reviews estate agent",
      "google business profile property",
      "estate agency reputation marketing",
      "local seo estate agents",
    ],
    body: `
      <p class="lede">A prospective vendor's research almost always includes one quiet step: they type your name into Google. What surfaces — your star rating, your recent reviews, your map pin — is doing more to win or lose the instruction than most of your paid marketing. And it's largely free.</p>

      <h2>Why reviews punch above their weight</h2>
      <p>Property is a high-stakes, infrequent, trust-led purchase. A vendor choosing between agents reads reviews the way they'd read references for a builder. A wall of recent, specific, five-star reviews does more to reassure them than any brochure. It's social proof at the exact moment of decision.</p>

      <h2>Google Business Profile is the centre of it</h2>
      <p>Your Google Business Profile is the listing that shows up when someone searches your agency or "estate agents near me." It feeds the map, the star rating, and the reviews. Claiming it, completing it fully, and keeping it active is the single highest-leverage local-SEO move an agency can make — and it's free.</p>

      <ul>
        <li><strong>Claim and complete it.</strong> Photos, hours, services, a real description. A complete profile ranks higher and converts better.</li>
        <li><strong>Ask for reviews systematically.</strong> Not "leave us a review if you fancy it" — a built-in step at completion, with a direct link, every single time.</li>
        <li><strong>Make it effortless.</strong> A short link or QR code that lands straight on the review box. Every extra click loses you reviews.</li>
        <li><strong>Reply to all of them.</strong> Every review, good or bad, gets a warm, human reply. It signals you care and it feeds the ranking.</li>
      </ul>

      <blockquote>Recency matters as much as the average. Twenty reviews from this year beats a hundred from 2019.</blockquote>

      <h2>The handling-the-bad-one rule</h2>
      <p>You'll get the occasional unfair review. Don't panic and don't argue. A calm, professional, brief reply — "I'm sorry your experience fell short; we'd genuinely like to put it right, please call us" — reassures the hundred future readers far more than a defensive essay. The reply is for the audience, not the reviewer.</p>

      <p>Switch the reviews engine on, make asking a habit at the end of every transaction, and within a year you'll have the kind of recent, specific, five-star wall that quietly wins the close calls.</p>
    `,
  },

  {
    slug: "showing-up-offline-local-events",
    title: "Showing up offline: why local events still win online",
    eyebrow: "Community · Brand",
    category: "Branding",
    standfirst:
      "The most effective property marketing isn't always on a screen. The summer fête, the quiz night, the school fair — being a real, recognisable local face is what makes all your online content land.",
    hero: "https://assets.tmke.co.uk/table.webp",
    date: "2026-03-10",
    readTime: 5,
    keywords: [
      "estate agent community marketing",
      "local events estate agency",
      "sponsorship estate agent",
      "offline marketing property",
    ],
    body: `
      <p class="lede">In a business obsessed with reach and algorithms, it's easy to forget the oldest truth in estate agency: people instruct the agent they know and like. And the fastest way to be known and liked locally is still to turn up — in person, in the community, where your future clients actually live.</p>

      <h2>Offline and online aren't separate</h2>
      <p>The agent who sponsors the village cricket team, runs a stand at the summer fête, and judges the school's poster competition isn't doing "old-fashioned" marketing instead of social — they're doing the thing that makes the social work. Every local who meets you in person and then sees your face in their feed gets a double hit of familiarity. The offline presence is what gives the online presence its trust.</p>

      <blockquote>Online builds reach. Offline builds the relationships that turn reach into instructions.</blockquote>

      <h2>What actually works</h2>
      <ul>
        <li><strong>Sponsor things people love.</strong> The youth football kit, the fête, the village hall quiz. Visible, community-first, not a hard sell.</li>
        <li><strong>Show up as a person.</strong> Behind the stand, in the photos, shaking hands. Send the agent whose personal brand you're building, not a leaflet.</li>
        <li><strong>Bring it back to the feed.</strong> Film and photograph the event (with permission), and your content becomes "here's us at the fête," not "here's another listing." Community content out-performs sales content every time.</li>
        <li><strong>Tie it to the local groups.</strong> The same village Facebook group that talks about the fête will happily see the local agent who sponsored it. Offline and online reinforce each other.</li>
      </ul>

      <h2>The compounding local brand</h2>
      <p>One event does little. A year of being the recognisable, generous local presence — at the events, in the groups, on the feed — builds a brand that no national agency can replicate, because it's rooted in a place and a person. In a hyperlocal business, being genuinely <em>of</em> the community is the most durable competitive advantage there is.</p>
    `,
  },
];

// Back-compat — pages that haven't been moved to the async helpers yet.
// New code should use getPublishedPosts() instead.
export const posts = STATIC_POSTS;

// ───────────────────────────────────────────────────────────────────
// Markdown → HTML rendering
// ───────────────────────────────────────────────────────────────────
export function renderMarkdown(md) {
  if (!md) return "";
  try { return marked.parse(md); } catch (e) { return ""; }
}

// Estimate read time from markdown / HTML body (≈200 wpm)
export function estimateReadTime(body) {
  if (!body) return 1;
  const text = String(body).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text ? text.split(/\s+/).length : 0;
  return Math.max(1, Math.round(words / 200));
}

// ───────────────────────────────────────────────────────────────────
// Normalise a Supabase row into the shape the public pages expect.
// ───────────────────────────────────────────────────────────────────
function rowToPost(row) {
  const html = row.body_html && row.body_html.trim()
    ? row.body_html
    : renderMarkdown(row.body_markdown);
  return {
    slug: row.slug,
    title: row.title,
    eyebrow: row.eyebrow || "",
    category: row.category || "Insights",
    standfirst: row.standfirst || "",
    hero: row.hero_image_url || "",
    heroAlt: row.hero_image_alt || row.title,
    date: row.publish_date || row.published_at || row.created_at,
    readTime: row.read_time_minutes || estimateReadTime(html || row.body_markdown),
    keywords: Array.isArray(row.seo_keywords) ? row.seo_keywords : [],
    author: row.author_name || "The TMKE Desk",
    body: html,
    seo: {
      title: row.seo_title || null,
      description: row.seo_description || row.standfirst || "",
      ogImage: row.seo_og_image_url || row.hero_image_url || "",
      canonical: row.seo_canonical_url || null,
      noindex: !!row.seo_noindex,
    },
  };
}

// ───────────────────────────────────────────────────────────────────
// Public read API — Supabase-first, falls back to STATIC_POSTS so the
// site still works with no env vars (dev / first-run on Railway).
// ───────────────────────────────────────────────────────────────────
export async function getPublishedPosts() {
  if (isConfigured) {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("status", "published")
      .order("publish_date", { ascending: false });
    if (!error && Array.isArray(data) && data.length) {
      // Only front-end ('public') posts on the public site; 'members' posts are
      // customer-exclusive. Treat a missing audience as public (pre-migration).
      return data.filter((r) => (r.audience || "public") === "public").map(rowToPost);
    }
  }
  return STATIC_POSTS;
}

// Customer-exclusive ('members') posts for the /account "Inside The Edit" feed.
export async function getMembersPosts() {
  if (isConfigured) {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("status", "published")
      .order("publish_date", { ascending: false });
    if (!error && Array.isArray(data)) {
      return data.filter((r) => r.audience === "members").map(rowToPost);
    }
  }
  return [];
}

export async function getPost(slug) {
  if (!slug) return null;
  if (isConfigured) {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    // Don't expose members-only posts on the public site.
    if (!error && data && (data.audience || "public") === "public") return rowToPost(data);
  }
  return STATIC_POSTS.find((p) => p.slug === slug) || null;
}

export async function postsByCategory(category) {
  const all = await getPublishedPosts();
  if (!category || category === "all") return all;
  return all.filter((p) => p.category === category);
}
