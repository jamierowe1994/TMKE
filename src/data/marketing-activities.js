/* The marketing calendar's activities (Dani, 15 Oct 2026).

   The Planner is a marketing calendar, not only a content calendar: a member
   plans everything an estate agent's marketing involves, from the day they
   sit down to plan their posts to the day they drop leaflets or open a house.

   Categories, and the activities within them, are in working order: plan,
   then create, then do. Each activity says which fields its form asks for,
   whether its 8am reminder is ticked by default (only the time-sensitive
   ones: posting, and a property shoot), and the checklist it starts with.

   Stored on calendar_items / training_calendar_items (supabase/
   calendar_activities.sql): `activity` is the key, `details` holds the
   activity's own fields, `checklist` its items, `end_date` a run's last day.

   `afterDates` puts a field straight after the date and time; `buttons` are
   links shown as buttons after the dates (print: the packs, a new design).
   `line` is the one sentence under the title saying what the activity is
   (Dani, 17 Oct). `checklistFirst` puts the checklist straight after the
   dates (campaigns); `noChecklist` leaves it off (a follow-up has a contact).

   Two flags:
     book   something we film: choosing it offers Book with TMKE (what's
            included, the brochure, and Book now, which opens the website's
            own booking form inside the calendar: src/components/
            VideographyBooking.astro, member mode) or adding it as a day
            yourself. Once booked with us, the booking appears on the calendar
            by itself (from Bookings). One item each since 16 Oct, not a
            "Book ..." item and a day item.
     teg    shown to agents of The Experts Group only (guide-audience.js).
   Names are in Title Case (Dani, 15 Oct). */

export const CATEGORIES = [
  { key: "content",  label: "Content & Social",     colour: "#371e28" },
  { key: "print",    label: "Print & Canvassing",   colour: "#2f5d62" },
  { key: "business", label: "Business & Community", colour: "#465a86" },
  { key: "property", label: "Property Marketing",   colour: "#8c5f37" },
  { key: "campaigns", label: "Campaigns",           colour: "#5f6a35" },
  { key: "other",    label: "Something Else",       colour: "#62666e" },
];

/* Field kinds the form knows how to draw:
     text      a line of text              (details[key])
     area      a few lines                 (details[key])
     number    a number                    (details[key])
     endDate   the last day of a run       (end_date)
     endTime   the time an event ends      (details.end_time)
     platform  where it runs (a choice)    (details.platform)
     printDesign   one of your print designs, optional   (details.design_id)
     linkedDesigns any of your designs, several          (details.design_ids)
     printDesigns  print designs, several              (details[key])
     campaignLink  one of their campaigns       (details.campaign_id); the
               campaign lists what's linked to it
     files     uploads and links, several   (details[key]: [{ kind: "file",
               name, path, size, mime } | { kind: "link", url }]). Files go to
               the private calendar-files bucket (supabase/calendar_files.sql)
               and open through a short-lived link.
   Every activity also has its date, an optional time (unless `timeRequired`),
   notes, a checklist and the reminder tickbox. `title` names the field whose
   value becomes the entry's title on the calendar. */
