-- ============================================================================
-- TMKE Client report settings — one shared, super-admin-controlled record of
-- which fields/sections of the monthly SMM report are shown in the CLIENT-facing
-- view on /account/social. A singleton (id = 1), the same for every client.
-- The canonical list of field keys lives in src/lib/report-fields.js; this row
-- just stores a { [key]: boolean } visibility map (missing keys fall back to the
-- code defaults via resolveVisibility()). The Worker reads/writes with the
-- service role. Run AFTER supabase/admins.sql. Safe to re-run.
-- ============================================================================
create table if not exists public.report_settings (
  id          integer primary key default 1,
  visibility  jsonb not null default '{}',   -- { followers: true, linkTaps: false, ... }
  updated_at  timestamptz not null default now(),
  constraint report_settings_singleton check (id = 1)
);

-- Seed an empty map — until a super-admin saves, the code defaults in
-- report-fields.js (defaultClientVisibility) apply.
insert into public.report_settings (id, visibility) values (1, '{}'::jsonb)
  on conflict (id) do nothing;

-- updated_at touch
create or replace function public.touch_report_settings()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_touch_report_settings on public.report_settings;
create trigger trg_touch_report_settings before update on public.report_settings
  for each row execute function public.touch_report_settings();

-- RLS — admin only (the Worker uses the service role, which bypasses RLS).
alter table public.report_settings enable row level security;
drop policy if exists "report_settings admin" on public.report_settings;
create policy "report_settings admin" on public.report_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
