// ============================================================================
// TMKE Social Media (SMM) — page + form config (single source of truth)
// Mirrors the client brief supplied 2026-06-15. Front-end (page, forms) and the
// Worker (validation, emails, CRM) both read from here so copy/rules never drift.
// ============================================================================

// ---- Service tiers (Slide 3 scroll box) ------------------------------------
// price_pence intentionally null for now — the brief lists no prices. Set
// SHOW_TIER_PRICES = true and fill price_pence to surface pricing on the page.
export const SHOW_TIER_PRICES = false;

export const SERVICE_TIERS = [
  {
    key: "shot-and-scheduled",
    name: "Shot and Scheduled",
    subtitle: "Video Content Management",
    blurb:
      "For agencies that want video handled end to end — regular shoots with our in-house videographer, edited, captioned and scheduled to your platforms. You show up, we handle the rest.",
    price_pence: null,
  },
  {
    key: "planned-and-posted",
    name: "Planned and Posted",
    subtitle: "Instagram Management",
    blurb:
      "For agencies that want a consistent, professional Instagram presence without the pressure of creating content themselves. A focused, single-platform approach that builds your visual identity, grows a genuine local following, and sets the standard for everything that follows.",
    price_pence: null,
  },
  {
    key: "present-and-performing",
    name: "Present and Performing",
    subtitle: "Instagram & Facebook Management",
    blurb:
      "For agencies that want to be seen everywhere their audience is. Instagram builds the brand. Facebook drives local reach, community presence, and the conversations that lead to instructions. Together they cover every part of the audience that matters for a growing estate agency.",
    price_pence: null,
  },
  {
    key: "managed-and-moving",
    name: "Managed and Moving",
    subtitle: "Full Management & Videography",
    blurb:
      "For agencies that want to move fastest and make the biggest impact. Everything in Present and Performing, plus a bi-monthly recording session with our videography team and a video-first content strategy built for maximum reach and engagement.",
    price_pence: null,
  },
];

/* ============================================================================
   WHAT WE ACTUALLY SELL  (Dani, 5 Sep 2026)
   ----------------------------------------------------------------------------
   Two services. Prices in PENCE, excluding VAT, matching videography-config.js.

   1. SOCIAL MEDIA MANAGEMENT — from £649. Not packaged or priced in detail
      yet, and deliberately so: there is no capacity, so nobody is being
      onboarded onto it right now. SERVICE_TIERS below already carries the
      three shapes it will eventually split into — Planned and Posted, Present
      and Performing, Managed and Moving — but until they are priced they all
      sit under this one service at one "from" figure.

   2. SOCIAL MEDIA MARKETING — from £455. The brochure's name for the tier the
      public site calls "Shot and Scheduled": videography plus socials. This
      one IS packaged, into the three below, whose names are still being
      decided.

   HOW THIS RELATES TO SERVICE_TIERS ABOVE. The public services page renders
   SERVICE_TIERS as four peers, which is not the shape of the offering — three
   of those four are unlaunched sub-packages of the first service. That page is
   unchanged for now and shows no prices, so it misleads on structure rather
   than on money. Deciding what it should show is Dani's call, not a
   refactor's.

   THE THREE PRICE COLUMNS are who is buying, not what they get; the spec is
   identical across them. Nothing member-facing picks a column — the hub cannot
   tell who someone is, and plenty of early users are tagged as members before
   anyone has decided what they are. So member-facing surfaces show "from" the
   lowest, and the full grid is an internal reference on the admin rate card.
   ========================================================================== */

export const SOCIAL_VAT_NOTE = "+VAT";

/** Who is buying. Columns on the internal rate card; never shown to a member. */
export const PRICE_COLUMNS = [
  { key: "teg",        label: "TEG brand / agent", note: "No studio hire" },
  { key: "standard",   label: "External — standard agency" },
  { key: "scaleable",  label: "External — scaleable agency" },
];

