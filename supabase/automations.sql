-- ============================================================================
-- TMKE Marketing Automations — Phase 1 data model
-- A simpler, TMKE-native take on GoHighLevel workflows:
--   * contacts                — the unified CRM spine (email-keyed), upserted
--                               from every touchpoint (enquiry, booking, order,
--                               account signup). Carries tags / DND / opt-in.
--   * contact_notes / _tasks  — notes + tasks against a contact (trigger/action
--                               targets: "note added", "task completed").
--   * automations             — a workflow: a trigger + a node graph (the canvas).
--   * automation_enrollments  — a contact running through an automation (current
--                               node + when to advance, for waits/drips).
--   * automation_runs         — per-step execution log (audit + debugging).
-- The builder UI lives at /admin/automations; the Worker runs the engine.
-- Safe to re-run (idempotent).
-- ============================================================================

-- ---- Contacts: the CRM spine ----------------------------------------------
create table if not exists public.contacts (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,                 -- identity
  user_id           uuid references auth.users(id) on delete set null,  -- linked account, if any
  first_name        text,
  last_name         text,
  phone             text,
  company           text,
  tags              text[] not null default '{}',
  lifecycle         text not null default 'lead',         -- lead | customer | member | past
  marketing_opt_in  boolean not null default false,
  dnd               boolean not null default false,       -- do-not-contact (all channels)
  dnd_email         boolean not null default false,       -- email specifically
  source            text,                                 -- where they first came from
  last_seen_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists contacts_lifecycle_idx on public.contacts (lifecycle, updated_at desc);
create index if not exists contacts_tags_idx       on public.contacts using gin (tags);

create table if not exists public.contact_notes (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  body        text not null,
  author      text,
  created_at  timestamptz not null default now()
);
create index if not exists contact_notes_contact_idx on public.contact_notes (contact_id, created_at desc);

create table if not exists public.contact_tasks (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid not null references public.contacts(id) on delete cascade,
  title         text not null,
  detail        text,
  due_at        timestamptz,
  status        text not null default 'open' check (status in ('open', 'done')),
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists contact_tasks_contact_idx on public.contact_tasks (contact_id, status);

-- ---- Automations: the workflow definition ----------------------------------
-- `graph` holds the visual canvas: { nodes:[{id,type,config,x,y}], edges:[{from,to,branch}] }.
-- `trigger_type` + `trigger_config` describe what enrols a contact.
create table if not exists public.automations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null default 'Untitled automation',
  status          text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  trigger_type    text,                                   -- contact_created | tag_added | form_submitted | order_placed | ...
  trigger_config  jsonb not null default '{}'::jsonb,
  graph           jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  re_enroll       boolean not null default false,         -- may a contact re-enter after finishing?
  enrolled_count  integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists automations_status_idx on public.automations (status, updated_at desc);
create index if not exists automations_trigger_idx on public.automations (trigger_type) where status = 'active';

-- ---- Enrollments: a contact moving through an automation -------------------
create table if not exists public.automation_enrollments (
  id              uuid primary key default gen_random_uuid(),
  automation_id   uuid not null references public.automations(id) on delete cascade,
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  status          text not null default 'active' check (status in ('active', 'waiting', 'completed', 'stopped', 'error')),
  current_node_id text,                                   -- node id within the graph
  next_run_at     timestamptz default now(),             -- when the engine should next advance this enrolment
  context         jsonb not null default '{}'::jsonb,     -- trigger payload + accumulated vars
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- The engine tick selects due rows: status in (active,waiting) and next_run_at <= now().
create index if not exists enrollments_due_idx on public.automation_enrollments (status, next_run_at);
create index if not exists enrollments_contact_idx on public.automation_enrollments (contact_id);
-- One live enrolment per contact per automation (unless re-enroll is allowed; the
-- engine checks `automations.re_enroll` before inserting a fresh one).
create unique index if not exists enrollments_unique_live
  on public.automation_enrollments (automation_id, contact_id)
  where status in ('active', 'waiting');

create table if not exists public.automation_runs (
  id             uuid primary key default gen_random_uuid(),
  enrollment_id  uuid references public.automation_enrollments(id) on delete cascade,
  automation_id  uuid,
  contact_id     uuid,
  node_id        text,
  node_type      text,
  outcome        text,                                    -- ok | skipped | error
  detail         text,
  created_at     timestamptz not null default now()
);
create index if not exists automation_runs_enrollment_idx on public.automation_runs (enrollment_id, created_at);

-- ---- updated_at touch triggers ---------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

do $$ begin
  perform 1;
end $$;
drop trigger if exists trg_touch_contacts on public.contacts;
create trigger trg_touch_contacts before update on public.contacts
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_touch_automations on public.automations;
create trigger trg_touch_automations before update on public.automations
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_touch_enrollments on public.automation_enrollments;
create trigger trg_touch_enrollments before update on public.automation_enrollments
  for each row execute function public.touch_updated_at();

-- ---- normalize_contact_tags: reconcile a contact's tags to the rules --------
-- Consent is one state (Unsubscribed > Newsletter-Subscriber > Marketing-Not-Opted-In);
-- SMM-Status is one value (Active > Paused > Ended); becoming a client supersedes
-- that service's lead tags. Applied on every write (see also contact_tag_rules.sql,
-- which carries the one-off backfill). The Worker + admin drawer mirror this in JS.
create or replace function public.normalize_contact_tags(p_tags text[])
returns text[] language plpgsql immutable as $$
declare t text[];
begin
  t := array(select distinct x from unnest(coalesce(p_tags, '{}')) x where x is not null and btrim(x) <> '');
  if 'Unsubscribed' = any(t) then
    t := array(select x from unnest(t) x where x not in ('Newsletter-Subscriber', 'Marketing-Not-Opted-In'));
  elsif 'Newsletter-Subscriber' = any(t) then
    t := array(select x from unnest(t) x where x <> 'Marketing-Not-Opted-In');
  end if;
  if (select count(*) from unnest(t) x where x like 'SMM-Status:%') > 1 then
    t := array(select x from unnest(t) x where x not like 'SMM-Status:%')
         || (case when 'SMM-Status: Active' = any(t) then 'SMM-Status: Active'
                  when 'SMM-Status: Paused' = any(t) then 'SMM-Status: Paused'
                  else 'SMM-Status: Ended' end);
  end if;
  if exists (select 1 from unnest(t) x where x like 'SMM-Status:%') then
    t := array(select x from unnest(t) x where x not in ('Interest: SMM', 'Discovery-Call-Booked: SMM'));
  end if;
  if 'Videography-Client' = any(t) then
    t := array(select x from unnest(t) x where x not in ('Interest: Videography', 'Discovery-Call-Booked: Videography'));
  end if;
  return t;
end $$;

-- ---- upsert_contact: the single entry point every touchpoint calls ----------
-- Inserts or updates a contact by email WITHOUT clobbering existing values with
-- nulls, merges in any new tags (then reconciles them via normalize_contact_tags),
-- bumps last_seen, and (optionally) promotes the lifecycle. Returns the contact
-- id. Called by the Worker with the service role.
create or replace function public.upsert_contact(
  p_email            text,
  p_first_name       text default null,
  p_last_name        text default null,
  p_phone            text default null,
  p_company          text default null,
  p_source           text default null,
  p_lifecycle        text default null,
  p_marketing_opt_in boolean default null,
  p_tags             text[] default null,
  p_user_id          uuid default null
) returns uuid
language plpgsql security definer as $$
declare v_id uuid;
begin
  insert into public.contacts (email, first_name, last_name, phone, company, source, user_id,
    lifecycle, marketing_opt_in, tags, last_seen_at)
  values (lower(trim(p_email)), p_first_name, p_last_name, p_phone, p_company, p_source, p_user_id,
    coalesce(p_lifecycle, 'lead'), coalesce(p_marketing_opt_in, false),
    public.normalize_contact_tags(coalesce(p_tags, '{}')), now())
  on conflict (email) do update set
    first_name       = coalesce(excluded.first_name, public.contacts.first_name),
    last_name        = coalesce(excluded.last_name,  public.contacts.last_name),
    phone            = coalesce(excluded.phone,      public.contacts.phone),
    company          = coalesce(excluded.company,    public.contacts.company),
    user_id          = coalesce(excluded.user_id,    public.contacts.user_id),
    source           = coalesce(public.contacts.source, excluded.source),  -- keep the original source
    lifecycle        = coalesce(p_lifecycle, public.contacts.lifecycle),
    marketing_opt_in = public.contacts.marketing_opt_in or coalesce(p_marketing_opt_in, false),
    tags             = public.normalize_contact_tags(public.contacts.tags || coalesce(p_tags, '{}')),
    last_seen_at     = now()
  returning id into v_id;
  return v_id;
end; $$;

-- ---- RLS — admin-only (Worker uses the service role, which bypasses RLS) -----
-- Gated on public.is_admin(), NOT merely on being signed in: the admin area and
-- the member hub share one anon key and one `authenticated` role, so "signed in"
-- would include every member. See supabase/admin_tables_rls.sql.
-- PREREQUISITE: public.admins must be populated (supabase/admins.sql) or staff
-- lose access to the backstage.
do $$
declare t text;
begin
  foreach t in array array[
    'contacts','contact_notes','contact_tasks','automations',
    'automation_enrollments','automation_runs'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s admin" on public.%I;', t, t);
    execute format(
      'create policy "%s admin" on public.%I for all to authenticated '
      'using (public.is_admin()) with check (public.is_admin());', t, t);
  end loop;
end $$;
