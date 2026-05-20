-- TMKE — content calendar schema
-- Run AFTER schema.sql in the Supabase SQL editor.
--
-- Two tables:
--   * calendar_items  — per-user scheduled posts (RLS: owner-only)
--   * uk_holidays     — global lookup of bank holidays + awareness days
--                       (RLS: public read)
--
-- v1 is a "scheduling diary" — the customer designs a post in /editor,
-- saves it to a date on their calendar, and on the day we send an email
-- reminder with the asset attached and any copy they wrote. No direct
-- posting to Instagram yet; that lands in v2 once Meta App Review is
-- approved. `platform_hint` is stored now so v2 doesn't need a migration.

create extension if not exists "pgcrypto";

-- ============================================================
-- calendar_items — one row per scheduled post
-- ============================================================
create table if not exists public.calendar_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- When the post should go out, and what time the reminder fires.
  -- scheduled_time is treated as local UK time on the day.
  scheduled_date  date not null,
  scheduled_time  time not null default '09:00',

  -- What the customer sees in the calendar day cell.
  title           text not null,
  caption         text,

  -- Final flattened image + small preview, both in Supabase Storage.
  -- Filled in when the editor saves a post to the calendar.
  asset_url       text,
  thumbnail_url   text,

  -- Pointer back to the source design so "Edit" can reopen it.
  -- Stored as text because drafts use non-uuid ids (e.g. "tmpl-01").
  design_ref      text,

  -- Future-proofing for v2 auto-posting. v1 sends a reminder email
  -- regardless of platform_hint, but we capture it now so the upgrade
  -- path is data-only — no schema migration.
  platform_hint   text not null default 'instagram'
                  check (platform_hint in ('instagram', 'facebook', 'linkedin', 'tiktok', 'other')),

  -- Lifecycle:
  --   scheduled      — waiting for its day
  --   reminder_sent  — email fired (set by future cron job)
  --   done           — customer confirmed they posted it
  --   cancelled      — kept for history, hidden from the grid
  status          text not null default 'scheduled'
                  check (status in ('scheduled', 'reminder_sent', 'done', 'cancelled')),
  reminder_sent_at  timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists calendar_items_user_date_idx
  on public.calendar_items (user_id, scheduled_date);

-- Partial index used by the (future) reminder cron job: it only ever
-- queries rows that still need sending.
create index if not exists calendar_items_due_idx
  on public.calendar_items (scheduled_date, scheduled_time)
  where status = 'scheduled';

-- Touch updated_at (reuses set_updated_at from schema.sql)
drop trigger if exists calendar_items_set_updated_at on public.calendar_items;
create trigger calendar_items_set_updated_at
  before update on public.calendar_items
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS — owner-only. A user can only see/modify their own rows.
-- ============================================================
alter table public.calendar_items enable row level security;

drop policy if exists "calendar_items read own" on public.calendar_items;
create policy "calendar_items read own"
  on public.calendar_items for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "calendar_items insert own" on public.calendar_items;
create policy "calendar_items insert own"
  on public.calendar_items for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "calendar_items update own" on public.calendar_items;
create policy "calendar_items update own"
  on public.calendar_items for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "calendar_items delete own" on public.calendar_items;
create policy "calendar_items delete own"
  on public.calendar_items for delete
  to authenticated
  using (user_id = auth.uid());


-- ============================================================
-- uk_holidays — global reference data shown on the calendar.
-- 'bank' = statutory bank holidays (England & Wales here; add
-- scotland / northern-ireland rows if those audiences grow).
-- 'awareness' = curated marketing dates (Mother's Day, Black
-- Friday, etc.) — gives customers content prompts.
-- Composite PK (date, name) lets multiple entries share a date.
-- ============================================================
create table if not exists public.uk_holidays (
  date    date not null,
  name    text not null,
  kind    text not null check (kind in ('bank', 'awareness')),
  country text not null default 'uk'
          check (country in ('uk', 'england-and-wales', 'scotland', 'northern-ireland')),
  primary key (date, name)
);

create index if not exists uk_holidays_date_idx on public.uk_holidays (date);

alter table public.uk_holidays enable row level security;

drop policy if exists "uk_holidays read public" on public.uk_holidays;
create policy "uk_holidays read public"
  on public.uk_holidays for select
  using (true);

drop policy if exists "uk_holidays write authed" on public.uk_holidays;
create policy "uk_holidays write authed"
  on public.uk_holidays for all
  to authenticated
  using (true)
  with check (true);


