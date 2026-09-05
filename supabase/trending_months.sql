-- ============================================================================
-- Trending month — "See what's working" in the Studio.
--
-- One row per month. Each row carries five topics as JSON: what the format is,
-- where it runs, how long it should be, how much effort it takes, a paragraph
-- on why it's working, a TMKE tip that tailors it to estate agency, and one
-- piece of media (image or video) that shows it. Edited under
-- Admin → Insights → Trending month; read by the Studio's inspiration card.
--
-- Members always see the most recent PUBLISHED month, so a late month never
-- leaves the card blank — the previous one simply stays up.
--
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.trending_months (
  id          uuid primary key default gen_random_uuid(),
  month       date not null unique,               -- first day of the month
  status      text not null default 'draft'
              check (status in ('draft', 'published')),
  intro       text,                               -- one line under the month name
  topics      jsonb not null default '[]'::jsonb, -- [{title, format, platform, length, effort, about, tip, media_url, media_type}]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists trending_months_status_month_idx
  on public.trending_months (status, month desc);

alter table public.trending_months enable row level security;

-- Members (any signed-in user) read what's published.
drop policy if exists "trending_months read published" on public.trending_months;
create policy "trending_months read published"
  on public.trending_months for select
  to authenticated
  using (status = 'published' or public.is_admin());

-- Admins do everything.
drop policy if exists "trending_months admin" on public.trending_months;
create policy "trending_months admin"
  on public.trending_months for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Keep updated_at honest.
create or replace function public.trending_months_touch()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trending_months_touch on public.trending_months;
create trigger trending_months_touch
  before update on public.trending_months
  for each row execute function public.trending_months_touch();
