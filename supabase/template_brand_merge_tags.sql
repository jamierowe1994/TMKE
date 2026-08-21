-- Put the member's own agency into the template copy.
--
-- WHY
-- The editor has had a merge-tag engine since the packs were built: on load,
-- {brand name} becomes the member's company from their brand kit. An audit of
-- all 81 templates found not one template using it — 76 elements say
-- "Greenfield Property" literally, so a customer opens a pack and reads
-- someone else's agency on every design.
--
-- WHAT THIS DOES
-- Swaps that name for {brand name} in the COPY. Nothing else changes: no
-- element is retyped, moved, resized or tagged as anything.
--
-- WHAT THIS DOESN'T DO
-- It does not create logo slots. Dani is placing those by hand while making
-- other amends to the designs, using Elements > Brand > "Logo slot" in the
-- editor, which drops a correctly-sized slot already holding {brand name}.
-- (The earlier template_logo_slots.sql did both jobs at once and is no longer
-- needed — this is the half that hand-placing slots does not cover.)
--
-- WHAT IT CATCHES that hand-editing the lockups will not: the 20 mentions that
-- are copy rather than a mark —
--      12  "with Greenfield Property"     reel cover credits
--       4  testimonial / team-bio / valuation prose
--       2  "at Greenfield Property"
--       2  the marks sitting mid-design on Our Promise and Our Patch
-- plus any lockup still in place when this runs, which simply becomes
-- {brand name} and can be deleted as you get to that design.
--
-- EXPECTED (measured 21 Aug 2026): 71 of 81 templates touched, 0 templates
-- left containing "Greenfield" afterwards.
--
-- SAFE TO RE-RUN: nothing matches "Greenfield" after the first pass.

begin;

-- Keep a copy of what we are about to rewrite. Drop it once you are happy.
create table if not exists public.templates_backup_merge_tags as
  select id, name, elements, now() as backed_up_at
  from public.templates
  where elements::text ilike '%Greenfield%';

update public.templates t
set elements = (
  select jsonb_agg(
    case
      when el->>'type' = 'text'
       and (el->>'text') ~* 'Greenfield[[:space:]]+Propert(y|ies)'
      then jsonb_set(el, '{text}',
             to_jsonb(regexp_replace(el->>'text',
               'Greenfield[[:space:]]+Propert(y|ies)', '{brand name}', 'gi')))
      else el
    end
    order by ord
  )
  from jsonb_array_elements(t.elements) with ordinality as a(el, ord)
)
where jsonb_typeof(t.elements) = 'array'
  and t.elements::text ilike '%Greenfield%';

commit;

-- ---------------------------------------------------------------------------
-- Check it. Expect remaining_greenfield 0, merge_tags 76.
--
--   select
--     (select count(*) from public.templates
--       where elements::text ilike '%Greenfield%')              as remaining_greenfield,
--     (select count(*) from public.templates t, jsonb_array_elements(t.elements) el
--       where el->>'text' like '%{brand name}%')                as merge_tags;
--
-- To undo, while the backup table is still there:
--
--   update public.templates t
--   set elements = b.elements
--   from public.templates_backup_merge_tags b
--   where b.id = t.id;
-- ---------------------------------------------------------------------------
