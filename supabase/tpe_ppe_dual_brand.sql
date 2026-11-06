-- One-off (Dani, 6 Nov 2026, from Sam): every live The Property Experts and
-- Prestige Property Experts agent now has both brands, except Elliott Wakefield,
-- Gavin Pretorious, Nicholas Charles and Vivienne Sharman-Lewis.
--
-- Adds the missing brand as a second agent_profiles row (one row per person per
-- brand). Their first brand stays primary, so their Studio opens where it does
-- now. Join date, job title, area, postcode, phone and email carry across. So
-- does a new starter's code, but not the new-starter flag, so nobody is counted
-- twice. Then a brand photo on one brand is copied to the other if that's empty.
--
-- Leaves alone: anyone who has left, and anyone marked as having left the other
-- brand. Stops without changing anything if one of the four can't be found.
-- Safe to run twice. It sends no emails. The list at the end is what it did.

-- All one block, so it either all happens or none of it does. (The first version
-- used a temporary table, which the Supabase SQL editor didn't keep between steps.)
do $$
declare
  left_out uuid[];
  found_names integer;
begin
  select array_agg(c.id), count(distinct lower(btrim(concat_ws(' ', c.first_name, c.last_name))))
    into left_out, found_names
    from public.contacts c
   where lower(btrim(concat_ws(' ', c.first_name, c.last_name))) in
         ('elliott wakefield', 'gavin pretorious', 'nicholas charles', 'vivienne sharman-lewis');

  if found_names <> 4 then
    raise exception 'Expected to find all four people to leave out, found %. Nothing has changed.', found_names;
  end if;

  insert into public.agent_profiles
    (contact_id, brand, is_primary, is_new_starter, date_joined, postcode, area, job_title, email, phone,
     induction_month, package, promo_code, promo_code_id, trainer_name, trainer_email, status,
     brand_photo_url, brand_photo_source, brand_photo_updated_at)
  select ap.contact_id, p.want, false, false, ap.date_joined, ap.postcode, ap.area, ap.job_title, ap.email, ap.phone,
         ap.induction_month, ap.package, ap.promo_code, ap.promo_code_id, ap.trainer_name, ap.trainer_email, ap.status,
         ap.brand_photo_url, ap.brand_photo_source, ap.brand_photo_updated_at
    from public.agent_profiles ap
    join (values ('The Property Experts', 'Prestige Property Experts'),
                 ('Prestige Property Experts', 'The Property Experts')) as p(have, want)
      on btrim(ap.brand) = p.have
    join public.contacts c on c.id = ap.contact_id
   where ap.left_at is null
     and ap.contact_id <> all (left_out)
     and not ('Merged: dual-brand agent' = any (coalesce(c.tags, '{}')))
     and not exists (select 1 from public.agent_profiles o
                      where o.contact_id = ap.contact_id and btrim(o.brand) = p.want);

  -- Someone who already had both: a photo on one, none on the other.
  update public.agent_profiles t
     set brand_photo_url = s.brand_photo_url,
         brand_photo_source = s.brand_photo_source,
         brand_photo_updated_at = s.brand_photo_updated_at
    from public.agent_profiles s
   where s.contact_id = t.contact_id
     and btrim(s.brand) in ('The Property Experts', 'Prestige Property Experts')
     and btrim(t.brand) in ('The Property Experts', 'Prestige Property Experts')
     and btrim(s.brand) <> btrim(t.brand)
     and s.left_at is null and t.left_at is null
     and s.brand_photo_url is not null
     and t.brand_photo_url is null
     and t.contact_id <> all (left_out);
end $$;

-- Everyone at these two brands now. Check for anyone who shouldn't be dual, such
-- as an associate, and anyone with no photo on either brand.
select btrim(concat_ws(' ', c.first_name, c.last_name)) as agent,
       string_agg(btrim(ap.brand), ' + ' order by ap.is_primary desc) as brands,
       bool_or(ap.brand_photo_url is not null) as has_photo,
       coalesce(max(ap.job_title), '') as job_title
  from public.agent_profiles ap
  join public.contacts c on c.id = ap.contact_id
 where btrim(ap.brand) in ('The Property Experts', 'Prestige Property Experts')
   and ap.left_at is null
 group by c.id, c.first_name, c.last_name
 order by count(*) desc, 1;
