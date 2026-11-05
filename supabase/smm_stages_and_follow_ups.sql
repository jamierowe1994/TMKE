-- Social media client file, stage by stage (Danielle, 5 Nov 2026).
--
-- How someone came in when they were added by hand (a referral and who, a
-- phone call, an event), which of our brands pays for an inter-brand client,
-- and a follow-up date: "interested, just not yet", a lost lead coming back
-- in the spring, or a paused client's check-in.
--
-- The new Pricing call stage needs nothing here: pipeline_stage is plain text.
-- Safe to run twice.

alter table public.smm_leads
  add column if not exists source         text,   -- Referral, Phone call, Event, Existing client…
  add column if not exists source_detail  text,   -- who referred them, which event
  add column if not exists billed_brand   text,   -- inter-brand: the TEG brand that pays (videography-config TEG_BRANDS key)
  add column if not exists follow_up_on   date,
  add column if not exists follow_up_how  text,   -- Call | Email | Call and email
  add column if not exists follow_up_by   text,
  add column if not exists follow_up_note text;

notify pgrst, 'reload schema';
