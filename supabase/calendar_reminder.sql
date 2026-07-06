-- TMKE — opt-in reminder flag on planned posts. Run in the Supabase SQL editor.
-- When true (the default), the daily 8am reminder email goes out on the day the
-- post is planned for. Members can turn it off per-post in the plan modal.
alter table public.calendar_items add column if not exists reminder boolean not null default true;
