-- TMKE — version history for templates
--
-- Undo only ever lived in the open editing session. Close the editor, come
-- back, and "go back" has nothing to go back to: on 10 Oct 2026 the cover of
-- TPE_CC_Valuation Invitation was emptied and the empty page duplicated, and
-- there was no copy of it anywhere in the database to restore.
--
-- Every write to a template now leaves the PREVIOUS state behind, so there is
-- always something to go back to. A snapshot is taken before the row changes,
-- which is what makes it the version you had rather than the one you just
-- made.
--
-- Deliberately NOT a foreign key to templates: a snapshot has to outlive the
-- row it came from, or deleting a template would delete the only copies of it.
--
-- Run in the Supabase SQL editor. Safe to re-run.

create table if not exists public.template_versions (
  id           bigserial primary key,
  template_id  text not null,              -- templates.id, intentionally unlinked
  name         text,
  category     text,
  thumb_url    text,
  canvas       jsonb,
  elements     jsonb,
  pages        jsonb,
  status       text,
  saved_at     timestamptz not null default now(),
  saved_by     uuid,                       -- auth.uid() of whoever triggered it
  note         text                        -- 'edit', 'delete', or a restore note
);

create index if not exists template_versions_lookup_idx
  on public.template_versions (template_id, saved_at desc);

-- How many versions to keep per template. Older ones are pruned as new ones
-- arrive, so the table cannot grow without limit.
create or replace function public.prune_template_versions(p_template_id text, p_keep int default 50)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.template_versions
   where template_id = p_template_id
     and id not in (
       select id from public.template_versions
        where template_id = p_template_id
        order by saved_at desc, id desc
        limit p_keep
     );
$$;

-- ============================================================
-- Snapshot the state BEFORE each write.
-- ============================================================
create or replace function public.snapshot_template()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE') then
    -- Only when the artwork or its name actually changed. Touch-only writes
    -- (sort_order, a thumbnail refresh) would otherwise fill the history with
    -- versions that look identical and bury the one you want.
    if old.canvas is not distinct from new.canvas
       and old.elements is not distinct from new.elements
       and old.pages is not distinct from new.pages
       and old.name is not distinct from new.name
       and old.status is not distinct from new.status then
      return new;
    end if;
  end if;

  insert into public.template_versions
    (template_id, name, category, thumb_url, canvas, elements, pages, status, saved_by, note)
  values
    (old.id, old.name, old.category, old.thumb_url, old.canvas, old.elements, old.pages,
     old.status, auth.uid(), case when tg_op = 'DELETE' then 'delete' else 'edit' end);

  perform public.prune_template_versions(old.id);

  if (tg_op = 'DELETE') then return old; end if;
  return new;
end;
$$;

drop trigger if exists templates_snapshot_version on public.templates;
create trigger templates_snapshot_version
  before update or delete on public.templates
  for each row execute function public.snapshot_template();

-- ============================================================
-- Putting one back.
-- ============================================================
-- Restoring is itself a write, so the trigger snapshots what you are about to
-- replace first: changing your mind about a restore costs nothing.
create or replace function public.restore_template_version(p_version_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.template_versions%rowtype;
begin
  select * into v from public.template_versions where id = p_version_id;
  if not found then
    raise exception 'No version with id %', p_version_id;
  end if;

  update public.templates
     set name     = v.name,
         category = v.category,
         canvas   = v.canvas,
         elements = v.elements,
         pages    = v.pages,
         status   = coalesce(v.status, status)
   where id = v.template_id;

  if not found then
    raise exception 'Template % no longer exists — recreate the row first', v.template_id;
  end if;

  return v.template_id;
end;
$$;

-- ============================================================
-- RLS — the same audience as templates themselves.
-- ============================================================
alter table public.template_versions enable row level security;

drop policy if exists "template_versions read authed" on public.template_versions;
create policy "template_versions read authed"
  on public.template_versions for select
  to authenticated
  using (true);

-- Writes come from the trigger (security definer), never from a client.
drop policy if exists "template_versions no client insert" on public.template_versions;
create policy "template_versions no client insert"
  on public.template_versions for insert
  to authenticated
  with check (false);

grant execute on function public.restore_template_version(bigint) to authenticated;

-- ============================================================
-- Reading the history (run these yourself; they change nothing)
-- ============================================================
-- What versions exist for one template, newest first:
--
--   select id, saved_at, note,
--          jsonb_array_length(coalesce(pages,'[]'::jsonb)) as pages,
--          left(md5(coalesce(pages,'[]'::jsonb)::text),8)  as fingerprint
--     from public.template_versions
--    where template_id = 'tmpl-p1vquv'
--    order by saved_at desc;
--
-- Put one back (snapshots the current state first):
--
--   select public.restore_template_version(123);
