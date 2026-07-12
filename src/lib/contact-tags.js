// ============================================================================
// Framework CRM tags — the curated catalogue used across the admin (the Contacts
// "add tag" dropdown and the Automations If/else tag picker). Single source of
// truth so the two never drift. No free-text: tags are picked from this list.
// ============================================================================
export const TAG_GROUPS = [
  ["Consent", ["Newsletter-Subscriber", "Marketing-Not-Opted-In", "Unsubscribed"]],
  ["Interest", ["Interest: SMM", "Interest: Videography"]],
  ["Discovery calls", ["Discovery-Call-Booked: SMM", "Discovery-Call-Booked: Videography"]],
  ["Purchases", ["Pack-Purchased"]],
  ["Videography", ["Videography-Client", "Videography-Booked", "Videography-Product: Content-Studio", "Videography-Product: Property-Videography", "Videography-Product: Agent-Videography"]],
  ["SMM client", ["SMM-Status: Active", "SMM-Status: Paused", "SMM-Status: Ended"]],
  ["Account", ["TMKE-Account-Member", "Portal-User"]],
  ["Network", ["Network: TEG", "Network: Fine-and-Country", "Network: External"]],
  ["Type", ["Type: Estate-Agent", "Type: Lettings", "Type: Financial-Services"]],
  ["Region", ["Region: Videography-Radius"]],
];

// Flat list of every framework tag.
export const ALL_TAGS = TAG_GROUPS.flatMap(([, tags]) => tags);
