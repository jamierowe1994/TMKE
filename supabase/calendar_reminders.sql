-- TMKE — calendar reminder cron
-- Run AFTER calendar.sql.
--
-- Sets up the scheduled job that pings the `send-due-reminders` Edge
-- Function every 5 minutes. The function does the actual work: query
-- due rows, send emails via Resend, mark rows as 'reminder_sent'.
--
-- Before running:
--   1. Deploy the function:  supabase functions deploy send-due-reminders
--   2. Set the function's env vars (see REMINDERS_SETUP.md).
--   3. Replace YOUR-PROJECT-REF + YOUR-SERVICE-ROLE-KEY at the bottom of
--      this file with your real values.

-- ============================================================
-- Schema extensions on calendar_items.
-- Adds bookkeeping columns the cron + function need: a per-row attempts
-- counter (so a permanently-broken row doesn't spam every 5 min) and
-- a last_error breadcrumb. Also widens the status check to include
-- 'failed' for rows we've given up on.
-- ============================================================
alter table public.calendar_items
  add column if not exists send_attempts integer not null default 0,
  add column if not exists last_error    text;

-- Postgres won't let us "alter check constraint" — we drop + add.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'calendar_items_status_check'
      and conrelid = 'public.calendar_items'::regclass
  ) then
    alter table public.calendar_items drop constraint calendar_items_status_check;
  end if;
end$$;

alter table public.calendar_items
  add constraint calendar_items_status_check
  check (status in ('scheduled', 'reminder_sent', 'done', 'cancelled', 'failed'));

-- ============================================================
-- Extensions needed for the cron + outbound HTTP.
-- pg_cron — scheduling (built into Supabase, just needs enabling).
-- pg_net  — outbound HTTP (used here to ping the Edge Function).
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================
-- The cron job itself.
-- Runs every 5 minutes. Each run POSTs to the Edge Function, which
-- queries `calendar_items` for due rows and emails the customer.
--
-- ⚠️  Replace YOUR-PROJECT-REF and YOUR-SERVICE-ROLE-KEY below before
-- running. You can find both in Supabase dashboard → Project Settings:
--    Project Settings → General  → Reference ID  (e.g. abcdwxyz1234)
--    Project Settings → API      → service_role secret
--
-- We use the service_role key because the Edge Function needs to query
-- users' rows across all tenants (RLS would block the anon key from
-- doing that). The key never leaves Postgres → Supabase's edge — it's
-- not exposed to any browser.
-- ============================================================

-- If a job with this name already exists, unschedule it so the new
-- schedule replaces cleanly. Safe to run repeatedly.
do $$
declare
  jid bigint;
begin
  select jobid into jid from cron.job where jobname = 'send-due-reminders';
  if jid is not null then
    perform cron.unschedule(jid);
  end if;
end$$;

select cron.schedule(
  'send-due-reminders',
  '*/5 * * * *',     -- every 5 minutes
  $cron$
    select net.http_post(
      url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-due-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR-SERVICE-ROLE-KEY'
      ),
      body := jsonb_build_object('source', 'pg_cron', 'at', now())
    ) as request_id;
  $cron$
);

-- ============================================================
-- One-off "send anything overdue right now" helper.
-- Handy after deploying for the first time, or after a long downtime.
-- Run this manually in the SQL editor (NOT scheduled):
--
--   select net.http_post(
--     url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-due-reminders',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer YOUR-SERVICE-ROLE-KEY'
--     ),
--     body := jsonb_build_object('source', 'manual', 'at', now())
--   );
-- ============================================================

-- ============================================================
-- Inspecting the schedule.
-- These are read-only and safe to run any time:
--
--   select * from cron.job where jobname = 'send-due-reminders';
--   select * from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'send-due-reminders')
--     order by start_time desc limit 20;
-- ============================================================
