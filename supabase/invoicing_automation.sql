-- Automatic invoicing (Danielle, 21 Oct 2026).
--
-- Three routes, run each morning by the Worker (runInvoiceAutomation):
--
--   Recurring     a recurring_invoices row with auto_send on is raised and
--                 sent on its day of the month, until it's stopped. No
--                 approval.
--   Videography   two days before a shoot, the invoice is drafted from the
--                 booking and emailed to Jack with Approve and Reject. Approve
--                 sends it to the client; Reject sends it back to Danielle
--                 with his notes, and "Send to Jack again" starts the next
--                 round.
--   Social media  (next) each month's invoice drafted and confirmed by Abbie
--                 the same way.
--
-- invoice_settings.automation_mode decides what happens:
--   off    nothing runs
--   test   drafts are made and every email goes to Danielle, labelled with
--          who it would have gone to; nothing reaches a client
--   live   for real
-- It starts off: switch it to Test in Admin > Invoicing > Approvals. Safe to re-run.

-- What a recurring invoice says and where it goes, so it can be raised
-- without anyone filling in the form.
alter table public.recurring_invoices
  add column if not exists bill_to_name     text,
  add column if not exists bill_to_email    text,      -- falls back to match_email
  add column if not exists cc_email         text,
  add column if not exists bill_to_address  text,
  add column if not exists line_items       jsonb,     -- [{description, qty, unit_pence}]; "(Month YYYY)" becomes the month
  add column if not exists frequency        text not null default 'monthly',  -- monthly | quarterly | 6monthly | yearly | oneoff
  add column if not exists day_of_month     integer,   -- 1-28
  add column if not exists end_month        text,      -- 'YYYY-MM', blank = until stopped
  add column if not exists terms_days       integer,
  add column if not exists pay_by_card      boolean not null default false,
  add column if not exists auto_send        boolean not null default false,
  add column if not exists notes            text;

alter table public.invoice_settings
  add column if not exists automation_mode  text not null default 'off';

-- One row per time an invoice is put to someone for approval.
create table if not exists public.invoice_approvals (
  id             uuid primary key default gen_random_uuid(),
  invoice_id     uuid not null references public.invoices(id) on delete cascade,
  kind           text not null,                       -- videography | social | recurring
  booking_id     uuid,
  approver_email text not null,
  status         text not null default 'pending',     -- pending | approved | rejected | superseded
  round          integer not null default 1,
  notes          text,                                -- why it was rejected
  requested_at   timestamptz not null default now(),
  reminded_at    timestamptz,
  escalated_at   timestamptz,
  decided_at     timestamptz,
  decided_by     text
);
create index if not exists invoice_approvals_invoice on public.invoice_approvals (invoice_id, requested_at desc);
create index if not exists invoice_approvals_pending on public.invoice_approvals (status) where status = 'pending';

-- Each thing the morning run has done, so it never does it twice.
create table if not exists public.invoice_automation_log (
  key        text primary key,      -- e.g. recurring:<id>:2026-11, video:<booking>:drafted
  detail     text,
  created_at timestamptz not null default now()
);

alter table public.invoice_approvals enable row level security;
alter table public.invoice_automation_log enable row level security;
drop policy if exists "invoice_approvals admin read" on public.invoice_approvals;
create policy "invoice_approvals admin read" on public.invoice_approvals for select to authenticated using (public.is_admin());
drop policy if exists "invoice_automation_log admin read" on public.invoice_automation_log;
create policy "invoice_automation_log admin read" on public.invoice_automation_log for select to authenticated using (public.is_admin());

notify pgrst, 'reload schema';
