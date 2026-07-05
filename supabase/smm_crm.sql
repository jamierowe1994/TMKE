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

-- Seed a sensible starting stage for existing rows that predate this column.
update public.smm_leads set pipeline_stage = 'inquiry' where pipeline_stage is null;
