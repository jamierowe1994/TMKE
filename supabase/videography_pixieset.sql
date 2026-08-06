-- ============================================================
-- Videography delivery via Pixieset
-- ============================================================
-- Additive and safe: only ADDS empty columns to videography_bookings. Nothing
-- is deleted, no existing booking changes, no permissions change. Safe to
-- re-run.
--
-- WHAT CHANGED
-- Delivery used to assume we hosted the files: uploaded to R2, shown in our own
-- gallery at /deliver, gated by our own paywall. Client-facing delivery now
-- happens in Pixieset instead - watermarked and PIN-locked until payment, with
-- downloads capped per gallery and tied to the client's email address.
--
-- We still keep our own copy. Pixieset only holds a gallery for three months,
-- and the team needs this content for promotional use long after that. So Jack
-- uploads twice: once to Pixieset for the client, once to our own storage as
-- the archive. `archived_at` records the second one actually happened.
--
-- Floor plans cannot live in Pixieset, so they are stored separately and the
-- client gets their own link.
--
-- THE PIN IS A CREDENTIAL. It must not appear in the members hub, in any email,
-- or in any admin view a client could reach, until paid_at is set. Storing it
-- here is what lets one place decide that, rather than several.
-- ============================================================

alter table public.videography_bookings
  -- ---- Client-facing delivery (Pixieset) ----
  add column if not exists gallery_url        text,        -- the client's Pixieset gallery
  add column if not exists gallery_pin        text,        -- released ONLY once paid
  add column if not exists gallery_email      text,        -- the address Pixieset gates downloads to
  add column if not exists gallery_expires_on date,        -- Pixieset holds it ~3 months
  add column if not exists store_url          text,        -- Pixieset store, for buying extra downloads
  add column if not exists download_cap       integer,     -- null = uncapped (e.g. property)

  -- ---- Things Pixieset can't hold ----
  add column if not exists floorplan_url      text,

  -- ---- Our own long-term copy ----
  add column if not exists archived_at        timestamptz, -- set when the archive upload is done

  -- ---- Money and release ----
  -- paid_at is deliberately its own flag rather than being read off an invoice.
  -- Payment arrives by two different routes (agent card at booking, brand
  -- invoice before the shoot) and the PIN release must key off one signal.
  add column if not exists paid_at            timestamptz,
  add column if not exists pin_released_at    timestamptz,
  add column if not exists reminder_sent_at   timestamptz; -- day-after-shoot nudge, sent once

-- Finding the jobs that need chasing: shot, not paid, not yet reminded.
create index if not exists videography_bookings_unpaid_idx
  on public.videography_bookings (shoot_date)
  where paid_at is null;

-- Finding galleries about to expire, so the client can be warned before their
-- access disappears at the three-month mark.
create index if not exists videography_bookings_gallery_expiry_idx
  on public.videography_bookings (gallery_expires_on)
  where gallery_expires_on is not null;
