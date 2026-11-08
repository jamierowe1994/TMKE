// Photo editing (Dani, 8 Nov 2026). Our own panel running on the graphics card
// in the browser, so nothing goes to an outside service and nothing costs per
// edit. You work on the 1800px preview so the sliders keep up; saving applies the
// same settings to the full-size original.
import { downloadZip } from "client-zip";
import { makeThumb, putThumb, thumbKeyFor } from "../thumbs.js";
import { $, $$, esc, token, toast, pop, closePop, chip, cleanName, saveFile, hooks, WORKER, ROOT } from "./common.js";
import { allFolders, makeFolder, refreshLibrary, loadFolders } from "./library.js";

const VS = `attribute vec2 a; varying vec2 p; void main(){ p=(a+1.)/2.; p.y=1.-p.y; gl_Position=vec4(a,0.,1.); }`;
const FS = `precision highp float; varying vec2 p; uniform sampler2D t; uniform vec4 crop; uniform float ex,con,hi,sh,sat,warm,tint,fade,mono,flip,ang,asp,zoom; uniform int rot;
vec2 mapUv(vec2 q){ vec2 d=q-.5; d.x*=asp; float c=cos(ang),s=sin(ang); d=vec2(c*d.x-s*d.y,s*d.x+c*d.y)*zoom; d.x/=asp; q=d+.5;
 if(rot==1) q=vec2(q.y,1.-q.x); else if(rot==2) q=vec2(1.-q.x,1.-q.y); else if(rot==3) q=vec2(1.-q.y,q.x);
 if(flip>.5) q.x=1.-q.x; return q; }
void main(){ vec2 q=crop.xy+p*crop.zw; vec3 c=texture2D(t,mapUv(q)).rgb;
 c=pow(c,vec3(2.2)); c*=pow(2.,ex); c.r*=1.+warm*.18; c.b*=1.-warm*.18; c.g*=1.+tint*.1; c=pow(max(c,0.),vec3(1./2.2));
 float l=dot(c,vec3(.2126,.7152,.0722)); c+=hi*smoothstep(.45,1.,l); c+=sh*(1.-smoothstep(0.,.55,l));
 c=(c-.5)*(1.+con)+.5; l=dot(c,vec3(.2126,.7152,.0722)); c=mix(vec3(l),c,(1.+sat)*(1.-mono)); c=c*(1.-fade*.16)+fade*.16;
 gl_FragColor=vec4(clamp(c,0.,1.),1.); }`;

function renderer(canvas) {
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, antialias: false });
  if (!gl) return null;
  const sh = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const u = (n) => gl.getUniformLocation(pr, n);
  return {
    maxSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    image(src) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src); },
    draw(s, w, h, geo) {
      canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h);
      const v = (k) => (s[k] || 0) / 100;
      gl.uniform1f(u("ex"), v("exposure") * 1.5); gl.uniform1f(u("con"), v("contrast") * 0.6); gl.uniform1f(u("hi"), v("highlights") * 0.25); gl.uniform1f(u("sh"), v("shadows") * 0.25);
      gl.uniform1f(u("sat"), v("saturation")); gl.uniform1f(u("warm"), v("warmth")); gl.uniform1f(u("tint"), v("tint")); gl.uniform1f(u("fade"), v("fade")); gl.uniform1f(u("mono"), v("mono"));
      gl.uniform4f(u("crop"), geo.crop.x, geo.crop.y, geo.crop.w, geo.crop.h); gl.uniform1i(u("rot"), geo.rot); gl.uniform1f(u("flip"), geo.flip ? 1 : 0);
      const a = ((geo.ang || 0) * Math.PI) / 180, asp = geo.asp || 1; gl.uniform1f(u("ang"), a); gl.uniform1f(u("asp"), asp);
      gl.uniform1f(u("zoom"), 1 / (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)) * Math.max(asp, 1 / asp)));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    release() { const x = gl.getExtension("WEBGL_lose_context"); if (x) x.loseContext(); },
  };
}

