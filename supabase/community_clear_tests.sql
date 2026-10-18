-- Clear the Community's test posts before launch (Dani, 18 Oct 2026).
--
-- Removes:
--   · the test conversation "Test Chat" and the test request "Test request",
--     with everything under them (comments, replies, needs, reports);
--   · every comment left on a fortnight topic before the Community went live
--     (8am on Monday 19 October): only the team could see those, so they are
--     all tests;
--   · reactions left pointing at anything removed.
-- Nothing else is touched. Run once, in the Supabase SQL editor, before 8am
-- on Monday. The last line shows what is left, so you can see it worked.

delete from public.community_posts
  where kind in ('discussion', 'request') and title in ('Test Chat', 'Test request');

delete from public.community_replies r
  using public.community_posts p
  where r.post_id = p.id and p.kind = 'topic'
    and r.created_at < timestamptz '2026-10-19 08:00 Europe/London';

delete from public.community_reactions x
  where not exists (select 1 from public.community_posts p where p.id = x.target_id)
    and not exists (select 1 from public.community_replies r where r.id = x.target_id);

-- What's left: the eight discussions, and no comments yet.
select kind, title, reply_count, need_count from public.community_posts order by kind, starts_on nulls first;
