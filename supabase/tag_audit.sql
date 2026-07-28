-- TMKE — CRM tag audit (READ-ONLY: changes nothing, safe to run any time).
-- Paste the whole file into the Supabase SQL editor and run it; it returns one
-- combined report. Backlog §7c step 1: what tags exist, how many contacts
-- carry each, and which are strays outside the curated framework catalogue
-- (src/lib/contact-tags.js).

with framework(tag) as (
  values
    -- Consent
    ('Newsletter-Subscriber'), ('Marketing-Not-Opted-In'), ('Unsubscribed'),
    -- Interest
    ('Interest: SMM'), ('Interest: Videography'),
    -- Discovery calls
    ('Discovery-Call-Booked: SMM'), ('Discovery-Call-Booked: Videography'),
    -- Purchases
    ('Pack-Purchased'),
    -- Videography
    ('Videography-Client'), ('Videography-Booked'),
    ('Videography-New-Starter: Pro'), ('Videography-New-Starter: Academy'),
    ('Videography-Product: Content-Studio'),
    ('Videography-Product: Property-Videography'),
    ('Videography-Product: Agent-Videography'),
    -- SMM client
    ('SMM-Status: Active'), ('SMM-Status: Paused'), ('SMM-Status: Ended'),
    -- Account
    ('TMKE-Account-Member'), ('Portal-User'),
    -- Network
    ('Network: TEG'), ('Network: Fine-and-Country'), ('Network: External'),
    -- Type
    ('Type: Estate-Agent'), ('Type: Lettings'), ('Type: Financial-Services'),
    -- Region
    ('Region: Videography-Radius')
),
usage as (
  select tag, count(*) as contacts
  from public.contacts, unnest(tags) as tag
  group by tag
)
select
  u.tag,
  u.contacts,
  case when f.tag is not null then 'framework' else 'STRAY' end as status,
  -- flag near-duplicates of a framework tag (case/spacing/punctuation drift)
  case when f.tag is null then (
    select f2.tag from framework f2
    where lower(replace(replace(f2.tag,' ',''),'-','')) =
          lower(replace(replace(u.tag,' ',''),'-',''))
    limit 1
  ) end as looks_like
from usage u
left join framework f on f.tag = u.tag
order by (f.tag is null) desc, u.contacts desc, u.tag;

-- ── Extras: run each block separately if you want the detail ────────────────

-- Framework tags that exist in the catalogue but are used by NOBODY
-- (candidates to confirm the catalogue is right, not to delete data):
-- with framework(tag) as (values ('Newsletter-Subscriber') /* … same list … */)
-- select f.tag from framework f
-- where not exists (select 1 from public.contacts c where f.tag = any(c.tags));

-- How many tags each contact carries (distribution):
select coalesce(array_length(tags,1),0) as tags_on_contact, count(*) as contacts
from public.contacts
group by 1 order by 1;

-- Contacts still carrying a consent conflict (should be zero after the
-- contact_tag_rules.sql backfill — non-zero means the backfill never ran):
select count(*) as consent_conflicts
from public.contacts
where ('Unsubscribed' = any(tags) and ('Newsletter-Subscriber' = any(tags) or 'Marketing-Not-Opted-In' = any(tags)))
   or ('Newsletter-Subscriber' = any(tags) and 'Marketing-Not-Opted-In' = any(tags));

-- Overall shape:
select count(*) as total_contacts,
       count(*) filter (where tags is null or array_length(tags,1) is null) as untagged,
       (select count(distinct tag) from public.contacts, unnest(tags) tag) as distinct_tags
from public.contacts;