const SLIDERS = [["exposure", "Exposure"], ["contrast", "Contrast"], ["highlights", "Highlights"], ["shadows", "Shadows"], ["saturation", "Saturation"], ["warmth", "Warmth"], ["tint", "Tint"]];
const FILTERS = [["Original", {}], ["Bright", { exposure: 14, contrast: 8, shadows: 18, saturation: 6 }], ["Warm", { warmth: 30, saturation: 8, contrast: 6 }], ["Soft", { contrast: -16, highlights: -14, shadows: 16, saturation: -8, fade: 40 }], ["Film", { contrast: 12, saturation: -16, warmth: 14, fade: 60 }], ["Mono", { mono: 100, contrast: 16 }]];
const RATIOS = [["Original", "orig"], ["Free", 0], ["Square", 1], ["Portrait 4:5", 0.8], ["Story 9:16", 9 / 16], ["Wide 16:9", 16 / 9]];
const newEdit = () => ({ s: {}, filter: "Original", rot: 0, flip: false, ang: 0, ratio: "orig", crop: { x: 0, y: 0, w: 1, h: 1 } });
const PH = { list: [], i: 0, tab: "Adjust", edits: new Map(), r: null, fr: null, small: null, built: false, img: null, before: false, loadN: 0 };
const STORE = "tmke.cs.photo.v1", FIVE_HOURS = 5 * 3600000;

const cur = () => PH.list[PH.i];
const edit = () => { const x = cur(); if (!PH.edits.has(x.key)) PH.edits.set(x.key, newEdit()); return PH.edits.get(x.key); };
const isEdited = (key) => { const e = PH.edits.get(key); if (!e) return false; const c = e.crop; return Object.values(e.s).some(Boolean) || e.rot || e.flip || e.ang || c.w < 1 || c.h < 1; };
const dims = (e, img) => (e.rot % 2 ? [img.h, img.w] : [img.w, img.h]);
const rw = (e) => dims(e, PH.img)[0], rh = (e) => dims(e, PH.img)[1];
const typeOf = (name) => (/\.png$/i.test(name) ? "image/png" : /\.webp$/i.test(name) ? "image/webp" : "image/jpeg");
const copyName = (x) => { const n = cleanName(x.name), at = n.lastIndexOf("."); return `${n.slice(0, at)}-edit${n.slice(at)}`; };

// Unsaved edits survive a reload. The links inside last about six hours.
function remember() {
  try {
    if (!PH.list.length) return localStorage.removeItem(STORE);
    localStorage.setItem(STORE, JSON.stringify({ at: Date.now(), i: PH.i, list: PH.list, edits: [...PH.edits].filter(([k]) => isEdited(k)) }));
  } catch (_) { /* a full browser store only costs the reload safety net */ }
}
function recall() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || "null");
    if (!s || Date.now() - s.at > FIVE_HOURS || !s.list.length) return;
    PH.list = s.list; PH.i = Math.min(s.i, s.list.length - 1); PH.edits = new Map(s.edits);
  } catch (_) { /* nothing to bring back */ }
}

// Through a canvas, so a photo's sideways flag is applied the same way for the
// preview and the original.
function loadPicture(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      resolve({ source: c, w: c.width, h: c.height });
    };
    img.onerror = () => reject(new Error("Couldn't open that photo."));
    img.src = url;
  });
}

