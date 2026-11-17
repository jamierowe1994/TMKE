-- The property illustrator (Danielle, 17 Nov 2026).
--
-- A member uploads a listing photo in the Studio (Images › Illustrate) and
-- gets back a watercolour Christmas illustration of the house, made by Nano
-- Banana Pro through fal.ai. Every go costs us about $0.15, so goes are
-- counted here, on our server, never in the member's browser.
--
--   illustrator_settings  one row: the allowances, the monthly spending stop
--   illustration_runs     one row per go: who, when, which allowance, cost
--
-- Members can read their own goes and nothing else; only the Worker writes.
-- Admins read everything (Admin › Studio › Illustrator). Sends nothing.
-- Safe to run twice.

create table if not exists public.illustrator_settings (
  id              int primary key default 1 check (id = 1),
  christmas_goes  int not null default 5,             -- every member, until christmas_until
  christmas_until date not null default '2026-12-31',
  monthly_goes    jsonb not null default '{"scheduling": 5, "done_for_you": 15}'::jsonb,  -- Package 2, Package 3
  cap_gbp         numeric(8,2) not null default 50,   -- all of TMKE, per calendar month
  cost_usd        numeric(6,3) not null default 0.15, -- one go, Nano Banana Pro at 2K
  usd_to_gbp      numeric(6,4) not null default 0.79,
  paused          boolean not null default false,     -- off for everyone, by hand
  cap_told_month  text,                               -- 'YYYY-MM' she was emailed about the stop
  updated_at      timestamptz not null default now(),
  updated_by      text
);
insert into public.illustrator_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.illustration_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  pool        text not null check (pool in ('christmas', 'monthly', 'staff')),
  style       text not null default 'christmas',
  status      text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  cost_usd    numeric(6,3) not null default 0,
  image_url   text,
  width       int,
  height      int,
  seconds     int,
  error       text,
  created_at  timestamptz not null default now()
);
create index if not exists illustration_runs_user_at on public.illustration_runs (user_id, created_at);
create index if not exists illustration_runs_at      on public.illustration_runs (created_at);

alter table public.illustrator_settings enable row level security;
alter table public.illustration_runs   enable row level security;

drop policy if exists "illustrator settings admin read" on public.illustrator_settings;
create policy "illustrator settings admin read" on public.illustrator_settings
  for select to authenticated using (public.is_admin());

drop policy if exists "illustration runs own read" on public.illustration_runs;
create policy "illustration runs own read" on public.illustration_runs
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- No insert, update or delete policies: only the Worker (service role) writes.

select 'property illustrator ready' as done,
       (select christmas_goes from public.illustrator_settings where id = 1) as christmas_goes,
       (select cap_gbp from public.illustrator_settings where id = 1) as cap_gbp,
       (select count(*) from public.illustration_runs) as goes_so_far;
