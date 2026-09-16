// Eight hub screenshots for the "Getting around your hub" course, each framed
// the same way: captured from the running hub, then set inside a browser window
// on the brand's wine, at the 16:10 the lesson slide expects.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
const PORT = 9461, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.argv[2] || new URL("../public/images/learn/hub/", import.meta.url).pathname;
const prof = mkdtempSync(tmpdir() + "/tmke-make-");
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, "--window-size=1600,1000", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
let tgt; for (let t = 0; t < 150 && !tgt; t++) { try { tgt = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((x) => x.type === "page"); } catch (_) {} if (!tgt) await sleep(300); }
const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true })).result?.result?.value;
await send("Page.enable"); await send("Runtime.enable");

// Anything that sits over the page and isn't part of it: the cookie banner, the
// first-visit nudge, the chat bubble. Hidden, not clicked, so nothing is stored.
const CLEAN = `(() => {
  const gone = [];
  // Anything laid over the page rather than part of it: the cookie bar, the
  // first-visit nudge, a chat bubble. Position alone isn't enough - the nudge is
  // absolute, not fixed - so it goes by what it says as well.
  document.querySelectorAll("body *").forEach((el) => {
    const cs = getComputedStyle(el);
    const floating = cs.position === "fixed" || cs.position === "sticky" || cs.position === "absolute";
    if (!floating) return;
    const t = (el.innerText || "").trim().toLowerCase();
    if (!t || el.offsetHeight > 400) return;
    if (/cookie|non-essential|new here|hop into studio|install app/.test(t)) { el.style.display = "none"; gone.push(t.slice(0, 40)); }
  });
  return gone.length;
})()`;

const PAGES = [
  ["dashboard", "/account", 0],
  ["studio",    "/account/studio", 0],
  ["shop",      "/edit", 0],
  ["planner",   "/account/schedule", 0],
  ["orders",    "/account/orders", 0],
  ["bookings",  "/account/bookings", 0],
  ["brand-kit", "/account/profile", 0],
  ["learn",     "/account/guides", 0],
];

const raw = {};
for (const [name, path, scroll] of PAGES) {
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 2, mobile: false });
  await send("Page.navigate", { url: "http://localhost:4321" + path });
  await sleep(5000);
  await js(CLEAN);
  if (scroll) { await js(`window.scrollTo(0, ${scroll})`); await sleep(700); }
  await js(CLEAN);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  raw[name] = shot.result.data;
  console.log("captured", name);
}

// The frame: the shot inside a browser window, on wine, 16:10.
const frameHtml = (dataUrl, label) => `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1600px; height: 1000px; background:
      radial-gradient(70% 60% at 15% 0%, #4a2b38 0%, transparent 60%),
      radial-gradient(60% 60% at 100% 100%, #2a141d 0%, transparent 55%), #371e28;
    display: flex; align-items: center; justify-content: center; font-family: -apple-system, "Segoe UI", sans-serif; }
  .win { width: 1380px; border-radius: 14px; overflow: hidden; background: #fff;
    box-shadow: 0 48px 90px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08); }
  .bar { height: 42px; background: #f1eeec; border-bottom: 1px solid #e3dcd8; display: flex; align-items: center; gap: 8px; padding: 0 16px; }
  .dot { width: 11px; height: 11px; border-radius: 50%; }
  .url { margin-left: 14px; flex: 1; height: 24px; border-radius: 999px; background: #fff; border: 1px solid #e3dcd8;
    display: flex; align-items: center; padding: 0 12px; font-size: 11.5px; color: #8b8078; letter-spacing: 0.02em; }
  .shot { display: block; width: 100%; }
</style></head><body>
  <div class="win">
    <div class="bar">
      <span class="dot" style="background:#e5a09a"></span><span class="dot" style="background:#e6cf9c"></span><span class="dot" style="background:#a9c6a5"></span>
      <span class="url">tmke.co.uk${label}</span>
    </div>
    <img class="shot" src="${dataUrl}">
  </div>
</body></html>`;

for (const [name, path] of PAGES) {
  const html = frameHtml("data:image/png;base64," + raw[name], path);
  const file = `${tmpdir()}/tmke-frame-${name}.html`;
  writeFileSync(file, html);
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1.5, mobile: false });
  await send("Page.navigate", { url: "file://" + file });

  await sleep(1200);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(shot.result.data, "base64"));
  console.log("framed", name);
}
ws.close(); chrome.kill(); await sleep(600); try { rmSync(prof, { recursive: true, force: true }); } catch (_) {}
