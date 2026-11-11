-- Content Calendar Plus (Danielle, 11 Nov 2026): the Scheduling tier is renamed
-- from "Content Calendar + Scheduling". Renames it on Content calendar ›
-- Overview and in Done For You's "everything included" line. Changes no price,
-- access or subscription. Safe to run twice.
update public.content_levels
   set name = 'Content Calendar Plus'
 where key = 'scheduling' and name <> 'Content Calendar Plus';

update public.content_levels
   set includes = array_replace(includes, 'Everything included with Content Calendar + Scheduling', 'Everything included with Content Calendar Plus')
 where key = 'done_for_you';

select key, name, includes[1] as first_line from public.content_levels order by sort_order;
