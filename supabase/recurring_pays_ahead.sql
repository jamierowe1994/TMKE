-- Pays a month ahead (Danielle, 5 Nov 2026). New social media clients pay up
-- front: their first invoice covers their first month, so each monthly invoice
-- after that is for the month ahead (raised in December, for January). Most
-- existing clients pay for the month they're in; Terry's account pays ahead.
-- When this is on, the monthly invoice names the next month. Safe to re-run.
alter table public.recurring_invoices add column if not exists pays_ahead boolean not null default false;
notify pgrst, 'reload schema';
