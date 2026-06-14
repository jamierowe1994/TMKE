-- ============================================================================
-- TMKE Videography — booking-flow schema (Phase 0)
-- Extends the existing videography tables to support the full booking flow from
-- the client brief v3.0: member/non-member routing, packages + add-ons, travel
-- surcharge, T&C signature, marketing opt-in, account linkage, leads, and the
-- admin-editable settings (Jack's base postcode + surcharge).
-- Safe to re-run (idempotent). Run AFTER supabase/videography.sql.
-- ============================================================================

-- ---- Booking / lead record additions ---------------------------------------
alter table videography_bookings
  add column if not exists kind                text    default 'booking',   -- booking | discovery | enquiry
  add column if not exists service_type        text,                        -- content-studio | property | agent | discovery
  add column if not exists audience            text,                        -- member | non-member
  add column if not exists brand               text,                        -- tpe | prestige | fc | null
  add column if not exists package             text,                        -- session/package key (or csv for agent multi-select)
  add column if not exists add_ons             jsonb   default '[]'::jsonb, -- [{key,name,price_pence,qty}]
  add column if not exists postcode            text,                        -- shoot postcode (property/agent)
  add column if not exists distance_miles      numeric,                     -- driving distance from base
  add column if not exists surcharge_pence     integer default 0,           -- travel surcharge (ex-VAT)
  add column if not exists signed_name         text,                        -- T&C signature
  add column if not exists signed_at           timestamptz,
  add column if not exists marketing_opt_in    boolean default false,
  add column if not exists account_user_id     uuid,                        -- linked Supabase auth user
  add column if not exists reschedule_token    text,                        -- tokenised cancel/reschedule link
  add column if not exists discovery_interests jsonb   default '[]'::jsonb, -- discovery-call service interests
  add column if not exists enquiry_message     text;                        -- non-member free-text

-- `stage` is a free-text status column; the lead statuses below are just new
-- values (no enum change needed):
--   booked | shoot_day | editing | final_draft | invoice_out | complete
--   discovery_call_booked | enquiry_non_member

-- ---- Per-service availability ----------------------------------------------
-- One calendar (Jack's) for now; service_type lets the public calendar show the
-- right slots per service and lets us split to per-person diaries later.
-- 'all' = applies to every service.
alter table videography_availability
  add column if not exists service_type text default 'all';

-- ---- Admin settings (singleton) --------------------------------------------
create table if not exists videography_settings (
  id                       smallint primary key default 1,
  base_postcode            text    default 'NN14 1AA',
  free_radius_miles        integer default 40,
  surcharge_pence_per_mile integer default 55,
  vat_rate                 numeric default 0.20,
  updated_at               timestamptz default now(),
  constraint videography_settings_singleton check (id = 1)
);
insert into videography_settings (id) values (1) on conflict (id) do nothing;

-- ---- Helpful indexes -------------------------------------------------------
create index if not exists idx_vid_bookings_kind  on videography_bookings (kind);
create index if not exists idx_vid_bookings_stage on videography_bookings (stage);
create index if not exists idx_vid_bookings_acct  on videography_bookings (account_user_id);
create index if not exists idx_vid_avail_service  on videography_availability (service_type);
