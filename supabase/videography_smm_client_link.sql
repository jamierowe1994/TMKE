-- ============================================================
-- Videography ↔ social media client
-- ============================================================
-- Additive and safe to re-run.
--
-- A shoot booked under the SMM route belongs to a social media client, but
-- nothing recorded WHICH one — so the footage and the content plan it feeds
-- had no connection in the data. This is that link.
--
-- Keyed on the id rather than matched on email on purpose: the person who
-- arranges a shoot is often not the address on the SMM account (an office
-- manager books, the account sits with the owner), so email-matching would
-- quietly mis-link or silently fail.
--
-- Nullable and unconstrained by route: a booking can be linked before its
-- route is settled, and un-linking is just setting it back to null. `on delete
-- set null` so removing a client never takes a shoot's history with it.
-- ============================================================

alter table public.videography_bookings
  add column if not exists smm_lead_id uuid
    references public.smm_leads(id) on delete set null;

comment on column public.videography_bookings.smm_lead_id is
  'The social media client this shoot belongs to. Null for shoots that are not SMM work.';

-- Every read is "the bookings for this client", so the index matches that.
create index if not exists videography_bookings_smm_lead_id_idx
  on public.videography_bookings (smm_lead_id)
  where smm_lead_id is not null;

-- ============================================================
-- Check it worked:
--   select column_name from information_schema.columns
--   where table_name = 'videography_bookings' and column_name = 'smm_lead_id';
-- ============================================================
