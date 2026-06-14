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
