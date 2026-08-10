-- ============================================================
-- Invoice due-date reminder, and the overdue alert
-- ============================================================
-- Additive and safe to re-run.
--
-- Two columns so each email sends once and never repeats:
--
--   due_reminder_sent_at  the client was reminded on the due date
--   overdue_alerted_at    Danielle and Jack were told it went past due
--
-- Both are on `invoices` rather than on a booking, because an invoice is what
-- is actually overdue - and this then covers social media management invoices
-- as well as shoots, without a second implementation.
--
-- Direct Debit invoices are excluded in the code, not here: those are internal
-- reminders to our own accounts team, and chasing a client who pays by DD for
-- money that is already collected would be worse than not chasing at all.
-- ============================================================

alter table public.invoices
  add column if not exists due_reminder_sent_at timestamptz,
  add column if not exists overdue_alerted_at   timestamptz;

-- Finding what needs chasing: unpaid, with a due date, not yet chased.
create index if not exists invoices_due_chase_idx
  on public.invoices (due_date)
  where status = 'sent' and due_date is not null;
