import { supabase, signOutEverywhere} from './supabase.js';

/**
 * Admin authorisation for the /admin/* area and the studio's ?mode=admin chrome.
 *
 * Who counts as an admin (any one of these passes):
 *   1. An email on a TMKE staff domain (matches the Microsoft SSO set-up).
 *   2. An email on the explicit allowlist below.
 *   3. A row in the Supabase `admins` table for this user id (the authoritative
 *      source of truth — see supabase/admins.sql). RLS only lets a user read
 *      their OWN row, so a non-admin simply gets nothing back.
 *
 * Important: client-side checks keep customers out of the admin *UI*. The real
 * enforcement for admin *data* must live in Supabase RLS — use the public.is_admin()
 * helper (supabase/admins.sql) in the policies on admin-written tables.
 */
const ADMIN_EMAIL_DOMAINS = ['tmke.co.uk'];
const ADMIN_EMAILS = ['james@therecruitmentexperts.co.uk'];

/** Cheap, offline check against the domain + explicit allowlist. */
export function emailLooksAdmin(email) {
  if (!email) return false;
  const e = String(email).toLowerCase().trim();
  if (ADMIN_EMAILS.includes(e)) return true;
  const domain = e.split('@')[1] || '';
  return ADMIN_EMAIL_DOMAINS.includes(domain);
}

/** Full admin check for a signed-in user (allowlist first, then the admins table). */
export async function isAdminUser(user) {
  if (!user) return false;
  if (emailLooksAdmin(user.email)) return true;
  try {
    const { data, error } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!error && data) return true;
  } catch (_) {
    // admins table not set up yet — fall back to the allowlist result (false).
  }
  return false;
}

/**
 * Client-side admin auth gate. Call once per admin page on DOMContentLoaded.
 *  - No session            → bounce to the admin login (remembering where we were).
 *  - Session but not admin → bounce to the admin login with ?denied=1 (a customer
 *                            must never see the admin area, even when signed in).
 * Returns the resolved session, or null if redirecting.
 */
export async function requireAdmin(loginPath = '/admin/login') {
  const { data } = await supabase.auth.getSession();
  const session = data && data.session;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`${loginPath}?next=${next}`);
    return null;
  }
  if (!(await isAdminUser(session.user))) {
    location.replace(`${loginPath}?denied=1`);
    return null;
  }
  return session;
}

// Same story as the hub: a failed server revoke used to leave the local session
// in place, and the login page would wave you straight back through. See
// signOutEverywhere in lib/supabase.js for the detail.
export async function signOut(redirectTo = '/admin/login') {
  await signOutEverywhere(redirectTo);
}
