-- ============================================================================
-- Catalogue pack builder (Danielle, 12 Nov 2026).
--
-- The Catalogue now builds a pack the way the Content Calendar builds a month:
-- Initial planning, Creation, Prompts and guidance, Final checks, then the
-- Shop listing (today's pack editor). Agreed on the mock-up at
-- docs/tmke-os/catalogue/index.html.
--
--   pack_plans       one row per pack being built: its step (1 to 5) and the
--                    team's line about it. A pack with no row is finished.
--   pack_plan_rows   the designs planned for it, in order: the idea, type, a
--                    team note, the design once made, and the ticks.
--   packs.test_user_ids
--                    "Send me the test pack": the test logins that can see
--                    this pack while it's still a draft. Cleared on publish.
--
-- Team only: members never read the plan tables. Run in the Supabase SQL
-- editor. Safe to re-run. Changes nothing anyone sees.
-- ============================================================================

create table if not exists public.pack_plans (
  pack_id     uuid primary key references public.packs(id) on delete cascade,
  stage       int  not null default 1 check (stage between 1 and 5),
  about       text,
  updated_at  timestamptz not null default now()
);

create table if not exists public.pack_plan_rows (
  id          uuid primary key default gen_random_uuid(),
  pack_id     uuid not null references public.packs(id) on delete cascade,
  sort_order  int  not null default 0,
  idea        text,
  post_type   text not null default 'single' check (post_type in ('single', 'carousel', 'story', 'reel')),
  note        text,
  template_id text references public.templates(id) on delete set null,
  copied_from text,                                   -- "The Autumn Edit", when the design was copied in
  fields_ok   boolean not null default false,          -- Editing fields set up
  preview_ok  boolean not null default false,          -- Preview made
  member_ok   boolean not null default false,          -- Tested as a member
  created_at  timestamptz not null default now()
);
create index if not exists pack_plan_rows_pack_idx on public.pack_plan_rows (pack_id, sort_order);

alter table public.pack_plans enable row level security;
alter table public.pack_plan_rows enable row level security;

drop policy if exists "pack_plans admin" on public.pack_plans;
create policy "pack_plans admin" on public.pack_plans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pack_plan_rows admin" on public.pack_plan_rows;
create policy "pack_plan_rows admin" on public.pack_plan_rows
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- The test pack: a draft pack a named test login can read, so it shows in
-- that login's Studio. Policies add together, so this opens nothing else.
alter table public.packs
  add column if not exists test_user_ids uuid[] not null default '{}';

drop policy if exists "packs read test" on public.packs;
create policy "packs read test" on public.packs
  for select to authenticated
  using (auth.uid() = any(test_user_ids));

notify pgrst, 'reload schema';

-- Check: both tables exist and nothing is planned yet.
select (select count(*) from public.pack_plans) as plans,
       (select count(*) from public.pack_plan_rows) as rows,
       (select count(*) from public.packs where cardinality(test_user_ids) > 0) as test_packs;
