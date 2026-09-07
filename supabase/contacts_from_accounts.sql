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
-- Run in the Supabase SQL editor. Safe to re-run (idempotent).
-- ============================================================================

insert into public.contacts (email, first_name, last_name, source, lifecycle, marketing_opt_in, tags, user_id, last_seen_at)
select
  lower(trim(u.email)),
  nullif(split_part(coalesce(u.raw_user_meta_data->>'full_name', ''), ' ', 1), ''),
  nullif(trim(substr(coalesce(u.raw_user_meta_data->>'full_name', ''), length(split_part(coalesce(u.raw_user_meta_data->>'full_name', ''), ' ', 1)) + 2)), ''),
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
