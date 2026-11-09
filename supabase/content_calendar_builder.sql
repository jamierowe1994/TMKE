-- Content calendar builder (Dani, 9 Nov 2026): the new month page.
--
-- Only adds empty fields. It doesn't change, move or delete any post, so
-- everything already planned in December stays exactly as it is.
--
--   content_months.stage         which of the four steps a month is on (1 to 4)
--   content_months.image_url     the picture on the month's box and card
--   content_months.published_at  the date it went live
--   content_months.shortlist     templates shortlisted for the month, no date
--   content_month_posts.note     a note on a post, for the team only
--
-- Safe to run twice. Sends nothing.

alter table public.content_months
  add column if not exists stage smallint not null default 1,
  add column if not exists image_url text,
  add column if not exists published_at timestamptz,
  add column if not exists shortlist text[] not null default '{}';

alter table public.content_month_posts
  add column if not exists note text;

-- A month that's already live takes the last date it changed as its go-live date.
update public.content_months
   set published_at = updated_at
 where status = 'published' and published_at is null;

select
  'Done' as result,
  (select count(*) from public.content_months) as months_kept,
  (select count(*) from public.content_month_posts) as posts_kept;
