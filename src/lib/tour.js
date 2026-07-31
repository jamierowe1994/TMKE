// TMKE first-time login tour.
//
// A framework-free, cross-page spotlight tour. It dims the screen and cuts a
// "spotlight" hole around one element at a time while a small card explains it
// — styled to match the Studio's onboarding overlay (.ed-onboard in
// editor.astro): serif headline, italic violet accents, eyebrow label.
//
// The tour walks across three pages — Hub (/account) → Studio (/editor) →
// Brand kit (/profile). The in-progress step lives in localStorage so it
// survives navigation; *completion* is stamped on the Supabase user account so
// the tour only ever shows once per user (across devices).
//
// Usage:
//   import { initTour, maybeStartTour } from '../lib/tour.js';
//   initTour();                       // every included page — resumes if mid-tour
//   maybeStartTour({ firstName });    // /account only — kicks it off first-login
//
import { supabase } from './supabase.js';

const LS_STATE = 'tmke.tour';        // { active: true, index: N }
const LS_DONE  = 'tmke.tour.done';   // fast/offline "already seen" guard

// ---------- Step definitions ----------
// target: CSS selector to spotlight, or null for a centred card (welcome/finish).
// placement: where the card sits relative to the hole (auto picks the roomiest side).
// preAction: optional async fn run before the step shows (open a menu, dismiss
//            the editor's pack-picker, …). Receives no args.
const STEPS = [
  // ---- Hub ----
  {
    path: '/account', target: null, placement: 'center',
    eyebrow: 'Welcome to TMKE',
    title: 'Welcome aboard{NAME}.',
    body: "This is your workspace — your packs, your designs and your brand all in one place. Let's take a quick spin around so you know where everything lives. It'll take about a minute.",
  },
  {
    path: '/account', target: 'a[href="/account/editor"]', placement: 'bottom',
    eyebrow: 'The Studio',
    title: 'Design in the <em>Studio.</em>',
    body: 'This is where you make things. Open a pack or start from scratch and the editor loads with your brand kit ready to go. We\'ll head in there shortly.',
  },
  {
    path: '/account', target: '#open-shop', placement: 'bottom',
    eyebrow: 'The Edit',
    title: 'Browse <em>packs.</em>',
    body: 'Add new design packs from The Edit without leaving your workspace. Anything you buy lands straight in your library below.',
  },
  {
    path: '/account', target: 'a[href="/account/orders"]', placement: 'bottom',
    eyebrow: 'Orders',
    title: 'Your <em>receipts.</em>',
    body: 'Every purchase, invoice and download lives here. Handy come accounting time.',
  },
  {
    path: '/account', target: '.app-header-dd', placement: 'bottom',
    eyebrow: 'Resources',
    title: 'More to <em>explore.</em>',
    body: 'Hover here for Managed Socials, the blog, and a direct line to the team — tucked away until you need a hand.',
  },
  {
    path: '/account', target: 'a[href="/account/profile"]', placement: 'bottom',
    eyebrow: 'Brand kit',
    title: 'Make it <em>yours.</em>',
    body: 'Your colours, fonts and logos. Setting this up first means every design opens on-brand — we\'ll finish the tour right here so you can fill it in.',
  },
  {
    path: '/account', target: '.stats', placement: 'top',
    eyebrow: 'At a glance',
    title: 'Your numbers, <em>live.</em>',
    body: 'Active packs, designs in progress and lifetime spend update as you go. Below them sits your library of purchased packs.',
  },
  // ---- Studio ----
  {
    path: '/account/editor', target: '.ed-rail', placement: 'right', padding: 10,
    eyebrow: 'The Studio',
    title: 'This is your <em>toolbox.</em>',
    body: 'Everything you need runs down this rail — brand kit, elements, text, photos, uploads and layers. Click an icon to open its panel.',
    preAction: dismissEditorOnboarding,
  },
  {
    path: '/account/editor', target: '[data-tool="brand"]', placement: 'right', padding: 8,
    eyebrow: 'Brand',
    title: 'Your kit, <em>on tap.</em>',
    body: 'The colours, fonts and logos you save in your Brand kit show up right here — one click to drop them onto the canvas.',
  },
  {
    path: '/account/editor', target: '#ed-stage', placement: 'left', padding: 0,
    eyebrow: 'The canvas',
    title: 'Make it <em>here.</em>',
    body: 'Drag, drop and arrange on the canvas. Scroll to zoom, drag to pan, and use the controls up top to undo, crop, flip or fit to screen.',
  },
  {
    path: '/account/editor', target: '.ed-topbar-right', placement: 'bottom', padding: 8,
    eyebrow: 'When you\'re done',
    title: 'Save, schedule, <em>share.</em>',
    body: 'Save keeps your work safe. Schedule drops a post onto your content calendar, and Share sends it to your socials.',
  },
  {
    path: '/account/editor', target: '#ed-download', placement: 'bottom', padding: 8,
    eyebrow: 'Export',
    title: 'Take it <em>anywhere.</em>',
    body: 'Download as a transparent PNG, a flat PNG, a JPG or a print-ready PDF — whatever the moment calls for.',
  },
  // ---- Brand kit ----
  {
    path: '/account/profile', target: '#colour-grid', placement: 'top', padding: 12,
    eyebrow: 'Brand kit · Colours',
    title: 'Start with your <em>palette.</em>',
    body: 'Drop in your brand colours — paste a hex code or pick a swatch. These become your one-click colours inside the Studio.',
  },
  {
    path: '/account/profile', target: '#logo-drop', placement: 'top', padding: 12,
    eyebrow: 'Brand kit · Logos',
    title: 'Add your <em>logos.</em>',
    body: 'Upload your logo files and mark a primary. They\'ll be ready to drop onto any design.',
  },
  {
    path: '/account/profile', target: 'button[type="submit"]', placement: 'top', padding: 10,
    eyebrow: 'Brand kit',
    title: 'Save and you\'re <em>set.</em>',
    body: 'Fill in what you can now — colours, fonts and logos — then hit save. You can change any of it later from this page.',
  },
  {
    path: '/account/profile', target: null, placement: 'center',
    eyebrow: 'That\'s the tour',
    title: 'You\'re all <em>set.</em>',
    body: 'That\'s the lay of the land. Take a minute to fill in your brand kit below — once it\'s saved, every design opens looking like you. Welcome to TMKE.',
    isFinish: true,
  },
];

