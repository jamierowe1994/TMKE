-- ============================================================================
-- Invoicing — Direct Debit "ghost" invoices.
-- payment_method='direct_debit' + billing_month ('YYYY-MM', for monthly dedup)
-- on invoices; dd_invoice_email on smm_leads = who the ghost invoices are sent
-- to (null → the default, danielle@tmke.co.uk for now).
-- Run AFTER supabase/invoicing.sql + supabase/smm_direct_debit.sql. Safe to re-run.
-- ============================================================================
alter table public.invoices
  add column if not exists payment_method text,
  add column if not exists billing_month  text;
create index if not exists invoices_dd_month_idx on public.invoices (booking_id, billing_month);

alter table public.smm_leads
  add column if not exists dd_invoice_email text;
