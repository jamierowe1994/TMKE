-- Card payment on invoices (Stripe).
--
-- Some clients pay by Direct Debit, some are invoiced to another TEG brand, and
-- some want to pay by card. So this is per-invoice, not per-client: the person
-- raising the invoice decides whether it carries a Pay now link.
--
-- Nothing here holds a Stripe URL. Checkout Sessions expire after 24 hours,
-- which is useless on a 30-day invoice, so the emailed link points at the
-- Worker and a fresh session is minted when the client clicks it. We only keep
-- the last session id, for tracing a payment back.
--
-- Safe to re-run.

alter table public.invoices
  add column if not exists pay_by_card       boolean not null default false,
  add column if not exists stripe_session_id text,
  add column if not exists payment_ref       text;

-- Finding an invoice from a Stripe PaymentIntent when reconciling.
create index if not exists invoices_payment_ref_idx
  on public.invoices (payment_ref)
  where payment_ref is not null;
