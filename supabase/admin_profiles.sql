-- ============================================================================
-- TMKE admin profiles — per-admin settings (name, role, headshot, preferences)
-- for the redesigned admin app shell. Each admin manages only their own row
-- (RLS scoped to auth.uid()). Headshots live in a public 'avatars' storage
-- bucket under a per-user folder. Safe to re-run (idempotent).
-- ============================================================================

create table if not exists admin_profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        text default 'Admin',
  phone       text,
  avatar_url  text,
  preferences jsonb default '{}'::jsonb,
  updated_at  timestamptz default now()
);

alter table admin_profiles enable row level security;

drop policy if exists "own profile read"   on admin_profiles;
drop policy if exists "own profile insert" on admin_profiles;
drop policy if exists "own profile update" on admin_profiles;
create policy "own profile read"   on admin_profiles for select using (auth.uid() = user_id);
create policy "own profile insert" on admin_profiles for insert with check (auth.uid() = user_id);
create policy "own profile update" on admin_profiles for update using (auth.uid() = user_id);

-- ---- Headshot storage (public read, owner-only write) -----------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Path convention: avatars/<user_id>/headshot.<ext>  → folder[1] = user id.
drop policy if exists "avatars public read"  on storage.objects;
drop policy if exists "avatars owner insert" on storage.objects;
drop policy if exists "avatars owner update" on storage.objects;
drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars public read"  on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars owner insert" on storage.objects for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "avatars owner update" on storage.objects for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "avatars owner delete" on storage.objects for delete using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
