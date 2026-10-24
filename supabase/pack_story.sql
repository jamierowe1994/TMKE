-- A pack's story (Danielle, 24 Oct 2026): the short, more conceptual text
-- centred under the sliding templates on its shop page. A heading line and
-- a paragraph, edited in Admin > Packs > the pack.
--
-- Fills in The Autumn Edit's. Safe to re-run.

alter table public.packs
  add column if not exists story_heading text,
  add column if not exists story_body    text;

update public.packs
   set story_heading = 'The Autumn Edit takes its cues from the season itself.',
       story_body    = 'Drawing from darker evenings, warm rooms, open fires and the slightly imperfect feel of the season. Richer colours sit alongside softer imagery, natural textures and a little more movement. There’s estate agency in there, of course, but it isn’t allowed to take over. It’s our version of autumn, rather than everything autumn is supposed to look like.'
 where slug = 'autumn-edit' and story_heading is null;

notify pgrst, 'reload schema';
