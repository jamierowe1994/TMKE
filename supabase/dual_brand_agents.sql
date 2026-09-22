-- An agent can work for more than one brand
--
-- Some agents are a Property Expert and a Letting Expert. Some are a Property
-- Expert and a Prestige Property Expert. They are one person with one member
-- account, and they will not thank us for asking them to keep two.
--
-- The tempting shape is one profile with a list of brands. It doesn't hold:
-- the things that differ between an agent's brands are exactly the things a
-- profile holds — a different join date, a different job title, a different
-- patch, a different work number, a different email. A list can't carry two
-- join dates.
--
-- So: ONE ROW PER PERSON PER BRAND. "Is this a dual agent?" stops being a box
-- somebody has to tick and starts being a fact you can see — they have two
-- rows. Nothing to keep in step, nothing that can contradict itself.
--
-- Run in the Supabase SQL editor, after supabase/agent_area.sql. Safe to re-run.

-- ------------------------------------------------------------- the shape --
-- A surrogate key, because `brand` can legitimately still be null on a row
-- that nobody has filled in yet, and a primary key cannot be.
alter table public.agent_profiles
  add column if not exists id uuid not null default gen_random_uuid();

-- Their details AT THIS BRAND. Null means "use the contact's own" — most
-- agents have one number and one address, and nothing should force them to
-- type it twice.
alter table public.agent_profiles
  add column if not exists email      text,
  add column if not exists phone      text,
  -- The brand their Studio opens in. Exactly one per person.
  add column if not exists is_primary boolean not null default true;

do $$
begin
  -- contact_id was the primary key. It becomes one half of a pair.
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.agent_profiles'::regclass
       and contype = 'p' and conname = 'agent_profiles_pkey'
  ) then
    alter table public.agent_profiles drop constraint agent_profiles_pkey;
    alter table public.agent_profiles add constraint agent_profiles_pkey primary key (id);
  end if;
end $$;

-- One row per person per brand: the same brand twice is the same fact twice.
-- Plain columns, not an expression — an upsert can only target an index it
-- can name, and everything that writes here trims the brand first.
create unique index if not exists agent_profiles_contact_brand_idx
  on public.agent_profiles (contact_id, brand)
  where brand is not null;

-- A person with no brand yet still only gets one such row.
create unique index if not exists agent_profiles_contact_nobrand_idx
  on public.agent_profiles (contact_id)
  where brand is null;

create index if not exists agent_profiles_brand_idx
  on public.agent_profiles (brand) where brand is not null;

-- Exactly one primary per person.
create unique index if not exists agent_profiles_one_primary_idx
  on public.agent_profiles (contact_id) where is_primary;

-- Trim what is already there, so "TPE " and "TPE" can't become two brands.
update public.agent_profiles set brand = btrim(brand)
 where brand is not null and brand <> btrim(brand);

-- ------------------------------------------------------------ the brands --
/* Every brand this member works for, not just one. A leaver's brand drops off
   the list the moment they are marked, and if they left both, the list is
   empty and nothing brand-gated answers to them. */
create or replace function public.member_brands()
  returns text[]
  language sql
  stable
  security definer
  set search_path = public
as $$
  select coalesce(array_agg(distinct btrim(ap.brand)), '{}')
  from public.contacts c
  join public.agent_profiles ap on ap.contact_id = c.id
  where ap.brand is not null
    and ap.left_at is null
    and (
      c.user_id = auth.uid()
      or (c.user_id is null
          and lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
    )
$$;

-- The one their Studio opens in. Kept because plenty of things want a single
-- answer, and for an agent with one brand it is the only answer.
create or replace function public.member_brand()
  returns text
  language sql
  stable
  security definer
  set search_path = public
as $$
  select btrim(ap.brand)
  from public.contacts c
  join public.agent_profiles ap on ap.contact_id = c.id
  where ap.brand is not null
    and ap.left_at is null
    and (
      c.user_id = auth.uid()
      or (c.user_id is null
          and lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
    )
  order by ap.is_primary desc, (c.user_id = auth.uid()) desc nulls last, ap.created_at
  limit 1
$$;

grant execute on function public.member_brands() to anon, authenticated;

-- A pack reaches them if ANY of their brands is named on it.
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
    )
  end
$$;

-- Same rule for seeing the pack itself in a list.
drop policy if exists "packs read active" on public.packs;
create policy "packs read active"
  on public.packs for select
  using (
    status = 'active'
    and (access <> 'brands' or public.is_staff() or brands && public.member_brands())
  );

-- ------------------------------------------------------------- where now --
select c.first_name, c.last_name, count(*) as brands,
       string_agg(btrim(ap.brand), ' + ' order by ap.is_primary desc, ap.brand) as works_for
  from public.agent_profiles ap
  join public.contacts c on c.id = ap.contact_id
 where ap.brand is not null and ap.left_at is null
 group by c.id, c.first_name, c.last_name
having count(*) > 1
 order by c.last_name;
