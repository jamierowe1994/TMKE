-- ============================================================================
-- TMKE Invoicing — invoice-email footer image.
-- A brand banner appended to the bottom of every invoice covering email
-- (uploaded in Invoicing Settings; stored as a public URL). Nullable.
-- Run AFTER supabase/invoicing.sql. Safe to re-run.
-- ============================================================================
alter table public.invoice_settings
  add column if not exists email_footer_image_url text;
