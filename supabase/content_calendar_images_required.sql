-- ============================================================================
-- Content Calendar: "Images required" on each post (Danielle, 10 Nov 2026).
--
-- A tick box at the end of each row on the Creation tab, so Sam can see at a
-- glance which designs need her to put the pictures in. Team only:
-- content_month_posts is admin-only, and members never see this column.
--
-- Run in the Supabase SQL editor. Safe to re-run. Changes no post. Sends nothing.
-- ============================================================================

alter table public.content_month_posts add column if not exists images_required boolean not null default false;

notify pgrst, 'reload schema';
