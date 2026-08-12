-- ============================================================
-- The 360 tour link — held back exactly like the gallery PIN
-- ============================================================
-- Replaces the floor plan link on the gallery-ready flow. Run after
-- supabase/videography_rls.sql (needs public.is_admin()). Safe to re-run.
--
-- WHY A SEPARATE TABLE
--
-- videography_bookings is readable row-by-row by its own client (see
-- "bookings read own" in supabase/videography_rls_fix.sql) - that policy is
-- row-level, not column-level, so a plain column on that table would let a
-- client read their 360 tour link before paying, the same problem the PIN
-- already solved by living in videography_gallery_pins instead. This table
-- follows that exact pattern: admin-only RLS, no member policy at all, read
-- by a client only through a Worker endpoint that checks paid_at first.
--
-- floorplan_url is left exactly as it was - untouched, not read from here -
-- in case there's ever a reason to go back to it. This is additive only.

create table if not exists public.videography_tour_links (
  booking_id uuid primary key
    references public.videography_bookings (id) on delete cascade,
  url        text,
  updated_at timestamptz not null default now()
);

alter table public.videography_tour_links enable row level security;

drop policy if exists "tour links admin only" on public.videography_tour_links;
create policy "tour links admin only"
  on public.videography_tour_links for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Check it worked:
--   select tablename, policyname from pg_policies
--    where schemaname = 'public' and tablename = 'videography_tour_links';
-- Expect exactly one row, the admin-only policy above.
-- ============================================================
