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
-- LOCATION
-- The pack also asks for the agency's patch 21 times — "We Know [Location]",
-- "A Day in [Location]", "Schools in [Location]". Those are square brackets,
-- which the engine deliberately does NOT touch: square means "type this in
-- yourself". They are the same answer every time for a given agency though, so
-- there is now an "Area you cover" field in the brand kit and a {location} tag
-- ({area} and {town} work too). Switching them over is opt-in, below.
--
-- Leave the second statement commented out if you would rather convert them by
-- hand as you go through the designs. Either way, the genuinely per-post
-- square brackets — [£000,000], [X days], [School Name], [Date & Time] — stay
-- exactly as they are.
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

-- RLS on, no policies: nothing reaches this through the anon or authenticated
-- keys, while the SQL editor and the service role still can — which is all the
-- backup and the restore below need. (public.templates is anon-readable today,
-- so this exposes nothing new either way; there is just no reason to leave a
-- table more open than it has to be. Supabase prompts for this on any table
-- created without it.)
alter table public.templates_backup_merge_tags enable row level security;

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

-- OPTIONAL: switch [Location] over to the {location} tag as well. Uncomment
-- the whole statement to run it. Only [Location]/[location] is touched; every
-- other square-bracket placeholder is left alone.
--
--   update public.templates t
--   set elements = (
--     select jsonb_agg(
--       case
--         when el->>'type' = 'text' and (el->>'text') ~ '\[[Ll]ocation\]'
--         then jsonb_set(el, '{text}',
--                to_jsonb(replace(replace(el->>'text',
--                  '[Location]', '{location}'), '[location]', '{location}')))
--         else el
--       end
--       order by ord
--     )
--     from jsonb_array_elements(t.elements) with ordinality as a(el, ord)
--   )
--   where jsonb_typeof(t.elements) = 'array'
--     and t.elements::text ~ '\[[Ll]ocation\]';

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
