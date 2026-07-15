-- TMKE — secondary email on a contact
-- A DELIVERY address, not a second identity. The case that drove it: TEG new
-- starters are on file under their work email (correctly — that's the address
-- the business knows them by), but they often can't read it until their first
-- day, so the onboarding funnel lands somewhere they can't see.
--
-- Deliberately NOT a second contact row and NOT a marketing address:
--   * identity stays `email` (dedupe, tags, lifecycle all key off it)
--   * automation/funnel emails go to BOTH so they actually arrive
--   * marketing/newsletter sends must keep using `email` only
--
-- Safe to re-run.

alter table public.contacts
  add column if not exists secondary_email text;

comment on column public.contacts.secondary_email is
  'Optional extra delivery address for funnel/automation email only (e.g. a personal address while a new starter is pre-start). Not an identity, not for marketing.';