// ---------- State helpers ----------
function readState() {
  try { return JSON.parse(localStorage.getItem(LS_STATE) || 'null'); } catch (_) { return null; }
}
function writeState(s) {
  try { localStorage.setItem(LS_STATE, JSON.stringify(s)); } catch (_) {}
}
function clearState() {
  try { localStorage.removeItem(LS_STATE); } catch (_) {}
}
function isDone() {
  try { return localStorage.getItem(LS_DONE) === '1'; } catch (_) { return false; }
}
function markDone() {
  try { localStorage.setItem(LS_DONE, '1'); } catch (_) {}
  clearState();
  // Persist on the user account too, so it follows them across devices and
  // never re-shows. Fire-and-forget; the localStorage guard covers the gap.
  try { supabase.auth.updateUser({ data: { tour_completed_at: new Date().toISOString() } }); } catch (_) {}
}

const path = () => location.pathname.replace(/\/$/, '') || '/';

// ---------- DOM ----------
let els = null;          // { root, hole, card, ... }
let activeIndex = -1;
let reflowRAF = 0;
let lastPostAction = null;

function injectStyles() {
  if (document.getElementById('tmke-tour-styles')) return;
  const css = `
  .tmke-tour { position: fixed; inset: 0; z-index: 9000; font-family: var(--sans, system-ui, sans-serif); }
  .tmke-tour, .tmke-tour * { box-sizing: border-box; }
  /* Four panels frame the spotlight cutout — far cheaper to paint than a giant
     box-shadow, and they animate smoothly as the hole moves between steps. */
  .tmke-tour-mask {
    position: fixed; background: rgba(28,29,34,0.62); pointer-events: auto;
    transition: top .36s cubic-bezier(.4,.7,.2,1), left .36s cubic-bezier(.4,.7,.2,1),
                width .36s cubic-bezier(.4,.7,.2,1), height .36s cubic-bezier(.4,.7,.2,1);
  }
  .tmke-tour-ring {
    position: fixed; border-radius: 8px; pointer-events: none;
    outline: 2px solid var(--english-violet, #371e28); outline-offset: 0;
    box-shadow: 0 0 0 1px rgba(189,179,185,0.6) inset, 0 0 0 6px rgba(55, 30, 40,0.18);
    transition: top .36s cubic-bezier(.4,.7,.2,1), left .36s cubic-bezier(.4,.7,.2,1),
                width .36s cubic-bezier(.4,.7,.2,1), height .36s cubic-bezier(.4,.7,.2,1);
  }
  .tmke-tour.is-center .tmke-tour-ring { display: none; }
  .tmke-tour-card {
    position: fixed; width: min(380px, calc(100vw - 32px));
    background: #f7f6f2; color: var(--ink, #1c1d22);
    border: 1px solid rgba(55, 30, 40,0.18); border-radius: 6px;
    box-shadow: 0 30px 70px -28px rgba(28,29,34,0.55);
    padding: 24px 24px 18px;
    opacity: 0; transform: translateY(8px);
    transition: opacity .35s ease, transform .35s cubic-bezier(.2,.75,.2,1), top .3s ease, left .3s ease;
  }
  .tmke-tour-card.is-in { opacity: 1; transform: translateY(0); }
  .tmke-tour-card.is-center {
    left: 50%; top: 50%; transform: translate(-50%, calc(-50% + 8px)); width: min(560px, calc(100vw - 32px));
    text-align: left; padding: 38px 40px 26px;
  }
  .tmke-tour-card.is-center.is-in { transform: translate(-50%, -50%); }
  .tmke-tour-eyebrow {
    font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; font-weight: 700;
    color: var(--english-violet, #371e28); margin: 0 0 12px;
  }
  .tmke-tour-title {
    font-family: var(--serif, Georgia, serif); font-weight: 400; letter-spacing: -0.02em;
    font-size: clamp(26px, 3.4vw, 34px); line-height: 1.06; color: var(--ink, #1c1d22); margin: 0 0 12px;
  }
  .tmke-tour-card.is-center .tmke-tour-title { font-size: clamp(34px, 5vw, 52px); margin-bottom: 16px; }
  .tmke-tour-title em { font-style: italic; color: var(--english-violet, #371e28); }
  .tmke-tour-body {
    font-family: var(--serif, Georgia, serif); font-size: 16px; line-height: 1.55;
    color: rgba(28,29,34,0.72); margin: 0 0 22px;
  }
  .tmke-tour-card.is-center .tmke-tour-body { font-size: 18px; max-width: 46ch; }
  .tmke-tour-foot { display: flex; align-items: center; gap: 14px; }
  .tmke-tour-progress { font-size: 12px; letter-spacing: 0.18em; font-weight: 700; color: rgba(28,29,34,0.4); }
  .tmke-tour-spacer { flex: 1; }
  .tmke-tour-skip {
    appearance: none; background: none; border: 0; padding: 6px 2px; cursor: pointer;
    font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; font-weight: 700;
    color: rgba(28,29,34,0.45); transition: color .2s;
  }
  .tmke-tour-skip:hover { color: var(--english-violet, #371e28); }
  .tmke-tour-back {
    appearance: none; background: none; border: 0; padding: 9px 4px; cursor: pointer;
    font-family: var(--serif, Georgia, serif); font-style: italic; font-size: 15px;
    color: rgba(28,29,34,0.55); transition: color .2s;
  }
  .tmke-tour-back:hover { color: var(--ink, #1c1d22); }
  .tmke-tour-next {
    appearance: none; cursor: pointer; border: 0; border-radius: 3px;
    background: var(--english-violet, #371e28); color: #fff;
    font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700;
    padding: 11px 20px; transition: background .2s, transform .2s;
  }
  .tmke-tour-next:hover { background: var(--ink, #1c1d22); transform: translateY(-1px); }
  @media (prefers-reduced-motion: reduce) {
    .tmke-tour-mask, .tmke-tour-ring, .tmke-tour-card { transition: opacity .2s ease; }
  }`;
  const style = document.createElement('style');
  style.id = 'tmke-tour-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

function buildDOM() {
  injectStyles();
  const root = document.createElement('div');
  root.className = 'tmke-tour';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML = `
    <div class="tmke-tour-mask" data-mask="t"></div>
    <div class="tmke-tour-mask" data-mask="r"></div>
    <div class="tmke-tour-mask" data-mask="b"></div>
    <div class="tmke-tour-mask" data-mask="l"></div>
    <div class="tmke-tour-ring" data-ring></div>
    <div class="tmke-tour-card" data-card>
      <p class="tmke-tour-eyebrow" data-eyebrow></p>
      <h2 class="tmke-tour-title" data-title></h2>
      <p class="tmke-tour-body" data-body></p>
      <div class="tmke-tour-foot">
        <button type="button" class="tmke-tour-skip" data-skip>Skip tour</button>
        <span class="tmke-tour-spacer"></span>
        <span class="tmke-tour-progress" data-progress></span>
        <button type="button" class="tmke-tour-back" data-back>Back</button>
        <button type="button" class="tmke-tour-next" data-next>Next</button>
      </div>
    </div>`;
  document.body.appendChild(root);
  els = {
    root,
    maskT: root.querySelector('[data-mask="t"]'),
    maskR: root.querySelector('[data-mask="r"]'),
    maskB: root.querySelector('[data-mask="b"]'),
    maskL: root.querySelector('[data-mask="l"]'),
    ring: root.querySelector('[data-ring]'),
    card: root.querySelector('[data-card]'),
    eyebrow: root.querySelector('[data-eyebrow]'),
    title: root.querySelector('[data-title]'),
    body: root.querySelector('[data-body]'),
    progress: root.querySelector('[data-progress]'),
    skip: root.querySelector('[data-skip]'),
    back: root.querySelector('[data-back]'),
    next: root.querySelector('[data-next]'),
  };
  els.skip.addEventListener('click', () => finish(false));
  els.back.addEventListener('click', goBack);
  els.next.addEventListener('click', goNext);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', scheduleReflow, { passive: true });
  window.addEventListener('scroll', scheduleReflow, { passive: true, capture: true });
}

function teardownDOM() {
  document.removeEventListener('keydown', onKey, true);
  window.removeEventListener('resize', scheduleReflow);
  window.removeEventListener('scroll', scheduleReflow, true);
  if (els && els.root) els.root.remove();
  els = null;
}

function onKey(e) {
  if (!els) return;
  if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); goNext(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
}

// Run a callback on the next paint, but fall back to setTimeout — rAF doesn't
// fire in backgrounded/headless tabs, and the tour must still work there.
function nextTick(fn) { setTimeout(fn, 16); }

// Wait for a selector to appear (targets can render late — editor chrome,
// dynamically-built header). Resolves with the element, or null on timeout.
function waitFor(selector, timeout = 4000) {
  return new Promise((resolve) => {
    const found = document.querySelector(selector);
    if (found) return resolve(found);
    const start = Date.now();
    const id = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) { clearInterval(id); return resolve(el); }
      if (Date.now() - start > timeout) { clearInterval(id); return resolve(null); }
    }, 80);
  });
}

