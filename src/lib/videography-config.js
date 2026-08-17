// ============================================================================
// TMKE Videography — booking config (single source of truth)
// Mirrors the client brief "TMKE Videography Booking Flow" v3.0 (2026-06-14).
// Front-end (booking flow, summaries) and the Worker (emails, validation) both
// read from here so pricing/packages/routing never drift. All prices are in
// PENCE and exclude VAT (VAT is added at display/summary time).
// ============================================================================

export const VAT_RATE = 0.20;

// ---- Audience routing (Section 2.1) -----------------------------------------
// Email domain is the primary identity. TPE/Prestige and F&C are members;
// everyone else is a non-member. `brand` drives Property package tier (Gold vs
// Platinum) and labels through the flow + emails.
export const MEMBER_DOMAINS = {
  "thepropertyexperts.co.uk":       { brand: "tpe",      label: "The Property Experts" },
  "prestigepropertyexperts.co.uk":  { brand: "prestige", label: "Prestige Property Experts" },
  "thelettingexperts.co.uk":        { brand: "tle",      label: "The Lettings Experts" },
  "thelettingsexperts.co.uk":       { brand: "tle",      label: "The Lettings Experts" },
  "themortgageexperts.co.uk":       { brand: "tme",      label: "The Mortgage Experts" },
  "therecruitmentexperts.co.uk":    { brand: "tre",      label: "The Recruitment Experts" },
  // .com is the live domain (confirmed 31 Jul). .co.uk is kept as a safety net
  // — it was the only one listed here, so every real F&C agent resolved as a
  // NON-MEMBER with no property tier, which is the wrong price and the wrong
  // agreement. The CRM had .com all along; the two had simply never been
  // checked against each other.
  "fineandcountry.com":             { brand: "fc",       label: "Fine & Country" },
  "fineandcountry.co.uk":           { brand: "fc",       label: "Fine & Country" },
  // TMKE staff — treated as members so the team can test every booking flow
  // end-to-end (Content Studio, Property, Agent). Remove or restrict before
  // launch if you don't want all @tmke.co.uk addresses booking at member rates.
  // (Property tier falls back to "gold" for this brand — see propertyTierForBrand.)
  "tmke.co.uk":                     { brand: "tmke",     label: "TMKE" },
};

// Returns { audience: "member"|"non-member", brand, label, domain }.
export function audienceForEmail(email) {
  const domain = String(email || "").trim().toLowerCase().split("@")[1] || "";
  const hit = MEMBER_DOMAINS[domain];
  if (hit) return { audience: "member", brand: hit.brand, label: hit.label, domain };
  return { audience: "non-member", brand: null, label: "Non-member", domain };
}

// Property package tier from member brand: Fine & Country → Platinum, every
// other TEG brand → Gold. Listed explicitly rather than leaning on the caller's
// `|| "gold"` fallback, so adding a brand to MEMBER_DOMAINS without deciding its
// tier shows up as null here instead of silently becoming Gold.
export function propertyTierForBrand(brand) {
  if (brand === "fc") return "platinum";
  if (["tpe", "prestige", "tle", "tme", "tre", "tmke"].includes(brand)) return "gold";
  return null;
}

// ---- Travel surcharge (Section 1.4) -----------------------------------------
// Defaults; the live values are admin-editable in `videography_settings`.
export const SURCHARGE_DEFAULTS = {
  base_postcode: "NN14 1AA",   // Jack's base (admin-editable)
  free_radius_miles: 40,
  pence_per_mile: 55,          // HMRC 2026/27 approved mileage rate
};

