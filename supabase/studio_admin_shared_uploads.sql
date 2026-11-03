-- TMKE: a shared uploads library for the admin Studio (Danielle, 3 Nov 2026)
--
-- In the admin Studio, uploads and their folders are shared between every
-- admin, so a folder Danielle makes (and the pictures in it) are there for
-- Sam too. They live in calendar-assets under admin-shared/uploads/, beside
-- the folders' own notes (.library.json). Members are unchanged: their
-- uploads stay in their own <user_id>/uploads/ folder, as calendar_storage.sql
-- sets out.
--
-- Reading needs nothing new: the bucket is public (calendar_storage.sql).
-- These let an admin, and only an admin (public.is_admin(), admins.sql), add,
-- replace and remove files under admin-shared/. Safe to run twice.

drop policy if exists "calendar-assets admin shared insert" on storage.objects;
create policy "calendar-assets admin shared insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'calendar-assets'
    and (storage.foldername(name))[1] = 'admin-shared'
    and public.is_admin()
  );

drop policy if exists "calendar-assets admin shared update" on storage.objects;
create policy "calendar-assets admin shared update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'calendar-assets'
    and (storage.foldername(name))[1] = 'admin-shared'
    and public.is_admin()
  )
  with check (
    bucket_id = 'calendar-assets'
    and (storage.foldername(name))[1] = 'admin-shared'
    and public.is_admin()
  );

drop policy if exists "calendar-assets admin shared delete" on storage.objects;
create policy "calendar-assets admin shared delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'calendar-assets'
    and (storage.foldername(name))[1] = 'admin-shared'
    and public.is_admin()
  );