// The /editor page boots into a full-screen pack-picker (.is-onboarding hides
// the chrome). Dismiss it so the rail/topbar are visible to spotlight.
function dismissEditorOnboarding() {
  return new Promise((resolve) => {
    const overlay = document.getElementById('ed-onboard');
    const skip = document.getElementById('ed-onboard-skip');
    const editor = document.getElementById('editor');
    if (skip && !(overlay && overlay.classList.contains('is-gone'))) {
      try { skip.click(); } catch (_) {}
    }
    // Wait for the editor's reveal sequence to un-hide the chrome. If it stalls
    // (e.g. its rAF-driven animation is throttled in a backgrounded tab), force
    // the chrome visible ourselves so the spotlight can still anchor.
    const start = Date.now();
    const id = setInterval(() => {
      const revealed = editor && !editor.classList.contains('is-onboarding');
      if (revealed) { clearInterval(id); return resolve(); }
      if (Date.now() - start > 2600) {
        clearInterval(id);
        if (overlay) overlay.classList.add('is-gone');
        if (editor) {
          ['show-rail', 'show-top', 'show-stage', 'show-panel', 'show-props']
            .forEach((c) => editor.classList.add(c));
          editor.classList.remove('is-onboarding');
        }
        setTimeout(resolve, 80);
      }
    }, 80);
  });
}

