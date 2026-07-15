-- TMKE — Email Studio folders
-- Group templates (e.g. "Videography", "Social media") so the list stays
-- manageable as more emails are built. A plain text column rather than a
-- folders table: a folder only exists because a template names it, so there's
-- nothing to keep in sync and no empty-folder housekeeping.
--
-- Safe to re-run.

alter table public.email_templates
  add column if not exists folder text;

-- Filtering the list by folder.
create index if not exists email_templates_folder_idx
  on public.email_templates (folder);