// ---- Services & pricing (Section 1) -----------------------------------------
export const SERVICES = {
  "content-studio": {
    key: "content-studio",
    name: "Content Studio",
    membersOnly: true,          // non-members → Register Interest (Section 3B)
    surcharge: false,           // studio-based, no travel surcharge
    select: "single",           // pick one session
    sessions: [
      { key: "single", name: "Single Session", price_pence: 16500, output: "12 short-form videos", desc: "1.5 hrs filming + 1.5 hrs editing." },
      { key: "half",   name: "Half Day",       price_pence: 32500, output: "24 short-form videos", desc: "3 hrs filming + 3 hrs editing." },
      { key: "full",   name: "Full Day",       price_pence: 78500, output: "60 short-form videos", desc: "8 hrs filming + 8 hrs editing." },
    ],
  },

  "property": {
    key: "property",
    name: "Property Videography",
    membersOnly: false,         // non-members → enquiry form (Section 4C)
    surcharge: true,
    select: "package",          // one package, by brand
    requiresPropertyAddress: true,
    packagesByTier: {
      gold: {
        key: "gold", name: "Gold Package", from_pence: 55000,
        inclusions: [
          "Presenter-led video tour (landscape)",
          "Drone videography and photography",
          "360 virtual tour",
          "Floor plan",
          "2 × 60-second Reels (portrait)",
          "Professional photography up to 25 photos (10 × 5:4 + 10 × 16:9)",
          "YouTube thumbnail",
        ],
      },
      platinum: {
        key: "platinum", name: "Platinum Package", from_pence: 62500,
        inclusions: [
          "Presenter-led video tour (landscape)",
          "Drone videography and photography",
          "360 virtual tour",
          "Premium floor plan",
          "3 × 60-second Reels (portrait)",
          "Professional photography up to 60 photos (10 × 5:4 + 10 × 16:9)",
          "YouTube thumbnail",
        ],
      },
    },
    // Non-members can't self-book — they're routed to the enquiry form — so this
    // is an indicative "from" only. NB: not currently rendered anywhere; kept
    // accurate so it can't mislead if it is ever wired up.
    // External rate card (2026), ex-VAT:
    //   Standard agency   — Gold £680, Platinum £770
    //   Scaleable agency  — Gold £805, Platinum £910
    nonMemberFrom_pence: 68000,
    addOns: [
      { key: "local-area",      name: "Local Area Tour",            price_pence: 10000, note: "Filmed local area tour added to the shoot." },
      { key: "twilight-winter", name: "Twilight Shoot (Oct–Mar)",   price_pence: 10000, note: "Twilight exterior, winter rate." },
      { key: "twilight-summer", name: "Twilight Shoot (Apr–Sep)",   price_pence: 20000, note: "Twilight exterior, summer rate." },
      { key: "faux-twilight",   name: "Faux Twilight",              price_pence: 2500,  perImage: true, note: "Post-production twilight effect, per image." },
    ],
  },

  "agent": {
    key: "agent",
    name: "Agent / Location Shoots",
    membersOnly: false,         // non-members → enquiry form (Section 5B)
    surcharge: true,
    select: "multi",            // members may combine packages
    requiresLocationAddress: true,
    packages: [
      { key: "launch", name: "Launch Package",              price_pence: 29500, desc: "Landscape + portrait elevator pitch video, 5 professional headshots, and 10 lifestyle photographs." },
      { key: "broll",  name: "10 × 60-second B-roll scenes", price_pence: 15500, desc: "10 × 60-second short-form clips, filmed and edited." },
    ],
    // Indicative only — non-members are routed to the enquiry form, not a booking.
    // External rate card (2026), ex-VAT: Standard agency £325, Scaleable £385.
    nonMemberFrom_pence: 32500,
  },

  "discovery": {
    key: "discovery",
    name: "Discovery Call",
    membersOnly: false,         // open to all, no domain gate (Section 6)
    surcharge: false,
    interests: [
      { key: "content-studio", name: "Content Studio" },
      { key: "property",       name: "Property Videography" },
      { key: "agent",          name: "Agent / Location Shoots" },
      { key: "general",        name: "Not sure yet / General enquiry" },
    ],
  },
};

