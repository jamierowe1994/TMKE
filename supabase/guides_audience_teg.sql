-- TMKE: a guide can be for The Experts Group's agents only
--
-- guides.audience was members | public. 'teg' adds "agents of The Experts
-- Group only": the Learn page and the reader check it against the member's
-- brands (src/lib/guide-audience.js). Dani, 13 Oct.
--
-- Run in the Supabase SQL editor. Safe to re-run. The last statement is the
-- check: it lists the values the column now accepts.

alter table public.guides drop constraint if exists guides_audience_check;
alter table public.guides add constraint guides_audience_check
  check (audience in ('members', 'public', 'teg'));

select pg_get_constraintdef(oid) as audience_rule
  from pg_constraint where conname = 'guides_audience_check';
