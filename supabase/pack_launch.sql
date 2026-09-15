-- When a pack went live, so the member hub can say "just dropped" for a fortnight.
-- Until this runs, the hub falls back to updated_at, which for a pack switched
-- live is the moment it was switched. Safe to run more than once.
alter table public.packs add column if not exists launched_at timestamptz;

-- Backfill: existing live packs launched when they were last changed.
update public.packs set launched_at = updated_at
where launched_at is null and status = 'active';

-- The Autumn Edit went live on 16 September 2026.
update public.packs set launched_at = timestamptz '2026-09-16 09:00+01'
where slug = 'autumn-edit';
