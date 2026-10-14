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
import { TRAINING_WINDOW, clearTrainingWindow } from './training.js';

const LS_STATE = 'tmke.tour';        // { active: true, index: N, walk?: id, returnTo?: url }
const LS_DONE  = 'tmke.tour.done';   // fast/offline "already seen" guard

// ---------- Step definitions ----------
// target: CSS selector to spotlight, or null for a centred card (welcome/finish).
// box: false — point the card at the target without dimming or boxing it. For
//      a page the reader can already take in at a glance, where a box round
//      three things is clutter rather than help.
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

/* The commentary panel lives INSIDE the pop-out while one is open.
   It used to be the same fixed column down the right of the SCREEN that a
   walk on a real page uses, with the pop-out squeezed into what was left: on
   a 1024px window the demo got 587px and the panel took a full-height 400px
   strip beside it, so what began as a centred pop-out finished as two
   separate things. Dani, 12 Oct: "I like the idea of these being more of a
   central popout ... if we can do the new format in the popout, that would be
   better." Same panel, same order, inside the box. */
function dockCard() {
  if (!stage || !els || !els.card || !stage.body) return;
  if (els.card.parentElement === stage.body) return;
  stage.body.appendChild(els.card);
  els.card.classList.add('is-staged');
  els.root.classList.add('is-staged');
}
function undockCard() {
  if (!els || !els.card) return;
  els.card.classList.remove('is-staged');
  if (els.root) els.root.classList.remove('is-staged');
  if (els.root && els.card.parentElement !== els.root) els.root.appendChild(els.card);
}

