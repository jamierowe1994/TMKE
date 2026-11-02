/* The client portal, as the team sees it (Danielle, 2 Nov 2026).
 *
 * In Social media › a client › Videography: switch the portal on, tick which
 * Library folders the client sees, and copy their link and passcode to send
 * them. The client opens tmke.co.uk/portal?c=… (src/pages/portal.astro); the
 * Worker's /portal/* routes check the passcode and sign every file link.
 *
 * The row lives in client_portals (supabase/client_portal.sql), admin-read and
 * admin-write, so this uses the signed-in client directly. Every save asks for
 * the row back and only says "Saved" when it comes back.
 */

const ROOT = "deliverables/";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O, 1/I: it gets read out
const TOKEN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomFrom(chars, n) {
  const bytes = crypto.getRandomValues(new Uint8Array(n * 2));
  let out = "";
  // Skip the bytes that would make some characters likelier than others.
  const cap = 256 - (256 % chars.length);
  for (const b of bytes) { if (b < cap) out += chars[b % chars.length]; if (out.length === n) break; }
  return out.length === n ? out : randomFrom(chars, n);
}
export const newToken = () => randomFrom(TOKEN_CHARS, 32);
export const newPasscode = () => randomFrom(CODE_CHARS, 6);

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const lastSeg = (prefix) => prefix.replace(/\/+$/, "").split("/").pop();
const fmtWhen = (iso) => { try { return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (_) { return ""; } };

export function portalLink(token) {
  const site = /^(localhost|127\.)/.test(location.hostname) ? location.origin : "https://tmke.co.uk";
  return `${site}/portal?c=${encodeURIComponent(token)}`;
}

// The message the account manager pastes into their own email. Nothing is
// sent from here.
export function portalMessage(firstName, link, passcode) {
  return `Hi ${firstName || "there"},

We've set up a private page where you can watch, view and download the content we've shared with you.

Link: ${link}
Passcode: ${passcode}

Everything is in folders, usually one per shoot, and anything we add to them later will appear automatically. Once you've entered the passcode, you'll stay signed in on that browser for 7 days.`;
}

/* host: the element to draw into. lead: the smm_leads row. shootFolders: this
   client's shoots' Library folders (names, not prefixes). deps: { supabase,
   authToken, worker, me } where me() resolves to the signed-in email. */
export async function renderPortalAdmin(host, lead, shootFolders, deps) {
  const { supabase, authToken, worker, me } = deps;
  if (!host) return;
  const who = lead.business || [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() || lead.full_name || "this client";

  host.innerHTML = `<div class="smm-panel-head"><h4>Client portal</h4></div><p class="smm-soon">Loading…</p>`;
  const { data: row, error } = await supabase.from("client_portals").select("*").eq("smm_lead_id", lead.id).maybeSingle();
  if (error) {
    const missing = error.code === "42P01" || /client_portals/.test(error.message || "") && /exist|schema cache/i.test(error.message || "");
    host.innerHTML = `<div class="smm-panel-head"><h4>Client portal</h4></div>
      <p class="cpt-msg is-err">${missing
        ? "The client portal isn't set up in the database yet. Run supabase/client_portal.sql in Supabase, then reopen this client."
        : "Couldn't load the client portal: " + esc(error.message)}</p>`;
    return;
  }

  let p = row;
  const status = (kind, text) => {
    const el = host.querySelector(".cpt-status");
    if (!el) return;
    el.className = "cpt-msg cpt-status" + (kind ? " is-" + kind : "");
    el.textContent = text || "";
  };
  // Write, ask for the row back, and only then believe it.
  async function save(patch, okText) {
    status("busy", "Saving…");
    const by = (await me().catch(() => "")) || null;
    const { data, error: err } = await supabase.from("client_portals")
      .update({ ...patch, updated_by: by }).eq("smm_lead_id", lead.id).select();
    if (err || !data || data.length !== 1) {
      status("err", "Not saved: " + (err ? err.message : "the database didn't confirm it. Check you're still signed in, then try again."));
      return false;
    }
    p = data[0];
    status("ok", okText || "Saved.");
    return true;
  }

  // Every top-level Library folder, for the ticks. Their own shoots first.
  let allFolders = null, foldersErr = "";
  async function loadFolders() {
    try {
      const t = await authToken();
      const res = await fetch(`${worker}/list?prefix=${encodeURIComponent(ROOT)}`, { headers: { Authorization: "Bearer " + t } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || String(res.status));
      allFolders = body.folders || [];
    } catch (e) { allFolders = []; foldersErr = e.message || "unknown"; }
  }

  function drawOff() {
    host.innerHTML = `<div class="smm-panel-head"><h4>Client portal</h4></div>
      <div class="cpt">
        <p class="cpt-lead">Give ${esc(who)} a private link and passcode to watch and download the Library folders you choose. ${p ? "Turning it back on keeps the same link and passcode." : ""}</p>
        <button type="button" class="smm-btn smm-btn--primary" id="cpt-on">Turn on the client portal</button>
        <p class="cpt-msg cpt-status"></p>
      </div>`;
    host.querySelector("#cpt-on").addEventListener("click", turnOn);
  }

  async function turnOn() {
    const btn = host.querySelector("#cpt-on");
    if (btn) btn.disabled = true;
    if (p) { if (await save({ enabled: true }, "Turned on.")) draw(); else if (btn) btn.disabled = false; return; }
    status("busy", "Setting it up…");
    if (!allFolders) await loadFolders();
    // Start with this client's shoots that have something in the Library.
    const have = new Set(allFolders);
    const folders = shootFolders.map((f) => ROOT + f + "/").filter((f) => have.has(f));
    const by = (await me().catch(() => "")) || null;
    const { data, error: err } = await supabase.from("client_portals")
      .insert({ smm_lead_id: lead.id, token: newToken(), passcode: newPasscode(), folders, enabled: true, updated_by: by })
      .select();
    if (err || !data || data.length !== 1) {
      status("err", "Not turned on: " + (err ? err.message : "the database didn't confirm it. Try again."));
      if (btn) btn.disabled = false;
      return;
    }
    p = data[0];
    draw();
    status("ok", folders.length
      ? `Turned on, with ${who}'s shoot ${folders.length === 1 ? "folder" : `folders (${folders.length})`} from the Library ticked. Check the list, then copy the message to send.`
      : "Turned on. Tick the folders they should see, then copy the message to send.");
  }

  function folderRow(prefix, ticked, missing) {
    return `<label class="cpt-f${ticked ? " is-on" : ""}">
      <input type="checkbox" data-cptf="${esc(prefix)}"${ticked ? " checked" : ""}>
      <span class="cpt-f-name">${esc(lastSeg(prefix))}</span>
      ${missing ? '<span class="cpt-f-tag">Not in the Library</span>' : `<a class="cpt-f-open" href="/admin/content?folder=${encodeURIComponent(lastSeg(prefix))}" target="_blank" rel="noopener">Open</a>`}
    </label>`;
  }

  function drawFolders(filter = "") {
    const box = host.querySelector("#cpt-folders");
    if (!box) return;
    const ticked = new Set(p.folders || []);
    const exists = new Set(allFolders || []);
    const own = new Set(shootFolders.map((f) => ROOT + f + "/"));
    const q = filter.trim().toLowerCase();
    const match = (f) => !q || lastSeg(f).toLowerCase().includes(q);
    const tickedList = [...ticked].filter(match);
    const ownList = [...own].filter((f) => exists.has(f) && !ticked.has(f) && match(f));
    const others = (allFolders || []).filter((f) => !ticked.has(f) && !own.has(f) && match(f));
    const group = (title, list, note) => list.length || note
      ? `<p class="cpt-k">${title}</p>${list.length ? list.map((f) => folderRow(f, ticked.has(f), !exists.has(f) && allFolders && !foldersErr)).join("") : `<p class="smm-soon">${note}</p>`}`
      : "";
    box.innerHTML = [
      group("Shared with them", tickedList, q ? "" : "Nothing ticked yet: they'll see an empty portal."),
      group(`${esc(who)}'s other shoots`, ownList, ""),
      group("Everything else in the Library", others.slice(0, 200), q ? "No folder matches that." : ""),
      others.length > 200 ? `<p class="smm-soon">${others.length - 200} more: search to find them.</p>` : "",
    ].join("") || '<p class="smm-soon">No folders in the Library yet.</p>';
  }

  async function draw() {
    if (!p || !p.enabled) return drawOff();
    const link = portalLink(p.token);
    const locked = p.locked_until && Date.parse(p.locked_until) > Date.now();
    host.innerHTML = `<div class="smm-panel-head"><h4>Client portal</h4><span class="cpt-on-pill">On</span></div>
      <div class="cpt">
        <div class="cpt-keys">
          <div class="cpt-key"><span class="cpt-k">Link</span><span class="cpt-v cpt-v--link"><a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a></span><button type="button" class="smm-mini" data-cptcopy="link">Copy</button></div>
          <div class="cpt-key"><span class="cpt-k">Passcode</span><span class="cpt-v cpt-v--code">${esc(p.passcode)}</span><button type="button" class="smm-mini" data-cptcopy="code">Copy</button></div>
          <div class="cpt-key"><span class="cpt-k">Last opened</span><span class="cpt-v">${p.last_opened_at ? esc(fmtWhen(p.last_opened_at)) : "Not opened yet"}</span></div>
        </div>
        ${locked ? `<p class="cpt-msg is-err">Locked after too many wrong passcodes until ${esc(fmtWhen(p.locked_until))}. <button type="button" class="smm-mini is-primary" id="cpt-unlock">Unlock now</button></p>` : ""}
        <div class="cpt-actions">
          <button type="button" class="smm-btn smm-btn--primary smm-btn--sm" data-cptcopy="message">Copy the message to send</button>
          <button type="button" class="smm-btn smm-btn--sm" id="cpt-newcode">New passcode</button>
          <button type="button" class="smm-btn smm-btn--sm" id="cpt-newlink">New link</button>
          <button type="button" class="smm-btn smm-btn--sm smm-btn--danger" id="cpt-off">Turn off</button>
        </div>
        <p class="cpt-msg cpt-status"></p>
        <div class="cpt-fhead"><p class="cpt-h">Folders they can see</p><input type="search" class="cpt-search" id="cpt-search" placeholder="Search the Library" aria-label="Search the Library folders"></div>
        <p class="cpt-hint">Ticking a folder shares everything in it, including anything added later.</p>
        <div id="cpt-folders" class="cpt-folders" data-lenis-prevent><p class="smm-soon">Loading the Library…</p></div>
      </div>`;
    wire();
    if (!allFolders) await loadFolders();
    if (foldersErr) status("err", "Couldn't read the Library: " + foldersErr + ". Ticked folders are still shared.");
    drawFolders(host.querySelector("#cpt-search")?.value || "");
  }

  function wire() {
    host.querySelectorAll("[data-cptcopy]").forEach((b) => b.addEventListener("click", async () => {
      const what = b.getAttribute("data-cptcopy");
      const link = portalLink(p.token);
      const text = what === "link" ? link : what === "code" ? p.passcode : portalMessage(lead.first_name || (lead.full_name || "").split(" ")[0], link, p.passcode);
      try {
        await navigator.clipboard.writeText(text);
        status("ok", what === "message" ? "Message copied. Paste it into your email to them." : what === "link" ? "Link copied." : "Passcode copied.");
      } catch (_) { status("err", "Couldn't copy. Select it and copy it by hand."); }
    }));
    host.querySelector("#cpt-newcode")?.addEventListener("click", async () => {
      if (!confirm(`Make a new passcode for ${who}? Anyone signed in to the portal is signed out and needs the new one.`)) return;
      if (await save({ passcode: newPasscode(), failed_tries: 0, locked_until: null }, "")) { await draw(); status("ok", "New passcode made. Send it to them: the old one no longer works."); }
    });
    host.querySelector("#cpt-newlink")?.addEventListener("click", async () => {
      if (!confirm(`Make a new link for ${who}? The old link stops working straight away.`)) return;
      if (await save({ token: newToken() }, "")) { await draw(); status("ok", "New link made. Send it to them: the old one no longer works."); }
    });
    host.querySelector("#cpt-off")?.addEventListener("click", async () => {
      if (!confirm(`Turn off ${who}'s client portal? Their link stops working straight away. Turning it back on keeps the same link and passcode.`)) return;
      if (await save({ enabled: false }, "Turned off.")) { drawOff(); status("ok", "Turned off. Their link no longer works."); }
    });
    host.querySelector("#cpt-unlock")?.addEventListener("click", async () => {
      if (await save({ failed_tries: 0, locked_until: null }, "")) { await draw(); status("ok", "Unlocked."); }
    });
    host.querySelector("#cpt-search")?.addEventListener("input", (e) => drawFolders(e.target.value));
    host.querySelector("#cpt-folders")?.addEventListener("change", async (e) => {
      const box = e.target.closest("[data-cptf]");
      if (!box) return;
      const f = box.getAttribute("data-cptf");
      const before = p.folders || [];
      const next = box.checked ? [...new Set([...before, f])] : before.filter((x) => x !== f);
      host.querySelectorAll("[data-cptf]").forEach((x) => { x.disabled = true; });
      const ok = await save({ folders: next }, box.checked ? `Shared “${lastSeg(f)}”.` : `Stopped sharing “${lastSeg(f)}”.`);
      if (!ok) box.checked = !box.checked;
      drawFolders(host.querySelector("#cpt-search")?.value || "");
    });
  }

  draw();
}
