-- TMKE admin centre — storage bucket policies
-- Run this AFTER you've created the `pack-images` bucket in the Supabase
-- dashboard (Storage → New bucket → name: pack-images → Public bucket: ON).

-- Public read on objects in pack-images
drop policy if exists "pack-images public read" on storage.objects;
create policy "pack-images public read"
  on storage.objects for select
  using (bucket_id = 'pack-images');

-- Authenticated users can upload, overwrite, and delete
drop policy if exists "pack-images authed insert" on storage.objects;
create policy "pack-images authed insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'pack-images');

drop policy if exists "pack-images authed update" on storage.objects;
create policy "pack-images authed update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'pack-images')
  with check (bucket_id = 'pack-images');

drop policy if exists "pack-images authed delete" on storage.objects;
create policy "pack-images authed delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'pack-images');
