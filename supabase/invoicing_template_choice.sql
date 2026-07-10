-- ============================================================================
-- TMKE Invoicing — per-invoice template choice.
-- Lets whoever raises an invoice pick the style (minimal | banded) for that
-- invoice, overriding the saved default in invoice_settings. Nullable — when
-- null the send/render falls back to invoice_settings.template.
-- Run AFTER supabase/invoicing.sql. Safe to re-run.
-- ============================================================================
alter table public.invoices
  add column if not exists template text;
