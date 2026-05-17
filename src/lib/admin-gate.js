import { supabase } from './supabase.js';

/**
 * Client-side admin auth gate. Call once per admin page on DOMContentLoaded.
 * Redirects to /admin/login if there is no active session.
 * Returns the resolved session (or null if redirecting).
 */
export async function requireAdmin(loginPath = '/admin/login') {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`${loginPath}?next=${next}`);
    return null;
  }
  return data.session;
}

export async function signOut(redirectTo = '/admin/login') {
  await supabase.auth.signOut();
  location.replace(redirectTo);
}