/* ---------------------------------------------------------------------------
   Rate card - the commercial and production figures behind each package.

   Keyed off the same package keys as SERVICES above. Member prices are NOT
   repeated here: they live in SERVICES and are read from there, so the two can
   never disagree. What this adds is the external pricing and the production
   effort, which previously existed only as code comments that nothing read and
   nothing could validate.

   Source: James's pricing workbook (Studio Videography / Property Videography /
   Location Shoots tabs), supplied 2026-08-04. All prices in pence.

   `film`/`edit`/`brief`/`amends`/`design` are LABOUR hours - what a package
   actually costs Jack to produce. They are not the same as the calendar slot
   the booking flow reserves, and for property and agent shoots they are
   materially longer. See TODO section 4f.

   Add-ons are deliberately absent: they are the same price for members and
   non-members alike, so they carry no external rate. They live in
   SERVICES.property.addOns.
--------------------------------------------------------------------------- */
export const RATE_CARD = {
  "content-studio": {
    // The studio sessions ARE sold externally, at roughly 1.5x the member rate.
    // Note SERVICES["content-studio"].membersOnly is true, so the website does
    // not currently offer these - non-members are routed to Register Interest.
    single: { ext_standard_pence: 25500, ext_scaleable_pence: 30000, studio_hire_pence: 4500,
              film: 1.5, edit: 1.5, brief: 1.5, max_per_day: 5 },
    half:   { ext_standard_pence: 51000, ext_scaleable_pence: 60500, studio_hire_pence: 9000,
              film: 3, edit: 3, brief: 3, max_per_day: 2 },
    full:   { ext_standard_pence: 126500, ext_scaleable_pence: 149500, studio_hire_pence: 24000,
              film: 8, edit: 8, brief: 5, max_per_day: 1 },
  },
  property: {
    gold:     { ext_standard_pence: 68000, ext_scaleable_pence: 80500,
                film: 8, edit: 6, amends: 1, design: 1 },
    platinum: { ext_standard_pence: 77000, ext_scaleable_pence: 91000,
                film: 8, edit: 8, amends: 3, design: 1 },
  },
  agent: {
    launch: { ext_standard_pence: 32500, ext_scaleable_pence: 38500, film: 4, edit: 3 },
    // Not on the supplied workbook. James's call (4 Aug): treat it as the same
    // price for members and non-members until there is a real external rate.
    // An assumption, not a quoted figure - revisit when the workbook covers it.
    broll:  { ext_standard_pence: 15500, ext_scaleable_pence: 15500 },
  },
};

// The member package prices exclude studio hire; the workbook lists it
// separately. Whether it is rebilled to the client is not yet settled.
export const STUDIO_HIRE_IS_REBILLED = false;

/* ---------------------------------------------------------------------------
   Archive folders
   ---------------------------------------------------------------------------
   The subfolders created inside a shoot's archive folder, per service. They
   vary by service on purpose: a Content Studio session has no exteriors or
   drone, and an agent shoot has no interiors, so giving every job all seven
   would leave most of them full of empty folders nobody ever opens.

   These names double as the upload categories in Deliver work, so a file
   dropped into "Drone Footage" lands in the folder of that name. One list, so
   the boxes on screen and the folders in storage cannot drift apart.
--------------------------------------------------------------------------- */
export const ARCHIVE_FOLDERS = {
  "content-studio": ["Video", "Other"],
  property: [
    "Property Photography Exterior",
    "Property Photography Interior",
    "Floor Plans",
    "Twilight",
    "Drone Footage",
    "Video",
    "Other",
  ],
  agent: ["Headshots", "Lifestyle Shots", "Video", "Other"],
};

// Falls back to the property set, which is the superset - better to offer a
// folder that goes unused than to have nowhere to put something.
export function archiveFoldersFor(serviceType, serviceText) {
  if (ARCHIVE_FOLDERS[serviceType]) return ARCHIVE_FOLDERS[serviceType];
  const t = String(serviceText || "").toLowerCase();
  if (/content|studio/.test(t)) return ARCHIVE_FOLDERS["content-studio"];
  if (/agent|location|launch/.test(t)) return ARCHIVE_FOLDERS.agent;
  return ARCHIVE_FOLDERS.property;
}

// Pipeline statuses, incl. the lead statuses leads land at (Section 7.4).
export const PIPELINE_STATUS = {
  BOOKED: "booked",
  DISCOVERY: "discovery_call_booked",
  ENQUIRY: "enquiry_non_member",
};

// ---- Brochure (Section 8) ---------------------------------------------------
// Configurable download link. Drop the PDF at this R2 path (or change the URL)
// and the "Download brochure" links go live — no code change.
export const BROCHURE_URL = "https://assets.tmke.co.uk/TMKE%20-%20Videography%20Services.pdf";

