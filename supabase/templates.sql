-- TMKE admin centre — design templates table.
-- The shape mirrors `src/data/library.js` so the editor can read both.
-- Run this in the Supabase SQL editor after schema.sql.

create table if not exists public.templates (
  id            text primary key,                       -- e.g. "tmpl-01" — also used in URLs
  name          text not null,
  category      text,
  thumb_url     text,
  canvas        jsonb not null default '{}'::jsonb,     -- { width, height, background }
  elements      jsonb not null default '[]'::jsonb,     -- array of element objects
  pack_id       uuid references public.packs(id) on delete set null,
  status        text not null default 'active'
                check (status in ('active', 'draft', 'archived')),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists templates_status_sort_idx
  on public.templates (status, sort_order);

create index if not exists templates_pack_id_idx
  on public.templates (pack_id);

-- Touch updated_at on every update (reuses fn from schema.sql)
drop trigger if exists templates_set_updated_at on public.templates;
create trigger templates_set_updated_at
  before update on public.templates
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS — public can read live templates (the customer editor
-- needs to render them); only authenticated admins can mutate.
-- ============================================================
alter table public.templates enable row level security;

drop policy if exists "templates read active" on public.templates;
create policy "templates read active"
  on public.templates for select
  using (status = 'active');

drop policy if exists "templates read all authed" on public.templates;
create policy "templates read all authed"
  on public.templates for select
  to authenticated
  using (true);

drop policy if exists "templates insert authed" on public.templates;
create policy "templates insert authed"
  on public.templates for insert
  to authenticated
  with check (true);

drop policy if exists "templates update authed" on public.templates;
create policy "templates update authed"
  on public.templates for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "templates delete authed" on public.templates;
create policy "templates delete authed"
  on public.templates for delete
  to authenticated
  using (true);
