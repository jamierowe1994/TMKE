-- TMKE — Videography edit requests (post-payment self-serve edits + upsells)
-- ---------------------------------------------------------------------------
-- Once a client has paid and their gallery PIN has gone out, they get a link
-- to a public page where they can ask for edits and, depending on the shoot
-- type, buy a paid add-on: faux-twilight conversions (property) or extra
-- downloadable images (agent/induction). One row per submission — a client
-- can come back and submit more than once, so the admin panel lists all of
-- them rather than overwriting.
--
-- Run after supabase/videography.sql. Safe to re-run.
-- ---------------------------------------------------------------------------

create table if not exists public.videography_edit_requests (
  id                       uuid primary key default gen_random_uuid(),
  booking_id               uuid not null references public.videography_bookings (id) on delete cascade,
  notes                    text,                              -- free-text "what edits would you like"
  twilight_items           jsonb not null default '[]',        -- [{ "filename": "...", "price_pence": 2500 }]
  extra_images_qty         integer,                            -- set only if they bought the extra-images bundle
  extra_images_price_pence integer,
  status                   text not null default 'pending'
                             check (status in ('pending', 'paid', 'notified')),
  stripe_session_id        text,
  paid_at                  timestamptz,
  notified_at              timestamptz,
  created_at               timestamptz not null default now()
);

create index if not exists videography_edit_requests_booking_idx
  on public.videography_edit_requests (booking_id);

alter table public.videography_edit_requests enable row level security;

-- Admin (logged-in) full access. The public edit-request page never touches
-- this table directly — it goes through the Worker, which reads/writes with
-- the service role — so no anon policy is needed.
drop policy if exists "videography_edit_requests authed all" on public.videography_edit_requests;
create policy "videography_edit_requests authed all"
  on public.videography_edit_requests for all
  to authenticated
  using (true)
  with check (true);

-- The capability token for the public edit-request page — same style as
-- videography_deliveries.token: a plain, unguessable, non-expiring id, minted
-- once (at first gallery-send) rather than reusing reschedule_token, which is
-- a different capability.
alter table public.videography_bookings
  add column if not exists edits_token text;

create index if not exists videography_bookings_edits_token_idx
  on public.videography_bookings (edits_token);

comment on column public.videography_bookings.edits_token is
  'Capability token for the public edit-request page (/edits?token=...). Minted once at first gallery-send.';

-- ============================================================
-- Check it worked:
--   select column_name from information_schema.columns
--   where table_name = 'videography_bookings' and column_name = 'edits_token';
-- ============================================================
