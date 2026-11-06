-- One-off (Dani, 6 Nov 2026), from the agent report:
--   1. Elliott Wakefield, Nicholas Charles and Vivienne Sharman-Lewis are PPE only,
--      so their The Property Experts record goes. A photo that only exists on it
--      moves to their Prestige record first, and if it was the brand their Studio
--      opens in, that becomes Prestige.
--   2. Job titles follow the brand: "Property Expert" on a Prestige record becomes
--      "Prestige Property Expert", and the other way round on a TPE record. Other
--      titles (Partner Agent, Letting Expert and so on) are left alone.
--   3. Ian Panter, Jim Harris and Sean Newman are ticked as management or support.
--      Their brands are left as they are.
--
-- All one block: it all happens or none of it does. It stops and changes nothing
-- if it can't find any of these six people, or one of the three has no live
-- Prestige record. Sends no emails. Safe to run twice. The list at the end shows
-- the result.
do $$
declare
  ppe_only uuid[];
  support uuid[];
  n integer;
begin
  select array_agg(c.id), count(distinct lower(btrim(concat_ws(' ', c.first_name, c.last_name))))
    into ppe_only, n
    from public.contacts c
   where lower(btrim(concat_ws(' ', c.first_name, c.last_name))) in
         ('elliott wakefield', 'nicholas charles', 'vivienne sharman-lewis');
  if n <> 3 then raise exception 'Expected to find the three PPE-only agents, found %. Nothing has changed.', n; end if;

  select array_agg(c.id), count(distinct lower(btrim(concat_ws(' ', c.first_name, c.last_name))))
    into support, n
    from public.contacts c
   where lower(btrim(concat_ws(' ', c.first_name, c.last_name))) in ('ian panter', 'jim harris', 'sean newman');
  if n <> 3 then raise exception 'Expected to find the three management contacts, found %. Nothing has changed.', n; end if;

  if exists (select 1 from public.agent_profiles t
              where t.contact_id = any (ppe_only) and btrim(t.brand) = 'The Property Experts'
                and not exists (select 1 from public.agent_profiles p
                                 where p.contact_id = t.contact_id and btrim(p.brand) = 'Prestige Property Experts' and p.left_at is null)) then
    raise exception 'One of the three has no live Prestige record. Nothing has changed.';
  end if;

  -- 1. A photo only on the TPE record moves across.
  update public.agent_profiles p
     set brand_photo_url = t.brand_photo_url, brand_photo_source = t.brand_photo_source, brand_photo_updated_at = t.brand_photo_updated_at
    from public.agent_profiles t
   where p.contact_id = t.contact_id and p.contact_id = any (ppe_only)
     and btrim(p.brand) = 'Prestige Property Experts' and btrim(t.brand) = 'The Property Experts'
     and p.brand_photo_url is null and t.brand_photo_url is not null;

  delete from public.agent_profiles
   where contact_id = any (ppe_only) and btrim(brand) = 'The Property Experts';

  -- Exactly one primary per person, so this comes after the delete.
  update public.agent_profiles p
     set is_primary = true
   where p.contact_id = any (ppe_only) and btrim(p.brand) = 'Prestige Property Experts'
     and not exists (select 1 from public.agent_profiles o where o.contact_id = p.contact_id and o.is_primary);

  -- 2. Job titles.
  update public.agent_profiles set job_title = 'Prestige Property Expert'
   where btrim(brand) = 'Prestige Property Experts' and btrim(job_title) = 'Property Expert';
  update public.agent_profiles set job_title = 'Property Expert'
   where btrim(brand) = 'The Property Experts' and btrim(job_title) = 'Prestige Property Expert';

  -- 3. The tick box is this tag.
  update public.contacts
     set tags = array_append(coalesce(tags, '{}'), 'TEG-Role: Management-or-Support')
   where id = any (support) and not ('TEG-Role: Management-or-Support' = any (coalesce(tags, '{}')));
end $$;

select 'PPE only' as what, btrim(concat_ws(' ', c.first_name, c.last_name)) as who,
       string_agg(btrim(ap.brand) || ' (' || coalesce(ap.job_title, 'no title') || ')', ', ') as result
  from public.contacts c
  join public.agent_profiles ap on ap.contact_id = c.id
 where lower(btrim(concat_ws(' ', c.first_name, c.last_name))) in ('elliott wakefield', 'nicholas charles', 'vivienne sharman-lewis', 'gavin pretorious')
 group by c.id, c.first_name, c.last_name
union all
select 'Ticked as management or support', btrim(concat_ws(' ', c.first_name, c.last_name)), 'Yes'
  from public.contacts c
 where 'TEG-Role: Management-or-Support' = any (coalesce(c.tags, '{}'))
union all
select 'Job titles', btrim(ap.brand), btrim(ap.job_title) || ': ' || count(*)
  from public.agent_profiles ap
 where btrim(ap.brand) in ('The Property Experts', 'Prestige Property Experts') and ap.left_at is null and ap.job_title is not null
 group by btrim(ap.brand), btrim(ap.job_title)
 order by 1, 2, 3;
