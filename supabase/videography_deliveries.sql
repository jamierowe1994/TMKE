-- TMKE — Videography client deliveries (the shareable gallery + paywall)
-- ---------------------------------------------------------------------------
-- One row per "send to client". Holds the public access token, the price
-- (base + editable extras), how many teaser images are free, and the payment
-- status. The files themselves live in R2 (videography_deliverables); this row
-- gates access to them via the token + status.
-- Run after supabase/videography.sql + videography_deliverables.sql.
-- ---------------------------------------------------------------------------

create table if not exists public.videography_deliveries (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null unique references public.videography_bookings (id) on delete cascade,
  token         text not null unique,          -- unguessable public link id
  client_name   text,
  client_email  text,
  message       text,                           -- optional note shown to client
  teaser_count  integer not null default 3,     -- free preview images
  base_pence    integer not null default 0,     -- shoot price
  extras        jsonb not null default '[]',    -- [{ "label": "...", "amount_pence": 0 }]
  total_pence   integer not null default 0,     -- base + sum(extras)
  status        text not null default 'draft'
                check (status in ('draft', 'sent', 'paid')),
  stripe_session text,                           -- set when Stripe is wired (Phase 5)
  created_at    timestamptz default now(),
  sent_at       timestamptz,
  paid_at       timestamptz
);

create index if not exists videography_deliveries_token_idx
  on public.videography_deliveries (token);

alter table public.videography_deliveries enable row level security;

-- Admin (logged-in) full access. The PUBLIC client gallery never touches this
-- table directly — it goes through the Worker, which reads with the service
-- role — so no anon policy is needed (keeps client emails/tokens private).
drop policy if exists "videography_deliveries authed all" on public.videography_deliveries;
create policy "videography_deliveries authed all"
  on public.videography_deliveries for all
  to authenticated
  using (true)
  with check (true);
