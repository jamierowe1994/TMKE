-- ============================================================================
-- Content Calendar: a go-live date on each month (Danielle, 18 Nov 2026).
--
-- A month can be published ahead of its go-live date. Until that date (UK
-- time), members see it blurred: "December's content is locked and loaded.
-- Your December calendar drops on Tuesday 1 December." On the date it opens
-- by itself. Empty means it's open as soon as it's published.
--
-- Set in Admin > Studio > Content calendar, at Final checks.
--
-- Run in the Supabase SQL editor. Safe to re-run. Changes no month. Sends nothing.
-- ============================================================================

alter table public.content_months add column if not exists goes_live_on date;

notify pgrst, 'reload schema';
