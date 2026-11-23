-- Guides: what a member sees when a course is above their level
-- (Danielle, 23 Nov 2026).
--
-- guides.level (already there) says which Content Calendar level a guide or
-- course comes with; a member on that level or a higher one gets it.
-- level_lock says what everyone else sees:
--   'hide'    nothing: it isn't listed, and its link says it can't be found
--             (tutorials for a calendar they don't have)
--   'locked'  it is listed with a padlock and the level it comes with
--             (strategy courses we want them to know about)
--
-- Chosen in Admin › Member hub › Guides, under Details. Until this has run the
-- choice can't be saved and every levelled guide is hidden from those without
-- the level.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.guides
  add column if not exists level_lock text not null default 'hide';

alter table public.guides
  drop constraint if exists guides_level_lock_check;
alter table public.guides
  add constraint guides_level_lock_check check (level_lock in ('hide', 'locked'));

select slug, level, level_lock from public.guides where level <> 'free' order by slug;
