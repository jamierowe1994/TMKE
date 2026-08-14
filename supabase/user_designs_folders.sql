-- ============================================================
-- Design folders, for the gallery at /account/editor
-- ============================================================
-- Additive and safe to re-run.
--
-- A plain text column rather than a folders table, matching what Email Studio
-- already does (see email_template_folders.sql): a folder exists because a
-- design names it, so there is nothing to keep in sync, no orphan rows when a
-- design is deleted, and no empty-folder housekeeping.
--
-- The trade is that a folder cannot exist before something is in it. That is
-- why the gallery creates a folder by naming one while filing designs into it,
-- rather than offering an empty folder to fill later.
--
-- No RLS change is needed: user_designs already restricts every row to its
-- owner, and this is just another column on those rows.
-- ============================================================

alter table public.user_designs
  add column if not exists folder text;

-- Listing one folder, and building the folder row itself, are both per-user.
create index if not exists user_designs_folder_idx
  on public.user_designs (user_id, folder);
