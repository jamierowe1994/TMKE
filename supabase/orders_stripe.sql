-- TMKE — Stripe (hosted Checkout) additions to the orders table.
-- Run AFTER orders.sql in the Supabase SQL editor. Safe to run repeatedly.
--
-- The Worker creates a `pending` order, opens a Stripe Checkout Session, and
-- the Stripe webhook flips it to `paid` with the PaymentIntent id in
-- payment_ref. We also store the Checkout Session id for reconciliation.

alter table public.orders
  add column if not exists stripe_session_id text;

create index if not exists orders_stripe_session_idx
  on public.orders (stripe_session_id);

-- Abandoned-setup reminder: stamped when the Worker has emailed a buyer who
-- paid but never created a password (orders.user_id still null). Stops re-sends.
alter table public.orders
  add column if not exists setup_reminder_sent_at timestamptz;

-- Speeds up the cron query (paid + no linked account + not yet reminded).
create index if not exists orders_setup_pending_idx
  on public.orders (created_at)
  where status = 'paid' and user_id is null and setup_reminder_sent_at is null;

-- status already allows 'pending' and payment_method already allows 'card'
-- (see orders.sql), so no constraint changes are needed here.
--
-- NOTE (future hardening): orders are now created by the Worker with the
-- service role, so the permissive anon INSERT policy in orders.sql is no longer
-- required by the live flow. Leave it for now (the admin "Gift a pack" tool and
-- the dev stub still use a direct insert); drop "orders insert anon" once those
-- also route through the Worker.
