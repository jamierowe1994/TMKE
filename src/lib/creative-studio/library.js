// The Library tab: every shoot as a card, by type and by month, and inside a
// folder the files, landscape first and then portrait (Dani, 8 Nov 2026).
import { downloadZip } from "client-zip";
import { supabase } from "../supabase.js";
import { makeThumb, putThumb, thumbKeyFor, isBlackPicture } from "../thumbs.js";
import { $, $$, esc, api, token, toast, pop, closePop, confirmPop, chip, rowsOf, fmtD, fmtSize, cleanName, isFilm, isPhoto, isEditable, saveFile, hooks, WORKER, ROOT, MONTHS } from "./common.js";

const TYPES = ["Event coverage", "Content Studio", "Property shoots", "New starter", "Agent shoots", "Our own"];
const L = { folders: null, error: "", filter: "all", when: "all", q: "", open: null, kind: "all", sel: new Set() };
const shapes = new Map();
const host = () => $("#cs-v-library");
const dateOf = (f) => f.date || new Date().toISOString().slice(0, 10);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ---------- Months: the last six on their own, then whole years ---------- */
const parts = (s) => { const [y, m] = s.split("-").map(Number); return { y, m: m - 1 }; };
function cutoff() { const t = new Date(); return new Date(t.getFullYear(), t.getMonth() - 5, 1); }
function periodOf(s) {
  const { y, m } = parts(s), c = cutoff();
  return new Date(y, m, 1) >= c ? `${y}-${m}` : String(y);
}
function periods() {
  const t = new Date(), c = cutoff(), used = new Set(L.folders.map((f) => periodOf(dateOf(f)))), out = [];
  // A month with no shoots in it is left out (Dani, 8 Nov).
  for (let i = 0; i < 6; i++) {
    const d = new Date(t.getFullYear(), t.getMonth() - i, 1), k = `${d.getFullYear()}-${d.getMonth()}`;
    if (used.has(k)) out.push({ k, short: MONTHS[d.getMonth()].slice(0, 3), label: MONTHS[d.getMonth()] });
  }
  [...used].filter((k) => !k.includes("-")).sort().reverse().forEach((y) => {
    const part = +y === c.getFullYear() && c.getMonth() > 0;
    out.push({ k: y, short: y, label: part ? `${y}, January to ${MONTHS[c.getMonth() - 1]}` : y });
  });
  return out;
}

/* ---------- Every folder ---------- */
export async function loadFolders() {
  try { L.folders = (await api("/creative/library")).folders || []; L.error = ""; }
  catch (e) { L.error = e.message; }
}
export const allFolders = () => L.folders || [];

export async function startLibrary(start) {
  host().innerHTML = loadingLine("Opening the Library…");
  await loadFolders();
  if (start) {
    const name = (start.startsWith(ROOT) ? start.slice(ROOT.length) : start).split("/")[0];
    return openFolder(`${ROOT}${name}/`);
  }
  drawLibrary();
}
const loadingLine = (t) => `<div class="cs-loading"><span class="cs-spin"></span><span id="cs-load-t">${esc(t)}</span></div>`;

function folderCard(f) {
  const pic = f.cover ? `<img src="${esc(f.cover)}" alt="" loading="lazy">` : `<span class="cs-nocover"></span>`;
  return `<button type="button" class="cs-folder" data-prefix="${esc(f.prefix)}">${pic}<span class="cs-fb"><span class="cs-t19">${esc(f.title)}</span><span class="cs-fl"><span class="cs-muted">${esc(f.type || f.service || "Folder")}</span><span class="cs-muted">${esc(fmtD(dateOf(f)))}</span></span><span class="cs-fl"><span>${plural(f.photos, "photo")}, ${plural(f.films, "film")}</span>${f.portals.length ? chip("In a portal", "t") : chip("Not in a portal")}</span></span></button>`;
}

