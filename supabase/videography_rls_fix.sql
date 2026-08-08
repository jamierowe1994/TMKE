-- ============================================================
-- Finish locking down the videography tables
-- ============================================================
-- Run this after supabase/videography_rls.sql. Safe to re-run.
--
-- WHY THIS IS NEEDED
-- videography_rls.sql dropped policies BY NAME - it guessed at "<table> authed
-- all" and "<table> admin only". Any policy named anything else survived, and
-- because policies are OR'd together, a single surviving `using (true)` leaves
-- the table wide open no matter what else was added beside it.
--
-- So this drops EVERY policy on each table first, then creates exactly the ones
-- that should exist. No guessing at names.
--
-- AFTER RUNNING, this should return no rows:
--   select tablename, policyname, qual from pg_policies
--    where schemaname='public' and tablename like 'videography%' and qual='true';
-- ============================================================

do $$
declare
  t text;
  p record;
  tables text[] := array[
    'videography_bookings',
    'videography_availability',
    'videography_deliveries',
    'videography_deliverables',
    'videography_promo_codes',
    'videography_settings',
    'videography_gallery_pins'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    -- Every existing policy goes, whatever it is called.
    for p in
      select policyname from pg_policies
       where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);

    if t = 'videography_bookings' then
      -- The one table a member legitimately reads: their own bookings, matched
      -- the same way the members hub already filters client-side.
      execute format($f$
        create policy "bookings read own" on public.%I for select to authenticated
        using (
          public.is_admin()
          or account_user_id = auth.uid()
          or lower(client_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )$f$, t);
      -- Writes are staff only. Clients cancel and reschedule through the
      -- Worker, which uses the service role and bypasses RLS entirely.
      execute format($f$
        create policy "bookings admin write" on public.%I for all to authenticated
        using (public.is_admin()) with check (public.is_admin())$f$, t);
    else
      -- Everything else is staff-only. None of it is read from a member's
      -- browser: availability is served through the Worker, deliveries and
      -- deliverables are admin tooling, settings hold our rates, promo codes
      -- are validated by an RPC, and the gallery PINs must never be readable
      -- by the person they gate.
      execute format($f$
        create policy "admin only" on public.%I for all to authenticated
        using (public.is_admin()) with check (public.is_admin())$f$, t);
    end if;
  end loop;
end $$;

-- ============================================================
-- CHECK IT WORKED
--
-- 1. No wide-open policy left (expect no rows):
--      select tablename, policyname, qual from pg_policies
--       where schemaname='public' and tablename like 'videography%' and qual='true';
--
-- 2. Every table has exactly what it should (bookings 2, the rest 1 each):
--      select tablename, count(*) from pg_policies
--       where schemaname='public' and tablename like 'videography%'
--       group by tablename order by tablename;
--
-- 3. THEN open the members hub as a real client and confirm their bookings
--    still list. That is the check that matters - the queries above only prove
--    the policies exist, not that they let the right people in.
-- ============================================================
