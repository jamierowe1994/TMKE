/* Videography notes on a social media client (Danielle, 27 Oct 2026).
 *
 * Jack and Abbie's thread about a client's shoots, kept on the client
 * (smm_video_notes, supabase/smm_video_notes.sql). The social media client
 * file shows them all under the shoots; every videography booking linked to
 * the client shows the ones not yet done in its Notes tab. Marking a note done
 * takes it off the shoots; it stays, greyed, in the client file.
 *
 * Staff only: the table is admin-read and admin-write, so the admin pages use
 * the signed-in client directly.
 */

export async function listVideoNotes(supabase, leadId, { openOnly = false } = {}) {
  let q = supabase.from("smm_video_notes").select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
  if (openOnly) q = q.is("done_at", null);
  const { data, error } = await q;
  return { notes: data || [], error: error ? error.message : null };
}

export async function addVideoNote(supabase, leadId, body, by) {
  const { error } = await supabase.from("smm_video_notes").insert({ lead_id: leadId, body, created_by: by || null });
  return error ? error.message : null;
}

export async function setVideoNoteDone(supabase, id, done, by) {
  const { error } = await supabase.from("smm_video_notes")
    .update(done ? { done_at: new Date().toISOString(), done_by: by || null } : { done_at: null, done_by: null })
    .eq("id", id);
  return error ? error.message : null;
}

export async function deleteVideoNote(supabase, id) {
  const { error } = await supabase.from("smm_video_notes").delete().eq("id", id);
  return error ? error.message : null;
}

// "abigail.saunders@…" -> "Abigail", "jack@…" -> "Jack".
export function noteAuthor(email) {
  const local = String(email || "").split("@")[0].split(/[._-]/)[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "Someone";
}

// A missing table (the SQL not run yet) reads as this, so the screens can say so.
export const VIDEO_NOTES_MISSING = /smm_video_notes|relation .* does not exist|schema cache/i;
