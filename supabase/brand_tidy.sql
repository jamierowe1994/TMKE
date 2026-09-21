-- Tidy the brand names on agent profiles
--
-- Brand packs are matched by NAME: a pack says it is for "The Letting
-- Experts", and a member gets in if their agent profile says the same thing.
-- So two spellings of one brand is not untidiness, it is agents who silently
-- can't see their own pack.
--
-- Run in the Supabase SQL editor. Safe to re-run.

-- 1) One spelling. It is The Letting Experts, singular.
update public.agent_profiles
   set brand = 'The Letting Experts'
 where brand is not null
   and lower(btrim(brand)) in ('the lettings experts', 'lettings experts', 'letting experts');

-- 2) Trim stray spaces, which match no pack at all.
update public.agent_profiles
   set brand = btrim(brand)
 where brand is not null and brand <> btrim(brand);

-- 3) What is actually out there now — check this against the picker.
select brand, count(*) as agents
  from public.agent_profiles
 where brand is not null
 group by brand
 order by agents desc;

-- 4) Give Danielle a TMKE profile so she can test a brand pack on herself.
--    Matched on her contact's email; does nothing if that contact is missing.
insert into public.agent_profiles (contact_id, brand)
select c.id, 'TMKE'
  from public.contacts c
 where lower(c.email) = 'danielle@themarketingexperts.co.uk'
 on conflict (contact_id) do update set brand = 'TMKE';

-- 5) Prove the gate sees it. Run this signed in as yourself in the app, not
--    here — the SQL editor has no login attached, so it always answers null.
--    select public.member_brand();
