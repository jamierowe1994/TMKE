-- Catalogue: a content pillar on each planned design (Danielle, 12 Nov 2026).
-- The same pillars as the Content Calendar (src/lib/content-months.js PILLARS).
-- Builds on supabase/catalogue_builder.sql. Safe to re-run. Changes nothing
-- anyone sees and sends nothing.

alter table public.pack_plan_rows add column if not exists pillar text;

notify pgrst, 'reload schema';

select count(*) as planned_rows, count(pillar) as with_pillar from public.pack_plan_rows;
