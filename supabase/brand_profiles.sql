-- The brands themselves, and what happens when someone leaves one
--
-- Two things print needs that nothing has held until now.
--
-- 1. THE BRAND'S OWN KIT. A TEG agent opening the Studio for the first time
--    should already be set up: their brand's colours, fonts, logo and website,
--    and their own name, job title, phone and email — not an empty form and a
--    request that they go and find their brand guidelines. We hold the brand
--    half here, once per brand; the personal half comes from their CRM contact.
--
-- 2. LEAVERS. Today an agent who leaves is deleted. That throws away their
--    history and it is the wrong tool anyway: what we want is for them to stop
--    being a Property Experts agent while staying a member — keeping what they
--    bought and losing what the brand lent them.
--
-- Run in the Supabase SQL editor, after supabase/print_packs.sql. Safe to re-run.

-- ------------------------------------------------------------ brand kits --
create table if not exists public.brand_profiles (
  brand        text primary key,                 -- matches agent_profiles.brand exactly
  website      text,
  tone         text,
  colors       jsonb not null default '[]'::jsonb,   -- ["#371E28", "#F4F2F1", …]
  fonts        jsonb not null default '{}'::jsonb,   -- { heading, body }
  logos        jsonb not null default '[]'::jsonb,   -- [{ url, name }]
  notes        text,
  updated_at   timestamptz not null default now()
);

alter table public.brand_profiles enable row level security;

-- Any signed-in member may READ a brand profile: their Studio needs the one
-- they belong to, and there is nothing secret in a logo and two hex codes.
drop policy if exists "brand profiles read" on public.brand_profiles;
create policy "brand profiles read"
  on public.brand_profiles for select
  to authenticated
  using (true);

drop policy if exists "brand profiles write" on public.brand_profiles;
create policy "brand profiles write"
  on public.brand_profiles for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- --------------------------------------------------------------- leavers --
alter table public.agent_profiles
  add column if not exists left_at    timestamptz,
  add column if not exists left_brand text,      -- the brand they were in, kept for the record
  -- Their job title, which a footer prints and nothing else holds.
  add column if not exists job_title  text;

create index if not exists agent_profiles_left_idx on public.agent_profiles (left_at);

/* A leaver is not in the brand any more, so nothing brand-gated answers to
   them: no print pack, no brand template. They keep their account, their
   purchases and anything they made that was theirs to make.

   This replaces the version in print_packs.sql — same function, one more
   condition. */
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
    and ap.left_at is null
    and (
      c.user_id = auth.uid()
      or (c.user_id is null
          and lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
    )
  order by (c.user_id = auth.uid()) desc nulls last
  limit 1
$$;

-- Seed a row per brand we already have agents for, so the admin page opens
-- with the real list rather than an empty page and a memory test.
insert into public.brand_profiles (brand)
select distinct btrim(brand) from public.agent_profiles
 where brand is not null and btrim(brand) <> ''
on conflict (brand) do nothing;
