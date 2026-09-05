-- ============================================================================
-- Management tier for the admin allowlist.
--
-- All admins can already see everyone's operational data (orders, invoices,
-- bookings, contacts). This adds a second, narrower flag for the one thing
-- that shouldn't be visible to every admin by default: rolled-up revenue
-- totals on the Dashboard. Per-invoice amounts and payment status stay
-- visible to everyone (staff need those to confirm the right invoices went
-- out and got paid) — it's only the single "total revenue" summary figure
-- that's gated behind this.
--
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
-- ============================================================================

alter table public.admins
  add column if not exists is_management boolean not null default false;

-- Authoritative server-side check, mirroring public.is_admin() — usable in
-- RLS policies if a management-only table/column ever needs one.
create or replace function public.is_management()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select coalesce((select is_management from public.admins where user_id = auth.uid()), false);
$$;

-- ---- Seed: Danielle + Samantha ---------------------------------------------
-- Upsert rather than plain update — both addresses are on
-- themarketingexperts.co.uk, not @tmke.co.uk, so admins.sql's domain-based
-- auto-seed may never have created their row in the first place.
--
-- 2026-09-05: BOTH addresses in the original seed were wrong. It named
-- 'danielle@themarketingexperts.co.uk' and 'sam@themarketingexperts.co.uk';
-- the real accounts are danielle@tmke.co.uk and samantha@themarketingexperts.
-- co.uk. Neither matched an auth user, so the insert...select matched no rows
-- and the seed granted management to NOBODY — silently, because it only ever
-- gated the Dashboard revenue totals, which simply looked empty.
--
-- Levels are set from Settings > Access now, so this file is the floor rather
-- than the mechanism: run it once to make sure the two of them are covered.
insert into public.admins (user_id, email, is_management)
select id, email, true
from auth.users
where lower(email) in ('danielle@tmke.co.uk', 'samantha@themarketingexperts.co.uk')
on conflict (user_id) do update set is_management = true;

update public.admins set is_management = false
where lower(email) = 'sam@themarketingexperts.co.uk';

-- Everyone else with admin access — Jack, Abie — stays a full admin and is
-- deliberately NOT management: they operate the site, they do not see the
-- invoice ledger, the month-end report or the revenue totals. Nothing to do
-- for them; the flag defaults to false.

-- To grant later, by email:
--   update public.admins set is_management = true where lower(email) = 'person@example.com';
-- To revoke:
--   update public.admins set is_management = false where lower(email) = 'person@example.com';
-- To see where everyone stands:
--   select email, is_management from public.admins order by is_management desc, email;
