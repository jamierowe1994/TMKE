-- ============================================================================
-- Content Calendar: "Pictures in the design" on each post (Danielle, 18 Nov 2026).
--
-- Set in the post pop-out under Note: No need to replace / Optional to replace /
-- Must be replaced. Draft with Claude writes How to edit to it. Empty means not
-- set, and Claude decides from the post. Team only: content_month_posts is
-- admin-only.
--
-- Run in the Supabase SQL editor. Safe to re-run. Changes no post. Sends nothing.
-- ============================================================================

alter table public.content_month_posts add column if not exists image_rule text
  check (image_rule in ('none', 'optional', 'required'));

notify pgrst, 'reload schema';
