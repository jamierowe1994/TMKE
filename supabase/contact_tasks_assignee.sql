-- Contacts redesign (Danielle, 12 Nov 2026): a task on a contact card says who
-- it's for, as well as when it's due (due_at already exists).
-- Safe to run more than once.
alter table public.contact_tasks add column if not exists assigned_to text;