// ---- Booking terms (Section 9) ----------------------------------------------
// Per-service booking agreements, rendered in the flow and reusable in
// emails/PDFs. Plain-English working draft for TMKE's solicitor to confirm —
// NOT final legal advice. `p` is a string (or array of paragraphs) and may
// contain <strong>…</strong>.
export const TERMS_NOTE = "A plain-English summary of how we work together, written to set clear expectations. This is a working draft for review — the final wording will be confirmed by TMKE and takes precedence.";

// Clauses shared verbatim across every agreement, so the wording never drifts.
const CLAUSE_BOOKING = { h: "Booking & confirmation", p: "Your booking is confirmed once you have signed this agreement and received our email confirmation. Your slot is held in the diary on a first-come, first-served basis and is not reserved until confirmed." };
const CLAUSE_PAYMENT = { h: "Payment", p: "Payment is due in full following delivery of the preview. You will receive a payment request alongside a preview of your shoot; full access to your files is released automatically once payment has cleared. Payment must be made within <strong>7 days</strong> of the payment request being issued. Content not paid for within this window may be subject to a late payment fee or further action to recover the outstanding amount." };
const CLAUSE_CANCELLATIONS = { h: "Cancellations", p: "Please give at least <strong>three (3) days'</strong> notice to cancel. Cancellations made within <strong>72 hours</strong> of the shoot, and no-shows, are <strong>chargeable in full</strong>. All cancellations must be made in writing to jack@tmke.co.uk or through your account." };
const CLAUSE_RESCHEDULING = { h: "Rescheduling", p: "You may rearrange your booking with at least <strong>two (2) days'</strong> notice, subject to availability, at no extra charge. Requests inside this window are treated as a cancellation and rebooking." };
// Licence + footage retention. Two variants because the trigger differs: paid
// bookings license on payment, the free Studio Day licenses on delivery. Same
// retention paragraph either way.
const _RETENTION = "Original footage and project files are retained for <strong>up to three months</strong> from the filming date. After this period, TMKE may permanently delete these files and cannot guarantee that further amendments, re-edits or copies of the original footage will be available.";
const _LICENCE_BODY = " you receive a licence to use the delivered content for your own marketing. TMKE retains the right to use the content as showcase and portfolio material across our website, social media and marketing, and retains ownership of all raw footage and project files.";
const CLAUSE_LICENCE = { h: "Use of content, licence &amp; footage retention", p: ["On full payment" + _LICENCE_BODY, _RETENTION] };
const CLAUSE_LICENCE_FREE = { h: "Use of content, licence &amp; footage retention", p: ["On delivery" + _LICENCE_BODY, _RETENTION] };

// Delivery and Amends are separate clauses: what we produce and when, versus
// what you can change afterwards. They were one clause, which made the
// amendment terms easy to miss.
const CLAUSE_DELIVERY = { h: "Delivery", p: "Edited content will be prepared within <strong>72 hours</strong> of the shoot unless otherwise agreed. Where payment applies, final files will be released once payment has cleared, unless TMKE agrees otherwise. Any delay in release caused by outstanding payment will not be treated as late delivery." };
const CLAUSE_AMENDS = { h: "Amends", p: [
  "One round of amendments is included with your booking and may be requested after the edited content has been released. Where amendments are requested by both the agent and seller, all requested changes must be submitted together as <strong>one consolidated set</strong>.",
  "Any further amendments, substantial re-edits or the need to return to the filming location to capture additional footage may be quoted separately. Amendments are subject to the availability of the original footage and project files in accordance with TMKE's footage-retention terms.",
] };

// Studio Day cancels differently: the session is free, so there is nothing to
// charge — it is forfeited instead.
const CLAUSE_CANCELLATIONS_STUDIO = { h: "Cancellations", p: "Please give at least <strong>three (3) days'</strong> notice to cancel. Cancellations made within <strong>72 hours</strong> of the session, and no-shows, may result in the session being <strong>forfeited</strong>. TMKE is not obliged to provide a replacement session, and any replacement will be subject to availability and may be charged separately. All cancellations must be made in writing to jack@tmke.co.uk or through your account." };

