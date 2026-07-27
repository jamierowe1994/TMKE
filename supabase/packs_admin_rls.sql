-- Lock the pack catalogue down to admins.
--
-- WHY: packs' write policies were `to authenticated ... using (true)`, which is
-- every signed-in user — members included. The admin/member split is enforced by
-- src/lib/admin-gate.js, which is CLIENT-side, and both portals talk to Supabase
-- with the same anon key and the same `authenticated` role. A member could
-- therefore insert/update/delete catalogue entries straight from the REST API
-- without ever touching the admin UI.
--
-- Nothing in the member hub writes packs (dashboard / studio / edit /
-- edit/thanks are all .select() only), so this costs no member functionality.
-- The admin pack editor (src/pages/admin/packs/editor.astro) writes through the
-- browser client as a signed-in admin, so it keeps working via public.is_admin().
--
-- PREREQUISITE: supabase/admins.sql must have been run and your admin accounts
-- must have rows in public.admins. Verify BEFORE running this, or admins will
-- lose the ability to edit packs:
--     select a.email from public.admins a;
--
-- Run this in the Supabase SQL editor. Safe to re-run.

-- ============================================================
-- Drop the old permissive policies BY THEIR ORIGINAL NAMES.
-- Postgres ORs policies together, so leaving these in place would keep the
-- hole open no matter what we add alongside them.
-- ============================================================
drop policy if exists "packs write authed"  on public.packs;
drop policy if exists "packs update authed" on public.packs;
drop policy if exists "packs delete authed" on public.packs;

-- ============================================================
-- Admin-only writes
-- ============================================================
drop policy if exists "packs write admin" on public.packs;
create policy "packs write admin"
  on public.packs for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "packs update admin" on public.packs;
create policy "packs update admin"
  on public.packs for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "packs delete admin" on public.packs;
create policy "packs delete admin"
  on public.packs for delete
  to authenticated
  using (public.is_admin());

-- ============================================================
-- Reads are unchanged: anonymous visitors see active packs, and any signed-in
-- user sees the full catalogue (the admin editor needs drafts/archived).
-- NB: that does mean a member can read unreleased pack titles. If that matters,
-- swap "packs read all when authed" for public.is_admin() and give the member
-- hub a status = 'active' filter — left alone here to keep this change tight.
-- ============================================================

-- ============================================================
-- Verify (run as an admin, then as a member):
--   select public.is_admin();                        -- true for admin, false for member
--   update public.packs set title = title;           -- admin: OK, member: 0 rows
-- ============================================================
