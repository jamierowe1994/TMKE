-- ============================================================
-- Content prompts — the editable source for everything prompt-shaped
-- ============================================================
-- Additive and safe to re-run.
--
-- These live in code today (src/data/content-calendar.js) and are read by the
-- member dashboard, the editor's prompt box and the admin runway card. Putting
-- them here makes them editable without a deploy, from Insights > Prompts.
--
-- The code file stays as the fallback: if this table is empty or unreachable,
-- everything carries on with what shipped. That is deliberate — a member's
-- dashboard should not go blank because a query failed.
--
-- `rule` mirrors the shape the code already uses, so nothing has to be
-- translated in either direction:
--
--   { "on": "09-01" }                                    a fixed date
--   { "nth": { "month": 11, "weekday": 0, "n": 2 } }     2nd Sunday of November
--   { "nth": { "month": 11, "weekday": 4, "n": 4,
--              "offset": 1 } }                           the day after that
--   null                                                 evergreen, no date
--
-- `is_video` drives two things: the canvas the prompt opens (a Reel frame
-- rather than a post) and whether `say` and `cover` are shown. A video prompt
-- without those two lines is worse than a static one, so the admin table warns
-- rather than the member finding out.
-- ============================================================

create table if not exists public.content_prompts (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'dated' check (kind in ('dated', 'evergreen')),
  name        text,                        -- the occasion; null for evergreen
  rule        jsonb,                       -- see above; null for evergreen
  angle       text not null,               -- the hook shown on the card
  brief       text,                        -- the guidance shown in the editor
  say         text,                        -- video only: what to say on camera
  cover       text,                        -- video only: what the cover carries
  is_video    boolean not null default false,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists content_prompts_kind_idx
  on public.content_prompts (kind, sort_order);

drop trigger if exists content_prompts_set_updated_at on public.content_prompts;
create trigger content_prompts_set_updated_at
  before update on public.content_prompts
  for each row execute function public.set_updated_at();

-- ---- Row level security -------------------------------------------------
-- Members read the active ones: the dashboard and the editor both fetch these
-- in the browser. Nothing here is private — it is the marketing copy we are
-- asking them to post — but writing stays with admins.
alter table public.content_prompts enable row level security;

drop policy if exists "content_prompts read"  on public.content_prompts;
drop policy if exists "content_prompts admin" on public.content_prompts;

create policy "content_prompts read"
  on public.content_prompts for select
  to authenticated
  using (active);

create policy "content_prompts admin"
  on public.content_prompts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
