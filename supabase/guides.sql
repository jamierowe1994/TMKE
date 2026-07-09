-- TMKE member hub — Learn / Guides (admin-driven)
-- Run once in the Supabase SQL editor. Mirrors blog_posts, but guides are
-- members-only by default (the Learn section lives behind the /account gate).

create extension if not exists "pgcrypto";

-- Shared updated_at helper (safe to re-create).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================
-- guides — a guide or a multi-lesson mini-course
-- ============================================================
create table if not exists public.guides (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  -- topic slug (see src/data/guide-topics.js for the labels/icons):
  --  getting-started | social-intro | instagram-facebook | content-strategy
  --  | design-branding | reels-video | analytics
  topic         text not null default 'getting-started',
  kind          text not null default 'guide'
                check (kind in ('guide', 'course')),
  summary       text,                                   -- short line on cards
  cover_url     text,
  cover_alt     text,
  -- Ordered lessons/sections: [{ "title": "...", "body_html": "..." }]
  -- A single Guide is just one lesson; a Course has several.
  lessons       jsonb not null default '[]'::jsonb,
  est_minutes   integer,                                -- nullable; shown as "~N min"
  status        text not null default 'draft'
                check (status in ('draft', 'published', 'archived')),
  audience      text not null default 'members'
                check (audience in ('members', 'public')),
  sort_order    integer not null default 0,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists guides_topic_idx on public.guides (topic, sort_order);
create index if not exists guides_status_idx on public.guides (status);

drop trigger if exists guides_set_updated_at on public.guides;
create trigger guides_set_updated_at
  before update on public.guides
  for each row execute function public.set_updated_at();

-- Stamp published_at the first time a guide flips to published.
create or replace function public.guides_stamp_published()
returns trigger language plpgsql as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published') and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists guides_stamp_published on public.guides;
create trigger guides_stamp_published
  before update on public.guides
  for each row execute function public.guides_stamp_published();

-- ============================================================
-- RLS — public guides readable by anyone; members-only guides readable by any
-- signed-in user; authenticated (admin UI) can read all + write. (Mirrors the
-- blog_posts policy shape; harden writes to is_admin() later.)
-- ============================================================
alter table public.guides enable row level security;

drop policy if exists "guides read public" on public.guides;
create policy "guides read public"
  on public.guides for select
  using (status = 'published' and audience = 'public');

drop policy if exists "guides read published members" on public.guides;
create policy "guides read published members"
  on public.guides for select
  to authenticated
  using (status = 'published');

drop policy if exists "guides read all authed" on public.guides;
create policy "guides read all authed"
  on public.guides for select
  to authenticated
  using (true);

drop policy if exists "guides write authed" on public.guides;
create policy "guides write authed"
  on public.guides for insert
  to authenticated
  with check (true);

drop policy if exists "guides update authed" on public.guides;
create policy "guides update authed"
  on public.guides for update
  to authenticated
  using (true) with check (true);

drop policy if exists "guides delete authed" on public.guides;
create policy "guides delete authed"
  on public.guides for delete
  to authenticated
  using (true);
