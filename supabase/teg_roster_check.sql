-- The monthly Team Hub check (admin → TEG sync). Danielle, 19 Oct 2026.
--
-- The Worker reads the Team Hub live (read-only) and compares it with our
-- CRM. These three tables let it say what has CHANGED since the last check:
--
--   teg_roster_seen     the last check's snapshot: one row per Team Hub person
--                       (status, brands, job title, person type). No personal
--                       details: name and work email only, for matching.
--   teg_roster_changes  each difference found (e.g. Status: Onboarding →
--                       Trading), kept until someone marks it done.
--   teg_roster_runs     when each check ran, who ran it and what it found.
--
-- Only the Worker writes them; admins read them. Run once in the Supabase SQL
-- editor. Safe to re-run.

create table if not exists public.teg_roster_seen (
  teg_id       text primary key,          -- the Team Hub's own record id
  email        text,
  name         text,
  status       text,
  active       boolean,
  person_type  text,
  brands       text[] not null default '{}',
  job_title    text,
  seen_at      timestamptz not null default now()
);

create table if not exists public.teg_roster_changes (
  id           uuid primary key default gen_random_uuid(),
  teg_id       text not null,
  email        text,
  name         text,
  contact_id   uuid references public.contacts(id) on delete set null,
  brand        text,
  field        text not null,             -- Status, Active, Brands, Job title, Person type, Team Hub record
  old_value    text,
  new_value    text,
  detected_at  timestamptz not null default now(),
  done_at      timestamptz,
  done_by      text
);
create index if not exists teg_roster_changes_open on public.teg_roster_changes (detected_at desc) where done_at is null;

create table if not exists public.teg_roster_runs (
  id      uuid primary key default gen_random_uuid(),
  run_at  timestamptz not null default now(),
  run_by  text,                            -- an admin's email, or "monthly check" ("by" is reserved)
  counts  jsonb not null default '{}'
);

alter table public.teg_roster_seen    enable row level security;
alter table public.teg_roster_changes enable row level security;
alter table public.teg_roster_runs    enable row level security;

drop policy if exists "teg_roster_seen admin read" on public.teg_roster_seen;
create policy "teg_roster_seen admin read" on public.teg_roster_seen for select to authenticated using (public.is_admin());
drop policy if exists "teg_roster_changes admin read" on public.teg_roster_changes;
create policy "teg_roster_changes admin read" on public.teg_roster_changes for select to authenticated using (public.is_admin());
drop policy if exists "teg_roster_runs admin read" on public.teg_roster_runs;
create policy "teg_roster_runs admin read" on public.teg_roster_runs for select to authenticated using (public.is_admin());

-- Have the API see the new tables straight away.
notify pgrst, 'reload schema';
