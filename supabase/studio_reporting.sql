-- Studio reporting (Danielle, 18 Nov 2026: Insights › Studio reporting).
--
-- How often each member signs in and uses the Member Hub, for the Studio
-- reporting page. Two things it can't read for itself:
--
--   sign_ins     how many times they've signed in, from Supabase's own
--                sign-in records (auth.audit_log_entries). Staying signed in
--                doesn't count again, so a member who never signs out shows 1.
--   active_days  how many different days they've used the Member Hub, from
--                the site's own log (only members who accepted analytics
--                cookies, before 17 Nov) and the usage log (everyone, from
--                17 Nov). Counted in UK days.
--
-- Only the server (the Worker, with the service key) can run it; members and
-- the browser can't. Changes nothing. Sends nothing. Safe to run twice.

create or replace function public.studio_report_activity()
returns table (user_id uuid, sign_ins integer, first_sign_in timestamptz, active_days integer, last_active timestamptz)
language sql
stable
security definer
set search_path = public, auth
as $$
  with logins as (
    select (a.payload ->> 'actor_id')::uuid as user_id, count(*)::int as n, min(a.created_at) as first_at
      from auth.audit_log_entries a
     where a.payload ->> 'action' = 'login'
       and (a.payload ->> 'actor_id') ~ '^[0-9a-f-]{36}$'
     group by 1
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

-- A check: how many members it found sign-ins and Hub days for.
select count(*) filter (where sign_ins > 0) as members_with_sign_ins,
       count(*) filter (where active_days > 0) as members_with_hub_days
  from public.studio_report_activity();
