-- TMKE blog (Insights) — admin-driven posts
-- Run this once in the Supabase SQL editor on top of the existing schema.

create extension if not exists "pgcrypto";

-- ============================================================
-- blog_posts — every Insights article
-- ============================================================
create table if not exists public.blog_posts (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,
  title               text not null,
  eyebrow             text,                              -- small caps line above title
  category            text not null default 'Insights', -- Branding · Strategy · Content · Industry
  standfirst          text,                              -- italic standfirst paragraph
  body_markdown       text not null default '',          -- editor input (markdown)
  body_html           text not null default '',          -- pre-rendered HTML for the public page
  hero_image_url      text,
  hero_image_alt      text,
  read_time_minutes   integer,                           -- nullable; auto-computed from body if blank
  author_name         text default 'The TMKE Desk',
  status              text not null default 'draft'
                      check (status in ('draft', 'published', 'archived')),
  publish_date        date,                              -- when the post is dated on the public site
  published_at        timestamptz,                       -- first time status flipped to 'published'

  -- ─── SEO ───
  seo_title           text,                              -- optional override for <title>; falls back to title
  seo_description     text,                              -- meta description (~155 chars)
  seo_keywords        text[] not null default '{}',      -- target keywords
  seo_og_image_url    text,                              -- optional override for og:image
  seo_canonical_url   text,                              -- optional canonical override
  seo_noindex         boolean not null default false,    -- robots noindex

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists blog_posts_status_pub_idx
  on public.blog_posts (status, publish_date desc);
create index if not exists blog_posts_category_idx
  on public.blog_posts (category);

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

-- Stamp published_at the first time a post flips to published
create or replace function public.blog_posts_stamp_published()
returns trigger language plpgsql as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published') and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists blog_posts_stamp_published on public.blog_posts;
create trigger blog_posts_stamp_published
  before update on public.blog_posts
  for each row execute function public.blog_posts_stamp_published();

-- ============================================================
-- RLS — anyone can read published posts; authenticated users (admin)
-- can do everything else.
-- ============================================================
alter table public.blog_posts enable row level security;

drop policy if exists "blog_posts read published" on public.blog_posts;
create policy "blog_posts read published"
  on public.blog_posts for select
  using (status = 'published');

drop policy if exists "blog_posts read all when authed" on public.blog_posts;
create policy "blog_posts read all when authed"
  on public.blog_posts for select
  to authenticated
  using (true);

drop policy if exists "blog_posts write authed" on public.blog_posts;
create policy "blog_posts write authed"
  on public.blog_posts for insert
  to authenticated
  with check (true);

drop policy if exists "blog_posts update authed" on public.blog_posts;
create policy "blog_posts update authed"
  on public.blog_posts for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "blog_posts delete authed" on public.blog_posts;
create policy "blog_posts delete authed"
  on public.blog_posts for delete
  to authenticated
  using (true);
