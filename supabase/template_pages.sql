-- One design is one design, however many sides it has
--
-- A template row has held one page since everything was a social post, and
-- publishing a two-page design wrote TWO rows: "Postcard — 01" and
-- "Postcard — 02". A member then opened their pack and was offered two
-- designs, which is not what was made. A postcard has a front and a back the
-- way a letter has a first and second sheet: one thing.
--
-- `designs` (a member's own work) has carried `pages` all along. This gives
-- `templates` the same column, so the two stop disagreeing about what a
-- design is.
--
--   pages  [{ "canvas": {...}, "elements": [...] }, ...]
--
-- `canvas` and `elements` stay as they are and keep holding PAGE ONE, so
-- everything that reads a template today -- the catalogue, the shop, the
-- thumbnails, the size checker -- carries on working untouched.
--
-- Run in the Supabase SQL editor. Safe to re-run.

alter table public.templates
  add column if not exists pages jsonb;

-- Designs already split into one row per page. Their names end "— 01",
-- "— 02" and they share a pack, which is what makes them findable.
-- READ THIS BEFORE MERGING ANYTHING: nothing below changes a row.
select regexp_replace(t.name, '\s+—\s+\d+$', '') as design,
       count(*)                                   as rows_it_became,
       p.title                                    as pack,
       string_agg(t.name, ', ' order by t.sort_order) as named
  from public.templates t
  left join public.packs p on p.id = t.pack_id
 where t.name ~ '\s+—\s+\d+$'
 group by 1, 3
having count(*) > 1
 order by 1;
