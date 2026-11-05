-- ============================================================================
-- Social media pricing figures (Danielle, 5 Nov 2026): the hours, rates,
-- software, property pack and margins the package calculator prices from.
-- Edited on Social media › Settings › Packages & pricing. One row (id = 1).
-- Until it's saved, the page uses the starting figures in src/lib/smm-calc.js
-- and says so. Every admin can read it; only management can change it.
-- Safe to run twice.
-- ============================================================================
create table if not exists public.smm_pricing_settings (
  id          integer primary key default 1,
  figures     jsonb not null default '{}',
  updated_at  timestamptz not null default now(),
  updated_by  text,
  constraint smm_pricing_settings_singleton check (id = 1)
);

create or replace function public.touch_smm_pricing_settings()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_touch_smm_pricing_settings on public.smm_pricing_settings;
create trigger trg_touch_smm_pricing_settings before update on public.smm_pricing_settings
  for each row execute function public.touch_smm_pricing_settings();

alter table public.smm_pricing_settings enable row level security;
drop policy if exists "smm_pricing_settings read" on public.smm_pricing_settings;
create policy "smm_pricing_settings read" on public.smm_pricing_settings
  for select to authenticated using (public.is_admin());
drop policy if exists "smm_pricing_settings write" on public.smm_pricing_settings;
create policy "smm_pricing_settings write" on public.smm_pricing_settings
  for all to authenticated using (public.is_management()) with check (public.is_management());
