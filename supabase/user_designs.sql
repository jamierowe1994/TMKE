-- TMKE — members' own design copies ("My Designs").
-- Run in the Supabase SQL editor.
--
-- Pack templates (public.templates) stay pristine, read-only originals. When a
-- member edits a template and it auto-saves, the editor creates a COPY here
-- (source_template_id points back to the original). Later saves update the same
-- row. Re-opening ?design=<id> continues editing that copy. Owner-only RLS.

create extension if not exists "pgcrypto";

create table if not exists public.user_designs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  source_template_id text,                    -- the template.id this was copied from
  name               text,
  canvas             jsonb,                   -- { width, height, background, ... }
  elements           jsonb,                   -- element array (single-page legacy)
  pages              jsonb,                   -- [{ id, name, canvas, elements }] (multi-page)
  thumb_url          text,                    -- preview image (Supabase storage URL)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists user_designs_user_idx on public.user_designs (user_id, updated_at desc);

-- Touch updated_at on write (set_updated_at() ships with schema.sql/orders.sql).
drop trigger if exists user_designs_set_updated_at on public.user_designs;
create trigger user_designs_set_updated_at
  before update on public.user_designs
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS — a member sees and edits only their own designs.
-- ============================================================
alter table public.user_designs enable row level security;

drop policy if exists "user_designs own select" on public.user_designs;
create policy "user_designs own select"
  on public.user_designs for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_designs own insert" on public.user_designs;
create policy "user_designs own insert"
  on public.user_designs for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_designs own update" on public.user_designs;
create policy "user_designs own update"
  on public.user_designs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "user_designs own delete" on public.user_designs;
create policy "user_designs own delete"
  on public.user_designs for delete to authenticated
  using (user_id = auth.uid());
