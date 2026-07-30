-- ============================================================
-- Marketing consent: an audit trail, not just a flag
--
-- `contacts.marketing_opt_in` answers one question — "may we email them?" — and
-- nothing else. Not when they agreed, not how, not on what basis. The
-- unsubscribe side already records its provenance (`unsubscribed_at` +
-- `unsubscribe_source`, see email_consent_and_events.sql), so today we can prove
-- exactly how someone left and nothing at all about how they arrived. That
-- asymmetry is the gap this closes.
--
-- Item 4 of the nine outstanding email items in
-- docs/email-suppression-plan.md.
--
-- Run once in the Supabase SQL editor. Additive and idempotent — it adds a
-- table and backfills it, and changes no existing behaviour.
-- ============================================================

-- ============================================================
-- 1. The event log
--
-- One row per time consent changed. Append-only by convention: rows are never
-- updated or deleted, because a consent record that can be edited is not
-- evidence.
-- ============================================================
create table if not exists public.contact_consent_events (
  id          uuid primary key default gen_random_uuid(),

  -- set null (not cascade) on purpose: if a contact is deleted we still want to
  -- be able to answer "why was this address ever emailed?", which is precisely
  -- the question asked after someone has been removed.
  contact_id  uuid references public.contacts(id) on delete set null,
  email       text not null,

  -- opted_in | opted_out
  action      text not null,

  -- WHY we believe we may email them. The distinction matters more than it
  -- looks: 'consent' means they performed an act (ticked a box, subscribed);
  -- 'legitimate_interest' means we decided, which is defensible for B2B but is
  -- not the same thing and must not be recorded as if it were.
  --
  --   consent             — they did something that constitutes agreement
  --   legitimate_interest — we assumed it (TEG network members, admin toggle)
  --   withdrawn           — they asked us to stop
  --   unknown             — predates this table; see the backfill below
  basis       text not null,

  -- WHERE it happened. Free text against a documented vocabulary rather than a
  -- CHECK constraint, so adding a form doesn't need a migration:
  --   newsletter_footer · join_signup · contact_form
  --   videography · videography_brochure · videography_discovery
  --   videography_register_interest · smm_enquiry · smm_brochure · smm_discovery
  --   csv_import · teg_auto · admin_toggle · merge
  --   footer_link · list_unsubscribe · spam_complaint · resubscribe · backfill
  --
  -- The opt-out sources mirror contacts.unsubscribe_source, so the two records
  -- of the same event agree with each other.
  source      text not null,

  detail      text,      -- free-text, shown on the contact card
  actor       text,      -- who did it: an admin's name, 'System', 'Sheet sync'
  raw         jsonb,     -- untouched context (form payload, import row) for audit
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

comment on table public.contact_consent_events is
  'Append-only audit trail of marketing consent changes. Never update or delete a row.';

create index if not exists contact_consent_events_contact_idx
  on public.contact_consent_events (contact_id, occurred_at desc);
create index if not exists contact_consent_events_email_idx
  on public.contact_consent_events (lower(email), occurred_at desc);
create index if not exists contact_consent_events_source_idx
  on public.contact_consent_events (source, occurred_at desc);

-- ============================================================
-- 2. Locked to admins, same as contacts and email_events.
--
-- The Worker uses the service role, which bypasses RLS, so every write path
-- below is unaffected. See supabase/admin_tables_rls.sql.
-- ============================================================
alter table public.contact_consent_events enable row level security;
drop policy if exists "contact_consent_events admin" on public.contact_consent_events;
create policy "contact_consent_events admin"
  on public.contact_consent_events for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 3. Backfill
--
-- Everyone already flagged opted-in has no history at all. Two honest cases,
-- and deliberately no third: we do not guess a route from `source` or tags,
-- because a reconstructed consent record is worse than an absent one — it looks
-- like evidence while being a guess.
--
-- `occurred_at` is the contact's created_at, which is a real fact (they were
-- added then). The detail line says plainly that the opt-in date itself is not
-- known, so nobody later reads the timestamp as the moment of consent.
--
-- Idempotent: skips any contact that already has a consent event, so re-running
-- is safe.
-- ============================================================

-- 3a. TEG network members — auto-opted-in on import by
--     worker/src/index.js (`const rowOptIn = optIn || isTeg`). They never
--     performed an act of consent, so this is recorded as legitimate interest.
insert into public.contact_consent_events
  (contact_id, email, action, basis, source, detail, actor, occurred_at)
select
  c.id,
  c.email,
  'opted_in',
  'legitimate_interest',
  'teg_auto',
  'TEG network member — opted in automatically as part of The Experts Group, '
    || 'not by an act of consent. Recorded retrospectively; the original date is not known.',
  'System',
  c.created_at
from public.contacts c
where c.marketing_opt_in
  and (
    c.lifecycle = 'teg'
    or c.source = 'agent_sheet_sync'
    or c.tags @> array['Network: TEG']
    or exists (select 1 from unnest(coalesce(c.tags, '{}')) t
               where t ilike 'Videography-New-Starter:%')
  )
  and not exists (
    select 1 from public.contact_consent_events e where e.contact_id = c.id
  );

-- 3b. Everyone else already opted in — route genuinely unknown.
insert into public.contact_consent_events
  (contact_id, email, action, basis, source, detail, actor, occurred_at)
select
  c.id,
  c.email,
  'opted_in',
  'unknown',
  'backfill',
  'Opted in before the audit trail existed — original date and route not recorded.',
  'System',
  c.created_at
from public.contacts c
where c.marketing_opt_in
  and not exists (
    select 1 from public.contact_consent_events e where e.contact_id = c.id
  );

-- ============================================================
-- 4. What this looks like afterwards
--
--   select basis, source, count(*)
--     from public.contact_consent_events
--    group by 1, 2 order by 3 desc;
--
-- Expect only 'teg_auto' and 'backfill' immediately after running. Every row
-- appearing after this point comes from a real event, with a real timestamp.
-- ============================================================
