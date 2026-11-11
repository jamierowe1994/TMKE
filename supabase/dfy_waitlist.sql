-- ============================================================================
-- Done For You waitlist (Danielle, 11 Nov 2026).
--
-- Done For You launches in January 2027. In December there's a waitlist with
-- a limited number of spaces (10), TEG agents only (The Property Experts and
-- Prestige Property Experts); the same list opens to independent agents in
-- February. The website's waitlist page posts to the Worker (/dfy/waitlist),
-- which saves the sign-up here and sends the confirmation email. The team
-- see the list, in order, under Admin > Content calendar > Overview.
--
-- Run AFTER content_calendar_launch.sql. Safe to re-run. Sends nothing.
-- ============================================================================

create table if not exists public.dfy_waitlist (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  email       text not null,
  brand       text not null,
  option      text not null check (option in ('subscription', 'add_on')),
  user_id     uuid,
  contact_id  uuid,
  matched     boolean not null default false,   -- the email belongs to an agent on that brand
  status      text not null default 'waiting' check (status in ('waiting', 'invited', 'joined', 'removed')),
  invited_at  timestamptz,
  note        text,
  source      text                               -- which page they signed up on
);
create unique index if not exists dfy_waitlist_email on public.dfy_waitlist (lower(email));
create index if not exists dfy_waitlist_created on public.dfy_waitlist (created_at);

alter table public.dfy_waitlist enable row level security;
drop policy if exists "dfy_waitlist admin" on public.dfy_waitlist;
create policy "dfy_waitlist admin"
  on public.dfy_waitlist for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- How many spaces, and who may join: 'teg' in December, 'all' from February.
alter table public.content_calendar_settings add column if not exists dfy_spaces int not null default 10;
alter table public.content_calendar_settings add column if not exists dfy_audience text not null default 'teg';
alter table public.content_calendar_settings add column if not exists dfy_open boolean not null default false;

notify pgrst, 'reload schema';

select dfy_spaces, dfy_audience, dfy_open, (select count(*) from public.dfy_waitlist) as signed_up
from public.content_calendar_settings where id = 1;
