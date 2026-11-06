/* Client portals, as the team sees them (Danielle, 2 Nov 2026).
 *
 * Videography › Client portals: make a portal for a client (a brand day like
 * Fine & Country's bootcamp needs no social media card), tick which Library
 * folders they see, and copy their link and passcode to send them. The client
 * opens tmke.co.uk/portal?c=… (src/pages/portal.astro); the Worker's /portal/*
 * routes check the passcode and sign every file link.
 *
 * Rows live in client_portals (supabase/client_portal.sql), admin-read and
 * admin-write, so this uses the signed-in client directly. Every save asks for
 * the row back and only says "Saved" when it comes back. Styles are in
 * src/styles/client-portal-admin.css.
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
const isMissingTable = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205" || (/client_portals/.test(e.message || "") && /exist|schema cache/i.test(e.message || "")));
const MISSING = "Client portals aren't set up in the database yet. Run supabase/client_portal.sql in Supabase, then reopen this page.";

export function portalLink(token) {
  const site = /^(localhost|127\.)/.test(location.hostname) ? location.origin : "https://tmke.co.uk";
  return `${site}/portal?c=${encodeURIComponent(token)}`;
}

// The message the team pastes into their own email. Nothing is sent from here.
export function portalMessage(firstName, link, passcode) {
  return `Hi ${firstName || "there"},

We've set up a private page where you can watch, view and download the content we've shared with you.

Link: ${link}
Passcode: ${passcode}

Everything is in folders, usually one per shoot, and anything we add to them later will appear automatically. Once you've entered the passcode, you'll stay signed in on that browser for 7 days.`;
}

/* host: the element to draw into. deps: { supabase, authToken, worker, me }
   where me() resolves to the signed-in email. Opens on the list. */
