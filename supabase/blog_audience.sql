-- Adds an "audience" scope to blog posts so the team can publish to two places:
--   • 'public'  — the front-end website /blog
--   • 'members' — the customer-exclusive "Inside The Edit" feed in /account
-- Existing rows default to 'public'. Safe to run more than once.

alter table public.blog_posts
  add column if not exists audience text not null default 'public';

-- Constrain the values (added separately so re-runs don't error if it exists).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'blog_posts_audience_check'
  ) then
    alter table public.blog_posts
      add constraint blog_posts_audience_check check (audience in ('public', 'members'));
  end if;
end $$;

create index if not exists blog_posts_audience_idx
  on public.blog_posts (audience, status, publish_date desc);
