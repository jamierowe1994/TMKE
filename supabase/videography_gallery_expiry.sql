-- Gallery expiry warning.
--
-- A Pixieset gallery is held for about three months. A week before it goes, the
-- client gets an email and a notice in their hub. After that it is simply gone
-- as far as they are concerned.
--
-- expiry_warned_at exists so that warning sends ONCE. Without it, whatever runs
-- the check would mail the client every time it ran.
--
-- Additive and safe to re-run. Run after supabase/videography_pixieset.sql.

alter table public.videography_bookings
  add column if not exists expiry_warned_at timestamptz;

-- The galleries due a warning: expiring, not yet warned.
create index if not exists videography_bookings_expiry_due_idx
  on public.videography_bookings (gallery_expires_on)
  where gallery_expires_on is not null and expiry_warned_at is null;
