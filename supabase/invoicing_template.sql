-- ============================================================================
-- TMKE Invoicing — invoice template design (style + accent + logo).
-- Adds the design fields to invoice_settings, chosen/edited in
-- Admin → Invoicing → Template. Run AFTER supabase/invoicing.sql. Safe to re-run.
-- ============================================================================
alter table public.invoice_settings
  add column if not exists template     text default 'classic',  -- classic | modern | minimal
  add column if not exists accent_color text default '#371e28',
  add column if not exists logo_url     text,
  add column if not exists show_bank    boolean default true;
