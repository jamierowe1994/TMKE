-- Who's in which network (Dani, 6 Nov 2026):
--   Network: TEG                The Property Experts, Prestige, The Letting Experts,
--                               The Mortgage Experts, The Recruitment Experts, The
--                               Auction Company and The Marketing Experts.
--   Network: Fine-and-Country   Fine & Country. They were carrying the TEG tag as
--                               well, so a send to TEG was reaching them too.
--
-- Fine & Country contacts lose Network: TEG and keep or gain their own. Anyone at a
-- TEG brand gains Network: TEG. Marketing opt-in isn't touched. Nothing is sent.
-- Someone at Fine & Country who also holds a live TEG brand keeps both.
-- Safe to run twice. The list at the end is what it changed, and any live funnel
-- that uses Network: TEG, which you may want to look at.
with teg_brand as (
  select distinct contact_id from public.agent_profiles
   where left_at is null
     and btrim(brand) in ('The Property Experts', 'Prestige Property Experts', 'The Letting Experts', 'The Letting Experts Scotland',
                          'The Marketing Experts', 'The Recruitment Experts', 'The Mortgage Experts', 'The Auction Company')
),
people as (
  select c.id,
         (lower(coalesce(c.email, '')) ~ '@fineandcountry\.(com|co\.uk)$'
          or lower(btrim(coalesce(c.company, ''))) ~ '^(fine\s*(&|and)\s*country|f&c)'
          or 'Network: Fine-and-Country' = any (coalesce(c.tags, '{}'))) as is_fc,
         (lower(coalesce(c.email, '')) ~ '@(thepropertyexperts|prestigepropertyexperts|thelettingexperts|thelettingsexperts|themarketingexperts|therecruitmentexperts|themortgageexperts|theauctioncompany|tmke)\.co\.uk$'
          or lower(btrim(coalesce(c.company, ''))) in ('the property experts', 'prestige property experts', 'the letting experts', 'the marketing experts',
                                                       'the recruitment experts', 'the mortgage experts', 'the auction company', 'tpe', 'ppe', 'tle', 'tmke')
          or c.id in (select contact_id from teg_brand)) as is_teg
    from public.contacts c
),
fc as (
  update public.contacts c
     set tags = array_append(array_remove(array_remove(array_remove(coalesce(c.tags, '{}'), 'Network: TEG'), 'Network: External'), 'Network: Fine-and-Country'), 'Network: Fine-and-Country')
    from people p
   where p.id = c.id and p.is_fc and c.id not in (select contact_id from teg_brand)
     and ('Network: TEG' = any (coalesce(c.tags, '{}')) or not ('Network: Fine-and-Country' = any (coalesce(c.tags, '{}'))))
  returning c.id
),
teg as (
  update public.contacts c
     set tags = array_append(array_remove(coalesce(c.tags, '{}'), 'Network: External'), 'Network: TEG')
    from people p
   where p.id = c.id and p.is_teg and (not p.is_fc or c.id in (select contact_id from teg_brand))
     and not ('Network: TEG' = any (coalesce(c.tags, '{}')))
  returning c.id, btrim(concat_ws(' ', c.first_name, c.last_name)) as who, c.company
)
select 'Fine & Country: TEG tag removed' as what, count(*)::text as detail from fc
union all
select 'Added to TEG', who || coalesce(' (' || company || ')', '') from teg
union all
select 'Live funnel using Network: TEG', a.name
  from public.automations a
 where a.status = 'active' and (coalesce(a.graph::text, '') || coalesce(a.trigger_config::text, '')) like '%Network: TEG%'
union all
select 'Tagged TEG, not at a TEG brand', btrim(concat_ws(' ', c.first_name, c.last_name)) || coalesce(' (' || c.company || ')', '')
  from public.contacts c join people p on p.id = c.id
 where 'Network: TEG' = any (coalesce(c.tags, '{}')) and not p.is_teg and not p.is_fc
 order by 1, 2;
