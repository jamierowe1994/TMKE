-- A type for each print design (Danielle, 31 Oct 2026).
--
-- Free text, shown as a pill on the design in Your Print Materials, e.g.
-- "Booklet" or "Leaflet". Edited in Admin > Design studio > Print > Print
-- materials, in the Type column. Blank means no pill.
--
-- Builds on supabase/print_guide.sql. Run in the Supabase SQL editor. Safe to
-- re-run: it never overwrites a type that's already set.

alter table public.print_guide add column if not exists kind text;

-- The two brochures, for both brands.
update public.print_guide g
   set kind = v.kind
  from public.templates t
  join public.packs p on p.id = t.pack_id and p.kind = 'print',
       (values ('10 Ways To Attract More Buyers', 'Booklet'),
               ('20 Reasons To Choose The Property Experts', 'Leaflet')) as v(title, kind)
 where g.template_id = t.id
   and g.kind is null
   and lower(coalesce(g.title, public.print_guide_title(t.name))) = lower(v.title);

-- Check: every print design and its type. Four should have one.
select (select string_agg(b, ', ') from unnest(p.brands) b) as brands,
       p.title as pack, coalesce(g.title, public.print_guide_title(t.name)) as shown_as, g.kind
  from public.templates t
  join public.packs p on p.id = t.pack_id
  left join public.print_guide g on g.template_id = t.id
 where p.kind = 'print'
 order by brands, p.sort_order, t.sort_order;
