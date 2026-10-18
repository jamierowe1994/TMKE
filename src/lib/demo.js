/**
 * The Member Hub demo.
 *
 * A visitor gives a name and email at /demo and walks around the hub without
 * an account: the dashboard, the Studio, the Planner, the Shop and the
 * Getting Started guides. Anything that would save, download, buy or belong
 * to a real member is locked: the action opens a small note offering the
 * real thing. The demo lives in localStorage; there is no session behind it,
 * so every page's "no session" preview path is what the visitor sees.
 */
const KEY = "tmke_demo";
const JOIN_URL = "/join";

/**
 * Put the demo's brand kit back.
 *
 * The hub clears the brand cache whenever it finds no session (supabase.js),
 * which is every page of the demo — so a branded demo lost its kit on the
 * first page that looked, and the Studio, the editor and the caption
 * generator then had nothing to work with. The demo's own copy is kept under
 * tmke.brand.demo and never touched, so this restores from that.
 * Runs at import, before the page reads the cache. Dani, 8 Oct.
 */
/* Two different things, kept apart on purpose.

   THE DEMO ACCOUNT  (/demo?go=1) is what a visitor is given to try the hub.
   A kit built in it lives at tmke.brand.demo and is DESIGNED to be adopted by
   the first real account that signs in here (brand-cache claimDemoBrandKit) -
   they built it, they keep it.

   THE TRAINING ACCOUNT  (/demo?go=1&brand=demo) is ours: Alex Mercer of
   Rimberio Homes, used to film and photograph the guides. Its kit lives at
   tmke.brand.training and is NEVER adopted by anybody, because a real member
   signing in on this browser must not inherit a fictional agency.

   They shared tmke.brand.demo until 11 Oct, which made one demo's whole
   purpose into the other's contamination - and every fix to one broke the
   other. Dani: "until we split out those two things, you're going to keep
   running into problems." */
const TRAINING_KIT = "tmke.brand.training";

/* Which key holds the kit for whatever is running here: a member's own, the
   demo account's (adoptable), or the training account's (never adopted).
   Exported so every reader asks the same question - the profile page read
   "tmke.brand.demo" for ANY demo, so when the training account moved to its
   own key the Brand kit page quietly fell back to the real member's. */
export function brandKitKey() {
  if (!isDemo()) return "tmke.brand";
  return isTrainingDemo() ? TRAINING_KIT : "tmke.brand.demo";
}
function demoKitKey() {
  return isTrainingDemo() ? TRAINING_KIT : "tmke.brand.demo";
}

export function restoreDemoBrand() {
  try {
    if (inAdminStudio()) return false;                     // the admin Studio is never the demo
    // Not in the demo -- or a public demo that a real sign-in has just ended.
    if (!demoUser()) return false;
    /* Deliberately NOT gated on being signed in. Signing out now ends the
       demo outright (signOutEverywhere clears both keys), so a flag that is
       still here means a demo somebody started on purpose - and Dani starts
       one while signed in, to capture the training screenshots wearing the
       fictional agency rather than her own brand kit. Guarding on the auth
       token killed the demo for her the moment a page reloaded. Dani,
       11 Oct. */
    const demo = localStorage.getItem(demoKitKey());
    if (!demo) return false;                               // an unbranded demo
    const cur = localStorage.getItem("tmke.brand");
    if (cur === demo) return false;                        // it is already there
    /* A kit that is not the demo's, in the cache the whole hub reads from.
       It used to be left alone, which was right when nobody was signed in and
       wrong the moment somebody was: Dani runs the training demo while signed
       in as herself, so the cache held her real kit, this declined to touch
       it, and every page that reads "tmke.brand" direct -- the caption
       generator, the Studio inspiration panel, the dashboard tiles -- wore
       The Property Experts all the way through the training account. Only
       re-entering at /demo?go=1&brand=demo cleared it, and nothing said so.

       The demo's kit wins for as long as the demo is running. Theirs is put
       aside first and given back by endDemo, and it is on the server besides,
       so the worst case is a re-fetch. Dani, 11 Oct. */
    if (cur && cur.length > 2) {
      try {
        // First one wins: a later reload must not stash the demo's own kit
        // over the member's and hand them the fiction back at the end.
        if (!sessionStorage.getItem("tmke.brand.stash")) {
          sessionStorage.setItem("tmke.brand.stash", cur);
        }
      } catch (_) {}
    }
    localStorage.setItem("tmke.brand", demo);
    return true;
  } catch (_) { return false; }
}
try { restoreDemoBrand(); } catch (_) {}

