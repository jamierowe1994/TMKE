-- TMKE — the Planner becomes a marketing calendar (Dani, 15 Oct 2026).
--
-- Every entry has an activity, not only a social post: a content planning
-- session, an email, paid ads, print designing / ordering / canvassing, a
-- property shoot, a launch campaign, an open house, a local event, a review
-- request, a follow-up, or something else. Each keeps its own details, notes
-- and an optional checklist; campaigns and ads can run to an end date.
--
-- Existing rows are social posts, which is the default, so nothing already
-- planned changes. Run in the Supabase SQL editor. Safe to re-run. The last
-- statement is a check: it is the result the editor shows.
--
-- 15 Oct, later: Content Studio sessions and agent filming days added to the
-- list (Experts Group agents). Re-run to allow them.
--
-- 16 Oct: a sixth category, Campaigns: Story of the Sale, New Listing (the
-- old property launch, same key), Open House and Seasonal. Re-run to allow
-- the three new ones.

do $$
declare t text;
begin
  foreach t in array array['calendar_items', 'training_calendar_items'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I add column if not exists activity text not null default ''social_post''', t);
    execute format('alter table public.%I add column if not exists details jsonb not null default ''{}''::jsonb', t);
    execute format('alter table public.%I add column if not exists notes text', t);
    execute format('alter table public.%I add column if not exists checklist jsonb not null default ''[]''::jsonb', t);
    execute format('alter table public.%I add column if not exists end_date date', t);
    -- Time is optional for most activities; false means "all day".
    execute format('alter table public.%I add column if not exists has_time boolean not null default true', t);
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_activity_check');
    execute format($c$alter table public.%I add constraint %I check (activity in (
      'content_planning', 'content_studio', 'agent_filming', 'social_post', 'email_newsletter', 'paid_ads',
      'print_design', 'print_order', 'canvassing',
      'property_shoot', 'property_launch', 'open_house',
      'story_of_sale', 'open_house_campaign', 'seasonal_campaign',
      'local_event', 'review_request', 'follow_up',
      'other'))$c$, t, t || '_activity_check');
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_end_after_start');
    execute format('alter table public.%I add constraint %I check (end_date is null or end_date >= scheduled_date)', t, t || '_end_after_start');
  end loop;
end $$;

-- Ranges (a campaign, paid ads) are read by "starts before the window ends and
-- finishes after it starts".
create index if not exists calendar_items_user_range_idx
  on public.calendar_items (user_id, scheduled_date, end_date);

select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'calendar_items'
     and column_name in ('activity', 'details', 'notes', 'checklist', 'end_date', 'has_time')) = 6 as planner_ready,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'training_calendar_items'
     and column_name in ('activity', 'details', 'notes', 'checklist', 'end_date', 'has_time')) = 6 as training_planner_ready,
  (select count(*) from public.calendar_items where activity <> 'social_post') as non_post_rows_before_any_use;
