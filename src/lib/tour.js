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
// open: optional selector clicked before the step shows, so a panel the step
//       talks about is actually open behind the spotlight.
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
const FRAME_TOP = 72;    // the progress strip's height; the framed page starts below it
const onThisPage = (step) => step.path === '*' || step.path === path();
const LS_WALKED = 'tmke.walked';  // which area walks this member has finished (this browser)
function walkedSet() { try { return new Set(JSON.parse(localStorage.getItem(LS_WALKED) || '[]')); } catch (_) { return new Set(); } }
function markWalked(id) { try { const st = walkedSet(); st.add(id); localStorage.setItem(LS_WALKED, JSON.stringify([...st])); } catch (_) {} }
const PRE = { dismissEditorOnboarding: () => dismissEditorOnboarding() };

// ---------- The demo stage ----------
// A walk can carry `stage: "<url>"`: instead of navigating the member away from
// the lesson, the page it talks about is loaded into a pop-out over the course
// and every step's target is found inside it. A step's own `href` moves the
// stage to another page mid-walk.
let stage = null;        // { wrap, box, frame, url }
const stageOn = () => !!(stage && stage.frame);
const scope = () => {
  if (!stageOn()) return document;
  try { return stage.frame.contentDocument || document; } catch (_) { return document; }
};
const scopeWin = () => {
  if (!stageOn()) return window;
  try { return stage.frame.contentWindow || window; } catch (_) { return window; }
};
// Where the framed page sits on the screen, so a rect inside it can be drawn
// over it by the spotlight.
const stageOffset = () => {
  if (!stageOn()) return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  const r = stage.frame.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

function openStage(title) {
  if (stage) return;
  injectStyles();
  const wrap = document.createElement('div');
  wrap.className = 'tmke-stage';
  wrap.innerHTML = `
    <div class="tmke-stage-box">
      <div class="tmke-stage-head">
        <b>The demo &middot; <span data-stage-title></span></b>
        <button type="button" class="tmke-stage-x" data-stage-x>Close demo &times;</button>
      </div>
      <iframe class="tmke-stage-frame" title="Studio demo" data-stage-frame></iframe>
    </div>`;
  document.body.appendChild(wrap);
  stage = {
    wrap, box: wrap.querySelector('.tmke-stage-box'),
    frame: wrap.querySelector('[data-stage-frame]'), url: null,
  };
  wrap.querySelector('[data-stage-title]').textContent = title || '';
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-stage-x]')) finish(false);
  });
  document.documentElement.style.overflow = 'hidden';
  nextTick(() => wrap.classList.add('is-in'));
}

function closeStage() {
  if (!stage) return;
  const wrap = stage.wrap;
  stage = null;
  document.documentElement.style.overflow = '';
  wrap.classList.remove('is-in');
  setTimeout(() => wrap.remove(), 280);
}

// Point the stage at a page and wait for it to be usable. Resolves either way -
// a step that can't find its target is skipped, as it always was.
function stageGo(url) {
  return new Promise((resolve) => {
    if (!stage) return resolve();
    if (stage.url === url) return resolve();
    stage.url = url;
    let done = false;
    const go = () => { if (done) return; done = true; dressStage(); setTimeout(resolve, 500); };
    stage.frame.addEventListener('load', go, { once: true });
    setTimeout(go, 14000);
    stage.frame.src = url;
  });
}