function scheduleReflow() {
  if (reflowRAF) return;
  reflowRAF = setTimeout(() => { reflowRAF = 0; positionFor(STEPS[activeIndex]); }, 16);
}

// Centre a target in the viewport. We scroll the window directly (rather than
// scrollIntoView with smooth behaviour, which doesn't complete reliably) so the
// spotlight always lands on-screen. No-op if the target is already comfortably
// in view, to avoid jarring jumps for header/top-of-page targets.
function scrollTargetIntoView(t) {
  const r = t.getBoundingClientRect();
  const vh = window.innerHeight;
  if (r.top >= 16 && r.bottom <= vh - 16) return; // already fully visible
  const top = window.scrollY + r.top + r.height / 2 - vh / 2;
  // Instant, not smooth: the background is dimmed so the scroll is barely
  // perceptible, and instant lands the spotlight reliably across browsers.
  window.scrollTo(0, Math.max(0, top));
}

function setMask(el, left, top, width, height) {
  el.style.left = Math.round(left) + 'px';
  el.style.top = Math.round(top) + 'px';
  el.style.width = Math.max(0, Math.round(width)) + 'px';
  el.style.height = Math.max(0, Math.round(height)) + 'px';
}

function positionFor(step) {
  if (!els || !step) return;
  const card = els.card;
  const vw = window.innerWidth, vh = window.innerHeight;
  if (!step.target || step.placement === 'center') {
    // Full-screen dim, no cutout: top panel covers everything, others collapse.
    els.root.classList.add('is-center');
    card.classList.add('is-center');
    setMask(els.maskT, 0, 0, vw, vh);
    setMask(els.maskR, vw, 0, 0, 0);
    setMask(els.maskB, 0, vh, vw, 0);
    setMask(els.maskL, 0, 0, 0, vh);
    return;
  }
  els.root.classList.remove('is-center');
  card.classList.remove('is-center');
  const t = document.querySelector(step.target);
  if (!t) return;
  const r = t.getBoundingClientRect();
  const pad = step.padding != null ? step.padding : 6;
  const hx = Math.max(0, r.left - pad), hy = Math.max(0, r.top - pad);
  const hw = Math.min(vw - hx, r.width + pad * 2), hh = Math.min(vh - hy, r.height + pad * 2);

  // Frame the cutout with four dim panels + the ring outline.
  setMask(els.maskT, 0, 0, vw, hy);
  setMask(els.maskB, 0, hy + hh, vw, vh - (hy + hh));
  setMask(els.maskL, 0, hy, hx, hh);
  setMask(els.maskR, hx + hw, hy, vw - (hx + hw), hh);
  els.ring.style.left = hx + 'px';
  els.ring.style.top = hy + 'px';
  els.ring.style.width = hw + 'px';
  els.ring.style.height = hh + 'px';

  // Place the card on the roomiest side unless told otherwise.
  const cw = card.offsetWidth || 380, ch = card.offsetHeight || 220, gap = 16;
  let placement = step.placement || 'auto';
  if (placement === 'auto') {
    const space = { top: hy, bottom: vh - (hy + hh), left: hx, right: vw - (hx + hw) };
    placement = Object.keys(space).reduce((a, b) => (space[b] > space[a] ? b : a), 'bottom');
  }
  let left, top;
  if (placement === 'bottom') { left = hx + hw / 2 - cw / 2; top = hy + hh + gap; }
  else if (placement === 'top') { left = hx + hw / 2 - cw / 2; top = hy - ch - gap; }
  else if (placement === 'right') { left = hx + hw + gap; top = hy + hh / 2 - ch / 2; }
  else { left = hx - cw - gap; top = hy + hh / 2 - ch / 2; } // left
  // Clamp into viewport.
  left = Math.max(16, Math.min(left, vw - cw - 16));
  top = Math.max(16, Math.min(top, vh - ch - 16));
  card.style.left = left + 'px';
  card.style.top = top + 'px';
}

