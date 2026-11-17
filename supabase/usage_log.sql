-- The usage log (Danielle, 17 Nov 2026: "yes to the usage log").
--
-- What each signed-in member does with our templates and the Content
-- Calendar, kept on our own server against their account, whatever their
-- cookie choice. It feeds each month's Insights (Content calendar › a month ›
-- Insights): opened a post, opened its design, saved their own copy,
-- downloaded. Planner adds, schedules and posts are already in calendar_items.
--
-- Members can only add rows about themselves and can't read any back. Only
-- admins read it. Nothing here changes what anyone sees. Safe to run twice.

create table if not exists public.usage_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event       text not null check (char_length(event) between 1 and 40),
  template_id text,                -- the TMKE template (a month's design, a pack's design)
  post_id     uuid,                -- content_month_posts.id, when known
  month_id    uuid,                -- content_months.id, when known
  design_id   uuid,                -- the member's own copy (user_designs.id)
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists usage_log_event_at   on public.usage_log (event, created_at);
create index if not exists usage_log_template   on public.usage_log (template_id);
create index if not exists usage_log_month      on public.usage_log (month_id);
create index if not exists usage_log_user_at    on public.usage_log (user_id, created_at);

alter table public.usage_log enable row level security;

drop policy if exists "usage log add own" on public.usage_log;
create policy "usage log add own" on public.usage_log
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "usage log admin read" on public.usage_log;
create policy "usage log admin read" on public.usage_log
  for select to authenticated
  using (public.is_admin());

-- No update or delete policies: rows are never changed. Deleting a member's
-- account removes their rows (on delete cascade).

select 'usage_log ready' as done, count(*) as rows_so_far from public.usage_log;
