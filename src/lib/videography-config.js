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

// Property package tier from member brand: TPE/Prestige → Gold, F&C → Platinum.
export function propertyTierForBrand(brand) {
  if (brand === "fc") return "platinum";
  if (brand === "tpe" || brand === "prestige") return "gold";
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
      { key: "single", name: "Single Session", price_pence: 13900, output: "12 short-form videos", desc: "1.5 hrs filming + 1.5 hrs editing." },
      { key: "half",   name: "Half Day",       price_pence: 27800, output: "24 short-form videos", desc: "3 hrs filming + 3 hrs editing." },
      { key: "full",   name: "Full Day",       price_pence: 67300, output: "60 short-form videos", desc: "8 hrs filming + 8 hrs editing." },
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
        key: "gold", name: "Gold Package", from_pence: 39500,
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
        key: "platinum", name: "Platinum Package", from_pence: 59500,
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
    nonMemberFrom_pence: 49500,  // indicative only, shown on enquiry confirmation
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
      { key: "launch",    name: "Launch Package",            price_pence: 25000, desc: "Landscape + portrait elevator pitch video, 5 professional headshots." },
      { key: "lifestyle", name: "Lifestyle Portraits ×10",   price_pence: 7000,  desc: "10 professional lifestyle portrait photographs." },
      { key: "broll",     name: "B-Roll / Short-Form ×10",   price_pence: 15500, desc: "10 × 60-second short-form clips, filmed and edited." },
    ],
    nonMemberFrom_pence: 29900,  // indicative only
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

// Pipeline statuses, incl. the lead statuses leads land at (Section 7.4).
export const PIPELINE_STATUS = {
  BOOKED: "booked",
  DISCOVERY: "discovery_call_booked",
  ENQUIRY: "enquiry_non_member",
};

// ---- Brochure (Section 8) ---------------------------------------------------
// Configurable download link. Drop the PDF at this R2 path (or change the URL)
// and the "Download brochure" links go live — no code change.
export const BROCHURE_URL = "https://assets.tmke.co.uk/tmke-videography-brochure.pdf";

// ---- Booking terms (Section 9) ----------------------------------------------
// Per-service booking agreements, rendered in the flow and reusable in
// emails/PDFs. Plain-English working draft for TMKE's solicitor to confirm —
// NOT final legal advice. `p` is a string (or array of paragraphs) and may
// contain <strong>…</strong>.
export const TERMS_NOTE = "A plain-English summary of how we work together, written to set clear expectations. This is a working draft for review — the final wording will be confirmed by TMKE and takes precedence.";

// Clauses shared verbatim across every agreement, so the wording never drifts.
const CLAUSE_BOOKING = { h: "Booking & confirmation", p: "Your booking is confirmed once you have signed this agreement and received our email confirmation. Your slot is held in the diary on a first-come, first-served basis and is not reserved until confirmed." };
const CLAUSE_PAYMENT = { h: "Payment", p: "Payment is due in full upon delivery of your edited content. You will receive a payment request alongside a preview of your shoot; full access to your files is released automatically once payment has cleared. Payment must be made within <strong>7 days</strong> of the payment request being issued. Content not paid for within this window may be subject to a late payment fee or further action to recover the outstanding amount." };
const CLAUSE_CANCELLATIONS = { h: "Cancellations", p: "Please give at least <strong>three (3) days'</strong> notice to cancel. Cancellations made within <strong>72 hours</strong> of the shoot, and no-shows, are <strong>chargeable in full</strong>. All cancellations must be made in writing to jack@tmke.co.uk or through your account." };
const CLAUSE_RESCHEDULING = { h: "Rescheduling", p: "You may rearrange your booking with at least <strong>two (2) days'</strong> notice, subject to availability, at no extra charge. Requests inside this window are treated as a cancellation and rebooking." };
const CLAUSE_LICENCE = { h: "Use of content & licence", p: "On full payment you receive a licence to use the delivered content for your own marketing. TMKE retains the right to use the content as showcase and portfolio material across our website, social media and marketing, and retains ownership of all raw footage and project files." };
const CLAUSE_LIABILITY = { h: "Liability & circumstances beyond our control", p: "TMKE is not liable for delays, rescheduling or cancellation caused by circumstances beyond our reasonable control (including weather, illness, or equipment failure); in such cases we will reschedule at the earliest mutually convenient opportunity. Our total liability is limited to the fees paid for the affected booking." };
const CLAUSE_DATA = { h: "Data & governing law", p: "We handle your details in line with our privacy policy and only to deliver and support your booking. This agreement is governed by the laws of <strong>England &amp; Wales</strong>." };

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
      { h: "On the day", p: "Please arrive on time and prepared for your session. This includes any outfits, props, scripts, or materials you plan to use on the day. Late arrivals may result in reduced filming time and your session will still end at the scheduled time. TMKE is not responsible for content that cannot be captured due to insufficient preparation or late arrival." },
      { h: "Delivery", p: "Edited content is typically delivered within a few working days of the shoot unless otherwise agreed. Reasonable revision requests are welcome; substantial re-edits may be quoted separately." },
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
      { h: "Post-shoot add-ons", p: "The faux twilight effect is available as a post-shoot add-on at <strong>£25 + VAT per image</strong>. As the number of images requiring this effect may not be known until after the shoot, this will not always form part of your initial booking total. Where faux twilight is requested, Jack will confirm the number of images and provide a revised quote for your approval before any additional charge is applied." },
      { h: "Delivery", p: "Edited content is typically delivered within a few working days of the shoot unless otherwise agreed. Reasonable revision requests are welcome. Substantial re-edits or the need to return to a property for additional footage may be quoted separately." },
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
      { h: "Delivery", p: "Edited content is typically delivered within a few working days of the shoot unless otherwise agreed. Reasonable revision requests are welcome; substantial re-edits or re-shoots may be quoted separately." },
      CLAUSE_LICENCE,
      CLAUSE_LIABILITY,
      CLAUSE_DATA,
    ],
  },
};

// Resolve the agreement for a service key (falls back to the property terms).
export function termsForService(serviceKey) {
  return TERMS_BY_SERVICE[serviceKey] || TERMS_BY_SERVICE.property;
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
