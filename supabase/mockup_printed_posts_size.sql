-- The printed-posts mockups at 1600 x 2000 (Dani, 25 Oct), the size she
-- needs them at. Same 4:5 shape as the photo and as 1080 x 1350, so it is a
-- straight enlargement: the canvas grows by 1600/1080 and every screen grows
-- with it (its place and size, and any picture's position inside it), so the
-- screens still sit on the posts. Pictures already dropped in are kept.
--
-- Also marks the size as chosen: opening them had "upgraded" 1080 x 1350 to
-- 1440 and the screens no longer sat on the posts. Only touches a mockup still
-- 1080 wide, so running it twice changes nothing the second time.

update public.templates t
   set canvas = t.canvas || '{"width": 1600, "height": 2000, "sizeChosen": true}'::jsonb,
       elements = (
         select coalesce(jsonb_agg(
           e || jsonb_build_object(
             'x', round(((e->>'x')::numeric * 1600 / 1080), 2),
             'y', round(((e->>'y')::numeric * 1600 / 1080), 2),
             'w', round(((e->>'w')::numeric * 1600 / 1080), 2),
             'h', round(((e->>'h')::numeric * 1600 / 1080), 2),
             'imgOffsetX', round((coalesce((e->>'imgOffsetX')::numeric, 0) * 1600 / 1080), 2),
             'imgOffsetY', round((coalesce((e->>'imgOffsetY')::numeric, 0) * 1600 / 1080), 2)
           ) order by ord), '[]'::jsonb)
         from jsonb_array_elements(t.elements) with ordinality as x(e, ord)
       )
 where t.id in ('tmpl-mk-print8', 'tmpl-mk-print15')
   and (t.canvas->>'width')::int = 1080;

select id, name, canvas->>'width' as width, canvas->>'height' as height, canvas->>'sizeChosen' as chosen,
       elements->0->>'x' as first_screen_x
  from public.templates where id in ('tmpl-mk-print8', 'tmpl-mk-print15');
