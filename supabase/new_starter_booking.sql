-- ============================================================================
-- TEG new-starter "Studio Day" booking — bill-to-TPE marker + agent status.
--
-- The new-starter booking page (/videography/new-starter) creates a normal
-- videography_bookings row but marks it bill_to = 'TPE' (no card payment; TPE is
-- invoiced), and flips the agent's TEG record to 'booked' with the shoot time so
-- it can be surfaced (and later written back to the TEG spreadsheet).
--
-- Run AFTER supabase/videography_booking_flow.sql + supabase/agent_profiles.sql.
-- Safe to re-run (idempotent).
-- ============================================================================

-- Who the booking is invoiced to ('TPE' for new-starter Studio Days; NULL = the
-- client, as normal).
alter table public.videography_bookings
  add column if not exists bill_to text;

-- TEG agent onboarding status + the booked shoot time.
alter table public.agent_profiles
  add column if not exists status          text default 'eligible',  -- eligible | booked | complete
  add column if not exists shoot_booked_at timestamptz;
