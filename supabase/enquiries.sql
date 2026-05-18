-- TMKE — contact form enquiries
-- Run AFTER schema.sql in the Supabase SQL editor.
--
-- One row per submission of the /contact form.
-- Anon users can INSERT (so unauthenticated visitors can submit the form)
-- but only authenticated (admin) users can read, update, or delete.

create extension if not exists "pgcrypto";

create table if not exists public.enquiries (
  id              uuid primary key default gen_random_uuid(),

  first_name      text not null,
  last_name       text not null,
  phone           text,
  email           text not null,
  business_name   text,
  industry        text,
  message         text,

  -- Workflow status the admin moves the row through.
  status          text not null default 'new'
                  check (status in ('new', 'replied', 'closed', 'spam')),
  -- Optional internal note from the admin.
  notes           text,
  -- Free-text source label (page, campaign, etc). Defaults to 'contact_form'.
  source          text not null default 'contact_form',

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists enquiries_status_created_idx
  on public.enquiries (status, created_at desc);
create index if not exists enquiries_created_at_idx
  on public.enquiries (created_at desc);
create index if not exists enquiries_email_idx
  on public.enquiries (lower(email));

-- Touch updated_at on every update
drop trigger if exists enquiries_set_updated_at on public.enquiries;
create trigger enquiries_set_updated_at
  before update on public.enquiries
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.enquiries enable row level security;

-- Anon may insert (form submission) but only with a non-empty email + name.
drop policy if exists "enquiries insert anon" on public.enquiries;
create policy "enquiries insert anon"
  on public.enquiries for insert
  to anon, authenticated
  with check (
    length(coalesce(first_name, '')) > 0
    and length(coalesce(last_name, '')) > 0
    and length(coalesce(email, '')) > 3
  );

-- Only admins (authenticated) can read.
drop policy if exists "enquiries read authed" on public.enquiries;
create policy "enquiries read authed"
  on public.enquiries for select
  to authenticated
  using (true);

drop policy if exists "enquiries update authed" on public.enquiries;
create policy "enquiries update authed"
  on public.enquiries for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "enquiries delete authed" on public.enquiries;
create policy "enquiries delete authed"
  on public.enquiries for delete
  to authenticated
  using (true);
