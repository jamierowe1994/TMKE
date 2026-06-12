-- Session cancellation waitlist (gated bookings)
-- ---------------------------------------------------------------------------
-- Captures interest for "fully booked" gated sections (starting with the Studio).
-- A visitor must pass the work-email domain gate (Fine & Country / The Property
-- Experts) before they reach this step; the Worker validates the domain again
-- server-side before inserting. Rows are written by the Cloudflare Worker using
-- the service-role key (which bypasses RLS), so no anon insert policy is needed.
-- ---------------------------------------------------------------------------

create table if not exists public.session_waitlist (
  id              uuid primary key default gen_random_uuid(),
  section         text not null default 'studio',   -- which gated section (studio, …)
  package         text,                              -- chosen tier label, e.g. "Single Session"
  name            text not null,
  email           text not null,
  phone           text,
  email_domain    text,                              -- normalised domain that passed the gate
  preferred_date  date,                              -- the slot they'd ideally like
  preferred_time  text,                              -- "HH:MM" 24h
  status          text not null default 'waiting',   -- waiting | notified | booked | expired
  notified_at     timestamptz,                       -- when we messaged them about an opening
  created_at      timestamptz not null default now()
);

create index if not exists session_waitlist_section_status_idx
  on public.session_waitlist (section, status, created_at desc);
create index if not exists session_waitlist_created_idx
  on public.session_waitlist (created_at desc);

alter table public.session_waitlist enable row level security;

-- Admins (signed-in team) can read/manage the list in the dashboard. The Worker
-- writes with the service-role key, which bypasses RLS entirely.
drop policy if exists "waitlist admin read" on public.session_waitlist;
create policy "waitlist admin read" on public.session_waitlist
  for select to authenticated using (true);

drop policy if exists "waitlist admin manage" on public.session_waitlist;
create policy "waitlist admin manage" on public.session_waitlist
  for update to authenticated using (true) with check (true);
