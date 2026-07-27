-- ============================================================
-- BEFORE YOU RUN THIS
-- ============================================================
-- Safe and additive. It adds new empty columns to contacts and creates one new
-- table. Nothing is deleted, no existing contact changes, no permissions
-- change, and no email behaviour changes just from running it.
--
-- Every existing contact comes out as: not unsubscribed, not suppressed, zero
-- bounces — i.e. exactly as they are today.
--
-- Run it in the Supabase SQL editor. Safe to re-run.
-- ============================================================
--
-- WHAT IT'S FOR
-- Two jobs:
--   1. Let the CRM record who has unsubscribed and whose address is a dead end,
--      so marketing email can be withheld from them.
--   2. Keep a log of what happened to every email — delivered, opened, clicked,
--      bounced, complained — so open and click rates can be reported on.
--
-- See docs/email-suppression-plan.md for the whole picture.

-- ============================================================
-- 1. Consent + suppression on contacts
--
-- Three separate ideas, kept apart on purpose:
--   marketing_opt_in  (already exists) — did they ever say yes?
--   unsubscribed      — they asked us to stop. A choice; never quietly undone.
--   suppressed        — the address itself is a dead end. A technical fact,
--                       which can legitimately change (a full mailbox is
--                       emptied), so it must be clearable without touching
--                       their unsubscribe choice.
-- ============================================================
alter table public.contacts
  -- They asked to stop receiving marketing.
  add column if not exists unsubscribed_at    timestamptz,
  -- How: 'footer_link' | 'list_unsubscribe' (the Gmail/Outlook button)
  --      | 'spam_complaint' | 'admin' | 'import'
  add column if not exists unsubscribe_source text,

  -- The address is undeliverable or has complained.
  add column if not exists suppressed_at      timestamptz,
  add column if not exists suppression_reason text,

  -- Consecutive soft bounces. Reset to 0 on any successful delivery.
  -- At 3 (SOFT_BOUNCE_LIMIT in the Worker) the contact is suppressed with
  -- reason 'repeated_soft_bounce'.
  add column if not exists soft_bounce_count  integer not null default 0,

  -- The most recent delivery event, for the contact card.
  add column if not exists last_email_event   jsonb;

alter table public.contacts
  drop constraint if exists contacts_suppression_reason_check;
alter table public.contacts
  add constraint contacts_suppression_reason_check
  check (suppression_reason is null or suppression_reason in (
    'hard_bounce', 'spam_complaint', 'resend_suppressed', 'repeated_soft_bounce', 'admin'
  ));

-- Finding who may be emailed is the hottest query in a campaign send.
create index if not exists contacts_mailable_idx
  on public.contacts (marketing_opt_in)
  where unsubscribed_at is null and suppressed_at is null;

create index if not exists contacts_suppressed_idx
  on public.contacts (suppressed_at desc) where suppressed_at is not null;
create index if not exists contacts_unsubscribed_idx
  on public.contacts (unsubscribed_at desc) where unsubscribed_at is null is false;

-- ============================================================
-- 2. Email event log — the basis for open/click reporting
--
-- One row per thing that happened to one email. Written by the Resend webhook
-- (and by the send gate when it refuses to send, so "why didn't they get it"
-- has an answer).
-- ============================================================
create table if not exists public.email_events (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid references public.contacts(id) on delete set null,
  email       text not null,

  -- sent | delivered | delivery_delayed | opened | clicked | bounced
  -- | complained | suppressed | unsubscribed | blocked
  --
  -- 'blocked' is ours, not Resend's: we refused to send. The reason lands in
  -- `detail`, so a campaign that reached fewer people than expected can explain
  -- itself.
  event       text not null,

  provider    text not null default 'resend',   -- resend | m365 | internal
  message_id  text,                             -- provider's id, to tie events together
  subject     text,
  url         text,                             -- the link, for 'clicked'
  detail      text,                             -- bounce reason, or why we blocked
  raw         jsonb,                            -- the untouched payload, for audit
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists email_events_contact_idx  on public.email_events (contact_id, occurred_at desc);
create index if not exists email_events_email_idx    on public.email_events (lower(email), occurred_at desc);
create index if not exists email_events_event_idx    on public.email_events (event, occurred_at desc);
create index if not exists email_events_message_idx  on public.email_events (message_id);

-- Resend can retry a webhook, and duplicate rows would inflate open rates.
-- One row per (message, event, url) — url is in the key so two clicks on two
-- different links both count, but the same link reported twice doesn't.
create unique index if not exists email_events_dedupe_idx
  on public.email_events (message_id, event, coalesce(url, ''))
  where message_id is not null;

-- ============================================================
-- 3. Locked to admins, same as contacts.
--
-- The Worker uses the service role, which bypasses RLS, so the webhook and the
-- send gate are unaffected. See supabase/admin_tables_rls.sql.
-- ============================================================
alter table public.email_events enable row level security;
drop policy if exists "email_events admin" on public.email_events;
create policy "email_events admin"
  on public.email_events for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 4. Reporting view — open and click rates per campaign send.
-- Counts DISTINCT contacts, so one person opening six times is one open.
-- ============================================================
create or replace view public.email_event_summary as
  select
    date_trunc('day', occurred_at)                                    as day,
    subject,
    count(*) filter (where event = 'sent')                            as sent,
    count(*) filter (where event = 'delivered')                       as delivered,
    count(distinct contact_id) filter (where event = 'opened')        as opened_unique,
    count(distinct contact_id) filter (where event = 'clicked')       as clicked_unique,
    count(*) filter (where event = 'bounced')                         as bounced,
    count(*) filter (where event = 'complained')                      as complained,
    count(*) filter (where event = 'blocked')                         as blocked
  from public.email_events
  group by 1, 2;

-- ============================================================
-- Check it worked:
--   select count(*) from public.contacts where suppressed_at is not null;
--     → 0, since nothing has been suppressed yet
--   select * from public.email_event_summary limit 1;
--     → no rows yet, but the view should exist
-- ============================================================
