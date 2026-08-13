-- TMKE — customer reviews (leave-a-review page)
-- Run AFTER schema.sql in the Supabase SQL editor.
--
-- One row per submission of the public /leave-a-review page. Not tied to a
-- booking or login — anyone can leave one. Distinct from the unrelated
-- `reviews` table (the internal design-annotation review tool used at
-- /review) — deliberately a different name so the two are never confused.
--
-- Anon users can INSERT (so unauthenticated visitors can submit the form)
-- but only authenticated (admin) users can read or delete.

create extension if not exists "pgcrypto";

create table if not exists public.client_reviews (
  id            uuid primary key default gen_random_uuid(),

  name          text not null,
  service       text not null,
  review_text   text not null,

  created_at    timestamptz not null default now()
);

create index if not exists client_reviews_created_at_idx
  on public.client_reviews (created_at desc);

-- ============================================================
-- RLS
-- ============================================================
alter table public.client_reviews enable row level security;

drop policy if exists "client_reviews insert anon" on public.client_reviews;
create policy "client_reviews insert anon"
  on public.client_reviews for insert
  to anon, authenticated
  with check (
    length(coalesce(name, '')) > 0
    and length(coalesce(service, '')) > 0
    and length(coalesce(review_text, '')) > 0
  );

drop policy if exists "client_reviews read authed" on public.client_reviews;
create policy "client_reviews read authed"
  on public.client_reviews for select
  to authenticated
  using (true);

drop policy if exists "client_reviews delete authed" on public.client_reviews;
create policy "client_reviews delete authed"
  on public.client_reviews for delete
  to authenticated
  using (true);
