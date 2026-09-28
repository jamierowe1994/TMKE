-- TMKE — a monthly report stays a draft until someone publishes it.
-- Run in Supabase (SQL editor). Safe to run twice.
--
-- Until now every uploaded report was visible to the client the moment it was
-- saved, drafts and all. From here a client sees only reports with a
-- published_at, and only their six most recent (the Worker's /smm/mine).
--
-- After running this, NOTHING is published: existing reports disappear from
-- clients' hubs until they're published from Insights → Publish to client.

alter table public.smm_reports
  add column if not exists published_at timestamptz,
  add column if not exists published_by text;

-- The member read policy gets the same gate, so an unpublished draft can't be
-- fetched straight from the database either.
drop policy if exists "smm_reports owner read" on public.smm_reports;
create policy "smm_reports owner read" on public.smm_reports
  for select using (auth.uid() = account_user_id and published_at is not null);

select 'smm_reports publishing ready' as status;
