-- TMKE blog image storage — public bucket so hero images are
-- directly addressable from the customer site.
--
-- Run after blog_posts.sql.

insert into storage.buckets (id, name, public)
  values ('blog-images', 'blog-images', true)
  on conflict (id) do update set public = excluded.public;

-- Public read for everyone
drop policy if exists "blog-images public read" on storage.objects;
create policy "blog-images public read"
  on storage.objects for select
  using (bucket_id = 'blog-images');

-- Authenticated (admin) users can upload, update, delete
drop policy if exists "blog-images authed write" on storage.objects;
create policy "blog-images authed write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'blog-images');

drop policy if exists "blog-images authed update" on storage.objects;
create policy "blog-images authed update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'blog-images')
  with check (bucket_id = 'blog-images');

drop policy if exists "blog-images authed delete" on storage.objects;
create policy "blog-images authed delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'blog-images');
