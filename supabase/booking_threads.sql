-- TMKE — booking correspondence + documents
-- Run in the Supabase SQL editor (after the tables that hold bookings exist).
--
-- Adds two per-booking stores that power the member "Bookings" detail view:
--   * booking_messages   — the correspondence thread (automated confirmations
--                          the Worker sends, plus manual notes admin posts).
--   * booking_documents  — files attached to a booking (agreement, prep doc,
--                          invoice, delivered assets), stored in R2.
--
-- A booking can live in either `videography_bookings` or `smm_leads`, so
-- booking_id is a plain uuid + `booking_source` disambiguates (no cross-table FK).
--
-- Security model:
--   * Members SELECT only their own rows (by linked account, or by the email
--     on the booking before their account is linked).
--   * All writes go through the Worker with the service role (which bypasses
--     RLS) — the automated confirmations and the admin "add message"/"upload"
--     tools. There is deliberately no member/authenticated write policy, so a
--     signed-in member can never forge correspondence on a booking.

create extension if not exists "pgcrypto";

-- ============================================================
-- booking_messages — correspondence shown under a booking
-- ============================================================
create table if not exists public.booking_messages (
  id              uuid primary key default gen_random_uuid(),

  -- Which booking this belongs to (see booking_source for the table).
  booking_id      uuid not null,
  booking_source  text not null default 'videography'
                  check (booking_source in ('videography', 'smm')),

  -- Owner resolution: prefer the linked auth user, fall back to the booking email.
  account_user_id uuid references auth.users(id) on delete set null,
  client_email    text,

  direction       text not null default 'outbound'
                  check (direction in ('outbound', 'inbound')),
  channel         text not null default 'email'
                  check (channel in ('email', 'note', 'system')),
  -- confirmation | reschedule | cancellation | manual | ...
  kind            text,
  subject         text,
  body            text,

  is_automated    boolean not null default true,
  created_by      text,                       -- 'system' or an admin email
  created_at      timestamptz not null default now()
);

create index if not exists booking_messages_booking_idx on public.booking_messages (booking_id);
create index if not exists booking_messages_user_idx    on public.booking_messages (account_user_id);
create index if not exists booking_messages_email_idx    on public.booking_messages (lower(client_email));

alter table public.booking_messages enable row level security;

-- Members read only their own correspondence (by account or by booking email).
drop policy if exists "booking_messages read own" on public.booking_messages;
create policy "booking_messages read own"
  on public.booking_messages for select
  to anon, authenticated
  using (
    account_user_id = auth.uid()
    or lower(client_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
-- (No member write policies — the Worker service role does all inserts.)

-- ============================================================
-- booking_documents — files attached to a booking (stored in R2)
-- ============================================================
create table if not exists public.booking_documents (
  id              uuid primary key default gen_random_uuid(),

  booking_id      uuid not null,
  booking_source  text not null default 'videography'
                  check (booking_source in ('videography', 'smm')),

  account_user_id uuid references auth.users(id) on delete set null,
  client_email    text,

  -- agreement | prep | invoice | delivery | other
  category        text not null default 'other'
                  check (category in ('agreement', 'prep', 'invoice', 'delivery', 'other')),
  title           text,                       -- friendly label; falls back to file_name
  file_name       text not null,
  r2_key          text not null,              -- object key in the R2 bucket
  content_type    text,
  size_bytes      bigint,

  uploaded_by     text,                       -- 'system' or an admin email
  created_at      timestamptz not null default now()
);

create index if not exists booking_documents_booking_idx on public.booking_documents (booking_id);
create index if not exists booking_documents_user_idx    on public.booking_documents (account_user_id);
create index if not exists booking_documents_email_idx    on public.booking_documents (lower(client_email));

alter table public.booking_documents enable row level security;

-- Members read only their own documents; the file itself downloads through an
-- ownership-checked Worker endpoint (the R2 bucket is not public).
drop policy if exists "booking_documents read own" on public.booking_documents;
create policy "booking_documents read own"
  on public.booking_documents for select
  to anon, authenticated
  using (
    account_user_id = auth.uid()
    or lower(client_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
-- (No member write policies — the Worker service role does all inserts.)
