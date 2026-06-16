// TMKE first-party analytics — a tiny, best-effort event tracker.
//
//   import { track, trackPageview } from '../lib/track.js';
//   track('add_to_cart', { pack_id, amount_pence });
//
// Writes one row to public.site_events (see supabase/site_events.sql). It never
// throws and never blocks the UI — analytics must not break the page. Anonymous
// visitors are tracked too (RLS allows anon INSERT), tied together by a
// client-generated session id so we can measure visits + funnels.

import { supabase, isConfigured } from './supabase.js';
import { analyticsAllowed } from './consent.js';

const SID_KEY = 'tmke-sid';
const WORKER = (import.meta.env.PUBLIC_R2_WORKER_URL || '').replace(/\/+$/, '');

// Tell the marketing-automations engine that a KNOWN contact did something on
// the site (a return visit, a trigger-link click). Anonymous visitors are only
// logged to site_events — there's no contact to enrol. Fire-and-forget.
async function fireAutomation(trigger, payload) {
  if (!WORKER || !isConfigured) return;
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session?.user?.email) return;            // only enrol identified people
    const meta = session.user.user_metadata || {};
    const parts = String(meta.name || '').trim().split(/\s+/);
    await fetch(`${WORKER}/automations/fire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        trigger, email: session.user.email,
        first_name: parts.shift() || null, last_name: parts.join(' ') || null,
        company: meta.company || null, source: 'site', payload: payload || {},
      }),
    });
  } catch (_) { /* best-effort */ }
}

// A stable per-browser-session id (persists across pages; survives reloads).
function sessionId() {
  try {
    let s = localStorage.getItem(SID_KEY);
    if (!s) {
      s = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(SID_KEY, s);
    }
    return s;
  } catch (_) {
    return 'anon';
  }
}

/**
 * Record an event. Fire-and-forget — failures are swallowed.
 * @param {string} name  e.g. 'pageview' | 'add_to_cart' | 'checkout_started' | 'studio_opened' | 'order_completed'
 * @param {object} [props] event-specific payload (pack_id, amount_pence, template_id, …)
 */
export async function track(name, props = {}) {
  // No non-essential storage / behavioural logging without consent (PECR).
  if (!name || !isConfigured || !analyticsAllowed()) return;
  try {
    let userId = null;
    try {
      const { data } = await supabase.auth.getSession();
      userId = data?.session?.user?.id ?? null;
    } catch (_) { /* not signed in / not configured */ }

    await supabase.from('site_events').insert({
      name,
      path: typeof location !== 'undefined' ? location.pathname : null,
      session_id: sessionId(),
      user_id: userId,
      props: props && typeof props === 'object' ? props : {},
      referrer: typeof document !== 'undefined' ? (document.referrer || null) : null,
    });
  } catch (_) {
    // Best-effort: analytics must never surface an error to the visitor.
  }
}

/** Convenience: record a page view for the current page. */
export function trackPageview(extra = {}) {
  // Gated on consent — the banner re-calls this after the visitor accepts.
  if (!analyticsAllowed()) return;
  track('pageview', { title: typeof document !== 'undefined' ? document.title : '', ...extra });

  if (typeof location === 'undefined') return;
  const path = location.pathname || '';
  // Don't enrol staff from the backstage — re-engagement is for customer pages.
  const isBackstage = /^\/(admin|editor|edit)(\/|$|\?)/.test(path);

  // A trigger link (e.g. in an email) lands as ?tl=KEY — fire link_clicked.
  try {
    const tl = new URLSearchParams(location.search).get('tl');
    if (tl) { track('link_clicked', { key: tl, path }); if (!isBackstage) fireAutomation('link_clicked', { key: tl, path }); }
  } catch (_) {}

  // page_visited fires once per browser session (a "return visit"), not on every
  // page — so re-engage automations enrol on the visit, not each navigation.
  if (isBackstage) return;
  try {
    if (!sessionStorage.getItem('tmke-pv-fired')) {
      sessionStorage.setItem('tmke-pv-fired', '1');
      fireAutomation('page_visited', { path });
    }
  } catch (_) {}
}

/** Record + fire a trigger-link click explicitly (e.g. from a button handler). */
export function trackLinkClick(key, extra = {}) {
  if (!analyticsAllowed()) return;
  track('link_clicked', { key, ...extra });
  fireAutomation('link_clicked', { key, ...extra });
}
