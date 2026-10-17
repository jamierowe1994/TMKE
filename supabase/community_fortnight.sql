-- The Community's "This fortnight", second pass (Dani, 17 Oct 2026)
--
--   · A pinned intro, always first: a topic post with pinned = true, no dates.
--   · Each fortnight's topic: the topic, its intro, then TMKE's view
--     (`viewpoint`, new here); members' comments open underneath.
--   · Topics are scheduled ahead by their dates and change over on their own.
--     A topic that hasn't started yet stays out of members' sight, so the
--     next few can be written in advance without giving them away.
--   · Only staff set topics (already so: community_posts_guard refuses a
--     member's topic). Members comment.
--
-- Run after supabase/community.sql, in the Supabase SQL editor. Safe to re-run.

alter table public.community_posts
  add column if not exists viewpoint text not null default '' check (char_length(viewpoint) <= 5000);

-- The guard again, now keeping members off `viewpoint` too.
create or replace function public.community_posts_guard()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare staff boolean := public.is_staff();
begin
  -- The recount updates the post from inside another trigger; that is the
  -- database keeping its own numbers, so let it through.
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1 then return new; end if;
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.author_id := auth.uid(); end if;
    new.is_staff := staff;
    new.need_count := 0;
    new.reply_count := 0;
    new.last_activity_at := now();
    if not staff then
      if new.kind = 'topic' then raise exception 'Only TMKE sets the topic'; end if;
      new.hidden := false;
      new.pinned := false;
      new.status := 'open';
      new.starts_on := null;
      new.ends_on := null;
      new.viewpoint := '';
    end if;
  else
    new.updated_at := now();
    if not staff then
      new.kind := old.kind;
      new.author_id := old.author_id;
      new.is_staff := old.is_staff;
      new.hidden := old.hidden;
      new.pinned := old.pinned;
      new.status := old.status;
      new.starts_on := old.starts_on;
      new.ends_on := old.ends_on;
      new.viewpoint := old.viewpoint;
      new.need_count := old.need_count;
      new.reply_count := old.reply_count;
      new.last_activity_at := old.last_activity_at;
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;

-- Members see a topic once its fortnight has started (or it has no dates,
-- like the pinned intro). Staff see everything. UK date, not the server's.
drop policy if exists "community_posts read" on public.community_posts;
create policy "community_posts read" on public.community_posts for select to authenticated
  using (
    public.is_staff()
    or (
      (not hidden or author_id = auth.uid())
      and (kind <> 'topic' or starts_on is null or starts_on <= (now() at time zone 'Europe/London')::date)
    )
  );