// Property size — Fine & Country only. TPE and the other brands are unlikely to
// list a property of this size, so it would be noise on their agreement.
const CLAUSE_PROPERTY_SIZE = { h: "Property size", p: "Package pricing is based on properties up to <strong>5,000 sq. ft.</strong> Properties exceeding 5,000 sq. ft. may incur an additional charge to reflect the additional filming and editing time required. Where an additional charge applies, this will be confirmed before the shoot takes place." };

// The two Fine & Country payment clauses. Which one applies is decided by the
// agent's answer at booking, and drives payment_route on the booking row.
const CLAUSE_PAYMENT_FC_AGENT = { h: "Payment - agent payment", p: [
  "The agent making the booking is responsible for payment in full. Following delivery of a preview of the edited content, a payment request will be issued to the agent. Full access to the final files will be released automatically once payment has cleared.",
  "Payment must be made within <strong>seven (7) days</strong> of the payment request being issued. Content not paid for within this period may be subject to a late payment fee or further action to recover the outstanding amount.",
  "The agent's responsibility for payment is <strong>not affected</strong> by any separate agreement or payment arrangement between the agent and the seller.",
] };
const CLAUSE_PAYMENT_FC_INVOICE = { h: "Payment - Fine &amp; Country invoiced", p: [
  "The Fine &amp; Country office identified in the booking is responsible for payment because that office is holding the seller's marketing fee for the property. By selecting this payment option and making the booking, the agent confirms that the identified office is holding the seller's marketing fee, that they have authority to commit the office to the booking, and that they will provide accurate office and invoicing details. <strong>No preview will be provided under this payment option.</strong>",
  "If, despite that confirmation, the Fine &amp; Country office does not hold sufficient funds or fails or is unable to pay for any reason, <strong>the agent making the booking becomes personally responsible</strong> for the full outstanding amount and must pay it on demand.",
] };
const CLAUSE_LIABILITY = { h: "Liability & circumstances beyond our control", p: "TMKE is not liable for delays, rescheduling or cancellation caused by circumstances beyond our reasonable control (including weather, illness, or equipment failure); in such cases we will reschedule at the earliest mutually convenient opportunity. Our total liability is limited to the fees paid for the affected booking." };
const CLAUSE_DATA = { h: "Data & governing law", p: "We handle your details in line with our privacy policy and only to deliver and support your booking. This agreement is governed by the laws of <strong>England &amp; Wales</strong>." };
const CLAUSE_STUDIO_ON_THE_DAY = { h: "On the day", p: "Please arrive on time and prepared for your session. This includes any outfits, props, scripts, or materials you plan to use on the day. Late arrivals may result in reduced filming time and your session will still end at the scheduled time. TMKE is not responsible for content that cannot be captured due to insufficient preparation or late arrival." };

