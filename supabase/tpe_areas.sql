-- Areas for The Property Experts, read off their own website
--
-- Taken from thepropertyexperts.co.uk/staff on 22 Sep 2026: each agent's page
-- says "The <area> Property Expert", which is the patch in their own words —
-- better than anything we could derive from a postcode, because it is what
-- they tell the public they cover.
--
-- 70 agents. Matched on EMAIL, which is exact; no name guessing.
--
-- Run the three SELECTs first and read them. The UPDATE only fills an area
-- that is empty, so nothing you have typed by hand is overwritten.

create temporary table tpe_site (email text primary key, name text, area text);
insert into tpe_site (email, name, area) values
  ('andrzej.mialkowski@thepropertyexperts.co.uk', 'AJ Mialkowski', 'Northamptonshire & Milton Keynes'),
  ('abigail.penellum@thepropertyexperts.co.uk', 'Abigail Penellum', 'Cornwall'),
  ('alan.rodgers@thepropertyexperts.co.uk', 'Alan Rodgers', 'South Shropshire, South Staffordshire & Wolverhampton'),
  ('alex.broadley@thepropertyexperts.co.uk', 'Alex Broadley', 'Leicestershire'),
  ('ali.khalid@thepropertyexperts.co.uk', 'Ali Khalid', 'South London'),
  ('amanda.davis@thepropertyexperts.co.uk', 'Amanda Davis', 'Battle & Hastings'),
  ('anna.verrinder@thepropertyexperts.co.uk', 'Anna Verrinder', 'Stamford, Rutland & Oundle'),
  ('bernadine@thepropertyexperts.co.uk', 'Bernadine Williams', 'St Albans'),
  ('caroline.dimascio@thepropertyexperts.co.uk', 'Caroline DiMascio', 'North Hampshire'),
  ('caroline.lewis@thepropertyexperts.co.uk', 'Caroline Lewis', 'Bromley'),
  ('chetnaa@thepropertyexperts.co.uk', 'Chetnaa S Hallai', 'London'),
  ('chris.johnston@thepropertyexperts.co.uk', 'Chris Johnston', 'Surrey and West Sussex'),
  ('chris.wilson-slight@thepropertyexperts.co.uk', 'Chris Wilson-Slight', 'Northamptonshire'),
  ('claire.riley@thepropertyexperts.co.uk', 'Claire Riley', 'Coventry'),
  ('daniel.orme@thepropertyexperts.co.uk', 'Daniel Orme', 'Cheltenham'),
  ('david.jones@thepropertyexperts.co.uk', 'David Jones', 'North Worcestershire'),
  ('david.leake@thepropertyexperts.co.uk', 'David Leake', 'Selby'),
  ('david.quigg@thepropertyexperts.co.uk', 'David Quigg', 'Cheshire'),
  ('david.robinson@thepropertyexperts.co.uk', 'David Robinson', 'Barnsley'),
  ('davidandjenny@thepropertyexperts.co.uk', 'David and Jenny', 'Rugby'),
  ('ed.firth@thepropertyexperts.co.uk', 'Ed Firth', 'North Worcestershire'),
  ('eddie.chand@thepropertyexperts.co.uk', 'Eddie Chand', 'Oxford'),
  ('elliot.tamatave@thepropertyexperts.co.uk', 'Elliot Tamatave', 'Manchester'),
  ('genita.devetak@thepropertyexperts.co.uk', 'Genita Devetak', 'Central South East London'),
  ('graham.cross@thepropertyexperts.co.uk', 'Graham Cross', 'Leicestershire & Warwickshire'),
  ('helen.resuggan@thepropertyexperts.co.uk', 'Helen Resuggan', 'Highnam & West Gloucester Village'),
  ('henry@thepropertyexperts.co.uk', 'Henry James', 'Rugby'),
  ('ian.southon@thepropertyexperts.co.uk', 'Ian Southon-Brawn', 'Daventry'),
  ('james.crumpton@thepropertyexperts.co.uk', 'James Crumpton', 'Bristol'),
  ('james.durham@thepropertyexperts.co.uk', 'James Durham', 'North East'),
  ('james.mcnally@thepropertyexperts.co.uk', 'James McNally', 'Merseyside'),
  ('jay.gorania@thepropertyexperts.co.uk', 'Jay Gorania', 'Leicester'),
  ('jiten.parekh@thepropertyexperts.co.uk', 'Jiten Parekh', 'South Buckinghamshire'),
  ('joel.beardsmore@thepropertyexperts.co.uk', 'Joel Beardsmore', 'Northampton'),
  ('josh.kumar@thepropertyexperts.co.uk', 'Josh Kumar', 'Bedfordshire'),
  ('jose.fernandes@thepropertyexperts.co.uk', 'José Fernandes', 'Andover'),
  ('julian.smith@thepropertyexperts.co.uk', 'Julian Smith', 'Burton and Swadlincote'),
  ('keri.robinson@thepropertyexperts.co.uk', 'Keri Robinson', 'Leamington Spa & Warwick'),
  ('khizar.hayat@thepropertyexperts.co.uk', 'Khizar Hayat', 'Bedfordshire & Buckinghamshire'),
  ('kim.marcel@thepropertyexperts.co.uk', 'Kim Marcel', 'Thurmaston and Birstal'),
  ('lewis.thorogood@thepropertyexperts.co.uk', 'Lewis Thorogood', 'Bourne'),
  ('southam@thepropertyexperts.co.uk', 'Mark & Lorna Kermode', 'Southam'),
  ('mark.jones@thepropertyexperts.co.uk', 'Mark Jones', 'Derbyshire'),
  ('mark.moffat@thepropertyexperts.co.uk', 'Mark Moffat', 'Reading'),
  ('matthew.harvey@thepropertyexperts.co.uk', 'Matt Harvey', 'Property Expert for South & West Devon'),
  ('miranda@thepropertyexperts.co.uk', 'Miranda Menzies', 'Kettering'),
  ('morgan.nunns@thepropertyexperts.co.uk', 'Morgan Nunns', 'North Shropshire'),
  ('nathaniel@thepropertyexperts.co.uk', 'Nathaniel Cleaver', 'Leamington Spa & Warwick'),
  ('neil.bestwick@thepropertyexperts.co.uk', 'Neil Bestwick', 'Basingstoke & Deane'),
  ('pani.demetriou@thepropertyexperts.co.uk', 'Pani Demetriou', 'North London, Hertfordshire & Essex'),
  ('pat.mccreesh@thepropertyexperts.co.uk', 'Pat McCreesh', 'South Buckinghamshire'),
  ('paul.abbott-williams@thepropertyexperts.co.uk', 'Paul Abbott-Williams', 'Barnet'),
  ('paul.doig@thepropertyexperts.co.uk', 'Paul Doig', 'Greater London'),
  ('paul.petticrew@thepropertyexperts.co.uk', 'Paul Petticrew', 'Warwickshire'),
  ('paul.stone@thepropertyexperts.co.uk', 'Paul Stone', 'Devon'),
  ('paul.withers@thepropertyexperts.co.uk', 'Paul Withers', 'Goole'),
  ('rachel.parry@thepropertyexperts.co.uk', 'Rachel Parry', 'Pontefract'),
  ('rajul.patel@thepropertyexperts.co.uk', 'Rajul Patel', 'Leicestershire & Essex'),
  ('reena.kaur@thepropertyexperts.co.uk', 'Reena Kaur', 'Leicestershire'),
  ('rovena.buci@thepropertyexperts.co.uk', 'Rovena Buci', 'North London'),
  ('sean.mcmahon@thepropertyexperts.co.uk', 'Sean McMahon', 'Edinburgh'),
  ('shane.yu@thepropertyexperts.co.uk', 'Shane Yu', 'Sheffield & Doncaster'),
  ('shiny.g@thepropertyexperts.co.uk', 'Shiny Gottimukkala', 'Sutton'),
  ('suzanne.lal@thepropertyexperts.co.uk', 'Suzanne Lal', 'Cotswolds'),
  ('suzanne.lal@thepropertyexperts.co.uk', 'Suzanne Lal', 'Cotswolds'),
  ('tarv.virk@thepropertyexperts.co.uk', 'Tarv Virk', 'Dudley and Bromsgrove'),
  ('thomas.wall@thepropertyexperts.co.uk', 'Thomas Wall', 'Staffordshire & Sutton Coldfield'),
  ('tony.poon@thepropertyexperts.co.uk', 'Tony Poon', 'Milton Keynes'),
  ('tracy.morris@thepropertyexperts.co.uk', 'Tracy Morris', 'Falkirk'),
  ('zill@thepropertyexperts.co.uk', 'Zilvinas Navickis', 'Bournemouth & BCP');

