-- ============================================================
-- Pipeline stages, rebuilt around invoice-before-shoot
-- ============================================================
-- READ THIS BEFORE RUNNING. Unlike the other videography migrations, this one
-- CHANGES EXISTING ROWS. It rewrites the stage on every booking that sits in a
-- retired stage. Nothing is deleted and no booking is lost, but the old stage
-- names are gone afterwards, so take a snapshot if you want to be able to look
-- back:
--
--   create table if not exists videography_bookings_stage_backup_2026_08 as
--     select id, stage from public.videography_bookings;
--   alter table public.videography_bookings_stage_backup_2026_08
--     enable row level security;
--
-- The RLS line is not optional. A new table in `public` with RLS off is
-- readable by anyone holding the anon or authenticated key - i.e. every signed
-- in member. Enabling it with NO policies denies everyone except the service
-- role, which is exactly right for a backup nothing should be reading.
--
-- Safe to re-run.
-- ============================================================
--
-- WHY
-- The old order was:
--   booked -> shoot_day -> editing -> final_draft -> invoice_out -> complete
--
-- `invoice_out` sat AFTER editing, because invoicing used to happen at the end.
-- It now happens two days BEFORE the shoot. Left alone, every job would
-- misreport: a booking that has been invoiced and not yet shot had nowhere
-- honest to sit.
--
-- The new order:
--   booked -> invoiced -> shoot_day -> editing -> gallery_ready -> delivered
--
--   booked        the shoot is in the diary
--   invoiced      invoice sent (two days before the shoot)
--   shoot_day     filming
--   editing       Jack is working on it
--   gallery_ready the Pixieset gallery exists, PIN withheld
--   delivered     the client has their PIN and their content
--
-- Payment is deliberately NOT a stage. It arrives at different points by
-- different routes - agent card at booking, brand invoice before the shoot -
-- so it stays a flag (paid_at) that any stage can carry.
-- ============================================================

-- 1. Drop the constraint first, or the remap below fails against it.
alter table public.videography_bookings
  drop constraint if exists videography_bookings_stage_check;

-- 2. Remap retired stages. Each choice, and why:
--    final_draft -> editing        still in production, not yet with the client
--    invoice_out -> gallery_ready  old process: work done, awaiting payment.
--                                  The new equivalent is a gallery held back.
--    complete    -> delivered      same meaning, clearer name
update public.videography_bookings set stage = 'editing'       where stage = 'final_draft';
update public.videography_bookings set stage = 'gallery_ready' where stage = 'invoice_out';
update public.videography_bookings set stage = 'delivered'     where stage = 'complete';

-- 3. Anything unrecognised goes back to 'booked' rather than being left to fail
--    the new constraint. There should be none; this is a safety net.
update public.videography_bookings
   set stage = 'booked'
 where stage not in ('booked','invoiced','shoot_day','editing','gallery_ready','delivered','cancelled');

-- 4. The new constraint.
alter table public.videography_bookings
  add constraint videography_bookings_stage_check
  check (stage in ('booked','invoiced','shoot_day','editing','gallery_ready','delivered','cancelled'));

-- ============================================================
-- Check it worked:
--   select stage, count(*) from public.videography_bookings group by stage order by 2 desc;
-- Expect only the seven names above.
-- ============================================================
