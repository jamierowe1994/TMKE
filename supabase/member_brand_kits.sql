-- Per-member brand kit — each signed-in member's own colours / fonts / logos,
-- stored against their account so the design Studio opens with THEIR kit on any
-- device (previously the kit lived only in the browser's localStorage). The
-- whole kit is kept as one jsonb blob matching the shape the profile page and
-- editor.js already use (so there's no schema drift): { company, tone, colors[],
-- fonts{heading,body}, logos[], headshot, updatedAt }.
--
-- Safe to re-run.

create table if not exists public.member_brand_kits (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  kit        jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.member_brand_kits enable row level security;

-- A member only ever reads or writes their OWN kit. No cross-user access;
-- the service role (Worker) bypasses RLS if it ever needs to.
drop policy if exists "own brand kit read"   on public.member_brand_kits;
drop policy if exists "own brand kit insert" on public.member_brand_kits;
drop policy if exists "own brand kit update" on public.member_brand_kits;

create policy "own brand kit read"
  on public.member_brand_kits for select
  using (auth.uid() = user_id);

create policy "own brand kit insert"
  on public.member_brand_kits for insert
  with check (auth.uid() = user_id);

create policy "own brand kit update"
  on public.member_brand_kits for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
