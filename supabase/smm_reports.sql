-- TMKE — SMM monthly performance reports (Report Insights). Run in Supabase.
--
-- One row per managed account (smm_lead) per month. `data` holds the full
-- SocialPilot-derived JSON (profile, reach, reels/posts/ads, topContent,
-- hashtags, peakTimes, demographics, priorities, comingSoon) — schema per
-- report-insights spec. Rendered in the admin (cards → detail → hub) and,
-- read-only, in the member hub.

create table if not exists public.smm_reports (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.smm_leads(id) on delete cascade,
  account_user_id uuid,                    -- the client's account, for member reads
  platform     text default 'Instagram',
  month        smallint not null,          -- 0-indexed (0 = Jan … 11 = Dec)
  year         smallint not null,
  data         jsonb not null default '{}'::jsonb,
  uploaded_by  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (lead_id, platform, month, year)  -- one report per account/platform/month
);

create index if not exists smm_reports_lead_idx on public.smm_reports (lead_id);
create index if not exists smm_reports_account_idx on public.smm_reports (account_user_id);

-- Members read their own account's reports (owner-only); all writes go through
-- the service role (admin, via the Worker).
alter table public.smm_reports enable row level security;
do $$ begin
  create policy "smm_reports owner read" on public.smm_reports
    for select using (auth.uid() = account_user_id);
exception when duplicate_object then null; end $$;

-- keep updated_at fresh
create or replace function public.smm_reports_touch() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
do $$ begin
  create trigger smm_reports_touch before update on public.smm_reports
    for each row execute function public.smm_reports_touch();
exception when duplicate_object then null; end $$;
