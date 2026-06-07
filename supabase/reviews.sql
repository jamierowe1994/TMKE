-- TMKE studio — "Send for review" requests.
-- A sender (signed-in marketer) snapshots a design and sends it to a teammate's
-- email; the teammate opens /review/<id> (link-based, no account needed) to
-- comment + approve or request changes. Run after schema.sql.

create table if not exists public.reviews (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  page_images        jsonb not null default '[]'::jsonb,   -- rasterised pages: [dataURL|null]
  design_comments    jsonb not null default '[]'::jsonb,   -- comments left in the editor: [{page, text}]
  review_comments    jsonb not null default '[]'::jsonb,   -- comments the reviewer adds: [{text, ts}]
  reviewer_email     text not null,
  message            text,
  requested_by       uuid,                                 -- auth.users id of the sender
  requested_by_email text,
  status             text not null default 'pending'
                     check (status in ('pending', 'approved', 'changes_requested')),
  decision_note      text,
  decided_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists reviews_requested_by_idx on public.reviews (requested_by);
create index if not exists reviews_status_idx on public.reviews (status);

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS. The review is opened via an unguessable UUID link, so we allow anon
-- read/decision by id (link-based review with no reviewer account). Signed-in
-- senders can always create + see their own requests.
-- ============================================================
alter table public.reviews enable row level security;

drop policy if exists "reviews insert authed" on public.reviews;
create policy "reviews insert authed"
  on public.reviews for insert
  to authenticated
  with check (true);

drop policy if exists "reviews read" on public.reviews;
create policy "reviews read"
  on public.reviews for select
  using (true);                         -- id is a UUID; the link is the secret

drop policy if exists "reviews decide" on public.reviews;
create policy "reviews decide"
  on public.reviews for update
  using (true)
  with check (true);                    -- reviewer (anon) approves / requests changes via the link
