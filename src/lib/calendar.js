// TMKE — shared content calendar helpers
//
// Date arithmetic, Supabase fetching, and small render helpers used by:
//   - /account                      (upcoming-week strip)
//   - /account/schedule             (full month page)
//   - /account, /account/orders     (left-edge tab → month drawer)
//
// All date utilities work in the browser's local timezone, which is
// what we want because scheduled_date / scheduled_time on the DB are
// stored as wall-clock UK time (no tz). The Edge Function does the
// timezone correction; the browser just renders whatever it's given.

// ---------- Date arithmetic ----------

export function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

export function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

// Monday of the week containing `d`. UK convention is Mon-Sun, so
// Sunday belongs to "this week" (its end), not "next week" (its start).
export function startOfWeekMonday(d) {
  const dow = (d.getDay() + 6) % 7; // 0 = Mon ... 6 = Sun
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - dow);
  return start;
}

// For the workspace's upcoming-week widget. If today is Sunday the
// current week is essentially over, so we jump to next week's Monday
// instead of dwelling on a near-empty current week.
export function defaultUpcomingWeekStart(today = new Date()) {
  const monday = startOfWeekMonday(today);
  return today.getDay() === 0 ? addDays(monday, 7) : monday;
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

// ---------- Formatters ----------

export function fmtMonthYear(d) {
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function fmtFullDate(d) {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Short label for the upcoming-week strip: "Mon 18" / "Tue 19".
export function fmtDayShort(d) {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
}

// Range label for the week-strip header: "18 — 24 May 2026".
// If the range spans two months we render both (e.g. "29 Jun — 5 Jul 2026").
export function fmtWeekRange(start) {
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const fmtNoYear = (d, opts) => d.toLocaleDateString('en-GB', opts);
  if (sameMonth) {
    return `${start.getDate()} — ${end.getDate()} ${fmtNoYear(end, { month: 'short', year: 'numeric' })}`;
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameYear) {
    return `${fmtNoYear(start, { day: 'numeric', month: 'short' })} — ${fmtNoYear(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  return `${fmtNoYear(start, { day: 'numeric', month: 'short', year: 'numeric' })} — ${fmtNoYear(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function fmtTime(t) {
  if (!t) return '09:00';
  return String(t).slice(0, 5);
}

// ---------- Bucketing ----------

export function bucketBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

// ---------- HTML helpers ----------

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------- Data fetching ----------

// Pulls scheduled posts + UK holidays for [fromYmd, toYmd] (both inclusive).
// Returns empty arrays on error (with the error message exposed for the
// caller to surface if it wants — most pages just degrade quietly).
export async function fetchCalendarWindow(supabase, fromYmd, toYmd) {
  const [itemsRes, holsRes] = await Promise.all([
    supabase.from('calendar_items')
      .select('id, scheduled_date, scheduled_time, title, caption, asset_url, thumbnail_url, design_ref, platform_hint, status, reminder_sent_at')
      .gte('scheduled_date', fromYmd)
      .lte('scheduled_date', toYmd)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true }),
    supabase.from('uk_holidays')
      .select('date, name, kind, country')
      .gte('date', fromYmd)
      .lte('date', toYmd)
      .order('date', { ascending: true }),
  ]);

  return {
    items: itemsRes.error ? [] : (itemsRes.data || []),
    holidays: holsRes.error ? [] : (holsRes.data || []),
    itemsError: itemsRes.error?.message || null,
    holidaysError: holsRes.error?.message || null,
  };
}
