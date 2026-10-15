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

   Two kinds are not entries at all:
     book   a "Book ..." option: a panel with what's included, the brochure
            and Book now, which opens the website's own booking form inside
            the calendar (src/components/VideographyBooking.astro, member mode). Once booked with us, the
            booking appears on the calendar by itself (from Bookings).
     teg    shown to agents of The Experts Group only (guide-audience.js).
   Names are in Title Case (Dani, 15 Oct). */

export const CATEGORIES = [
  { key: "content",  label: "Content & Social",     colour: "#371e28" },
  { key: "print",    label: "Print & Canvassing",   colour: "#2f5d62" },
  { key: "property", label: "Property Marketing",   colour: "#8c5f37" },
  { key: "business", label: "Business & Community", colour: "#465a86" },
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
   Every activity also has its date, an optional time (unless `timeRequired`),
   notes, a checklist and the reminder tickbox. `title` names the field whose
   value becomes the entry's title on the calendar. */
export const ACTIVITIES = [
  // Content & Social
  { key: "content_planning", category: "content", label: "Content Planning",
    title: null, fields: [] },
  { key: "book_content_studio", category: "content", label: "Book a Content Studio Session", teg: true,
    book: { blurb: "A session in our Content Studio, filming content that's ready to post.",
      info: "/videography#studio", brochure: "https://assets.tmke.co.uk/TMKE%20-%20Videography%20Services.pdf", book: [{ service: "content-studio", label: "Book now" }] } },
  { key: "content_studio", category: "content", label: "Content Studio Session", teg: true,
    reminder: true, timeRequired: true, title: null, fields: [] },
  { key: "book_agent_filming", category: "content", label: "Book an Agent Filming Day", teg: true,
    book: { blurb: "A day of filming with you on camera: presenter-led content for your social media.",
      info: "/videography#agent", brochure: "https://assets.tmke.co.uk/TMKE%20-%20Videography%20Services.pdf", book: [{ service: "agent", label: "Book now" }] } },
  { key: "agent_filming", category: "content", label: "Agent Filming Day", teg: true,
    reminder: true, timeRequired: true, title: "location", fields: [{ key: "location", kind: "text", label: "Location", optional: true }] },
  { key: "social_post", category: "content", label: "Social Media Post",
    reminder: true, timeRequired: true, social: true },
  { key: "email_newsletter", category: "content", label: "Email / Newsletter",
    title: "subject", fields: [{ key: "subject", kind: "text", label: "Subject", required: true }] },
  { key: "paid_ads", category: "content", label: "Paid Advertising",
    title: "campaign", fields: [
      { key: "platform", kind: "platform", label: "Platform" },
      { key: "campaign", kind: "text", label: "Campaign name", required: true },
      { key: "end_date", kind: "endDate", label: "End date", optional: true },
      { key: "budget", kind: "text", label: "Budget", optional: true, placeholder: "e.g. £150" },
    ] },

  // Print & Canvassing
  { key: "print_design", category: "print", label: "Create Print Design",
    title: "purpose", link: { href: "/account/studio", label: "Open your print packs in the Studio" },
    fields: [{ key: "purpose", kind: "text", label: "What it's for", required: true, placeholder: "e.g. Just sold card for Bilton" }] },
  { key: "print_order", category: "print", label: "Order Print Marketing",
    title: "materials", fields: [
      { key: "materials", kind: "text", label: "Materials required", required: true, placeholder: "e.g. A5 canvassing cards" },
      { key: "quantity", kind: "number", label: "Quantity", optional: true },
      { key: "design_id", kind: "printDesign", label: "Print design", optional: true },
    ] },
  { key: "canvassing", category: "print", label: "Canvassing / Leaflet Drop",
    title: "area", fields: [
      { key: "area", kind: "text", label: "Area", required: true, placeholder: "e.g. Bilton, Rugby" },
      { key: "design_id", kind: "printDesign", label: "Print design you're taking", optional: true },
    ] },

  // Property Marketing
  { key: "book_property_shoot", category: "property", label: "Book Property Photography or Filming",
    book: { blurb: "Property photography and filming by TMKE: tours, Reels and stills that sell the home.",
      info: "/videography#property", brochure: "https://assets.tmke.co.uk/TMKE%20-%20Videography%20Services.pdf", book: [{ service: "property", label: "Book property filming" }, { service: "photography", label: "Book property photography" }] } },
  { key: "property_shoot", category: "property", label: "Property Photography / Filming",
    reminder: true, title: "address", fields: [{ key: "address", kind: "text", label: "Property address", required: true }] },
  { key: "property_launch", category: "property", label: "Property Launch Campaign",
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
  { key: "open_house", category: "property", label: "Open House / Property Event",
    timeRequired: true, title: "address", fields: [
      { key: "address", kind: "text", label: "Property address", required: true },
      { key: "end_time", kind: "endTime", label: "End time", optional: true },
    ],
    checklist: [
      "Social posts planned for the event",
      "Invitation cards designed and delivered",
      "Signs and balloons ready",
      "Refreshments sorted (cookies, drinks)",
      "Brochures printed",
      "Visitor sign-in sheet ready",
      "Follow-up planned for after the event",
    ] },

  // Business & Community
  { key: "local_event", category: "business", label: "Local Event / Networking",
    title: "event", fields: [
      { key: "event", kind: "text", label: "Event name", required: true },
      { key: "location", kind: "text", label: "Location", optional: true },
    ] },
  { key: "review_request", category: "business", label: "Review / Testimonial Request",
    title: "client", fields: [{ key: "client", kind: "text", label: "Client or property", required: true }] },
  { key: "follow_up", category: "business", label: "Marketing Follow-Up",
    title: "title", fields: [{ key: "title", kind: "text", label: "What you're following up", required: true }] },

  // Something else
  { key: "other", category: "other", label: "Something Else",
    title: "title", fields: [{ key: "title", kind: "text", label: "Title", required: true }] },
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