export function photoOpen() {
  if (!PH.list.length) recall();
  build();
  if (PH.list.length && !PH.img) { strip(); load(); } else fit();
}
export function editPhotos(files, folder) {
  PH.list = files.map((f) => ({ key: f.key, name: f.name, url: f.url, previewUrl: f.previewUrl || f.url, thumbUrl: f.thumbUrl || "", prefix: f.key.slice(0, f.key.lastIndexOf("/") + 1), folderTitle: folder.title }));
  PH.i = 0; PH.edits = new Map(); PH.img = null;
  build();
  hooks.show("photo");
  strip(); load(); remember();
}
function build() {
  const v = $("#cs-v-photo");
  if (!PH.built) {
    v.innerHTML = `<div class="cs-empty" id="ph-empty"><span class="cs-t19">Choose photos to edit</span><p>Open a folder in the Library, tick the photos, then press Edit photos.</p><button type="button" class="cs-btn cs-pri" id="ph-go">Open the Library</button></div>
    <div class="cs-pgrid" id="ph-app"><div class="cs-pl"><div class="cs-bar" style="margin:0"><span id="ph-name"></span><span class="cs-grow"></span><button type="button" class="cs-btn" id="ph-before">Hold for before</button><button type="button" class="cs-btn" id="ph-reset">Reset</button></div><div class="cs-stage" id="ph-stage"><div class="cs-cw" id="ph-cw"><canvas id="ph-c"></canvas></div></div><div class="cs-sps" id="ph-strip"></div></div>
    <div class="cs-panel"><div class="cs-ptabs" id="ph-tabs">${["Adjust", "Filters", "Crop", "AI edit"].map((t) => `<button type="button" data-t="${t}">${t}</button>`).join("")}</div><div class="cs-pbody" id="ph-body" data-lenis-prevent></div><div class="cs-pfootp"><button type="button" class="cs-btn" id="ph-all">Apply to all photos</button><button type="button" class="cs-btn cs-pri" id="ph-save">Save</button></div></div></div>`;
    PH.r = renderer($("#ph-c"));
    PH.built = true;
    $("#ph-go").onclick = () => hooks.show("library");
    if (!PH.r) { $("#ph-stage").innerHTML = `<p class="cs-muted">This browser can't show the editor.</p>`; return; }
    PH.small = document.createElement("canvas"); PH.fr = renderer(PH.small);
    $$("#ph-tabs button").forEach((b) => (b.onclick = () => { PH.tab = b.dataset.t; panel(); paint(); }));
    const hold = $("#ph-before"), on = () => { PH.before = true; paint(); }, off = () => { if (PH.before) { PH.before = false; paint(); } };
    hold.onpointerdown = on; hold.onpointerup = off; hold.onpointerleave = off;
    $("#ph-reset").onclick = () => { if (!PH.list.length) return; PH.edits.set(cur().key, newEdit()); panel(); paint(); strip(); };
    $("#ph-save").onclick = savePop;
    $("#ph-all").onclick = () => { const e = edit(); PH.list.forEach((x) => { const o = PH.edits.get(x.key) || newEdit(); o.s = { ...e.s }; o.filter = e.filter; PH.edits.set(x.key, o); }); strip(); toast(`Same colours and filter now on all ${PH.list.length} photos. Crops stay as they are.`); };
    const st = $("#ph-strip"); st.onwheel = (w) => { if (w.deltaY && !w.deltaX) { st.scrollLeft += w.deltaY; w.preventDefault(); } };
    addEventListener("resize", () => { if (!v.hidden) fit(); });
  }
  $("#ph-empty").style.display = PH.list.length ? "none" : "flex";
  $("#ph-app").style.display = PH.list.length ? "grid" : "none";
  $("#ph-all").style.display = PH.list.length > 1 ? "" : "none";
}
function strip() {
  $("#ph-strip").innerHTML = PH.list.map((x, i) => `<button type="button" class="cs-sp${i === PH.i ? " on" : ""}" data-i="${i}" aria-label="${esc(cleanName(x.name))}"><img src="${esc(x.thumbUrl || x.previewUrl)}" alt="">${isEdited(x.key) ? chip("Edited", "w") : ""}</button>`).join("");
  $$(".cs-sp").forEach((b) => (b.onclick = () => { PH.i = +b.dataset.i; strip(); load(); }));
  remember();
}
async function load() {
  if (!PH.r || !PH.list.length) return;
  const x = cur(), n = ++PH.loadN;
  $("#ph-name").textContent = `${cleanName(x.name)}, loading…`;
  try {
    const pic = await loadPicture(x.previewUrl);
    if (n !== PH.loadN) return;
    PH.img = pic; PH.r.image(pic.source); PH.fr.image(pic.source);
    $("#ph-name").textContent = cleanName(x.name);
    panel(); paint();
  } catch (e) {
    if (n === PH.loadN) { $("#ph-name").textContent = cleanName(x.name); toast(e.message); }
  }
}
function fit() {
  if (!PH.img || !PH.list.length) return;
  const e = edit(), cropping = PH.tab === "Crop", W = rw(e), H = rh(e), ow = cropping ? W : Math.max(2, W * e.crop.w), oh = cropping ? H : Math.max(2, H * e.crop.h), st = $("#ph-stage"), k = Math.min((st.clientWidth - 24) / ow, (st.clientHeight - 24) / oh, 1.5), cw = $("#ph-cw");
  cw.style.width = Math.round(ow * k) + "px"; cw.style.height = Math.round(oh * k) + "px";
}
function paint() {
  if (!PH.img || !PH.list.length) return;
  const e = edit(), cropping = PH.tab === "Crop", W = rw(e), H = rh(e), full = { x: 0, y: 0, w: 1, h: 1 }, c = cropping ? full : e.crop;
  PH.r.draw(PH.before ? {} : e.s, Math.max(1, Math.round(W * c.w)), Math.max(1, Math.round(H * c.h)), { crop: c, rot: e.rot, flip: e.flip, ang: e.ang, asp: W / H });
  fit(); frame();
}
function frame() {
  const cw = $("#ph-cw"); $$(".cs-cf", cw).forEach((x) => x.remove());
  if (PH.tab !== "Crop") return;
  const e = edit(), c = e.crop, f = document.createElement("div"); f.className = "cs-cf";
  f.style.cssText = `left:${c.x * 100}%;top:${c.y * 100}%;width:${c.w * 100}%;height:${c.h * 100}%`;
  [["tl", "l", "t"], ["tr", "r", "t"], ["bl", "l", "b"], ["br", "r", "b"]].forEach(([k, x, y]) => { const h = document.createElement("div"); h.className = "cs-ch"; h.dataset.k = k; h.style[x === "r" ? "right" : "left"] = "-7px"; h.style[y === "b" ? "bottom" : "top"] = "-7px"; f.appendChild(h); });
  cw.appendChild(f);
  f.onpointerdown = (ev) => {
    ev.preventDefault(); f.setPointerCapture(ev.pointerId);
    const box = cw.getBoundingClientRect(), k = ev.target.dataset.k, s = { ...c }, px = ev.clientX, py = ev.clientY, r = ratioOf(e), nr = r ? (r * rh(e)) / rw(e) : 0;
    f.onpointermove = (m) => {
      const dx = (m.clientX - px) / box.width, dy = (m.clientY - py) / box.height;
      if (!k) { c.x = Math.min(1 - s.w, Math.max(0, s.x + dx)); c.y = Math.min(1 - s.h, Math.max(0, s.y + dy)); }
      else {
        const ax = k[1] === "l" ? s.x + s.w : s.x, ay = k[0] === "t" ? s.y + s.h : s.y, mx = Math.min(1, Math.max(0, (k[1] === "l" ? s.x : s.x + s.w) + dx)), my = Math.min(1, Math.max(0, (k[0] === "t" ? s.y : s.y + s.h) + dy));
        let w = Math.max(0.08, Math.abs(mx - ax)), h = Math.max(0.08, Math.abs(my - ay));
        if (nr) { h = w / nr; const maxW = k[1] === "l" ? ax : 1 - ax, maxH = k[0] === "t" ? ay : 1 - ay; if (w > maxW) { w = maxW; h = w / nr; } if (h > maxH) { h = maxH; w = h * nr; } }
        c.w = w; c.h = h; c.x = k[1] === "l" ? ax - w : ax; c.y = k[0] === "t" ? ay - h : ay;
      }
      f.style.left = c.x * 100 + "%"; f.style.top = c.y * 100 + "%"; f.style.width = c.w * 100 + "%"; f.style.height = c.h * 100 + "%";
    };
    f.onpointerup = () => { f.onpointermove = null; strip(); };
  };
}
function ratioOf(e) { return e.ratio === "orig" ? rw(e) / rh(e) : e.ratio; }
function setRatio(e, value) {
  e.ratio = value;
  const r = ratioOf(e), W = rw(e), H = rh(e);
  if (!r) { e.crop = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 }; return; }
  let w = 1, h = 1; if (W / H > r) w = (H * r) / W; else h = W / r / H;
  e.crop = { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}
