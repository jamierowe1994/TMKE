-- Hub notifications: Content Calendar subscribers (Danielle, 23 Nov 2026).
--
-- Adds 'calendar' to who a notification can go to: everyone who has the
-- Content Calendar on any level (their brand pays, or they pay by card). The
-- Worker works out who that is when the notification goes out, by the same
-- rule the Content Calendar uses, so it grows as brands and independents join.
-- Admins always get it.
--
-- Builds on supabase/member_broadcasts_audience.sql. Changes no notification
-- and sends nothing. Run once in the Supabase SQL editor. Safe to re-run.

alter table public.member_broadcasts
  drop constraint if exists member_broadcasts_audience_check;
alter table public.member_broadcasts
  add constraint member_broadcasts_audience_check
  check (audience <@ array['teg', 'fc', 'external', 'calendar']::text[]);

select conname as rule, pg_get_constraintdef(oid) as allows
from pg_constraint
where conname = 'member_broadcasts_audience_check';
