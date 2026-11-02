-- Client portal: chosen Library folders, shared with a client (Danielle, 2 Nov 2026).
--
-- Jack edits a shoot into the Library (our R2 storage). Some clients, Fine &
-- Country first, need to watch and download it themselves, and SharePoint kept
-- getting broken. A portal is made in Videography › Client portals: a name
-- (who it's for), a private link plus a passcode, and the Library folders
-- ticked for them. Anything added to those folders later shows up on its own.
-- They can watch and download; nothing else. It belongs to Videography, not to
-- a social media card: brand days like F&C's bootcamp have no card.
--
-- The client page never reads this table: it goes through the Worker
-- (/portal/*), which reads with the service role and checks the passcode. So
-- only admins can read it here, and the passcode can be stored as typed, for
-- the team to read out or resend.
--
--   name         who it's for, as the client sees it ("Fine & Country")
--   first_name   who the team writes to, for the copied message
--   token        the unguessable part of the link (tmke.co.uk/portal?c=…)
--   passcode     6 characters, not case-sensitive; changing it signs every
--                browser out, because the Worker's sign-in covers it
--   folders      Library folders as storage prefixes ("deliverables/<name>/")
--   enabled      off = the link stops working; the row is kept, so switching
--                it back on gives the same link and passcode
--   failed_tries, locked_until   8 wrong passcodes in a row lock it for 15 minutes
--
-- Run in the Supabase SQL editor. Safe to re-run.

-- The first version (2 Nov, earlier) hung a portal off a social media card,
-- keyed by smm_lead_id. If that one was run, it is converted here in place:
-- each portal keeps its link, passcode and folders, gets its own id, and takes
-- its name from the card it hung off.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'client_portals' and column_name = 'smm_lead_id') then
    alter table public.client_portals add column if not exists id uuid not null default gen_random_uuid();
    alter table public.client_portals add column if not exists name text;
    alter table public.client_portals add column if not exists first_name text;
    update public.client_portals c
       set name = coalesce(nullif(btrim(l.business), ''), nullif(btrim(l.full_name), ''),
                           nullif(btrim(concat_ws(' ', l.first_name, l.last_name)), '')),
           first_name = coalesce(c.first_name, l.first_name)
      from public.smm_leads l
     where l.id = c.smm_lead_id and c.name is null;
    update public.client_portals set name = 'Client' where name is null or btrim(name) = '';
    alter table public.client_portals drop constraint if exists client_portals_pkey;
    alter table public.client_portals add primary key (id);
    alter table public.client_portals drop column smm_lead_id;
    alter table public.client_portals alter column name set not null;
    alter table public.client_portals add constraint client_portals_name_check check (length(btrim(name)) > 0);
  end if;
end
$$;

create table if not exists public.client_portals (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(btrim(name)) > 0),
  first_name     text,
  enabled        boolean not null default true,
  token          text not null unique check (length(token) >= 24),
  passcode       text not null check (passcode ~ '^[A-Z0-9]{6}$'),
  folders        text[] not null default '{}',
  failed_tries   integer not null default 0,
  locked_until   timestamptz,
  last_opened_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     text
);

create or replace function public.client_portals_touch()
  returns trigger
  language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists client_portals_touch on public.client_portals;
create trigger client_portals_touch
  before update on public.client_portals
  for each row execute function public.client_portals_touch();

alter table public.client_portals enable row level security;

-- Admins only, both ways. Members and the public never read it directly.
drop policy if exists "client_portals admin" on public.client_portals;
create policy "client_portals admin"
  on public.client_portals for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Check: every portal, by name. Each row should have an id and a name.
select id, name, enabled, cardinality(folders) as folders from public.client_portals order by name;