export function renderClientPortals(host, deps) {
  const { supabase, authToken, worker, me } = deps;
  if (!host) return;

  const setStatus = (kind, text) => {
    const el = host.querySelector(".cpt-status");
    if (!el) return;
    el.className = "cpt-msg cpt-status" + (kind ? " is-" + kind : "");
    el.textContent = text || "";
  };

  // Every top-level Library folder, for the ticks. Read once per visit.
  let allFolders = null, foldersErr = "";
  async function loadFolders() {
    try {
      const t = await authToken();
      const res = await fetch(`${worker}/list?prefix=${encodeURIComponent(ROOT)}`, { headers: { Authorization: "Bearer " + t } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || String(res.status));
      allFolders = body.folders || []; foldersErr = "";
    } catch (e) { allFolders = []; foldersErr = e.message || "unknown"; }
  }

  /* ---------- Every portal ---------- */
  async function drawList(note) {
    host.innerHTML = `<p class="cpt-note">Loading…</p>`;
    const { data, error } = await supabase.from("client_portals").select("*").order("name");
    if (error) {
      host.innerHTML = `<p class="cpt-msg is-err">${isMissingTable(error) ? MISSING : "Couldn't load the portals: " + esc(error.message)}</p>`;
      return;
    }
    const rows = data || [];
    host.innerHTML = `
      <div class="cpt-bar">
        <button type="button" class="admin-btn admin-btn-primary" id="cpt-new">+ New portal</button>
        <p class="cpt-msg cpt-status"></p>
      </div>
      <form class="cpt-newform" id="cpt-newform" hidden>
        <label class="cpt-field"><span class="cpt-k">Who it's for</span><input type="text" id="cpt-new-name" placeholder="Fine &amp; Country" maxlength="80" required></label>
        <label class="cpt-field"><span class="cpt-k">Their first name</span><input type="text" id="cpt-new-first" placeholder="For the message you send" maxlength="40"></label>
        <div class="cpt-newform-go"><button type="submit" class="admin-btn admin-btn-primary">Make the portal</button><button type="button" class="admin-btn admin-btn-ghost" id="cpt-new-cancel">Cancel</button></div>
      </form>
      ${rows.length ? `<table class="cpt-table">
        <thead><tr><th>Client</th><th>Folders</th><th>Last opened</th><th>Status</th></tr></thead>
        <tbody>${rows.map((r) => `<tr data-cptid="${esc(r.id)}" tabindex="0">
          <td class="cpt-t-name">${esc(r.name)}</td>
          <td>${(r.folders || []).length}</td>
          <td>${r.last_opened_at ? esc(fmtWhen(r.last_opened_at)) : "Not opened yet"}</td>
          <td><span class="cpt-pill ${r.enabled ? "is-on" : "is-off"}">${r.enabled ? "On" : "Off"}</span></td>
        </tr>`).join("")}</tbody></table>`
        : `<p class="cpt-note">No portals yet. Make one for a client, tick the Library folders they should see, then send them the link and passcode.</p>`}`;
    if (note) setStatus("ok", note);
    const form = host.querySelector("#cpt-newform");
    host.querySelector("#cpt-new").addEventListener("click", () => { form.hidden = false; host.querySelector("#cpt-new-name").focus(); });
    host.querySelector("#cpt-new-cancel").addEventListener("click", () => { form.hidden = true; });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = host.querySelector("#cpt-new-name").value.trim();
      const first = host.querySelector("#cpt-new-first").value.trim();
      if (!name) return;
      form.querySelectorAll("button, input").forEach((x) => { x.disabled = true; });
      setStatus("busy", "Making it…");
      const by = (await me().catch(() => "")) || null;
      const { data: made, error: err } = await supabase.from("client_portals")
        .insert({ name, first_name: first || null, token: newToken(), passcode: newPasscode(), folders: [], enabled: true, updated_by: by })
        .select();
      if (err || !made || made.length !== 1) {
        setStatus("err", "Not made: " + (err ? err.message : "the database didn't confirm it. Try again."));
        form.querySelectorAll("button, input").forEach((x) => { x.disabled = false; });
        return;
      }
      drawPortal(made[0], `Made. Tick the folders ${name} should see, then copy the message to send.`);
    });
    host.querySelectorAll("[data-cptid]").forEach((tr) => {
      const open = () => drawPortal(rows.find((r) => r.id === tr.getAttribute("data-cptid")));
      tr.addEventListener("click", open);
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
    });
  }

  /* ---------- One portal ---------- */
  async function drawPortal(p, note) {
    // Write, ask for the row back, and only then believe it.
    async function save(patch, okText) {
      setStatus("busy", "Saving…");
      const by = (await me().catch(() => "")) || null;
      const { data, error } = await supabase.from("client_portals")
        .update({ ...patch, updated_by: by }).eq("id", p.id).select();
      if (error || !data || data.length !== 1) {
        setStatus("err", "Not saved: " + (error ? error.message : "the database didn't confirm it. Check you're still signed in, then try again."));
        return false;
      }
      p = data[0];
      setStatus("ok", okText || "Saved.");
      return true;
    }

    function folderRow(prefix, ticked, missing) {
      return `<label class="cpt-f${ticked ? " is-on" : ""}">
        <input type="checkbox" data-cptf="${esc(prefix)}"${ticked ? " checked" : ""}>
        <span class="cpt-f-name">${esc(lastSeg(prefix))}</span>
        ${missing ? '<span class="cpt-f-tag">Not in the Library</span>' : `<a class="cpt-f-open" href="/admin/content?folder=${encodeURIComponent(lastSeg(prefix))}" target="_blank" rel="noopener">Open</a>`}
      </label>`;
    }
    function drawFolders() {
      const box = host.querySelector("#cpt-folders");
      if (!box) return;
      const ticked = new Set(p.folders || []);
      const exists = new Set(allFolders || []);
      const q = (host.querySelector("#cpt-search")?.value || "").trim().toLowerCase();
      const match = (f) => !q || lastSeg(f).toLowerCase().includes(q);
      // Folders with their name in, first: a client's shoots are usually named for them.
      const named = String(p.name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const isNamed = (f) => named && lastSeg(f).toLowerCase().replace(/[^a-z0-9]+/g, " ").includes(named);
      const tickedList = [...ticked].filter(match);
      const rest = (allFolders || []).filter((f) => !ticked.has(f) && match(f));
      const namedList = rest.filter(isNamed), others = rest.filter((f) => !isNamed(f));
      const group = (title, list, empty) => list.length || empty
        ? `<p class="cpt-k">${title}</p>${list.length ? list.map((f) => folderRow(f, ticked.has(f), !foldersErr && !exists.has(f))).join("") : `<p class="cpt-note">${empty}</p>`}`
        : "";
      box.innerHTML = [
        group("Shared with them", tickedList, q ? "" : "Nothing ticked yet: they'll see an empty portal."),
        group(`With “${esc(p.name)}” in the name`, namedList, ""),
        group("Everything else in the Library", others.slice(0, 200), q && !namedList.length ? "No folder matches that." : ""),
        others.length > 200 ? `<p class="cpt-note">${others.length - 200} more: search to find them.</p>` : "",
      ].join("") || '<p class="cpt-note">No folders in the Library yet.</p>';
    }

    async function draw(statusKind, statusText) {
      const link = portalLink(p.token);
      const locked = p.locked_until && Date.parse(p.locked_until) > Date.now();
      host.innerHTML = `
        <button type="button" class="cpt-back" id="cpt-back">&larr; All portals</button>
        <div class="cpt-head"><div class="cpt-title">${esc(p.name)}</div><span class="cpt-pill ${p.enabled ? "is-on" : "is-off"}">${p.enabled ? "On" : "Off"}</span></div>
        <div class="cpt">
          <div class="cpt-keys">
            <label class="cpt-key"><span class="cpt-k">Who it's for</span><input class="cpt-in" data-cptset="name" value="${esc(p.name)}" maxlength="80"><span></span></label>
            <label class="cpt-key"><span class="cpt-k">Their first name</span><input class="cpt-in" data-cptset="first_name" value="${esc(p.first_name || "")}" maxlength="40" placeholder="For the message you send"><span></span></label>
            <label class="cpt-key"><span class="cpt-k">Email new folders to</span><input class="cpt-in" type="text" data-cptset="notify_email" value="${esc(p.notify_email || "")}" maxlength="400" placeholder="Optional: emailed when a folder is added. Separate several with commas"><span></span></label>
            <div class="cpt-key"><span class="cpt-k">Link</span><span class="cpt-v cpt-v--link">${p.enabled ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a>` : "Off: the link doesn't work"}</span>${p.enabled ? '<button type="button" class="cpt-mini" data-cptcopy="link">Copy</button>' : "<span></span>"}</div>
            <div class="cpt-key"><span class="cpt-k">Passcode</span><span class="cpt-v cpt-v--code">${esc(p.passcode)}</span><button type="button" class="cpt-mini" data-cptcopy="code">Copy</button></div>
            <div class="cpt-key"><span class="cpt-k">Last opened</span><span class="cpt-v">${p.last_opened_at ? esc(fmtWhen(p.last_opened_at)) : "Not opened yet"}</span><span></span></div>
          </div>
          ${locked ? `<p class="cpt-msg is-err">Locked after too many wrong passcodes until ${esc(fmtWhen(p.locked_until))}. <button type="button" class="cpt-mini" id="cpt-unlock">Unlock now</button></p>` : ""}
          <div class="cpt-actions">
            ${p.enabled
              ? `<button type="button" class="admin-btn admin-btn-primary" data-cptcopy="message">Copy the message to send</button>
                 <button type="button" class="admin-btn admin-btn-ghost" id="cpt-newcode">New passcode</button>
                 <button type="button" class="admin-btn admin-btn-ghost" id="cpt-setcode">Choose passcode</button>
                 <button type="button" class="admin-btn admin-btn-ghost" id="cpt-newlink">New link</button>
                 <button type="button" class="admin-btn admin-btn-ghost cpt-danger" id="cpt-off">Turn off</button>`
              : `<button type="button" class="admin-btn admin-btn-primary" id="cpt-on">Turn back on</button>`}
            <button type="button" class="admin-btn admin-btn-ghost cpt-danger" id="cpt-del">Delete</button>
          </div>
          <p class="cpt-msg cpt-status"></p>
          <div class="cpt-fhead"><div class="cpt-h">Folders they can see</div><input type="search" class="cpt-search" id="cpt-search" placeholder="Search the Library" aria-label="Search the Library folders"></div>
          <p class="cpt-hint">Ticking a folder shares everything in it, including anything added later.</p>
          <div id="cpt-folders" class="cpt-folders" data-lenis-prevent><p class="cpt-note">Loading the Library…</p></div>
        </div>`;
      wire();
      if (statusText) setStatus(statusKind || "ok", statusText);
      if (!allFolders) await loadFolders();
      if (foldersErr) setStatus("err", "Couldn't read the Library: " + foldersErr + ". Ticked folders are still shared.");
      drawFolders();
    }

    function wire() {
      host.querySelector("#cpt-back").addEventListener("click", () => drawList());
      host.querySelectorAll("[data-cptset]").forEach((inp) => inp.addEventListener("change", async () => {
        const k = inp.getAttribute("data-cptset"), v = inp.value.trim();
        if (k === "name" && !v) { inp.value = p.name; setStatus("err", "It needs a name."); return; }
        if (k === "notify_email") {
          const list = v.split(/[,;\s]+/).map((a) => a.trim().toLowerCase()).filter(Boolean);
          const bad = list.find((a) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a));
          if (bad) { setStatus("err", `"${bad}" doesn't look like an email address.`); return; }
          // Folders already in the portal count as told, so turning this on
          // doesn't send an email about everything at once.
          const patch = { notify_email: list.length ? list.join(", ") : null };
          if (list.length && !p.notify_email) patch.notified_folders = p.folders || [];
          await save(patch, list.length ? `Saved. ${list.join(", ")} ${list.length === 1 ? "is" : "are"} emailed whenever a folder is added to this portal.` : "Saved. Nobody is emailed about new folders now.");
          inp.value = list.join(", ");
          return;
        }
        if (await save({ [k]: v || null }, "Saved.") && k === "name") host.querySelector(".cpt-title").textContent = p.name;
      }));
      host.querySelectorAll("[data-cptcopy]").forEach((b) => b.addEventListener("click", async () => {
        const what = b.getAttribute("data-cptcopy");
        const link = portalLink(p.token);
        const text = what === "link" ? link : what === "code" ? p.passcode : portalMessage(p.first_name, link, p.passcode);
        try {
          await navigator.clipboard.writeText(text);
          setStatus("ok", what === "message" ? "Message copied. Paste it into your email to them." : what === "link" ? "Link copied." : "Passcode copied.");
        } catch (_) { setStatus("err", "Couldn't copy. Select it and copy it by hand."); }
      }));
      host.querySelector("#cpt-newcode")?.addEventListener("click", async () => {
        if (!confirm(`Make a new passcode for ${p.name}? Anyone signed in to the portal is signed out and needs the new one.`)) return;
        if (await save({ passcode: newPasscode(), failed_tries: 0, locked_until: null })) draw("ok", "New passcode made. Send it to them: the old one no longer works.");
      });
      host.querySelector("#cpt-setcode")?.addEventListener("click", async () => {
        const raw = prompt(`Choose ${p.name}'s passcode: 3 to 12 letters or numbers.`, "");
        if (raw == null) return;
        const code = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (code.length < 3 || code.length > 12) { setStatus("err", "A passcode is 3 to 12 letters or numbers."); return; }
        if (await save({ passcode: code, failed_tries: 0, locked_until: null })) draw("ok", `The passcode is now ${code}. Anyone signed in to the portal needs it again.`);
      });
      host.querySelector("#cpt-newlink")?.addEventListener("click", async () => {
        if (!confirm(`Make a new link for ${p.name}? The old link stops working straight away.`)) return;
        if (await save({ token: newToken() })) draw("ok", "New link made. Send it to them: the old one no longer works.");
      });
      host.querySelector("#cpt-off")?.addEventListener("click", async () => {
        if (!confirm(`Turn off ${p.name}'s portal? Their link stops working straight away. Turning it back on keeps the same link and passcode.`)) return;
        if (await save({ enabled: false })) draw("ok", "Turned off. Their link no longer works.");
      });
      host.querySelector("#cpt-on")?.addEventListener("click", async () => {
        if (await save({ enabled: true })) draw("ok", "Turned back on, with the same link and passcode.");
      });
      host.querySelector("#cpt-del")?.addEventListener("click", async () => {
        if (!confirm(`Delete ${p.name}'s portal? Their link stops working and this can't be undone. The files stay in the Library.`)) return;
        setStatus("busy", "Deleting…");
        const { data, error } = await supabase.from("client_portals").delete().eq("id", p.id).select();
        if (error || !data || data.length !== 1) { setStatus("err", "Not deleted: " + (error ? error.message : "the database didn't confirm it.")); return; }
        drawList(`Deleted ${p.name}'s portal.`);
      });
      host.querySelector("#cpt-unlock")?.addEventListener("click", async () => {
        if (await save({ failed_tries: 0, locked_until: null })) draw("ok", "Unlocked.");
      });
      host.querySelector("#cpt-search")?.addEventListener("input", drawFolders);
      host.querySelector("#cpt-folders")?.addEventListener("change", async (e) => {
        const box = e.target.closest("[data-cptf]");
        if (!box) return;
        const f = box.getAttribute("data-cptf");
        const before = p.folders || [];
        const next = box.checked ? [...new Set([...before, f])] : before.filter((x) => x !== f);
        host.querySelectorAll("[data-cptf]").forEach((x) => { x.disabled = true; });
        const ok = await save({ folders: next }, box.checked ? `Shared “${lastSeg(f)}”.` : `Stopped sharing “${lastSeg(f)}”.`);
        if (!ok) box.checked = !box.checked;
        drawFolders();
      });
    }

    await draw("ok", note);
  }

  drawList();
}