export const SOCIAL_SERVICES = [
  {
    key: "social-media-management",
    name: "Social Media Management",
    strap: "The marketing agency that doesn't want you to go viral.",
    summary: "Fully managed social media, including strategy, content creation, scheduling and reporting.",
    blurb:
      "From strategy and content creation to scheduling and reporting, we manage the entire process for you. Every client works with the same marketing manager from start to finish, giving you consistent communication, a clear strategy, and content that genuinely reflects your business.",
    includes: [
      "Strategy built for your agency, your audience and your local market",
      "Content creation — video and static, designed not templated",
      "Community management and engagement",
      "Scheduling and publishing handled for you",
      "One marketing manager from start to finish",
      "Monthly reporting you can actually read",
    ],
    from_pence: 64900,
    unit: "month",
    /* No spaces at the moment, so this is not being sold. Kept visible because
       people ask what we do, not only what they can buy today. */
    openToNewClients: false,
    /* Priced and separated out later; listed so the intent is on the record. */
    futurePackages: ["Planned and Posted", "Present and Performing", "Managed and Moving"],
  },
  {
    key: "social-media-marketing",
    alias: "Shot and Scheduled",
    name: "Social Media Marketing",
    strap: "Shot and scheduled.",
    summary: "Professionally filmed video content, edited, captioned and scheduled for you.",
    blurb:
      "A shoot day every quarter with a TMKE videographer builds a library of content that actually looks like you. From there we edit every video, write the captions, schedule the posts and manage the publishing across the three months — so you show up consistently without the time or the commitment of doing it yourself.",
    includes: [
      "A studio shoot day every quarter with a TMKE videographer",
      "Every video edited, captioned and scheduled across the three months",
      "Instagram, Facebook and TikTok",
      "A quarterly strategy meeting and an audience-targeted plan",
      "Monthly content planning and a videography brief",
      "A monthly insights report",
    ],
    from_pence: 45500,
    unit: "month",
    openToNewClients: true,
    note: "Built for agents who are happy managing their own listings but want a consistent video presence.",
    /* The three it splits into. Names still being decided — labelled by what
       they contain rather than given a working title that would end up on a
       page and stay there. */
    packages: [
      {
        key: "smm-1", name: null, spec: "3 hrs quarterly",
        videos: 24, postsPerWeek: 2, amends: "1 request",
        hours: { videography: 3, editing: 3, brief: 3, management: 12 },
        maxClientsPerSmm: 12,
        price_pence: { teg: 45500, standard: 67000, scaleable: 79500 },
      },
      {
        key: "smm-2", name: null, spec: "5 hrs quarterly",
        videos: 36, postsPerWeek: 3, amends: "2 requests",
        hours: { videography: 5, editing: 5, brief: 4, management: 18 },
        maxClientsPerSmm: 9,
        price_pence: { teg: 65500, standard: 95000, scaleable: 112500 },
      },
      {
        key: "smm-3", name: null, spec: "8 hrs quarterly",
        videos: 60, postsPerWeek: 5, amends: "Unlimited",
        hours: { videography: 8, editing: 8, brief: 5, management: 25 },
        maxClientsPerSmm: 6,
        price_pence: { teg: 84500, standard: 134000, scaleable: 158000 },
      },
    ],
    onboarding_pence: 11000,   // one-off, same on every package
    platforms: ["Instagram", "Facebook", "TikTok"],
  },
];

/** Also social. Smaller, so shown smaller. Brochure p12. */
export const SOCIAL_EXTRAS = [
  {
    key: "property-marketing-campaign",
    name: "Property Marketing Campaign",
    summary: "A professionally planned social media campaign designed to maximise listing exposure.",
    from_pence: 12500, unit: "month",
  },
  {
    key: "profile-optimisation",
    name: "Profile Optimisation",
    summary: "A quarterly review to optimise your social profiles, branding and visibility across every platform.",
    from_pence: 15500, unit: "quarter",
  },
];

export const PRICE_NOTE =
  "Prices start from these figures and vary depending on your agency, your package and how much you need from us. Get in touch and we'll talk you through what fits.";

// ---- Lead kinds, CRM tags & pipeline stages --------------------------------
// stage values are FREE-TEXT (the smm_leads.stage column has no CHECK constraint).
export const LEAD = {
  brochure:  { kind: "brochure",  tag: "Brochure Download", stage: "brochure_downloaded" },
  discovery: { kind: "discovery", tag: "Discovery Call",    stage: "discovery_call_booked" },
  enquiry:   { kind: "enquiry",   tag: "General Enquiry",   stage: "general_enquiry" },
  /* Social Media Management has no capacity, so the ask is to be told when a
     space opens rather than to buy. A stage of its own in front of Inquiry, as
     Dani described it — and the CRM tag below is permanent, so how someone
     arrived survives them moving down the board.

     Not to be confused with /waitlist/register, which is the CANCELLATION list
     for a fully-booked videography session. Different table, different email,
     different thing. */
  waitlist:  { kind: "waitlist",  tag: "SMM Waitlist",      stage: "waitlist" },
};

