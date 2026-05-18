-- TMKE admin centre — storage policies for the `brand-fonts` bucket.
-- Run this AFTER you create the bucket in the Supabase dashboard:
--   Storage → New bucket → name: brand-fonts → Public: ON

drop policy if exists "brand-fonts public read" on storage.objects;
create policy "brand-fonts public read"
  on storage.objects for select
  using (bucket_id = 'brand-fonts');

drop policy if exists "brand-fonts authed insert" on storage.objects;
create policy "brand-fonts authed insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'brand-fonts');

drop policy if exists "brand-fonts authed update" on storage.objects;
create policy "brand-fonts authed update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'brand-fonts')
  with check (bucket_id = 'brand-fonts');

drop policy if exists "brand-fonts authed delete" on storage.objects;
create policy "brand-fonts authed delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'brand-fonts');
