-- TMKE — files on Marketing Calendar entries (Dani, 16 Oct 2026).
--
-- A newsletter's copy, the details of who it's going to, a document for a
-- local event: uploaded to an entry and opened from it again. They can hold
-- clients' details, so the bucket is PRIVATE: only the member who uploaded a
-- file can read it, through a link that lasts a few minutes. (Pictures for a
-- social post go to calendar-assets as designs do, because the 8am reminder
-- email has to show them.)
--
-- Path: calendar-files/<user id>/<file>  → folder[1] = their user id.
-- Run in the Supabase SQL editor. Safe to re-run. The last statement is a
-- check: it is the result the editor shows.

insert into storage.buckets (id, name, public, file_size_limit)
values ('calendar-files', 'calendar-files', false, 26214400)   -- 25 MB a file
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists "calendar-files owner read"   on storage.objects;
drop policy if exists "calendar-files owner insert" on storage.objects;
drop policy if exists "calendar-files owner delete" on storage.objects;
create policy "calendar-files owner read"   on storage.objects for select to authenticated
  using (bucket_id = 'calendar-files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "calendar-files owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'calendar-files' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "calendar-files owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'calendar-files' and auth.uid()::text = (storage.foldername(name))[1]);

select
  exists (select 1 from storage.buckets where id = 'calendar-files' and public = false) as private_bucket_ready,
  (select count(*) from pg_policies where tablename = 'objects' and policyname like 'calendar-files owner %') = 3 as owner_only_rules_ready;
