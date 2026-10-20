-- Jack's hourly rate, kept with his base details (admin → Videography →
-- Pricing & travel settings). Danielle, 20 Oct 2026: for raising ad hoc
-- invoices without going back to the original spreadsheet. Reference only:
-- nothing prices from it. Pence, like the travel surcharge. The table is
-- admin-only already (videography_rls_fix.sql). Safe to re-run.

alter table public.videography_settings
  add column if not exists hourly_rate_pence integer;

notify pgrst, 'reload schema';
