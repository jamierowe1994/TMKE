-- TMKE — backfill CRM contacts from historical data + link accounts.
-- One-time migration, safe to re-run (idempotent). Run in the Supabase SQL editor.
--
-- Going forward the Worker creates a contact for every entry point (forms,
-- pack purchases, discovery calls, register-interest, newsletter). This seeds
-- contacts from data that pre-dates those hooks, mirroring upsert_contact's
-- merge rules: keep existing non-null fields, OR marketing_opt_in, union tags,
-- and never downgrade an existing 'member'.
--
-- Name split helpers (inline): first word → first_name, the rest → last_name.

-- 1) Pack purchasers (paid orders) → customers.
insert into public.contacts (email, first_name, last_name, phone, company, source, lifecycle, last_seen_at)
select distinct on (lower(trim(buyer_email)))
  lower(trim(buyer_email)),
  nullif(split_part(coalesce(buyer_name, ''), ' ', 1), ''),
  nullif(trim(substr(coalesce(buyer_name, ''), length(split_part(coalesce(buyer_name, ''), ' ', 1)) + 2)), ''),
  buyer_phone, buyer_company, 'pack_purchase', 'customer', coalesce(created_at, now())
from public.orders
where buyer_email is not null and status = 'paid'
order by lower(trim(buyer_email)), created_at desc nulls last
on conflict (email) do update set
  first_name = coalesce(public.contacts.first_name, excluded.first_name),
  last_name  = coalesce(public.contacts.last_name,  excluded.last_name),
  phone      = coalesce(public.contacts.phone,      excluded.phone),
  company    = coalesce(public.contacts.company,    excluded.company),
  lifecycle  = case when public.contacts.lifecycle = 'member' then 'member' else 'customer' end,
  updated_at = now();

-- 2) Videography bookings + discovery calls → leads, carrying marketing consent.
insert into public.contacts (email, first_name, last_name, phone, company, source, lifecycle, marketing_opt_in, tags, last_seen_at)
select distinct on (lower(trim(client_email)))
  lower(trim(client_email)),
  nullif(split_part(coalesce(client_name, ''), ' ', 1), ''),
  nullif(trim(substr(coalesce(client_name, ''), length(split_part(coalesce(client_name, ''), ' ', 1)) + 2)), ''),
  client_phone, company, 'videography', 'lead',
  coalesce(marketing_opt_in, false),
  case when service_type = 'discovery' then array['TMKE Videography', 'Discovery Call']
       else array['TMKE Videography'] end,
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

-- 3) SMM leads → leads, carrying marketing consent + tags.
insert into public.contacts (email, first_name, last_name, phone, company, source, lifecycle, marketing_opt_in, tags, last_seen_at)
select distinct on (lower(trim(email)))
  lower(trim(email)),
  coalesce(nullif(first_name, ''), nullif(split_part(coalesce(full_name, ''), ' ', 1), '')),
  coalesce(nullif(last_name, ''), nullif(trim(substr(coalesce(full_name, ''), length(split_part(coalesce(full_name, ''), ' ', 1)) + 2)), '')),
  phone, business, 'smm', 'lead',
  coalesce(marketing_opt_in, false),
  case kind
    when 'discovery' then array['TMKE Social Media', 'Discovery Call']
    when 'brochure'  then array['TMKE Social Media', 'Brochure Download']
    else array['TMKE Social Media'] end,
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

-- 4) Link accounts: set user_id (and lift to 'member') where an auth user
--    shares the contact's email. Never downgrades an existing 'past'.
update public.contacts c
set user_id = u.id,
    lifecycle = case when c.lifecycle = 'past' then 'past' else 'member' end,
    updated_at = now()
from auth.users u
where c.user_id is null and lower(u.email) = c.email;
