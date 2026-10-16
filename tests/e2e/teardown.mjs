/* After a run: everything it made goes - the entries marked [TEST] (and any
   it noted), their files, and the test designs. Training is left as it was. */
import { rest, removeFiles, created, TAG } from "./lib.mjs";

export default async function teardown() {
  const c = created();
  const tag = encodeURIComponent(`*${TAG}*`);
  let rows = [];
  try {
    rows = await rest(`training_calendar_items?select=id,details&or=(notes.ilike.${tag},title.ilike.${tag},caption.ilike.${tag})`) || [];
    if ((c.items || []).length) {
      const more = await rest(`training_calendar_items?select=id,details&id=in.(${c.items.join(",")})`) || [];
      more.forEach((r) => { if (!rows.some((x) => x.id === r.id)) rows.push(r); });
    }
  } catch (e) { console.error("[clean-up] couldn't list test entries:", e.message); }

  // Their files: private ones in calendar-files, a post's in calendar-assets.
  const priv = [], pub = [];
  rows.forEach((r) => Object.values(r.details || {}).filter(Array.isArray).flat().forEach((x) => {
    if (!x || !x.path) return;
    (x.url ? pub : priv).push(x.path);
  }));
  try { await removeFiles("calendar-files", priv); await removeFiles("calendar-assets", pub); } catch (e) { console.error("[clean-up] files:", e.message); }

  if (rows.length) {
    try { await rest(`training_calendar_items?id=in.(${rows.map((r) => r.id).join(",")})`, { method: "DELETE" }); }
    catch (e) { console.error("[clean-up] entries:", e.message); }
  }
  try { await rest(`training_designs?name=ilike.${tag}`, { method: "DELETE" }); } catch (e) { console.error("[clean-up] designs:", e.message); }
  console.log(`[clean-up] removed ${rows.length} test entries, ${priv.length + pub.length} files, and the test designs.`);
}
