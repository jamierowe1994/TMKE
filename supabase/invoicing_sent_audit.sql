-- When an invoice was emailed, and to whom.
--
-- invoices already records sent_to, but not when - so "was TMKE1046 sent, and
-- when?" had no answer. The send also now writes a note on the account it
-- belongs to (booking_messages, kind 'audit'), and blind-copies our own
-- accounts address, so the same question is answerable three ways.
--
-- Additive and safe to re-run.
alter table public.invoices
  add column if not exists sent_at timestamptz;

comment on column public.invoices.sent_at is
  'When the invoice was last emailed. Set by the Worker on a successful send.';

-- Anything already marked sent, dated from when it was last changed: not exact,
-- but closer to the truth than nothing, and only where we have no date at all.
update public.invoices
   set sent_at = coalesce(updated_at, created_at)
 where sent_at is null and status in ('sent', 'paid') and sent_to is not null;
