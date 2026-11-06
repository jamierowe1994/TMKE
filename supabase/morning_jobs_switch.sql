-- The switch for the 8am jobs (Dani, 6 Nov 2026): reminders and alerts held back
-- until it's turned on in Invoicing > Settings > Automatic invoicing. Off to
-- begin with, and the Worker treats a missing column as off. Safe to run twice.
alter table public.invoice_settings
  add column if not exists morning_jobs_on boolean not null default false;

-- What this should say: morning_jobs_on is false.
select morning_jobs_on from public.invoice_settings where id = 1;
