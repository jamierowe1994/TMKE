-- Free packs for a limited time
--
-- A social pack can be free to every member (access 'members') for a set
-- window, e.g. the Halloween pack for the week before Halloween. It is never
-- on the website: the shop only lists packs people buy (src/lib/pack-access.js
-- shopPacks), and The Edit makes no page for it.
--
--   available_from   members see it from this moment (null = straight away)
--   available_until  and stop seeing it at this one (null = no end)
--
-- Outside the window the pack and its templates are not readable by members,
-- here in the database, so it goes on time without anybody switching it off.
-- Staff still see it, to build it beforehand and to tidy it up after.
-- A free pack is for members only: somebody who is not signed in can't read it.
--
-- Builds on supabase/dual_brand_agents.sql (member_brands()). Run in the
-- Supabase SQL editor. Safe to re-run.

alter table public.packs
  add column if not exists available_from  timestamptz,
  add column if not exists available_until timestamptz;

-- Is the pack open to members right now?
create or replace function public.pack_open_now(p_from timestamptz, p_until timestamptz)
  returns boolean
  language sql
  stable
as $$
  select (p_from is null or now() >= p_from)
     and (p_until is null or now() < p_until)
$$;

grant execute on function public.pack_open_now(timestamptz, timestamptz) to anon, authenticated;

create or replace function public.can_see_pack(p_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select case
    when p_id is null then true
    when public.is_staff() then true
    else exists (
      select 1 from public.packs p
      where p.id = p_id
        and (p.access <> 'brands' or p.brands && public.member_brands())
        and (p.access <> 'members' or auth.uid() is not null)
        and public.pack_open_now(p.available_from, p.available_until)
    )
  end
$$;

drop policy if exists "packs read active" on public.packs;
create policy "packs read active"
  on public.packs for select
  using (
    status = 'active'
    and (
      public.is_staff()
      or (
        (access <> 'brands' or brands && public.member_brands())
        and (access <> 'members' or auth.uid() is not null)
        and public.pack_open_now(available_from, available_until)
      )
    )
  );

-- Check: both columns are there, and every live pack is still readable.
select title, access, status, available_from, available_until,
       public.pack_open_now(available_from, available_until) as open_now
  from public.packs
 order by sort_order;