export function drawLibrary() {
  const v = host();
  if (L.open) return drawFolder();
  if (L.error) { v.innerHTML = `<p>Couldn't open the Library: ${esc(L.error)}</p>`; return; }
  if (!L.folders) return;
  const cur = document.activeElement && document.activeElement.id === "cs-lib-q";
  const when = periods(), q = L.q.toLowerCase();
  const list = L.folders.filter((f) => (L.filter === "all" || f.type === L.filter) && (L.when === "all" || periodOf(dateOf(f)) === L.when) && (f.title + f.service + f.name + f.type).toLowerCase().includes(q)).sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
  const groups = when.map((p) => ({ p, items: list.filter((f) => periodOf(dateOf(f)) === p.k) })).filter((g) => g.items.length);
  const seg = (id, items, on) => `<div class="cs-seg" id="${id}">${items.map(([k, t]) => `<button type="button" data-k="${esc(k)}" class="${on === k ? "on" : ""}">${esc(t)}</button>`).join("")}</div>`;
  v.innerHTML = `<div class="cs-libbars">${seg("cs-lib-seg", [["all", "All"], ...TYPES.map((t) => [t, t])], L.filter)}<div class="cs-r"><button type="button" class="cs-btn" id="cs-new">New folder</button><button type="button" class="cs-btn cs-pri" id="cs-up">Upload</button></div>
  ${seg("cs-lib-when", [["all", "All dates"], ...when.map((p) => [p.k, p.short])], L.when)}<div class="cs-r"><input class="cs-in" id="cs-lib-q" type="search" placeholder="Search every folder" aria-label="Search every folder" value="${esc(L.q)}"></div></div>
  ${groups.map((g) => `<section class="cs-period"><div class="cs-strip">${esc(g.p.label)}<span>${plural(g.items.length, "folder")}</span></div><div class="cs-folders">${g.items.map(folderCard).join("")}</div></section>`).join("") || `<p class="cs-muted">Nothing matches that.</p>`}`;
  $$("#cs-lib-seg button").forEach((b) => (b.onclick = () => { L.filter = b.dataset.k; drawLibrary(); }));
  $$("#cs-lib-when button").forEach((b) => (b.onclick = () => { L.when = b.dataset.k; drawLibrary(); }));
  const q2 = $("#cs-lib-q"); q2.oninput = () => { L.q = q2.value; drawLibrary(); };
  if (cur) { q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); }
  $$(".cs-folder", v).forEach((b) => (b.onclick = () => openFolder(b.dataset.prefix)));
  $("#cs-new").onclick = () => newFolder(ROOT);
  $("#cs-up").onclick = chooseFolderToUpload;
}

