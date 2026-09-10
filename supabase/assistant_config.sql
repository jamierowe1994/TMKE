-- The Creative Assistant's settings, one row per mode.
--
-- The assistant in the Studio (supabase/functions/ask-expert) has two jobs:
-- "studio" answers how-do-I questions about the editor, "content" helps decide
-- what to post and writes it. Each was a prompt hard-coded in the function.
-- This table lets Admin -> Insights -> Assistant read and change them without a
-- deploy: the function reads its row for the mode on each request (cached a
-- minute) and falls back to the prompt in its code when the row is missing.
--
-- Run in the Supabase SQL editor. Nothing else depends on it existing: the
-- admin page says so when the table is not there, and the assistant carries on
-- with the shipped prompts.

create table if not exists public.assistant_config (
  mode          text primary key,                -- 'studio' | 'content'
  name          text,                            -- what members see it called
  system_prompt text not null,
  model         text not null default 'claude-haiku-4-5-20251001',
  max_tokens    integer not null default 1000,
  enabled       boolean not null default true,
  notes         text,                            -- for the admin page only: what it knows, what it may reference
  updated_at    timestamptz not null default now()
);

alter table public.assistant_config enable row level security;

drop policy if exists "assistant_config admin" on public.assistant_config;
create policy "assistant_config admin"
  on public.assistant_config for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
-- The edge function reads with the service role, which bypasses these policies.
