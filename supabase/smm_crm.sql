-- TMKE — SMM sales CRM additions. Run in the Supabase SQL editor.
--
-- Adds the sales pipeline to smm_leads and a pin flag to the shared thread so
-- the social-media manager can run leads from first enquiry through to an
-- active managed client.

-- Sales pipeline stage (free-text, defaults to the first stage). Values:
--   inquiry | meeting_set | contract_sent | contract_signed | active_client | lost
alter table public.smm_leads add column if not exists pipeline_stage text default 'inquiry';

-- The sales meeting date (distinct from call_at, which is the discovery-call booking).
alter table public.smm_leads add column if not exists meeting_at timestamptz;

-- Pinnable notes on the shared correspondence thread (booking_messages, source='smm').
alter table public.booking_messages add column if not exists is_pinned boolean not null default false;

-- Active-client lifecycle status (set by the Active / Pause / End controls on the
-- customer file). Drives the SMM-Status: Active/Paused/Ended tag on the contact.
--   active | paused | ended  (null = not yet an active client)
alter table public.smm_leads add column if not exists client_status text;

-- Phase 4: dedup key for captured inbound emails (the Graph message id), so the
-- inbox poll never logs the same reply twice.
alter table public.booking_messages add column if not exists external_id text;
create index if not exists booking_messages_external_id_idx on public.booking_messages (external_id);

-- Active-client engagement + billing details (manually captured from Proposal
-- sent onward; feeds the ongoing-management hub + invoicing).
alter table public.smm_leads add column if not exists package_name text;
alter table public.smm_leads add column if not exists price text;            -- pricing structure, free text e.g. "£750 / month"
alter table public.smm_leads add column if not exists start_date date;       -- engagement start
alter table public.smm_leads add column if not exists end_date date;         -- confirmed no longer using our services
alter table public.smm_leads add column if not exists business_address text; -- for invoicing

-- Proposal-stage additions: their social channel links + the platforms we manage
-- (shown from Proposal sent onward). Pipeline now:
--   inquiry | meeting_set | proposal_sent | contract_signed | active_client | lost
alter table public.smm_leads add column if not exists instagram_url text;
alter table public.smm_leads add column if not exists facebook_url text;
alter table public.smm_leads add column if not exists linkedin_url text;
alter table public.smm_leads add column if not exists platforms text[];       -- e.g. {Instagram,Facebook,LinkedIn}

-- Invoices reuse booking_documents (category='invoice') + record the dates.
alter table public.booking_documents add column if not exists invoice_date date; -- date sent / raised
alter table public.booking_documents add column if not exists paid_date date;    -- manual paid date

-- Seed a sensible starting stage for existing rows that predate this column.
update public.smm_leads set pipeline_stage = 'inquiry' where pipeline_stage is null;
