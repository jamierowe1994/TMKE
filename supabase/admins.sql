-- TMKE admin allowlist.
-- Membership in this table grants access to the /admin/* area and the studio's
-- ?mode=admin chrome. The client gate (src/lib/admin-gate.js) reads it, and the
-- public.is_admin() helper below lets you lock admin-written tables down in RLS
-- so a customer can never write admin data even if they bypass the UI.
--
-- Run this in the Supabase SQL editor. Safe to re-run.

create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- A signed-in user may read ONLY their own admin row (used by the client gate).
-- A non-admin's lookup therefore returns nothing — it never reveals the list.
drop policy if exists "admins read self" on public.admins;
create policy "admins read self"
  on public.admins for select
  to authenticated
  using (auth.uid() = user_id);

-- Authoritative server-side admin check, usable inside other tables' RLS policies,
-- e.g.  create policy "templates admin write" on public.templates
--          for all to authenticated using (public.is_admin()) with check (public.is_admin());
create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ============================================================
-- Seed: make every existing TMKE-domain user an admin, plus the named extra.
-- (The client gate also allows the @tmke.co.uk domain + that email directly, so
--  staff are never locked out even before this runs.)
-- ============================================================
insert into public.admins (user_id, email)
select id, email
from auth.users
where lower(email) like '%@tmke.co.uk'
   or lower(email) = 'james@therecruitmentexperts.co.uk'
on conflict (user_id) do nothing;

-- To add another admin later, by email:
--   insert into public.admins (user_id, email)
--   select id, email from auth.users where lower(email) = 'person@example.com'
--   on conflict (user_id) do nothing;
--
-- To revoke:  delete from public.admins where lower(email) = 'person@example.com';
