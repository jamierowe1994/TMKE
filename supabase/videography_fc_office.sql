-- ============================================================
-- Which Fine & Country office is paying.
--
-- Run AFTER supabase/videography_payment_route.sql. Additive and safe: it adds
-- one empty column to videography_bookings, changes no existing booking, and
-- alters no permissions. Safe to re-run.
-- ============================================================
--
-- WHY A SEPARATE FIELD FROM invoice_recipient_id
--
-- These answer two different questions and must not be collapsed:
--
--   fc_office            — what the AGENT said at booking, when they confirmed
--                          that office is holding the seller's marketing fee.
--                          Evidence of what was claimed, and it must not change
--                          afterwards.
--   invoice_recipient_id — where the invoice is ACTUALLY sent, chosen by Jack
--                          at invoicing time from the address book.
--
-- They will usually agree. When they don't — the agent named the wrong branch —
-- the difference is the thing you need to see, and the agreement makes the
-- agent personally liable in exactly that case. One column would erase it.

alter table public.videography_bookings
  add column if not exists fc_office text;

comment on column public.videography_bookings.fc_office is
  'The F&C office the agent named as holding the seller marketing fee. What was claimed, not where the invoice went — see invoice_recipient_id.';
