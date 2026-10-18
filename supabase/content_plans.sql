-- TMKE — content plans (Dani, 18 Oct 2026)
--
-- "You go in, select a month to plan, it then pulls your content calendar
-- (prompts and existing planned posts). Underneath that you have a table
-- where you do your planning."
--
-- One plan per member per month (/account/content-plan). Its rows are the
-- table: date, title, format, content pillar, description, inspo link. A row
-- with a date is also a post on their Content Calendar (calendar_items, with
-- details.plan pointing back here), so the calendar shows a post is planned
-- and the plan knows when it's made. A row without a date stays in the plan.
--
-- `pillars` holds the member's own content pillars, added to the five every
-- plan offers (Property, Personal, Community, Service, Educational).
--
-- training_content_plans is the training account's, written with Dani's
-- admin login only, as training_calendar_items is (training_planner.sql).
--
-- Run in the Supabase SQL editor. Safe to re-run. The last statement is a
-- check: it is the result the editor shows.

create table if not exists public.content_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month       date not null check (extract(day from month) = 1),   -- the 1st of the month planned
  rows        jsonb not null default '[]'::jsonb check (jsonb_typeof(rows) = 'array'),
  pillars     jsonb not null default '[]'::jsonb check (jsonb_typeof(pillars) = 'array'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, month)
);

drop trigger if exists content_plans_set_updated_at on public.content_plans;
create trigger content_plans_set_updated_at
  before update on public.content_plans
  for each row execute function public.set_updated_at();

alter table public.content_plans enable row level security;

drop policy if exists "content_plans owner" on public.content_plans;
create policy "content_plans owner" on public.content_plans for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- The training account's.
create table if not exists public.training_content_plans
  (like public.content_plans including defaults including constraints including indexes);

alter table public.training_content_plans enable row level security;

drop policy if exists "training_content_plans danielle only" on public.training_content_plans;
create policy "training_content_plans danielle only" on public.training_content_plans for all to authenticated
  using (lower(auth.jwt() ->> 'email') = 'danielle@tmke.co.uk' and user_id = auth.uid())
  with check (lower(auth.jwt() ->> 'email') = 'danielle@tmke.co.uk' and user_id = auth.uid());

select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'content_plans') as plans_ready,
       exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'training_content_plans') as training_ready,
       exists (select 1 from pg_policies where tablename = 'content_plans' and policyname = 'content_plans owner') as owner_rule;