/* ---------- One folder ---------- */
function setQuery(prefix) {
  const u = new URL(location.href);
  if (prefix) u.searchParams.set("folder", prefix.slice(ROOT.length, -1)); else u.searchParams.delete("folder");
  history.replaceState(null, "", u);
}
function shapeOf(f) {
  if (shapes.has(f.key)) return Promise.resolve();
  if (!f.thumbUrl) { shapes.set(f.key, "l"); return Promise.resolve(); }
  return new Promise((resolve) => {
    const img = new Image();
    const done = (s) => { clearTimeout(stop); shapes.set(f.key, s); resolve(); };
    const stop = setTimeout(() => done("l"), /size=thumb/.test(f.thumbUrl) ? 20000 : 8000);
    // Allowed to read a film's picture, so a black one can be spotted and remade.
    if (isFilm(f)) img.crossOrigin = "anonymous";
    img.onload = () => { if (isFilm(f) && isBlackPicture(img)) f.blackThumb = true; done(img.naturalHeight > img.naturalWidth ? "p" : "l"); };
    img.onerror = () => done("l");
    img.src = f.thumbUrl;
  });
}
export async function openFolder(prefix, keepKind) {
  L.open = { prefix, loading: true }; L.sel.clear(); if (!keepKind) L.kind = "all";
  setQuery(prefix);
  host().innerHTML = loadingLine("Opening the folder…");
  let data;
  try { data = await api(`/creative/folder?prefix=${encodeURIComponent(prefix)}`); }
  catch (e) { host().innerHTML = `<p>Couldn't open that folder: ${esc(e.message)}</p><p style="margin-top:12px"><button type="button" class="cs-btn" id="cs-back">Back to the Library</button></p>`; $("#cs-back").onclick = backToLibrary; return; }
  if (!L.open || L.open.prefix !== prefix) return;
  // The grid waits until every picture's shape is known, so nothing jumps.
  let n = 0;
  const queue = data.files.slice(), say = () => { const t = $("#cs-load-t"); if (t) t.textContent = `Loading ${n} of ${data.files.length}…`; };
  say();
  await Promise.all(Array.from({ length: Math.min(8, queue.length) }, async () => { while (queue.length) { await shapeOf(queue.shift()); n += 1; say(); } }));
  if (!L.open || L.open.prefix !== prefix) return;
  L.open = { prefix, files: data.files, parts: data.parts, meta: allFolders().find((f) => f.prefix === prefix) };
  drawFolder();
}
function backToLibrary() { L.open = null; L.sel.clear(); setQuery(""); drawLibrary(); }
const uploadTarget = () => {
  const o = L.open, used = o.parts.filter((p) => p !== "" || o.files.some((f) => f.part === ""));
  return used.length === 1 && used[0] ? `${o.prefix}${used[0]}/` : o.prefix;
};
function drawFolder() {
  const v = host(), o = L.open;
  if (!o || o.loading) return;
  const title = (o.meta && o.meta.title) || o.prefix.slice(ROOT.length, -1);
  const inPortals = (o.meta && o.meta.portals) || [];
  const match = (f) => L.kind === "all" || (L.kind === "photo" ? isPhoto(f) : isFilm(f));
  const tile = (f) => `<div class="cs-file${L.sel.has(f.key) ? " sel" : ""}" data-key="${esc(f.key)}">${f.thumbUrl ? `<img src="${esc(f.thumbUrl)}" alt="" loading="lazy">` : ""}<button type="button" class="cs-tk" data-t="${esc(f.key)}" aria-label="Select ${esc(cleanName(f.name))}" aria-pressed="${L.sel.has(f.key)}"></button>${isFilm(f) ? `<span class="cs-kind">${chip("Film", "w")}</span>` : ""}</div>`;
  const shown = o.parts.map((p) => ({ p, files: o.files.filter((f) => f.part === p && match(f)) })).filter((s) => s.files.length || (s.p && !o.files.some((f) => f.part === s.p)));
  const strips = shown.length > 1;
  const section = (s) => {
    const land = s.files.filter((f) => shapes.get(f.key) !== "p"), port = s.files.filter((f) => shapes.get(f.key) === "p");
    return `<section class="cs-part" data-part="${esc(s.p)}">${strips ? `<div class="cs-strip">${esc(s.p || "Main")}<span>${plural(s.files.length, "file")}<button type="button" data-upin="${esc(s.p)}">Upload here</button></span></div>` : ""}${land.length ? `<div class="cs-files">${land.map(tile).join("")}</div>` : ""}${port.length ? `<div class="cs-files pt">${port.map(tile).join("")}</div>` : ""}</section>`;
  };
  v.innerHTML = `<div class="cs-bar"><div class="cs-crumbs"><button type="button" id="cs-back">Library</button><span class="cs-muted">/</span><span>${esc(title)}</span></div><span class="cs-grow"></span>${inPortals.length ? chip("In " + inPortals.join(", ")) : chip("Not in a portal")}<button type="button" class="cs-btn" id="cs-toportal">Add to portal</button><button type="button" class="cs-btn" id="cs-new">New folder</button><button type="button" class="cs-btn cs-pri" id="cs-up">Upload</button></div>
  <div class="cs-bar" style="margin-bottom:12px"><div class="cs-seg" id="cs-kind">${[["all", "All"], ["photo", "Photos"], ["film", "Films"]].map(([k, t]) => `<button type="button" data-k="${k}" class="${L.kind === k ? "on" : ""}">${t}</button>`).join("")}</div><span class="cs-muted" id="cs-count"></span><span class="cs-grow"></span><span id="cs-acts" class="cs-btns"></span></div>
  <div class="cs-drop" id="cs-drop">${shown.map(section).join("") || `<p class="cs-muted">This folder is empty. Drag files in, or use Upload.</p>`}</div><div id="cs-uploads"></div>`;
  $("#cs-back").onclick = backToLibrary;
  $$("#cs-kind button").forEach((b) => (b.onclick = () => { L.kind = b.dataset.k; drawFolder(); }));
  $$(".cs-file", v).forEach((el) => (el.onclick = () => openFile(o.files.find((f) => f.key === el.dataset.key))));
  $$(".cs-tk", v).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const k = b.dataset.t; L.sel.has(k) ? L.sel.delete(k) : L.sel.add(k); b.parentElement.classList.toggle("sel", L.sel.has(k)); b.setAttribute("aria-pressed", L.sel.has(k)); drawActs(); }));
  $$("[data-upin]", v).forEach((b) => (b.onclick = () => pickFiles(b.dataset.upin ? `${o.prefix}${b.dataset.upin}/` : o.prefix)));
  $("#cs-toportal").onclick = () => addToPortal();
  $("#cs-new").onclick = () => newFolder(o.prefix);
  $("#cs-up").onclick = () => pickFiles(uploadTarget());
  const drop = $("#cs-drop");
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  drop.addEventListener("dragleave", (e) => { e.preventDefault(); drop.classList.remove("over"); });
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); const sec = e.target.closest("[data-part]"); sendAll(e.dataTransfer.files, sec && sec.dataset.part ? `${o.prefix}${sec.dataset.part}/` : uploadTarget()); });
  drawActs();
}
const needsThumb = (f) => (isFilm(f) && !f.hasThumb) || f.blackThumb;
function drawActs() {
  const o = L.open, picked = o.files.filter((f) => L.sel.has(f.key)), ph = picked.filter(isEditable), todo = o.files.filter(needsThumb);
  const visible = o.files.filter((f) => L.kind === "all" || (L.kind === "photo" ? isPhoto(f) : isFilm(f)));
  $("#cs-count").textContent = picked.length ? `${picked.length} selected` : "Tick files to act on them";
  $("#cs-acts").innerHTML = `${todo.length ? `<button type="button" class="cs-btn" id="a-th">Make ${plural(todo.length, "thumbnail")}</button>` : ""}<button type="button" class="cs-btn" id="a-all">${picked.length === visible.length && picked.length ? "Clear" : "Select all"}</button><button type="button" class="cs-btn" id="a-dl" ${picked.length ? "" : "disabled"}>Download</button><button type="button" class="cs-btn" id="a-ed" ${ph.length ? "" : "disabled"}>Edit photos</button><button type="button" class="cs-btn" id="a-del" ${picked.length ? "" : "disabled"}>Delete</button>`;
  $("#a-all").onclick = () => { if (picked.length === visible.length) L.sel.clear(); else visible.forEach((f) => L.sel.add(f.key)); drawFolder(); };
  $("#a-dl").onclick = () => downloadFiles(picked);
  $("#a-ed").onclick = () => hooks.editPhotos(ph, folderInfo());
  $("#a-del").onclick = () => deleteFiles(picked);
  if ($("#a-th")) $("#a-th").onclick = () => makeThumbs(todo);
}
const folderInfo = () => ({ prefix: L.open.prefix, title: (L.open.meta && L.open.meta.title) || L.open.prefix.slice(ROOT.length, -1) });

