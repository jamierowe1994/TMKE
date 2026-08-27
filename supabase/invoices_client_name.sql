-- TMKE — invoices: who the work was actually FOR
-- ---------------------------------------------------------------------------
-- bill_to_name is the payer. On inter-brand work the payer is a finance
-- department that settles for several clients at once, so an invoice said who
-- was paying and nothing about whose job it was. Both accounts teams were left
-- matching invoice numbers back to work by hand.
--
-- It could be inferred from the booking, and the month-end report did exactly
-- that — but only when there IS a booking, and never on the copy the recipient
-- holds. Recording it on the invoice fixes both.
--
-- Safe to re-run. Existing rows stay null; the report still falls back to the
-- booking for those, so nothing that worked stops working.
-- ---------------------------------------------------------------------------

alter table public.invoices
  add column if not exists client_name text;

comment on column public.invoices.client_name is
  'Who the work was for, as opposed to who pays. Null on invoices raised before this column, where the booking is the fallback.';

-- ============================================================
-- Check it worked:
--   select column_name from information_schema.columns
--   where table_name = 'invoices' and column_name = 'client_name';
-- ============================================================
