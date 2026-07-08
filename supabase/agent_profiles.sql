-- ============================================================================
-- TMKE — internal-agent (TEG, The Experts Group) profile data on a CRM contact.
--
-- One row per contact who is an internal TEG agent. Holds the extra data we pull
-- from the trainers' spreadsheets (brand, join date, postcode) plus the
-- new-starter free-videography onboarding fields (induction month, package, and
-- their personalised 100% single-use promo code).
--
-- Surfaced in the admin Contacts drawer under a "TEG" tab; populated by the
-- Contacts CSV import and editable by hand. The Worker owns writes so it can
-- generate the promo code atomically (POST /agent/profile).
--
-- Run AFTER supabase/automations.sql (contacts) + supabase/videography_promo_codes.sql.
-- Safe to re-run (idempotent).
-- ============================================================================

create table if not exists public.agent_profiles (
  contact_id       uuid primary key references public.contacts(id) on delete cascade,
  brand            text,                                   -- brand they work for (PPE, TPE, Fine & Country…)
  date_joined      date,                                   -- date they joined
  postcode         text,
  -- New-starter free-videography onboarding (Academy / Pro packages) --------
  is_new_starter   boolean not null default false,
  induction_month  text,                                   -- 'YYYY-MM' (e.g. 2026-08)
  package          text,                                   -- 'academy' | 'pro' | null
  promo_code       text,                                   -- their personalised 100% single-use code
  promo_code_id    uuid references public.videography_promo_codes(id) on delete set null,
  trainer_name     text default 'Kelly Bailey',
  trainer_email    text default 'kelly@theexpertsgroup.co.uk',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists agent_profiles_new_starter_idx
  on public.agent_profiles (is_new_starter, induction_month);

-- Bump updated_at on change.
create or replace function public.touch_agent_profiles()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_touch_agent_profiles on public.agent_profiles;
create trigger trg_touch_agent_profiles
  before update on public.agent_profiles
  for each row execute function public.touch_agent_profiles();

-- RLS — admin-only. The Worker reads/writes with the service role (bypasses
-- RLS); the admin Contacts drawer reads/writes through the Worker too. Uses
-- public.is_admin() (supabase/admins.sql).
alter table public.agent_profiles enable row level security;
drop policy if exists "agent_profiles admin" on public.agent_profiles;
create policy "agent_profiles admin"
  on public.agent_profiles for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());
