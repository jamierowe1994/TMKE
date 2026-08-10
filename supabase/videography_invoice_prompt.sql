-- ============================================================
-- "Raise this invoice" — the two-days-out prompt
-- ============================================================
-- Additive and safe to re-run.
--
-- One column, so the prompt goes once per shoot rather than every morning for
-- two days running. Kept on the booking rather than the invoice for the obvious
-- reason: at the moment it fires, there is no invoice - that is the point.
-- ============================================================

alter table public.videography_bookings
  add column if not exists invoice_prompt_sent_at timestamptz;