function panel() {
  if (!PH.img) return;
  const e = edit(), b = $("#ph-body");
  $$("#ph-tabs button").forEach((x) => x.classList.toggle("on", x.dataset.t === PH.tab));
  if (PH.tab === "Adjust") {
    b.innerHTML = SLIDERS.map(([k, t]) => `<div class="cs-sl"><label for="s-${k}"><span>${t}</span><span id="o-${k}">${e.s[k] || 0}</span></label><input type="range" id="s-${k}" min="-100" max="100" value="${e.s[k] || 0}"></div>`).join("") + `<p class="cs-muted">Double-click a slider to put it back to zero.</p>`;
    SLIDERS.forEach(([k]) => { const r = $("#s-" + k); r.oninput = () => { e.s[k] = +r.value; $("#o-" + k).textContent = r.value; paint(); }; r.onchange = strip; r.ondblclick = () => { e.s[k] = 0; r.value = 0; $("#o-" + k).textContent = 0; paint(); strip(); }; });
  } else if (PH.tab === "Filters") {
    b.innerHTML = `<div class="cs-filt">${FILTERS.map(([n]) => `<button type="button" data-f="${n}" class="${e.filter === n ? "on" : ""}"><canvas data-c="${n}" width="150" height="150"></canvas><span>${n}</span></button>`).join("")}</div><p class="cs-muted">A filter sets the sliders on Adjust, so you can fine-tune it from there.</p>`;
    const src = PH.small, W = PH.img.w, H = PH.img.h, m = 180 / Math.max(W, H);
    FILTERS.forEach(([n, s]) => { PH.fr.draw(s, Math.round(W * m), Math.round(H * m), { crop: { x: 0, y: 0, w: 1, h: 1 }, rot: 0, flip: false, ang: 0, asp: W / H }); const c = $(`canvas[data-c="${n}"]`), x = c.getContext("2d"), side = Math.min(src.width, src.height); x.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, 150, 150); });
    $$("[data-f]", b).forEach((x) => (x.onclick = () => { e.filter = x.dataset.f; e.s = { ...FILTERS.find((f) => f[0] === e.filter)[1] }; panel(); paint(); strip(); }));
  } else if (PH.tab === "Crop") {
    b.innerHTML = `<div><div style="margin-bottom:6px">Shape</div><div class="cs-btns">${RATIOS.map(([t, v]) => `<button type="button" class="cs-btn${e.ratio === v ? " cs-pri" : ""}" data-r="${v}">${t}</button>`).join("")}</div></div><div><div style="margin-bottom:6px">Turn</div><div class="cs-btns"><button type="button" class="cs-btn" id="r-l">Rotate left</button><button type="button" class="cs-btn" id="r-r">Rotate right</button><button type="button" class="cs-btn" id="r-f">Flip</button></div></div><div class="cs-sl"><label for="r-a"><span>Straighten</span><span id="r-o">${e.ang}°</span></label><input type="range" id="r-a" min="-15" max="15" step=".1" value="${e.ang}"></div><p class="cs-muted">Drag the frame to move it, or a corner to resize it. The crop applies when you leave this tab.</p>`;
    $$("[data-r]", b).forEach((x) => (x.onclick = () => { const v = x.dataset.r === "orig" ? "orig" : +x.dataset.r; setRatio(e, v); panel(); paint(); strip(); }));
    const turn = (d) => { e.rot = (e.rot + d + 4) % 4; setRatio(e, e.ratio === 0 ? "orig" : e.ratio); panel(); paint(); strip(); };
    $("#r-l").onclick = () => turn(3); $("#r-r").onclick = () => turn(1);
    $("#r-f").onclick = () => { e.flip = !e.flip; paint(); strip(); };
    const a = $("#r-a"); a.oninput = () => { e.ang = +a.value; $("#r-o").textContent = e.ang + "°"; paint(); }; a.onchange = strip;
  } else {
    b.innerHTML = `<div>${chip("Coming soon", "s")}</div><p class="cs-muted">For things sliders can't do, like removing something from a shot or a faux twilight.</p>`;
  }
}

