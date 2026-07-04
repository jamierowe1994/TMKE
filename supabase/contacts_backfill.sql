-- TMKE — backfill CRM contacts from historical data + apply the tag framework.
-- One-time migration, safe to re-run (idempotent). Run in the Supabase SQL editor.
--
-- Going forward the Worker creates a contact for every entry point (forms, pack
-- purchases, discovery calls, register-interest, newsletter) with the agreed
-- tags. This (1) normalises the old tag names on existing contacts, (2) seeds
-- contacts from historical orders / videography_bookings / smm_leads with the
-- new tags, and (3) links accounts + adds the membership tag.
--
-- Tag framework (auto): Newsletter-Subscriber / Marketing-Not-Opted-In,
-- Interest: SMM|Videography, Discovery-Call-Booked: SMM|Videography,
-- Pack-Purchased + "Pack Name: <pack>", Videography-Client + Videography-Product,
-- TMKE-Account-Member, Network: TEG|Fine-and-Country|External.
-- Name split helpers (inline): first word → first_name, the rest → last_name.

-- 0) Normalise old tag names on existing contacts (rename + drop stale ones).
update public.contacts set tags = (
  select coalesce(array(
    select distinct t2 from (
      select case t
        when 'TMKE Social Media' then 'Interest: SMM'
        when 'TMKE Videography'  then 'Interest: Videography'
        when 'Newsletter'        then 'Newsletter-Subscriber'
        else t end as t2
      from unnest(tags) t
      where t not in ('Brochure Download', 'Discovery Call', 'General Enquiry', 'Content Studio', 'Register Interest')
    ) s
  ), '{}'::text[])
), updated_at = now()
where tags && array['TMKE Social Media', 'TMKE Videography', 'Newsletter', 'Brochure Download', 'Discovery Call', 'General Enquiry', 'Content Studio', 'Register Interest'];

-- 1) Pack purchasers (paid orders) → customers, tagged Pack-Purchased + pack + network.
insert into public.contacts (email, first_name, last_name, phone, company, source, lifecycle, tags, last_seen_at)
select distinct on (lower(trim(buyer_email)))
  lower(trim(buyer_email)),
  nullif(split_part(coalesce(buyer_name, ''), ' ', 1), ''),
  nullif(trim(substr(coalesce(buyer_name, ''), length(split_part(coalesce(buyer_name, ''), ' ', 1)) + 2)), ''),
  buyer_phone, buyer_company, 'pack_purchase', 'customer',
  array['Pack-Purchased']
    || (case when coalesce(pack_title, '') <> '' then array['Pack Name: ' || pack_title] else '{}'::text[] end)
    || array[case when lower(buyer_email) like '%experts.co.uk' then 'Network: TEG' when lower(buyer_email) like '%@fineandcountry.com' then 'Network: Fine-and-Country' else 'Network: External' end],
  coalesce(created_at, now())
from public.orders
where buyer_email is not null and status = 'paid'
order by lower(trim(buyer_email)), created_at desc nulls last
on conflict (email) do update set
  first_name = coalesce(public.contacts.first_name, excluded.first_name),
  last_name  = coalesce(public.contacts.last_name,  excluded.last_name),
  phone      = coalesce(public.contacts.phone,      excluded.phone),
  company    = coalesce(public.contacts.company,    excluded.company),
  lifecycle  = case when public.contacts.lifecycle = 'member' then 'member' else 'customer' end,
  tags       = (select array(select distinct unnest(public.contacts.tags || excluded.tags))),
  updated_at = now();

