-- Social media: when each lead reached each stage, and why anyone was lost.
-- Danielle, 19 Oct 2026, for Sam's "Client status overview" (admin → Social
-- media → Settings → Client status, with its Excel export).
--
--   smm_stage_events   one row each time a lead's pipeline_stage changes,
--                      written by a trigger, so every way of moving a card
--                      (the board, the file, the Worker) is caught.
--   smm_leads.lost_at / lost_from_stage / lost_reason
--                      set when a lead is marked lost, or an active client is
--                      set to Ended; cleared if they come back.
--
-- Leads that already exist get their history filled in once from what the
-- table holds (created, meeting, start date, last change). Those dates are
-- marked estimated and shown as such. Run once in the Supabase SQL editor.
-- Safe to re-run.

alter table public.smm_leads
  add column if not exists lost_at         timestamptz,
  add column if not exists lost_from_stage text,
  add column if not exists lost_reason     text;

create table if not exists public.smm_stage_events (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.smm_leads(id) on delete cascade,
  stage      text not null,
  reached_at timestamptz not null default now(),
  estimated  boolean not null default false
);
create index if not exists smm_stage_events_lead on public.smm_stage_events (lead_id, reached_at);

alter table public.smm_stage_events enable row level security;
drop policy if exists "smm_stage_events admin" on public.smm_stage_events;
create policy "smm_stage_events admin" on public.smm_stage_events
  for select to authenticated using (public.is_admin());

-- Before a change: stamp the lost fields (and clear them on a return).
create or replace function public.smm_lost_stamp()
  returns trigger language plpgsql
as $$
begin
  if new.pipeline_stage = 'lost' and old.pipeline_stage is distinct from 'lost' then
    new.lost_at := coalesce(new.lost_at, now());
    new.lost_from_stage := coalesce(new.lost_from_stage, old.pipeline_stage);
  elsif new.client_status = 'ended' and old.client_status is distinct from 'ended' then
    new.lost_at := coalesce(new.lost_at, now());
    new.lost_from_stage := coalesce(new.lost_from_stage, 'active_client');
  elsif (old.pipeline_stage = 'lost' and new.pipeline_stage is distinct from 'lost')
     or (old.client_status = 'ended' and new.client_status is distinct from 'ended' and new.pipeline_stage is distinct from 'lost') then
    new.lost_at := null; new.lost_from_stage := null; new.lost_reason := null;
  end if;
  return new;
end $$;

drop trigger if exists smm_lost_stamp on public.smm_leads;
create trigger smm_lost_stamp before update on public.smm_leads
  for each row execute function public.smm_lost_stamp();

-- After a change: log the stage reached.
create or replace function public.smm_stage_log()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.smm_stage_events (lead_id, stage, reached_at)
    values (new.id, coalesce(new.pipeline_stage, 'inquiry'), coalesce(new.created_at, now()));
  elsif new.pipeline_stage is distinct from old.pipeline_stage then
    insert into public.smm_stage_events (lead_id, stage) values (new.id, coalesce(new.pipeline_stage, 'inquiry'));
  end if;
  return null;
exception when others then
  return null;   -- a missing log row never stops the lead being saved
end $$;

drop trigger if exists smm_stage_log on public.smm_leads;
create trigger smm_stage_log after insert or update of pipeline_stage on public.smm_leads
  for each row execute function public.smm_stage_log();

-- History for leads that existed before today, once.
do $$
begin
  -- When they arrived: real.
  insert into public.smm_stage_events (lead_id, stage, reached_at, estimated)
  select l.id, case when l.kind = 'waitlist' or l.pipeline_stage = 'waitlist' then 'waitlist' else 'inquiry' end, l.created_at, false
  from public.smm_leads l
  where not exists (select 1 from public.smm_stage_events e where e.lead_id = l.id);

  -- Their meeting, where one was booked: the meeting date, estimated.
  insert into public.smm_stage_events (lead_id, stage, reached_at, estimated)
  select l.id, 'meeting_set', coalesce(l.meeting_at, l.call_at), true
  from public.smm_leads l
  where coalesce(l.meeting_at, l.call_at) is not null
    and l.pipeline_stage in ('meeting_set', 'proposal_sent', 'contract_signed', 'contract_sent', 'onboarding', 'active_client', 'lost')
    and not exists (select 1 from public.smm_stage_events e where e.lead_id = l.id and e.stage = 'meeting_set');

  -- Active clients: their start date.
  insert into public.smm_stage_events (lead_id, stage, reached_at, estimated)
  select l.id, 'active_client', l.start_date::timestamptz, true
  from public.smm_leads l
  where l.pipeline_stage = 'active_client' and l.start_date is not null
    and not exists (select 1 from public.smm_stage_events e where e.lead_id = l.id and e.stage = 'active_client');

  -- Where they are now, if not logged yet: when the card last changed.
  insert into public.smm_stage_events (lead_id, stage, reached_at, estimated)
  select l.id, l.pipeline_stage, coalesce(l.updated_at, l.created_at), true
  from public.smm_leads l
  where l.pipeline_stage is not null and l.pipeline_stage not in ('inquiry', 'waitlist')
    and not exists (select 1 from public.smm_stage_events e where e.lead_id = l.id and e.stage = l.pipeline_stage);

  -- Lost before today: when the card last changed.
  update public.smm_leads set lost_at = coalesce(updated_at, created_at)
  where pipeline_stage = 'lost' and lost_at is null;
end $$;

notify pgrst, 'reload schema';
