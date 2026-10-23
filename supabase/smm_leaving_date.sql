-- A social media client's leaving date (Danielle, 23 Oct 2026).
--
-- Marking someone lost, or an active client Ended, can now take a date. A
-- later date records the reason straight away but leaves them as they are;
-- the Worker's morning run (runSmmLeavingDue) makes the change on the day
-- and stamps lost_at with that date.
--
--   leaving_on   the day they become lost / ended
--   leaving_as   lost | ended
--
-- Safe to re-run.

alter table public.smm_leads
  add column if not exists leaving_on date,
  add column if not exists leaving_as text;

notify pgrst, 'reload schema';
