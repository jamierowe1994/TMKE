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

export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'tmke-admin-auth',
      },
    })
  : makeStubClient();

// The one key our session lives under. Exported so sign-out can purge it
// directly rather than trusting the client to have done so.
export const AUTH_STORAGE_KEY = 'tmke-admin-auth';

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
  try {
    await supabase.auth.signOut();                      // revokes server-side
  } catch (_) {
    try { await supabase.auth.signOut({ scope: 'local' }); } catch (_) {}
  }
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
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
