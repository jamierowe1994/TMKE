-- ============================================================================
-- Brand designers (Danielle, 24 Nov 2026).
--
-- Someone on a brand's own marketing team, not one of us, who makes that
-- brand's designs in the Studio. What they can do, and nothing else:
--
--   * open the Catalogue and the Design studio (no other admin page);
--   * make packs and designs, for the brands we name for them only;
--   * every pack they make is "Only chosen brands", free, and a draft. It
--     never has a price and never reaches the shop on our website;
--   * they can't put a pack live. Only one of us can, after checking it;
--   * once a pack is live they can't change it or its designs;
--   * they can't see or change anybody else's packs or designs here.
--
-- The screens hide what they can't use, but this file is the lock: the
-- database refuses anything else, whatever the browser sends.
--
-- Also closes an old gap. Designs (the templates table) could be added,
-- changed or deleted by ANY signed-in account through the database's own
-- address, members included. No screen let a member do it, but nothing
-- stopped it either. From here only the team, and a designer on their own
-- designs, can write them.
--
-- A designer is NOT in the admins table, so every other admin table stays
-- shut to them. Add and remove designers in Settings > Access.
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- ============================================================================

-- ------------------------------------------------------------- the people --
create table if not exists public.designers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  brands     text[] not null default '{}',   -- the brands they may make packs for
  created_at timestamptz not null default now()
);

alter table public.designers enable row level security;

-- A designer reads their own row (the screens ask "am I one, and for whom?").
drop policy if exists "designers read self" on public.designers;
create policy "designers read self"
  on public.designers for select
  to authenticated
  using (auth.uid() = user_id);

-- The team reads them all, to say who made a pack. Nobody writes from a
-- browser: Settings > Access goes through the Worker.
drop policy if exists "designers read admin" on public.designers;
create policy "designers read admin"
  on public.designers for select
  to authenticated
  using (public.is_admin());

-- One of us always counts as one of us, even if also listed as a designer.
create or replace function public.is_designer()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (select 1 from public.designers where user_id = auth.uid())
     and not public.is_staff();
$$;

create or replace function public.designer_brands()
  returns text[]
  language sql
  stable
  security definer
  set search_path = public
as $$
  select coalesce((select brands from public.designers where user_id = auth.uid()), '{}'::text[]);
$$;

grant execute on function public.is_designer() to anon, authenticated;
grant execute on function public.designer_brands() to anon, authenticated;

-- ------------------------------------------------------- who made what ----
-- Filled in from now on; everything made before stays empty, which is what
-- keeps it out of a designer's reach.
alter table public.packs     add column if not exists created_by uuid;
alter table public.templates add column if not exists created_by uuid;
alter table public.packs     alter column created_by set default auth.uid();
alter table public.templates alter column created_by set default auth.uid();

-- When a designer asked us to check a pack (set by the Worker, never by them).
alter table public.packs add column if not exists review_requested_at timestamptz;

create index if not exists packs_created_by_idx     on public.packs (created_by);
create index if not exists templates_created_by_idx on public.templates (created_by);

-- Is this one of the caller's own packs, and still a draft? No pack counts
-- as open: a design that isn't in a pack yet.
create or replace function public.designer_pack_open(p_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select p_id is null or exists (
    select 1 from public.packs p
     where p.id = p_id and p.created_by = auth.uid() and p.status = 'draft'
  );
$$;

-- The caller's own pack, at any stage (for reading its plan once it's live).
create or replace function public.designer_owns_pack(p_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (select 1 from public.packs p where p.id = p_id and p.created_by = auth.uid());
$$;

-- Is this design's pack shut to the caller: somebody else's, or no longer a
-- draft? A pack that has just been deleted isn't shut (deleting a pack frees
-- its designs, and that has to be allowed to finish).
create or replace function public.designer_pack_shut(p_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.packs p
     where p.id = p_id and (p.created_by is distinct from auth.uid() or p.status <> 'draft')
  );
$$;

grant execute on function public.designer_pack_open(uuid) to authenticated;
grant execute on function public.designer_owns_pack(uuid) to authenticated;
grant execute on function public.designer_pack_shut(uuid) to authenticated;

