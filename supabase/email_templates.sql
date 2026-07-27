-- TMKE admin centre — marketing email templates ("the in-house Mailchimp").
-- Marketing staff build branded emails from blocks (or raw HTML) and save them
-- here. A template can be sent manually as a one-off / newsletter, or bound to a
-- system event via `trigger_key` (e.g. a registration confirmation) — the
-- trigger wiring lands in a later phase; this column reserves the hook now.
--
-- NOTE: this is a *different* table from public.templates (which holds the
-- customer-facing design/studio templates). Don't confuse the two.
--
-- Run this in the Supabase SQL editor after schema.sql + admins.sql.

create table if not exists public.email_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  subject      text not null default '',
  preheader    text,                                   -- inbox preview snippet (hidden in body)
  trigger_key  text,                                   -- null = manual/newsletter; else a system event key
  mode         text not null default 'blocks'
               check (mode in ('blocks', 'html')),
  blocks       jsonb not null default '[]'::jsonb,     -- array of block objects (see src/lib/email-render.js)
  custom_html  text,                                   -- used when mode = 'html'
  branding     jsonb not null default '{}'::jsonb,     -- { companyName, logo, accentColor, signatureName, bgColor, cardColor, socials… }
  status       text not null default 'draft'
               check (status in ('active', 'draft', 'archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists email_templates_status_idx
  on public.email_templates (status, updated_at desc);

-- At most one ACTIVE template per trigger key, so the future "which template
-- fires for this event?" lookup is never ambiguous. (Drafts/archived are exempt.)
create unique index if not exists email_templates_trigger_active_idx
  on public.email_templates (trigger_key)
  where trigger_key is not null and status = 'active';

-- Touch updated_at on every update (reuses the fn from schema.sql).
drop trigger if exists email_templates_set_updated_at on public.email_templates;
create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS — unlike design templates, email templates are NOT public:
-- there's no public read policy. Only authenticated admins can see
-- or change them. (The send path is additionally gated in the Worker.)
-- ============================================================
alter table public.email_templates enable row level security;

-- Read + write: admins only, via public.is_admin(). NOT merely `authenticated` —
-- the admin area and the member hub share one anon key and one `authenticated`
-- role, so "signed in" would include every member.
-- PREREQUISITE: public.admins must be populated (supabase/admins.sql).
-- See supabase/admin_tables_rls.sql for the migration and the full reasoning.

-- Superseded permissive policies — dropped by name so a re-run of this file
-- can never leave the old "any signed-in user" grant sitting beside the lock.
drop policy if exists "email_templates read authed"   on public.email_templates;
drop policy if exists "email_templates insert authed" on public.email_templates;
drop policy if exists "email_templates update authed" on public.email_templates;
drop policy if exists "email_templates delete authed" on public.email_templates;

drop policy if exists "email_templates admin" on public.email_templates;
create policy "email_templates admin"
  on public.email_templates for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
