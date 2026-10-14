import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Track whether Supabase is properly configured. When the env vars are
// missing (e.g. local dev without a .env, or a production build that forgot
// to set Railway variables) we still need the module to *import* without
// throwing — otherwise every page that does `import { supabase }` ends up
// with a dead script tag and no interactivity at all.
//
// We do that by either:
//   1. Building a real client when the env vars are present, or
//   2. Building a "stub" client whose auth methods reject cleanly and whose
//      query builder no-ops — enough to keep the UI alive and surface a
//      clear error if the user tries to actually use auth/db.
export const isConfigured = Boolean(url && anonKey);

if (!isConfigured) {
  console.warn(
    '[TMKE] Supabase env vars missing. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY ' +
    'in .env (and Railway → Variables for production). See AUTH_SETUP.md. ' +
    'Auth and database calls will fail gracefully until these are set.'
  );
}

function makeStubClient() {
  const noConfig = (action) => ({
    data: null,
    error: { message: 'Supabase isn\'t configured yet — set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in .env. See AUTH_SETUP.md.', name: 'NotConfiguredError', action },
  });
  const subscription = { unsubscribe() {} };
  return {
    auth: {
      async getSession()     { return { data: { session: null }, error: null }; },
      async getUser()        { return { data: { user: null }, error: null }; },
      async signInWithPassword() { return noConfig('signIn'); },
      async signUp()         { return noConfig('signUp'); },
      async signOut()        { return { error: null }; },
      async resetPasswordForEmail() { return noConfig('reset'); },
      async updateUser()     { return noConfig('update'); },
      async resend()         { return noConfig('resend'); },
      async exchangeCodeForSession() { return noConfig('exchange'); },
      onAuthStateChange()    { return { data: { subscription } }; },
    },
    from() {
      const builder = {
        select() { return builder; },
        insert() { return builder; },
        update() { return builder; },
        delete() { return builder; },
        upsert() { return builder; },
        eq() { return builder; },
        or() { return builder; },
        order() { return builder; },
        limit() { return builder; },
        single() { return Promise.resolve(noConfig('query')); },
        then(resolve) { resolve(noConfig('query')); },
      };
      return builder;
    },
    storage: {
      from() {
        return {
          async upload() { return noConfig('storage'); },
          async download() { return noConfig('storage'); },
          getPublicUrl() { return { data: { publicUrl: '' } }; },
        };
      },
    },
  };
}

/* Two front doors, two logins.
   The admin centre and the Member Hub shared one session slot: whichever you
   signed into last owned it, signing into the hub replaced the admin session,
   and signing out of either signed you out of both. Dani, 12 Oct: "the admin
   and the design studio shouldn't be linked in logins. They both have
   separate logins."

   The slot is chosen by where the page is, so each side keeps its own session
   and both can be signed in at once. ADMIN is:
     - anything under /admin;
     - the admin Studio, /account/editor?mode=admin -- it lives on a hub path,
       and reading the member slot there would send an admin to the admin
       sign-in, which reads the admin slot, finds them signed in and sends
       them back: the loop Dani hit this evening, by another route;
     - the sign-in return page (/auth/callback) when it is returning to one of
       those. Microsoft sign-in starts on /admin/login, and the code it comes
       back with can only be finished by the slot that started it.
   Everything else is the MEMBER slot. Every page still imports the same
   `supabase`; nothing that uses it changes. */
const ADMIN_KEY = 'tmke-admin-auth';
const MEMBER_KEY = 'tmke-member-auth';
function adminPlace(pathname, search) {
  const q = new URLSearchParams(search || '');
  if (/^\/admin(\/|$)/.test(pathname)) return true;
  if (/^\/account\/editor\/?$/.test(pathname) && q.get('mode') === 'admin') return true;
  if (/^\/auth\/callback\/?$/.test(pathname)) {
    const next = q.get('next') || '';
    try {
      const u = new URL(next, 'https://x.invalid');
      return adminPlace(u.pathname, u.search);
    } catch (_) { return false; }
  }
  return false;
}
const onAdminSide = typeof window !== 'undefined' && adminPlace(window.location.pathname, window.location.search);
const activeKey = onAdminSide ? ADMIN_KEY : MEMBER_KEY;

/* Members signed in before the split have their session in the old shared
   slot, which is now the admin one. On their first hub page it is MOVED to
   the member slot -- moved, not copied: one session in two slots would be
   refreshed twice, and Supabase treats a refresh token used twice as stolen
   and ends the session. Staff are the exception: a staff session stays where
   it is, on the admin side, and staff sign in to the hub once, separately --
   which is the point. Checked by email, the same rule as admin-gate.js. */
