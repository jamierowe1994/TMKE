// Ask the Worker to rebuild the public site. Pack pages (/edit/<slug>) and blog
// posts are built once, at deploy time, from Supabase - so a pack that goes live,
// changes its slug, or is archived only shows on the site after a rebuild.
// Best-effort: the database change has already saved. Returns a line to show.
export async function rebuildSite(supabase) {
  const worker = (import.meta.env.PUBLIC_R2_WORKER_URL || "").replace(/\/+$/, "");
  if (!worker) return "";
  try {
    const { data } = await supabase.auth.getSession();
    const token = data && data.session && data.session.access_token;
    if (!token) return "";
    const res = await fetch(`${worker}/deploy`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, keepalive: true });
    const out = await res.json().catch(() => ({}));
    if (out && out.ok) return "The site is updating - the shop will show this in a minute or two.";
    return out && out.error ? `Saved, but the site didn't start updating: ${out.error}` : "";
  } catch (_) {
    return "";
  }
}