/* ---------- Saving ---------- */
// The same settings, on the full-size original.
async function renderFull(x) {
  const e = PH.edits.get(x.key) || newEdit();
  // &cors= keeps this apart from any copy the browser kept without permission to read it.
  const pic = await loadPicture(x.url + "&cors=1");
  const canvas = document.createElement("canvas"), r = renderer(canvas);
  if (!r) throw new Error("This browser can't save edits.");
  try {
    if (Math.max(pic.w, pic.h) > r.maxSize) throw new Error(`${cleanName(x.name)} is too large for this computer to edit.`);
    r.image(pic.source);
    const [W, H] = dims(e, pic), c = e.crop;
    r.draw(e.s, Math.max(1, Math.round(W * c.w)), Math.max(1, Math.round(H * c.h)), { crop: c, rot: e.rot, flip: e.flip, ang: e.ang, asp: W / H });
    const type = typeOf(x.name);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.95));
    if (!blob) throw new Error(`Couldn't finish ${cleanName(x.name)}.`);
    return { blob, type };
  } finally { r.release(); }
}
async function putPhoto(query, blob, type, thumbName) {
  const t = await token();
  const res = await fetch(`${WORKER}/creative/save?${query}`, { method: "PUT", headers: { Authorization: "Bearer " + t, "Content-Type": type }, body: blob });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || "Storage didn't take that photo.");
  try { const small = await makeThumb(blob, thumbName, type); if (small) await putThumb(WORKER, t, thumbKeyFor(out.key), small); } catch (_) { /* it gets made when it's first asked for */ }
  return out;
}
function savePop() {
  const x = cur();
  if (!PH.img) return;
  const e = edit(), W = rw(e), H = rh(e), c = e.crop;
  PH.r.draw(e.s, Math.max(1, Math.round(W * c.w)), Math.max(1, Math.round(H * c.h)), { crop: c, rot: e.rot, flip: e.flip, ang: e.ang, asp: W / H });
  const preview = $("#ph-c").toDataURL("image/jpeg", 0.85);
  paint();
  const edited = PH.list.filter((p) => isEdited(p.key)), done = edited.length;
  const OPTS = [
    ["dl", "Download a copy", "To this computer. The Library stays as it is."],
    ["over", "Save", `Replaces the photo in ${x.folderTitle}, and anywhere it's showing in a portal. This can't be undone.`],
    ["same", "Save a copy in this folder", "Keeps the original and adds the edited copy beside it."],
    ["other", "Save a copy in another folder", "Keeps the original and adds the edited copy to a folder you choose."],
  ];
  const WORD = { dl: "Download", over: "Replace photo", same: "Save copy", other: "Save copy" };
  const top = x.prefix.split("/").slice(0, 2).join("/") + "/";
  pop({ eyebrow: "Photo editing · " + x.folderTitle, title: "Save This Photo.",
    body: `<img src="${preview}" alt="" style="display:block;max-height:24vh;max-width:100%;margin:0 auto">${done > 1 ? `<div class="cs-bar" style="margin:0"><span>Which photos</span><div class="cs-seg" id="sv-scope"><button type="button" data-k="one" class="on">This photo</button><button type="button" data-k="all">All ${done} edited</button></div></div>` : ""}
    <div class="cs-box"><div class="cs-strip">How to save it</div>${OPTS.map(([k, t, d], i) => `<label class="cs-pick two"><input type="radio" name="sv" value="${k}"${i ? "" : " checked"}><span>${t}<br><span class="cs-muted">${esc(d)}</span></span></label>`).join("")}<div class="cs-pad" id="sv-where" style="display:none;border-top:1px solid var(--li)"><select class="cs-in cs-full" id="sv-f" aria-label="Choose a folder"><option value="">Choose a folder</option><option value="__new">New folder</option>${[...allFolders()].filter((f) => f.prefix !== top).sort((a, b) => a.title.localeCompare(b.title)).map((f) => `<option value="${esc(f.prefix)}">${esc(f.title)}</option>`).join("")}</select><input class="cs-in cs-full" id="sv-new" style="display:none" placeholder="Name the new folder" aria-label="Name the new folder" maxlength="80"></div></div>`,
    foot: `<span class="cs-muted" id="sv-say" style="margin-right:auto;align-self:center"></span><button type="button" class="cs-btn cs-pri" id="sv-go">Download</button>` });
  let many = false;
  const go = $("#sv-go"), where = $("#sv-where"), sel = $("#sv-f"), nn = $("#sv-new"), say = $("#sv-say");
  $$("input[name=sv]").forEach((r) => (r.onchange = () => { go.textContent = WORD[r.value]; where.style.display = r.value === "other" ? "flex" : "none"; if (r.value === "other") where.scrollIntoView({ block: "nearest" }); }));
  sel.onchange = () => (nn.style.display = sel.value === "__new" ? "block" : "none");
  $$("#sv-scope button").forEach((b) => (b.onclick = () => { many = b.dataset.k === "all"; $$("#sv-scope button").forEach((o) => o.classList.toggle("on", o === b)); }));
  go.onclick = async () => {
    const how = $("input[name=sv]:checked").value, list = many ? edited : [x];
    if (how === "other" && !sel.value) return toast("Choose a folder first.");
    if (how === "other" && sel.value === "__new" && !nn.value.trim()) return toast("Give the new folder a name.");
    go.disabled = true;
    const ok = [], ready = [];
    let target = "", targetName = "", failure = "";
    try {
      if (how === "other") {
        if (sel.value === "__new") { targetName = nn.value.trim(); target = await makeFolder(targetName); }
        else { target = sel.value; targetName = sel.options[sel.selectedIndex].text; }
      }
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        say.textContent = list.length > 1 ? `Working on ${i + 1} of ${list.length}…` : "Working on the full-size photo…";
        const { blob, type } = await renderFull(p);
        if (how === "dl") ready.push({ name: copyName(p), blob });
        else if (how === "over") {
          const out = await putPhoto(`key=${encodeURIComponent(p.key)}`, blob, type, cleanName(p.name));
          Object.assign(p, { url: out.url, previewUrl: out.previewUrl || out.url, thumbUrl: out.thumbUrl || "" });
          PH.edits.set(p.key, newEdit());
        } else {
          const into = how === "same" ? p.prefix : target;
          await putPhoto(`prefix=${encodeURIComponent(into)}&name=${encodeURIComponent(copyName(p))}`, blob, type, copyName(p));
        }
        ok.push(p);
      }
    } catch (err) { failure = err.message || "Something went wrong."; }
    if (how === "dl" && ready.length) {
      if (ready.length === 1) saveFile(ready[0].blob, ready[0].name);
      else saveFile(await downloadZip(ready.map((f) => ({ name: f.name, input: f.blob }))).blob(), `${x.folderTitle}.zip`);
    }
    if (failure && !ok.length) { go.disabled = false; say.textContent = failure; return; }
    closePop();
    const n = ok.length, whereTo = how === "same" ? x.folderTitle : targetName;
    const done2 = how === "dl" ? (n > 1 ? `${n} edited photos downloaded.` : `Downloaded ${copyName(x)}.`)
      : how === "over" ? (n > 1 ? `${n} photos replaced.` : `Saved. ${cleanName(x.name)} has been replaced.`)
      : n > 1 ? `${n} copies saved to ${whereTo}.` : `${copyName(x)} saved to ${whereTo}.`;
    toast(failure ? `${done2} ${failure}` : done2);
    if (how === "over") { strip(); load(); }
    if (how !== "dl") { await loadFolders(); hooks.drawLibrary(); }
  };
}
