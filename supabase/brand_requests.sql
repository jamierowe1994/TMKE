-- "I work for one of these brands"
--
-- An agent on a personal email address gets nothing, because nothing in our
-- records says they are an agent — and they have no way to tell us. This is
-- that way: they pick their brand, we check it against what we already hold,
-- and a person decides. Nothing is released by the request itself.
--
-- Run in the Supabase SQL editor. Safe to re-run.

create table if not exists public.brand_access_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  email       text not null,
  name        text,
  brand       text not null,                      -- the brand they say they are in
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'rejected')),
  contact_id  uuid references public.contacts (id) on delete set null,  -- who we matched them to
  note        text,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  text
);

create index if not exists brand_access_requests_status_idx
  on public.brand_access_requests (status, created_at desc);

-- One open request per person: asking twice is the same ask.
create unique index if not exists brand_access_requests_one_open
  on public.brand_access_requests (user_id)
  where status = 'pending';

alter table public.brand_access_requests enable row level security;

-- A member sees their own request (so the hub can say "we're looking at it")
-- and makes it. Deciding is the Worker's, with the service key.
drop policy if exists "own brand request read" on public.brand_access_requests;
create policy "own brand request read"
  on public.brand_access_requests for select
  to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "own brand request insert" on public.brand_access_requests;
create policy "own brand request insert"
  on public.brand_access_requests for insert
  to authenticated
  with check (user_id = auth.uid());
