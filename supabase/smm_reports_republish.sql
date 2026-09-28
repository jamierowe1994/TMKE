-- TMKE — a published report keeps the copy the client saw until it's
-- republished. Run in Supabase (SQL editor). Safe to run twice, and safe
-- whether or not smm_reports_publish.sql was run first.
--
-- `data` is the working copy: uploads, drafting and edits land there.
-- `published_data` is what the client sees, copied from `data` when a report
-- is published or republished. So an edit to a live report changes nothing
-- for the client until someone presses Republish, and chooses whether to tell
-- them about it.

alter table public.smm_reports
  add column if not exists published_at timestamptz,
  add column if not exists published_by text,
  add column if not exists published_data jsonb,
  add column if not exists amended_at timestamptz,             -- last republish
  add column if not exists amendment_notice_at timestamptz,    -- last republish the client was told about
  add column if not exists amendment_email_pending boolean not null default false;

-- Reports already live keep showing exactly what they show now.
update public.smm_reports
   set published_data = data
 where published_at is not null and published_data is null;

-- Clients read their reports only through the Worker, which serves the
-- published copy. Nothing reads this table directly from the browser, so the
-- direct member read is closed: otherwise a live report's unpublished edits
-- could be fetched from `data`.
drop policy if exists "smm_reports owner read" on public.smm_reports;

select 'smm_reports republishing ready' as status;
