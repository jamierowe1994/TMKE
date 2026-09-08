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
import { WALKS } from '../data/walkthroughs.js';

const LS_STATE = 'tmke.tour';        // { active: true, index: N, walk?: id, returnTo?: url }
const LS_DONE  = 'tmke.tour.done';   // fast/offline "already seen" guard

// ---------- Step definitions ----------
// target: CSS selector to spotlight, or null for a centred card (welcome/finish).
// placement: where the card sits relative to the hole (auto picks the roomiest side).
// preAction: optional async fn run before the step shows (open a menu, dismiss
//            the editor's pack-picker, …). Receives no args.
const FIRST_LOGIN = [
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
// The steps in play: the first-login tour, or a training walkthrough loaded
// by name. Walks are plain data (src/data/walkthroughs.js); their `pre`
// names map to the setup helpers below.
let STEPS = FIRST_LOGIN;
let activeWalk = null;   // walk id, or null for the first-login tour
let returnTo = null;     // where a walk goes back to when it finishes
let menuBack = null;     // a walk with a menu to return to when this one finishes
const onThisPage = (step) => step.path === '*' || step.path === path();
const LS_WALKED = 'tmke.walked';  // which area walks this member has finished (this browser)
function walkedSet() { try { return new Set(JSON.parse(localStorage.getItem(LS_WALKED) || '[]')); } catch (_) { return new Set(); } }
function markWalked(id) { try { const st = walkedSet(); st.add(id); localStorage.setItem(LS_WALKED, JSON.stringify([...st])); } catch (_) {} }
const PRE = { dismissEditorOnboarding: () => dismissEditorOnboarding() };
function loadWalk(id) {
  const w = WALKS[id];
  if (!w) return false;
  STEPS = w.steps.map((st) => ({ ...st, preAction: st.pre ? PRE[st.pre] : undefined }));
  activeWalk = id;
  return true;
}

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
  /* The card wears the pop-outs' scale (Trending, Seasonal): small-caps
     eyebrow, serif title in the low twenties, 14px sans body. */
  .tmke-tour-card {
    position: fixed; width: min(360px, calc(100vw - 32px));
    background: #fff; color: var(--ws-ink, #1c1d22);
    border: 1px solid var(--ws-line, rgba(28,29,34,0.13)); border-radius: var(--ws-r, 4px);
    box-shadow: 0 30px 70px -28px rgba(28,29,34,0.5);
    padding: 20px 22px 16px;
    opacity: 0; transform: translateY(8px);
    transition: opacity .35s ease, transform .35s cubic-bezier(.2,.75,.2,1), top .3s ease, left .3s ease;
  }
  .tmke-tour-card.is-in { opacity: 1; transform: translateY(0); }
  .tmke-tour-card.is-center {
    left: 50%; top: 50%; transform: translate(-50%, calc(-50% + 8px)); width: min(520px, calc(100vw - 32px));
    text-align: left; padding: 28px 30px 22px;
  }
  .tmke-tour-card.is-center.is-in { transform: translate(-50%, -50%); }
  .tmke-tour-eyebrow {
    font-family: var(--sans, system-ui, sans-serif); font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700;
    color: var(--ws-accent, #4a2a3c); margin: 0 0 8px;
  }
  .tmke-tour-title {
    font-family: var(--serif, Georgia, serif); font-weight: 400; letter-spacing: -0.015em;
    font-size: clamp(20px, 1.8vw, 24px); line-height: 1.12; color: var(--ws-ink, #1c1d22); margin: 0 0 8px;
  }
  .tmke-tour-card.is-center .tmke-tour-title { font-size: clamp(24px, 2.4vw, 30px); margin-bottom: 10px; }
  .tmke-tour-title em { font-style: italic; color: var(--ws-accent, #4a2a3c); }
  .tmke-tour-body {
    font-family: var(--sans, system-ui, sans-serif); font-size: 14px; line-height: 1.45;
    color: var(--ws-tx, rgba(28,29,34,0.72)); margin: 0 0 16px;
  }
  .tmke-tour-card.is-center .tmke-tour-body { max-width: 52ch; }
  /* The menu: one button per area of the hub. */
  .tmke-tour-menu { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0 0 16px; }
  .tmke-tour-menu button {
    appearance: none; cursor: pointer; text-align: left;
    display: flex; flex-direction: column; gap: 2px; padding: 11px 12px;
    background: #fff; border: 1px solid var(--ws-line, rgba(28,29,34,0.13)); border-radius: var(--ws-r, 4px);
    font-family: var(--sans, system-ui, sans-serif); color: var(--ws-ink, #1c1d22);
    transition: border-color .2s, transform .2s;
  }
  .tmke-tour-menu button:hover { border-color: var(--ws-accent, #4a2a3c); transform: translateY(-1px); }
  .tmke-tour-menu button b { font-size: 13px; font-weight: 600; }
  .tmke-tour-menu button i { font-style: normal; font-size: 11.5px; line-height: 1.35; color: var(--ws-faint, rgba(28,29,34,0.5)); }
  .tmke-tour-menu button.is-done b::after { content: " ✓"; color: var(--ws-accent, #4a2a3c); }
  .tmke-tour-skipto {
    appearance: none; background: none; border: 0; padding: 0; cursor: pointer; margin: -6px 0 16px;
    font-family: var(--sans, system-ui, sans-serif); font-size: 12.5px; font-weight: 600; color: var(--ws-accent, #4a2a3c);
  }
  .tmke-tour-skipto:hover { text-decoration: underline; }
  .tmke-tour-foot { display: flex; align-items: center; gap: 12px; }
  .tmke-tour-progress { font-family: var(--sans, system-ui, sans-serif); font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700; color: var(--ws-faint, rgba(28,29,34,0.45)); }
  .tmke-tour-spacer { flex: 1; }
  .tmke-tour-skip {
    appearance: none; background: none; border: 0; padding: 6px 0; cursor: pointer;
    font-family: var(--sans, system-ui, sans-serif); font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700;
    color: var(--ws-faint, rgba(28,29,34,0.45)); transition: color .2s;
  }
  .tmke-tour-skip:hover { color: var(--ws-accent, #4a2a3c); }
  .tmke-tour-back {
    appearance: none; cursor: pointer; height: 30px; padding: 0 14px; border-radius: var(--ws-r, 4px);
    background: #fff; border: 1px solid var(--ws-line, rgba(28,29,34,0.13)); color: var(--ws-ink, #1c1d22);
    font-family: var(--sans, system-ui, sans-serif); font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700;
    transition: border-color .2s;
  }
  .tmke-tour-back:hover { border-color: var(--ws-accent, #4a2a3c); }
  .tmke-tour-next {
    appearance: none; cursor: pointer; border: 0; height: 30px; padding: 0 16px; border-radius: var(--ws-r, 4px);
    background: var(--ws-accent, #4a2a3c); color: #fff;
    font-family: var(--sans, system-ui, sans-serif); font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700;
    transition: background .2s, transform .2s;
  }
  .tmke-tour-next:hover { background: var(--ws-ink, #1c1d22); transform: translateY(-1px); }
  .tmke-tour-next[hidden], .tmke-tour-back[hidden] { display: none; }
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
      <button type="button" class="tmke-tour-skipto" data-skipto hidden>Skip to the menu &rarr;</button>
      <div class="tmke-tour-menu" data-menu hidden></div>
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
    skipto: root.querySelector('[data-skipto]'),
    menu: root.querySelector('[data-menu]'),
    progress: root.querySelector('[data-progress]'),
    skip: root.querySelector('[data-skip]'),
    back: root.querySelector('[data-back]'),
    next: root.querySelector('[data-next]'),
  };
  els.skip.addEventListener('click', () => finish(false));
  els.back.addEventListener('click', goBack);
  els.next.addEventListener('click', goNext);
  els.skipto.addEventListener('click', () => {
    const i = STEPS.findIndex((st) => st.menu);
    if (i >= 0) { writeState({ active: true, index: i, walk: activeWalk, returnTo, menu: menuBack }); render(i); }
  });
  els.menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-walk]'); if (!b) return;
    // The chosen area's walk; when it finishes it comes back to this menu.
    startWalk(b.dataset.walk, { returnTo, menu: activeWalk });
  });
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
  els.next.textContent = (step.isFinish || index === STEPS.length - 1) ? 'Finish' : 'Next';
  els.skip.textContent = activeWalk ? 'Stop' : 'Skip tour';
  // A menu step: the areas as buttons, Done instead of Next, no Back.
  els.skipto.hidden = !step.skipToMenu;
  if (step.menu) {
    const done = walkedSet();
    els.menu.innerHTML = step.menu.map((m) =>
      `<button type="button" data-walk="${m.walk}" class="${done.has(m.walk) ? 'is-done' : ''}"><b>${m.label}</b>${m.note ? `<i>${m.note}</i>` : ''}</button>`).join('');
    els.menu.hidden = false;
    els.next.textContent = 'Done';
    els.back.style.visibility = 'hidden';
    els.progress.textContent = '';
  } else {
    els.menu.hidden = true;
  }

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
  writeState({ active: true, index: nextIndex, walk: activeWalk, returnTo, menu: menuBack });
  if (!onThisPage(next)) {
    if (lastPostAction) { try { lastPostAction(); } catch (_) {} lastPostAction = null; }
    location.assign(next.href || next.path);
    return;
  }
  render(nextIndex);
}

function goNext() {
  const step = STEPS[activeIndex];
  if (step && (step.isFinish || step.menu)) return finish(true);
  advance(activeIndex, +1);
}
function goBack() { if (activeIndex > 0) advance(activeIndex, -1); }

function finish(completed) {
  if (lastPostAction) { try { lastPostAction(); } catch (_) {} lastPostAction = null; }
  if (activeWalk) {
    clearState();
    const back = returnTo, menu = menuBack, walked = activeWalk;
    if (completed) markWalked(walked);
    activeWalk = null; returnTo = null; menuBack = null; STEPS = FIRST_LOGIN;
    if (els) { els.card.classList.remove('is-in'); setTimeout(teardownDOM, 260); }
    // An area walk opened from a menu goes back to that menu, wherever we
    // are now; the menu itself, and a walk opened from a lesson, go home.
    if (menu && WALKS[menu]) {
      const at = WALKS[menu].steps.findIndex((st) => st.menu);
      setTimeout(() => startWalk(menu, { returnTo: back, at: at >= 0 ? at : 0 }), 280);
      return;
    }
    if (back) setTimeout(() => location.assign(back), completed ? 280 : 0);
    return;
  }
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
let booted = false;
export function initTour(opts = {}) {
  if (opts.firstName) firstStepName = String(opts.firstName);
  if (booted) return;
  booted = true;
  const state = readState();
  if (!state || !state.active) return;
  if (state.walk) {
    if (!loadWalk(state.walk)) { clearState(); return; }
    returnTo = state.returnTo || null;
    menuBack = state.menu || null;
  } else if (isDone()) { clearState(); return; }
  const step = STEPS[state.index];
  if (!step) { clearState(); return; }
  // Only render if this step belongs to the current page. (If state points at
  // another page we likely arrived mid-navigation — leave it for that page.)
  if (!onThisPage(step)) return;
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

// Open a training walkthrough by name. `returnTo` is where Finish (or Stop)
// takes the member afterwards - normally the lesson that offered it. Moves to
// the walk's first page if it isn't this one.
export function startWalk(id, opts = {}) {
  if (!loadWalk(id)) return false;
  returnTo = opts.returnTo || null;
  menuBack = opts.menu || null;
  if (els) teardownDOM();
  const at = Math.max(0, Math.min(STEPS.length - 1, opts.at || 0));
  writeState({ active: true, index: at, walk: id, returnTo, menu: menuBack });
  const first = STEPS[at];
  if (!onThisPage(first)) { location.assign(first.href || first.path); return true; }
  nextTick(() => render(at));
  return true;
}
