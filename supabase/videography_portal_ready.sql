-- Content ready on a shoot delivered by client portal (Dani, 6 Nov 2026): its own
-- No or Yes, saved by a person, and No until then. A folder delivered by portal
-- can't show until this is Yes.
--
-- Adds two columns, empty on every shoot, so every shoot reads No. Sends nothing
-- and is safe to run twice. Run it in the Supabase SQL editor.
alter table public.videography_bookings
  add column if not exists portal_ready_at timestamptz,
  add column if not exists portal_ready_by text;

-- What this lists: every shoot set to Client portal. If one has a date under
-- gallery_sent_at that you didn't expect, it moved itself on before this fix, so
-- check whether its folder was shown and who was emailed.
select client_name, service, stage, amount_pence, gallery_sent_at, paid_at, released_unpaid_at, portal_ready_at
  from public.videography_bookings
 where delivery_method = 'portal'
 order by created_at desc;
