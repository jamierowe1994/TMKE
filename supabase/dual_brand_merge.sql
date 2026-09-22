-- The eight people we hold twice
--
-- Each of these is one person with a record under each brand they work for.
-- Confirmed by Danielle on 22 Sep 2026, name by name — two of them (David
-- Jones, Sean McMahon) have a different mobile on each record, which is why
-- no rule found them and why nothing here is automatic.
--
-- What it does, per pair:
--   · the Property Experts record is kept (it is the one with a join date,
--     an area and a member account more often than not)
--   · the other brand's profile is moved onto it, keeping ITS join date, job
--     title, area, email and phone — the per-brand facts
--   · that brand's email is kept on the contact as secondary_email, so mail
--     to either address still finds them
--   · the duplicate contact is left in place, tagged, NOT deleted
--
-- Nothing is deleted. Read the two SELECTs at the end before you decide what
-- to do with the leftovers.
--
-- Run AFTER supabase/dual_brand_agents.sql. Safe to re-run.

-- The pairs. keep_email is the record that survives.
drop table if exists dual_pairs;
create temporary table dual_pairs (keep_email text, merge_email text);
insert into dual_pairs values
  ('bernadine@thepropertyexperts.co.uk',        'bernadine.williams@thelettingexperts.co.uk'),
  ('graham.cross@thepropertyexperts.co.uk',     'graham.cross@thelettingexperts.co.uk'),
  ('james.crumpton@thepropertyexperts.co.uk',   'james.crumpton@thelettingexperts.co.uk'),
  ('tony.poon@thepropertyexperts.co.uk',        'tony.poon@thelettingexperts.co.uk'),
  ('sean.mcmahon@thepropertyexperts.co.uk',     'sean.mcmahon@thelettingexperts.co.uk'),
  ('zill@thepropertyexperts.co.uk',             'zilvinas.navickis@thelettingexperts.co.uk'),
  ('jiten.parekh@thepropertyexperts.co.uk',     'jiten.parekh@prestigepropertyexperts.co.uk'),
  ('david.jones@thepropertyexperts.co.uk',      'david.jones@prestigepropertyexperts.co.uk');

-- 1) WHAT THIS WILL DO. Read it before running anything below.
select p.keep_email, k.id is not null as keep_found,
       p.merge_email, m.id is not null as merge_found,
       apm.brand as brand_moving, apm.date_joined, apm.job_title, apm.area
  from dual_pairs p
  left join public.contacts k on lower(k.email) = p.keep_email
  left join public.contacts m on lower(m.email) = p.merge_email
  left join public.agent_profiles apm on apm.contact_id = m.id
 order by p.keep_email;

-- 2) MOVE THE BRAND ROW onto the surviving contact, carrying its own details.
--    The number on the duplicate contact becomes the number for THAT brand,
--    which is how a dual agent ends up with the right mobile on each footer.
update public.agent_profiles ap
   set contact_id = k.id,
       is_primary = false,
       email      = coalesce(ap.email, m.email),
       phone      = coalesce(ap.phone, m.phone)
  from dual_pairs p
  join public.contacts k on lower(k.email) = p.keep_email
  join public.contacts m on lower(m.email) = p.merge_email
 where ap.contact_id = m.id
   and ap.brand is not null
   and not exists (
     select 1 from public.agent_profiles x
      where x.contact_id = k.id and btrim(x.brand) = btrim(ap.brand)
   );

-- 3) KEEP THE SECOND ADDRESS, so email to either one still finds them.
update public.contacts k
   set secondary_email = coalesce(k.secondary_email, m.email)
  from dual_pairs p
  join public.contacts m on lower(m.email) = p.merge_email
 where lower(k.email) = p.keep_email;

-- 4) MARK THE LEFTOVER, don't delete it. A deleted contact takes its history
--    with it — orders, enrolments, consent — and none of that is ours to
--    throw away on a Tuesday evening.
update public.contacts m
   set tags = (select array_agg(distinct t) from unnest(m.tags || array['Merged: dual-brand agent']) t)
  from dual_pairs p
 where lower(m.email) = p.merge_email;

-- 5) WHO NOW WORKS FOR TWO BRANDS.
select c.first_name, c.last_name, c.email, c.secondary_email,
       string_agg(btrim(ap.brand), ' + ' order by ap.is_primary desc, ap.brand) as works_for
  from public.agent_profiles ap
  join public.contacts c on c.id = ap.contact_id
 where ap.brand is not null and ap.left_at is null
 group by c.id, c.first_name, c.last_name, c.email, c.secondary_email
having count(*) > 1
 order by c.last_name;

-- 6) THE LEFTOVER RECORDS, for you to decide on later.
select c.email, c.first_name, c.last_name, c.user_id is not null as has_account,
       (select count(*) from public.agent_profiles a where a.contact_id = c.id) as profiles_left
  from public.contacts c
 where 'Merged: dual-brand agent' = any(c.tags)
 order by c.email;

-- ---------------------------------------------------------------------------
-- Chris Wilson-Slight is the other kind: in the CRM once, on his Property
-- Experts details, but a Prestige agent too. Nothing to merge — he needs the
-- second brand adding.
-- ---------------------------------------------------------------------------
insert into public.agent_profiles (contact_id, brand, job_title, is_primary, added_by)
select c.id, 'Prestige Property Experts', 'Prestige Property Expert', false, 'dual-brand'
  from public.contacts c
 where lower(c.email) = 'chris.wilson-slight@thepropertyexperts.co.uk'
   and not exists (
     select 1 from public.agent_profiles a
      where a.contact_id = c.id and btrim(a.brand) = 'Prestige Property Experts'
   );
