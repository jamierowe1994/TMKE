-- ============================================================
-- Videography: close the "any signed-in member can read everything" hole
-- ============================================================
-- READ THIS FIRST. This changes who can read what. It is the change most
-- likely to break something visible, so it is written to be checked:
-- verification queries are at the bottom, and the members hub should be opened
-- as a real client afterwards.
--
-- Safe to re-run.
--
-- NOTE (7 Aug): this file drops policies BY NAME, which was not enough - any
-- policy named something else survived, and policies are OR'd, so a single
-- leftover `using (true)` kept the table wide open. supabase/videography_rls_fix.sql
-- drops every policy on each table regardless of name and recreates them.
-- Run that one too.
--
-- THE PROBLEM
-- Every videography table was `using (true)` for authenticated users. The
-- members hub filters to "my bookings" IN THE BROWSER, so the database was
-- enforcing nothing: any signed-in member could read every client's name,
-- email, phone, shoot address, quote and signature by dropping the filter.
--
-- Since 5 Aug it is worse. videography_bookings now stores Pixieset gallery
-- PINs, and the whole delivery design rests on "no PIN until paid".
--
-- WHY THE PIN MOVES TO ITS OWN TABLE
-- RLS is row-level, not column-level. A member legitimately reads their OWN
-- booking row - so with the PIN on that row, a member could read their own PIN
-- straight out of the database before paying, simply by asking for the column.
-- Row-level rules cannot express "your row, but not that field".
--
-- So the PIN lives in videography_gallery_pins, which no member can read at
-- all. Admins still read and write it directly (is_admin()), so the admin
-- centre needs no Worker round-trip.
-- ============================================================

-- ---- 1. The PIN, somewhere members cannot reach -------------------------
create table if not exists public.videography_gallery_pins (
  booking_id uuid primary key
    references public.videography_bookings (id) on delete cascade,
  pin        text,
  updated_at timestamptz not null default now()
);

alter table public.videography_gallery_pins enable row level security;

drop policy if exists "gallery pins admin only" on public.videography_gallery_pins;
create policy "gallery pins admin only"
  on public.videography_gallery_pins for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Move anything already stored, then drop the old column so there is one home
-- for it rather than two that can disagree.
insert into public.videography_gallery_pins (booking_id, pin)
  select id, gallery_pin from public.videography_bookings
   where gallery_pin is not null
  on conflict (booking_id) do update set pin = excluded.pin;

alter table public.videography_bookings drop column if exists gallery_pin;

-- ---- 2. Bookings: admins, or the member it belongs to --------------------
drop policy if exists "videography_bookings authed all" on public.videography_bookings;
drop policy if exists "videography_bookings read own"   on public.videography_bookings;
drop policy if exists "videography_bookings admin write" on public.videography_bookings;

create policy "videography_bookings read own"
  on public.videography_bookings for select
  to authenticated
  using (
    public.is_admin()
    or account_user_id = auth.uid()
    or lower(client_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Writes are admins only. Clients cancel and reschedule through the Worker,
-- which uses the service role and bypasses RLS entirely.
create policy "videography_bookings admin write"
  on public.videography_bookings for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- 3. Everything else here is staff-only -------------------------------
-- None of these are read from the browser by a member: availability is served
-- through the Worker, deliveries and deliverables are admin tooling, promo
-- codes are validated by an RPC (leaving them readable would let anyone list
-- every discount we run), and settings hold our base postcode and rates.
do $$
declare t text;
begin
  foreach t in array array[
    'videography_availability',
    'videography_deliveries',
    'videography_deliverables',
    'videography_promo_codes',
    'videography_settings'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', t || ' authed all', t);
      execute format('drop policy if exists %I on public.%I', t || ' admin only', t);
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
        t || ' admin only', t);
    end if;
  end loop;
end $$;

-- ============================================================
-- CHECK IT WORKED
--
-- 1. No table should still be wide open. This should return no rows:
--
--      select tablename, policyname, qual
--        from pg_policies
--       where schemaname = 'public'
--         and tablename like 'videography%'
--         and qual = 'true';
--
-- 2. The PIN column should be gone from bookings, and the new table present:
--
--      select column_name from information_schema.columns
--       where table_name = 'videography_bookings' and column_name = 'gallery_pin';
--      -- expect: no rows
--
-- 3. THEN open the members hub as a real client and confirm their bookings
--    still list. That is the check that actually matters - the queries above
--    only prove the policies exist, not that they let the right people in.
-- ============================================================
