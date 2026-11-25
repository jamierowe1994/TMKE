-- TMKE — Email › Templates (Danielle, 25 Nov 2026)
-- A template is an email someone has chosen to keep for reuse: "Save as a
-- template" in the email editor, or from the list. It is a copy, with its own
-- title, the area of the business it is for, and a description. Emails made
-- from a template are copies too, so a template never changes under a send.
--
-- Three empty fields on the emails table. Changes no email and sends nothing.
-- Until it runs, Email › Templates lists every email as before, and Save as a
-- template says it needs this file.
--
-- Safe to re-run.

alter table public.email_templates
  add column if not exists is_template boolean not null default false,
  add column if not exists area text,
  add column if not exists description text;

-- The Templates list reads only the rows kept as templates.
create index if not exists email_templates_is_template_idx
  on public.email_templates (updated_at desc)
  where is_template;
