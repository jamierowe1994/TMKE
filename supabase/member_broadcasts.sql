-- Hub notices: one message for every member's bell, written in the admin
-- (Catalogue → Hub notifications) and sent at the time it's set for.
--
-- The admin writes a row here; the Worker's five-minute tick picks up any
-- row that is 'scheduled' and due, writes one member_notifications row per
-- account (member_notifications.sql), and marks it 'sent' with the count.
-- Setting a sent notice to 'withdraw' has the next tick take it back out of
-- every bell ('withdrawn'). Members never read this table: what they see is
-- their own member_notifications row, as with every other notification.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

create table if not exists public.member_broadcasts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  href        text,                 -- where it opens; null = the dashboard
  link_label  text,                 -- what href is, in words, for the admin list
  send_at     timestamptz not null default now(),
  status      text not null default 'scheduled'
              check (status in ('scheduled', 'sending', 'sent', 'failed', 'cancelled', 'withdraw', 'withdrawn')),
  sent_at     timestamptz,
  sent_count  integer,
  error       text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists member_broadcasts_due on public.member_broadcasts (status, send_at);

-- Lets the Worker find (and take back) one notice's rows in every bell.
create index if not exists member_notifications_broadcast
  on public.member_notifications ((meta->>'broadcast_id'))
  where meta ? 'broadcast_id';

alter table public.member_broadcasts enable row level security;

drop policy if exists "member_broadcasts admin" on public.member_broadcasts;
create policy "member_broadcasts admin" on public.member_broadcasts
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
