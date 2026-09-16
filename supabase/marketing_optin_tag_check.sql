-- "Everyone opted in to marketing" is the Newsletter-Subscriber tag.
-- Consent is one state: Unsubscribed beats Newsletter-Subscriber beats
-- Marketing-Not-Opted-In, so there is no second "opted in" tag to add.
--
-- The tag is written by upsert_contact when someone opts in, but the
-- marketing_opt_in column can also be changed elsewhere, and nothing keeps the
-- two in step. Run part 1 to see any drift; part 2 fixes the safe direction.

-- 1. How the two agree, before changing anything.
select
  count(*) filter (where coalesce(marketing_opt_in, false))                                        as opted_in_column,
  count(*) filter (where 'Newsletter-Subscriber' = any(tags))                                      as tagged_opted_in,
  count(*) filter (where coalesce(marketing_opt_in, false)
                     and not ('Newsletter-Subscriber' = any(tags))
                     and not ('Unsubscribed' = any(tags)))                                         as opted_in_but_untagged,
  count(*) filter (where 'Newsletter-Subscriber' = any(tags)
                     and not coalesce(marketing_opt_in, false))                                    as tagged_but_column_off,
  count(*) filter (where 'Unsubscribed' = any(tags))                                               as unsubscribed
from public.contacts;

-- 2. Give the tag to anyone the column says is opted in (and who has not
--    unsubscribed), then re-apply the consent rules. This only ever ADDS the
--    tag to people who have already consented - it never opts anyone in.
update public.contacts
   set tags = public.normalize_contact_tags(tags || array['Newsletter-Subscriber'])
 where coalesce(marketing_opt_in, false)
   and not ('Newsletter-Subscriber' = any(tags))
   and not ('Unsubscribed' = any(tags));

-- 3. The other direction is NOT fixed automatically: a contact tagged
--    Newsletter-Subscriber whose marketing_opt_in is false is a consent
--    question, not a tidy-up. List them and decide.
select id, email, first_name, last_name, source, created_at
  from public.contacts
 where 'Newsletter-Subscriber' = any(tags)
   and not coalesce(marketing_opt_in, false)
 order by created_at desc;
