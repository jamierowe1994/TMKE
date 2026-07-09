-- TMKE member hub — Learn / guide completion tracking
-- Run once in the Supabase SQL editor. One row per (member, guide), keyed by
-- the guide slug the reader already uses in its URL (?g=<slug>).
--
--   furthest  — highest slide index the member has reached.
--               For a course: 1..N = parts, N+1 = the completion slide.
--               For an article: 1 (opened/read).
--   total     — number of course parts at the time (0 for a single article),
--               so the Learn cards can show "Part x of N" without a re-fetch.
--   completed — true once they've reached the end (course done slide, or an
--               article opened).

create extension if not exists "pgcrypto";

-- Shared updated_at helper (safe to re-create).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.guide_progress (
  user_id      uuid not null references auth.users(id) on delete cascade,
  guide_slug   text not null,
  furthest     integer not null default 0,
  total        integer not null default 0,
  completed    boolean not null default false,
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  primary key (user_id, guide_slug)
);

create index if not exists guide_progress_user_idx on public.guide_progress (user_id);

drop trigger if exists guide_progress_set_updated_at on public.guide_progress;
create trigger guide_progress_set_updated_at
  before update on public.guide_progress
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS — a member can only see and change their own progress.
-- ============================================================
alter table public.guide_progress enable row level security;

drop policy if exists "guide_progress read own" on public.guide_progress;
create policy "guide_progress read own"
  on public.guide_progress for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "guide_progress insert own" on public.guide_progress;
create policy "guide_progress insert own"
  on public.guide_progress for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "guide_progress update own" on public.guide_progress;
create policy "guide_progress update own"
  on public.guide_progress for update
  to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "guide_progress delete own" on public.guide_progress;
create policy "guide_progress delete own"
  on public.guide_progress for delete
  to authenticated
  using (user_id = auth.uid());
