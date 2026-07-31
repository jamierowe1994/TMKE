-- ============================================================
-- House style for automated email.
--
-- The 28 automated emails are built as HTML in the Worker, not in Email Studio,
-- so their look was only changeable by editing code. That turned every "the
-- headings look wrong" into a deploy. This holds the type scale, colours and
-- button styling in one row so the admin centre can edit them live.
--
-- Deliberately a single row with one jsonb column: the shape will grow, and a
-- column per setting would mean a migration each time. Missing keys fall back
-- to the Worker's defaults, so an empty row means "exactly as shipped".
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

create table if not exists public.email_styles (
  id         smallint primary key default 1,
  styles     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text,
  -- One row, always. A second would make "which one is live?" unanswerable —
  -- the same fault that made the branded base ambiguous.
  constraint email_styles_singleton check (id = 1)
);

insert into public.email_styles (id, styles) values (1, '{}'::jsonb)
  on conflict (id) do nothing;

-- ============================================================
-- Admin-only, same as the other backstage tables. The Worker reads it with the
-- service role, which bypasses RLS, so sending is unaffected.
-- See supabase/admin_tables_rls.sql.
-- ============================================================
alter table public.email_styles enable row level security;
drop policy if exists "email_styles admin" on public.email_styles;
create policy "email_styles admin"
  on public.email_styles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
