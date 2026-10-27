-- ============================================================================
-- Content Calendar subscription: the months and their posts (Danielle, 27 Oct 2026).
--
-- One month per edition: The Lettings Experts write their own; The Property
-- Experts, Prestige and independent agents share the copy but each has its own
-- designs, so each is its own month (the builder copies rows across). A month's
-- ~20 posts each carry the date, whether the post belongs to that day, the
-- type, the content pillar, up to three captions, how to edit it, a reel
-- prompt, the platforms and the template it opens.
--
-- Built in Admin > Design studio > Content calendar. Hidden from members for
-- now: only admins can read these tables. When the paywall goes in, read access
-- opens to members whose access (the Worker's /access/me) includes the month.
--
-- Also:
--   templates.collection  'calendar' marks a Content Calendar template, so it
--                         sits on its own tab and never in a pack or the shop.
--   guides.level          which level a course belongs to. Everything is Free
--                         for now; nothing reads it yet.
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.content_months (
  id          uuid primary key default gen_random_uuid(),
  month       date not null,                          -- first day of the month
  edition     text not null default 'property'
              check (edition in ('property', 'prestige', 'independent', 'lettings')),
  status      text not null default 'draft'
              check (status in ('draft', 'published')),
  intro       text,                                   -- a line about the month
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (month, edition)
);

create table if not exists public.content_month_posts (
  id           uuid primary key default gen_random_uuid(),
  month_id     uuid not null references public.content_months(id) on delete cascade,
  post_date    date,
  date_tied    boolean not null default false,        -- belongs to its day (Bonfire Night)
  occasion     text,                                  -- what the day is, for the "move it?" warning
  title        text,
  post_type    text not null default 'single'
               check (post_type in ('single', 'carousel', 'reel')),
  pillar       text,                                  -- content pillar
  captions     text[] not null default '{}',          -- up to three; the first is the example
  how_to_edit  text,
  reel_prompt  text,
  platforms    text[] not null default '{instagram,facebook}',
  template_id  text references public.templates(id) on delete set null,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists content_month_posts_month_idx
  on public.content_month_posts (month_id, post_date, sort_order);
create index if not exists content_months_status_idx
  on public.content_months (status, month desc);

alter table public.content_months enable row level security;
alter table public.content_month_posts enable row level security;

drop policy if exists "content_months admin" on public.content_months;
create policy "content_months admin"
  on public.content_months for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "content_month_posts admin" on public.content_month_posts;
create policy "content_month_posts admin"
  on public.content_month_posts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.content_months_touch()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists content_months_touch on public.content_months;
create trigger content_months_touch before update on public.content_months
  for each row execute function public.content_months_touch();

drop trigger if exists content_month_posts_touch on public.content_month_posts;
create trigger content_month_posts_touch before update on public.content_month_posts
  for each row execute function public.content_months_touch();

-- Content Calendar templates live on their own tab.
alter table public.templates add column if not exists collection text;
alter table public.templates drop constraint if exists templates_collection_check;
alter table public.templates add constraint templates_collection_check
  check (collection is null or collection = 'calendar');
create index if not exists templates_collection_idx on public.templates (collection);

-- A level on every course, Free for now.
alter table public.guides add column if not exists level text not null default 'free';
alter table public.guides drop constraint if exists guides_level_check;
alter table public.guides add constraint guides_level_check
  check (level in ('free', 'calendar', 'scheduling', 'done_for_you'));
