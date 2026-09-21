-- Print packs, and who is allowed to see them
--
-- A print pack isn't sold. It is a set of print templates drawn for one or
-- more TEG brands, free to the agents of those brands and invisible to
-- everyone else. So a pack needs three things it hasn't had:
--
--   kind    social (everything today) or print
--   access  'buy'     — the shop: anyone can buy it (every pack today)
--           'members' — free to any member, no purchase
--           'brands'  — only members of the brands named below
--   brands  the brand names it is for, e.g. '{"PPE","TPE"}'
--
-- The gatekeeping is done HERE, in the database, not in the page that draws
-- the grid. A rule that only lives in the UI is not a rule: anyone who knows
-- the address of the data can walk round it.
--
-- Run in the Supabase SQL editor, AFTER supabase/admins.sql and
-- supabase/agent_profiles.sql. Safe to re-run.

-- ---------------------------------------------------------------- columns --
alter table public.packs
  add column if not exists kind   text not null default 'social',
  add column if not exists access text not null default 'buy',
  add column if not exists brands text[] not null default '{}';

alter table public.packs drop constraint if exists packs_kind_check;
alter table public.packs
  add constraint packs_kind_check check (kind in ('social', 'print'));

alter table public.packs drop constraint if exists packs_access_check;
alter table public.packs
  add constraint packs_access_check check (access in ('buy', 'members', 'brands'));

create index if not exists packs_kind_idx on public.packs (kind, status, sort_order);

-- ------------------------------------------------------- which brand am I --
-- A member signs in as an auth user; the brand lives on their CRM contact's
-- agent profile. The contact carries user_id, so match on the ACCOUNT first —
-- that is exact, and survives an agent changing their email. Email is only a
-- fallback, for a contact whose account was never linked. security definer so
-- the lookup works for a member who cannot read contacts themselves.
create or replace function public.member_brand()
  returns text
  language sql
  stable
  security definer
  set search_path = public
as $$
  select ap.brand
  from public.contacts c
  join public.agent_profiles ap on ap.contact_id = c.id
  where ap.brand is not null
    and (
      c.user_id = auth.uid()
      or (c.user_id is null
          and lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
    )
  order by (c.user_id = auth.uid()) desc nulls last
  limit 1
$$;

-- Are we staff? is_admin() reads the admins table; the client-side gate also
-- lets any @tmke.co.uk address in, and did so before that table was seeded, so
-- an admin who was never added to it would otherwise find the studio empty.
create or replace function public.is_staff()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select public.is_admin()
      or coalesce(auth.jwt() ->> 'email', '') ilike '%@tmke.co.uk'
$$;

grant execute on function public.is_staff() to anon, authenticated;

-- Can the person asking see this pack? Admins see everything; a pack with no
-- brand restriction is open; a brand pack wants a matching brand.
create or replace function public.can_see_pack(p_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select case
    when p_id is null then true                 -- a loose template, in no pack
    when public.is_staff() then true
    else exists (
      select 1 from public.packs p
      where p.id = p_id
        and (p.access <> 'brands' or public.member_brand() = any (p.brands))
    )
  end
$$;

grant execute on function public.member_brand() to anon, authenticated;
grant execute on function public.can_see_pack(uuid) to anon, authenticated;

-- ------------------------------------------------------------------- packs --
-- Reading a pack: live ones, unless they are for brands you are not in.
drop policy if exists "packs read active" on public.packs;
create policy "packs read active"
  on public.packs for select
  using (
    status = 'active'
    and (access <> 'brands' or public.is_staff() or public.member_brand() = any (brands))
  );

-- --------------------------------------------------------------- templates --
-- These two REPLACE the old pair. The old "read all authed" let any signed-in
-- member read every template in the table, which is fine while every template
-- is for sale and wrong the moment one belongs to a brand.
drop policy if exists "templates read active" on public.templates;
create policy "templates read active"
  on public.templates for select
  using (status = 'active' and public.can_see_pack(pack_id));

drop policy if exists "templates read all authed" on public.templates;
create policy "templates read all admin"
  on public.templates for select
  to authenticated
  using (public.is_staff());

-- Check, before trusting it, that the studio can still see its own drafts:
--   select public.is_staff();          -- true, signed in as you
--   select count(*) from public.templates where status <> 'active';
