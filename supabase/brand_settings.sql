-- ============================================================================
-- TMKE Brand kit — one shared, admin-centre-wide record of the TMKE brand:
-- colour palette, fonts (for reference), and the logos. A singleton (id = 1),
-- the same for every admin. Pulled into the Email Studio (colours + logo) and,
-- over time, other tools. The Worker reads/writes with the service role.
-- Run AFTER supabase/admins.sql (+ ideally supabase/invoicing.sql so the logo
-- pre-fill below can copy the two logos already set in the invoice centre).
-- Safe to re-run.
-- ============================================================================
create table if not exists public.brand_settings (
  id                 integer primary key default 1,
  colors             jsonb not null default '[]',   -- ["#371E28", ...] preset swatches
  heading_font       text,
  subheading_font    text,
  body_font          text,
  logo_url           text,                            -- primary TMKE logo
  footer_image_url   text,                            -- secondary / email footer banner
  updated_at         timestamptz not null default now(),
  constraint brand_settings_singleton check (id = 1)
);

-- Seed with the house palette + fonts, and pre-fill the logos from the invoice
-- centre if that table exists (so branding isn't set twice). Colours: wine, brown,
-- beige, wash, paper, ink (see the brand palette).
insert into public.brand_settings (id, colors, heading_font, subheading_font, body_font, logo_url, footer_image_url)
select 1,
  '["#371E28","#7E6765","#C9BCB7","#EAE5E1","#F4F2F1","#1C1D22"]'::jsonb,
  'Helios, Helvetica, Arial, sans-serif',
  'The Seasons, Georgia, "Times New Roman", serif',
  'Darker Grotesque, Arial, sans-serif',
  (select logo_url from public.invoice_settings where id = 1),
  (select email_footer_image_url from public.invoice_settings where id = 1)
on conflict (id) do nothing;
-- Fallback seed if invoice_settings doesn't exist yet.
insert into public.brand_settings (id, colors, heading_font, subheading_font, body_font)
  values (1, '["#371E28","#7E6765","#C9BCB7","#EAE5E1","#F4F2F1","#1C1D22"]'::jsonb,
    'Helios, Helvetica, Arial, sans-serif', 'The Seasons, Georgia, "Times New Roman", serif', 'Darker Grotesque, Arial, sans-serif')
  on conflict (id) do nothing;

-- updated_at touch
create or replace function public.touch_brand_settings()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_touch_brand_settings on public.brand_settings;
create trigger trg_touch_brand_settings before update on public.brand_settings
  for each row execute function public.touch_brand_settings();

-- RLS — admin only (the Worker uses the service role, which bypasses RLS).
alter table public.brand_settings enable row level security;
drop policy if exists "brand_settings admin" on public.brand_settings;
create policy "brand_settings admin" on public.brand_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
