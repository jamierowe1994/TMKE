-- What a social media client's package consists of (admin → Social media →
-- a client's file → Notes → Package details). Danielle, 20 Oct 2026.
--
--   package_details  { tier, video, shoot_frequency, outputs }
--     tier             "smm-1".."smm-3" (Shot and Scheduled, from the rate
--                      card in src/lib/smm-config.js), a Social Media
--                      Management package's name, or free text when bespoke
--     video            true / false
--     shoot_frequency  e.g. "Quarterly, 5 hour shoot"
--     outputs          e.g. "36 videos a quarter, 3 posts a week"
--
-- Monthly hours stay in contracted_hours_per_month, which the file already
-- has. Reference only: nothing bills or schedules from this. Safe to re-run.

alter table public.smm_leads
  add column if not exists package_details jsonb;

notify pgrst, 'reload schema';