try {
  if (typeof window !== 'undefined' && !onAdminSide && !localStorage.getItem(MEMBER_KEY)) {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (raw) {
      const email = String((JSON.parse(raw) || {}).user?.email || '').toLowerCase().trim();
      const staff = email.endsWith('@tmke.co.uk') || email === 'james@therecruitmentexperts.co.uk';
      if (!staff) {
        localStorage.setItem(MEMBER_KEY, raw);
        localStorage.removeItem(ADMIN_KEY);
      }
    }
  }
} catch (_) {}

export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: activeKey,
      },
    })
  : makeStubClient();

// The Member Hub demo (src/lib/demo.js): while the demo flag is set, the hub
// pages see no session at all, so a signed-in member (or Dani) walking through
// the demo sees it as a brand-new visitor would. Scoped to the hub's own
// paths; the admin centre keeps the real session.
//
// And so does the ADMIN STUDIO, which lives on a hub path:
// /account/editor?mode=admin. It was hidden the session like any hub page, so
// it sent Dani to the admin sign-in; the sign-in, not a hub path, saw her real
// session and sent her straight back; round and round, flashing between the
// two. Dani, 12 Oct, with the training account switched on in the shot rig:
// "it's just flashing from the sign-in screen to the Opening your design
// screen."
const isAdminStudio = () => {
  try { return new URLSearchParams(window.location.search).get('mode') === 'admin'; } catch (_) { return false; }
};
try {
  if (typeof window !== 'undefined' && window.localStorage.getItem('tmke_demo') && !isAdminStudio()
      && /^\/(account|editor)(\/|$)/.test(window.location.pathname) && supabase && supabase.auth) {
    supabase.auth.getSession = async () => ({ data: { session: null }, error: null });
    supabase.auth.getUser = async () => ({ data: { user: null }, error: null });
  }
} catch (_) {}

// The one key our session lives under. Exported so sign-out can purge it
// directly rather than trusting the client to have done so.
export const AUTH_STORAGE_KEY = activeKey;   // this side's slot (see above)

/**
 * Sign out properly, and stay signed out.
 *
 * The hub used to call supabase.auth.signOut() directly and then redirect. That
 * has a failure mode people actually hit: signOut() makes a network call to
 * revoke the session, and when that call fails - offline, or the access token
 * has already expired so the API answers 401 - the library can leave the LOCAL
 * session sitting in localStorage. The login page then reads it, sees a
 * session, and sends you straight back in. Which looks exactly like "I signed
 * out and it signed me back in".
 *
 * So: try the server revoke first, because that is what actually protects a
 * shared computer; fall back to a local sign-out; then remove the stored
 * session by hand whatever happened. Redirect regardless - a failed sign-out
 * must never leave someone stuck on a signed-in page.
 */
export async function signOutEverywhere(redirectTo = '/login') {
  /* This side's session only. A global sign-out ends every session the
     account has, so with two front doors signing out of the hub also signed
     you out of the admin centre. scope 'local' still revokes THIS session on
     the server, so a shared computer is properly signed out. */
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (_) {}
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);   // this side's slot only
    // The brand kit belongs to the login, not the browser (src/lib/brand-cache.js).
    localStorage.removeItem('tmke.brand'); localStorage.removeItem('tmke.brand.skipped');
    /* A demo is not an account, and signing out ends it. Leaving these behind
       meant the next person to sign in on this browser had restoreDemoBrand()
       copy the DEMO's kit into their own - the real kit having just been
       cleared above - so a real member's designs came up in a stranger's
       fonts and colours. Dani, 10 Oct: "I was in demo, and then obviously I
       signed out and logged back in... it shouldn't be applying any of the
       demo features." */
    localStorage.removeItem('tmke_demo');
    // A walkthrough left open, and anything typed into its training kit, end
    // with the session: nothing of one person's walk survives to the next.
    localStorage.removeItem('tmke.tour');
    localStorage.removeItem('tmke.brand.training.scratch');
    localStorage.removeItem('tmke.brand.demo');
    localStorage.removeItem('tmke.brand.training');
    // Any stray default-keyed sessions from an older build.
    Object.keys(localStorage).filter((k) => k.startsWith('sb-')).forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch (_) {}
  if (redirectTo) {
    // The flag tells the login page not to bounce us back in.
    location.replace(redirectTo + (redirectTo.includes('?') ? '&' : '?') + 'signedout=1');
  }
}

export function gbpFromPence(pence) {
  if (pence == null) return '';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
}

export function slugify(input) {
  return String(input ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}
