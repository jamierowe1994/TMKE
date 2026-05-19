-- TMKE admin centre — custom brand fonts.
-- Run this in the Supabase SQL editor after schema.sql.

create table if not exists public.brand_fonts (
  id            uuid primary key default gen_random_uuid(),
  family        text not null,                              -- CSS font-family
  display_name  text,                                       -- optional friendlier label
  file_url      text not null,                              -- public URL to .ttf/.otf/.woff/.woff2
  weight        integer not null default 400,
  style         text not null default 'normal'
                check (style in ('normal', 'italic')),
  uploaded_at   timestamptz not null default now()
);

create index if not exists brand_fonts_family_idx
  on public.brand_fonts (family);

-- ============================================================
-- RLS — anyone can read brand fonts (customer editor needs them
-- too); only authenticated admins can upload / delete.
-- ============================================================
alter table public.brand_fonts enable row level security;

drop policy if exists "brand_fonts read all" on public.brand_fonts;
create policy "brand_fonts read all"
  on public.brand_fonts for select
  using (true);

drop policy if exists "brand_fonts insert authed" on public.brand_fonts;
create policy "brand_fonts insert authed"
  on public.brand_fonts for insert
  to authenticated
  with check (true);

drop policy if exists "brand_fonts update authed" on public.brand_fonts;
create policy "brand_fonts update authed"
  on public.brand_fonts for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "brand_fonts delete authed" on public.brand_fonts;
create policy "brand_fonts delete authed"
  on public.brand_fonts for delete
  to authenticated
  using (true);
