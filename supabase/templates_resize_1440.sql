-- One-time migration: bring existing templates up to the house standard of
-- 1080 × 1440 (Instagram portrait). New/blank/seeded templates already start at
-- 1440 (see src/data/library.js + the editor defaults); this fixes rows created
-- under the old 1080 × 1350 default.
--
-- Safe to re-run (idempotent): it only touches rows still at exactly 1080×1350,
-- and only stretches full-bleed (top-anchored, full-height) background layers.
-- It does NOT touch templates the team deliberately sized to something else.

begin;

-- 1) Stretch full-bleed background layers (y = 0, full 1350 height) to 1440 so
--    the photo/tint fills the taller canvas instead of leaving a strip.
update templates t
set elements = (
  select jsonb_agg(
    case
      when (el->>'y') = '0' and (el->>'h') = '1350'
        then jsonb_set(el, '{h}', '1440'::jsonb)
      else el
    end
  )
  from jsonb_array_elements(t.elements) el
)
where jsonb_typeof(t.elements) = 'array'
  and t.canvas->>'width'  = '1080'
  and t.canvas->>'height' = '1350'
  and exists (
    select 1 from jsonb_array_elements(t.elements) e
    where (e->>'y') = '0' and (e->>'h') = '1350'
  );

-- 2) Bump the canvas itself to 1440 (this is what sets export resolution).
update templates
set canvas = jsonb_set(canvas, '{height}', '1440'::jsonb)
where canvas->>'width' = '1080'
  and canvas->>'height' = '1350';

commit;

-- NOTE: text/elements that were bottom-anchored in a 1350 design keep their
-- original y, so they'll sit ~90px higher than the new bottom edge. The brand-new
-- seed library already accounts for this; for older hand-built templates, open in
-- the studio and nudge the bottom text down (or just re-seed from the library).
