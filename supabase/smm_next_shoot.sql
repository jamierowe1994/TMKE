-- Shot and Scheduled: when the next quarterly shoot is due (Dani, 20 Oct 2026).
--
-- The next shoot is worked out from the last one: three months after it
-- (a September shoot means December). The team can set a different month on
-- the client's card in Admin → Social, under Videography; that's kept here.
-- A month set here only counts while it's after the last shoot, so once the
-- shoot happens the automatic date takes over again.
--
-- The client sees it on Your Socials, with a note to message their account
-- manager to book it in, or the booked date once it's in.
--
-- Run in the Supabase SQL editor. Safe to re-run. The last line is a check.

alter table public.smm_leads add column if not exists next_shoot_due date;

select exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'smm_leads' and column_name = 'next_shoot_due'
) as next_shoot_due_ready;