/* ---------- On a shoot: which client's portal it's in ----------
   Beside "Archive copy uploaded" on the booking (Danielle, 2 Nov 2026). Picking
   a portal adds this shoot's Library folder to it; picking another moves it;
   "Not in a portal" takes it out. Saves straight away, separately from the
   booking's own Save. The portal's link, passcode and other folders are
   managed in Videography › Client portals. */
// How a shoot's folder is held on a portal.
export function shootPortalKey(folderName) {
  return folderName ? ROOT + folderName.replace(/^\/+|\/+$/g, "") + "/" : "";
}
export async function renderShootPortal(host, booking, folderName, deps) {
  const { supabase, me, onChange } = deps;
  if (!host) return;
  const folder = shootPortalKey(folderName);
  const head = `<div class="cpt-shoot-head"><span class="cpt-shoot-k">Client portal</span><span class="cpt-shoot-note">the client watches and downloads it from their own link</span></div>`;
  if (!booking || !folder) { host.innerHTML = ""; return; }
  host.innerHTML = head + '<p class="cpt-note">Loading…</p>';

  const { data, error } = await supabase.from("client_portals").select("*").order("name");
  if (error) {
    host.innerHTML = head + `<p class="cpt-msg is-err">${isMissingTable(error) ? MISSING : "Couldn't load the portals: " + esc(error.message)}</p>`;
    return;
  }
  let portals = data || [];
  const clientName = String(booking.client_company || booking.client_name || "").trim();
  const firstName = String(booking.client_name || "").trim().split(/\s+/)[0] || null;

  const status = (kind, text) => {
    const el = host.querySelector(".cpt-status");
    if (el) { el.className = "cpt-msg cpt-status" + (kind ? " is-" + kind : ""); el.textContent = text || ""; }
  };
  async function setFolders(p, folders) {
    const by = (await me().catch(() => "")) || null;
    const { data: rows, error: err } = await supabase.from("client_portals").update({ folders, updated_by: by }).eq("id", p.id).select();
    if (err || !rows || rows.length !== 1) throw new Error(err ? err.message : "the database didn't confirm it");
    portals = portals.map((x) => (x.id === p.id ? rows[0] : x));
  }

  // A new-starter shoot goes into the TEG New Starter portal by itself once
  // it's Delivered (the Worker's runStarterPortalAdds), so the picker says so
  // rather than "Not in a portal".
  // The Worker's rule (shootDoneForPortal): a ticked folder shows once the
  // shoot is sent and paid, or has nothing to pay.
  // Delivered by portal: Content ready is a saved Yes, and management can release
  // it before payment.
  const byPortal = booking.delivery_method === "portal";
  const doneForPortal = byPortal
    ? !!booking.portal_ready_at && (!!booking.paid_at || !!booking.released_unpaid_at)
    : ["sent", "delivered"].includes(booking.stage) && (!!booking.paid_at || booking.payment_route === "smm_package" || booking.amount_pence === 0);
  const isStarter = /new.?starter/i.test(String(booking.service || ""));
  const tegPortal = portals.find((p) => p.enabled && /\bteg\b.*new.?starter|new.?starter.*\bteg\b/i.test(p.name || ""));
  function draw(kind, text) {
    const inIt = portals.filter((p) => (p.folders || []).includes(folder));
    const cur = inIt[0];
    const auto = isStarter && tegPortal && !cur;
    host.innerHTML = head + `
      <div class="cpt-shoot-row">
        <select class="cpt-shoot-sel" aria-label="Client portal for this shoot">
          <option value="">${auto ? `${esc(tegPortal.name)}, once sent and paid` : "Not in a portal"}</option>
          ${portals.map((p) => `<option value="${esc(p.id)}"${cur && cur.id === p.id ? " selected" : ""}>${esc(p.name)}${p.enabled ? "" : " (off)"}</option>`).join("")}
          ${clientName && !portals.some((p) => p.name.trim().toLowerCase() === clientName.toLowerCase()) ? `<option value="new">+ New portal for ${esc(clientName)}</option>` : ""}
        </select>
        ${cur && cur.enabled ? `<button type="button" class="cpt-mini" data-cptcopy="link">Copy link</button><button type="button" class="cpt-mini" data-cptcopy="code">Copy passcode</button>` : ""}
        <a class="cpt-mini" href="/admin/videography?panel=portals">Manage portals</a>
      </div>
      ${auto ? `<p class="cpt-note">A new starter: this folder goes into ${esc(tegPortal.name)} by itself once the shoot has been sent and paid for, and whoever that portal emails hears about it then.</p>` : ""}
      ${inIt.length > 1 ? `<p class="cpt-note">Also in ${inIt.slice(1).map((p) => esc(p.name)).join(", ")}.</p>` : ""}
      ${cur && !cur.enabled ? `<p class="cpt-note">${esc(cur.name)}'s portal is turned off, so they can't see it yet.</p>` : ""}
      ${cur && cur.enabled && !doneForPortal ? `<p class="cpt-note">Waiting: it only shows in ${esc(cur.name)}'s portal once ${byPortal ? "Content ready is Yes and it's paid or released before payment" : "this shoot has been sent and paid for"}, and anyone the portal emails hears about it then.</p>` : ""}
      <p class="cpt-msg cpt-status"></p>`;
    if (text) status(kind, text);
    const sel = host.querySelector(".cpt-shoot-sel");
    sel.addEventListener("change", async () => {
      const to = sel.value;
      sel.disabled = true;
      status("busy", "Saving…");
      try {
        if (cur && cur.id !== to) await setFolders(cur, (cur.folders || []).filter((f) => f !== folder));
        if (to === "new") {
          const by = (await me().catch(() => "")) || null;
          const { data: made, error: err } = await supabase.from("client_portals")
            .insert({ name: clientName, first_name: firstName, token: newToken(), passcode: newPasscode(), folders: [folder], enabled: true, updated_by: by })
            .select();
          if (err || !made || made.length !== 1) throw new Error(err ? err.message : "the database didn't confirm it");
          portals = [...portals, made[0]].sort((a, b) => a.name.localeCompare(b.name));
          return draw("ok", `Made ${clientName}'s portal with this shoot in it. Copy the link and passcode to send them.`);
        }
        const target = portals.find((p) => p.id === to);
        if (target && !(target.folders || []).includes(folder)) await setFolders(target, [...(target.folders || []), folder]);
        draw("ok", target ? `In ${target.name}'s portal.` : "Taken out of the portal.");
        if (onChange) onChange();
      } catch (e) {
        draw("err", "Not saved: " + e.message + ". Try again.");
      }
    });
    host.querySelectorAll("[data-cptcopy]").forEach((b) => b.addEventListener("click", async () => {
      const text = b.getAttribute("data-cptcopy") === "link" ? portalLink(cur.token) : cur.passcode;
      try { await navigator.clipboard.writeText(text); status("ok", b.getAttribute("data-cptcopy") === "link" ? "Link copied." : "Passcode copied."); }
      catch (_) { status("err", "Couldn't copy. Open Manage portals to copy it by hand."); }
    }));
  }
  draw();
}
