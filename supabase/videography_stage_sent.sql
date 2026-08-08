-- ============================================================
-- One more stage: "sent"
-- ============================================================
-- Additive. It widens the allowed stage list; it does not touch a single row.
-- Safe to re-run.
--
-- WHY
-- Mapping James's process against the stages showed three separate jobs sharing
-- one stage. `gallery_ready` was covering:
--
--   1. building the Pixieset gallery
--   2. entering the links, expiry date and PIN
--   3. sending it to the client, then waiting for payment
--
-- Three actions in one stage means the board cannot tell you which of them is
-- outstanding - a shoot sitting in gallery_ready might need Jack to build a
-- gallery, or might be waiting on a client to pay. Those want different people
-- to do different things.
--
-- Split so each stage asks for exactly one thing:
--
--   editing        edit, and upload to the archive
--   gallery_ready  gallery built; add the links, expiry and PIN
--   sent           the client has it; waiting on payment and edits
--   delivered      paid, edits settled, finished
-- ============================================================

alter table public.videography_bookings
  drop constraint if exists videography_bookings_stage_check;

alter table public.videography_bookings
  add constraint videography_bookings_stage_check
  check (stage in ('booked','invoiced','shoot_day','editing','gallery_ready','sent','delivered','cancelled'));

-- ============================================================
-- Check it worked:
--   select stage, count(*) from public.videography_bookings group by stage order by 2 desc;
-- Nothing should have moved - this only makes 'sent' legal.
-- ============================================================
