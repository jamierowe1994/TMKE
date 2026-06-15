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

const SID_KEY = 'tmke-sid';

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
  if (!name || !isConfigured) return;
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
  return track('pageview', { title: typeof document !== 'undefined' ? document.title : '', ...extra });
}