/* The admin Studio (/account/editor?mode=admin) is never in the demo, even
   with the demo switched on in this browser. It lives on a hub path, so it
   was treated as part of the demo: told nobody was signed in -- which bounced
   Dani between it and the admin sign-in, round and round -- with Save and
   Download padlocked and the training brand kit swapped in. Dani, 12 Oct. */
export function inAdminStudio() {
  try { return new URLSearchParams(location.search).get("mode") === "admin"; } catch (_) { return false; }
}
/* Somebody really signed in, as a member. The public demo ends the moment
   they are: a person who tried the demo on this device and then joined was
   signing in to the demo account instead of their own (14 Oct, at the first
   TEG sign-up session). The TRAINING demo is ours and is run while signed in,
   so it is left alone. */
function memberSignedIn() {
  try {
    const raw = localStorage.getItem("tmke-member-auth");
    if (!raw) return false;
    const s = JSON.parse(raw);
    return !!(s && (s.access_token || (s.currentSession && s.currentSession.access_token)));
  } catch (_) { return false; }
}
export function demoUser() {
  if (inAdminStudio()) return null;
  let rec = null;
  try { rec = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { return null; }
  if (rec && !(rec.kind === "training" || rec.training) && memberSignedIn()) {
    try { endDemo(); } catch (_) {}
    return null;
  }
  return rec;
}
export function isDemo() { return !!demoUser(); }
/* The training demo — /demo?go=1&brand=demo. It wears a brand kit and nothing
   is locked, because it exists for us to photograph the hub, not to tease a
   visitor into joining. The public demo at /demo is unchanged. Dani, 8 Oct. */
export function isTrainingDemo() {
  const u = demoUser();
  if (!u) return false;
  if (u.kind === "training" || u.training) return true;
  /* A demo started before the flag existed has no `training` on its record,
     so it would still show every padlock. The branded kit only ever comes
     from ?brand=demo, so its presence says the same thing — and this heals
     a session already open rather than making Dani start again. */
  try { return !!localStorage.getItem(TRAINING_KIT); } catch (_) { return false; }
}
export function startDemo(u) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      name: u.name || "", email: u.email || "", since: Date.now(),
      // Which of the two this is. `training` is kept beside it so a session
      // started before the split keeps behaving as it did.
      kind: u.training ? "training" : "demo",
      training: !!u.training,
    }));
  } catch (_) {}
}
export function endDemo() {
  /* A kit built in the public demo is kept for the person who built it: it
     is labelled with the email they gave at /demo, and claimDemoBrandKit
     (brand-cache.js) hands it only to an account with that email. Before
     this, the next account to sign in on the browser took it, whoever they
     were -- one laptop at a sign-up session, and the second agent got the
     first one's agency. Dani, 14 Oct. */
  try {
    const rec = JSON.parse(localStorage.getItem(KEY) || "null");
    const kit = JSON.parse(localStorage.getItem("tmke.brand.demo") || "null");
    if (rec && !(rec.kind === "training" || rec.training) && kit && typeof kit === "object" && !kit.madeBy) {
      kit.madeBy = String(rec.email || "").trim().toLowerCase();
      localStorage.setItem("tmke.brand.demo", JSON.stringify(kit));
    }
  } catch (_) {}
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(TRAINING_KIT);   // ours, and it outlives nothing
    // A member's own brand kit was put aside for the demo (editor.astro); give it back.
    const stash = sessionStorage.getItem("tmke.brand.stash");
    if (stash) { localStorage.setItem("tmke.brand", stash); sessionStorage.removeItem("tmke.brand.stash"); }
  } catch (_) {}
}

/* The moment somebody signs in, the demo is over and nothing of it stays
   behind. Dani, 14 Oct: "as soon as somebody is signed in, any remnants of
   the demo are gone." Called by every page that signs a person in: login,
   the email link (auth/callback), reset-password and join.

   Gone: the demo flag (public or training), the training kit, the demo's
   copy in the brand cache (the member's own is fetched from the server), and
   what a visitor leaves in the Studio -- recent colours and fonts, favourite
   fonts, saved photo collections, coaching tips seen. The one thing kept is
   a public demo kit built by THIS person (same email), which the dashboard
   then adopts into their account (brand-cache claimDemoBrandKit). */
