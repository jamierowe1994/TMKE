-- Studio reporting: sign-ins counted properly (Danielle, 18 Nov 2026).
--
-- Supabase isn't keeping a sign-in history for us (its audit log is empty),
-- so "Sign-ins each, on average" said 0. Now each member's sign-ins are the
-- most of three counts:
--   1. Supabase's audit log, if it ever starts keeping one;
--   2. their sign-in sessions still on record (each sign-in starts one; it
--      ends when they sign out, so this is a floor, not the full history);
--   3. the usage log's own count, which records every sign-in from 18 Nov.
-- Replaces studio_report_activity() from studio_reporting.sql. Only the
-- server can run it. Changes nothing. Sends nothing. Safe to run twice.

create or replace function public.studio_report_activity()
returns table (user_id uuid, sign_ins integer, first_sign_in timestamptz, active_days integer, last_active timestamptz)
language sql
stable
security definer
set search_path = public, auth
as $$
  with audit as (
    select (a.payload ->> 'actor_id')::uuid as user_id, count(*)::int as n, min(a.created_at) as first_at
      from auth.audit_log_entries a
     where a.payload ->> 'action' = 'login'
       and (a.payload ->> 'actor_id') ~ '^[0-9a-f-]{36}$'
     group by 1
  ),
  sess as (
    select s.user_id, count(*)::int as n, min(s.created_at) as first_at
      from auth.sessions s
     group by s.user_id
  ),
  logged as (
    select u.user_id, count(*)::int as n, min(u.created_at) as first_at
      from public.usage_log u
     where u.event = 'signed_in'
     group by u.user_id
  ),
  logins as (
    select x.user_id, max(x.n) as n, min(x.first_at) as first_at
      from (select * from audit union all select * from sess union all select * from logged) x
     group by x.user_id
  ),
  days as (
    select x.user_id,
           count(distinct (x.created_at at time zone 'Europe/London')::date)::int as n,
           max(x.created_at) as last_at
      from (
        select s.user_id, s.created_at from public.site_events s where s.user_id is not null
        union all
        select u.user_id, u.created_at from public.usage_log u
      ) x
     group by x.user_id
  )
  select coalesce(l.user_id, d.user_id), coalesce(l.n, 0), l.first_at, coalesce(d.n, 0), d.last_at
    from logins l
    full join days d on d.user_id = l.user_id;
$$;

revoke all on function public.studio_report_activity() from public, anon, authenticated;
grant execute on function public.studio_report_activity() to service_role;

-- A check: how many members it now finds sign-ins for.
select count(*) filter (where sign_ins > 0) as members_with_sign_ins,
       round(avg(sign_ins) filter (where sign_ins > 0), 1) as average_sign_ins
  from public.studio_report_activity();
