-- Monthly invoicing checklist, part two. Notes: a note on one client's month in the checklist (Admin >
-- Invoicing > Monthly checklist): "Not charged in October", "Paid with
-- September's", and so on. With skip on, nothing is due that month: the cell
-- shows as not due and the 14th/21st reminder leaves it out.
--
-- row_kind says which list the row is from: 'social' (row_id is the
-- smm_leads id) or 'recurring' (row_id is the recurring_invoices id).
-- Read and written only through the Worker, by management: row level
-- security is on with no policies.

create table if not exists public.invoice_month_notes (
  id          uuid primary key default gen_random_uuid(),
  row_kind    text not null check (row_kind in ('social', 'recurring')),
  row_id      uuid not null,
  month       text not null,        -- 'YYYY-MM'
  note        text,
  skip        boolean not null default false,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  unique (row_kind, row_id, month)
);

alter table public.invoice_month_notes enable row level security;

-- The sure link from an invoice to a recurring invoice on the checklist, set
-- when it's raised with "Recurring invoice" chosen (or from the checklist's
-- Raise button). Without it, a recurring invoice is matched by the address
-- the invoice went to.
alter table public.invoices add column if not exists recurring_id uuid;
create index if not exists invoices_recurring_idx on public.invoices (recurring_id, billing_month);
