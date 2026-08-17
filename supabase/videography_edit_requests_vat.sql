-- TMKE — edit requests: the VAT columns the Worker has been writing since
--        "VAT: charge it on packs and the videography upsells" (adb2c3e)
-- ---------------------------------------------------------------------------
-- That change started quoting the upsells gross: the line items stay net (that
-- is how they are priced) and the request carries the VAT and the total. The
-- Worker was updated to write both; the table was not, so every submission
-- since has been rejected by PostgREST with
--
--     column videography_edit_requests.vat_pence does not exist
--
-- The Worker discards that and returns "Couldn't save your request. Please try
-- again." - which is why the edits page failed on both Send feedback and
-- Checkout, and why trying again never helped: nothing about it was temporary.
--
-- Rows written before this are left null on purpose. Their VAT was never
-- recorded, and the rate is read from settings rather than fixed, so filling it
-- in now would be inventing a number rather than recovering one.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.videography_edit_requests
  add column if not exists vat_pence   integer,
  add column if not exists total_pence integer;

comment on column public.videography_edit_requests.vat_pence is
  'VAT on the upsell, in pence. Null on requests made before the column existed.';
comment on column public.videography_edit_requests.total_pence is
  'Gross total charged for the upsell, in pence (line items are held net). Null on requests made before the column existed.';

-- ============================================================
-- Check it worked:
--   select column_name from information_schema.columns
--   where table_name = 'videography_edit_requests'
--     and column_name in ('vat_pence', 'total_pence');
-- ============================================================