function openFile(f) {
  const film = isFilm(f), o = L.open, name = cleanName(f.name), title = folderInfo().title;
  const media = film ? `<video controls playsinline src="${esc(f.url)}" style="display:block;max-height:46vh;max-width:100%;margin:0 auto"></video>`
    : isPhoto(f) ? `<img src="${esc(f.previewUrl || f.url)}" alt="" style="display:block;max-height:46vh;max-width:100%;margin:0 auto">` : "";
  pop({ eyebrow: "Library · " + title, title: name, chipHtml: chip(film ? "Film" : isPhoto(f) ? "Photo" : "File"),
    body: `${media}<div class="cs-box"><div class="cs-strip">Details</div>${rowsOf([["Folder", title], ["Size", fmtSize(f.size)], ["Added", fmtD(f.uploaded)], ["In a portal", (o.meta && o.meta.portals.join(", ")) || "No"]])}</div>`,
    foot: `<button type="button" class="cs-btn" id="f-del">Delete</button><a class="cs-btn" href="${esc(f.downloadUrl)}" download="${esc(name)}">Download</a><button type="button" class="cs-btn" id="f-pt">Add to portal</button>${isEditable(f) ? `<button type="button" class="cs-btn cs-pri" id="f-go">Edit photo</button>` : ""}` });
  $("#f-pt").onclick = () => addToPortal();
  $("#f-del").onclick = () => deleteFiles([f]);
  if ($("#f-go")) $("#f-go").onclick = () => { closePop(); hooks.editPhotos([f], folderInfo()); };
}