// Numbers (`n`) are assigned at render time from array order, so reordering a
// clause never leaves a gap.
export const TERMS_BY_SERVICE = {
  "content-studio": {
    title: "TMKE — Content Studio Booking Agreement",
    clauses: [
      CLAUSE_BOOKING,
      CLAUSE_PAYMENT,
      CLAUSE_CANCELLATIONS,
      CLAUSE_RESCHEDULING,
      { h: "Pre-shoot preparation", p: "At least <strong>three (3) days</strong> before your shoot, TMKE will send you a prompt pack containing conversational prompts and guidance tailored to your session, audience, and area. This is designed to help you make the most of your time in the studio. We ask that you review this before your shoot day so you arrive prepared and ready to film." },
      CLAUSE_STUDIO_ON_THE_DAY,
      CLAUSE_DELIVERY,
      CLAUSE_AMENDS,
      CLAUSE_LICENCE,
      CLAUSE_LIABILITY,
      CLAUSE_DATA,
    ],
  },
  "property": {
    title: "TMKE — Property Videography Booking Agreement",
    clauses: [
      CLAUSE_BOOKING,
      CLAUSE_PAYMENT,
      CLAUSE_CANCELLATIONS,
      CLAUSE_RESCHEDULING,
      { h: "Travel costs", p: "Any travel costs applicable to your booking have been calculated based on the property postcode provided at the time of booking and are included in your confirmed total. Travel is charged at <strong>55p per mile</strong> for any distance beyond <strong>40 miles</strong> from our base in Kettering. If the shoot location changes after your booking is confirmed, your travel cost may need to be re-calculated and an updated total will be provided before the shoot takes place." },
      { h: "On the day", p: [
        "Please ensure safe and timely access to the property at the agreed time, and that you have obtained the necessary permissions to film the premises and the consent of any people who may appear in the content. Delays caused by access or readiness issues may reduce the time available for the shoot.",
        "Where drone footage is included in your package, Jack holds a valid CAA licence for commercial drone operations. The ability to capture drone footage on the day is subject to weather conditions and local airspace restrictions, which may be outside of our control. In the event that drone footage cannot be captured, TMKE will discuss the options available to you at the time.",
      ] },
      { h: "Post-shoot add-ons", p: "The faux twilight effect is available as a post-shoot add-on at <strong>£25 +VAT per image</strong>. As the number of images requiring this effect may not be known until after the shoot, this will not always form part of your initial booking total. Where faux twilight is requested, Jack will confirm the number of images and provide a revised quote for your approval before any additional charge is applied." },
      CLAUSE_DELIVERY,
      CLAUSE_AMENDS,
      CLAUSE_LICENCE,
      CLAUSE_LIABILITY,
      CLAUSE_DATA,
    ],
  },
  "agent": {
    title: "TMKE — Agent Videography Booking Agreement",
    clauses: [
      CLAUSE_BOOKING,
      CLAUSE_PAYMENT,
      CLAUSE_CANCELLATIONS,
      CLAUSE_RESCHEDULING,
      { h: "Travel costs", p: "Any travel costs applicable to your booking have been calculated based on the shoot location postcode provided at the time of booking and are included in your confirmed total. Travel is charged at <strong>55p per mile</strong> for any distance beyond <strong>40 miles</strong> from our base in Kettering. If the shoot location changes after your booking is confirmed, your travel cost may need to be recalculated and an updated total will be provided before the shoot takes place." },
      { h: "On the day", p: "Please ensure you are ready and available at the agreed location and time, and that you have permission to film at the chosen location and the consent of any other people who may appear in the content. Delays caused by access or readiness may shorten the time available for your shoot." },
      CLAUSE_DELIVERY,
      CLAUSE_AMENDS,
      CLAUSE_LICENCE,
      CLAUSE_LIABILITY,
      CLAUSE_DATA,
    ],
  },
};

// ---- Off-location services --------------------------------------------------
// Property and Agent shoots happen at the client's location, so Jack has to
// travel to and from them. Two in a day doesn't work however the hours fall —
// a morning shoot in one town and an afternoon one in another is not a
// scheduling problem, it's a physics problem.
//
// Content Studio is deliberately NOT here: those run back to back at our own
// studio, and we want them to.
export const OFF_LOCATION_SERVICES = ["property", "agent"];

// Clear days Jack needs after an on-location shoot before the next one: about
// 1.5 days editing plus half a day for amendments (his figure, 2 Aug). So a
// shoot on the 5th also takes the 6th and 7th out of the diary.
//
// Content Studio is exempt for the same reason it is exempt from the one-a-day
// rule: those are at our own studio and are meant to run back to back.
export const OFF_LOCATION_BUFFER_DAYS = 2;
export const isOffLocation = (serviceKey) => OFF_LOCATION_SERVICES.includes(serviceKey);

// ---- Fine & Country offices -------------------------------------------------
// The agent picks their own office: we don't hold branch data, and the agent is
// the only one who knows which office holds the seller's marketing fee.
//
// Data rather than hard-coded options because the list is still being settled
// with accounts — adding one is a line here, not a code change in the flow.
// `key` is what's stored on the booking; `label` is what the agent sees.
export const FC_OFFICES = [
  { key: "fc_midlands",  label: "Fine & Country Midlands" },
  { key: "fc_stratford", label: "Fine & Country Stratford" },
];
export function fcOfficeLabel(key) {
  return (FC_OFFICES.find((o) => o.key === key) || {}).label || key || "";
}

