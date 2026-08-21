-- Brand logo slots + brand-name merge tags in the template packs.
--
-- WHY
-- The packs were drawn with a made-up agency on them, "Greenfield Property",
-- set as TEXT. That serves a brand whose mark is its name and fails every
-- brand with a real image logo, which is most estate agents. Separately, the
-- editor has had a merge-tag engine since the packs were built ({brand name}
-- resolves to the member's company on load) but not one template used it — so
-- customers opened a pack and saw someone else's agency on every design.
--
-- WHAT THIS DOES
--   1. Text elements whose copy is exactly "Greenfield Property" /
--      "Greenfield Properties" become LOGO SLOTS: brandRole = "logo", and
--      their text becomes {brand name}. On load the editor swaps the slot for
--      the member's uploaded logo, fitted inside the box the designer drew —
--      or, if they haven't uploaded one, leaves it as text showing their own
--      company name.
--   2. Every other mention ("at Greenfield Property", "Six years at Greenfield
--      Property and counting") just gets the merge tag. Those are prose, not
--      marks, and a logo dropped into them would read as nonsense.
--
-- "with Greenfield Property" is deliberately in group 2: replacing the whole
-- element with an image would lose the word "with".
--
-- EXPECTED (measured against the live bucket on 21 Aug 2026):
--      58 logo slots across 58 templates
--      18 other mentions across 17 templates
--      71 of 81 templates touched
--
-- SAFE TO RE-RUN: after the first pass nothing matches "Greenfield" any more,
-- so a second run changes nothing.

begin;

-- Keep a copy of what we are about to rewrite. Drop it once you are happy.
create table if not exists public.templates_backup_logo_slots as
  select id, name, elements, now() as backed_up_at
  from public.templates
  where elements::text ilike '%Greenfield%';

update public.templates t
set elements = (
  select jsonb_agg(
    case
      -- 1. The bare agency name on its own: this is the logo lockup.
      when el->>'type' = 'text'
       and trim(el->>'text') ~* '^Greenfield[[:space:]]+Propert(y|ies)$'
      then el || jsonb_build_object('brandRole', 'logo', 'text', '{brand name}')

      -- 2. Any other mention: swap the name for the tag, leave it as text.
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
-- Check it did what it should. Expect: logo_slots 58, remaining_greenfield 0.
--
--   select
--     (select count(*) from public.templates t, jsonb_array_elements(t.elements) el
--       where el->>'brandRole' = 'logo')                        as logo_slots,
--     (select count(*) from public.templates
--       where elements::text ilike '%Greenfield%')              as remaining_greenfield,
--     (select count(*) from public.templates t, jsonb_array_elements(t.elements) el
--       where el->>'text' like '%{brand name}%')                as merge_tags;
--
-- To undo, while the backup table is still there:
--
--   update public.templates t
--   set elements = b.elements
--   from public.templates_backup_logo_slots b
--   where b.id = t.id;
-- ---------------------------------------------------------------------------
