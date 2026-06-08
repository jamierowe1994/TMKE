-- TMKE — Videography deliverables (files uploaded to R2 per booking)
-- ---------------------------------------------------------------------------
-- One row per uploaded file. The actual bytes live in Cloudflare R2; this table
-- is the queryable index (which booking, file name, size, R2 key, sent status).
-- Run after supabase/videography.sql.
-- ---------------------------------------------------------------------------

create table if not exists public.videography_deliverables (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid references public.videography_bookings (id) on delete cascade,
  file_name    text not null,
  r2_key       text not null unique,
  size_bytes   bigint,
  content_type text,
  kind         text,   -- 'video' | 'image' | 'other' (derived from content_type)
  -- Free-text category Jack assigns at upload (Headshots, Exteriors, Drone,
  -- Video, …) so the client gallery can be grouped/filtered. Null = Other.
  category     text,
  -- 'uploaded' once in R2; 'sent' once included in a client delivery (Phase 5).
  status       text not null default 'uploaded'
               check (status in ('uploaded', 'sent', 'archived')),
  created_at   timestamptz default now()
);

-- Bring existing databases in line (create-table-if-not-exists won't add the
-- column to an already-created table). Safe to run repeatedly.
alter table public.videography_deliverables add column if not exists category text;

create index if not exists videography_deliverables_booking_idx
  on public.videography_deliverables (booking_id, created_at desc);

alter table public.videography_deliverables enable row level security;

drop policy if exists "videography_deliverables authed all" on public.videography_deliverables;
create policy "videography_deliverables authed all"
  on public.videography_deliverables for all
  to authenticated
  using (true)
  with check (true);
