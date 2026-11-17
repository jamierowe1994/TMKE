-- Report only, changes nothing (Danielle for Sam, 17 Nov 2026).
-- Every live TPE and PPE agent with a Member Hub account, newest first:
-- their brand(s), when they joined and last signed in, how far they are
-- through "Your First Print Design" (print-first-design) and "Your First
-- Design" (training-studio), and what they've made: designs saved (print
-- ones counted separately), posts on their planner, and downloads.
-- Downloads: before 17 Nov only members who accepted analytics cookies were
-- recorded; from 17 Nov the usage log records everyone.
-- Staff are left out. Download the result as CSV from the SQL editor.

with agents as (
  select c.id as contact_id, c.user_id,
         trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')) as name,
         c.email,
         string_agg(distinct case ap.brand when 'The Property Experts' then 'TPE' else 'PPE' end, ' + ') as brand
    from public.agent_profiles ap
    join public.contacts c on c.id = ap.contact_id
   where ap.brand in ('The Property Experts', 'Prestige Property Experts')
     and ap.left_at is null
     and c.user_id is not null
     and not exists (select 1 from public.admins a where a.user_id = c.user_id)
   group by c.id, c.user_id, c.first_name, c.last_name, c.email
),
course as (
  select user_id,
         max(case when guide_slug = 'print-first-design' then
               case when completed then 'Done ' || to_char(completed_at at time zone 'Europe/London', 'DD Mon')
                    when furthest > 0 then 'Part ' || furthest || ' of ' || total
                    else 'Opened' end end) as print_course,
         max(case when guide_slug = 'training-studio' then
               case when completed then 'Done ' || to_char(completed_at at time zone 'Europe/London', 'DD Mon')
                    when furthest > 0 then 'Part ' || furthest || ' of ' || total
                    else 'Opened' end end) as first_design_course
    from public.guide_progress
   where guide_slug in ('print-first-design', 'training-studio')
   group by user_id
),
designs as (
  select d.user_id,
         count(*) as designs_saved,
         -- Print, the Studio's own test (studio.astro isPrintDesign): a print
         -- size at 300dpi, or the A-series shape at print resolution. Fixed
         -- 17 Nov: the first version looked for print on the template, which
         -- only packs carry, so it said 0 for everyone.
         count(*) filter (where d.w > 0 and d.h > 0 and (
           (d.w || 'x' || d.h) in ('2480x3508','3508x2480','1748x2480','2480x1748','1240x1748','1748x1240','1004x650','650x1004')
           or (abs(greatest(d.w, d.h)::numeric / least(d.w, d.h) - 1.41421) < 0.01 and least(d.w, d.h) >= 1200)
         )) as print_designs,
         max(d.created_at) as last_design_at
    from (select user_id, created_at,
                 case when canvas->>'width' ~ '^[0-9.]+$' then round((canvas->>'width')::numeric)::int end as w,
                 case when canvas->>'height' ~ '^[0-9.]+$' then round((canvas->>'height')::numeric)::int end as h
            from public.user_designs) d
   group by d.user_id
),
planned as (
  select user_id, count(*) as planner_posts
    from public.calendar_items
   where status <> 'cancelled'
   group by user_id
),
downloads as (
  select user_id, count(*) as downloads from (
    select user_id from public.site_events where name = 'design_downloaded' and user_id is not null
    union all
    select user_id from public.usage_log where event = 'downloaded'
  ) x group by user_id
)
select a.name, a.email, a.brand,
       to_char(u.created_at at time zone 'Europe/London', 'DD Mon YYYY') as joined,
       to_char(u.last_sign_in_at at time zone 'Europe/London', 'DD Mon YYYY') as last_signed_in,
       coalesce(c.print_course, 'Not started') as print_training,
       coalesce(c.first_design_course, 'Not started') as first_design_training,
       coalesce(d.designs_saved, 0) as designs_saved,
       coalesce(d.print_designs, 0) as print_designs,
       to_char(d.last_design_at at time zone 'Europe/London', 'DD Mon YYYY') as last_design,
       coalesce(p.planner_posts, 0) as planner_posts,
       coalesce(dl.downloads, 0) as downloads
  from agents a
  join auth.users u on u.id = a.user_id
  left join course c on c.user_id = a.user_id
  left join designs d on d.user_id = a.user_id
  left join planned p on p.user_id = a.user_id
  left join downloads dl on dl.user_id = a.user_id
 order by a.brand, u.created_at desc;
