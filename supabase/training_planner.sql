-- TMKE — the training account's Planner
--
-- The training account could not plan a post: the Planner stores posts
-- against a login, and the training account is not one. Its posts live
-- here, written with Dani's admin login, danielle@tmke.co.uk -- the only
-- login this table lets in (src/lib/design-store.js, plannerStore).
--
-- A table of its own, not calendar_items under Dani's id: calendar_items is
-- what the morning reminder emails read, and practice posts must never send
-- one, nor turn up in Dani's own Planner.
--
-- Built LIKE calendar_items, so it has exactly the same columns, defaults and
-- checks, whatever migrations calendar_items has had.
--
-- Run in the Supabase SQL editor. Safe to re-run. The last statement is a
-- check: it is the result the editor shows.

create table if not exists public.training_calendar_items
  (like public.calendar_items including defaults including constraints including indexes);

alter table public.training_calendar_items enable row level security;

drop policy if exists "training_calendar danielle only" on public.training_calendar_items;
create policy "training_calendar danielle only"
  on public.training_calendar_items for all
  to authenticated
  using (lower(auth.jwt() ->> 'email') = 'danielle@tmke.co.uk' and user_id = auth.uid())
  with check (lower(auth.jwt() ->> 'email') = 'danielle@tmke.co.uk' and user_id = auth.uid());

select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'training_calendar_items') as table_ready,
       exists (select 1 from pg_policies where tablename = 'training_calendar_items' and policyname = 'training_calendar danielle only') as danielle_only_rule,
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'training_calendar_items')
         = (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'calendar_items') as same_columns_as_planner;
