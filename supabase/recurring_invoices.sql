-- Recurring invoices that aren't social media clients: the monthly checklist
-- (Admin > Invoicing > Monthly checklist) lists every active social client
-- automatically, and these alongside them. For example The Lettings Experts,
-- Prestige and The Property Experts, for their marketing assets and hub.
--
-- An invoice counts for a month when it went to match_email (the bill-to
-- address), wasn't raised from a booking, and, if match_text is set, has those
-- words somewhere in its lines or notes. Its month is its billing month, or
-- the month it was issued.
--
-- Read and written only through the Worker, by management: row level security
-- is on with no policies, so the browser can't reach it directly.

create table if not exists public.recurring_invoices (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  amount_pence  integer,
  match_email   text not null,
  match_text    text,
  start_month   text,               -- 'YYYY-MM'; months before it show as not due
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.recurring_invoices enable row level security;
