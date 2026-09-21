-- Saved layouts for the other sizes
--
-- A template is drawn once, at one size. When a member resizes it, the Studio
-- rearranges it automatically — well most of the time, and not always well
-- enough to sell. So an admin can open a template, try a size, fix what the
-- automatic pass got wrong, and save THAT layout against THAT size.
--
-- It is not a second template. It is the same row, with a map of layouts kept
-- beside the master design:
--
--   { "1080x1080": { "canvas": {...}, "elements": [...] },
--     "1080x1920": { "canvas": {...}, "elements": [...] } }
--
-- When a member resizes to a size with a saved layout they get that layout;
-- to any other size they get the automatic one, exactly as now.
--
-- Run in the Supabase SQL editor. Safe to re-run.

alter table public.templates
  add column if not exists size_variants jsonb not null default '{}'::jsonb;

comment on column public.templates.size_variants is
  'Saved layouts keyed "WIDTHxHEIGHT" — the admin''s corrections for a size, used instead of the automatic resize.';
