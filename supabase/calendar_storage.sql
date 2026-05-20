-- TMKE — content calendar storage policies
-- Run this AFTER you've created the `calendar-assets` bucket in the
-- Supabase dashboard:
--   Storage → New bucket → name: calendar-assets → Public bucket: ON
--
-- Why a public bucket: the v2 auto-poster will call Instagram's Graph API,
-- which requires a publicly-accessible image URL on the create-container
-- step. Keeping the bucket public from day one means we don't have to
-- generate signed URLs at posting time (or migrate the bucket later).
--
-- Object paths are namespaced by user_id, e.g. `<user_id>/<uuid>.png`.
-- We rely on that prefix for the per-user write policies below.

-- Public read on objects in calendar-assets (so the reminder email can
-- embed the image, and the calendar's day cells can render thumbnails
-- without signed URLs).
drop policy if exists "calendar-assets public read" on storage.objects;
create policy "calendar-assets public read"
  on storage.objects for select
  using (bucket_id = 'calendar-assets');

-- Authenticated users can upload, BUT only into a folder named after
-- their own user_id. Prevents user A from dropping files into user B's
-- folder. storage.objects.name looks like '<user_id>/<filename>'; the
-- check inspects the leading path segment.
drop policy if exists "calendar-assets owner insert" on storage.objects;
create policy "calendar-assets owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'calendar-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Same shape for update + delete so users can edit/replace their own
-- assets but never touch anyone else's.
drop policy if exists "calendar-assets owner update" on storage.objects;
create policy "calendar-assets owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'calendar-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'calendar-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "calendar-assets owner delete" on storage.objects;
create policy "calendar-assets owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'calendar-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