async function render(index) {
  const step = STEPS[index];
  if (!step) return finish(true);
  activeIndex = index;
  if (!els) buildDOM();

  // Run the previous step's cleanup, then this step's setup.
  if (lastPostAction) { try { lastPostAction(); } catch (_) {} lastPostAction = null; }
  els.card.classList.remove('is-in');

  if (step.preAction) { try { await step.preAction(); } catch (_) {} }
  lastPostAction = step.postAction || null;

  // Wait for / validate the target. Skip the step cleanly if it never shows.
  if (step.target) {
    const t = await waitFor(step.target);
    if (!t) return advance(index, +1, true);
    scrollTargetIntoView(t);
    await new Promise((r) => setTimeout(r, 120)); // let layout settle
  }

  // Copy.
  const first = firstStepName;
  els.eyebrow.textContent = step.eyebrow || '';
  els.title.innerHTML = (step.title || '').replace('{NAME}', first ? ', ' + first : '');
  els.body.textContent = step.body || '';
  els.progress.textContent = (index + 1) + ' / ' + STEPS.length;
  els.back.style.visibility = index === 0 ? 'hidden' : 'visible';
  els.next.textContent = step.isFinish ? 'Finish' : 'Next';

  positionFor(step);
  nextTick(() => els.card.classList.add('is-in'));
}

