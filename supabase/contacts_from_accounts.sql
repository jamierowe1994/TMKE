-- ============================================================================
-- Contacts for every member account that has none.
--
-- Until 7 Sep 2026 creating a member account only created a CRM contact if
-- the marketing box was ticked (the /newsletter path). Leave it unticked and
-- you had an account but no contact — invisible in Admin → Contacts. The
-- Worker now creates the contact at signup; this catches everyone who joined
-- before that. Name comes from the account's full_name; consent is recorded
-- as not opted in (nothing says otherwise); the contact is linked to the
-- account and tagged as a member.
--
-- The name lives in the account's metadata under one of three shapes,
-- depending on which door they came in through: full_name (the join page and
-- every Worker-made account), name (an account created after a pack
-- purchase), or first_name + last_name. All three are read.
--
-- Run in the Supabase SQL editor. Safe to re-run (idempotent) — and re-running
-- it also fills in names on contacts that were created without one.
-- ============================================================================

create or replace function pg_temp.account_full_name(meta jsonb) returns text
language sql immutable as $$
  select nullif(trim(coalesce(
    nullif(meta->>'full_name', ''),
    nullif(meta->>'name', ''),
    nullif(trim(concat_ws(' ', meta->>'first_name', meta->>'last_name')), '')
  )), '')
$$;

insert into public.contacts (email, first_name, last_name, source, lifecycle, marketing_opt_in, tags, user_id, last_seen_at)
select
  lower(trim(u.email)),
  nullif(split_part(coalesce(pg_temp.account_full_name(u.raw_user_meta_data), ''), ' ', 1), ''),
  nullif(trim(substr(coalesce(pg_temp.account_full_name(u.raw_user_meta_data), ''), length(split_part(coalesce(pg_temp.account_full_name(u.raw_user_meta_data), ''), ' ', 1)) + 2)), ''),
  'signup', 'member', false,
  array['TMKE-Account-Member', 'Marketing-Not-Opted-In']
    || array[case when lower(u.email) like '%experts.co.uk' then 'Network: TEG'
                  when lower(u.email) like '%@fineandcountry.com' then 'Network: Fine-and-Country'
                  else 'Network: External' end],
  u.id,
  coalesce(u.last_sign_in_at, u.created_at, now())
from auth.users u
where u.email is not null
  and not exists (select 1 from public.contacts c where lower(c.email) = lower(trim(u.email)))
  and not exists (select 1 from public.admins a where lower(a.email) = lower(trim(u.email)));

-- Accounts that already had a contact but were never linked to it.
update public.contacts c
set user_id = u.id,
    lifecycle = case when c.lifecycle = 'past' then 'past' else 'member' end,
    tags = (select array(select distinct unnest(c.tags || array['TMKE-Account-Member']))),
    updated_at = now()
from auth.users u
where lower(c.email) = lower(trim(u.email))
  and (c.user_id is null or not ('TMKE-Account-Member' = any(c.tags)));

-- Contacts linked to an account but missing a name: take it from the account.
update public.contacts c
set first_name = coalesce(c.first_name, nullif(split_part(pg_temp.account_full_name(u.raw_user_meta_data), ' ', 1), '')),
    last_name  = coalesce(c.last_name,  nullif(trim(substr(pg_temp.account_full_name(u.raw_user_meta_data), length(split_part(pg_temp.account_full_name(u.raw_user_meta_data), ' ', 1)) + 2)), '')),
    phone      = coalesce(c.phone,   nullif(u.raw_user_meta_data->>'phone', '')),
    company    = coalesce(c.company, nullif(u.raw_user_meta_data->>'company', '')),
    updated_at = now()
from auth.users u
where c.user_id = u.id
  and (c.first_name is null or c.last_name is null or c.phone is null or c.company is null)
  and pg_temp.account_full_name(u.raw_user_meta_data) is not null;

-- What the accounts actually hold, so a blank name can be traced to its door.
select u.email, u.created_at, u.raw_user_meta_data
from auth.users u
where not exists (select 1 from public.admins a where lower(a.email) = lower(u.email))
order by u.created_at desc
limit 20;