/* ---------- Doing things to files ---------- */
async function downloadFiles(list) {
  if (list.length === 1) { const a = document.createElement("a"); a.href = list[0].downloadUrl; a.download = cleanName(list[0].name); document.body.appendChild(a); a.click(); a.remove(); return; }
  toast(`Preparing ${list.length} files…`);
  try {
    const input = list.map(async (f) => ({ name: cleanName(f.name), input: await fetch(f.url + "&zip=1") }));
    const blob = await downloadZip(await Promise.all(input)).blob();
    saveFile(blob, `${folderInfo().title}.zip`);
    toast(`${list.length} files downloaded.`);
  } catch (e) { toast("Couldn't make the download. Please try again."); }
}
function deleteFiles(list) {
  const one = list.length === 1;
  confirmPop({ eyebrow: "Library · " + folderInfo().title, title: one ? "Delete This File." : `Delete ${list.length} Files.`,
    text: `${one ? `Delete ${cleanName(list[0].name)}?` : `Delete these ${list.length} files?`} This removes the only copy and can't be undone.`, yes: "Delete",
    onYes: async () => {
      let failed = 0;
      for (const f of list) { try { await api(`/object?key=${encodeURIComponent(f.key)}`, { method: "DELETE" }); } catch (_) { failed += 1; } }
      closePop();
      toast(failed ? `${failed} couldn't be deleted. Please try again.` : one ? "Deleted." : `${list.length} files deleted.`);
      await refresh();
    } });
}
async function refresh() {
  const prefix = L.open && L.open.prefix;
  await loadFolders();
  if (prefix) await openFolder(prefix, true); else drawLibrary();
}
export const refreshLibrary = refresh;
async function makeThumbs(todo) {
  let made = 0, failed = 0;
  const say = () => { const b = $("#a-th"); if (b) { b.disabled = true; b.textContent = `Making ${Math.min(made + failed + 1, todo.length)} of ${todo.length}…`; } };
  for (const f of todo) {
    say();
    try {
      const blob = await makeThumb(f.url, f.name, f.contentType);
      if (blob && (await putThumb(WORKER, await token(), thumbKeyFor(f.key), blob))) made += 1; else failed += 1;
    } catch (_) { failed += 1; }
  }
  todo.forEach((f) => shapes.delete(f.key));
  toast(failed ? `${plural(made, "thumbnail")} made. ${failed} couldn't be read.` : `${plural(made, "thumbnail")} made.`);
  await refresh();
}
function newFolder(prefix) {
  pop({ eyebrow: "Library", title: "New Folder.", body: `<input class="cs-in cs-full" id="nf-n" placeholder="Name the folder" aria-label="Name the folder" maxlength="80">`, foot: `<button type="button" class="cs-btn cs-pri" id="nf-go">Make it</button>` });
  $("#nf-n").focus();
  $("#nf-go").onclick = async () => {
    const name = $("#nf-n").value.trim();
    if (!name) return toast("Give the folder a name.");
    try {
      const out = await api("/folder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefix, name }) });
      closePop();
      await loadFolders();
      await openFolder(prefix === ROOT ? out.prefix : prefix, true);
      toast("Folder made.");
    } catch (e) { toast("Couldn't make the folder: " + e.message); }
  };
}
export async function makeFolder(name) {
  return (await api("/folder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefix: ROOT, name }) })).prefix;
}
function chooseFolderToUpload() {
  const list = [...allFolders()].sort((a, b) => a.title.localeCompare(b.title));
  pop({ eyebrow: "Library", title: "Upload To A Folder.", body: `<select class="cs-in cs-full" id="up-f" aria-label="Choose a folder"><option value="">Choose a folder</option>${list.map((f) => `<option value="${esc(f.prefix)}">${esc(f.title)}, ${esc(fmtD(dateOf(f)))}</option>`).join("")}</select>`, foot: `<button type="button" class="cs-btn cs-pri" id="up-go">Choose files</button>` });
  $("#up-go").onclick = () => {
    const to = $("#up-f").value;
    if (!to) return toast("Choose a folder first.");
    closePop();
    pickFiles(to, () => openFolder(to));
  };
}

/* ---------- Add to a portal ---------- */
async function addToPortal() {
  const prefix = L.open.prefix, title = folderInfo().title;
  const { data, error } = await supabase.from("client_portals").select("id,name,enabled,folders").order("name");
  if (error) return toast("Couldn't read the portals: " + error.message);
  const rows = (data || []).filter((p) => p.enabled);
  const inIt = (p) => (p.folders || []).includes(prefix);
  const first = rows.findIndex((p) => !inIt(p));
  pop({ eyebrow: "Library · " + title, title: "Add To A Portal.", body: `<p>The whole folder goes in, and anything added to it later.</p><div class="cs-box"><div class="cs-strip">Choose a portal</div>${rows.map((p, i) => `<label class="cs-pick"><input type="radio" name="tp" value="${esc(p.id)}"${i === first ? " checked" : ""}${inIt(p) ? " disabled" : ""}><span>${esc(p.name)}</span><span class="cs-grow"></span>${inIt(p) ? `<span class="cs-muted">Already in</span>` : ""}</label>`).join("")}</div>`, foot: `<button type="button" class="cs-btn cs-pri" id="tp-go">Add</button>` });
  $("#tp-go").onclick = async () => {
    const r = $("input[name=tp]:checked");
    if (!r) return toast("Choose a portal first.");
    const p = rows.find((x) => x.id === r.value);
    const { data: back, error: err } = await supabase.from("client_portals").update({ folders: [...new Set([...(p.folders || []), prefix])] }).eq("id", p.id).select();
    if (err || !back || back.length !== 1) return toast("Not saved: " + (err ? err.message : "the database didn't confirm it. Try again."));
    closePop();
    await refresh();
    toast(`Added to ${p.name}.`);
  };
}

/* ---------- Uploading ---------- */
const PART = 8 * 1024 * 1024;
let afterPick = null, pickTo = "";
function pickFiles(to, after) { pickTo = to; afterPick = after || null; $("#cs-file").click(); }
$("#cs-file").addEventListener("change", (e) => { sendAll(e.target.files, pickTo, afterPick); e.target.value = ""; });
function uploadRow(name) {
  const box = $("#cs-uploads") || host(), row = document.createElement("div");
  row.className = "cs-up"; row.innerHTML = `<span>${esc(name)}</span><span class="cs-muted" data-s>Preparing…</span>`;
  box.appendChild(row);
  return { stat: (t) => { row.querySelector("[data-s]").textContent = t; } };
}
async function uploadFile(file, into) {
  const ui = uploadRow(file.name), t = await token();
  const jsonHead = { "Content-Type": "application/json", Authorization: "Bearer " + t };
  const create = await fetch(`${WORKER}/create`, { method: "POST", headers: jsonHead, body: JSON.stringify({ prefix: into, fileName: file.name, contentType: file.type || "application/octet-stream" }) });
  if (!create.ok) { ui.stat("Failed to start"); throw new Error("start"); }
  const { key, uploadId } = await create.json();
  const out = [], count = Math.max(1, Math.ceil(file.size / PART));
  try {
    for (let i = 0; i < count; i++) {
      const blob = file.slice(i * PART, Math.min((i + 1) * PART, file.size));
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch(`${WORKER}/part?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${i + 1}`, { method: "PUT", headers: { Authorization: "Bearer " + t }, body: blob });
          if (!res.ok) throw new Error("part");
          out.push({ partNumber: i + 1, etag: (await res.json()).etag });
          break;
        } catch (err) { if (attempt >= 2) throw err; await new Promise((r) => setTimeout(r, 800 * (attempt + 1))); }
      }
      ui.stat(`Uploading ${Math.round(((i + 1) / count) * 100)}%`);
    }
    const fin = await fetch(`${WORKER}/complete`, { method: "POST", headers: jsonHead, body: JSON.stringify({ key, uploadId, parts: out }) });
    if (!fin.ok) throw new Error("finish");
  } catch (err) { ui.stat("Failed. Please try again."); throw err; }
  // Made here from the file in hand, so it costs nothing to fetch.
  try { ui.stat("Making a thumbnail…"); const small = await makeThumb(file, file.name, file.type); if (small) await putThumb(WORKER, t, thumbKeyFor(key), small); } catch (_) { /* a slower tile, nothing worse */ }
  ui.stat(fmtSize(file.size) + ", done");
}
async function sendAll(list, into, after) {
  const files = Array.from(list || []);
  if (!files.length) return;
  const results = await Promise.allSettled(files.map((f) => uploadFile(f, into)));
  const failed = results.filter((r) => r.status === "rejected").length;
  toast(failed ? `${failed} of ${files.length} couldn't be uploaded.` : `${plural(files.length, "file")} uploaded.`);
  await loadFolders();
  if (after) return after();
  if (L.open) openFolder(L.open.prefix, true);
}
