-- ============================================================
-- BEFORE YOU RUN THIS
-- ============================================================
-- Additive and safe: it only ADDS new, empty columns to videography_bookings
-- and widens the payment_route check constraint to allow one more value.
-- Nothing is deleted, no existing booking changes, no permissions change.
--
-- Run AFTER supabase/videography_payment_route.sql and
-- supabase/videography_fc_office.sql. Safe to re-run.
-- ============================================================
--
-- WHAT IT'S FOR
--
-- Fine & Country isn't the only brand that settles a shoot instead of the
-- client. The Expert's Group (TEG) sister brands do too - most often a new
-- starter's induction shoot, already paid for as part of their induction
-- package, but also brand events and brand marketing content.
--
-- Unlike F&C there's no seller's marketing fee to confirm with an office, so
-- this gets its own, simpler payment_route value rather than being folded
-- into 'brand_invoice' - a TEG booking never needs Jack to email anyone or
-- tick a confirmation before the invoice can go out. It just needs to know
-- which brand, and why, so the invoice is billed and worded correctly.

alter table public.videography_bookings
  -- Which TEG brand is settling this booking. Matches a key in TEG_BRANDS
  -- (src/lib/videography-config.js). 'other' pairs with teg_brand_other.
  add column if not exists teg_brand text,
  add column if not exists teg_brand_other text,

  -- Why TMKE is invoicing the brand rather than the client. Matches a key in
  -- TEG_REASONS. 'other' pairs with teg_reason_other. Drives the wording on
  -- the invoice covering email.
  add column if not exists teg_reason text,
  add column if not exists teg_reason_other text;

-- Add 'brand_invoice_teg' alongside the existing two routes. Dropped and
-- re-added rather than altered in place, so re-running this file never
-- errors on an existing constraint.
alter table public.videography_bookings
  drop constraint if exists videography_bookings_payment_route_check;
alter table public.videography_bookings
  add constraint videography_bookings_payment_route_check
  check (payment_route in ('agent_card', 'brand_invoice', 'brand_invoice_teg'));

comment on column public.videography_bookings.teg_brand is
  'Which TEG brand is settling this booking (key into TEG_BRANDS). NULL unless payment_route = brand_invoice_teg.';
comment on column public.videography_bookings.teg_brand_other is
  'Free-text brand name when teg_brand = other.';
comment on column public.videography_bookings.teg_reason is
  'Why TMKE is invoicing the brand rather than the client (key into TEG_REASONS). Drives the invoice wording.';
comment on column public.videography_bookings.teg_reason_other is
  'Free-text reason when teg_reason = other.';

-- ============================================================
-- Check it worked:
--   select payment_route, count(*) from public.videography_bookings
--   group by payment_route;
-- Expect a third row, 'brand_invoice_teg', once the new option is used.
-- ============================================================