// ---- The Expert's Group (TEG) brand invoicing -------------------------------
// Some shoots are settled by a sister TEG brand rather than the client - most
// commonly a new starter's induction shoot, already paid for as part of their
// induction package. Unlike Fine & Country there's no seller's fee to confirm,
// so this is a much simpler "who and why" than the F&C flow: admin-only, never
// surfaced on the public booking form.
//
// One shared accounts contact handles every brand's invoices. The billing
// address is the same for all of them except The Mortgage Experts, which
// sits at a different office.
const TEG_STANDARD_ADDRESS = "5 Regent St, Rugby CV21 2PE";
export const TEG_ACCOUNTS_EMAIL = "Paula@newman.uk.com";
export const TEG_BRANDS = [
  { key: "property_experts",   label: "The Property Experts",        address: TEG_STANDARD_ADDRESS },
  { key: "lettings_experts",   label: "The Lettings Experts",        address: TEG_STANDARD_ADDRESS },
  { key: "mortgage_experts",   label: "The Mortgage Experts",        address: "3 Regent Street, Rugby, England, CV21 2PE" },
  { key: "auction_company",    label: "The Auction Company",         address: TEG_STANDARD_ADDRESS },
  { key: "prestige_property",  label: "Prestige Property Experts",   address: TEG_STANDARD_ADDRESS },
  { key: "recruitment_experts",label: "The Recruitment Experts",     address: TEG_STANDARD_ADDRESS },
  { key: "marketing_experts",  label: "The Marketing Experts",       address: TEG_STANDARD_ADDRESS },
  { key: "newman",             label: "Newman Property Services",    address: TEG_STANDARD_ADDRESS },
  { key: "other",              label: "Other",                       address: TEG_STANDARD_ADDRESS },
];
export function tegBrandLabel(key) {
  return (TEG_BRANDS.find((o) => o.key === key) || {}).label || key || "";
}
export function tegBrandAddress(key) {
  return (TEG_BRANDS.find((o) => o.key === key) || {}).address || TEG_STANDARD_ADDRESS;
}
export const TEG_REASONS = [
  { key: "induction", label: "New Starter Induction Shoot - Pro / Academy" },
  { key: "event",     label: "Brand Event Coverage" },
  { key: "marketing", label: "Brand Marketing Content" },
  { key: "other",     label: "Other" },
];

// Shoots covered by a social media management package. There is nothing to
// invoice, so this route carries a single reason rather than the TEG list —
// and that reason exists only here, which is why it is not in TEG_REASONS.
export const SMM_REASON = { key: "smm_package", label: "Included in the SMM package" };

// The reasons offered for a given payment route. The brand list is shared
// between the two invoiced routes; the reasons are not.
export function reasonsForRoute(route) {
  return route === "smm_package" ? [SMM_REASON] : TEG_REASONS;
}

// True when the booking needs no payment from the client because their package
// covers it. Everything that gates on money should ask this rather than
// testing paid_at alone, or package clients are locked out of their own work.
export function isPackageCovered(b) {
  return !!b && b.payment_route === "smm_package";
}

// The one question the gallery, the tour, the PIN and the amends link all ask.
export function isSettled(b) {
  return !!b && (!!b.paid_at || isPackageCovered(b));
}

export function tegReasonLabel(key) {
  if (key === SMM_REASON.key) return SMM_REASON.label;
  return (TEG_REASONS.find((o) => o.key === key) || {}).label || key || "";
}

// ---- Post-payment edit requests ---------------------------------------------
// Once a client has paid, they can ask for edits and, depending on the shoot
// type, buy an add-on. Property shoots reuse the faux-twilight price already
// defined on the "property" service's addOns above (£25+VAT/image) rather
// than duplicating it here. Agent/induction shoots instead offer a fixed
// bundle of extra downloadable images - easy to retune, not fixed in stone.
export const EXTRA_IMAGES_BUNDLE = { qty: 5, price_pence: 2400 };

