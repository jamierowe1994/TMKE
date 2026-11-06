-- Report only, changes nothing (Dani, 6 Nov 2026). Run it, then use Export > CSV
-- in the results if you want it as a spreadsheet.
--
-- Part 1: every live agent under each brand, TPE first, then PPE, TLE, TLE
--         Scotland, then any others A to Z. A dual-brand agent is listed under
--         each of their brands, and "also_has" shows the other.
-- Part 2: anyone tagged Network: TEG with no live TPE, PPE or TLE brand. "also_has"
--         shows any other brand they hold. Fine & Country contacts carry the TEG
--         tag, so they appear here.
with live as (
  select ap.contact_id, btrim(ap.brand) as brand, ap.job_title, ap.date_joined
    from public.agent_profiles ap
   where ap.left_at is null and ap.brand is not null and btrim(ap.brand) <> ''
),
people as (
  select c.id, btrim(concat_ws(' ', c.first_name, c.last_name)) as agent, c.email, c.company, c.tags
    from public.contacts c
   where not ('Merged: dual-brand agent' = any (coalesce(c.tags, '{}')))
)
select 1 as part, l.brand, p.agent, p.email, l.job_title, l.date_joined as joined, p.company,
       (select string_agg(o.brand, ', ' order by o.brand) from live o
         where o.contact_id = l.contact_id and o.brand <> l.brand) as also_has,
       case l.brand when 'The Property Experts' then 1 when 'Prestige Property Experts' then 2
                    when 'The Letting Experts' then 3 when 'The Letting Experts Scotland' then 4 else 5 end as brand_order
  from live l join people p on p.id = l.contact_id
union all
select 2, 'TEG, no TPE, PPE or TLE', p.agent, p.email, null, null, p.company,
       (select string_agg(o.brand, ', ' order by o.brand) from live o where o.contact_id = p.id),
       6
  from people p
 where 'Network: TEG' = any (coalesce(p.tags, '{}'))
   and not exists (select 1 from live o
                    where o.contact_id = p.id
                      and o.brand in ('The Property Experts', 'Prestige Property Experts',
                                      'The Letting Experts', 'The Letting Experts Scotland'))
 order by part, brand_order, brand, agent;
