-- ============================================================================
-- Content Calendar launch switches (Danielle, 11 Nov 2026).
--
-- One row, read by the Worker's access check (memberAccess):
--   teg_live       The December rule. Off until launch. When on, agents on The
--                  Property Experts or Prestige Property Experts get the
--                  Content Calendar, paid by their brand.
--   test_user_ids  The test logins. They're treated as if the December rule
--                  were already on, so a TPE or PPE test login sees the month
--                  and a no-brand one sees it blurred. Nobody else changes.
--
-- Changed in Admin > Content calendar > Overview > Launch. Team only.
-- Run in the Supabase SQL editor. Safe to re-run. Changes no one's access
-- until you add a test login or switch the rule on. Sends nothing.
-- ============================================================================

create table if not exists public.content_calendar_settings (
  id            int primary key default 1 check (id = 1),
  teg_live      boolean not null default false,
  test_user_ids uuid[]  not null default '{}',
  updated_at    timestamptz not null default now(),
  updated_by    text
);

insert into public.content_calendar_settings (id) values (1) on conflict (id) do nothing;

alter table public.content_calendar_settings enable row level security;

drop policy if exists "content_calendar_settings admin" on public.content_calendar_settings;
create policy "content_calendar_settings admin"
  on public.content_calendar_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';

select teg_live, cardinality(test_user_ids) as test_logins from public.content_calendar_settings;