// The framed page is the real one, floating bits and all. Inside a lesson the
// cookie bar and the assistant bubble are somebody else's furniture, so they
// are hidden for the demo - hidden, not answered: nothing is stored.
function dressStage() {
  const d = scope();
  if (!d || d === document) return;
  try {
    if (d.getElementById('tmke-stage-dress')) return;
    const st = d.createElement('style');
    st.id = 'tmke-stage-dress';
    st.textContent = '#cc-banner, .cc-banner, .ae-trigger, .dm-pill { display: none !important; }';
    (d.head || d.documentElement).appendChild(st);
  } catch (_) {}
}
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
  /* During a training walk the page sits in the reader's frame: paper
     around it, a hairline card, and the course progress bar on top. */
  html.tmke-walk { background: var(--ws-bg, #f6f4f2); overflow-y: auto; }
  html.tmke-walk body {
    margin: 92px clamp(16px, 2.6vw, 40px) clamp(16px, 2.6vw, 40px);
    border: 1px solid var(--ws-line, rgba(28,29,34,0.13)); border-radius: 8px; overflow: clip;
    min-height: calc(100vh - 92px - clamp(16px, 2.6vw, 40px));
  }
  html.tmke-walk .editor, html.tmke-walk .ed-onboard {
    top: 92px; right: clamp(16px, 2.6vw, 40px); bottom: clamp(16px, 2.6vw, 40px); left: clamp(16px, 2.6vw, 40px);
    border-radius: 8px; overflow: hidden;
  }
  /* Centred cards sit in the middle of the framed page, not the whole screen. */
  html.tmke-walk .tmke-tour-card.is-center { top: calc(72px + (100vh - 72px) / 2); }
  /* The demo stage: the real page, inside the lesson. Nearly full screen, but
     plainly a pop-out - the course is still there behind it, and clicking the
     paper around it (or Close) ends the demo. */
  .tmke-stage {
    position: fixed; inset: 0; z-index: 8990; display: flex; align-items: center; justify-content: center;
    padding: clamp(10px, 2.4vh, 28px); background: rgba(28,29,34,0.55);
    opacity: 0; transition: opacity .28s ease;
  }
  .tmke-stage.is-in { opacity: 1; }
  .tmke-stage-box {
    position: relative; display: flex; flex-direction: column; overflow: hidden;
    width: min(1620px, 96vw); height: min(94vh, 1040px);
    background: #fff; border-radius: 10px; box-shadow: 0 40px 90px -30px rgba(28,29,34,0.6);
    transform: translateY(10px); transition: transform .3s cubic-bezier(.2,.75,.2,1);
  }
  .tmke-stage.is-in .tmke-stage-box { transform: none; }
  .tmke-stage-head {
    flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 16px;
    height: 46px; padding: 0 10px 0 18px; background: var(--english-violet, #371e28); color: #fff;
  }
  .tmke-stage-head b {
    font-family: var(--sans, system-ui, sans-serif); font-size: 10.5px; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.78);
  }
  .tmke-stage-head b span { color: #fff; }
  .tmke-stage-x {
    appearance: none; cursor: pointer; border: 1px solid rgba(255,255,255,0.35); background: none; color: #fff;
    border-radius: 999px; padding: 6px 14px;
    font-family: var(--sans, system-ui, sans-serif); font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  }
  .tmke-stage-x:hover { background: rgba(255,255,255,0.14); }
  .tmke-stage-frame { flex: 1 1 auto; width: 100%; border: 0; display: block; background: #fff; }
  @media (max-width: 700px) { .tmke-stage { padding: 0; } .tmke-stage-box { width: 100vw; height: 100vh; border-radius: 0; } }
  .tmke-tour-top {
    position: fixed; top: 0; left: 0; right: 0; height: 72px; z-index: 2;
    padding: 18px clamp(16px, 2.6vw, 40px) 0; background: var(--ws-bg, #f6f4f2);
    font-family: var(--sans, system-ui, sans-serif);
  }
  .tmke-tour-top[hidden] { display: none; }
  .tmke-tour-top-bar { height: 4px; border-radius: 999px; background: var(--ws-line, rgba(28,29,34,0.13)); overflow: hidden; }
  .tmke-tour-top-fill { display: block; height: 100%; width: 0; border-radius: 999px; background: var(--ws-accent, #4a2a3c); transition: width .55s cubic-bezier(.2,.7,.3,1); }
  .tmke-tour-top-meta { display: flex; justify-content: space-between; margin-top: 9px; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; color: var(--ws-faint, rgba(28,29,34,0.5)); }
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
  .tmke-tour-title em { font-style: normal; color: inherit; }
  .tmke-tour-body {
    font-family: var(--sans, system-ui, sans-serif); font-size: 14px; line-height: 1.45;
    color: var(--ws-tx, rgba(28,29,34,0.72)); margin: 0 0 16px;
  }
  .tmke-tour-card.is-center .tmke-tour-body { max-width: 52ch; }
  /* The menu: a page of cards, one per area, like a part of a guide. */
  .tmke-tour-card.is-menu {
    width: min(1180px, calc(100vw - 2 * clamp(16px, 2.6vw, 40px) - 24px)); max-height: calc(100vh - 72px - 56px); overflow: auto;
    padding: clamp(22px, 2.4vw, 36px) clamp(22px, 2.4vw, 36px) 22px;
  }
  .tmke-tour-card.is-menu .tmke-tour-eyebrow, .tmke-tour-card.is-menu .tmke-tour-title, .tmke-tour-card.is-menu .tmke-tour-body { display: none; }
  .tmke-tour-menu { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0 0 18px; }
  .tmke-tour-menu button {
    appearance: none; cursor: pointer; text-align: left;
    display: flex; flex-direction: column; padding: 14px;
    background: var(--ws-soft, #fbfaf8); border: 1px solid var(--ws-line, rgba(28,29,34,0.13)); border-radius: var(--ws-r, 4px);
    font-family: var(--sans, system-ui, sans-serif); color: var(--ws-ink, #1c1d22);
    transition: border-color .2s, transform .2s;
  }
  .tmke-tour-menu button:hover { border-color: rgba(28,29,34,0.22); transform: translateY(-2px); }
  .tmke-tour-menu .tmke-tour-ph {
    position: relative; aspect-ratio: 16 / 9; margin: 0 0 12px; border-radius: var(--ws-r, 4px);
    border: 1px dashed rgba(28,29,34,0.22);
    background: repeating-linear-gradient(135deg, rgba(28,29,34,0.05) 0 12px, transparent 12px 24px) #f4f2f1;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ws-faint, rgba(28,29,34,0.5));
  }
  .tmke-tour-menu .tmke-tour-ph.has-art { border: 0; background-size: cover; background-position: center; color: transparent; }
  .tmke-tour-menu button b { font-family: var(--serif, Georgia, serif); font-weight: 500; font-size: 17px; line-height: 1.2; letter-spacing: -0.01em; margin-bottom: 5px; }
  .tmke-tour-menu button i { font-style: normal; font-size: 13px; line-height: 1.55; color: var(--ws-tx, rgba(28,29,34,0.72)); }
  .tmke-tour-menu button.is-done b::after { content: " ✓"; color: var(--ws-accent, #4a2a3c); }
  .tmke-tour-menu-intro { font-size: 14px; line-height: 1.5; color: var(--ws-tx, rgba(28,29,34,0.72)); margin: 0 0 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tmke-tour-menu-intro[hidden] { display: none; }
  @media (max-width: 980px) { .tmke-tour-menu { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 560px) { .tmke-tour-menu { grid-template-columns: 1fr; } html.tmke-walk body { margin: 92px 8px 8px; } }
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
    <div class="tmke-tour-top" data-top hidden>
      <div class="tmke-tour-top-bar"><span class="tmke-tour-top-fill" data-top-fill></span></div>
      <div class="tmke-tour-top-meta"><span data-top-step></span><span data-top-pct></span></div>
    </div>
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
      <p class="tmke-tour-menu-intro" data-menu-intro hidden></p>
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
    menuIntro: root.querySelector('[data-menu-intro]'),
    top: root.querySelector('[data-top]'),
    topFill: root.querySelector('[data-top-fill]'),
    topStep: root.querySelector('[data-top-step]'),
    topPct: root.querySelector('[data-top-pct]'),
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
  document.documentElement.classList.remove('tmke-walk');
  closeStage();
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
    const found = scope().querySelector(selector);
    if (found) return resolve(found);
    const start = Date.now();
    const id = setInterval(() => {
      const el = scope().querySelector(selector);
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
  const w = scopeWin();
  // Panels scroll inside themselves (the editor's tool panel is the obvious
  // one), so bring the target into view in its own scroller first - scrolling
  // the page alone leaves it exactly where it was, and the spotlight lands on
  // nothing.
  try {
    let p = t.parentElement;
    while (p && p !== t.ownerDocument.body) {
      const cs = t.ownerDocument.defaultView.getComputedStyle(p);
      const scrolls = /auto|scroll|overlay/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 4;
      if (scrolls) {
        const pr = p.getBoundingClientRect(), tr = t.getBoundingClientRect();
        if (tr.top < pr.top + 8 || tr.bottom > pr.bottom - 8) {
          p.scrollTop += (tr.top - pr.top) - (p.clientHeight - tr.height) / 2;
        }
        break;
      }
      p = p.parentElement;
    }
  } catch (_) {}
  const r = t.getBoundingClientRect();
  const vh = (stageOn() ? stageOffset().h : window.innerHeight);
  if (r.top >= 16 && r.bottom <= vh - 16) return; // already fully visible
  const top = (w.scrollY || 0) + r.top + r.height / 2 - vh / 2;
  // Instant, not smooth: the background is dimmed so the scroll is barely
  // perceptible, and instant lands the spotlight reliably across browsers.
  w.scrollTo(0, Math.max(0, top));
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
    // A targeted step leaves its coordinates inline; a centred card must not
    // inherit them, or it lands wherever the last spotlight was.
    els.root.classList.add('is-center');
    card.classList.add('is-center');
    card.style.left = '';
    card.style.top = '';
    setMask(els.maskT, 0, 0, vw, vh);
    setMask(els.maskR, vw, 0, 0, 0);
    setMask(els.maskB, 0, vh, vw, 0);
    setMask(els.maskL, 0, 0, 0, vh);
    return;
  }
  els.root.classList.remove('is-center');
  card.classList.remove('is-center');
  const t = scope().querySelector(step.target);
  if (!t) return;
  const raw = t.getBoundingClientRect();
  // A target inside the demo stage is measured in the frame's own coordinates;
  // shift it onto the screen, and keep the cutout inside the frame.
  const off = stageOffset();
  const r = stageOn()
    ? { left: raw.left + off.x, top: raw.top + off.y, width: raw.width, height: raw.height }
    : raw;
  const pad = step.padding != null ? step.padding : 6;
  const minX = stageOn() ? off.x : 0, minY = stageOn() ? off.y : 0;
  const maxX = stageOn() ? off.x + off.w : vw, maxY = stageOn() ? off.y + off.h : vh;
  const hx = Math.max(minX, r.left - pad), hy = Math.max(minY, r.top - pad);
  const hw = Math.max(0, Math.min(maxX - hx, r.width + pad * 2));
  const hh = Math.max(0, Math.min(maxY - hy, r.height + pad * 2));

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
  // Clamp into the viewport, and below the progress strip during a walk.
  const topMin = (activeWalk && !stageOn()) ? FRAME_TOP + 12 : 16;
  const edge = (activeWalk && !stageOn()) ? 32 : 16;   // a walk's card keeps well off the frame's edge
  left = Math.max(edge, Math.min(left, vw - cw - edge));
  top = Math.max(topMin, Math.min(top, vh - ch - edge));
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

  // A staged walk: make sure the pop-out is showing the page this step is about
  // before anything is looked for inside it.
  if (stageOn()) {
    const want = step.href || (WALKS[activeWalk] && WALKS[activeWalk].stage);
    if (want) await stageGo(want);
  }

  // `open`: a control to click before the step shows - a rail button whose
  // panel the step is about, say - so the reader is looking at the thing the
  // card describes rather than being told to go and find it. Clicking the same
  // button twice is harmless, so stepping back through a walk still works.
  // `select`: pick something on the demo canvas, so the step can talk about a
  // selected photo or line of text - and its handles and controls are there to
  // be seen. An empty string clears the selection again.
  if (step.select !== undefined) {
    const w = scopeWin();
    for (let i = 0; i < 24 && !(w && w.__TMKE_TRAINING_SELECT__); i++) await new Promise((r) => setTimeout(r, 150));
    try { if (w && w.__TMKE_TRAINING_SELECT__) w.__TMKE_TRAINING_SELECT__(step.select); } catch (_) {}
    await new Promise((r) => setTimeout(r, 200));
  }

  if (step.open) {
    const opener = await waitFor(step.open, stageOn() ? 6000 : 2000);
    if (opener) {
      try { opener.click(); } catch (_) {}
      await new Promise((r) => setTimeout(r, 220));
    }
  }

  // Wait for / validate the target. Skip the step cleanly if it never shows.
  if (step.target) {
    // The framed page is still booting on the first step of a staged walk, so
    // give it longer than a target on a page that is already up.
    const t = await waitFor(step.target, stageOn() ? 9000 : 4000);
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
  // Training walks run inside the reader's frame with its progress bar - unless
  // the walk has a stage, where the pop-out's own header says where you are and
  // the reader is left exactly as it was behind it.
  if (activeWalk && !stageOn()) {
    document.documentElement.classList.add('tmke-walk');
    const walkTitle = (WALKS[activeWalk] && WALKS[activeWalk].title) || '';
    const pct = Math.round(((index + 1) / STEPS.length) * 100);
    els.top.hidden = false;
    els.topFill.style.width = pct + '%';
    els.topStep.textContent = step.menu ? walkTitle : `${walkTitle} · Step ${index + 1} of ${STEPS.length}`;
    els.topPct.textContent = step.menu ? '' : pct + '%';
    els.progress.textContent = '';
  } else {
    els.top.hidden = true;
    document.documentElement.classList.remove('tmke-walk');
  }
  // A menu step: a page of cards, one per area, Done instead of Next.
  els.skipto.hidden = !step.skipToMenu;
  els.card.classList.toggle('is-menu', !!step.menu);
  if (step.menu) {
    const done = walkedSet();
    els.menu.innerHTML = step.menu.map((m) =>
      `<button type="button" data-walk="${m.walk}" class="${done.has(m.walk) ? 'is-done' : ''}">` +
        `<span class="tmke-tour-ph${m.art ? ' has-art' : ''}"${m.art ? ` style="background-image:url('${m.art}')"` : ''}>Image</span>` +
        `<b>${m.label}</b>${m.note ? `<i>${m.note}</i>` : ''}</button>`).join('');
    els.menu.hidden = false;
    els.menuIntro.textContent = step.body || '';
    els.menuIntro.hidden = !step.body;
    els.next.textContent = 'Done';
    els.back.style.visibility = 'hidden';
  } else {
    els.menu.hidden = true;
    els.menuIntro.hidden = true;
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
  if (!stageOn() && !onThisPage(next)) {
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
  const wasStaged = stageOn();
  closeStage();
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
    // A staged walk never left the lesson, so there is nothing to go back to.
    if (back && !wasStaged) setTimeout(() => location.assign(back), completed ? 280 : 0);
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
  // The demo stage loads real hub pages in a frame. They run this too, and the
  // saved state would have them start the walk again inside the pop-out.
  try { if (window.self !== window.top) return; } catch (_) { return; }
  const state = readState();
  if (!state || !state.active) return;
  if (state.walk) {
    if (!loadWalk(state.walk)) { clearState(); return; }
    returnTo = state.returnTo || null;
    menuBack = state.menu || null;
  } else if (isDone()) { clearState(); return; }
  const step = STEPS[state.index];
  if (!step) { clearState(); return; }
  // A staged walk lives in a pop-out on the lesson; after a reload there is no
  // pop-out to resume into, so let it go rather than half-starting it.
  if (state.walk && WALKS[state.walk] && WALKS[state.walk].stage) { clearState(); return; }
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
  const walk = WALKS[id];
  // A walk with a stage runs inside the lesson: the page opens in a pop-out
  // over the course rather than taking the member off it.
  if (walk && walk.stage) {
    writeState({ active: true, index: at, walk: id, returnTo, menu: menuBack });
    openStage(walk.title || '');
    nextTick(() => render(at));
    return true;
  }
  writeState({ active: true, index: at, walk: id, returnTo, menu: menuBack });
  const first = STEPS[at];
  if (!onThisPage(first)) { location.assign(first.href || first.path); return true; }
  nextTick(() => render(at));
  return true;
}
