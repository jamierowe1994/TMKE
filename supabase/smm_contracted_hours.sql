-- SMM clients — contracted hours per month.
-- Feeds the "Contracted hours this month" figure on the admin Dashboard's
-- Social media card. Set from the client's engagement panel
-- (/admin/social, "Engagement & billing" section) — no default assumption
-- is made per client; it's null until someone enters it.
-- Safe to re-run.

alter table public.smm_leads
  add column if not exists contracted_hours_per_month numeric;
