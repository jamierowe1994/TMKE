-- ============================================================================
-- Member subscriptions by card (Danielle, 11 Nov 2026).
--
-- December: TEG agents' brands pay for the Content Calendar, and an agent can
-- upgrade to Content Calendar + Scheduling, paying the difference by card.
-- Billed on the 1st for that calendar month: the first month in full on the
-- day they join, then on the 1st. A failed payment gets one more try, then
-- they go back to the brand-paid calendar. Cancelling runs to the end of the
-- paid month. The test logins pay in Stripe's test mode; everyone else live.
--
--   member_billing        one Stripe customer per member per mode (and, in
--                         test mode, the test clock that fast-forwards time)
--   member_subscriptions  each card subscription, its price kept as it started
--                         (the +£12 launch offer stays £12 while they stay)
--   member_level_log      every change of level, for the CRM and Insights
--
-- Written only by the Worker. Team can read. Safe to re-run. Sends nothing.
-- ============================================================================

create table if not exists public.member_billing (
  user_id            uuid not null,
  mode               text not null check (mode in ('test', 'live')),
  stripe_customer_id text not null,
  test_clock_id      text,
  created_at         timestamptz not null default now(),
  primary key (user_id, mode)
);

create table if not exists public.member_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  user_id                uuid not null,
  email                  text,
  mode                   text not null check (mode in ('test', 'live')),
  level                  text not null check (level in ('calendar', 'scheduling', 'done_for_you')),
  basis                  text not null default 'teg_upgrade',   -- teg_upgrade: the difference above a brand-paid calendar
  price_pence            int  not null,                         -- a month, ex VAT, kept as it started
  vat_rate               numeric not null default 20,
  launch_offer           boolean not null default false,
  stripe_customer_id     text,
  stripe_checkout_id     text,
  stripe_subscription_id text unique,
  status                 text not null default 'pending'
                         check (status in ('pending', 'active', 'past_due', 'cancelling', 'ended')),
  failed_attempts        int not null default 0,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  started_at             timestamptz,
  ended_at               timestamptz,
  ended_reason           text
);
create index if not exists member_subscriptions_user on public.member_subscriptions (user_id, mode, status);

create table if not exists public.member_level_log (
  id         uuid primary key default gen_random_uuid(),
  at         timestamptz not null default now(),
  user_id    uuid not null,
  email      text,
  mode       text,
  from_level text,
  to_level   text,
  source     text,
  reason     text
);
create index if not exists member_level_log_user on public.member_level_log (user_id, at);

alter table public.member_billing       enable row level security;
alter table public.member_subscriptions enable row level security;
alter table public.member_level_log     enable row level security;

drop policy if exists "member_billing admin read" on public.member_billing;
create policy "member_billing admin read" on public.member_billing for select to authenticated using (public.is_admin());
drop policy if exists "member_subscriptions admin read" on public.member_subscriptions;
create policy "member_subscriptions admin read" on public.member_subscriptions for select to authenticated using (public.is_admin());
drop policy if exists "member_level_log admin read" on public.member_level_log;
create policy "member_level_log admin read" on public.member_level_log for select to authenticated using (public.is_admin());

notify pgrst, 'reload schema';

select (select count(*) from public.member_subscriptions) as subscriptions,
       (select count(*) from public.member_level_log) as level_changes;
