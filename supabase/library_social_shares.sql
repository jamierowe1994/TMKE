-- Creative Studio › Library: content marked as shared on social
-- (Danielle for Abigail, 23 Nov 2026).
--
-- One row per Library file that has been used. Ticked from the folder's
-- action bar ("Mark as shared"); the tile then carries a Shared chip, with
-- the platforms' icons when they were chosen.
--   platforms       instagram, facebook, tiktok, linkedin, youtube (any of)
--   all_platforms   true = shared everywhere
--   neither         shared, without saying where
-- Team only. Clients never see it: the client portal doesn't read this table.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

create table if not exists public.library_social_shares (
  file_key        text primary key,
  folder          text not null,
  platforms       text[] not null default '{}',
  all_platforms   boolean not null default false,
  marked_by       uuid default auth.uid(),
  marked_by_name  text,
  marked_at       timestamptz not null default now()
);

alter table public.library_social_shares
  drop constraint if exists library_social_shares_platforms_check;
alter table public.library_social_shares
  add constraint library_social_shares_platforms_check
  check (platforms <@ array['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube']::text[]);

create index if not exists library_social_shares_folder_idx on public.library_social_shares (folder);

alter table public.library_social_shares enable row level security;

drop policy if exists "library_social_shares team" on public.library_social_shares;
create policy "library_social_shares team"
  on public.library_social_shares for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

select count(*) as files_marked_shared from public.library_social_shares;
