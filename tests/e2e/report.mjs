/* Builds the test report page: the plan (plan.mjs), with each step marked
   from the last run's results (results/results.json, Playwright's JSON
   reporter). Before any run, every step says "Not run yet".

     node tests/e2e/report.mjs        → tests/e2e/report/index.html */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAN } from "./plan.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const resultsPath = join(here, "results", "results.json");
const outDir = join(here, "report");

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Playwright colours its error text for a terminal; the page doesn't want that.
const plain = (s) => String(s ?? "").replace(/\u001b\[[0-9;]*m/g, "");

// ---- Read the run ----
let run = null;
const byId = new Map();   // plan id → { status, steps: Map(title → {status, error}), error, shot, ms }
if (existsSync(resultsPath)) {
  run = JSON.parse(readFileSync(resultsPath, "utf8"));
  const walk = (suite) => {
    (suite.suites || []).forEach(walk);
    (suite.specs || []).forEach((spec) => {
      const id = String(spec.title).split(":")[0].trim();
      const t = (spec.tests || [])[0];
      const r = t && t.results && t.results[t.results.length - 1];
      if (!r) return;
      const steps = new Map();
      const flat = (list) => (list || []).forEach((st) => {
        steps.set(st.title, { status: st.error ? "failed" : "passed", error: st.error ? plain(st.error.message || "") : "" });
        flat(st.steps);
      });
      flat(r.steps);
      const shot = (r.attachments || []).find((a) => a.contentType === "image/png" && a.path && existsSync(a.path));
      const notes = (r.attachments || []).filter((a) => a.name === "note" && a.body).map((a) => Buffer.from(a.body, "base64").toString("utf8"));
      byId.set(id, {
        status: r.status === "passed" ? "passed" : r.status === "skipped" ? "skipped" : "failed",
        steps, ms: r.duration || 0, notes,
        error: r.error ? plain(r.error.message || "").split("\n").slice(0, 6).join("\n") : "",
        shot: shot ? "data:image/png;base64," + readFileSync(shot.path).toString("base64") : "",
        skipReason: ((t.annotations || []).find((a) => a.type === "skip") || {}).description || "",
      });
    });
  };
  (run.suites || []).forEach(walk);
}

// A step's state: what the run said about it. A step the run never reached,
// in a test that failed, didn't run.
function stepState(feature, text) {
  const r = byId.get(feature.id);
  if (!r) return { status: "notrun" };
  if (r.status === "skipped") return { status: "skipped" };
  const s = r.steps.get(text);
  if (s) return s;
  return { status: r.status === "passed" ? "passed" : "notrun" };
}

const counts = { passed: 0, failed: 0, skipped: 0, notrun: 0 };
PLAN.forEach((f) => { const r = byId.get(f.id); counts[r ? r.status : "notrun"]++; });
const ran = run && run.stats ? new Date(run.stats.startTime) : null;
const when = ran ? ran.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : null;
const LABEL = { passed: "Passed", failed: "Failed", skipped: "Skipped", notrun: "Not run yet" };

const areas = [...new Set(PLAN.map((f) => f.area))];
const body = areas.map((area) => `
  <section class="area">
    <h2>${esc(area)}</h2>
    ${PLAN.filter((f) => f.area === area).map((f) => {
      const r = byId.get(f.id);
      const st = r ? r.status : "notrun";
      return `<article class="feature is-${st}" id="${esc(f.id)}">
        <header><h3>${esc(f.name)}</h3><span class="pill pill--${st}">${LABEL[st]}</span></header>
        <ol class="steps">${f.steps.map((text) => {
          const s = stepState(f, text);
          return `<li class="step is-${s.status}"><span class="mark" aria-label="${LABEL[s.status]}"></span><span class="txt">${esc(text)}</span>${s.error ? `<pre class="err">${esc(s.error.split("\n").slice(0, 4).join("\n"))}</pre>` : ""}</li>`;
        }).join("")}</ol>
        ${r && r.skipReason ? `<p class="note">${esc(r.skipReason)}</p>` : ""}
        ${r && r.notes && r.notes.length ? r.notes.map((n) => `<p class="note">${esc(n)}</p>`).join("") : ""}
        ${r && r.status === "failed" && r.error && ![...r.steps.values()].some((x) => x.error) ? `<pre class="err">${esc(r.error)}</pre>` : ""}
        ${r && r.shot ? `<details class="shot"><summary>What the screen showed</summary><img src="${r.shot}" alt="The screen when this failed" loading="lazy" /></details>` : ""}
      </article>`;
    }).join("")}
  </section>`).join("");

const html = `<title>Marketing Calendar Tests</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap" />
<style>
  /* A checklist, read top to bottom: the run's summary, then each area's features and their steps. */
  :root {
    --paper: #f5f2f0; --card: #ffffff; --ink: #1f1a1c; --muted: #6d6266; --line: #e3dcd9;
    --plum: #371e28; --pass: #2e6f4f; --fail: #a3372f; --skip: #8a6d1d; --none: #9a9095;
    --pass-bg: #e6f1ea; --fail-bg: #f7e4e1; --skip-bg: #f4ecd6; --none-bg: #eeeaea;
    --display: "Fraunces", Georgia, serif; --body: "Hanken Grotesk", system-ui, sans-serif; --mono: "JetBrains Mono", ui-monospace, monospace;
  }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --paper: #171214; --card: #211a1d; --ink: #f1ebec; --muted: #b3a7ab; --line: #3a2f33;
    --plum: #e2c3cf; --pass: #7cc79e; --fail: #f09a90; --skip: #e3c56f; --none: #8b8186;
    --pass-bg: #1f3329; --fail-bg: #3a2220; --skip-bg: #352d17; --none-bg: #2a2326; color-scheme: dark; } }
  :root[data-theme="dark"] {
    --paper: #171214; --card: #211a1d; --ink: #f1ebec; --muted: #b3a7ab; --line: #3a2f33;
    --plum: #e2c3cf; --pass: #7cc79e; --fail: #f09a90; --skip: #e3c56f; --none: #8b8186;
    --pass-bg: #1f3329; --fail-bg: #3a2220; --skip-bg: #352d17; --none-bg: #2a2326; color-scheme: dark; }
  body { background: var(--paper); color: var(--ink); font: 15px/1.55 var(--body); padding-inline: 16px; padding-block: 32px 64px; }
  .wrap { max-width: 860px; margin: 0 auto; display: grid; gap: 36px; }
  .top { display: grid; gap: 10px; }
  .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); margin: 0; }
  h1 { font-family: var(--display); font-weight: 400; font-size: clamp(30px, 5vw, 44px); line-height: 1.1; margin: 0; color: var(--plum); text-wrap: balance; }
  .lede { margin: 0; color: var(--muted); max-width: 62ch; }
  .tally { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
  .tally span { font-size: 12px; font-weight: 600; padding: 5px 10px; border-radius: 4px; font-variant-numeric: tabular-nums; }
  .area { display: grid; gap: 12px; }
  .area h2 { font-size: 11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); margin: 0; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
  .feature { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 16px 18px; display: grid; gap: 10px; min-width: 0; }
  .feature.is-failed { border-color: var(--fail); }
  .feature header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .feature h3 { font-family: var(--display); font-weight: 600; font-size: 19px; margin: 0; }
  .pill { flex: none; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 8px; border-radius: 3px; }
  .pill--passed, .t-passed { background: var(--pass-bg); color: var(--pass); }
  .pill--failed, .t-failed { background: var(--fail-bg); color: var(--fail); }
  .pill--skipped, .t-skipped { background: var(--skip-bg); color: var(--skip); }
  .pill--notrun, .t-notrun { background: var(--none-bg); color: var(--none); }
  .steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .step { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 4px 10px; align-items: start; }
  .mark { width: 14px; height: 14px; margin-top: 4px; border-radius: 50%; border: 2px solid var(--none); box-sizing: border-box; }
  .is-passed > .mark { background: var(--pass); border-color: var(--pass); }
  .is-failed > .mark { background: var(--fail); border-color: var(--fail); }
  .is-skipped > .mark { border-color: var(--skip); }
  .step.is-notrun .txt { color: var(--muted); }
  .err { grid-column: 2; margin: 2px 0 0; padding: 8px 10px; background: var(--fail-bg); color: var(--fail); border-radius: 4px; font: 12px/1.5 var(--mono); white-space: pre-wrap; overflow-x: auto; }
  .note { margin: 0; font-size: 13px; color: var(--muted); }
  .shot summary { cursor: pointer; font-size: 13px; font-weight: 600; color: var(--plum); }
  .shot summary:focus-visible { outline: 2px solid var(--plum); outline-offset: 2px; }
  .shot img { margin-top: 8px; border-radius: 6px; border: 1px solid var(--line); }
</style>
<div class="wrap">
  <header class="top">
    <p class="eyebrow">Training account · ${run ? "Last run " + esc(when) : "Test plan"}</p>
    <h1>Marketing Calendar Tests</h1>
    <p class="lede">${run
      ? "Each feature as the steps a person takes, run in a real browser in the training account. Anything the run made, marked [TEST], is removed afterwards."
      : "Each feature as the steps a person takes. The test run follows these steps in a real browser, in the training account, and this page then shows each one as passed or failed."}</p>
    <div class="tally">
      ${run ? `<span class="t-passed">${counts.passed} passed</span><span class="t-failed">${counts.failed} failed</span>${counts.skipped ? `<span class="t-skipped">${counts.skipped} skipped</span>` : ""}` : `<span class="t-notrun">${PLAN.length} features, ${PLAN.reduce((n, f) => n + f.steps.length, 0)} steps</span>`}
    </div>
  </header>
  ${body}
</div>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "index.html"), html);
console.log("report:", join(outDir, "index.html"), run ? `(${counts.passed} passed, ${counts.failed} failed, ${counts.skipped} skipped)` : "(plan only)");
