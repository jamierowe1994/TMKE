/**
 * TMKE's social services, as they actually are.
 *
 * Source: the Services brochure (TMKE - Services Draft1.pdf, p5, p6, p12) plus
 * the tier sheet behind Social Media Marketing. Wording is TMKE's own, not a
 * paraphrase — if it needs to change it should change in the brochure first
 * and be copied here, so the two never say different things.
 *
 * WHY THIS FILE EXISTS. The member-facing plans lived inline in
 * ServicesPanel.astro as three invented tiers — "Channel essentials" at £850,
 * "Done-for-you socials" at £1,650, "Full brand & channel" from £3,200. None
 * of those are real, and the page is linked from the dashboard drawer, from
 * Your SMM, and from two email templates, so a member could be quoted two to
 * five times the actual price from a mail we sent them. One copy of the truth,
 * imported wherever it is shown.
 *
 * PRICES. "From" figures only, deliberately. What an agency actually pays
 * depends on who they are, and the hub cannot tell — a lot of early users are
 * tagged as members before anyone has decided what they are. So the page says
 * where prices start and leaves the number to a conversation.
 */

export const PRICE_NOTE =
  "Prices start from these figures and vary depending on your agency, your package and how much you need from us. Get in touch and we'll talk you through what fits.";

/** The two headline services — the ones "Your SMM" is about. */
export const SOCIAL_SERVICES = [
  {
    id: "management",
    name: "Social Media Management",
    strap: "The marketing agency that doesn't want you to go viral.",
    summary:
      "Fully managed social media, including strategy, content creation, scheduling and reporting.",
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
    from: "£599",
    unit: "+VAT / month",
  },
  {
    id: "marketing",
    name: "Social Media Marketing",
    strap: "Shot and scheduled.",
    summary:
      "Professionally filmed video content, edited, captioned and scheduled for you.",
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
    from: "£455",
    unit: "+VAT / month",
    note: "Built for agents who are happy managing their own listings but want a consistent video presence.",
  },
];

/** Also social, and worth knowing about — smaller, so shown smaller. */
export const SOCIAL_EXTRAS = [
  {
    name: "Property Marketing Campaign",
    summary:
      "A professionally planned social media campaign designed to maximise listing exposure.",
    from: "£125",
    unit: "+VAT / month",
  },
  {
    name: "Profile Optimisation",
    summary:
      "A quarterly review to optimise your social profiles, branding and visibility across every platform.",
    from: "£155",
    unit: "+VAT / quarter",
  },
];
