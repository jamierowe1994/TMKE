-- ============================================================
-- Allow a booking to actually be cancelled.
--
-- Run in the Supabase SQL editor. Additive and safe to re-run: it widens a
-- constraint, so nothing existing can fail it.
-- ============================================================
--
-- THE BUG THIS FIXES
--
-- The Worker sets stage = 'cancelled' when a client cancels
-- (worker/src/index.js, /videography/cancel), but 'cancelled' was never in the
-- allowed list. Postgres rejected the write, and nothing checked the result.
--
-- So a cancellation did this:
--   · deleted the event from Jack's calendar   (the slot was freed)
--   · emailed the client "your booking is cancelled"
--   · left the booking sitting in the pipeline as if it were still live
--
-- Jack could turn up to a shoot the client had cancelled days earlier.

alter table public.videography_bookings
  drop constraint if exists videography_bookings_stage_check;

alter table public.videography_bookings
  add constraint videography_bookings_stage_check
  check (stage in ('booked','shoot_day','editing','final_draft','invoice_out','complete','cancelled'));
