-- How a social media client's booked call happens, and its Teams link
-- (Danielle, 5 Nov 2026). hello@ can't make Teams links, so the manager adds
-- one from the file and the invite is updated for everyone; until then the
-- file says the link still needs adding. Safe to run twice.

alter table public.smm_leads
  add column if not exists meeting_how  text,   -- teams | phone | in_person
  add column if not exists meeting_link text;   -- the Teams link, once added

notify pgrst, 'reload schema';
