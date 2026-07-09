-- ============================================================================
-- TMKE Invoicing — invoice font controls (Outlook-safe family + base size).
-- Run AFTER supabase/invoicing.sql. Safe to re-run.
-- ============================================================================
alter table public.invoice_settings
  add column if not exists font_family text default 'Arial, Helvetica, sans-serif',
  add column if not exists font_size   integer default 13;
