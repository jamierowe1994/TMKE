-- ============================================================================
-- TMKE Social Media (SMM) — leads + bookings schema (Phase 0)
-- Separate CRM area from videography (own table, own admin pipeline). Holds all
-- three SMM form submissions: brochure downloads, discovery-call bookings, and
-- general enquiries. Written by the Worker with the service role (bypasses RLS).
-- Safe to re-run (idempotent).
--
-- NOTE: `stage` is intentionally FREE-TEXT — no CHECK constraint. The videography
-- table learned this the hard way: a stage CHECK silently rejected lead statuses
-- and the best-effort Worker write swallowed the error. Keep this open.
-- ============================================================================

create table if not exists public.smm_leads (
  id                 uuid primary key default gen_random_uuid(),

  -- brochure | discovery | enquiry
  kind               text not null,

  -- Contact (Form 1 uses full_name; Forms 2 & 3 use first/last + business)
  full_name          text,
  first_name         text,
  last_name          text,
  email              text not null,
  phone              text,
  business           text,

  -- Form 3 free-text; Form 2 may carry interests / preferred tier
  message            text,
  tier               text,                       -- service tier of interest (optional)
  interests          jsonb   default '[]'::jsonb,

  -- Free-text pipeline status (NO check constraint — see header note):
  --   brochure_downloaded | discovery_call_booked | general_enquiry | ...
  stage              text not null default 'general_enquiry',
  -- CRM tag label shown to Jack / synced to GHL (e.g. 'General Enquiry')
  tag                text,

  -- Marketing consent is recorded on EVERY contact, opted-in or not.
  marketing_opt_in   boolean default false,

  -- Account linkage — accounts are global (shared with videography).
  account_user_id    uuid,                       -- linked Supabase auth user
  account_created    boolean default false,      -- did THIS submission create it
  brochure_sent      boolean default false,      -- Form 1: PDF emailed

  -- Discovery-call fields (Form 2) — books a different manager's M365 calendar.
  call_at            timestamptz,
  duration_min       integer,
  reschedule_token   text,
  ms_event_id        text,                       -- linked 365 calendar event

  -- Manual ordering within an admin pipeline column (drag-to-reorder).
  sort_order         integer default 0,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- ---- Admin workflow columns (added 2026-06-16) -----------------------------
-- Lets the team work each lead: status + free-text internal notes. status is
-- free-text on purpose (no CHECK) — new | contacted | won | lost | spam.
alter table public.smm_leads add column if not exists status text default 'new';
alter table public.smm_leads add column if not exists notes  text;

-- ---- Indexes ---------------------------------------------------------------
create index if not exists idx_smm_leads_kind  on public.smm_leads (kind);
create index if not exists idx_smm_leads_status on public.smm_leads (status);
create index if not exists idx_smm_leads_stage on public.smm_leads (stage, sort_order);
create index if not exists idx_smm_leads_acct  on public.smm_leads (account_user_id);
create index if not exists idx_smm_leads_email on public.smm_leads (email);

-- ---- RLS — admin-only ------------------------------------------------------
-- The Worker writes/reads with the service role (bypasses RLS). The admin SMM
-- pipeline reads with an authenticated session. The public site never touches
-- this table directly — it always goes through the Worker. No anonymous access.
-- Tighten `authenticated` to public.is_admin() once the admins-table RLS lands.
alter table public.smm_leads enable row level security;
drop policy if exists "smm_leads admin" on public.smm_leads;
create policy "smm_leads admin"
  on public.smm_leads for all
  to authenticated
  using (true)
  with check (true);