-- ============================================================
-- Seed — UK bank holidays + key marketing dates for 2026 + 2027.
-- Refresh annually: bank holiday source of truth is
-- https://www.gov.uk/bank-holidays.json (free, no key).
-- Variable-date awareness days (Mother's, Father's, Remembrance
-- Sunday, Black Friday, Small Business Saturday) are computed
-- per-year — bump them when you add the next year's batch.
-- ============================================================
insert into public.uk_holidays (date, name, kind, country) values
  -- 2026 bank holidays (England & Wales)
  ('2026-01-01', 'New Year''s Day',             'bank',      'england-and-wales'),
  ('2026-04-03', 'Good Friday',                  'bank',      'england-and-wales'),
  ('2026-04-06', 'Easter Monday',                'bank',      'england-and-wales'),
  ('2026-05-04', 'Early May bank holiday',       'bank',      'england-and-wales'),
  ('2026-05-25', 'Spring bank holiday',          'bank',      'england-and-wales'),
  ('2026-08-31', 'Summer bank holiday',          'bank',      'england-and-wales'),
  ('2026-12-25', 'Christmas Day',                'bank',      'england-and-wales'),
  ('2026-12-28', 'Boxing Day (substitute)',      'bank',      'england-and-wales'),
  -- 2027 bank holidays (England & Wales)
  ('2027-01-01', 'New Year''s Day',             'bank',      'england-and-wales'),
  ('2027-03-26', 'Good Friday',                  'bank',      'england-and-wales'),
  ('2027-03-29', 'Easter Monday',                'bank',      'england-and-wales'),
  ('2027-05-03', 'Early May bank holiday',       'bank',      'england-and-wales'),
  ('2027-05-31', 'Spring bank holiday',          'bank',      'england-and-wales'),
  ('2027-08-30', 'Summer bank holiday',          'bank',      'england-and-wales'),
  ('2027-12-27', 'Christmas Day (substitute)',   'bank',      'england-and-wales'),
  ('2027-12-28', 'Boxing Day (substitute)',      'bank',      'england-and-wales'),
  -- 2026 awareness / marketing dates
  ('2026-01-25', 'Burns Night',                  'awareness', 'uk'),
  ('2026-02-14', 'Valentine''s Day',            'awareness', 'uk'),
  ('2026-03-01', 'St David''s Day',             'awareness', 'uk'),
  ('2026-03-08', 'International Women''s Day',  'awareness', 'uk'),
  ('2026-03-15', 'Mother''s Day (UK)',          'awareness', 'uk'),
  ('2026-03-17', 'St Patrick''s Day',           'awareness', 'uk'),
  ('2026-04-01', 'April Fool''s Day',           'awareness', 'uk'),
  ('2026-04-22', 'Earth Day',                    'awareness', 'uk'),
  ('2026-04-23', 'St George''s Day',            'awareness', 'uk'),
  ('2026-06-21', 'Father''s Day (UK)',          'awareness', 'uk'),
  ('2026-10-31', 'Halloween',                    'awareness', 'uk'),
  ('2026-11-05', 'Bonfire Night',                'awareness', 'uk'),
  ('2026-11-08', 'Remembrance Sunday',           'awareness', 'uk'),
  ('2026-11-27', 'Black Friday',                 'awareness', 'uk'),
  ('2026-11-30', 'Cyber Monday',                 'awareness', 'uk'),
  ('2026-12-05', 'Small Business Saturday',      'awareness', 'uk'),
  ('2026-12-24', 'Christmas Eve',                'awareness', 'uk'),
  ('2026-12-31', 'New Year''s Eve',             'awareness', 'uk'),
  -- 2027 awareness / marketing dates
  ('2027-01-25', 'Burns Night',                  'awareness', 'uk'),
  ('2027-02-14', 'Valentine''s Day',            'awareness', 'uk'),
  ('2027-03-01', 'St David''s Day',             'awareness', 'uk'),
  ('2027-03-07', 'Mother''s Day (UK)',          'awareness', 'uk'),
  ('2027-03-08', 'International Women''s Day',  'awareness', 'uk'),
  ('2027-03-17', 'St Patrick''s Day',           'awareness', 'uk'),
  ('2027-04-01', 'April Fool''s Day',           'awareness', 'uk'),
  ('2027-04-22', 'Earth Day',                    'awareness', 'uk'),
  ('2027-04-23', 'St George''s Day',            'awareness', 'uk'),
  ('2027-06-20', 'Father''s Day (UK)',          'awareness', 'uk'),
  ('2027-10-31', 'Halloween',                    'awareness', 'uk'),
  ('2027-11-05', 'Bonfire Night',                'awareness', 'uk'),
  ('2027-11-14', 'Remembrance Sunday',           'awareness', 'uk'),
  ('2027-11-26', 'Black Friday',                 'awareness', 'uk'),
  ('2027-11-29', 'Cyber Monday',                 'awareness', 'uk'),
  ('2027-12-04', 'Small Business Saturday',      'awareness', 'uk'),
  ('2027-12-24', 'Christmas Eve',                'awareness', 'uk'),
  ('2027-12-31', 'New Year''s Eve',             'awareness', 'uk')
on conflict (date, name) do nothing;
