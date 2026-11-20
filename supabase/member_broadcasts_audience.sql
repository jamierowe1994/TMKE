-- Hub notifications: who it goes to (Danielle, 20 Nov 2026).
--
-- audience lists the groups ticked in Admin › Member hub › Hub notifications:
--   'teg'       every TEG brand except Fine & Country (and TEG management/support)
--   'fc'        Fine & Country
--   'external'  members who are neither
-- Empty (the default) is every member. The Worker works out each account's
-- group when the notification goes out; admins always get it.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.member_broadcasts
  add column if not exists audience text[] not null default '{}';

alter table public.member_broadcasts
  drop constraint if exists member_broadcasts_audience_check;
alter table public.member_broadcasts
  add constraint member_broadcasts_audience_check
  check (audience <@ array['teg', 'fc', 'external']::text[]);

select count(*) as notifications, count(*) filter (where audience = '{}') as to_everyone
from public.member_broadcasts;
