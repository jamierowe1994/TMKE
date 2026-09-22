-- The patch an agent covers, in words
--
-- We hold their postcode, which is the wrong thing to print: a design asking
-- for {area} wants "Milton Keynes", not "MK10 9ST". Their own brand kit has
-- always had an Area field; this is the same thing on our side, so a new
-- agent's kit arrives with it already filled in.
--
-- Safe to re-run.

alter table public.agent_profiles
  add column if not exists area text;
