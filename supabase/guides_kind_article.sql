-- Guides: Article as a third type beside Guide and Course (Danielle, 23 Nov 2026).
--
-- An Article is one flowing page, like a Guide; the difference is its label on
-- Learn and in the reader ("Article" rather than "Guide"). Until this has run,
-- saving a guide as an Article is refused and the editor says so.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.guides drop constraint if exists guides_kind_check;
alter table public.guides
  add constraint guides_kind_check check (kind in ('guide', 'course', 'article'));

select kind, count(*) as guides from public.guides group by kind order by kind;
