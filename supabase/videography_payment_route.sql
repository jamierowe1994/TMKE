-- ============================================================
-- BEFORE YOU RUN THIS
-- ============================================================
-- This one is additive and safe: it only ADDS new, empty columns to
-- videography_bookings. Nothing is deleted, no existing booking changes, and
-- no permissions change — so it can't lock anyone out.
--
-- Every existing booking is treated as "the agent pays by card", which is how
-- things worked before today, so nothing in flight is disturbed.
--
-- Run it in the Supabase SQL editor. Safe to re-run.
-- ============================================================
--
-- WHAT IT'S FOR
-- Until now a booking never recorded WHO PAYS. Everyone signed the same
-- agreement — the agent pays by card, and their content is released once the
-- payment clears.
--
-- Fine & Country agents often charge the seller a marketing fee, and that fee
-- goes to Fine & Country rather than to the agent. In that case TMKE invoices
-- Fine & Country instead of taking card payment from the agent.
--
-- So at booking an F&C agent is asked whether a marketing fee has been charged.
-- Yes  → invoice Fine & Country  (a different agreement applies)
-- No   → the agent pays by card  (the existing agreement applies)
--
-- Because an agent could say "yes" when it isn't true, Jack confirms it with
-- Fine & Country before the shoot. That confirmation does NOT block the shoot
-- going ahead — but the preview / payment email CANNOT be sent until it's
-- either confirmed, or the booking has been switched back to card payment.

alter table public.videography_bookings
  -- Who settles this booking.
  --   agent_card    — the agent pays by card (Stripe). The default, and what
  --                   every booking before today was.
  --   brand_invoice — TMKE invoices the brand (today: Fine & Country) out of
  --                   the marketing fee the seller has already paid.
  add column if not exists payment_route text not null default 'agent_card',

  -- The agent's own answer to the marketing-fee question at booking.
  -- NULL means they were never asked (i.e. not an F&C agent). Kept separate
  -- from payment_route so we always know what the AGENT claimed, even if the
  -- booking is later switched to card payment.
  add column if not exists marketing_fee_claimed boolean,

  -- Jack's confirmation with Fine & Country that the fee is real.
  -- Gates the preview / payment email, not the shoot.
  add column if not exists brand_fee_confirmed boolean not null default false,
  add column if not exists brand_fee_confirmed_at timestamptz,
  add column if not exists brand_fee_confirmed_by text,

  -- Which entry in the invoice address book this gets billed to. Left empty
  -- until Jack picks it at send time — F&C have more than one billing address
  -- and which one applies depends on where the agent sits.
  add column if not exists invoice_recipient_id uuid;

-- Only the two routes are valid. Added separately (not inline) so re-running
-- the file doesn't error on an existing constraint.
alter table public.videography_bookings
  drop constraint if exists videography_bookings_payment_route_check;
alter table public.videography_bookings
  add constraint videography_bookings_payment_route_check
  check (payment_route in ('agent_card', 'brand_invoice'));

-- Link to the invoice address book (supabase/invoicing.sql). ON DELETE SET NULL
-- so removing a billing contact never destroys booking history.
alter table public.videography_bookings
  drop constraint if exists videography_bookings_invoice_recipient_fk;
alter table public.videography_bookings
  add constraint videography_bookings_invoice_recipient_fk
  foreign key (invoice_recipient_id)
  references public.invoice_recipients(id) on delete set null;

-- Jack's queue: brand-invoiced shoots still waiting on Fine & Country.
create index if not exists videography_bookings_awaiting_brand_idx
  on public.videography_bookings (payment_route, brand_fee_confirmed)
  where payment_route = 'brand_invoice' and brand_fee_confirmed = false;

-- ============================================================
-- THE DELIVERY GATE, in one place
--
-- A booking may have its preview / payment email sent when:
--     payment_route = 'agent_card'
--  OR (payment_route = 'brand_invoice' and brand_fee_confirmed = true)
--
-- Enforced in the Worker at send time. This view is the readable version of
-- that rule, so the admin UI and the Worker can't drift apart.
-- ============================================================
create or replace view public.videography_bookings_deliverable as
  select
    id,
    payment_route,
    brand_fee_confirmed,
    (payment_route = 'agent_card'
     or (payment_route = 'brand_invoice' and brand_fee_confirmed)) as can_send_preview
  from public.videography_bookings;

-- ============================================================
-- Check it worked:
--   select payment_route, count(*) from public.videography_bookings
--   group by payment_route;
-- Expect every existing booking under 'agent_card'.
-- ============================================================
