-- ============================================================
-- READ THIS BEFORE RUNNING
-- ============================================================
-- This locks the backstage tables (contacts, email templates, automations) so
-- that only people on the staff list can see or change them.
--
-- The staff list is the table public.admins. If you are not in it, you will
-- lose access to those admin pages the moment this runs.
--
-- SO: run this first and check your own email is in the list that comes back.
--
--     select email from public.admins order by email;
--
-- If it is missing, run this to add the TMKE staff, then re-check:
--
--     insert into public.admins (user_id, email)
--     select id, email from auth.users
--     where lower(email) like '%@tmke.co.uk'
--        or lower(email) = 'james@therecruitmentexperts.co.uk'
--     on conflict (user_id) do nothing;
--
-- Only once your email appears, run the rest of this file.
-- It is safe to re-run, and it deletes no data.
-- ============================================================
--
-- WHY THIS IS NEEDED
-- The admin area and the member hub are two different doors into the same
-- database. Which buttons you see is decided by the website
-- (src/lib/admin-gate.js), but that is just the website being polite — the
-- database was still accepting "are you signed in?" as the only question, and
-- every member is signed in. These tables were readable AND writable by any
-- member who asked the database directly, without going near the admin pages.
--
-- Nothing in the member hub uses these tables: every reference lives under
-- src/pages/admin/. The Worker uses the service role, which bypasses RLS
-- entirely, so automated sending and enrolment are unaffected.
--
-- Companion to supabase/packs_admin_rls.sql, which did the same for the pack
-- catalogue.

-- ============================================================
-- 1. Email templates — read + write, admins only
-- ============================================================
-- Old names dropped explicitly: Postgres combines policies with OR, so leaving
-- a permissive one behind would keep the door open next to the new lock.
drop policy if exists "email_templates read authed"   on public.email_templates;
drop policy if exists "email_templates insert authed" on public.email_templates;
drop policy if exists "email_templates update authed" on public.email_templates;
drop policy if exists "email_templates delete authed" on public.email_templates;

drop policy if exists "email_templates admin" on public.email_templates;
create policy "email_templates admin"
  on public.email_templates for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 2. Contacts + automations — read + write, admins only
--
-- Six tables, same rule. `contacts` is the important one: it holds people's
-- names, emails and phone numbers, and until now any signed-in member could
-- read the lot.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'contacts','contact_notes','contact_tasks','automations',
    'automation_enrollments','automation_runs'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s admin" on public.%I;', t, t);
    execute format(
      'create policy "%s admin" on public.%I for all to authenticated '
      'using (public.is_admin()) with check (public.is_admin());', t, t);
  end loop;
end $$;

-- ============================================================
-- 3. Check it worked
--
-- Signed in as yourself (an admin), this should return true:
--     select public.is_admin();
--
-- And this should return your contacts as normal:
--     select count(*) from public.contacts;
--
-- Then in the browser: open /admin/contacts, /admin/email and
-- /admin/automations and confirm each still lists and saves.
-- ============================================================
