-- ============================================================================
-- SMM clients — Direct Debit billing flag (drives the Invoicing tab).
-- direct_debit = they pay by DD through QuickBooks → invoices are raised to the
-- accounts team as monthly reminders, never emailed to the customer.
-- direct_debit_day = day of the month the DD runs (1–28).
-- Safe to re-run.
-- ============================================================================
alter table public.smm_leads
  add column if not exists direct_debit     boolean not null default false,
  add column if not exists direct_debit_day integer;
