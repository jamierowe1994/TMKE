// TMKE cookie/analytics consent (PECR).
//
// Strictly-necessary storage (the Supabase auth session, Cloudflare security,
// anti-bot) is exempt and is NOT gated by this. This only governs NON-essential
// storage — currently our first-party analytics + marketing-automation signals
// in track.js, which must not run until the visitor opts in.
//
//   import { analyticsAllowed, setConsent, getConsent } from './consent.js';

const KEY = 'tmke-consent'; // 'granted' | 'denied' | (absent = undecided)

/** The stored choice, or null if the visitor hasn't chosen yet. */
export function getConsent() {
  try { return localStorage.getItem(KEY); } catch (_) { return null; }
}

/** True only when the visitor has actively accepted non-essential cookies. */
export function analyticsAllowed() {
  return getConsent() === 'granted';
}

/**
 * Record the visitor's choice. Fires a `tmke:consent` event so anything that
 * was waiting on consent (e.g. analytics) can react without a page reload.
 * @param {'granted'|'denied'} value
 */
export function setConsent(value) {
  const v = value === 'granted' ? 'granted' : 'denied';
  try { localStorage.setItem(KEY, v); } catch (_) {}
  try { window.dispatchEvent(new CustomEvent('tmke:consent', { detail: v })); } catch (_) {}
  return v;
}

/** Clear the choice (so the banner shows again). */
export function resetConsent() {
  try { localStorage.removeItem(KEY); } catch (_) {}
}
