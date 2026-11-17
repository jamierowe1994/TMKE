-- Training progress, ready for reporting (Danielle, 17 Nov 2026).
--
-- 1. Progress only goes forward. Reopening a course used to save it again
--    from part 1, so a finished course went back to "Part 1, not finished".
--    The page is fixed; this makes the database hold to it as well: how far
--    someone got never goes down, finished stays finished, and the first
--    finish date is kept.
-- 2. The team can read everyone's progress, so a training report can be
--    built later. Members still only see and change their own.
--
-- Safe to run twice. Changes nobody's progress. Sends nothing.

create or replace function public.guide_progress_forward_only()
returns trigger language plpgsql as $$
begin
  new.furthest := greatest(coalesce(old.furthest, 0), coalesce(new.furthest, 0));
  new.completed := coalesce(old.completed, false) or coalesce(new.completed, false);
  new.completed_at := coalesce(old.completed_at, new.completed_at);
  if new.completed and new.completed_at is null then new.completed_at := now(); end if;
  return new;
end;
$$;

drop trigger if exists guide_progress_forward_only on public.guide_progress;
create trigger guide_progress_forward_only
  before update on public.guide_progress
  for each row execute function public.guide_progress_forward_only();

drop policy if exists "guide_progress admin read" on public.guide_progress;
create policy "guide_progress admin read"
  on public.guide_progress for select
  to authenticated
  using (public.is_admin());

select guide_slug,
       count(*) as members,
       count(*) filter (where completed) as finished
  from public.guide_progress
 group by guide_slug
 order by members desc;
