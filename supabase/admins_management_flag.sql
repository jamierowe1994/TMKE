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

-- ---- Seed: Danielle + Sam, 2026-08-08 --------------------------------------
-- Upsert rather than plain update — Danielle's and Sam's addresses are on
-- themarketingexperts.co.uk, not @tmke.co.uk, so admins.sql's domain-based
-- auto-seed may never have created their row in the first place.
insert into public.admins (user_id, email, is_management)
select id, email, true
from auth.users
where lower(email) in ('danielle@themarketingexperts.co.uk', 'sam@themarketingexperts.co.uk')
on conflict (user_id) do update set is_management = true;

-- To grant later, by email:
--   update public.admins set is_management = true where lower(email) = 'person@example.com';
-- To revoke:
--   update public.admins set is_management = false where lower(email) = 'person@example.com';
