-- ============================================================
-- Consent becomes Marketing-Opt-In; Newsletter-Subscriber becomes its own tag
--
-- Until now one tag did two jobs. "Newsletter-Subscriber" was the consent state
-- (may we email them marketing), which meant there was no way to tell who had
-- actually asked for the newsletter - the thing it sounds like it means.
--
--   Marketing-Opt-In        the audience for anything we send. One consent
--                           state: Unsubscribed > Marketing-Opt-In >
--                           Marketing-Not-Opted-In.
--   Newsletter-Subscriber   NOT a consent state. Which of the opted-in
--                           subscribed to the newsletter itself. Carries
--                           consent with it, so it implies Marketing-Opt-In,
--                           and unsubscribing removes both.
--
-- Run once in the Supabase SQL editor, as soon as the site and Worker are
-- deployed. Idempotent: running it twice changes nothing the second time.
-- ============================================================

-- ============================================================
-- 1. The rules. Same function as contact_tag_rules.sql with the consent block
--    rewritten; every other rule is unchanged.
-- ============================================================
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

  -- Consent — a single state. A newsletter subscriber is opted in by
  -- definition; someone unsubscribed is neither, and gets no newsletter.
  if 'Unsubscribed' = any(t) then
    t := array(select x from unnest(t) x
                where x not in ('Marketing-Opt-In', 'Marketing-Not-Opted-In', 'Newsletter-Subscriber'));
  else
    if 'Newsletter-Subscriber' = any(t) and not ('Marketing-Opt-In' = any(t)) then
      t := t || 'Marketing-Opt-In';
    end if;
    if 'Marketing-Opt-In' = any(t) then
      t := array(select x from unnest(t) x where x <> 'Marketing-Not-Opted-In');
    end if;
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

-- ============================================================
-- 2. Before: how many hold the old tag.
-- ============================================================
select count(*) filter (where 'Newsletter-Subscriber' = any(tags))  as holds_old_tag,
       count(*) filter (where 'Marketing-Opt-In' = any(tags))       as holds_new_tag,
       count(*) filter (where coalesce(marketing_opt_in, false))    as opted_in_column
  from public.contacts;

-- ============================================================
-- 3. The rename. Everyone holding the old tag held it as consent, so they all
--    become Marketing-Opt-In. Who actually subscribed is decided in step 4.
-- ============================================================
update public.contacts
   set tags = array_replace(tags, 'Newsletter-Subscriber', 'Marketing-Opt-In')
 where 'Newsletter-Subscriber' = any(tags);

-- Anyone the column says is opted in but who carries no consent tag at all.
update public.contacts
   set tags = tags || array['Marketing-Opt-In']
 where coalesce(marketing_opt_in, false)
   and not ('Marketing-Opt-In' = any(tags))
   and not ('Unsubscribed' = any(tags));

-- ============================================================
-- 4. Who subscribed to the newsletter itself: the consent trail says so
--    ('newsletter_footer' is the footer box; 'join_signup' is a tick while
--    creating an account, which is consent but not a newsletter request).
--    Older contacts, from before the trail existed, are taken from their source.
-- ============================================================
update public.contacts c
   set tags = c.tags || array['Newsletter-Subscriber']
 where not ('Newsletter-Subscriber' = any(c.tags))
   and not ('Unsubscribed' = any(c.tags))
   and (
     exists (select 1 from public.contact_consent_events e
              where e.contact_id = c.id and e.action = 'opted_in' and e.source = 'newsletter_footer')
     or (coalesce(marketing_opt_in, false) and c.source = 'newsletter'
         and not exists (select 1 from public.contact_consent_events e2 where e2.contact_id = c.id))
   );

-- ============================================================
-- 5. Automations that were built against the old tag keep working: rewrite the
--    tag where it is stored, in the audience and in any if/else.
-- ============================================================
update public.automations
   set trigger_config = replace(trigger_config::text, '"Newsletter-Subscriber"', '"Marketing-Opt-In"')::jsonb,
       graph          = replace(graph::text,          '"Newsletter-Subscriber"', '"Marketing-Opt-In"')::jsonb
 where trigger_config::text like '%Newsletter-Subscriber%'
    or graph::text like '%Newsletter-Subscriber%';

-- ============================================================
-- 6. Re-apply the rules to every contact, then show the result.
-- ============================================================
update public.contacts set tags = public.normalize_contact_tags(tags);

select count(*) filter (where 'Marketing-Opt-In' = any(tags))        as opted_in,
       count(*) filter (where 'Newsletter-Subscriber' = any(tags))   as newsletter_subscribers,
       count(*) filter (where 'Marketing-Not-Opted-In' = any(tags))  as not_opted_in,
       count(*) filter (where 'Unsubscribed' = any(tags))            as unsubscribed,
       count(*) filter (where 'Newsletter-Subscriber' = any(tags)
                          and not ('Marketing-Opt-In' = any(tags)))  as should_be_zero
  from public.contacts;
