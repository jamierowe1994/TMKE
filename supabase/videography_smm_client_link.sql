-- ============================================================
-- Videography ↔ social media client
-- ============================================================
-- Additive and safe to re-run.
--
-- A shoot booked under the SMM route belongs to a social media client, but
-- nothing recorded WHICH one — so the footage and the content plan it feeds
-- had no connection in the data. This is that link.
--
-- Keyed on the id rather than matched on email on purpose: the person who
-- arranges a shoot is often not the address on the SMM account (an office
-- manager books, the account sits with the owner), so email-matching would
-- quietly mis-link or silently fail.
--
-- Nullable and unconstrained by route: a booking can be linked before its
-- route is settled, and un-linking is just setting it back to null. `on delete
-- set null` so removing a client never takes a shoot's history with it.
-- ============================================================

-- Split into steps on purpose. Doing this as one statement takes an ACCESS
-- EXCLUSIVE lock on videography_bookings while it also locks smm_leads for the
-- foreign key, so anything already holding a lock — an editor tab left "idle in
-- transaction" is the usual one — makes the whole thing appear to hang.
--
-- If it does hang, this shows what is in the way:
--   select pid, state, wait_event_type, now() - query_start as running_for,
--          left(query, 90)
--   from pg_stat_activity
--   where datname = current_database() and pid <> pg_backend_pid()
--   order by query_start;

-- 1. The column. Nullable with no default, so this is instant — it only writes
--    a catalogue entry, it does not rewrite the table.
alter table public.videography_bookings
  add column if not exists smm_lead_id uuid;

comment on column public.videography_bookings.smm_lead_id is
  'The social media client this shoot belongs to. Null for shoots that are not SMM work.';

-- 2. The foreign key, NOT VALID: takes its lock only briefly rather than
--    scanning every existing row while holding it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'videography_bookings_smm_lead_id_fkey'
  ) then
    alter table public.videography_bookings
      add constraint videography_bookings_smm_lead_id_fkey
      foreign key (smm_lead_id) references public.smm_leads(id)
      on delete set null
      not valid;
  end if;
end $$;

-- 3. Validate it separately. Every existing row is NULL so there is nothing to
--    check, and this takes a far weaker lock than step 2 would have.
alter table public.videography_bookings
  validate constraint videography_bookings_smm_lead_id_fkey;

-- 4. The index. Every read is "the bookings for this client", so it matches
--    that. Run this one ON ITS OWN — CREATE INDEX CONCURRENTLY cannot run
--    inside a transaction block, and some SQL editors wrap statements in one.
--    If it errors with "cannot run inside a transaction block", drop the
--    CONCURRENTLY keyword: the table is small enough that the brief lock is
--    harmless.
create index concurrently if not exists videography_bookings_smm_lead_id_idx
  on public.videography_bookings (smm_lead_id)
  where smm_lead_id is not null;

-- ============================================================
-- Check it worked:
--   select column_name from information_schema.columns
--   where table_name = 'videography_bookings' and column_name = 'smm_lead_id';
-- ============================================================
