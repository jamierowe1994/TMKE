-- What's actually live in Learn.
--
-- The guides table is readable to the outside world only where a guide is both
-- published AND public, and yours are published to members - so this is the one
-- way to see the real list without signing in. Read-only: it changes nothing.

select
  slug,
  title,
  kind,                                   -- guide (one page) or course (lessons)
  status,                                 -- draft | published
  audience,                               -- members | public
  coalesce(jsonb_array_length(lessons), 0) as lessons,
  est_minutes,
  topic,
  updated_at::date as last_changed
from public.guides
order by status, kind, sort_order nulls last, title;

-- How far members have got, if anyone has started one.
select g.title,
       count(p.*)                                   as members_started,
       count(*) filter (where p.completed)          as members_finished
  from public.guides g
  left join public.guide_progress p on p.guide_slug = g.slug
 group by g.title
 order by members_started desc, g.title;
