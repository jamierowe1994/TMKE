-- ============================================================
-- The property address
-- ============================================================
-- Additive and safe to re-run.
--
-- WHY THIS DIDN'T EXIST
-- The booking flow asks the client for a POSTCODE only, and it asks for it to
-- work out travel - not to record where the shoot is. `location` is a free-text
-- admin field that has been used for the town.
--
-- Neither is enough for a Fine & Country invoice, which is billed to the office
-- rather than the agent and therefore has to say on its face which property the
-- work was for.
--
-- NOTE this is not collected by the public booking flow, so a client-made
-- booking will have it empty until someone fills it in. Worth adding to that
-- flow for property shoots - see docs/videography-delivery-process.md.
-- ============================================================

alter table public.videography_bookings
  add column if not exists property_address text;

comment on column public.videography_bookings.property_address is
  'Full address of the property being shot. Distinct from postcode (travel) and location (free-text).';
