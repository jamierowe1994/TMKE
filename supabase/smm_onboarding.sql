-- A social media client's onboarding checklist (admin → Social media → a
-- client's file → Onboarding). Danielle, 21 Oct 2026.
--
--   onboarding  { done: { <item>: { at, by } },       ticked by hand
--                 ask:  { approval, optimise },        "yes" / "no"
--                 notes: { call, approval },            short notes
--                 strategy: { competitors, audience, groups, pillars, tone, goals } }
--
-- Items that can be read from the file (contract on file, start date, hub
-- linked...) aren't stored: they tick themselves. Safe to re-run.

alter table public.smm_leads
  add column if not exists onboarding jsonb;

notify pgrst, 'reload schema';