function openStage(title) {
  if (stage) return;
  /* The frame is named TRAINING_WINDOW, which makes it the training account
     with storage of its own (BaseLayout). Emptied first, so every walkthrough
     starts as the training account fresh. Dani, 14 Oct. */
  clearTrainingWindow();
  injectStyles();
  const wrap = document.createElement('div');
  wrap.className = 'tmke-stage';
  wrap.innerHTML = `
    <div class="tmke-stage-box">
      <div class="tmke-stage-head">
        <b>The demo &middot; <span data-stage-title></span></b>
        <button type="button" class="tmke-stage-x" data-stage-x>Close demo &times;</button>
      </div>
      <div class="tmke-stage-body" data-stage-body>
        <div class="tmke-stage-screen">
          <iframe class="tmke-stage-frame" name="${TRAINING_WINDOW}" title="Studio demo" data-stage-frame></iframe>
          <img class="tmke-stage-img" alt="" data-stage-img hidden>
          <div class="tmke-stage-spin" aria-hidden="true"><i></i></div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  stage = {
    wrap, box: wrap.querySelector('.tmke-stage-box'),
    body: wrap.querySelector('[data-stage-body]'),
    frame: wrap.querySelector('[data-stage-frame]'),
    img: wrap.querySelector('[data-stage-img]'), url: null,
  };
  dockCard();   // the commentary belongs inside the pop-out, not beside it
  /* The demo's frame changes size whenever the panel docks beside it, the
     window resizes, or the layout drops to a column on a narrow screen -- and
     every measurement in positionFor is taken against that frame. Without
     this, the spotlight was computed before the browser had re-laid the box
     out: the cutout collapsed to nothing at the foot of the demo, and the
     whole thing read as dimmed with nothing lit. Dani, 12 Oct. */
  if (typeof ResizeObserver === 'function') {
    stage.ro = new ResizeObserver(() => {
      /* Re-aim as well as re-measure. The frame changing width re-flows the
         page inside it, so whatever the step is pointing at moves -- on the
         first step of a walk it ended up 961px down a 584px frame, which is
         why the cutout collapsed even once the masks were right. Bringing it
         back into view costs nothing when it has not moved. */
      const step = STEPS[activeIndex];
      if (step && step.target) {
        try {
          const t = scope().querySelector(step.target);
          if (t) scrollTargetIntoView(t);
        } catch (_) {}
      }
      scheduleReflow();
    });
    stage.ro.observe(stage.frame);
  }
  stage.box.classList.add('is-busy');
  wrap.querySelector('[data-stage-title]').textContent = title || '';
  wrap.addEventListener('click', (e) => {
    /* Close demo means close: an area walk opened from the hub tour's menu
       would otherwise go back to that menu, now that the menu is in here. */
    if (e.target === wrap || e.target.closest('[data-stage-x]')) { menuBack = null; finish(false); }
  });
  document.documentElement.style.overflow = 'hidden';
  nextTick(() => wrap.classList.add('is-in'));
}

function closeStage() {
  if (!stage) return;
  const wrap = stage.wrap;
  if (stage.ro) { try { stage.ro.disconnect(); } catch (_) {} }
  stage = null;
  /* Take the panel out before the pop-out is removed, or it goes with it and
     a walk that carries on afterwards -- Finish chaining back to a menu walk,
     say -- has no card to render into. */
  undockCard();
  document.documentElement.style.overflow = '';
  wrap.classList.remove('is-in');
  // Nothing of the training window outlives it.
  setTimeout(() => { wrap.remove(); clearTrainingWindow(); }, 280);
}

// Point the stage at a page and wait for it to be usable. Resolves either way -
// a step that can't find its target is skipped, as it always was.
/* Wait until the page inside the frame has stopped growing.
   `load` fires before the Studio has its packs, its designs and their
   pictures, so the page kept getting taller underneath the first step: it
   opened scrolled to where the target was a moment ago, then jumped as
   everything above it arrived. Dani, 12 Oct: "it loads in further down and
   then moves up." Two readings the same, 140ms apart, and it has settled;
   capped so a page that never settles does not hold the demo shut. */
function frameSettled(ms = 1200) {
  return new Promise((resolve) => {
    const started = Date.now();
    let last = -1, same = 0;
    const tick = () => {
      if (!stage || !stage.frame) return resolve();
      let h = 0;
      try { h = stage.frame.contentDocument.body.scrollHeight; } catch (_) { return resolve(); }
      // Two readings the same and it has stopped moving. Checked on the frame
      // rather than on a timer: a page that settles in 120ms waits 120ms.
      if (h === last) { if (++same >= 2) return resolve(); } else { same = 0; last = h; }
      if (Date.now() - started > ms) return resolve();
      requestAnimationFrame(() => setTimeout(tick, 60));
    };
    tick();
  });
}

/* Swap the pop-out between the live page and a picture.
   The picture is decoded before it is shown, so a step never arrives as a
   half-painted image, and the live frame is left loaded underneath: stepping
   from a picture back to a live step does not reload it. */
const SHOT_NATURAL_W = 840;   // the rig's capture width (src/pages/account/shot.astro)
async function showShot(src, y) {
  if (!stage || !stage.img) return;
  const screen = stage.img.parentElement;
  if (!src) {
    stage.img.hidden = true;
    screen.classList.remove('is-shot');
    screen.scrollTop = 0;
    stage.frame.style.visibility = '';
    return;
  }
  stage.box.classList.add('is-busy');
  stage.frame.style.visibility = 'hidden';
  const fresh = stage.img.getAttribute('src') !== src;
  if (fresh) {
    stage.img.src = src;
    try { await stage.img.decode(); } catch (_) { /* a broken path still shows the frame's background */ }
  }
  stage.img.hidden = false;
  screen.classList.add('is-shot');
  /* Scroll to the part this step is about. The picture scrolls in its box,
     so the reader can also move it up and down themselves -- the parts below
     the fold (Replace your background, the bar with Delete on it) were out of
     reach when it could only be panned (Dani, 13 Oct). A step's offset is in
     the Studio's own pixels -- the rig's frame is SHOT_NATURAL_W wide -- not
     the picture's, so it means the same thing whatever resolution the
     picture was taken at. A new picture jumps; the same one glides. */
  const shown = stage.img.getBoundingClientRect().width || SHOT_NATURAL_W;
  const k = shown / SHOT_NATURAL_W;
  const top = Math.round((y || 0) * k);
  if (fresh) screen.scrollTop = top;
  else screen.scrollTo({ top, behavior: 'smooth' });
}

function stageReady() {
  if (stage && stage.box) stage.box.classList.remove('is-busy');
}

function stageGo(url) {
  return new Promise((resolve) => {
    if (!stage) return resolve();
    if (stage.url === url) return resolve();
    stage.url = url;
    /* Covered while it loads. Steps four and five of Opening a Template are on
       different pages, so Next and Back navigated the frame and the reader
       watched the whole thing come up -- nav bar, then a jump, then the
       content. Dani, 12 Oct: "I don't want to see that because it ruins the
       illusion ... you see a little loading circle ... it doesn't actually
       move to the next one until everything is ready to move together."
       Uncovered by stageReady(), after the page has settled AND the step has
       scrolled it to the right place. */
    stage.box.classList.add('is-busy');
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      dressStage();
      frameSettled().then(resolve);
    };
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

/* A walk has a last-touched time. One left alone for three hours -- closed
   half-way, the tab shut -- is over, and is cleared rather than lying in wait
   (14 Oct). A record from before the time was kept counts as abandoned. */
const WALK_IDLE_MS = 3 * 60 * 60 * 1000;
function readState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(LS_STATE) || 'null'); } catch (_) { return null; }
  if (s && s.walk && !(Number(s.at) > Date.now() - WALK_IDLE_MS)) { clearState(); return null; }
  return s;
}
function writeState(s) {
  try { localStorage.setItem(LS_STATE, JSON.stringify(Object.assign({}, s, { at: Date.now() }))); } catch (_) {}
}
function clearState() {
  try { localStorage.removeItem(LS_STATE); } catch (_) {}
  /* Anything typed into the training account's brand kit during the walk was
     diverted here by the switch in BaseLayout, so the next walk would open on
     the last one's edits rather than on Rimberio Homes. Dropped with the walk.
     Removing it is also what makes the member's own kit readable again on the
     next line, since the switch stops answering the moment the state is gone. */
  try { localStorage.removeItem('tmke.brand.training.scratch'); } catch (_) {}
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
  /* pointer-events: none on the sheet itself, auto on the parts that are
     really there. The sheet is transparent but it still hit-tests, and at
     z 9000 it covers the pop-out at 8990 -- so Close demo, Next and Stop all
     stopped working the moment the panel moved inside the box. The masks keep
     taking clicks, which is what stops anyone poking the page behind a walk.
     Dani, 12 Oct. */
  .tmke-tour { position: fixed; inset: 0; z-index: 9000; font-family: var(--sans, system-ui, sans-serif); pointer-events: none; }
  .tmke-tour-card, .tmke-tour-top { pointer-events: auto; }
  /* During a training walk the page sits in the reader's frame: paper
     around it, a hairline card, and the course progress bar on top. */
  html.tmke-walk { background: var(--ws-bg, #f6f4f2); overflow-y: auto; }
  /* --tour-side is the width the commentary panel takes out of the right of
     the screen. The framed page gives it up so nothing being pointed at ever
     ends up underneath the panel. Dani, 9 Oct. */
  html.tmke-walk { --tour-side: 0px; }
  /* The demo pill stands down for the length of a walk. With the panel taking
     400px the nav had nowhere to put "Your SMM" and wrapped it. Dani, 9 Oct. */
  /* Somebody else's furniture, hidden for the duration of a walk - hidden, not
     answered: nothing is stored either way. The pop-out already did this for a
     framed page; a walk that runs on the page itself needs it too, or the
     cookie bar sits across the bottom of every training screenshot. */
  html.tmke-walk .dm-pill,
  html.tmke-walk #cc-banner,
  html.tmke-walk .cc-banner,
  html.tmke-walk .ae-trigger { display: none !important; }
  @media (min-width: 900px) { html.tmke-walk.has-side { --tour-side: 400px; } }
  html.tmke-walk body {
    margin: 92px calc(var(--tour-side) + clamp(16px, 2.6vw, 40px)) clamp(16px, 2.6vw, 40px) clamp(16px, 2.6vw, 40px);
    border: 1px solid var(--ws-line, rgba(28,29,34,0.13)); border-radius: 8px; overflow: clip;
    min-height: calc(100vh - 92px - clamp(16px, 2.6vw, 40px));
  }
  html.tmke-walk .editor, html.tmke-walk .ed-onboard {
    top: 92px; right: calc(var(--tour-side) + clamp(16px, 2.6vw, 40px)); bottom: clamp(16px, 2.6vw, 40px); left: clamp(16px, 2.6vw, 40px);
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
    /* A pop-out, not a second page: it filled 96vw by 94vh, which read as a
       navigation rather than something laid over the hub. Dani, 9 Oct. */
    width: min(1240px, 86vw); height: min(82vh, 860px);
    background: #fff; border-radius: 10px; box-shadow: 0 40px 90px -30px rgba(28,29,34,0.6);
    transform: translateY(10px); transition: transform .3s cubic-bezier(.2,.75,.2,1);
  }
  .tmke-stage.is-in .tmke-stage-box { transform: none; }
  /* The demo and the words that describe it, side by side inside the one box.
     The panel used to be the same fixed strip down the right of the SCREEN
     that a walk on a real page uses, and the pop-out had to give up room for
     it: on a 1024px window the demo was left 587px while a full-height panel
     stood beside it, so a centred pop-out finished as two separate things.
     Dani, 12 Oct. */
  .tmke-stage-body { flex: 1 1 auto; display: flex; min-height: 0; }
  /* Clipped: a picture panned down a long page is moved UP inside this box,
     and unclipped it slid over the plum strip above and hid its title.
     Dani, 12 Oct, the first step to pan. */
  .tmke-stage-screen { position: relative; flex: 1 1 auto; min-width: 0; display: flex; overflow: hidden; background: var(--ws-bg, #f6f4f2); }
  /* Showing a picture, the box scrolls it. A thin plum bar down the right
     says there is more below, and stays visible on a Mac, whose own
     scrollbars only appear mid-scroll (Dani, 13 Oct: "a subtle scroll
     element"). The live frame sits under the picture and is not scrolled. */
  .tmke-stage-screen.is-shot { overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: rgba(55,30,40,0.38) transparent; }
  .tmke-stage-screen.is-shot::-webkit-scrollbar { width: 8px; }
  .tmke-stage-screen.is-shot::-webkit-scrollbar-track { background: transparent; }
  .tmke-stage-screen.is-shot::-webkit-scrollbar-thumb { background: rgba(55,30,40,0.38); border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
  .tmke-stage-screen.is-shot::-webkit-scrollbar-thumb:hover { background-color: rgba(55,30,40,0.6); }
  .tmke-stage-body .tmke-stage-frame { flex: 1 1 auto; min-width: 0; transition: opacity .2s ease; }
  /* While the demo is loading or being scrolled into place, the reader sees a
     spinner over its own background rather than the page assembling itself. */
  .tmke-stage-box.is-busy .tmke-stage-frame { opacity: 0; }
  /* A step can show a PICTURE of the Studio instead of the Studio itself.
     The live frame is honest -- change the hub and the demo changes with it --
     but it brought a loading sequence, a selection that had to take, a panel
     that had to open and a scroll that had to land, every one of which could
     be caught halfway. A picture is the same every time and arrives at once,
     and nobody can edit the demo by accident. A step carrying a shot uses the
     picture; one without it stays live, so a walk can be converted a step at
     a time. Dani, 12 Oct. */
  /* Pinned to the top-left and scaled to the frame's WIDTH, so it can be
     panned: several steps often share one picture and each wants a different
     part of it on screen -- the hero, then the packs, then the pack itself --
     which is what the live frame did by scrolling. A step's shotY is how far
     down the picture to start, in the picture's own pixels. Dani, 12 Oct:
     "it kind of moves to the specific part that we're talking about." */
  .tmke-stage-img {
    position: absolute; left: 0; top: 0; width: 100%; height: auto;
    /* Fills the screen area and crops the bottom, rather than letterboxing.
       The pop-out is not always the shape the picture was taken at -- its box
       is a fraction of the window -- so fitting it whole left a white band
       under the picture on a smaller screen. Cropping the foot of a page reads as the
       page carrying on below, which is what the live frame did. */
    background: var(--ws-bg, #f6f4f2);
  }
  .tmke-stage-spin { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; }
  .tmke-stage-box.is-busy .tmke-stage-spin { display: flex; }
  .tmke-stage-spin i {
    width: 26px; height: 26px; border-radius: 50%;
    border: 2px solid rgba(28,29,34,0.14); border-top-color: var(--english-violet, #371e28);
    animation: tmke-stage-spin .7s linear infinite;
  }
  @keyframes tmke-stage-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .tmke-stage-spin i { animation-duration: 2s; } }
  .tmke-tour-card.is-staged {
    position: static; flex: 0 0 auto; align-self: stretch;
    width: clamp(300px, 34%, 400px); max-width: none; height: auto;
    border: 0; border-left: 1px solid var(--ws-line, rgba(28,29,34,0.13));
    border-radius: 0; box-shadow: none; opacity: 1; transform: none;
    padding: 26px 28px; overflow-y: auto;
    /* Anchored the same way the full-height panel is, so the words do not
       jump as the copy changes length (11 Oct). */
    justify-content: flex-start;
  }
  /* On a narrow window the box is the whole screen and there is no room for a
     column beside the demo, so the panel goes under it. */
  @media (max-width: 860px) {
    .tmke-stage-body { flex-direction: column; }
    .tmke-tour-card.is-staged {
      width: auto; align-self: auto; flex: 0 0 auto; max-height: 45%;
      border-left: 0; border-top: 1px solid var(--ws-line, rgba(28,29,34,0.13));
      padding: 18px 20px;
    }
  }
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
    position: fixed; background: rgba(16,14,16,0.82); pointer-events: auto;
    transition: top .36s cubic-bezier(.4,.7,.2,1), left .36s cubic-bezier(.4,.7,.2,1),
                width .36s cubic-bezier(.4,.7,.2,1), height .36s cubic-bezier(.4,.7,.2,1);
  }
  /* Not in the pop-out. The demo re-flows as the panel docks, so the cutout is
     measured, then measured again a frame later -- and a 360ms slide on each
     turns that into the highlight arriving late and wandering into place.
     Inside the box it simply appears where it belongs. Dani, 12 Oct. */
  .tmke-tour.is-staged .tmke-tour-mask { transition: none; }
  /* No ring. It drew a rounded burgundy outline with a glow around whatever
     was being pointed at, which read as a bubble floating over the thing
     rather than the thing itself being lit — and its 8px radius never matched
     the element underneath. The four masks already cut the shape out; the
     element simply shows at its own colour and everything else goes dark.
     Dani, 9 Oct. */
  .tmke-tour-ring { display: none; }
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
  /* A column down the right, in the strip the page has given up. It does not
     move between steps — the spotlight moves, the words stay. */
  /* Anchored, not centred. The panel itself never moved -- it is pinned to the
     full height of the strip -- but everything inside it was a centred block,
     so a step whose body wrapped to four lines instead of three pushed the
     eyebrow, the title AND the Next button up by eleven pixels. Clicking
     through a walk, that reads as the card bouncing, and the button you are
     aiming at is in a slightly different place each time.

     The block now starts at the same height on every step, so only the words
     change -- which they already do by fading, nothing moves. Measured a third
     of the way down so it sits roughly where centring used to put it, rather
     than jumping to the top of a tall column. Dani, 11 Oct: "the box should
     kind of stay where it is ... the only thing that obviously needs to be
     animated in and out is the contents of the box." */
  .tmke-tour-card.is-side {
    top: 0; right: 0; bottom: 0; left: auto;
    width: var(--tour-side, 400px); max-width: 46vw;
    display: flex; flex-direction: column; justify-content: flex-start;
    padding: clamp(34px, 33vh, 260px) 36px 34px; border-radius: 0; border-width: 0 0 0 1px;
    box-shadow: none; transform: none;
    overflow-y: auto;
  }
  html.tmke-walk .tmke-tour-card.is-side { top: 72px; }
  .tmke-tour-card.is-side.is-in { transform: none; }
  /* A way out that is always in the same corner of the panel. */
  .tmke-tour-exit {
    position: absolute; top: 14px; right: 16px; z-index: 2;
    appearance: none; background: none; border: 0; padding: 4px 6px; cursor: pointer;
    font-size: 22px; line-height: 1; color: var(--ws-faint, rgba(28,29,34,0.45));
    transition: color .2s;
  }
  .tmke-tour-exit:hover { color: var(--ws-ink, #1c1d22); }
  .tmke-tour-card:not(.is-side) .tmke-tour-exit { display: none; }
  .tmke-tour-card.is-center {
    left: 50%; top: 50%; transform: translate(-50%, calc(-50% + 8px)); width: min(520px, calc(100vw - 32px));
    text-align: left; padding: 28px 30px 22px;
  }
  .tmke-tour-card.is-center.is-in { transform: translate(-50%, -50%); }
  /* Switching sections used to tear the whole walkthrough down and build it
     again, so the panel flew out and back in. It stays put now and shows this
     while the next section loads. Dani, 9 Oct. */
  .tmke-tour-load {
    position: absolute; inset: 0; display: none;
    align-items: center; justify-content: center; gap: 7px;
  }
  .tmke-tour-card.is-loading .tmke-tour-load { display: flex; }
  /* Except in the pop-out, which has a spinner of its own over the demo. Two
     loaders at once, one of them off-centre in the panel, read as a fault.
     Dani, 12 Oct. */
  .tmke-tour-card.is-staged .tmke-tour-load { display: none !important; }
  .tmke-tour-card.is-loading > *:not(.tmke-tour-load):not(.tmke-tour-exit) {
    opacity: 0; transition: opacity .16s ease;
  }
  .tmke-tour-load span {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--ws-accent, #4a2a3c); opacity: 0.22;
    animation: tmke-tour-dot 1.1s ease-in-out infinite;
  }
  .tmke-tour-load span:nth-child(2) { animation-delay: .15s; }
  .tmke-tour-load span:nth-child(3) { animation-delay: .30s; }
  @keyframes tmke-tour-dot {
    0%, 100% { opacity: .2; transform: translateY(0); }
    50%      { opacity: .85; transform: translateY(-3px); }
  }
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
  /* The menu inside the panel: the same column as every other step, so the
     layout never changes shape mid-walk. It keeps its heading here - in the
     wide card the heading was redundant beside the cards themselves - and it
     scrolls from the top rather than sitting centred. Dani, 9 Oct. */
  .tmke-tour-card.is-side.is-menu {
    width: var(--tour-side, 400px); max-height: none;
    justify-content: flex-start; overflow: auto;
    padding: 34px 28px 22px;
  }
  .tmke-tour-card.is-side.is-menu .tmke-tour-eyebrow,
  .tmke-tour-card.is-side.is-menu .tmke-tour-title { display: block; }
  .tmke-tour-card.is-side.is-menu .tmke-tour-title { font-size: clamp(22px, 2vw, 26px); }
  /* One per row. Four columns was fine across a page; inside a 400px panel it
     became one word per line. The picture goes beside the words rather than
     above them, so a row stays short. Dani, 9 Oct. */
  .tmke-tour-menu { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; margin: 0 0 18px; }
  .tmke-tour-menu button {
    appearance: none; cursor: pointer; text-align: left;
    display: grid; grid-template-columns: 72px minmax(0, 1fr); align-items: center; gap: 12px; padding: 10px 12px;
    background: var(--ws-soft, #fbfaf8); border: 1px solid var(--ws-line, rgba(28,29,34,0.13)); border-radius: var(--ws-r, 4px);
    font-family: var(--sans, system-ui, sans-serif); color: var(--ws-ink, #1c1d22);
    transition: border-color .2s, transform .2s;
  }
  .tmke-tour-menu button:hover { border-color: rgba(28,29,34,0.22); transform: translateY(-2px); }
  .tmke-tour-menu .tmke-tour-ph {
    position: relative; aspect-ratio: 16 / 9; margin: 0; border-radius: var(--ws-r, 4px);
    border: 1px dashed rgba(28,29,34,0.22);
    background: repeating-linear-gradient(135deg, rgba(28,29,34,0.05) 0 12px, transparent 12px 24px) #f4f2f1;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ws-faint, rgba(28,29,34,0.5));
  }
  .tmke-tour-menu .tmke-tour-ph.has-art { border: 0; background-size: cover; background-position: center; color: transparent; }
  .tmke-tour-menu button b { grid-column: 2; font-family: var(--serif, Georgia, serif); font-weight: 500; font-size: 15px; line-height: 1.2; letter-spacing: -0.01em; margin-bottom: 3px; }
  .tmke-tour-menu button i { grid-column: 2; font-style: normal; font-size: 12.5px; line-height: 1.45; color: var(--ws-tx, rgba(28,29,34,0.72));
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .tmke-tour-menu button.is-done b::after { content: " ✓"; color: var(--ws-accent, #4a2a3c); }
  .tmke-tour-menu-intro { font-size: 14px; line-height: 1.5; color: var(--ws-tx, rgba(28,29,34,0.72)); margin: 0 0 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tmke-tour-menu-intro[hidden] { display: none; }
  @media (max-width: 980px) { .tmke-tour-menu { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 560px) { .tmke-tour-menu { grid-template-columns: 1fr; } html.tmke-walk body { margin: 92px 8px 8px; } }
  /* Left, on its own line directly above Stop - it is a way out of the walk,
     so it belongs with the other one rather than centred on its own.
     Dani, 11 Oct. */
  .tmke-tour-skipto {
    appearance: none; background: none; border: 0; padding: 0; cursor: pointer;
    align-self: flex-start; text-align: left; margin: 0 0 10px;
    font-family: var(--sans, system-ui, sans-serif); font-size: 12.5px; font-weight: 600; color: var(--ws-accent, #4a2a3c);
  }
  .tmke-tour-skipto:hover { text-decoration: underline; }
  .tmke-tour-foot { display: flex; align-items: center; gap: 12px; }
  /* In the side panel the buttons sit at the bottom, not under the last line
     of body text. Stop, Back and Next were following the copy: a step with a
     three-line body put Next twenty pixels higher than a step with four, so
     the button moved under the cursor between clicks. Dani, 11 Oct. */
  .tmke-tour-card.is-side:not(.is-menu) .tmke-tour-foot { margin-top: auto; }
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
      <button type="button" class="tmke-tour-exit" data-exit aria-label="Close the walkthrough">&times;</button>
      <div class="tmke-tour-load" data-load aria-hidden="true"><span></span><span></span><span></span></div>
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
    load: root.querySelector('[data-load]'),
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
    exit: root.querySelector('[data-exit]'),
    back: root.querySelector('[data-back]'),
    next: root.querySelector('[data-next]'),
  };
  els.skip.addEventListener('click', () => finish(false));
  els.exit?.addEventListener('click', () => finish(false));
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
  /* The cutout has to stay on the element when the page moves under it. A walk
     scrolls the <html> element, not the window, and that scroll was not
     reaching the window listener — so the hole stayed where it was and the
     page slid through it. Listening in three places costs nothing and covers
     the document scroller, the framed page and anything inside it. Dani, 9 Oct. */
  window.addEventListener('scroll', scheduleReflow, { passive: true, capture: true });
  document.addEventListener('scroll', scheduleReflow, { passive: true, capture: true });
  document.documentElement.addEventListener('scroll', scheduleReflow, { passive: true });
}

function teardownDOM() {
  document.documentElement.classList.remove('tmke-walk');
  document.documentElement.classList.remove('has-side');
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
// "Appear" means it has a box on screen: an element the current breakpoint
// hides is still in the DOM, and spotlighting it cut a 0x0 hole in the dim.
function rendered(el) {
  if (!el || !el.getClientRects().length) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
function waitFor(selector, timeout = 4000) {
  return new Promise((resolve) => {
    const found = scope().querySelector(selector);
    if (rendered(found)) return resolve(found);
    const start = Date.now();
    const id = setInterval(() => {
      const el = scope().querySelector(selector);
      if (rendered(el)) { clearInterval(id); return resolve(el); }
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

/* On a frame, not a timer. A 16ms setTimeout lands between paints, so during a
   scroll the dark mask was always one frame behind the page and read as a
   black box sliding in over the content. requestAnimationFrame puts the mask
   and the scroll in the same paint. Dani, 11 Oct. */
function scheduleReflow() {
  if (reflowRAF) return;
  const raf = (typeof requestAnimationFrame === 'function')
    ? requestAnimationFrame
    : (fn) => setTimeout(fn, 16);
  reflowRAF = raf(() => { reflowRAF = 0; positionFor(STEPS[activeIndex]); }) || 1;
}

/* The first step of a walk measured the page before the frame had finished
   being applied — the body gains a 92px top margin and gives up the panel's
   strip — so the cutout was placed where the nav bar had been a moment
   earlier and the nav appeared below it, dimmed. Measuring again once the
   layout has settled costs nothing and fixes it wherever else it happens.
   Dani, 9 Oct. */
function settleReflow() {
  [60, 200, 480].forEach((ms) => setTimeout(() => positionFor(STEPS[activeIndex]), ms));
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
          /* Centre what fits; top-align what does not. Centring something
             taller than its own scroller puts its top ABOVE the top of the
             panel: the brand block is longer than the rail it sits in, so the
             step called "Make This Design Yours" scrolled its own heading out
             of sight. Dani, 12 Oct: "we want to make sure that we can see Make
             This Design Yours on that second page." */
          const tooTall = tr.height > p.clientHeight - 16;
          p.scrollTop += tooTall
            ? (tr.top - pr.top) - 12
            : (tr.top - pr.top) - (p.clientHeight - tr.height) / 2;
        }
        break;
      }
      p = p.parentElement;
    }
  } catch (_) {}
  const r = t.getBoundingClientRect();
  // The usable band. Inside the stage it is the whole frame; on a framed page
  // it starts below the progress strip, so a target is never centred up into
  // the strip's 72px and then clipped by it. Dani, 9 Oct.
  const bandTop = stageOn() ? 0 : FRAME_TOP + 20;
  const vh = (stageOn() ? stageOffset().h : window.innerHeight);
  /* Inside a walk, every step puts the TOP of its target just below the band
     and the page moves to do it. Centring is wrong for a card: a tall one
     (Brand Colours is the clear case) has its heading pushed off the top of
     the screen, so the step talks about a card whose title you cannot see.
     And the old "already fully visible" test meant a card that happened to be
     part-way down the screen got no movement at all, so clicking Next changed
     the words and nothing else. Dani, 11 Oct: "the screen needs to move ...
     and it should always show the top of that box rather than the middle".

     The first-login tour keeps centring: its targets are small controls
     scattered around the page, that is the behaviour Dani called "done quite
     well", and nothing she reported is about that tour. */
  if (activeWalk) {
    const want = bandTop + 24;
    if (Math.abs(r.top - want) <= 2) return;   // already sitting there
    w.scrollTo(0, Math.max(0, (w.scrollY || 0) + r.top - want));
    return;
  }
  if (r.top >= bandTop + 16 && r.bottom <= vh - 16) return; // already fully visible
  const top = (w.scrollY || 0) + r.top + r.height / 2 - (bandTop + (vh - bandTop) / 2);
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
  /* Inside the pop-out there is no spotlight at all. The demo is a small
     window on a page, the words sit beside it, and scrolling to the part the
     step is about says which part that is -- a dimmed cutout in a 480px frame
     was more furniture than help, and it was the thing that visibly moved
     while the page settled. Dani, 12 Oct: "I actually think we can drop the
     highlight on these and just make sure that we are starting the viewpoint
     from the relevant bit to the step that we're talking about." */
  if (stageOn()) {
    els.root.classList.remove('is-center');
    card.classList.add('is-side');
    card.classList.remove('is-center');
    card.style.left = '';
    card.style.top = '';
    setMask(els.maskT, 0, 0, 0, 0); setMask(els.maskR, 0, 0, 0, 0);
    setMask(els.maskB, 0, 0, 0, 0); setMask(els.maskL, 0, 0, 0, 0);
    els.ring.style.display = 'none';
    return;
  }
  if (!step.target || step.placement === 'center') {
    // Full-screen dim, no cutout: top panel covers everything, others collapse.
    // A targeted step leaves its coordinates inline; a centred card must not
    // inherit them, or it lands wherever the last spotlight was.
    /* "We can keep this same right-hand format throughout the whole thing."
       Inside a walk, a step with no target - the opening card, the section
       menu, the closing card - uses the same panel as every other step, with
       the page simply dimmed behind it. Changing to a wide centred card
       mid-walk was another layout jump, and it is the one the section menu
       made every time. The first-login tour keeps its centred card.
       Dani, 9 Oct. */
    const sideOK = !!activeWalk && vw >= 900 && !stageOn();
    els.root.classList.add('is-center');
    card.classList.toggle('is-center', !sideOK);
    card.classList.toggle('is-side', sideOK);
    document.documentElement.classList.toggle('has-side', sideOK);
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
  /* Claim the panel's strip first. The page narrows to make room, so every
     rect below has to be read AFTER that, or the cutout is measured against a
     layout that no longer exists. */
  /* Never while the pop-out is open: `has-side` makes the PAGE give up a strip
     down its right for a fixed panel, which is what squeezed the pop-out.
     Staged, the panel is a column inside the box instead (dockCard). */
  document.documentElement.classList.toggle('has-side', vw >= 900 && !stageOn());
  const t = scope().querySelector(step.target);
  if (!t) return;
  const raw = t.getBoundingClientRect();
  // A target inside the demo stage is measured in the frame's own coordinates;
  // shift it onto the screen, and keep the cutout inside the frame.
  const off = stageOffset();
  const r = stageOn()
    ? { left: raw.left + off.x, top: raw.top + off.y, width: raw.width, height: raw.height }
    : raw;
  /* 12px all round, so the lit card has a little air inside the dark rather
     than the dark meeting its rounded corners dead on. Dani, 9 Oct. */
  const pad = step.padding != null ? step.padding : 12;
  /* The cutout stays inside the framed page. It must never run under the
     progress strip at the top, nor under the panel on the right: a target
     sitting near the top of the page had its hole clamped to y 0, which lit
     the strip and everything across it and read as "the whole top of the page
     is highlighted". Dani, 9 Oct. */
  const sideW = document.documentElement.classList.contains('has-side')
    ? (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tour-side')) || 0)
    : 0;
  const minX = stageOn() ? off.x : 0, minY = stageOn() ? off.y : FRAME_TOP;
  const maxX = stageOn() ? off.x + off.w : vw - sideW;
  const maxY = stageOn() ? off.y + off.h : vh;
  /* Clamped by its EDGES, not by its size. Taking the height from the target
     and capping that was the bug behind "one highlight covering three
     different things": a card whose top had scrolled above the strip had its
     top pulled down to the strip, kept its full height, and so reached the
     same distance further down the page -- over the next card, and the one
     after it on a short viewport. The hole is the part of the target that is
     actually inside the frame, so a half-scrolled card lights its visible
     half and nothing else. Dani, 11 Oct. */
  let hx = Math.max(minX, r.left - pad), hy = Math.max(minY, r.top - pad);
  let hw = Math.max(0, Math.min(maxX, r.left + r.width + pad) - hx);
  const hh = Math.max(0, Math.min(maxY, r.top + r.height + pad) - hy);
  /* Every full-width step lights the same column. The cards on a hub page sit
     in a gutter, but the nav bar runs edge to edge, so its cutout was wider
     than every other step's and the two read as different shapes. A
     full-bleed target is snapped to the column the cards occupy, measured off
     a card rather than hard-coded, since the gutter is responsive.
     Dani, 9 Oct. */
  if (step.snap !== false && !stageOn()) {
    const ref = scope().querySelector('.ws-hero, .lrn-sec, main > section');
    if (ref) {
      const c = ref.getBoundingClientRect();
      if (c.width > 0 && hw > c.width + pad * 2 && hx <= c.left) {
        hx = c.left - pad;
        hw = c.width + pad * 2;
      }
    }
  }

  /* A training walk never boxes: the page scrolls to the part the step is
     about and the card points at it. Only a step with no target -- the
     opening card, the Where Next menu -- dims the page. Dani, 13 Oct: "I
     prefer the designs without the highlights ... the first slide on
     everything should be darkened ... then everything should be lightened."
     The first-login tour keeps its spotlight. */
  if (step.box === false || activeWalk) {
    // No dim, no ring: the card simply points at the thing.
    setMask(els.maskT, 0, 0, 0, 0); setMask(els.maskB, 0, 0, 0, 0);
    setMask(els.maskL, 0, 0, 0, 0); setMask(els.maskR, 0, 0, 0, 0);
    els.ring.style.display = 'none';
  } else {
    // Frame the cutout with four dim panels + the ring outline.
    els.ring.style.display = '';
    /* The hole is kept inside the window. While the page scrolls, the thing
       being lit can leave the screen - and with the hole's top just below the
       fold, the bottom panel was asked for a negative height, collapsed to
       nothing, and left an uncovered strip right across the foot of the
       window. That is the line that appears across the bottom while
       scrolling, on the last step of a set, where the target sits furthest
       down the page. A target entirely off-screen now simply dims
       everything. Dani, 11 Oct. */
    const bandTop = stageOn() ? minY : 0;
    /* The dim covers the DEMO, not the window. With the commentary panel now
       inside the pop-out (dockCard), masks drawn edge to edge painted over the
       panel and the pop-out's own frame as well, and the whole thing went
       dark. Staged, the four panels are confined to the demo's rectangle, so
       the words beside it stay lit. Dani, 12 Oct. */
    const bx0 = stageOn() ? off.x : 0, bx1 = stageOn() ? off.x + off.w : vw;
    const by0 = stageOn() ? off.y : 0, by1 = stageOn() ? off.y + off.h : vh;
    if (hy >= by1 || hy + hh <= bandTop) {
      setMask(els.maskT, bx0, by0, bx1 - bx0, by1 - by0);
      setMask(els.maskR, bx1, by0, 0, 0);
      setMask(els.maskB, bx0, by1, bx1 - bx0, 0);
      setMask(els.maskL, bx0, by0, 0, by1 - by0);
      els.ring.style.display = 'none';
    } else {
    const vy = Math.max(Math.max(bandTop, by0), hy);
    const vhh = Math.max(0, Math.min(by1, hy + hh) - vy);
    setMask(els.maskT, bx0, by0, bx1 - bx0, Math.max(0, vy - by0));
    setMask(els.maskB, bx0, vy + vhh, bx1 - bx0, Math.max(0, by1 - (vy + vhh)));
    setMask(els.maskL, bx0, vy, Math.max(0, hx - bx0), vhh);
    setMask(els.maskR, hx + hw, vy, Math.max(0, bx1 - (hx + hw)), vhh);
    }
    els.ring.style.left = hx + 'px';
    els.ring.style.top = hy + 'px';
    els.ring.style.width = hw + 'px';
    els.ring.style.height = hh + 'px';
  }

  // Place the card on the roomiest side unless told otherwise.
  const cw = card.offsetWidth || 380, ch = card.offsetHeight || 220, gap = 16;
  let placement = step.placement || 'auto';
  if (placement === 'auto') {
    const space = { top: hy, bottom: vh - (hy + hh), left: hx, right: vw - (hx + hw) };
    placement = Object.keys(space).reduce((a, b) => (space[b] > space[a] ? b : a), 'bottom');
  }
  const topMin = (activeWalk && !stageOn()) ? FRAME_TOP + 12 : 16;
  const edge = (activeWalk && !stageOn()) ? 32 : 16;   // a walk's card keeps well off the frame's edge
  let left, top;
  /* The words live in a column down the right and do not move; only the
     spotlight does. Chasing the hole put the card somewhere new on every step,
     which is the popping around Dani described. Phones keep the old placement:
     there the card is nearly the full width anyway. */
  if (vw >= 900 || stageOn()) {
    card.classList.add('is-side');
    card.style.left = '';
    card.style.top = '';
    return;
  }
  card.classList.remove('is-side');
  if (placement === 'bottom') { left = hx + hw / 2 - cw / 2; top = hy + hh + gap; }
  else if (placement === 'top') { left = hx + hw / 2 - cw / 2; top = hy - ch - gap; }
  else if (placement === 'right') { left = hx + hw + gap; top = hy + hh / 2 - ch / 2; }
  else { left = hx - cw - gap; top = hy + hh / 2 - ch / 2; } // left
  // Clamp into the viewport, and below the progress strip during a walk.
  left = Math.max(edge, Math.min(left, vw - cw - edge));
  top = Math.max(topMin, Math.min(top, vh - ch - edge));
  card.style.left = left + 'px';
  card.style.top = top + 'px';
}

/* The panel's own contents: the words, the buttons, the progress, the menu.
   Lifted out of render so a step that shows a PICTURE paints exactly the
   same panel as a step that drives the live page -- one of them taking a
   different route to the same card is how they drift apart. */
function paintCard(index, step) {
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
  document.documentElement.classList.remove('has-side');
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

}

let shownIndex = 0;   // the step actually on screen, for the dev probe
/* Every render takes its own ticket. A step waits on things -- the page in the
   frame, a panel opening, something being selected -- and while it waits the
   reader can press Close demo, Stop or Next. Without this the old render woke
   up afterwards and carried on against a pop-out that had gone: it re-dressed
   the panel, re-covered the frame and generally made Close look like it had
   not worked. Dani, 12 Oct: "she just hit the button, and it should just
   instantly close." */
let renderSeq = 0;
function renderCancelled(ticket) { return ticket !== renderSeq; }
async function render(index) {
  const ticket = ++renderSeq;
  shownIndex = index;
  const step = STEPS[index];
  if (!step) return finish(true);
  activeIndex = index;
  const freshMount = !els;
  if (!els) buildDOM();
  /* The pop-out opens before the panel is built, so its own dockCard found
     nothing to move. Dock here as well, every render: cheap when it is already
     in place, and it covers a walk that opens a stage part-way through. */
  if (stageOn()) {
    dockCard();
    /* Covered for every step, not only the ones that load a new page. A step
       on the SAME page still opens a panel and scrolls the frame, and Dani
       watched step two "load and then flick to the correct position". It is
       uncovered by stageReady() at the end of render, once it is where it
       belongs. */
    if (stage && stage.box) stage.box.classList.add('is-busy');
    settleReflow();
  } else undockCard();
  /* Landing on a new page mid-walk. The panel was on screen a moment ago on
     the page before, so paint it straight away in its loading state instead of
     animating it in: across a page change the section switch still reads as
     one panel that stays put and loads. Dani, 9 Oct. */
  if (freshMount && activeWalk && !stageOn()) {
    const vw = window.innerWidth, vh = window.innerHeight;
    document.documentElement.classList.add('tmke-walk');
    setMask(els.maskT, 0, 0, vw, vh);
    setMask(els.maskR, vw, 0, 0, 0);
    setMask(els.maskB, 0, vh, vw, 0);
    setMask(els.maskL, 0, 0, 0, vh);
    if (step.target && step.placement !== 'center' && vw >= 900) {
      document.documentElement.classList.add('has-side');
      els.card.classList.add('is-side');
    }
    els.card.classList.add('is-loading', 'is-in');
  }

  // Run the previous step's cleanup, then this step's setup.
  if (lastPostAction) { try { lastPostAction(); } catch (_) {} lastPostAction = null; }
  /* A panel already on screen stays exactly where it is and loads; only a
     first mount animates in. Dani, 9 Oct: "the panel should stay where it is.
     We should just go for a loading screen while it switches." */
  if (els.card.classList.contains('is-in')) els.card.classList.add('is-loading');
  else els.card.classList.remove('is-in');

  if (step.preAction) { try { await step.preAction(); } catch (_) {} }
  if (renderCancelled(ticket)) return;
  lastPostAction = step.postAction || null;

  // A staged walk: make sure the pop-out is showing the page this step is about
  // before anything is looked for inside it.
  if (stageOn()) {
    if (step.shot) {
      /* A picture of the Studio rather than the Studio itself. Nothing to
         load, open, select or scroll: the step is its own illustration, so
         everything below this is skipped and the panel paints beside it. */
      await showShot(step.shot, step.shotY);
      if (renderCancelled(ticket)) return;
      paintCard(index, step);
      positionFor(step);
      els.card.classList.remove('is-loading');
      nextTick(() => els.card.classList.add('is-in'));
      nextTick(stageReady);
      return;
    }
    showShot(null);
    /* The step's own page, or the walk's. `path` counts too: the walks that
       used to run on the member's real pages name their page that way. */
    const want = step.href || (step.path && step.path !== '*' ? step.path : '')
      || (WALKS[activeWalk] && WALKS[activeWalk].stage);
    if (want) await stageGo(want);
    if (renderCancelled(ticket)) return;
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
    /* Ask until it takes. Waiting for the hook to EXIST is not the same as
       waiting for there to be anything to select: the editor publishes the
       hook as it boots, well before the design's elements are on the canvas,
       so the one call landed on an empty page and nothing was ever selected.
       The step then sat out its nine-second wait for `.ed-element.is-selected`
       and skipped -- a step that says "this one is selected now" with nothing
       selected. Dani, 12 Oct. */
    const wantsSelection = typeof step.select === 'string' && step.select !== '';
    /* Wait for the DESIGN, not just the hook. The editor publishes the hook as
       it boots and shows "Opening your design..." while it fetches the
       artwork, so a page with no elements on it yet is a page with nothing to
       select -- and a selection made on a half-built canvas is wiped when the
       design finishes arriving. */
    if (wantsSelection) await waitFor('.ed-element', 9000);
    if (renderCancelled(ticket)) return;
    /* Bounded by the clock, not by a retry count. Twelve attempts at half a
       second each is six seconds a step, which is what Dani was waiting
       through on the steps that ask for a shape: when the selection cannot be
       made the walk should carry on, not sit there. A step is still a step
       with nothing selected -- the copy reads a shade oddly, which is far
       better than the demo appearing to hang. Dani, 12 Oct. */
    const until = Date.now() + 1500;
    do {
      try { if (w && w.__TMKE_TRAINING_SELECT__) w.__TMKE_TRAINING_SELECT__(step.select); } catch (_) {}
      await new Promise((r) => setTimeout(r, 180));
      if (renderCancelled(ticket)) return;
      if (!wantsSelection) break;
      let got = null;
      try { got = scope().querySelector('.ed-element.is-selected'); } catch (_) {}
      if (got) break;
    } while (Date.now() < until);
  }

  if (step.open) {
    const opener = await waitFor(step.open, stageOn() ? 6000 : 2000);
    if (renderCancelled(ticket)) return;
    if (opener) {
      try { opener.click(); } catch (_) {}
      await new Promise((r) => setTimeout(r, 220));
    }
  }

  // Wait for / validate the target. Skip the step cleanly if it never shows.
  if (step.target) {
    // The framed page is still booting on the first step of a staged walk, so
    // give it longer than a target on a page that is already up.
    /* A step marked `optional` belongs to one branch of a page that renders two
       (the SMM page shows a client their plan, and everyone else the packages).
       The other branch is in the DOM but collapsed, so waiting the full four
       seconds for it buys a dead pause and then skips anyway. Look once and
       move on. Dani, 9 Oct. */
    const t = await waitFor(step.target, step.optional ? 0 : (stageOn() ? 9000 : 4000));
    if (renderCancelled(ticket)) return;
    /* Nothing is on show until stageReady(), so a step no longer has to sit
       through a fixed pause to look calm: it is covered until it is right.
       Dani, 12 Oct: "there's just a really long load time between all of
       them." */
    if (!t) return advance(index, +1, true);
    scrollTargetIntoView(t);
    await new Promise((r) => setTimeout(r, 120)); // let layout settle
  }

  paintCard(index, step);
  positionFor(step);
  settleReflow();
  els.card.classList.remove('is-loading');
  nextTick(() => els.card.classList.add('is-in'));
  /* Only now: the page has loaded, stopped growing, and been scrolled to the
     part this step is about. Uncovering any earlier is what let the reader see
     the demo arrive with its nav bar showing and then skip up. Dani, 12 Oct. */
  if (stageOn()) nextTick(stageReady);
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
  renderSeq++;   // whatever step is mid-flight, it is not wanted now
  if (lastPostAction) { try { lastPostAction(); } catch (_) {} lastPostAction = null; }
  const wasStaged = stageOn();
  /* An area walk going back to the hub tour's menu keeps the pop-out open:
     the menu is in it too, so closing it would only flash the lesson. */
  const toMenu = !!(activeWalk && menuBack && WALKS[menuBack] && WALKS[menuBack].stage && wasStaged);
  if (!toMenu) closeStage();
  if (activeWalk) {
    clearState();
    const back = returnTo, menu = menuBack, walked = activeWalk;
    if (completed) markWalked(walked);
    activeWalk = null; returnTo = null; menuBack = null; STEPS = FIRST_LOGIN;
    // An area walk opened from a menu goes back to that menu, wherever we
    // are now; the menu itself, and a walk opened from a lesson, go home.
    // The panel holds its place for that, exactly as it does on the way in.
    if (menu && WALKS[menu]) {
      const at = WALKS[menu].steps.findIndex((st) => st.menu);
      if (els) els.card.classList.add('is-loading');
      startWalk(menu, { returnTo: back, at: at >= 0 ? at : 0 });
      return;
    }
    if (els) { els.card.classList.remove('is-in'); setTimeout(teardownDOM, 260); }
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
  /* Keep the overlay. Tearing it down here is what made a section change pop
     the panel out and back in. Dani, 9 Oct. */
  if (els) els.card.classList.add('is-loading');
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

// ---------- The dev harness ----------
// Every step points at a CSS selector, and a selector that goes stale fails
// quietly: the walk skips the step, or lights the wrong thing. Checking that by
// eye, step by step, across every guide, is the part that doesn't scale.
//
// In dev only, the engine is put on the window so a walk can be driven and
// measured from the console: start it, step through it, and read back where the
// spotlight actually landed. `import.meta.env.DEV` is false in the built site,
// so none of this ships. Dani, 9 Oct.
function probeStep() {
  if (!els) return { active: false };
  const step = STEPS[shownIndex];
  if (!step) return { active: false };
  const num = (el, k) => parseFloat(el.style[k]) || 0;
  const box = (el) => ({ x: num(el, 'left'), y: num(el, 'top'), w: num(el, 'width'), h: num(el, 'height') });
  const T = box(els.maskT), B = box(els.maskB), L = box(els.maskL), R = box(els.maskR);
  const vw = window.innerWidth, vh = window.innerHeight;
  /* A step can ask for no cutout at all (box: false) - the card simply sits
     beside the thing. There is no hole to check, and reporting the absent one
     as "collapsed" sent me chasing a step that was working. */
  /* A staged step asks for no cutout at all -- the pop-out does not use one --
     so there is no hole to judge, and reporting the absent one as collapsed
     sent me chasing a step that was working. */
  const centred = !step.target || step.placement === 'center' || step.box === false || stageOn();
  const hole = centred ? null : {
    x: L.x + L.w, y: T.y + T.h,
    w: Math.max(0, R.x - (L.x + L.w)), h: Math.max(0, B.y - (T.y + T.h)),
  };
  const t = step.target ? scope().querySelector(step.target) : null;
  const card = els.card.getBoundingClientRect();
  const notes = [];
  if (step.target && !t) notes.push('target missing: ' + step.target);
  if (hole) {
    if (hole.w <= 0 || hole.h <= 0) notes.push('hole collapsed');
    if (hole.y < FRAME_TOP - 1) notes.push('hole runs under the progress strip (y ' + Math.round(hole.y) + ')');
    if (hole.w * hole.h > vw * vh * 0.7) notes.push('hole covers most of the screen');
    if (hole.y + hole.h > vh + 1) notes.push('hole runs off the bottom');
    const sideL = card.width && els.card.classList.contains('is-side') ? card.left : vw;
    if (hole.x + hole.w > sideL + 1) notes.push('hole runs under the side panel');
  }
  if (t) {
    const r = t.getBoundingClientRect();
    const off = stageOffset();
    const top = stageOn() ? r.top + off.y : r.top;
    if (r.width === 0 || r.height === 0) notes.push('target has no size');
    else if (top < FRAME_TOP || top > vh - 24) notes.push('target is not in the visible band (top ' + Math.round(top) + ')');
  }
  return {
    active: true, walk: activeWalk, index: shownIndex, of: STEPS.length,
    title: step.title, target: step.target || null, placement: step.placement || null,
    hole, card: { x: Math.round(card.left), y: Math.round(card.top), w: Math.round(card.width), h: Math.round(card.height) },
    ok: notes.length === 0, notes,
  };
}

try {
  if (import.meta.env && import.meta.env.DEV && typeof window !== 'undefined') {
    window.__walk = {
      list: () => Object.keys(WALKS).map((id) => ({ id, title: WALKS[id].title, steps: WALKS[id].steps.length, stage: !!WALKS[id].stage })),
      steps: (id) => (WALKS[id] ? WALKS[id].steps.map((s, i) => ({ i, title: s.title, path: s.path || null, target: s.target || null })) : []),
      start: (id, at) => startWalk(id, { at: at || 0 }),
      goto: (i) => render(i),
      stop: () => finish(false),
      probe: probeStep,
      // Measure with the motion off. A card caught mid-transition reports the
      // position it is travelling through, not the one it lands on, and reads
      // as a bug that isn't there.
      still(on = true) {
        const id = 'tmke-walk-still';
        const d = document, had = d.getElementById(id);
        if (!on) { if (had) had.remove(); return false; }
        if (had) return true;
        const el = d.createElement('style');
        el.id = id;
        el.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
        d.head.appendChild(el);
        return true;
      },
    };
  }
} catch (_) {}
