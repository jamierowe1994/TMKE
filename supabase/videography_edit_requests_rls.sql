-- TMKE — edit requests: admins, or the member whose booking it is
-- ---------------------------------------------------------------------------
-- The original policy on this table was `for all to authenticated using (true)`,
-- written when the only signed-in people were admins. That is no longer true:
-- members sign in too, and as it stood any one of them could read every
-- client's edit notes.
--
-- Same shape as videography_bookings: admins get everything, a member gets the
-- rows hanging off a booking they can already see, and writes stay admin-only.
-- The public /edits page is unaffected either way - it never touches this table
-- directly, it goes through the Worker, which uses the service role and bypasses
-- RLS entirely.
--
-- Run after supabase/videography_edit_requests.sql. Safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.videography_edit_requests enable row level security;

drop policy if exists "videography_edit_requests authed all"  on public.videography_edit_requests;
drop policy if exists "videography_edit_requests read own"    on public.videography_edit_requests;
drop policy if exists "videography_edit_requests admin write" on public.videography_edit_requests;

create policy "videography_edit_requests read own"
  on public.videography_edit_requests for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.videography_bookings b
      where b.id = videography_edit_requests.booking_id
        and (
          b.account_user_id = auth.uid()
          or lower(b.client_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

create policy "videography_edit_requests admin write"
  on public.videography_edit_requests for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- Check it worked. As yourself (an admin) this returns every row:
--   select count(*) from public.videography_edit_requests;
-- Signed in as a member, it returns only their own bookings' requests.
-- ============================================================