-- 2) Videography bookings / discovery / enquiry-ish → tagged by kind + consent + network.
insert into public.contacts (email, first_name, last_name, phone, company, source, lifecycle, marketing_opt_in, tags, last_seen_at)
select distinct on (lower(trim(client_email)))
  lower(trim(client_email)),
  nullif(split_part(coalesce(client_name, ''), ' ', 1), ''),
  nullif(trim(substr(coalesce(client_name, ''), length(split_part(coalesce(client_name, ''), ' ', 1)) + 2)), ''),
  client_phone, company, 'videography', 'lead',
  coalesce(marketing_opt_in, false),
  (case
     when kind = 'booking' then array['Videography-Client']
       || (case service_type
            when 'content' then array['Videography-Product: Content-Studio']
            when 'content-studio' then array['Videography-Product: Content-Studio']
            when 'property' then array['Videography-Product: Property-Videography']
            when 'agent' then array['Videography-Product: Agent-Videography']
            else '{}'::text[] end)
     when service_type = 'discovery' or kind = 'discovery' then array['Interest: Videography', 'Discovery-Call-Booked: Videography']
     else array['Interest: Videography'] end)
    || array[case when coalesce(marketing_opt_in, false) then 'Newsletter-Subscriber' else 'Marketing-Not-Opted-In' end]
    || array[case when lower(client_email) like '%experts.co.uk' then 'Network: TEG' when lower(client_email) like '%@fineandcountry.com' then 'Network: Fine-and-Country' else 'Network: External' end],
  coalesce(created_at, now())
from public.videography_bookings
where client_email is not null
order by lower(trim(client_email)), created_at desc nulls last
on conflict (email) do update set
  first_name = coalesce(public.contacts.first_name, excluded.first_name),
  last_name  = coalesce(public.contacts.last_name,  excluded.last_name),
  phone      = coalesce(public.contacts.phone,      excluded.phone),
  company    = coalesce(public.contacts.company,    excluded.company),
  marketing_opt_in = public.contacts.marketing_opt_in or excluded.marketing_opt_in,
  tags = (select array(select distinct unnest(public.contacts.tags || excluded.tags))),
  updated_at = now();

-- 3) SMM leads → Interest: SMM (+ discovery) + consent + network.
insert into public.contacts (email, first_name, last_name, phone, company, source, lifecycle, marketing_opt_in, tags, last_seen_at)
select distinct on (lower(trim(email)))
  lower(trim(email)),
  coalesce(nullif(first_name, ''), nullif(split_part(coalesce(full_name, ''), ' ', 1), '')),
  coalesce(nullif(last_name, ''), nullif(trim(substr(coalesce(full_name, ''), length(split_part(coalesce(full_name, ''), ' ', 1)) + 2)), '')),
  phone, business, 'smm', 'lead',
  coalesce(marketing_opt_in, false),
  array['Interest: SMM']
    || (case when kind = 'discovery' then array['Discovery-Call-Booked: SMM'] else '{}'::text[] end)
    || array[case when coalesce(marketing_opt_in, false) then 'Newsletter-Subscriber' else 'Marketing-Not-Opted-In' end]
    || array[case when lower(email) like '%experts.co.uk' then 'Network: TEG' when lower(email) like '%@fineandcountry.com' then 'Network: Fine-and-Country' else 'Network: External' end],
  coalesce(created_at, now())
from public.smm_leads
where email is not null
order by lower(trim(email)), created_at desc nulls last
on conflict (email) do update set
  first_name = coalesce(public.contacts.first_name, excluded.first_name),
  last_name  = coalesce(public.contacts.last_name,  excluded.last_name),
  phone      = coalesce(public.contacts.phone,      excluded.phone),
  company    = coalesce(public.contacts.company,    excluded.company),
  marketing_opt_in = public.contacts.marketing_opt_in or excluded.marketing_opt_in,
  tags = (select array(select distinct unnest(public.contacts.tags || excluded.tags))),
  updated_at = now();

-- 4) Link accounts: set user_id, lift to 'member', add the TMKE-Account-Member tag.
update public.contacts c
set user_id = u.id,
    lifecycle = case when c.lifecycle = 'past' then 'past' else 'member' end,
    tags = (select array(select distinct unnest(c.tags || array['TMKE-Account-Member']))),
    updated_at = now()
from auth.users u
where c.user_id is null and lower(u.email) = c.email;