-- 1) WHAT WOULD CHANGE — agents we hold, with no area yet.
select c.email, s.name as on_site, s.area as area_to_set
  from tpe_site s
  join public.contacts c on lower(c.email) = s.email
  join public.agent_profiles ap on ap.contact_id = c.id
 where coalesce(btrim(ap.area), '') = ''
 order by s.name;

-- 2) DISAGREEMENTS — an area is already set and the site says something else.
--    Nothing is changed here; decide these by hand.
select c.email, ap.area as ours, s.area as theirs
  from tpe_site s
  join public.contacts c on lower(c.email) = s.email
  join public.agent_profiles ap on ap.contact_id = c.id
 where coalesce(btrim(ap.area), '') <> ''
   and btrim(ap.area) is distinct from s.area
 order by c.email;

-- 3) THE TWO GAPS.
--    a. On their website, not in our CRM at all.
select s.name, s.email, s.area
  from tpe_site s
  left join public.contacts c on lower(c.email) = s.email
 where c.id is null
 order by s.name;

--    b. In our CRM as a Property Expert, not on their website.
select c.email, c.first_name, c.last_name, ap.area
  from public.contacts c
  join public.agent_profiles ap on ap.contact_id = c.id
  left join tpe_site s on s.email = lower(c.email)
 where ap.brand = 'The Property Experts'
   and ap.left_at is null
   and s.email is null
 order by c.email;

-- 4) THE UPDATE. Run it once you are happy with 1, 2 and 3.
-- update public.agent_profiles ap
--    set area = s.area
--   from tpe_site s
--   join public.contacts c on lower(c.email) = s.email
--  where ap.contact_id = c.id
--    and coalesce(btrim(ap.area), '') = '';
