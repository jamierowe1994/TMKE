-- TMKE — link a videography booking to its CRM contact
-- ---------------------------------------------------------------------------
-- Bookings taken through the public form already carry an email, so the Worker
-- can find (or make) the contact for them. Bookings Jack adds by hand often do
-- not - a phone call, a name and a date - and those have been sitting outside
-- the CRM with no way to join them up.
--
-- This is the join. Nullable on purpose: an unlinked booking is a normal state,
-- not a broken one, and `on delete set null` means removing a contact tidies
-- the link away without touching the shoot.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.videography_bookings
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

create index if not exists videography_bookings_contact_idx
  on public.videography_bookings (contact_id);

comment on column public.videography_bookings.contact_id is
  'The CRM contact this shoot belongs to. Set from the admin centre (Link contact on the booking card) or by the Worker when a booking comes in with an email. Null means nobody has joined it up yet.';
