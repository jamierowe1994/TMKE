// ============================================================================
// Framework CRM tags — the curated catalogue used across the admin (the Contacts
// "add tag" dropdown and the Automations If/else tag picker). Single source of
// truth so the two never drift. No free-text: tags are picked from this list.
// ============================================================================
export const TAG_GROUPS = [
  ["Consent", ["Marketing-Opt-In", "Marketing-Not-Opted-In", "Unsubscribed"]],
  ["Newsletter", ["Newsletter-Subscriber"]],
  ["Interest", ["Interest: SMM", "Interest: Videography"]],
  ["Discovery calls", ["Discovery-Call-Booked: SMM", "Discovery-Call-Booked: Videography"]],
  ["Purchases", ["Pack-Purchased"]],
  ["Videography", ["Videography-Client", "Videography-Booked", "Videography-New-Starter: Pro", "Videography-New-Starter: Academy", "Videography-Product: Content-Studio", "Videography-Product: Property-Videography", "Videography-Product: Agent-Videography"]],
  ["SMM client", ["SMM-Status: Active", "SMM-Status: Paused", "SMM-Status: Ended"]],
  ["Account", ["TMKE-Account-Member", "Portal-User"]],
  ["Network", ["Network: TEG", "Network: Fine-and-Country", "Network: External"]],
  ["Type", ["Type: Estate-Agent", "Type: Lettings", "Type: Financial-Services"]],
  ["Region", ["Region: Videography-Radius"]],
];

// What some tags mean, for the pickers. The tag itself is what's stored and
// matched; this is only what a person reading the list is shown.
//
// Consent is one state: Unsubscribed, then Marketing-Opt-In, then
// Marketing-Not-Opted-In. Newsletter-Subscriber is NOT a consent state - it
// says which of the opted-in asked for the newsletter itself, so the newsletter
// can go to them rather than to everyone we are allowed to email. Anyone
// carrying it is opted in (the rules add Marketing-Opt-In alongside), and
// unsubscribing takes both away.
export const TAG_NOTES = {
  "Marketing-Opt-In": "opted in to marketing - the audience for anything we send",
  "Marketing-Not-Opted-In": "never opted in",
  "Unsubscribed": "opted out - never send marketing",
  "Newsletter-Subscriber": "subscribed to the newsletter itself",
  "Pack-Purchased": "has bought any pack",
};
export function tagLabel(tag) {
  const note = TAG_NOTES[tag];
  return note ? `${tag} (${note})` : tag;
}

// Flat list of every framework tag.
export const ALL_TAGS = TAG_GROUPS.flatMap(([, tags]) => tags);

// Purchase tags per pack. A purchase tags the buyer "Pack Name: <pack title>"
// (worker, on a paid order). Those used to reach the pickers only once someone
// had bought - so a new pack's tag couldn't be chosen for an email or
// automation before its first sale. This lists one for every pack in the shop.
export const PACK_TAG_PREFIX = "Pack Name: ";
export async function loadPackTagGroup(supabase) {
  try {
    const { data } = await supabase.from("packs").select("title, demo");
    const tags = [...new Set((data || []).filter((p) => p.demo !== true && (p.title || "").trim()).map((p) => PACK_TAG_PREFIX + p.title.trim()))]
      .sort((a, b) => a.localeCompare(b));
    return tags.length ? ["Pack names", tags] : null;
  } catch (_) {
    return null;
  }
}
// The framework groups, with the pack-name group after Purchases when it's loaded.
export function withPackTags(packGroup) {
  if (!packGroup) return TAG_GROUPS;
  const at = TAG_GROUPS.findIndex(([g]) => g === "Purchases");
  const out = TAG_GROUPS.slice();
  out.splice(at < 0 ? out.length : at + 1, 0, packGroup);
  return out;
}