-- ------------------------------------------------------------------ packs --
-- What a designer's pack is allowed to be, whatever was sent. Fires for
-- designers only; the team and the Worker pass straight through.
create or replace function public.packs_designer_guard()
  returns trigger
  language plpgsql
  set search_path = public
as $$
declare
  mine text[];
begin
  if not public.is_designer() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op <> 'INSERT' then
    if old.created_by is distinct from auth.uid() then
      raise exception 'This pack isn''t yours to change.' using errcode = '42501';
    end if;
    if old.status <> 'draft' then
      raise exception 'This pack is live, so it can''t be changed here. Ask The Marketing Experts.' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;

  mine := public.designer_brands();

  if tg_op = 'INSERT' then
    new.created_by          := auth.uid();
    new.status              := 'draft';
    new.launched_at         := null;
    new.test_user_ids       := '{}';
    new.review_requested_at := null;
    new.demo                := false;
    new.training            := false;
  else
    new.created_by          := old.created_by;
    new.status              := old.status;
    new.launched_at         := old.launched_at;
    new.test_user_ids       := old.test_user_ids;
    new.review_requested_at := old.review_requested_at;
    new.demo                := old.demo;
    new.training            := old.training;
    new.sort_order          := old.sort_order;
  end if;

  -- Their brands only, free, and never the shop.
  new.access          := 'brands';
  new.price_pence     := 0;
  new.available_from  := null;
  new.available_until := null;
  new.brands          := coalesce(new.brands, '{}'::text[]);
  if not (new.brands <@ mine) then
    raise exception 'You can only make packs for: %.', array_to_string(mine, ', ') using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists packs_designer_guard on public.packs;
create trigger packs_designer_guard
  before insert or update or delete on public.packs
  for each row execute function public.packs_designer_guard();

drop policy if exists "packs designer read" on public.packs;
create policy "packs designer read"
  on public.packs for select
  to authenticated
  using (created_by = auth.uid() and public.is_designer());

drop policy if exists "packs designer insert" on public.packs;
create policy "packs designer insert"
  on public.packs for insert
  to authenticated
  with check (public.is_designer() and created_by = auth.uid() and status = 'draft' and access = 'brands');

drop policy if exists "packs designer update" on public.packs;
create policy "packs designer update"
  on public.packs for update
  to authenticated
  using (public.is_designer() and created_by = auth.uid() and status = 'draft')
  with check (public.is_designer() and created_by = auth.uid() and status = 'draft' and access = 'brands');

drop policy if exists "packs designer delete" on public.packs;
create policy "packs designer delete"
  on public.packs for delete
  to authenticated
  using (public.is_designer() and created_by = auth.uid() and status = 'draft');

-- -------------------------------------------------------------- templates --
-- A designer's design is theirs, a draft, an ordinary design (never a
-- contact block or a Content Calendar post), and only ever in one of their
-- own packs that isn't live. They can't change its status: one of us makes
-- it live with the pack.
create or replace function public.templates_designer_guard()
  returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  if not public.is_designer() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op <> 'INSERT' then
    if old.created_by is distinct from auth.uid() then
      raise exception 'This design isn''t yours to change.' using errcode = '42501';
    end if;
    if (old.pack_id is null and old.status <> 'draft') or (old.pack_id is not null and public.designer_pack_shut(old.pack_id)) then
      raise exception 'This design is live, so it can''t be changed here. Ask The Marketing Experts.' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;

  if tg_op = 'INSERT' then
    new.created_by    := auth.uid();
    new.status        := 'draft';
    new.kind          := 'template';
    new.block_variant := null;
    new.block_box     := null;
    new.collection    := null;
  else
    new.created_by    := old.created_by;
    new.status        := old.status;
    new.kind          := old.kind;
    new.block_variant := old.block_variant;
    new.block_box     := old.block_box;
    new.collection    := old.collection;
  end if;

  if new.pack_id is null then
    -- Out of a pack it can't stay live: a live design in no pack shows to everyone.
    new.status := 'draft';
  elsif not public.designer_pack_open(new.pack_id) then
    raise exception 'A design can only go in one of your own packs that isn''t live yet.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists templates_designer_guard on public.templates;
