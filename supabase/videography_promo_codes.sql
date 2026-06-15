-- ============================================================================
-- TMKE Videography — promo codes (admin-managed) + booking discount columns
-- Lets staff create discount codes (percent or fixed) that members can apply at
-- the Property / Agent booking summary. The Worker validates codes via
-- /videography/promo and redeems them on a confirmed booking.
-- Safe to re-run (idempotent). Run AFTER supabase/videography_booking_flow.sql.
-- ============================================================================

-- ---- Discount captured on the booking row ----------------------------------
alter table public.videography_bookings
  add column if not exists promo_code     text,
  add column if not exists discount_pence integer default 0;

-- ---- Promo codes -----------------------------------------------------------
create table if not exists public.videography_promo_codes (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,                 -- stored UPPERCASE
  label           text,                                 -- internal description
  kind            text not null default 'percent',      -- 'percent' | 'fixed'
  value           integer not null default 0,           -- percent (e.g. 10) OR fixed pence (e.g. 5000 = £50)
  services        text[] default '{}',                  -- empty = all; else subset of content-studio | property | agent
  active          boolean default true,
  max_redemptions integer,                              -- null = unlimited
  redemptions     integer default 0,
  expires_at      timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Keep codes uppercase + bump updated_at on change.
create or replace function public.touch_videography_promo_codes()
returns trigger language plpgsql as $$
begin
  new.code := upper(new.code);
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_touch_videography_promo_codes on public.videography_promo_codes;
create trigger trg_touch_videography_promo_codes
  before insert or update on public.videography_promo_codes
  for each row execute function public.touch_videography_promo_codes();

-- Atomic redemption (called by the Worker with the service role on a confirmed
-- booking). No-ops once a capped code is exhausted.
create or replace function public.redeem_promo_code(p_code text)
returns void language sql security definer as $$
  update public.videography_promo_codes
     set redemptions = coalesce(redemptions, 0) + 1, updated_at = now()
   where upper(code) = upper(p_code)
     and active is true
     and (max_redemptions is null or coalesce(redemptions, 0) < max_redemptions);
$$;

-- RLS — admin-only. The Worker reads/redeems with the service role (bypasses
-- RLS); the admin promo editor reads + writes with an authenticated session; the
-- public booking flow never touches this table directly (it calls the Worker
-- /videography/promo endpoint). Tighten `authenticated` to public.is_admin()
-- once the admins-table RLS rollout lands.
alter table public.videography_promo_codes enable row level security;
drop policy if exists "videography_promo_codes admin" on public.videography_promo_codes;
create policy "videography_promo_codes admin"
  on public.videography_promo_codes for all
  to authenticated
  using (true)
  with check (true);
