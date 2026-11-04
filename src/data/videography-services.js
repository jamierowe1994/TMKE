/* The services a videography booking can be (Dani, 4 Nov 2026). Chosen from a
   list rather than typed, so every rule that asks "what is this booking?"
   (the TEG new-starter portal, studio location, folders, who pays) reads one
   name instead of guessing from words. `type` is the booking's service_type
   where the rest of the system already has one; `pays` is who is invoiced:
   "brand" means the brand, not the client (new starters and event coverage).
   Labels keep the words older rules look for ("Studio", "New-starter",
   "Photography"), so nothing that still tests the text breaks. */
export const VIDEO_SERVICES = [
  { key: "new-starter-studio",   label: "New-starter Studio Day",  type: "content-studio", pays: "brand", reason: "induction" },
  { key: "new-starter-location", label: "New-starter on location", type: "agent",          pays: "brand", reason: "induction" },
  { key: "content-studio",       label: "Content Studio Day",      type: "content-studio" },
  { key: "property",             label: "Property video",          type: "property" },
  { key: "agent",                label: "Agent shoot on location", type: "agent" },
  { key: "shot-scheduled",       label: "Shot & Scheduled shoot",  type: null },
  { key: "event",                label: "Event coverage",          type: null,             pays: "brand", reason: "event" },
  { key: "photography",          label: "Photography",             type: "photography" },
];

export function serviceByLabel(label) {
  const t = String(label || "").trim().toLowerCase();
  return VIDEO_SERVICES.find((s) => s.label.toLowerCase() === t) || null;
}

/* What an older, typed service most likely was. Used once to convert the
   existing bookings (supabase/videography_service_names.sql mirrors it) and
   to suggest a choice when an unconverted booking is opened. null = no
   confident match; it stays as typed, under Other. */
export function guessService(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  if (serviceByLabel(t)) return serviceByLabel(t);
  const by = (k) => VIDEO_SERVICES.find((s) => s.key === k);
  if (/new.?starter|induction/i.test(t)) return /location/i.test(t) ? by("new-starter-location") : by("new-starter-studio");
  if (/shot\s*[&*+]?\s*(and\s*)?scheduled|s\s*&\s*s\b/i.test(t)) return by("shot-scheduled");
  if (/event coverage|bootcamp|implementer day|success day/i.test(t)) return by("event");
  if (/^\s*photography/i.test(t)) return by("photography");
  if (/^(the )?studio\b|content studio|studio day|studio, filming/i.test(t)) return by("content-studio");
  if (/\bprop(erty)?\b.*(video|videography|package|shoot)|^plat prop|^property videography$/i.test(t)) return by("property");
  if (/^agent\s*\/\s*location shoots?$/i.test(t)) return by("agent");
  return null;
}