// ---- Fine & Country property agreements -------------------------------------
// F&C sit a tier above the other TEG brands (Platinum, not Gold) and, more
// importantly, often charge the seller a marketing fee that the F&C OFFICE
// holds. So there are two F&C agreements, chosen by the agent's answer to the
// payment question at booking, on top of the all-brands one.
//
// Everything except the payment clause and the property-size clause is shared
// verbatim with the standard property agreement, so wording can't drift.
const _FC_PROPERTY_CLAUSES = (paymentClause) => [
  CLAUSE_BOOKING,
  paymentClause,
  CLAUSE_CANCELLATIONS,
  CLAUSE_RESCHEDULING,
  TERMS_BY_SERVICE.property.clauses.find((c) => c.h === "Travel costs"),
  CLAUSE_PROPERTY_SIZE,
  TERMS_BY_SERVICE.property.clauses.find((c) => c.h === "On the day"),
  TERMS_BY_SERVICE.property.clauses.find((c) => c.h === "Post-shoot add-ons"),
  CLAUSE_DELIVERY,
  CLAUSE_AMENDS,
  CLAUSE_LICENCE,
  CLAUSE_LIABILITY,
  CLAUSE_DATA,
];

export const TERMS_FC_AGENT = {
  title: "TMKE — Fine & Country Property Videography Booking Agreement",
  intro: "Property package — Platinum (Fine & Country). Payment is made directly by the booking agent.",
  clauses: _FC_PROPERTY_CLAUSES(CLAUSE_PAYMENT_FC_AGENT),
};

export const TERMS_FC_INVOICE = {
  title: "TMKE — Fine & Country Property Videography Booking Agreement",
  // The source document said "invoiced before the shoot", which contradicts the
  // agreed process: nobody pays before the shoot, and F&C are not invoiced
  // until it is done. What happens beforehand is a CHECK — right branch, holds
  // the money, is the marketing fee. Reworded to match; awaiting James's final line.
  intro: "Property package — Platinum (Fine & Country). The relevant Fine & Country office is invoiced after the shoot.",
  clauses: _FC_PROPERTY_CLAUSES(CLAUSE_PAYMENT_FC_INVOICE),
};

// Resolve the agreement. Keyed by service, and for F&C property also by the
// package tier and who is paying — one service can have more than one
// agreement, which the old service-only lookup couldn't express.
export function termsFor({ service, tier, route } = {}) {
  if (service === "property" && tier === "platinum") {
    return route === "brand_invoice" ? TERMS_FC_INVOICE : TERMS_FC_AGENT;
  }
  return TERMS_BY_SERVICE[service] || TERMS_BY_SERVICE.property;
}

// Back-compatible wrapper for callers that only know the service.
export function termsForService(serviceKey) {
  return termsFor({ service: serviceKey });
}

// TEG new-starter "Studio Day" terms — a trimmed set of the Content Studio
// clauses (reused verbatim so wording never drifts), with an induction-specific
// intro and no payment/rescheduling/delivery clauses. Working draft.
export const NEW_STARTER_TERMS = {
  title: "TMKE — Studio Day",
  intro: "This videography session is provided as part of your induction package with The Experts Group. There is nothing for you to pay.",
  clauses: [
    CLAUSE_BOOKING,
    CLAUSE_CANCELLATIONS_STUDIO,
    CLAUSE_STUDIO_ON_THE_DAY,
    CLAUSE_LICENCE_FREE,
    CLAUSE_LIABILITY,
    CLAUSE_DATA,
  ],
};

// ---- Booking location label -------------------------------------------------
// A friendly "where" line so a member can tell multiple bookings apart at a
// glance. Property/Agent use the postcode submitted on the form; Content Studio
// is our fixed studio; discovery calls run over Teams.
// TODO: swap in the full studio street address once confirmed.
export const STUDIO_LOCATION = "TMKE Content Studio, 5 Regent Street, Rugby, CV21 2PE";
export function bookingLocation({ service_type, source, postcode } = {}) {
  if (source === "smm" || service_type === "discovery") return "Teams call";
  if (service_type === "content" || service_type === "content-studio") return STUDIO_LOCATION;
  return postcode || "";
}

// ---- Money helpers ----------------------------------------------------------
export function vatOf(pence) { return Math.round(pence * VAT_RATE); }
export function withVat(pence) { return pence + vatOf(pence); }
export function gbp(pence) {
  const v = (pence || 0) / 100;
  return "£" + v.toLocaleString("en-GB", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

// Travel surcharge for a distance, given settings. Returns pence (ex-VAT).
export function surchargePence(distanceMiles, settings = SURCHARGE_DEFAULTS) {
  const over = Math.max(0, Math.ceil((distanceMiles || 0) - settings.free_radius_miles));
  return over * settings.pence_per_mile;
}
