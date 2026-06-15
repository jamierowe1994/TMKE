-- TMKE first-party analytics — a single append-only event log that powers the
-- owned business metrics (visitors, conversion, cart abandonment, studio usage,
-- revenue, predicted income). Lightweight: one row per tracked event.
--
-- Sent from the browser via src/lib/track.js. Anonymous visitors can INSERT
-- (so we can count logged-out traffic); only signed-in admins can SELECT (the
-- metrics dashboard reads it). Pair with PostHog for traffic-source + funnel
-- visualisations — this table owns the business numbers.
--
-- Run this in the Supabase SQL editor. Safe to re-run.

create table if not exists public.site_events (
  id          bigint generated always as identity primary key,
  name        text not null,                         -- 'pageview' | 'add_to_cart' | 'checkout_started' | 'studio_opened' | 'order_completed' | …
  path        text,                                  -- location.pathname when fired
  session_id  text,                                  -- anonymous, client-generated (localStorage); ties a visit together
  user_id     uuid references auth.users(id) on delete set null,  -- set when signed in
  props       jsonb not null default '{}'::jsonb,    -- event-specific payload (pack_id, amount_pence, template_id, …)
  referrer    text,
  created_at  timestamptz not null default now()
);

-- Hot query paths: "events of type X over time" and "all events in a session".
create index if not exists site_events_name_created_idx on public.site_events (name, created_at desc);
create index if not exists site_events_session_idx       on public.site_events (session_id, created_at);
create index if not exists site_events_created_idx        on public.site_events (created_at desc);

-- ============================================================
-- RLS — visitors (anon) may only INSERT events; nobody but signed-in admins
-- can read them. No update/delete from the client (append-only).
-- ============================================================
alter table public.site_events enable row level security;

drop policy if exists "site_events insert anyone" on public.site_events;
create policy "site_events insert anyone"
  on public.site_events for insert
  to anon, authenticated
  with check (true);

-- Reads gated to authenticated for now (matches the rest of the backstage);
-- tighten to public.is_admin() once the admins-table RLS rollout lands.
drop policy if exists "site_events read authed" on public.site_events;
create policy "site_events read authed"
  on public.site_events for select
  to authenticated
  using (true);
