-- ============================================================================
-- TMKE Videography — invoicing (standalone invoice builder).
--
-- Three tables:
--   • invoice_settings  — one row of company/finance details for every invoice
--                         (legal entity, VAT, bank, the accounts-dept CC, the
--                         invoice-number sequence, payment terms).
--   • invoice_recipients — the address book of partners we bill (Fine & Country
--                         offices, TPE finance, etc.).
--   • invoices          — a raised invoice (draft → sent → paid), with jsonb line
--                         items pulled from the videography pricing, optionally
--                         linked to a booking.
--
-- Admin-only (public.is_admin()). The Worker reads/writes with the service role.
-- Run AFTER supabase/admins.sql. Safe to re-run (idempotent).
-- ============================================================================

-- ---- Company / finance settings (single row, id = 1) -----------------------
create table if not exists public.invoice_settings (
  id                 integer primary key default 1,
  company_name       text,
  company_address    text,
  company_reg_no     text,
  vat_number         text,
  vat_rate           numeric not null default 20,     -- percent
  bank_name          text,
  account_name       text,
  sort_code          text,
  account_number     text,
  payment_terms_days integer not null default 14,
  invoice_prefix     text default 'TMKE-',
  next_number        integer not null default 1001,   -- next invoice number to issue
  accounts_cc_email  text,                             -- accounts dept, CC'd on every invoice
  footer_note        text,
  updated_at         timestamptz not null default now(),
  constraint invoice_settings_singleton check (id = 1)
);
insert into public.invoice_settings (id) values (1) on conflict (id) do nothing;

-- ---- Address book of billable partners -------------------------------------
create table if not exists public.invoice_recipients (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,          -- e.g. "Fine & Country — Rugby", "The Property Experts (finance)"
  contact_name text,
  email        text not null,
  address      text,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ---- Invoices --------------------------------------------------------------
create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  number         text unique,                 -- assigned on issue (prefix + next_number)
  booking_id     uuid,                         -- videography_bookings.id (nullable)
  booking_source text default 'videography',
  recipient_id   uuid references public.invoice_recipients(id) on delete set null,
  bill_to_name   text,                         -- snapshot of who it was billed to at send time
  bill_to_email  text,
  bill_to_address text,
  line_items     jsonb not null default '[]',  -- [{ description, qty, unit_pence }]
  subtotal_pence integer not null default 0,
  vat_pence      integer not null default 0,
  total_pence    integer not null default 0,
  status         text not null default 'draft',-- draft | sent | paid | void
  issued_date    date,
  due_date       date,
  paid_date      date,
  sent_to        text,
  cc_email       text,
  notes          text,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists invoices_booking_idx on public.invoices (booking_id);
create index if not exists invoices_status_idx  on public.invoices (status, created_at desc);

-- ---- updated_at touch triggers ---------------------------------------------
create or replace function public.touch_invoicing()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_touch_invoice_settings on public.invoice_settings;
create trigger trg_touch_invoice_settings before update on public.invoice_settings
  for each row execute function public.touch_invoicing();
drop trigger if exists trg_touch_invoices on public.invoices;
create trigger trg_touch_invoices before update on public.invoices
  for each row execute function public.touch_invoicing();

-- ---- RLS — admin only (Worker uses the service role, which bypasses RLS) ----
alter table public.invoice_settings   enable row level security;
alter table public.invoice_recipients enable row level security;
alter table public.invoices           enable row level security;
drop policy if exists "invoice_settings admin"   on public.invoice_settings;
drop policy if exists "invoice_recipients admin" on public.invoice_recipients;
drop policy if exists "invoices admin"           on public.invoices;
create policy "invoice_settings admin"   on public.invoice_settings   for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "invoice_recipients admin" on public.invoice_recipients for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "invoices admin"           on public.invoices           for all to authenticated using (public.is_admin()) with check (public.is_admin());