/* Where a waitlist sign-up came from. Recorded on the lead so we can tell which
   funnel is working. Three eventually: the public site, the member hub's Your
   SMM page, and a link in a marketing email. */
export const WAITLIST_SOURCES = ["website", "hub", "email"];

/** The CRM tag that says what they want. Kept here so every funnel agrees. */
export const WAITLIST_INTEREST_TAG = "Interest: Social Media Management";

// ---- Password policy (shared) ----------------------------------------------
// Brief: min 8 chars incl. at least one number and one special character.
// NOTE (Phase 0 decision): applied to SMM forms now. Flipping the videography
// flow (currently min-8 only) to this rule is a separate, explicit change —
// pending James's confirmation of "site-wide".
export const PASSWORD_RULE = {
  minLength: 8,
  // 8+ chars, ≥1 digit, ≥1 non-alphanumeric
  regex: /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
  helpText:
    "Use at least 8 characters, including one number and one special character.",
};

export function validatePassword(pw) {
  return PASSWORD_RULE.regex.test(String(pw || ""));
}

// ---- Helper text under password fields (per brief) -------------------------
export const ACCOUNT_HELP = {
  brochure:
    "Create a TMKE account to manage your downloads, templates, and bookings in one place.",
  discovery:
    "We'll create your TMKE account at this step so your call details, documents, and any future bookings are all in one place.",
  enquiry:
    "Create a TMKE account to manage your enquiries, downloads, and bookings in one place.",
};

// ---- Page copy (Slides 2–4) ------------------------------------------------
export const COPY = {
  positioning: {
    headline: "The social media agency that doesn't want you to go viral.",
    body:
      "Going viral sounds great. But five million views from people who will never buy, sell, or let a property through you isn't marketing, it's ego inflating noise. What actually moves the needle for estate agents is being consistently visible to the right people, in the right place, at the right time. Your local market. Your target audience. Your community.\n\nThat's what we build.",
    pillars: [
      {
        title: "Property first, always.",
        body:
          "TMKE works exclusively in the property sector. We understand the market, the audience, and what resonates, so there's no learning curve, no trial and error, and no applying tactics from other industries that simply won't work in estate agency.",
      },
      {
        title: "One account manager.",
        body:
          "Every client works with a single dedicated account manager who owns your strategy, your content, and your account growth from day one. They get to know your brand, your tone, and your market the way an in-house team member would, because that's exactly what they become.",
      },
    ],
  },
  whatWeDo: {
    headline: "What we do, and how we do it.",
    body:
      "We plan, create, and manage your social media so it's consistent, considered, and built around your business. Everything, strategy, content, captions, scheduling, engagement, and reporting, is handled by your account manager, tailored to your brand and your local market.",
    chooseLine: "Choose the level of support that fits where you are right now:",
  },
  whatGoodLooksLike: {
    headline: "Social Media Marketing",
    body:
      "Shot and Scheduled is our social media marketing service. A shoot day every quarter with a TMKE videographer, then every video edited, captioned and scheduled across the three months, so you show up consistently without making the content yourself. You keep running your own accounts and your listings. Social media management goes further: one account manager owns the strategy, the content, the engagement and the reporting, and runs the account for you.",
    cta: "See Our Work",
  },
  ctas: {
    brochure: {
      title: "Download a Brochure",
      body:
        "Everything you need to know about our social media management services, in one place. Download our services brochure for a full breakdown of what's included, how it works, and what it costs.",
    },
    call: {
      title: "Book a Call",
      body:
        "Not sure which package is right for you, or want to talk it through before committing? Book a call with our team and we'll help you figure out the best fit for your business, your budget, and your goals.",
    },
    contact: {
      title: "Get in Touch",
      body:
        "Prefer to drop us a message first? Fill in the form below and we'll come back to you within one working day. No pressure, no obligation — just a straightforward conversation about what you need.",
    },
  },
  privacyLine: "By submitting this form you agree to our Privacy Policy.",
};

// ---- External resources ----------------------------------------------------
export const PRIVACY_URL = "/privacy";
// SMM services brochure — upload to the assets bucket, then this resolves.
export const BROCHURE_URL = "https://assets.tmke.co.uk/tmke-smm-brochure.pdf";
