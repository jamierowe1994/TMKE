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
      "For agencies that want their video content handled from filming to posting. We offer regular sessions with our in-house videographer, edited and packaged by our team, and scheduled to your platforms with captions and strategy taken care of. You show up, we handle everything after that.",
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

// ---- Lead kinds, CRM tags & pipeline stages --------------------------------
// stage values are FREE-TEXT (the smm_leads.stage column has no CHECK constraint).
export const LEAD = {
  brochure:  { kind: "brochure",  tag: "Brochure Download", stage: "brochure_downloaded" },
  discovery: { kind: "discovery", tag: "Discovery Call",    stage: "discovery_call_booked" },
  enquiry:   { kind: "enquiry",   tag: "General Enquiry",   stage: "general_enquiry" },
};

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
    headline: "What Good Looks Like",
    body:
      "Consistent, considered, and built around the brand. Here's some of the work we're proud of.",
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
