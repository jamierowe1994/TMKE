-- TMKE — notifications in the member hub's bell. Run in Supabase (SQL editor).
-- Safe to run twice.
--
-- The bell in the hub header showed four made-up notifications to every
-- member. This is the real thing: one row per notification per member,
-- written by the Worker (service role), read and marked read by the member.

create table if not exists public.member_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,                 -- auth.users id of the member
  kind       text,                          -- e.g. smm_report_ready, smm_report_amended
  title      text not null,
  body       text,
  href       text,                          -- where it opens, inside the hub
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index if not exists member_notifications_user_idx
  on public.member_notifications (user_id, created_at desc);

alter table public.member_notifications enable row level security;

drop policy if exists "member_notifications own read" on public.member_notifications;
create policy "member_notifications own read" on public.member_notifications
  for select using (auth.uid() = user_id);

-- Marking read goes through these, so a member can't rewrite a notification.
create or replace function public.member_notification_read(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.member_notifications set read_at = now()
   where id = p_id and user_id = auth.uid() and read_at is null;
$$;
create or replace function public.member_notifications_read_all()
returns void language sql security definer set search_path = public as $$
  update public.member_notifications set read_at = now()
   where user_id = auth.uid() and read_at is null;
$$;
grant execute on function public.member_notification_read(uuid) to authenticated;
grant execute on function public.member_notifications_read_all() to authenticated;

select 'member_notifications ready' as status;
