-- TMKE — blog: a reusable style template, and publishing to both places at once
-- ---------------------------------------------------------------------------
-- Two changes, both to blog_posts and one new table.
--
-- 1. audience gains 'both'. It was 'public' or 'members', which forced a choice
--    nobody actually wants to make for most pieces: a member has no guarantee
--    of having seen the public blog, so a post worth reading is worth putting
--    in front of both.
--
-- 2. body_styles: the typography for the article's body, held as data rather
--    than baked into every element as an inline style. Shape:
--
--      { "p": { "font": "...", "size": "16px", "lh": "1.7" },
--        "h2": {...}, "h3": {...}, "blockquote": {...} }
--
--    Rendered as one scoped stylesheet on the article, so it reaches text typed
--    after the styling was chosen - which is the thing per-element inline styles
--    could never do. Anything set on a specific run of text from the toolbar is
--    still inline, and still wins.
--
-- 3. blog_style_templates: the same shape, saved under a name, so the choices
--    made once can be dropped onto the next article instead of rebuilt by hand.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

-- ---- 1. audience: allow 'both' -------------------------------------------
alter table public.blog_posts
  add column if not exists audience text not null default 'public';

alter table public.blog_posts drop constraint if exists blog_posts_audience_check;
alter table public.blog_posts
  add constraint blog_posts_audience_check check (audience in ('public', 'members', 'both'));

create index if not exists blog_posts_audience_idx
  on public.blog_posts (audience, status, publish_date desc);

-- ---- 2. the article's own typography --------------------------------------
alter table public.blog_posts
  add column if not exists body_styles jsonb not null default '{}'::jsonb;

comment on column public.blog_posts.body_styles is
  'Body typography per block type — { p|h2|h3|blockquote: { font, size, lh } }. Rendered as one scoped stylesheet on the article. Inline styles set from the editor toolbar override it.';

-- ---- 3. saved templates ---------------------------------------------------
create table if not exists public.blog_style_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  styles      jsonb not null default '{}'::jsonb,
  -- The one a new article starts from. Kept honest by the trigger below rather
  -- than by whoever remembers to untick the last one.
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists blog_style_templates_name_idx
  on public.blog_style_templates (lower(name));

-- Only ever one default.
create or replace function public.blog_style_templates_one_default()
returns trigger language plpgsql as $$
begin
  if new.is_default then
    update public.blog_style_templates set is_default = false
    where id <> new.id and is_default;
  end if;
  return new;
end $$;

drop trigger if exists trg_blog_style_templates_one_default on public.blog_style_templates;
create trigger trg_blog_style_templates_one_default
  after insert or update of is_default on public.blog_style_templates
  for each row when (new.is_default) execute function public.blog_style_templates_one_default();

drop trigger if exists trg_blog_style_templates_touch on public.blog_style_templates;
create trigger trg_blog_style_templates_touch
  before update on public.blog_style_templates
  for each row execute function public.set_updated_at();

-- ---- RLS: readable by the site, written by admins -------------------------
alter table public.blog_style_templates enable row level security;

drop policy if exists "blog_style_templates read"  on public.blog_style_templates;
drop policy if exists "blog_style_templates admin" on public.blog_style_templates;

create policy "blog_style_templates read"
  on public.blog_style_templates for select
  using (true);

create policy "blog_style_templates admin"
  on public.blog_style_templates for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
