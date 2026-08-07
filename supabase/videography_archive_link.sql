-- ============================================================
-- Where the internal copy lives
-- ============================================================
-- Additive and safe to re-run.
--
-- Uploads are stored under the booking's id, which is stable and safe but
-- unreadable - nobody browsing storage can tell one folder from another. So the
-- admin centre generates a human name (shoot type, client, date, location) for
-- the folder, and records a link straight to it.
--
-- INTERNAL ONLY. This is the team's route to the archive for promotional use.
-- It must never appear in the members hub or in any client email - the client's
-- route is the Pixieset gallery, which is watermarked and PIN-gated. Nothing
-- reads these columns client-side, and nothing should.
-- ============================================================

alter table public.videography_bookings
  add column if not exists archive_folder text,
  add column if not exists archive_url    text;

comment on column public.videography_bookings.archive_url is
  'Internal link to the stored content. Admin only - never surfaced to a client.';
