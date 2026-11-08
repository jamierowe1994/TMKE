// The Client portals tab: every portal as a card, in the order shoots were last
// added (Dani, 8 Nov 2026). Rows are written with the signed-in client and only
// believed when the database hands them back. A passcode stays off the screen
// until someone presses Show.
import { supabase } from "../supabase.js";
import { newToken, newPasscode, portalLink, portalMessage } from "../client-portal-admin.js";
import { $, $$, esc, api, toast, pop, closePop, confirmPop, chip, fmtD, ROOT } from "./common.js";
import { allFolders, loadFolders, refreshLibrary } from "./library.js";

const PT = { portals: null, error: "", filter: "All", q: "" };
const CHIPS = { Showing: "t", "Waiting for payment": "s", "Not ready yet": "s", Requested: "w", Completed: "t" };
const host = () => $("#cs-v-portals");

export async function startPortals() {
  host().innerHTML = `<div class="cs-loading"><span class="cs-spin"></span><span>Opening the portals…</span></div>`;
  await load();
  draw();
}
async function load() {
  try {
    if (!allFolders().length) await loadFolders();
    PT.portals = (await api("/creative/portals")).portals || []; PT.error = "";
  } catch (e) { PT.error = e.message; }
}
// When a shoot was last added. Until the new column has a date for a portal,
// the newest upload among its shoots stands in.
function updated(p) {
  if (p.shoots_added_at) return p.shoots_added_at;
  const dates = p.folders.map((x) => (allFolders().find((f) => f.prefix === x) || {}).first).filter(Boolean).sort();
  return dates[dates.length - 1] || "";
}
function coverOf(p) {
  const mine = p.folders.map((x) => allFolders().find((f) => f.prefix === x)).filter((f) => f && f.cover).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return mine[0] ? mine[0].cover : "";
}
function draw() {
  const v = host();
  if (PT.error) { v.innerHTML = `<p>Couldn't open the portals: ${esc(PT.error)}</p>`; return; }
  const cur = document.activeElement && document.activeElement.id === "cs-pt-q";
  const q = PT.q.toLowerCase();
  const list = PT.portals.filter((p) => (PT.filter === "All" || p.type === PT.filter) && p.name.toLowerCase().includes(q)).sort((a, b) => updated(b).localeCompare(updated(a)));
  const rows = PT.portals.flatMap((p) => p.rows), showing = rows.filter((r) => r.status === "Showing");
  v.innerHTML = `<div class="cs-figs"><div class="cs-fig cs-fig-w">Portals on<b>${PT.portals.filter((p) => p.enabled).length}</b></div><div class="cs-fig cs-fig-t">Shoots showing<b>${showing.length}</b></div><div class="cs-fig cs-fig-s">Not emailed yet<b>${showing.filter((r) => !r.emailedAt && !r.told).length}</b></div><div class="cs-fig cs-fig-l">Edits requested<b>${rows.filter((r) => r.edits === "Requested").length}</b></div></div>
  <div class="cs-bar"><div class="cs-seg" id="cs-pt-seg">${["All", "Client", "Social media", "New starters"].map((k) => `<button type="button" data-k="${k}" class="${PT.filter === k ? "on" : ""}">${k}</button>`).join("")}</div><input class="cs-in" id="cs-pt-q" type="search" placeholder="Search portals" aria-label="Search portals" value="${esc(PT.q)}"><span class="cs-grow"></span><button type="button" class="cs-btn cs-pri" id="cs-pt-new">New portal</button></div>
  <div class="cs-ports">${list.map((p) => { const c = coverOf(p), u = updated(p); return `<article class="cs-box">${c ? `<img class="cs-pcov" src="${esc(c)}" alt="" loading="lazy">` : `<div class="cs-pcov"></div>`}<div class="cs-ptop"><span class="cs-t19">${esc(p.name)}</span>${p.enabled ? chip("On", "t") : chip("Off", "s")}</div>
    <div class="cs-row"><span class="cs-k">Type</span><span class="cs-v">${esc(p.type)}</span></div><div class="cs-row"><span class="cs-k">Shoots</span><span class="cs-v">${p.rows.length}</span></div><div class="cs-row"><span class="cs-k">Emails go to</span><span class="cs-v">${esc(p.notify_email || "Nobody yet")}</span></div><div class="cs-row"><span class="cs-k">Last updated</span><span class="cs-v">${esc(u ? fmtD(u) : "No shoots yet")}</span></div>
    <div class="cs-pfoot"><button type="button" class="cs-btn" data-view="${esc(p.id)}">View as client</button><button type="button" class="cs-btn" data-copy="${esc(p.id)}">Copy link</button><button type="button" class="cs-btn cs-pri" data-man="${esc(p.id)}">Manage</button></div></article>`; }).join("") || `<p class="cs-muted">No portals match that.</p>`}</div>`;
  $$("#cs-pt-seg button").forEach((b) => (b.onclick = () => { PT.filter = b.dataset.k; draw(); }));
  const q2 = $("#cs-pt-q"); q2.oninput = () => { PT.q = q2.value; draw(); };
  if (cur) { q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); }
  const by = (id) => PT.portals.find((p) => p.id === id);
  $$("[data-view]", v).forEach((b) => (b.onclick = () => viewAsClient(by(b.dataset.view))));
  $$("[data-copy]", v).forEach((b) => (b.onclick = () => copy(portalLink(by(b.dataset.copy).token), "Link copied.")));
  $$("[data-man]", v).forEach((b) => (b.onclick = () => manage(by(b.dataset.man).id)));
  $("#cs-pt-new").onclick = newPortal;
}
async function copy(text, said) {
  try { await navigator.clipboard.writeText(text); toast(said); }
  catch (_) { toast("Couldn't copy that. Please try again."); }
}
async function viewAsClient(p) {
  // Opened first, or the browser treats it as a pop-up once the wait is over.
  const tab = window.open("about:blank", "_blank");
  try {
    const s = await api("/creative/portal-view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) });
    localStorage.setItem("tmke.portal." + s.token, JSON.stringify({ session: s.session, expires: s.expires }));
    if (tab) tab.location = portalLink(s.token); else location.href = portalLink(s.token);
  } catch (e) { if (tab) tab.close(); toast(e.message); }
}
async function reload(id) {
  await load();
  draw();
  if (id && PT.portals.some((p) => p.id === id) && $(".cs-pop")) manage(id);
}
async function save(id, patch, said) {
  const { data, error } = await supabase.from("client_portals").update(patch).eq("id", id).select();
  if (error || !data || data.length !== 1) { toast("Not saved: " + (error ? error.message : "the database didn't confirm it. Try again.")); return false; }
  if (said) toast(said);
  await reload(id);
  return true;
}

function newPortal() {
  pop({ eyebrow: "Client portals", title: "New Portal.", body: `<div class="cs-box"><div class="cs-row"><span class="cs-k">Who it's for</span><input class="cs-in cs-full" id="np-n" maxlength="80"></div><div class="cs-row"><span class="cs-k">Their first name</span><input class="cs-in cs-full" id="np-f" maxlength="40"></div></div>`, foot: `<button type="button" class="cs-btn cs-pri" id="np-go">Make the portal</button>` });
  $("#np-n").focus();
  $("#np-go").onclick = async () => {
    const name = $("#np-n").value.trim();
    if (!name) return toast("It needs a name.");
    const { data, error } = await supabase.from("client_portals").insert({ name, first_name: $("#np-f").value.trim() || null, token: newToken(), passcode: newPasscode(), folders: [], enabled: true }).select();
    if (error || !data || data.length !== 1) return toast("Not made: " + (error ? error.message : "the database didn't confirm it. Try again."));
    closePop();
    await reload();
    manage(data[0].id);
    toast("Made. Add the shoots they should see.");
  };
}

function manage(id) {
  const p = PT.portals.find((x) => x.id === id);
  if (!p) return closePop();
  const locked = p.locked_until && Date.parse(p.locked_until) > Date.now();
  const edit = (k, label, val, more = "") => `<div class="cs-row"><span class="cs-k">${label}</span><input class="cs-in cs-full" data-set="${k}" value="${esc(val)}" ${more}></div>`;
  pop({ eyebrow: "Client portals · " + p.type, title: p.name, chipHtml: p.enabled ? chip("On", "t") : chip("Off", "s"),
    body: `<div class="cs-box"><div class="cs-strip">Details</div>${edit("name", "Who it's for", p.name, 'maxlength="80"')}${edit("first_name", "First name", p.first_name, 'maxlength="40"')}${edit("notify_email", "Emails go to", p.notify_email, 'maxlength="400" placeholder="Separate several with commas"')}
      <div class="cs-row"><span class="cs-k">Link</span><span class="cs-rowact"><span class="cs-v">${esc(portalLink(p.token))}</span><button type="button" class="cs-btn" id="m-copy">Copy</button><button type="button" class="cs-btn" id="m-newlink">New link</button></span></div>
      <div class="cs-row"><span class="cs-k">Passcode</span><span class="cs-rowact"><span class="cs-v" id="m-code">Hidden until you press Show</span><button type="button" class="cs-btn" id="m-show">Show</button><button type="button" class="cs-btn" id="m-copycode">Copy</button><button type="button" class="cs-btn" id="m-newcode">New</button><button type="button" class="cs-btn" id="m-setcode">Choose</button></span></div>
      ${locked ? `<div class="cs-row"><span class="cs-k">Locked</span><span class="cs-rowact"><span class="cs-v">Too many wrong passcodes</span><button type="button" class="cs-btn" id="m-unlock">Unlock now</button></span></div>` : ""}</div>
      <div class="cs-box"><div class="cs-strip">Shoots in this portal<span>${p.rows.length}</span></div>${p.rows.length ? `<div class="cs-tw"><table class="cs-tbl"><tr><th>Shoot</th><th>Showing</th><th>Email</th><th>Edits</th></tr>${p.rows.map((r) => `<tr><td>${esc(r.title)}</td><td>${chip(r.status, CHIPS[r.status])}</td><td>${esc(r.emailedAt ? "Sent " + fmtD(r.emailedAt) : r.told ? "Sent" : "Not emailed yet")}</td><td>${r.edits ? chip(r.edits, CHIPS[r.edits]) : "-"}</td></tr>`).join("")}</table></div>` : `<div class="cs-pad cs-muted">Nothing in this portal yet.</div>`}</div>
      <div class="cs-btns"><button type="button" class="cs-btn" id="m-msg">Copy the message to send</button><button type="button" class="cs-btn" id="m-del">Delete portal</button></div>`,
    foot: `<button type="button" class="cs-btn" id="m-onoff">${p.enabled ? "Turn off" : "Turn on"}</button><button type="button" class="cs-btn" id="m-add">Add from Library</button><button type="button" class="cs-btn cs-pri" id="m-view">View as client</button>` });
  // Only ever read when asked for, and never kept on the page's data.
  const passcode = async () => {
    const { data, error } = await supabase.from("client_portals").select("passcode").eq("id", id).single();
    if (error) { toast("Couldn't read the passcode: " + error.message); return ""; }
    return data.passcode;
  };
  $$("[data-set]").forEach((inp) => (inp.onchange = async () => {
    const k = inp.dataset.set, v = inp.value.trim();
    if (k === "name" && !v) { inp.value = p.name; return toast("It needs a name."); }
    if (k === "notify_email") {
      const list = v.split(/[,;\s]+/).map((a) => a.trim().toLowerCase()).filter(Boolean), bad = list.find((a) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a));
      if (bad) return toast(`"${bad}" doesn't look like an email address.`);
      // Folders already in count as told, so this doesn't send one about everything at once.
      const patch = { notify_email: list.length ? list.join(", ") : null };
      if (list.length && !p.notify_email) patch.notified_folders = p.folders;
      return save(id, patch, "Saved.");
    }
    save(id, { [k]: v || null }, "Saved.");
  }));
  $("#m-copy").onclick = () => copy(portalLink(p.token), "Link copied.");
  $("#m-show").onclick = async () => { const c = await passcode(); if (c) { $("#m-code").textContent = c; $("#m-show").disabled = true; } };
  $("#m-copycode").onclick = async () => { const c = await passcode(); if (c) copy(c, "Passcode copied."); };
  $("#m-msg").onclick = async () => { const c = await passcode(); if (c) copy(portalMessage(p.first_name, portalLink(p.token), c), "Message copied. Paste it into your email to them."); };
  $("#m-newlink").onclick = () => confirmPop({ eyebrow: p.name, title: "Make A New Link.", text: `The old link for ${p.name} stops working straight away.`, yes: "Make new link", onYes: () => save(id, { token: newToken() }, "New link made. Send it to them.") });
  $("#m-newcode").onclick = () => confirmPop({ eyebrow: p.name, title: "Make A New Passcode.", text: `Anyone signed in to ${p.name}'s portal is signed out and needs the new one.`, yes: "Make new passcode", onYes: () => save(id, { passcode: newPasscode(), failed_tries: 0, locked_until: null }, "New passcode made. Send it to them.") });
  $("#m-setcode").onclick = () => {
    pop({ eyebrow: p.name, title: "Choose A Passcode.", body: `<input class="cs-in cs-full" id="sc-v" maxlength="12" placeholder="3 to 12 letters or numbers" aria-label="New passcode">`, foot: `<button type="button" class="cs-btn cs-pri" id="sc-go">Save</button>` });
    $("#sc-go").onclick = () => {
      const code = $("#sc-v").value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (code.length < 3 || code.length > 12) return toast("A passcode is 3 to 12 letters or numbers.");
      save(id, { passcode: code, failed_tries: 0, locked_until: null }, "Passcode changed. Anyone signed in needs it again.");
    };
  };
  if ($("#m-unlock")) $("#m-unlock").onclick = () => save(id, { failed_tries: 0, locked_until: null }, "Unlocked.");
  $("#m-onoff").onclick = () => p.enabled
    ? confirmPop({ eyebrow: p.name, title: "Turn This Portal Off.", text: `${p.name}'s link stops working straight away. Turning it back on keeps the same link and passcode.`, yes: "Turn off", onYes: () => save(id, { enabled: false }, "Turned off.") })
    : save(id, { enabled: true }, "Turned back on.");
  $("#m-del").onclick = () => confirmPop({ eyebrow: p.name, title: "Delete This Portal.", text: `${p.name}'s link stops working and this can't be undone. The files stay in the Library.`, yes: "Delete portal", onYes: async () => {
    const { data, error } = await supabase.from("client_portals").delete().eq("id", id).select();
    if (error || !data || data.length !== 1) return toast("Not deleted: " + (error ? error.message : "the database didn't confirm it."));
    closePop(); await reload(); toast(`Deleted ${p.name}'s portal.`);
  } });
  $("#m-add").onclick = () => addFromLibrary(p);
  $("#m-view").onclick = () => viewAsClient(p);
}