const DEMO_LEFTOVERS = ["tmke.recentColors", "tmke.editor.recentFonts", "tmke.editor.favFonts", "tmke.collections", "tmke.coach.seen"];
export function clearDemoAtSignIn(email) {
  try {
    let who = String(email || "").trim().toLowerCase();
    if (!who) {
      try {
        const s = JSON.parse(localStorage.getItem("tmke-member-auth") || "null");
        who = String((s && s.user && s.user.email) || "").trim().toLowerCase();
      } catch (_) {}
    }
    let rec = null;
    try { rec = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) {}
    if (rec) {
      endDemo();   // labels a public demo's kit with its maker, then ends it
      localStorage.removeItem("tmke.brand");
      localStorage.removeItem("tmke.brand.skipped");
      sessionStorage.removeItem("tmke.brand.stash");
      if (!(rec.kind === "training" || rec.training)) DEMO_LEFTOVERS.forEach((k) => localStorage.removeItem(k));
    }
    localStorage.removeItem(TRAINING_KIT);
    let kit = null;
    try { kit = JSON.parse(localStorage.getItem("tmke.brand.demo") || "null"); } catch (_) {}
    if (kit && (!who || String(kit.madeBy || "").trim().toLowerCase() !== who)) localStorage.removeItem("tmke.brand.demo");
  } catch (_) {}
}

const STYLE = `
.dm-lock{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:24px;background:rgba(28,29,34,0.55);opacity:0;transition:opacity .25s}
.dm-lock.is-in{opacity:1}
.dm-lock-card{width:min(440px,100%);background:#f4f2f1;color:#1c1d22;border-radius:10px;padding:28px 28px 24px;font-family:"Darker Grotesque",Inter,system-ui,sans-serif;transform:translateY(10px);transition:transform .25s;box-shadow:0 30px 80px rgba(0,0,0,.3)}
.dm-lock.is-in .dm-lock-card{transform:none}
.dm-lock-eyebrow{margin:0 0 12px;font-size:12px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:#371e28}
.dm-lock-eyebrow::before{content:"\\2014";margin-right:8px}
.dm-lock-h{margin:0 0 8px;font-size:24px;line-height:1.2;font-weight:500;letter-spacing:-.01em}
.dm-lock-p{margin:0;font-size:16px;line-height:1.55;color:rgba(28,29,34,.72)}
.dm-lock-actions{display:flex;align-items:center;gap:18px;margin-top:22px}
.dm-lock-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 18px;background:#371e28;color:#f4f2f1;text-decoration:none;font-size:12px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;border-radius:2px;border:0;cursor:pointer}
.dm-lock-link{background:none;border:0;padding:0;font:inherit;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:rgba(28,29,34,.6);cursor:pointer}
.dm-pill{display:inline-flex;align-items:center;gap:10px;margin-right:10px;padding:6px 6px 6px 12px;border:1px solid rgba(28,29,34,.18);border-radius:999px;font-family:"Darker Grotesque",Inter,system-ui,sans-serif;font-size:12px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:#371e28;white-space:nowrap}
.dm-pill a{padding:5px 10px;background:#371e28;color:#f4f2f1;border-radius:999px;text-decoration:none;font-size:11px;letter-spacing:.12em}
html.is-demo .is-demo-locked{opacity:.45;cursor:not-allowed}
html.is-demo .is-demo-locked::after{content:"\\1F512";font-size:10px;margin-left:6px;opacity:.8}
/* The training demo locks nothing. Several hub pages add .is-demo-locked
   themselves rather than going through lockClicks, so the class is undone
   here as well as the handlers being skipped. Dani, 8 Oct. */
html.is-demo-training .is-demo-locked{opacity:1;cursor:pointer;pointer-events:auto}
html.is-demo-training .is-demo-locked::after{content:none}
@media (max-width:760px){.dm-pill span{display:none}.dm-pill{padding:4px;margin-right:6px;border:0}}
`;

function ensureStyle() {
  if (document.getElementById("dm-style")) return;
  const s = document.createElement("style"); s.id = "dm-style"; s.textContent = STYLE; document.head.appendChild(s);
}

