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

-- The first version (2 Nov, earlier) hung a portal off a social media card.
-- If that one was run and nothing was made with it, it is replaced here.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'client_portals' and column_name = 'smm_lead_id')
     and not exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'client_portals' and column_name = 'id') then
    if (select count(*) from public.client_portals) = 0 then
      drop table public.client_portals;
    else
      raise exception 'client_portals already holds portals in the first shape. Ask Claude to move them across before running this.';
    end if;
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

-- Check: the table is there, and how many portals it holds.
select count(*) as portals from public.client_portals;
