// What a shoot's folder in our own storage is called. One rule, used by the
// videography page (which creates the folders) and by Client content (which
// browses them), so the two can never disagree about where a shoot lives.
//
// Built from what identifies a shoot at a glance, in the order you'd look for
// it: type, who, when, where. Slashes and colons are stripped, because a slash
// in a name becomes a folder boundary in object storage.
export function archiveFolderName(b) {
  if (!b) return "";
  const clean = (v) => String(v || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  const when = b.shoot_date ? new Date(b.shoot_date).toISOString().slice(0, 10) : "";
  const where = clean(b.property_address || b.location || b.postcode).split(",")[0];
  // The person, not the brand: on a Fine & Country shoot the agent is who you'd
  // look for, and every F&C folder would otherwise open the same way.
  return [clean(b.service || b.service_type), clean(b.client_name || b.client_company), when, where]
    .filter(Boolean).join(" - ");
}

// The folder a shoot's files are in: what was saved on the booking, or what the
// name would be. A shoot whose folder was never saved still has files under the
// derived name, because that is the name the uploader used.
export function folderFor(b) {
  return String((b && b.archive_folder) || archiveFolderName(b) || "").trim();
}

// Is this shoot part of a social media package? Either the money route says so,
// or it has been linked to a social media client.
export function isSmmShoot(b) {
  return !!b && (b.payment_route === "smm_package" || !!b.smm_lead_id);
}