export const ACTIVITIES = [
  // Content & Social
  { key: "content_planning", category: "content", label: "Content Planning",
    line: "Take some time out to plan your social media content for the month.",
    title: null, fields: [] },
  { key: "social_post", category: "content", label: "Social Media Post",
    line: "A post going out on your social media, with its caption and design ready.",
    reminder: true, timeRequired: true, social: true },
  { key: "content_studio", category: "content", label: "Content Studio Session",
    line: "Your session in our Content Studio, filming content that's ready to post.", teg: true,
    book: { blurb: "Book a session in our Content Studio and leave with content that's ready to post.",
      discover: "Discover our studio", logs: [{ label: "Add a studio booking" }],
      info: "/videography#studio", brochure: "https://assets.tmke.co.uk/TMKE%20-%20Videography%20Services.pdf", book: [{ service: "content-studio", label: "Book now" }] },
    // Date, time, then where (Dani, 16 Oct). A booking with us brings the
    // studio's own address.
    reminder: true, timeRequired: true, title: null, fields: [
      { key: "address", kind: "text", label: "Address", optional: true, afterDates: true },
    ] },
  { key: "agent_filming", category: "content", label: "Agent Filming Day",
    line: "Your day of filming with us, on camera for your social media.",
    book: { blurb: "Book a day of filming with you on camera: presenter-led content for your social media.",
      discover: "Discover videography packages", logs: [{ label: "Add a filming day" }],
      info: "/videography#agent", brochure: "https://assets.tmke.co.uk/TMKE%20-%20Videography%20Services.pdf", book: [{ service: "agent", label: "Book now" }] },
    reminder: true, timeRequired: true, title: "location", fields: [{ key: "location", kind: "text", label: "Location", optional: true, afterDates: true }] },
  { key: "email_newsletter", category: "content", label: "Email / Newsletter",
    line: "An email to your contacts, such as your newsletter or a new listing.",
    title: "subject", fields: [
      { key: "subject", kind: "text", label: "Subject", required: true },
      { key: "copy", kind: "files", label: "The copy", optional: true },
      // Who it's for, to refer back to; nothing is sent to them (Dani, 16 Oct).
      { key: "audience", kind: "area", label: "Your audience", optional: true, placeholder: "e.g. Sellers within two miles of CV22" },
      { key: "audience_files", kind: "files", label: "Audience details", optional: true },
    ] },
  { key: "paid_ads", category: "content", label: "Paid Advertising",
    line: "A paid campaign on social media or the portals, from the day it starts to the day it ends.",
    title: "campaign", fields: [
      { key: "platform", kind: "platform", label: "Platform" },
      { key: "campaign", kind: "text", label: "Campaign name", required: true },
      { key: "end_date", kind: "endDate", label: "End date", optional: true },
      { key: "budget", kind: "text", label: "Budget", optional: true, placeholder: "e.g. £150" },
    ] },

  // Print & Canvassing
  { key: "print_design", category: "print", label: "Create Print Design",
    line: "Set aside time to design your print marketing in the Studio, ready to order.",
    title: "purpose", buttons: [
      { href: "/account/studio#packs", label: "Open your print packs" },
      { href: "/account/editor?new=1", label: "Design a print asset" },
    ],
    fields: [
      { key: "purpose", kind: "text", label: "What it's for", required: true, placeholder: "e.g. Just sold card for Bilton" },
      { key: "files", kind: "files", label: "Files and links", optional: true },
    ] },
  { key: "print_order", category: "print", label: "Order Print Marketing",
    line: "Order your print marketing, so it arrives in time to go out.",
    title: "materials", fields: [
      { key: "materials", kind: "text", label: "Materials required", required: true, placeholder: "e.g. A5 canvassing cards" },
      { key: "quantity", kind: "number", label: "Quantity", optional: true },
      { key: "supplier", kind: "text", label: "Supplier", optional: true, placeholder: "e.g. Vistaprint, or your printer's website" },
      { key: "design_ids", kind: "printDesigns", label: "Print designs", optional: true },
      { key: "files", kind: "files", label: "Your own files and links", optional: true },
    ],
    buttons: [
      { href: "/account/studio#packs", label: "Open your print packs" },
      { href: "/account/editor?new=1", label: "Design a print asset" },
    ], },
  { key: "canvassing", category: "print", label: "Canvassing / Leaflet Drop",
    line: "Get your cards and leaflets through the doors in the area you want to win.",
    title: "area", fields: [
      { key: "area", kind: "text", label: "Area", required: true, placeholder: "e.g. Bilton, Rugby" },
      { key: "leaflets", kind: "number", label: "How many leaflets", optional: true },
      { key: "design_ids", kind: "printDesigns", label: "Designs you're taking", optional: true },
      { key: "files", kind: "files", label: "Your own files and links", optional: true },
    ],
    buttons: [
      { href: "/account/studio#packs", label: "Open your print packs" },
      { href: "/account/editor?new=1", label: "Design a print asset" },
    ], },

  // Property Marketing
  { key: "property_shoot", category: "property", label: "Property Photography or Filming",
    line: "The day the property is photographed or filmed.",
    book: { blurb: "Property photography and filming by TMKE: tours, Reels and stills that sell the home.",
      discover: "Discover our property packages",
      // Not always a shoot: they may be doing it themselves (Dani, 16 Oct).
      logs: [{ label: "Photography shoot", shoot: "Photography" }, { label: "Property videography", shoot: "Videography" }],
      info: "/videography#property", brochure: "https://assets.tmke.co.uk/TMKE%20-%20Videography%20Services.pdf", book: [{ service: "property", label: "Book property filming" }, { service: "photography", label: "Book property photography" }] },
    reminder: true, title: "address", fields: [{ key: "address", kind: "text", label: "Property address", required: true }] },
  { key: "open_house", category: "property", label: "Open House / Property Event",
    line: "The day of an open house or event at a property.",
    timeRequired: true, title: "address", fields: [
      { key: "address", kind: "text", label: "Property address", required: true },
      { key: "end_time", kind: "endTime", label: "End time", optional: true },
      // An open house belongs to its campaign: linked both ways (Dani, 16 Oct).
      { key: "campaign_id", kind: "campaignLink", label: "Campaign", optional: true },
    ] },

  // Campaigns: a run of marketing towards one goal, each with its own steps
  // (Dani, 16 Oct). New Listing keeps the key property_launch, so launches
  // planned before the move are New Listing campaigns now.
  { key: "story_of_sale", category: "campaigns", label: "Story of the Sale",
    checklistFirst: true,
    line: "Show how a sale happened, from going on the market to the keys, to win the next instruction.",
    title: "address", fields: [
      { key: "address", kind: "text", label: "Property address", required: true },
      { key: "end_date", kind: "endDate", label: "End date", optional: true },
      { key: "design_ids", kind: "linkedDesigns", label: "Linked designs", optional: true },
    ],
    checklist: [
      "Seller happy for the sale to be shared",
      "Sale details gathered: days on the market, viewings and offers",
      "Photos chosen, including the sold board",
      "Testimonial from the seller",
      "Story of the Sale post created and planned",
      "Just Sold cards designed for the street",
      "Just Sold cards ordered and delivered",
    ] },
  { key: "property_launch", category: "campaigns", label: "New Listing Campaign",
    checklistFirst: true,
    line: "Everything that goes into launching a property, from the photos to the portals.",
    title: "campaign", fields: [
      { key: "address", kind: "text", label: "Property address", required: true },
      { key: "campaign", kind: "text", label: "Campaign name", optional: true },
      { key: "end_date", kind: "endDate", label: "End date", optional: true },
      { key: "design_ids", kind: "linkedDesigns", label: "Linked designs", optional: true },
    ],
    checklist: [
      "Photos edited",
      "Video and virtual tour ready",
      "Floor plan ready",
      "Property description written",
      "Launch posts created and planned",
      "Canvassing card designed",
      "Canvassing cards ordered",
      "Listing live on the portals",
      "Email sent to your buyer list",
    ] },
  { key: "open_house_campaign", category: "campaigns", label: "Open House Campaign",
    checklistFirst: true,
    line: "The marketing that fills an open house: the announcement, invitations, reminders and follow-up.",
    title: "address", fields: [
      { key: "address", kind: "text", label: "Property address", required: true },
      { key: "end_date", kind: "endDate", label: "End date", optional: true },
      { key: "design_ids", kind: "linkedDesigns", label: "Linked designs", optional: true },
    ],
    checklist: [
      "Date and time agreed with the seller",
      "Open house added to the portals",
      "Announcement post created and planned",
      "Invitation cards designed",
      "Invitation cards delivered to the street",
      "Email sent to your buyer list",
      "Reminder post planned for the day before",
      "Thank-you post and follow-up calls after the event",
    ] },
  { key: "seasonal_campaign", category: "campaigns", label: "Seasonal Campaign",
    checklistFirst: true,
    line: "A campaign around a time of year, such as the spring market, the summer holidays or Christmas.",
    title: "occasion", fields: [
      { key: "occasion", kind: "text", label: "Season or occasion", required: true, placeholder: "e.g. Spring market" },
      { key: "end_date", kind: "endDate", label: "End date", optional: true },
      { key: "design_ids", kind: "linkedDesigns", label: "Linked designs", optional: true },
    ],
    checklist: [
      "Seasonal message decided",
      "Seasonal posts created and planned",
      "Seasonal print design created",
      "Print ordered and delivered",
      "Email sent to your contacts",
      "Profile and cover images updated for the season",
    ] },

  // Business & Community
  { key: "local_event", category: "business", label: "Local Event / Networking",
    line: "A local event or networking, getting your name known in the area.",
    title: "event", fields: [
      { key: "event", kind: "text", label: "Event name", required: true },
      { key: "location", kind: "text", label: "Location", optional: true },
      { key: "files", kind: "files", label: "Documents and links", optional: true },
    ] },
  { key: "review_request", category: "business", label: "Request a Testimonial",
    line: "Ask a happy client for a testimonial while the move is fresh.",
    title: "client", fields: [{ key: "client", kind: "text", label: "Client or property", required: true }] },
  { key: "follow_up", category: "business", label: "Marketing Follow-Up",
    line: "Follow up on your marketing: a lead, a campaign or a conversation.",
    // A contact rather than a checklist (Dani, 16 Oct).
    noChecklist: true, title: "contact_name", fields: [
      { key: "contact_name", kind: "text", label: "Contact name", optional: true },
      { key: "contact_address", kind: "text", label: "Address", optional: true },
      { key: "contact_reach", kind: "text", label: "Phone or email", optional: true },
    ] },
  { key: "other", category: "other", label: "Something Else",
    line: "Anything else in your marketing that you want on the calendar.",
    title: "title", fields: [
      { key: "title", kind: "text", label: "Title", required: true },
      { key: "files", kind: "files", label: "Files and links", optional: true },
    ] },
];

export const PLATFORMS = ["Instagram", "Facebook", "LinkedIn", "TikTok", "Google", "Rightmove", "Zoopla", "Other"];

export const activityOf = (key) => ACTIVITIES.find((a) => a.key === key) || ACTIVITIES.find((a) => a.key === "social_post");
export const categoryOf = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];

/* What an entry is called on the calendar: the activity's naming field, or
   the activity itself. */
export function entryTitle(activityKey, details) {
  const a = activityOf(activityKey);
  const v = a.title && details && String(details[a.title] || "").trim();
  return v || a.label;
}
