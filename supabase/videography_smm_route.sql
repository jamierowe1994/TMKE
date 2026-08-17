-- ============================================================
-- A fourth payment route: shoots covered by a social media package
-- ============================================================
-- Additive and safe to re-run.
--
-- SMM clients get shoots as part of their monthly package. The booking is
-- real, Jack works it through the admin centre exactly like any other, and the
-- gallery is theirs — the only difference is that the money arrived through
-- the package rather than an invoice.
--
-- Until now there was nowhere to say that. payment_route offered only
-- agent_card and the two brand-invoice routes, and everything that releases
-- work to a client tests paid_at. So a package client would sit behind a
-- paywall for a shoot they had already paid for.
--
-- This adds the route. The paid test everywhere becomes:
--
--     paid_at is not null  or  payment_route = 'smm_package'
--
-- Two consequences worth knowing about, both handled in the Worker:
--   · The unpaid-invoice chase must skip this route, or package clients get
--     reminders for money that already arrived.
--   · The member hub shows "Included in your social media package" here
--     instead of an invoice and a pay button.
-- ============================================================

alter table public.videography_bookings
  drop constraint if exists videography_bookings_payment_route_check;

alter table public.videography_bookings
  add constraint videography_bookings_payment_route_check
  check (payment_route in ('agent_card', 'brand_invoice', 'brand_invoice_teg', 'smm_package'));

comment on column public.videography_bookings.payment_route is
  'Who settles this booking: agent_card (the client, by card), brand_invoice '
  '(Fine & Country), brand_invoice_teg (a TEG brand), or smm_package (covered '
  'by the client''s social media management package — nothing to invoice).';

-- teg_brand and teg_reason are reused by this route rather than duplicated:
-- the brand list is the same, and the reason is the single option
-- "Included in the SMM package" (SMM_REASON in src/lib/videography-config.js),
-- shown only when this route is selected.
