-- TMKE — CRM tag reconciliation. Run once in the Supabase SQL editor.
-- ---------------------------------------------------------------------------
-- Tags were only ever UNIONed onto contacts (upsert_contact merged, the admin
-- drawer appended), so superseded tags accumulated: multiple SMM-Status values,
-- Interest/Discovery-call tags lingering after someone became a client, and
-- Newsletter-Subscriber sitting alongside Marketing-Not-Opted-In.
--
-- This file adds a single reconciliation function, wires it into upsert_contact
-- so tags self-heal on every write, and backfills every existing contact.
-- (The Worker's SMM-status path and the admin drawer apply the same rules in JS.)
-- Safe to re-run.

-- ---- The rules -------------------------------------------------------------
-- 1. Consent is one state:  Unsubscribed > Newsletter-Subscriber > Marketing-Not-Opted-In.
-- 2. SMM-Status is one value: Active > Paused > Ended.
-- 3. Becoming a client supersedes that service's lead tags:
--      any SMM-Status  -> drop Interest: SMM / Discovery-Call-Booked: SMM
--      Videography-Client -> drop Interest: Videography / Discovery-Call-Booked: Videography
-- 4. Legacy names heal to their framework equivalents (CSV imports pass
--    Tags/Type column values through verbatim, e.g. "TEG", "Estate Agent").
create or replace function public.normalize_contact_tags(p_tags text[])
returns text[] language plpgsql immutable as $$
declare t text[];
begin
  -- de-dupe, drop nulls/blanks, map legacy aliases onto framework tags
  t := array(select distinct case btrim(x)
               when 'TEG' then 'Network: TEG'
               when 'Estate Agent' then 'Type: Estate-Agent'
               when 'Lettings' then 'Type: Lettings'
               when 'Financial Services' then 'Type: Financial-Services'
               when 'Fine & Country' then 'Network: Fine-and-Country'
               when 'Fine and Country' then 'Network: Fine-and-Country'
               else btrim(x) end
             from unnest(coalesce(p_tags, '{}')) x
             where x is not null and btrim(x) <> '');

  -- Consent — a single state.
  if 'Unsubscribed' = any(t) then
    t := array(select x from unnest(t) x where x not in ('Newsletter-Subscriber', 'Marketing-Not-Opted-In'));
  elsif 'Newsletter-Subscriber' = any(t) then
    t := array(select x from unnest(t) x where x <> 'Marketing-Not-Opted-In');
  end if;

  -- SMM-Status — a single value (Active > Paused > Ended).
  if (select count(*) from unnest(t) x where x like 'SMM-Status:%') > 1 then
    t := array(select x from unnest(t) x where x not like 'SMM-Status:%')
         || (case when 'SMM-Status: Active' = any(t) then 'SMM-Status: Active'
                  when 'SMM-Status: Paused' = any(t) then 'SMM-Status: Paused'
                  else 'SMM-Status: Ended' end);
  end if;

  -- A client supersedes that service's lead tags.
  if exists (select 1 from unnest(t) x where x like 'SMM-Status:%') then
    t := array(select x from unnest(t) x where x not in ('Interest: SMM', 'Discovery-Call-Booked: SMM'));
  end if;
  if 'Videography-Client' = any(t) then
    t := array(select x from unnest(t) x where x not in ('Interest: Videography', 'Discovery-Call-Booked: Videography'));
  end if;

  return t;
end $$;

-- ---- upsert_contact now normalizes the merged tags -------------------------
create or replace function public.upsert_contact(
  p_email            text,
  p_first_name       text default null,
  p_last_name        text default null,
  p_phone            text default null,
  p_company          text default null,
  p_source           text default null,
  p_lifecycle        text default null,
  p_marketing_opt_in boolean default null,
  p_tags             text[] default null,
  p_user_id          uuid default null
) returns uuid
language plpgsql security definer as $$
declare v_id uuid;
begin
  insert into public.contacts (email, first_name, last_name, phone, company, source, user_id,
    lifecycle, marketing_opt_in, tags, last_seen_at)
  values (lower(trim(p_email)), p_first_name, p_last_name, p_phone, p_company, p_source, p_user_id,
    coalesce(p_lifecycle, 'lead'), coalesce(p_marketing_opt_in, false),
    public.normalize_contact_tags(coalesce(p_tags, '{}')), now())
  on conflict (email) do update set
    first_name       = coalesce(excluded.first_name, public.contacts.first_name),
    last_name        = coalesce(excluded.last_name,  public.contacts.last_name),
    phone            = coalesce(excluded.phone,      public.contacts.phone),
    company          = coalesce(excluded.company,    public.contacts.company),
    user_id          = coalesce(excluded.user_id,    public.contacts.user_id),
    source           = coalesce(public.contacts.source, excluded.source),
    lifecycle        = coalesce(p_lifecycle, public.contacts.lifecycle),
    marketing_opt_in = public.contacts.marketing_opt_in or coalesce(p_marketing_opt_in, false),
    tags             = public.normalize_contact_tags(public.contacts.tags || coalesce(p_tags, '{}')),
    last_seen_at     = now()
  returning id into v_id;
  return v_id;
end; $$;

-- ---- Backfill existing contacts --------------------------------------------
-- 1) Set the correct single SMM-Status from the lead's real client_status.
update public.contacts c set tags =
  array(select x from unnest(c.tags) x where x not like 'SMM-Status:%')
  || (case l.client_status
        when 'active' then 'SMM-Status: Active'
        when 'paused' then 'SMM-Status: Paused'
        when 'ended'  then 'SMM-Status: Ended'
      end)
from public.smm_leads l
where lower(l.email) = lower(c.email)
  and l.client_status in ('active', 'paused', 'ended');

-- 2) Drop the leftover test-purchase tag (one-off data fix, idempotent).
update public.contacts set tags = array_remove(tags, 'Pack Name: pack test')
where 'Pack Name: pack test' = any(tags);

-- 3) Reconcile every contact against the rules (also folds legacy aliases).
update public.contacts set tags = public.normalize_contact_tags(tags);