create trigger templates_designer_guard
  before insert or update or delete on public.templates
  for each row execute function public.templates_designer_guard();

-- Writes: the team, and a designer on their own. These three REPLACE the old
-- "any signed-in account" rules (see the top of this file).
drop policy if exists "templates insert authed" on public.templates;
drop policy if exists "templates update authed" on public.templates;
drop policy if exists "templates delete authed" on public.templates;

drop policy if exists "templates insert staff" on public.templates;
create policy "templates insert staff"
  on public.templates for insert
  to authenticated
  with check (public.is_staff());

drop policy if exists "templates update staff" on public.templates;
create policy "templates update staff"
  on public.templates for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "templates delete staff" on public.templates;
create policy "templates delete staff"
  on public.templates for delete
  to authenticated
  using (public.is_staff());

drop policy if exists "templates designer read" on public.templates;
create policy "templates designer read"
  on public.templates for select
  to authenticated
  using (created_by = auth.uid() and public.is_designer());

drop policy if exists "templates designer insert" on public.templates;
create policy "templates designer insert"
  on public.templates for insert
  to authenticated
  with check (public.is_designer() and created_by = auth.uid() and public.designer_pack_open(pack_id));

drop policy if exists "templates designer update" on public.templates;
create policy "templates designer update"
  on public.templates for update
  to authenticated
  using (public.is_designer() and created_by = auth.uid() and public.designer_pack_open(pack_id))
  with check (public.is_designer() and created_by = auth.uid() and public.designer_pack_open(pack_id));

drop policy if exists "templates designer delete" on public.templates;
create policy "templates designer delete"
  on public.templates for delete
  to authenticated
  using (public.is_designer() and created_by = auth.uid() and public.designer_pack_open(pack_id));

-- ------------------------------------------------------- the pack's plan --
-- The builder's steps and rows, on their own packs: read at any stage,
-- changed only while the pack is a draft.
drop policy if exists "pack_plans designer read" on public.pack_plans;
create policy "pack_plans designer read" on public.pack_plans
  for select to authenticated
  using (public.is_designer() and public.designer_owns_pack(pack_id));

drop policy if exists "pack_plans designer insert" on public.pack_plans;
create policy "pack_plans designer insert" on public.pack_plans
  for insert to authenticated
  with check (public.is_designer() and pack_id is not null and public.designer_pack_open(pack_id));

drop policy if exists "pack_plans designer update" on public.pack_plans;
create policy "pack_plans designer update" on public.pack_plans
  for update to authenticated
  using (public.is_designer() and pack_id is not null and public.designer_pack_open(pack_id))
  with check (public.is_designer() and pack_id is not null and public.designer_pack_open(pack_id));

drop policy if exists "pack_plan_rows designer read" on public.pack_plan_rows;
create policy "pack_plan_rows designer read" on public.pack_plan_rows
  for select to authenticated
  using (public.is_designer() and public.designer_owns_pack(pack_id));

drop policy if exists "pack_plan_rows designer insert" on public.pack_plan_rows;
create policy "pack_plan_rows designer insert" on public.pack_plan_rows
  for insert to authenticated
  with check (public.is_designer() and pack_id is not null and public.designer_pack_open(pack_id));

drop policy if exists "pack_plan_rows designer update" on public.pack_plan_rows;
create policy "pack_plan_rows designer update" on public.pack_plan_rows
  for update to authenticated
  using (public.is_designer() and pack_id is not null and public.designer_pack_open(pack_id))
  with check (public.is_designer() and pack_id is not null and public.designer_pack_open(pack_id));

drop policy if exists "pack_plan_rows designer delete" on public.pack_plan_rows;
create policy "pack_plan_rows designer delete" on public.pack_plan_rows
  for delete to authenticated
  using (public.is_designer() and pack_id is not null and public.designer_pack_open(pack_id));

notify pgrst, 'reload schema';

-- Check: every rule now on designs and packs, one line each. There should be
-- no line for templates that says "authed".
select tablename as "table", policyname as "rule", cmd as "for"
  from pg_policies
 where schemaname = 'public' and tablename in ('templates', 'packs', 'designers')
 order by tablename, cmd, policyname;
