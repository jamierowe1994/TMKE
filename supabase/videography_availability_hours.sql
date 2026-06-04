-- TMKE — Diary upgrade: per-day hour blocks
-- ---------------------------------------------------------------------------
-- Adds an `hours` column to videography_availability so Jack can pick exact
-- bookable hours per weekday (e.g. 9–13 and 15–18), not one fixed range.
-- `hours` = array of available start-hours, 0–23. Empty = closed that day.
-- Backfills from the old start_time/end_time so nothing breaks.
-- Run once in the Supabase SQL editor.
-- ---------------------------------------------------------------------------

alter table public.videography_availability
  add column if not exists hours jsonb not null default '[]';

-- Backfill: turn existing open ranges into hour lists (only where hours is empty).
update public.videography_availability av
set hours = (
  select coalesce(jsonb_agg(h order by h), '[]'::jsonb)
  from generate_series(
    floor(split_part(av.start_time, ':', 1)::int)::int,
    ceil(split_part(av.end_time, ':', 1)::int)::int - 1
  ) as h
)
where av.is_available = true
  and av.hours = '[]'::jsonb
  and av.start_time is not null
  and av.end_time is not null;
