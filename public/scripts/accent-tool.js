/* ============================================================================
   TMKE accent theming tool — owner-only, browser-persisted exploration.
   A small always-on floating picker. Changing the accent re-points the brand
   purple tokens (--english-violet / --violet / --violet-deep / --violet-bright
   / --violet-soft / --accent) on <html>, so the whole app — nav, every tab,
   This Week, library packs, studio, all pages — re-themes live and persists as
   you browse. Saved to localStorage only; customers never see it.

   Enable on this browser:  add ?theme=1 to any URL (persists).
   Disable:                 ?theme=0  (or the × on the panel).
   The pre-paint applier (in BaseLayout <head>) re-applies the saved accent on
   every page so there's no flash and it carries across navigation.
   ============================================================================ */
(function () {
  var FLAG = "tmke-theme-tool";
  var KEY = "tmke-accent";

  // URL toggle (mirrors the ?edit pattern), then strip it from the address bar.
  try {
    var p = new URLSearchParams(location.search);
    if (p.has("theme")) {
      var on = p.get("theme") !== "0";
      if (on) localStorage.setItem(FLAG, "1");
      else { localStorage.removeItem(FLAG); localStorage.removeItem(KEY); if (window.__tmkeClearAccent) window.__tmkeClearAccent(); }
      p.delete("theme");
      var qs = p.toString();
      history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
    }
  } catch (e) {}

  // Only the owner (who knows the URL toggle) sees the picker.
  try { if (localStorage.getItem(FLAG) !== "1") return; } catch (e) { return; }
  if (window.top !== window.self) return; // not inside the editor's preview iframe

  var SWATCHES = [
    ["#371e28", "Brand plum"],
    ["#2f5d62", "Teal"],
    ["#1f3a5f", "Navy"],
    ["#2e5a3e", "Forest"],
    ["#8a4b2f", "Rust"],
    ["#6a2e4d", "Berry"],
    ["#3a3146", "Aubergine"],
    ["#9a6a3c", "Bronze"],
  ];

  function current() {
    try { return localStorage.getItem(KEY) || "#371e28"; } catch (e) { return "#371e28"; }
  }
  function setAccent(hex) {
    try { localStorage.setItem(KEY, hex); } catch (e) {}
    if (window.__tmkeApplyAccent) window.__tmkeApplyAccent(hex);
    syncUI(hex);
  }
  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    if (window.__tmkeClearAccent) window.__tmkeClearAccent();
    syncUI("#371e28");
  }

  var root, swatchEls = [], colorInput, hexLabel;

  function syncUI(hex) {
    if (colorInput) colorInput.value = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#371e28";
    if (hexLabel) hexLabel.textContent = hex.toUpperCase();
    swatchEls.forEach(function (s) { s.setAttribute("aria-pressed", s.dataset.hex.toLowerCase() === hex.toLowerCase() ? "true" : "false"); });
  }

  function build() {
    var css = document.createElement("style");
    css.textContent = [
      ".tmke-acc{position:fixed;left:18px;bottom:18px;z-index:2147483600;width:230px;background:#1c1d22;color:#f2efe9;border:1px solid rgba(255,255,255,.14);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.45);font:13px/1.4 system-ui,sans-serif;overflow:hidden;transition:transform .2s ease,opacity .2s ease;}",
      ".tmke-acc.is-min{transform:translateY(calc(100% - 42px));}",
      ".tmke-acc-h{display:flex;align-items:center;gap:8px;padding:11px 12px;cursor:pointer;background:rgba(255,255,255,.05);}",
      ".tmke-acc-dot{width:14px;height:14px;border-radius:50%;flex:none;background:var(--english-violet);border:1px solid rgba(255,255,255,.3);}",
      ".tmke-acc-h b{font-weight:700;letter-spacing:.04em;}",
      ".tmke-acc-h .sp{margin-left:auto;}",
      ".tmke-acc-x{background:none;border:0;color:rgba(242,239,233,.6);cursor:pointer;font-size:16px;line-height:1;padding:2px 4px;}",
      ".tmke-acc-x:hover{color:#fff;}",
      ".tmke-acc-body{padding:12px;}",
      ".tmke-acc-sw{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:12px;}",
      ".tmke-acc-sw button{height:30px;border-radius:7px;border:2px solid transparent;cursor:pointer;padding:0;transition:transform .12s;}",
      ".tmke-acc-sw button:hover{transform:translateY(-2px);}",
      ".tmke-acc-sw button[aria-pressed=true]{border-color:#fff;box-shadow:0 0 0 2px #1c1d22 inset;}",
      ".tmke-acc-row{display:flex;align-items:center;gap:10px;}",
      ".tmke-acc-row input[type=color]{width:38px;height:34px;border:none;background:none;cursor:pointer;padding:0;flex:none;}",
      ".tmke-acc-hex{font:600 12px ui-monospace,monospace;letter-spacing:.04em;flex:1;opacity:.85;}",
      ".tmke-acc-reset{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#f2efe9;border-radius:7px;padding:7px 11px;cursor:pointer;font:600 11px system-ui;letter-spacing:.05em;}",
      ".tmke-acc-reset:hover{background:rgba(255,255,255,.2);}",
      ".tmke-acc-note{margin-top:10px;font-size:10.5px;line-height:1.5;opacity:.5;}",
    ].join("");
    document.head.appendChild(css);

    root = document.createElement("div");
    root.className = "tmke-acc";
    root.innerHTML =
      '<div class="tmke-acc-h" data-min><span class="tmke-acc-dot"></span><b>Accent</b><span class="sp"></span><button class="tmke-acc-x" title="Turn off" aria-label="Turn off accent tool">&times;</button></div>' +
      '<div class="tmke-acc-body">' +
        '<div class="tmke-acc-sw">' + SWATCHES.map(function (s) { return '<button type="button" data-hex="' + s[0] + '" title="' + s[1] + '" style="background:' + s[0] + '"></button>'; }).join("") + "</div>" +
        '<div class="tmke-acc-row"><input type="color" aria-label="Custom accent colour" /><span class="tmke-acc-hex"></span><button type="button" class="tmke-acc-reset">Reset</button></div>' +
        '<p class="tmke-acc-note">Preview only — saved to this browser. Nothing changes for customers.</p>' +
      "</div>";
    document.body.appendChild(root);

    colorInput = root.querySelector('input[type=color]');
    hexLabel = root.querySelector(".tmke-acc-hex");
    swatchEls = Array.prototype.slice.call(root.querySelectorAll(".tmke-acc-sw button"));

    swatchEls.forEach(function (b) { b.addEventListener("click", function () { setAccent(b.dataset.hex); }); });
    colorInput.addEventListener("input", function () { setAccent(colorInput.value); });
    root.querySelector(".tmke-acc-reset").addEventListener("click", reset);
    root.querySelector(".tmke-acc-x").addEventListener("click", function (e) {
      e.stopPropagation();
      try { localStorage.removeItem(FLAG); } catch (e2) {}
      root.remove();
    });
    root.querySelector("[data-min]").addEventListener("click", function (e) {
      if (e.target.closest(".tmke-acc-x")) return;
      root.classList.toggle("is-min");
    });

    syncUI(current());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
