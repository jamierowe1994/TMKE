-- The printed-posts mockups back to 1080 x 1350 (Dani, 25 Oct). Opening them
-- in the Studio upgraded them to 1080 x 1440, the house size, because a
-- 1080 x 1350 design is treated as the old default unless its size is marked
-- as chosen. The photo then re-fitted to the taller page and the screens no
-- longer sat on the posts. This changes only the canvas size and the mark:
-- every screen, and anything dropped into one, is kept. Safe to run twice.

update public.templates
   set canvas = canvas || '{"height": 1350, "sizeChosen": true}'::jsonb
 where id in ('tmpl-mk-print8', 'tmpl-mk-print15');

select id, name, canvas->>'width' as width, canvas->>'height' as height, canvas->>'sizeChosen' as chosen
  from public.templates where id in ('tmpl-mk-print8', 'tmpl-mk-print15');
