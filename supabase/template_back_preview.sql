-- TMKE — the back of a design, on hover (Sam, 16 Oct 2026).
--
-- A template with more than one page shows its second page while the pointer
-- is on its card in a pack. The picture is made with Regenerate previews in
-- the admin Studio (from the design as it is open, so a print template can
-- have its photos in for the picture, as the front does). Until a template's
-- back preview has been made, the Studio draws page two in the browser.
--
-- Run in the Supabase SQL editor. Safe to re-run. The last statement is a
-- check: it is the result the editor shows.

alter table public.templates add column if not exists back_thumb_url text;

select exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'templates' and column_name = 'back_thumb_url'
) as back_preview_ready;
