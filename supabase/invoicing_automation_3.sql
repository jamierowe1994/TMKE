-- Social media invoices: Abbie ticks a monthly list (Danielle, 22 Oct 2026).
--
-- Instead of an email per invoice, Abbie opens Social media > Settings >
-- Monthly invoices: every social media client on the invoice schedule with
-- their fee, this month and next, and ticks the ones to invoice, then
-- confirms the month. She's emailed on the 1st; on the 4th, if the month
-- isn't confirmed, she and Danielle are both reminded. On the 5th the ticked
-- ones are raised and sent; anyone unticked isn't invoiced that month.
--
--   recurring_month_approvals   a tick: this client, this month, invoice them
--   social_invoice_months       the month confirmed, by whom and when
--
-- Social media rows no longer go to Abbie one at a time, so their approver is
-- cleared. Safe to re-run.

create table if not exists public.recurring_month_approvals (
  recurring_id uuid not null references public.recurring_invoices(id) on delete cascade,
  month        text not null,             -- 'YYYY-MM'
  approved     boolean not null default true,
  updated_by   text,
  updated_at   timestamptz not null default now(),
  primary key (recurring_id, month)
);

create table if not exists public.social_invoice_months (
  month        text primary key,          -- 'YYYY-MM'
  confirmed_by text,
  confirmed_at timestamptz not null default now()
);

alter table public.recurring_month_approvals enable row level security;
alter table public.social_invoice_months enable row level security;
drop policy if exists "recurring_month_approvals admin read" on public.recurring_month_approvals;
create policy "recurring_month_approvals admin read" on public.recurring_month_approvals for select to authenticated using (public.is_admin());
drop policy if exists "social_invoice_months admin read" on public.social_invoice_months;
create policy "social_invoice_months admin read" on public.social_invoice_months for select to authenticated using (public.is_admin());

update public.recurring_invoices set approver_email = null where kind = 'social';

notify pgrst, 'reload schema';
