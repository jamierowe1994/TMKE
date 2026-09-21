-- Contact blocks (footers)
--
-- A contact block is designed exactly like a template — in the Studio, in
-- admin mode, on whatever canvas is convenient — but it is never used as a
-- whole design. When a member picks one from Elements, only its ELEMENTS come
-- across, as a group, scaled to their canvas. The canvas it was drawn on is a
-- workspace and is thrown away on insert.
--
-- So a block needs three things a template doesn't:
--   kind          — tells the Studio to list it under Elements, not Templates
--   block_variant — which of the four it is (the member picks by look)
--   block_box     — the bounding box of its elements, and the canvas width it
--                   was drawn at, so insert can scale it proportionally
--
-- Run in the Supabase SQL editor. Safe to re-run.

alter table public.templates
  add column if not exists kind text not null default 'template',
  add column if not exists block_variant text,
  add column if not exists block_box jsonb;

-- 'template' = a whole design. 'block' = a group of elements dropped into one.
alter table public.templates drop constraint if exists templates_kind_check;
alter table public.templates
  add constraint templates_kind_check check (kind in ('template', 'block'));

-- The four Danielle asked for. Names are what the member sees, so keep them
-- readable rather than clever.
alter table public.templates drop constraint if exists templates_block_variant_check;
alter table public.templates
  add constraint templates_block_variant_check check (
    block_variant is null or block_variant in (
      'contact-small',        -- small, no photo
      'contact-small-photo',  -- small, with headshot
      'contact-full',         -- full page / full width
      'contact-other'         -- anything later that isn't one of the three
    )
  );

-- block_box shape (design units of the canvas it was drawn on):
--   { "x": 60, "y": 1180, "w": 960, "h": 150, "canvasW": 1080, "canvasH": 1350 }
-- x/y/w/h is the tight bounding box round the block's elements; canvasW/H is
-- what it was drawn on. Insert scales by (targetW * fill) / w and drops the
-- group in, ignoring canvasW/H except as a sanity check.

-- Elements panel reads blocks the same way the Studio reads templates: the
-- existing "templates read active" policy already covers status = 'active',
-- so no new policy is needed.

create index if not exists templates_kind_idx on public.templates (kind, status, sort_order);

-- Existing rows are all whole designs.
update public.templates set kind = 'template' where kind is null;
