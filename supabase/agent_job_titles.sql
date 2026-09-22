-- What an agent calls themselves
--
-- Job title was blank on nearly every profile, and it is printed on footers
-- and boards. Each brand has one name for the job — it is what they put on
-- their own website — so the default is the brand's, not a guess:
--
--   The Property Experts          Property Expert
--   The Letting Experts           Letting Expert
--   Prestige Property Experts     Prestige Property Expert
--   Fine & Country                Partner Agent
--
-- Only fills a blank. Anyone whose title has been typed in by hand keeps it.
-- Safe to re-run.

update public.agent_profiles ap
   set job_title = v.title
  from (values
    ('The Property Experts',       'Property Expert'),
    ('The Letting Experts',        'Letting Expert'),
    ('Prestige Property Experts',  'Prestige Property Expert'),
    ('Fine & Country',             'Partner Agent'),
    ('The Marketing Experts',      'Marketing Expert'),
    ('The Recruitment Experts',    'Recruitment Expert'),
    ('The Mortgage Experts',       'Mortgage Expert')
  ) as v(brand, title)
 where btrim(ap.brand) = v.brand
   and coalesce(btrim(ap.job_title), '') = '';

-- What that left behind.
select coalesce(brand, '(none)') as brand,
       coalesce(nullif(btrim(job_title), ''), '(still blank)') as job_title,
       count(*) as agents
  from public.agent_profiles
 group by 1, 2
 order by 1, 3 desc;
