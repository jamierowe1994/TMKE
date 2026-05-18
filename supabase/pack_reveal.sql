-- Marketing team controls how many templates customers can preview on
-- the public pack-detail page before the lock kicks in.
--
-- Run after schema.sql + templates.sql.

alter table public.packs
  add column if not exists preview_reveal_count integer not null default 3
    check (preview_reveal_count between 0 and 24);

comment on column public.packs.preview_reveal_count is
  'Number of templates shown un-locked on the public pack-detail page. The rest sit behind a "Buy to unlock" overlay.';
