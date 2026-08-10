-- ============================================================
-- Fine & Country: confirming the office holds the fee
-- ============================================================
-- Additive and safe to re-run.
--
-- The booking already records which office the AGENT said is holding the
-- seller's marketing fee, and a tick for Jack confirming it. What was missing
-- is the step in between: actually asking the office.
--
--   fc_confirm_email    who we asked (their accounts address, not the agent's)
--   fc_confirm_sent_at  when we asked
--
-- Kept separate from brand_fee_confirmed_at, which is when they ANSWERED. The
-- gap between the two is the thing worth being able to see: an office asked
-- nine days ago and still silent is a different problem to one never asked.
-- ============================================================

alter table public.videography_bookings
  add column if not exists fc_confirm_email   text,
  add column if not exists fc_confirm_sent_at timestamptz;
