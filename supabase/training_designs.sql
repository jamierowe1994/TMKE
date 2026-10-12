-- TMKE — the training account's saved designs
--
-- The training account (/demo?go=1&brand=demo) is not a login, so it could
-- not save a design, and "Your Saved Designs" had nothing to photograph.
-- Dani, 12 Oct: "I can't actually save a design to the training account,
-- which isn't ideal." No fake account in the CRM, and nothing in the
-- browser that a clean-up would wipe: its designs live here, written with
-- Dani's own admin login, danielle@tmke.co.uk, which is the only login that
-- can read or write this table.
--
-- The same shape as user_designs, so every page that lists, opens, files or
-- deletes a design works on it unchanged (src/lib/design-store.js).
--
-- Run in the Supabase SQL editor. Safe to re-run. The last statement is a
-- check: it is the result the editor shows.

create table if not exists public.training_designs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  source_template_id text,
  name               text,
  canvas             jsonb,
  elements           jsonb,
  pages              jsonb,
  thumb_url          text,
  folder             text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists training_designs_user_idx on public.training_designs (user_id, updated_at desc);

drop trigger if exists training_designs_set_updated_at on public.training_designs;
create trigger training_designs_set_updated_at
  before update on public.training_designs
  for each row execute function public.set_updated_at();

alter table public.training_designs enable row level security;

-- One login, and only that one: read, write, file and delete.
drop policy if exists "training_designs danielle only" on public.training_designs;
create policy "training_designs danielle only"
  on public.training_designs for all
  to authenticated
  using (lower(auth.jwt() ->> 'email') = 'danielle@tmke.co.uk' and user_id = auth.uid())
  with check (lower(auth.jwt() ->> 'email') = 'danielle@tmke.co.uk' and user_id = auth.uid());

-- The check: the table, its rule, and how many training designs it holds.
select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'training_designs') as table_ready,
       exists (select 1 from pg_policies where tablename = 'training_designs' and policyname = 'training_designs danielle only') as danielle_only_rule,
       (select count(*) from public.training_designs) as designs_saved;
