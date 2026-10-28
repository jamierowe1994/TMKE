-- ============================================================================
-- Content Calendar: notes on each month (Danielle, 28 Oct 2026).
--
-- Ideas and rough planning for a month, kept beside it in Admin > Content
-- calendar > Month builder > Notes. Team only: content_months is admin-only
-- (content_calendar_months.sql), and the Studio never reads this column.
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- ============================================================================

alter table public.content_months add column if not exists notes text;
