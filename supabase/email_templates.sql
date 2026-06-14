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

-- Reads: any signed-in admin. We use the authenticated role to match the rest
-- of the backstage today; tighten to public.is_admin() once the admins-table
-- RLS rollout lands (see supabase/admins.sql + the pending note in memory).
drop policy if exists "email_templates read authed" on public.email_templates;
create policy "email_templates read authed"
  on public.email_templates for select
  to authenticated
  using (true);

drop policy if exists "email_templates insert authed" on public.email_templates;
create policy "email_templates insert authed"
  on public.email_templates for insert
  to authenticated
  with check (true);

drop policy if exists "email_templates update authed" on public.email_templates;
create policy "email_templates update authed"
  on public.email_templates for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "email_templates delete authed" on public.email_templates;
create policy "email_templates delete authed"
  on public.email_templates for delete
  to authenticated
  using (true);

-- To tighten later (recommended once admins-table RLS is live), replace the
-- using(true)/with check(true) above with public.is_admin(), e.g.:
--   create policy "email_templates write admin" on public.email_templates
--     for all to authenticated using (public.is_admin()) with check (public.is_admin());
