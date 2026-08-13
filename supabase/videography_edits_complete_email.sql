-- TMKE — videography: close-out email once edits are settled
-- Run AFTER schema.sql in the Supabase SQL editor.
--
-- Guards sendEditsCompleteEmail() in the Worker so it only ever fires once
-- per booking, no matter how many times the "edits settled" tickbox is
-- toggled on the client file.

alter table public.videography_bookings
  add column if not exists edits_complete_email_sent_at timestamptz;

comment on column public.videography_bookings.edits_complete_email_sent_at is
  'Set once the "your edits are all done" close-out email has gone out. Idempotency guard, not a workflow field.';
