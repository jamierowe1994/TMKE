-- ============================================================
-- The Pixieset upload tick, and stalled-shoot alerts
-- ============================================================
-- Additive and safe to re-run.
--
-- pixieset_uploaded_at
--   Jack ticks this once the collection is up and set to the TMKE standard.
--   Separate from archived_at: those are two different uploads to two different
--   places, and the whole reason the archive exists is that Pixieset expires.
--   One tick for both would hide which of them had actually been done.
--
-- stalled_alerted_at / stalled_alerted_stage
--   So a stalled shoot is reported once when it stalls, and again weekly if it
--   is still sitting there - rather than every morning, which is how a useful
--   alert becomes one nobody reads. Recording the STAGE it was alerted in means
--   a shoot that moves on and stalls somewhere else is reported afresh.
-- ============================================================

alter table public.videography_bookings
  add column if not exists pixieset_uploaded_at   timestamptz,
  add column if not exists stalled_alerted_at     timestamptz,
  add column if not exists stalled_alerted_stage  text;
