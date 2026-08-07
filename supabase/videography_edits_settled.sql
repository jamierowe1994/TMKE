-- ============================================================
-- Closing a job properly
-- ============================================================
-- Additive and safe to re-run.
--
-- A shoot cannot be marked delivered until two things are true:
--   1. the client has paid          (paid_at, already there)
--   2. any edits have been settled  (this)
--
-- Clients get a round of edits under their agreement, so "the gallery went out"
-- is not the same as "the job is finished". Without somewhere to record that,
-- delivered would only ever mean "we sent it", and a job with an outstanding
-- amend would look closed.
-- ============================================================

alter table public.videography_bookings
  add column if not exists edits_settled_at timestamptz,
  add column if not exists edits_settled_by text,
  -- Somewhere for the ad-hoc link Jack sometimes needs: a thing that is neither
  -- the gallery nor the floor plan, with its own label so the client knows what
  -- it is.
  add column if not exists extra_link_label text,
  add column if not exists extra_link_url   text,
  -- When the "your gallery is ready" email actually went, so it sends once and
  -- so there is a record of what the client was told and when.
  add column if not exists gallery_sent_at  timestamptz;

comment on column public.videography_bookings.edits_settled_at is
  'Set when the client''s round of edits is done or declined. Required, with paid_at, before a booking can be delivered.';
