-- A discovery call booked means the card is at Discovery call (Danielle,
-- 5 Nov 2026). Website bookings used to leave the card at Enquiry and keep the
-- time only in call_at. This moves those cards on and puts the call on the
-- file's meeting. Only cards still at Enquiry or the waitlist; lost cards stay
-- lost. Safe to run twice.

update public.smm_leads
set pipeline_stage = 'meeting_set',
    meeting_at = coalesce(meeting_at, call_at)
where pipeline_stage in ('inquiry', 'waitlist')
  and (call_at is not null or meeting_at is not null);
