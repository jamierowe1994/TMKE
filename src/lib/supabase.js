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
