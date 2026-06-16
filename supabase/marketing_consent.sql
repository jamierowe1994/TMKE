-- Marketing-consent capture for the public contact form.
--
-- The contact form (/contact) now has an explicit, unticked marketing opt-in.
-- This adds the column that stores each enquirer's choice. Idempotent — safe to
-- run more than once. The site's insert is also written to retry without this
-- field if the column is missing, so deploy order doesn't matter, but run this
-- so consent is actually recorded.
--
-- (Videography bookings already record marketing opt-in via the Worker's
--  upsert_contact RPC — this is only for the enquiries table.)

alter table public.enquiries
  add column if not exists marketing_consent boolean not null default false;

comment on column public.enquiries.marketing_consent is
  'Whether the enquirer ticked the marketing opt-in on the contact form (UK GDPR/PECR consent).';
