-- Why the newsletter list is empty, and what to do about it.
--
-- Marketing-Opt-In is everyone we may email (201 of them). Newsletter-Subscriber
-- is the smaller group who asked for the newsletter itself. The rename could
-- only award that tag on evidence: a consent event recorded as
-- 'newsletter_footer', or, for contacts from before the trail existed, a source
-- of 'newsletter' with no events at all. Nobody matched.
--
-- Run 1 and 2 to see why. Then choose: leave it to grow from today, or decide
-- that a group of the existing opted-in counts as subscribers (3).

-- 1. Where recorded consent came from.
select source, action, count(*) as events, min(occurred_at)::date as first, max(occurred_at)::date as latest
  from public.contact_consent_events
 group by 1, 2
 order by events desc;

-- 2. How the opted-in arrived, by the contact's own source.
select coalesce(source, '(none)') as contact_source, count(*) as opted_in
  from public.contacts
 where 'Marketing-Opt-In' = any(tags)
 group by 1
 order by opted_in desc;

-- 3. OPTIONAL, and a business decision rather than a data one. If a source in
--    the list above is genuinely "they subscribed", tag that group. Edit the
--    source, then run it. Repeat per source. It never touches the unsubscribed.
--
-- update public.contacts
--    set tags = public.normalize_contact_tags(tags || array['Newsletter-Subscriber'])
--  where 'Marketing-Opt-In' = any(tags)
--    and not ('Newsletter-Subscriber' = any(tags))
--    and source = 'newsletter';          -- <- the source to treat as subscribers

-- 4. Where it stands.
select count(*) filter (where 'Marketing-Opt-In' = any(tags))       as opted_in,
       count(*) filter (where 'Newsletter-Subscriber' = any(tags))  as newsletter_subscribers
  from public.contacts;
