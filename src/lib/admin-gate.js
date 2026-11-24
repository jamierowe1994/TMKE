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

/* A brand designer (Danielle, 24 Nov 2026): someone on a brand's own
   marketing team who makes that brand's designs here. Not an admin. They get
   the Catalogue and the Design studio and nothing else, can only make packs
   for the brands named on their row, and can't put anything live. The
   database enforces all of it (supabase/designers.sql); this only decides
   which screens to draw. RLS lets a person read their own row and no other. */
const DESIGNER_PAGES = /^\/admin\/(packs|templates|sizes)\/?$/;
export const DESIGNER_HOME = '/admin/packs';
const LEVEL_KEY = 'tmke.admin.level';

/** Was the last person signed in on this browser a designer? Known before
    the sign-in has been checked, so the page can start out drawn for them. */
export function designerHint() {
  try { return localStorage.getItem(LEVEL_KEY) === 'designer'; } catch (_) { return false; }
}
function setLevelHint(designer) {
  try { if (designer) localStorage.setItem(LEVEL_KEY, 'designer'); else localStorage.removeItem(LEVEL_KEY); } catch (_) {}
  try { document.documentElement.classList.toggle('is-designer', !!designer); } catch (_) {}
}

const designerAsked = new Map();
/** Their designer row, { brands, full_name }, or null. Asked once per page. */
export function designerFor(user) {
  if (!user || !user.id) return Promise.resolve(null);
  if (!designerAsked.has(user.id)) {
    designerAsked.set(user.id, (async () => {
      try {
        const { data, error } = await supabase
          .from('designers')
          .select('user_id, brands, full_name')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error || !data) return null;
        return { user_id: data.user_id, brands: Array.isArray(data.brands) ? data.brands : [], full_name: data.full_name || '' };
      } catch (_) { return null; }   // the table isn't there yet: nobody is one
    })());
  }
  return designerAsked.get(user.id);
}

/** Who this is to the admin centre: { level: 'admin' }, { level: 'designer',
    designer } or null. One of us is always an admin, even if also listed. */
export async function accessFor(user) {
  if (!user) return null;
  if (await isAdminUser(user)) return { level: 'admin', designer: null };
  const d = await designerFor(user);
  return d ? { level: 'designer', designer: d } : null;
}

/**
 * Management check for a signed-in admin (finer-grained than isAdminUser —
 * every admin can see operational data, but only management sees rolled-up
 * revenue totals). Deliberately NOT domain/allowlist-based like isAdminUser:
 * this is a short, manually-curated list (see supabase/admins_management_flag.sql),
 * so it only ever comes from the admins.is_management column.
 */
export async function isManagementUser(user) {
  if (!user) return false;
  try {
    const { data, error } = await supabase
      .from('admins')
      .select('is_management')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!error && data) return !!data.is_management;
  } catch (_) {
    // admins table / column not set up yet — default to false (safer default
    // than accidentally showing revenue to everyone).
  }
  return false;
}

/**
 * Client-side admin auth gate. Call once per admin page on DOMContentLoaded.
 *  - No session            → bounce to the admin login (remembering where we were).
 *  - Session but not admin → bounce to the admin login with ?denied=1 (a customer
 *                            must never see the admin area, even when signed in).
 *  - A brand designer      → let through on the Catalogue and the Design studio
 *                            only, with session.designer set; sent to the
 *                            Catalogue from any other admin page.
 * Returns the resolved session, or null if redirecting.
 */
export async function requireAdmin(loginPath = '/admin/login') {
  const { data } = await supabase.auth.getSession();
  let session = data && data.session;
  // Same dev-only bypass as AdminShell (see its comment) — without this,
  // any page that calls requireAdmin() itself (rather than only relying on
  // AdminShell's own session) still bounces to /admin/login in local dev.
  if (!session && import.meta.env.DEV) {
    session = { user: { email: 'dev-preview@tmke.co.uk', id: 'dev' } };
  }
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`${loginPath}?next=${next}`);
    return null;
  }
  let who = await accessFor(session.user);
  // Local preview only: ?as=designer draws the pages as a designer for The
  // Letting Experts would see them (remembered for the tab; ?as=admin undoes
  // it). There is no real sign-in here, so nothing can be saved either way.
  if (import.meta.env.DEV) {
    try {
      const as = new URLSearchParams(location.search).get('as');
      if (as) sessionStorage.setItem('tmke.dev.as', as);
      if (sessionStorage.getItem('tmke.dev.as') === 'designer') {
        who = { level: 'designer', designer: { user_id: session.user.id, brands: ['The Letting Experts', 'The Letting Experts Scotland'], full_name: 'Dev Designer' } };
      }
    } catch (_) {}
  }
  if (!who) {
    location.replace(`${loginPath}?denied=1`);
    return null;
  }
  if (who.level === 'designer') {
    setLevelHint(true);
    // Their two pages; anything else in the admin centre sends them home.
    if (!DESIGNER_PAGES.test(location.pathname)) {
      location.replace(DESIGNER_HOME);
      return null;
    }
    // A copy: the sign-in itself is the library's to keep, and store, as it is.
    return { ...session, designer: who.designer };
  }
  setLevelHint(false);
  return session;
}

// Same story as the hub: a failed server revoke used to leave the local session
// in place, and the login page would wave you straight back through. See
// signOutEverywhere in lib/supabase.js for the detail.
export async function signOut(redirectTo = '/admin/login') {
  await signOutEverywhere(redirectTo);
}
