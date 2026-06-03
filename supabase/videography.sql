-- TMKE admin centre — Videography schema
-- ---------------------------------------------------------------------------
-- Powers Jack's videography area in the admin centre:
--   * videography_bookings   — the mini-CRM pipeline (kanban) + client records
--   * videography_availability — Jack's weekly diary availability template
--
-- Run this in the Supabase SQL editor. RLS mirrors the existing admin tables:
-- authenticated users (i.e. anyone signed into the admin centre) get full
-- access. Public booking-form inserts will get their own narrower policy when
-- the customer-facing booking page lands (Phase 2).
-- ---------------------------------------------------------------------------

-- ===== Pipeline / CRM ======================================================
create table if not exists public.videography_bookings (
  id            uuid primary key default gen_random_uuid(),
  client_name   text not null,
  client_email  text,
  client_phone  text,
  client_company text,
  -- Partner brand key — drives which price tier this client sits on
  -- (e.g. 'property-experts', 'fine-and-country'). Maps to the partner
  -- records the public videography pages will use.
  brand         text,
  -- Service / shoot type (e.g. 'Property video', 'Podcast', 'Consultation').
  service       text,
  shoot_date    timestamptz,
  location      text,
  notes         text,
  -- Pipeline stage. Matches the kanban columns in the admin UI.
  stage         text not null default 'booked'
                check (stage in ('booked','shoot_day','editing','final_draft','invoice_out','complete')),
  -- Quoted/base amount in pence. Travel + extras get added before invoicing
  -- (Phase 5 — Stripe/QuickBooks).
  amount_pence  integer,
  -- Manual ordering within a column (drag-to-reorder, lower = higher).
  sort_order    integer default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists videography_bookings_stage_idx
  on public.videography_bookings (stage, sort_order);
create index if not exists videography_bookings_created_idx
  on public.videography_bookings (created_at desc);

-- Keep updated_at fresh on every change.
create or replace function public.touch_videography_bookings()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_videography_bookings on public.videography_bookings;
create trigger trg_touch_videography_bookings
  before update on public.videography_bookings
  for each row execute function public.touch_videography_bookings();

alter table public.videography_bookings enable row level security;

drop policy if exists "videography_bookings authed all" on public.videography_bookings;
create policy "videography_bookings authed all"
  on public.videography_bookings for all
  to authenticated
  using (true)
  with check (true);

-- ===== Weekly availability (diary template) ================================
create table if not exists public.videography_availability (
  id           uuid primary key default gen_random_uuid(),
  -- 0 = Sunday … 6 = Saturday (matches JS Date.getDay()).
  weekday      smallint not null check (weekday between 0 and 6),
  start_time   text not null,            -- 'HH:MM' 24h
  end_time     text not null,            -- 'HH:MM' 24h
  is_available boolean not null default true,
  created_at   timestamptz default now(),
  unique (weekday)
);

alter table public.videography_availability enable row level security;

drop policy if exists "videography_availability authed all" on public.videography_availability;
create policy "videography_availability authed all"
  on public.videography_availability for all
  to authenticated
  using (true)
  with check (true);

-- The public booking page (Phase 2) will need to READ availability without a
-- login. Uncomment when that page ships:
-- drop policy if exists "videography_availability public read" on public.videography_availability;
-- create policy "videography_availability public read"
--   on public.videography_availability for select
--   using (true);

-- Seed a sensible Mon–Fri 09:00–17:30 working week (no-op if already seeded).
insert into public.videography_availability (weekday, start_time, end_time, is_available)
values
  (1, '09:00', '17:30', true),
  (2, '09:00', '17:30', true),
  (3, '09:00', '17:30', true),
  (4, '09:00', '17:30', true),
  (5, '09:00', '17:30', true),
  (6, '10:00', '14:00', false),
  (0, '10:00', '14:00', false)
on conflict (weekday) do nothing;
