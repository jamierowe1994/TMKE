-- The accounts portal, and Revenue's costs (Dani, 5-6 Nov 2026; agreed on the
-- mock-up).
--
-- accounts_portal  one row: the private link and passcode for the page where
--                  Paula's team confirm invoices (tmke.co.uk/accounts), plus who
--                  gets the month-end email and whether it goes by itself.
-- invoices         what accounts said about each invoice, and which sector its
--                  money goes under when nothing else says.
-- revenue_costs    a base for each sector, and any month that differs.
-- revenue_rules    where each kind of money goes, when it's been changed.
--
-- The accounts page never reads these tables: it goes through the Worker
-- (/accounts-portal/*), which checks the passcode. Only management can read them
-- here. Run in the Supabase SQL editor. Safe to run twice.

create table if not exists public.accounts_portal (
  id             integer primary key default 1 check (id = 1),
  enabled        boolean not null default true,
  token          text not null unique check (length(token) >= 24),
  passcode       text not null check (passcode ~ '^[A-Z0-9]{6,12}$'),
  failed_tries   integer not null default 0,
  locked_until   timestamptz,
  last_opened_at timestamptz,
  email_to       text not null default 'Paula@newman.uk.com',
  emails_on      boolean not null default false,   -- the 20th and 28th; off until Dani has tested it
  updated_at     timestamptz not null default now(),
  updated_by     text
);
insert into public.accounts_portal (id, token, passcode)
values (1,
        replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
        upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)))
on conflict (id) do nothing;

alter table public.invoices
  add column if not exists accounts_note      text,                         -- a note both sides can see
  add column if not exists accounts_not_paid  text,                         -- accounts marked it not paid, and why
  add column if not exists accounts_marked_at timestamptz,                  -- accounts confirmed it paid or settled
  add column if not exists accounts_reminders jsonb not null default '[]',  -- dates we emailed accounts about it
  add column if not exists sector             text;                         -- social | video | studio | agent, when chosen by hand

create table if not exists public.revenue_costs (
  kind        text not null check (kind in ('base', 'month')),
  month       text not null check (month ~ '^\d{4}-\d{2}$'),  -- base: applies from this month ('0000-00' = always)
  sector      text not null check (sector in ('social', 'video', 'studio', 'agent')),
  staff_pence integer,
  tech_pence  integer,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  primary key (kind, month, sector)
);

create table if not exists public.revenue_rules (
  source     text primary key,
  sector     text not null check (sector in ('social', 'video', 'studio', 'agent', 'pick')),
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.accounts_portal enable row level security;
alter table public.revenue_costs   enable row level security;
alter table public.revenue_rules   enable row level security;

drop policy if exists "accounts portal management" on public.accounts_portal;
create policy "accounts portal management" on public.accounts_portal for all to authenticated
  using (public.is_management()) with check (public.is_management());
drop policy if exists "revenue costs management" on public.revenue_costs;
create policy "revenue costs management" on public.revenue_costs for all to authenticated
  using (public.is_management()) with check (public.is_management());
drop policy if exists "revenue rules management" on public.revenue_rules;
create policy "revenue rules management" on public.revenue_rules for all to authenticated
  using (public.is_management()) with check (public.is_management());

-- What this should say: the portal's row is there, and the five new invoice columns.
select (select count(*) from public.accounts_portal) as portal_rows,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'invoices'
           and column_name in ('accounts_note', 'accounts_not_paid', 'accounts_marked_at', 'accounts_reminders', 'sector')) as new_invoice_columns;