/** Show the demo's lock note. Returns nothing; the visitor closes it. */
export function lock(title, message) {
  if (isTrainingDemo()) return;   // nothing is locked in the training demo
  ensureStyle();
  document.querySelectorAll(".dm-lock").forEach((e) => e.remove());
  const el = document.createElement("div");
  el.className = "dm-lock"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
  el.innerHTML = `<div class="dm-lock-card">
    <p class="dm-lock-eyebrow">The demo</p>
    <h3 class="dm-lock-h"></h3>
    <p class="dm-lock-p"></p>
    <div class="dm-lock-actions">
      <a class="dm-lock-btn" href="${JOIN_URL}">Join the Member Hub <span aria-hidden="true">&rarr;</span></a>
      <button type="button" class="dm-lock-link" data-dm-close>Keep looking</button>
    </div></div>`;
  el.querySelector(".dm-lock-h").textContent = title || "That part is for members.";
  el.querySelector(".dm-lock-p").textContent = message || "You can look around everything here. Saving, downloading and your own brand come with a membership.";
  const close = () => { el.classList.remove("is-in"); setTimeout(() => el.remove(), 260); };
  el.addEventListener("click", (e) => { if (e.target === el || e.target.closest("[data-dm-close]")) close(); });
  document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); } });
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("is-in"));
}

/** Lock a set of elements: any click opens the note instead. Capture phase, so page handlers never run. */
export function lockClicks(selector, title, message, root) {
  if (isTrainingDemo()) return;   // nothing is locked in the training demo
  (root || document).addEventListener("click", (e) => {
    const t = e.target.closest && e.target.closest(selector);
    if (!t) return;
    e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
    lock(title, message);
  }, true);
}

// What the demo does not include, wherever a link to it appears.
const LOCKED_LINKS = 'a[href="/account/orders"], a[href="/account/bookings"], a[href="/account/social"], a[href="/account/services"], a[href="/account/contact"], a[href^="/account/contact?"], a[href="/account/help"], a[href="/account/community"], a[href^="/account/community?"], a[href^="/account/community#"]';

/**
 * The hub's chrome in demo mode: the pill and Join button in the header, the
 * visitor's name in the greeting, the sections outside the demo locked, and
 * "Sign out" ending the demo. Safe to call on every hub page.
 */
export function initDemoChrome() {
  const u = demoUser();
  if (!u) return false;
  restoreDemoBrand();   // again here: the session check may have run since import
  ensureStyle();
  document.documentElement.classList.add("is-demo");
  if (isTrainingDemo()) document.documentElement.classList.add("is-demo-training");
  const first = (u.name || "there").trim().split(/\s+/)[0];
  const cap = first.charAt(0).toUpperCase() + first.slice(1);
  document.querySelectorAll(".ws-greet-name").forEach((e) => { e.textContent = cap + "."; });
  document.querySelectorAll(".ws-greeting").forEach((e) => { e.style.visibility = ""; });   // hidden until named
  document.querySelectorAll(".ws-dropdown-head strong").forEach((e) => { e.textContent = u.name || "Demo"; });
  document.querySelectorAll(".ws-dropdown-head span").forEach((e) => { e.textContent = u.email || ""; });
  if (!isTrainingDemo()) {
    document.querySelectorAll(LOCKED_LINKS).forEach((a) => a.classList.add("is-demo-locked"));
    lockClicks(LOCKED_LINKS, "Orders, bookings and managed socials are for members.", "In the demo you can use the Dashboard, the Studio, the Marketing Planner, the Shop and the Getting Started guides.");
  }
  /* No "You're in the demo · Join" in the training account. Everything shot in
     there is a picture of a member's hub for a course or a film, and a badge
     saying it is a demo is the one thing in the frame that gives it away.
     Nothing is locked in there either (above), for the same reason.
     Dani, 12 Oct. */
  const right = isTrainingDemo() ? null : document.querySelector(".ws-nav-right");
  if (right && !right.querySelector(".dm-pill")) {
    const pill = document.createElement("div");
    pill.className = "dm-pill";
    pill.innerHTML = `<span>You're in the demo</span><a href="${JOIN_URL}">Join</a>`;
    right.insertBefore(pill, right.firstChild);
  }
  document.querySelectorAll("[data-logout]").forEach((a) => {
    a.addEventListener("click", (e) => { e.preventDefault(); e.stopImmediatePropagation(); endDemo(); location.href = "/"; }, true);
  });
  return true;
}