function addFromLibrary(p) {
  const ticked = new Set(p.folders);
  pop({ eyebrow: p.name, title: "Add From Library.", body: `<input class="cs-in cs-full" id="af-q" type="search" placeholder="Search the Library" aria-label="Search the Library"><div class="cs-box" id="af-list"></div>`, foot: `<button type="button" class="cs-btn cs-pri" id="af-go">Save</button>` });
  const named = p.name.toLowerCase();
  const paint = () => {
    const q = $("#af-q").value.toLowerCase();
    const list = allFolders().filter((f) => (f.title + f.name).toLowerCase().includes(q)).sort((a, b) => (ticked.has(b.prefix) - ticked.has(a.prefix)) || (f2(b, named) - f2(a, named)) || String(b.date).localeCompare(String(a.date)));
    $("#af-list").innerHTML = list.slice(0, 200).map((f) => `<label class="cs-pick"><input type="checkbox" value="${esc(f.prefix)}"${ticked.has(f.prefix) ? " checked" : ""}><span>${esc(f.title)}</span><span class="cs-grow"></span><span class="cs-muted">${esc(f.type || "Folder")}, ${esc(fmtD(f.date))}</span></label>`).join("") || `<div class="cs-pad cs-muted">No folder matches that.</div>`;
    $$("#af-list input").forEach((b) => (b.onchange = () => (b.checked ? ticked.add(b.value) : ticked.delete(b.value))));
  };
  $("#af-q").oninput = paint;
  paint();
  $("#af-go").onclick = async () => {
    const folders = [...ticked].filter((f) => f.startsWith(ROOT));
    if (await save(p.id, { folders }, "Saved.")) { await refreshLibrary(); manage(p.id); }
  };
}
const f2 = (f, named) => (named && f.name.toLowerCase().includes(named) ? 1 : 0);
