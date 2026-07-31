-- ============================================================
-- Saved blocks for the email builder.
--
-- Rebuilding the same header or footer by hand on every new email is where
-- inconsistency comes from — it is the same problem the automated emails had,
-- just with a human doing the copying. Save one once, drop it in afterwards.
--
-- Inserting a saved block COPIES it: the copy is independent from that moment
-- on, and editing it never touches the saved original or any other email. The
-- alternative — a live link, so editing the saved footer updates everywhere —
-- is more powerful and much less predictable, because it silently rewrites
-- emails nobody has opened in months. Chosen deliberately (James, 31 Jul).
--
-- `blocks` is an ARRAY even when a snippet holds one block, so a saved header
-- can grow into "logo + divider + nav" later without a migration.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

create table if not exists public.email_snippets (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  -- header | footer | other. Free text rather than an enum: the builder groups
  -- by whatever is here, and a new grouping shouldn't need a migration.
  category   text not null default 'other',
  blocks     jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text
);

create index if not exists email_snippets_category_idx
  on public.email_snippets (category, name);

-- ============================================================
-- Admin-only, same as the other backstage tables.
-- ============================================================
alter table public.email_snippets enable row level security;
drop policy if exists "email_snippets admin" on public.email_snippets;
create policy "email_snippets admin"
  on public.email_snippets for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
