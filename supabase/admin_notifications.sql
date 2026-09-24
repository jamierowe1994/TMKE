-- Telling somebody, in the place they already are
--
-- Every feature built this year has shipped with "you'd see it next time you
-- look". That works while one person holds the whole system in their head and
-- stops the day it is two. Worse, some things tell nobody at all: a pack being
-- bought and an invoice being paid are invisible until somebody opens Stripe.
--
-- Email stays what it is -- the alert that reaches a phone. This is the
-- record, and it survives a deleted inbox.
--
-- WHO SEES WHAT (Danielle, 24 Sep 2026):
--   · she sees everything
--   · videography — anything at all — also Jack
--   · social, a new enquiry — also the new-business lead
--   · social, an existing client — also that client's account manager
--   · money, the member hub, and anything that went wrong — her
--
-- So `recipients` is a list of addresses, never a role: the rule is decided
-- once, where the thing happens, and the row carries the answer. Read state is
-- per person -- one of us clearing something must not hide it from the other.
--
-- Run in the Supabase SQL editor. Safe to re-run.

create table if not exists public.admin_notifications (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  -- videography | social | money | hub | problem
  area         text not null,
  -- the machine name, so one kind can be found or muted later
  event        text not null,
  title        text not null,
  body         text,
  -- Straight to the thing itself, never a page to go hunting on.
  href         text,
  recipients   text[] not null default '{}',
  read_by      text[] not null default '{}',
  meta         jsonb
);

create index if not exists admin_notifications_new_idx
  on public.admin_notifications (created_at desc);
create index if not exists admin_notifications_to_idx
  on public.admin_notifications using gin (recipients);

-- Stop one event writing twice when a webhook retries.
create unique index if not exists admin_notifications_once_idx
  on public.admin_notifications (event, (meta->>'key'))
  where meta ? 'key';

alter table public.admin_notifications enable row level security;

-- You see what was addressed to you. Staff only, and not even staff see
-- somebody else's list.
drop policy if exists "admin_notifications read own" on public.admin_notifications;
create policy "admin_notifications read own"
  on public.admin_notifications for select
  using (
    public.is_staff()
    and lower(coalesce(auth.jwt() ->> 'email', '')) = any (recipients)
  );

-- Marking read appends you to the row rather than flipping a flag, because
-- the row belongs to several people.
create or replace function public.notification_read(p_id uuid)
  returns void
  language sql
  volatile
  security definer
  set search_path = public
as $$
  update public.admin_notifications
     set read_by = (select array_agg(distinct x) from unnest(
           read_by || array[lower(coalesce(auth.jwt() ->> 'email', ''))]) x)
   where id = p_id
     and public.is_staff()
     and lower(coalesce(auth.jwt() ->> 'email', '')) = any (recipients);
$$;

create or replace function public.notifications_read_all()
  returns void
  language sql
  volatile
  security definer
  set search_path = public
as $$
  update public.admin_notifications
     set read_by = (select array_agg(distinct x) from unnest(
           read_by || array[lower(coalesce(auth.jwt() ->> 'email', ''))]) x)
   where public.is_staff()
     and lower(coalesce(auth.jwt() ->> 'email', '')) = any (recipients)
     and not (lower(coalesce(auth.jwt() ->> 'email', '')) = any (read_by));
$$;

grant execute on function public.notification_read(uuid)   to authenticated;
grant execute on function public.notifications_read_all()  to authenticated;

select 'admin_notifications ready' as status;