// Move by `dir` (+1/-1). If the destination step is on another page, persist
// and navigate; otherwise render in place. `silent` skips re-running postAction.
function advance(fromIndex, dir, autoSkipped) {
  const nextIndex = fromIndex + dir;
  if (nextIndex < 0) return; // already at start
  if (nextIndex >= STEPS.length) return finish(true);
  const next = STEPS[nextIndex];
  writeState({ active: true, index: nextIndex });
  if (next.path !== path()) {
    if (lastPostAction) { try { lastPostAction(); } catch (_) {} lastPostAction = null; }
    location.assign(next.path);
    return;
  }
  render(nextIndex);
}

function goNext() {
  const step = STEPS[activeIndex];
  if (step && step.isFinish) return finish(true);
  advance(activeIndex, +1);
}
function goBack() { if (activeIndex > 0) advance(activeIndex, -1); }

function finish(completed) {
  if (lastPostAction) { try { lastPostAction(); } catch (_) {} lastPostAction = null; }
  markDone(); // both completing and skipping mean "don't show again"
  if (els) {
    els.card.classList.remove('is-in');
    setTimeout(teardownDOM, 260);
  }
}

let firstStepName = '';

// ---------- Public API ----------

// Resume an in-progress tour on whatever page we just landed on. Inert if no
// tour is active. Call this on every included page.
export function initTour(opts = {}) {
  if (opts.firstName) firstStepName = String(opts.firstName);
  const state = readState();
  if (!state || !state.active) return;
  if (isDone()) { clearState(); return; }
  const step = STEPS[state.index];
  if (!step) { clearState(); return; }
  // Only render if this step belongs to the current page. (If state points at
  // another page we likely arrived mid-navigation — leave it for that page.)
  if (step.path !== path()) return;
  // Defer one tick so the page's own bootstrap/layout settles first.
  nextTick(() => render(state.index));
}

// Kick the tour off for a first-time user (called from /account bootstrap).
// `force: true` replays it regardless of the done-flag.
export function maybeStartTour(opts = {}) {
  if (opts.firstName) firstStepName = String(opts.firstName);
  const completedOnAccount = opts.completedAt; // from Supabase user_metadata
  if (!opts.force) {
    if (completedOnAccount) { markLocalDone(); return; }
    if (isDone()) return;
    const state = readState();
    if (state && state.active) { return initTour(opts); } // already mid-tour
  }
  writeState({ active: true, index: 0 });
  nextTick(() => render(0));
}

function markLocalDone() { try { localStorage.setItem(LS_DONE, '1'); } catch (_) {} }
