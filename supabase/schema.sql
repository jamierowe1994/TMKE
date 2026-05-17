-- TMKE admin centre — initial schema
-- Run this once in the Supabase SQL editor for a fresh project.

create extension if not exists "pgcrypto";

-- ============================================================
-- packs — purchasable design template packs ("The Edit")
-- ============================================================
create table if not exists public.packs (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  description   text,
  price_pence   integer not null default 0,        -- store as pence to avoid float drift
  cover_image_url text,
  contents      jsonb not null default '[]'::jsonb, -- array of bullet strings shown on the card
  category      text,                               -- contemporary / classic / seasonal / lifestyle / planning / free
  status        text not null default 'active'
                check (status in ('active', 'archived', 'draft')),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists packs_status_sort_idx
  on public.packs (status, sort_order);

-- Touch updated_at on every update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists packs_set_updated_at on public.packs;
create trigger packs_set_updated_at
  before update on public.packs
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS — public can read live packs; only authenticated users mutate
-- ============================================================
alter table public.packs enable row level security;

drop policy if exists "packs read active" on public.packs;
create policy "packs read active"
  on public.packs for select
  using (status = 'active');

drop policy if exists "packs read all when authed" on public.packs;
create policy "packs read all when authed"
  on public.packs for select
  to authenticated
  using (true);

drop policy if exists "packs write authed" on public.packs;
create policy "packs write authed"
  on public.packs for insert
  to authenticated
  with check (true);

drop policy if exists "packs update authed" on public.packs;
create policy "packs update authed"
  on public.packs for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "packs delete authed" on public.packs;
create policy "packs delete authed"
  on public.packs for delete
  to authenticated
  using (true);
