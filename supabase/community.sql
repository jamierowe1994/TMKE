-- The Community (Dani, 17 Oct 2026)
--
-- "The element of community is something that I always wanted to include in
-- this hub. It feels very people-driven." Three parts, one table of posts:
--
--   · topic       -- the fortnight's topic. We set it; members talk under it.
--   · discussion  -- open conversation about estate agency marketing.
--   · request     -- something to add or change. Others say "I need this too",
--                    so we can see how many people want what.
--
-- Posts go live straight away; we can hide any of them, and members can
-- report one. TMKE replies carry a badge.
--
-- NAMES: members show as first name and surname initial ("Sarah H.") unless
-- they choose their full name and agency. Their real surname sits in
-- community_members, which only they can read; everyone else reads the
-- finished name through community_names.
--
-- Run in the Supabase SQL editor. Safe to re-run.

-- ── How you appear ──────────────────────────────────────────────────────────
create table if not exists public.community_members (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  first_name   text not null default '' check (char_length(first_name) <= 60),
  last_name    text not null default '' check (char_length(last_name) <= 60),
  agency       text not null default '' check (char_length(agency) <= 80),
  show_full    boolean not null default false,
  display_name text generated always as (
    case
      when show_full then
        btrim(btrim(first_name || ' ' || last_name)
          || case when btrim(agency) <> '' then ' · ' || btrim(agency) else '' end)
      else
        btrim(first_name || case when btrim(last_name) <> '' then ' ' || upper(left(btrim(last_name), 1)) || '.' else '' end)
    end
  ) stored,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.community_members enable row level security;

drop policy if exists "community_members own" on public.community_members;
create policy "community_members own"
  on public.community_members for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Everyone else sees the finished name and nothing more. A plain view runs as
-- its owner, so it reads past the policy above, but only these two columns.
create or replace view public.community_names as
  select user_id, display_name from public.community_members;
revoke all on public.community_names from anon;
grant select on public.community_names to authenticated;

-- ── Posts ───────────────────────────────────────────────────────────────────
create table if not exists public.community_posts (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('topic', 'discussion', 'request')),
  title            text not null check (char_length(btrim(title)) between 3 and 140),
  body             text not null default '' check (char_length(body) <= 5000),
  -- requests: what it's about (studio, packs, planner, training, shoots, other)
  category         text check (category is null or char_length(category) <= 40),
  -- requests: where we've got to with it
  status           text not null default 'open'
                     check (status in ('open', 'planned', 'building', 'done', 'declined')),
  -- topics: the fortnight it runs
  starts_on        date,
  ends_on          date,
  author_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  is_staff         boolean not null default false,
  hidden           boolean not null default false,
  pinned           boolean not null default false,
  need_count       integer not null default 0,
  reply_count      integer not null default 0,
  last_activity_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists community_posts_kind_idx on public.community_posts (kind, last_activity_at desc);
create index if not exists community_posts_topic_idx on public.community_posts (starts_on desc) where kind = 'topic';

-- ── Replies ─────────────────────────────────────────────────────────────────
create table if not exists public.community_replies (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 5000),
  author_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  is_staff   boolean not null default false,
  hidden     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_replies_post_idx on public.community_replies (post_id, created_at);

-- ── "I need this too" ───────────────────────────────────────────────────────
create table if not exists public.community_needs (
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ── Reports ─────────────────────────────────────────────────────────────────
create table if not exists public.community_reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid references public.community_posts (id) on delete cascade,
  reply_id    uuid references public.community_replies (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason      text not null default '' check (char_length(reason) <= 1000),
  resolved    boolean not null default false,
  created_at  timestamptz not null default now(),
  check (post_id is not null or reply_id is not null)
);

-- ── Who may set what ────────────────────────────────────────────────────────
-- A member writes the words; everything else (who wrote it, the badge,
-- hidden, pinned, status, the counts) is ours or the database's.
create or replace function public.community_posts_guard()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare staff boolean := public.is_staff();
begin
  -- The recount below updates the post from inside another trigger; that is
  -- the database keeping its own numbers, so let it through.
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
      new.need_count := old.need_count;
      new.reply_count := old.reply_count;
      new.last_activity_at := old.last_activity_at;
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists community_posts_guard on public.community_posts;
create trigger community_posts_guard before insert or update on public.community_posts
  for each row execute function public.community_posts_guard();

create or replace function public.community_replies_guard()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare staff boolean := public.is_staff();
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.author_id := auth.uid(); end if;
    new.is_staff := staff;
    if not staff then new.hidden := false; end if;
  else
    new.updated_at := now();
    if not staff then
      new.post_id := old.post_id;
      new.author_id := old.author_id;
      new.is_staff := old.is_staff;
      new.hidden := old.hidden;
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists community_replies_guard on public.community_replies;
create trigger community_replies_guard before insert or update on public.community_replies
  for each row execute function public.community_replies_guard();

-- ── The counts, kept by the database ────────────────────────────────────────
-- Counted rather than added to, so they can never drift, and counted past RLS
-- so a member's view of them is everyone's.
create or replace function public.community_recount(p_post uuid)
  returns void language sql security definer set search_path = public
as $$
  update public.community_posts p set
    reply_count = (select count(*) from public.community_replies r where r.post_id = p.id and not r.hidden),
    need_count  = (select count(*) from public.community_needs n where n.post_id = p.id),
    last_activity_at = greatest(p.created_at,
      coalesce((select max(r.created_at) from public.community_replies r where r.post_id = p.id and not r.hidden), p.created_at))
  where p.id = p_post;
$$;

create or replace function public.community_replies_after()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.community_recount(coalesce(new.post_id, old.post_id));
  return null;
end $$;

drop trigger if exists community_replies_after on public.community_replies;
create trigger community_replies_after after insert or update or delete on public.community_replies
  for each row execute function public.community_replies_after();

create or replace function public.community_needs_after()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.community_recount(coalesce(new.post_id, old.post_id));
  return null;
end $$;

drop trigger if exists community_needs_after on public.community_needs;
create trigger community_needs_after after insert or delete on public.community_needs
  for each row execute function public.community_needs_after();

-- ── Telling people ──────────────────────────────────────────────────────────
-- Us: every new post, reply or report from a member lands in the admin bell.
-- Them: a reply on their post, or a change to their request, lands in theirs.
-- Never throws: a missing notifications table costs the notice, not the post.
create or replace function public.community_notify()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare
  post   public.community_posts;
  who    text;
  label  text;
begin
  if tg_table_name = 'community_posts' then
    post := new;
  elsif tg_table_name = 'community_replies' then
    select * into post from public.community_posts where id = new.post_id;
  else
    select * into post from public.community_posts
      where id = coalesce(new.post_id, (select r.post_id from public.community_replies r where r.id = new.reply_id));
  end if;
  label := case post.kind when 'request' then 'request' when 'topic' then 'topic' else 'conversation' end;
  select display_name into who from public.community_names where user_id = auth.uid();

  begin

    -- Us
    if tg_table_name = 'community_reports' then
      insert into public.admin_notifications (area, event, title, body, href, recipients, meta)
      values ('hub', 'community_report', 'A post was reported',
              left(coalesce(new.reason, ''), 280), '/admin/community?post=' || post.id,
              array['danielle@tmke.co.uk'], jsonb_build_object('post_id', post.id));
    elsif tg_op = 'INSERT' and not new.is_staff then
      insert into public.admin_notifications (area, event, title, body, href, recipients, meta)
      values ('hub',
              case when tg_table_name = 'community_posts' then 'community_post' else 'community_reply' end,
              case when tg_table_name = 'community_posts'
                then coalesce(who, 'A member') || ' started a ' || label
                else coalesce(who, 'A member') || ' replied on ' || '"' || left(post.title, 80) || '"' end,
              left(case when tg_table_name = 'community_posts' then post.title else new.body end, 280),
              '/admin/community?post=' || post.id,
              array['danielle@tmke.co.uk'], jsonb_build_object('post_id', post.id));
    end if;
  exception when others then
    null;
  end;

  begin
    -- Them: a reply from someone else on their post.
    -- (Nested, not and-ed: plpgsql reads every field in a condition, and a
    -- reply has no kind, a report no author.)
    if tg_table_name = 'community_replies' then
     if post.author_id <> new.author_id then
      insert into public.member_notifications (user_id, kind, title, body, href, meta)
      values (post.author_id, 'community_reply',
              case when new.is_staff then 'TMKE replied to your ' || label
                   else coalesce(who, 'A member') || ' replied to your ' || label end,
              left(new.body, 200), '/account/community?post=' || post.id,
              jsonb_build_object('post_id', post.id));
     end if;
    end if;

    -- Them: we moved their request on.
    if tg_table_name = 'community_posts' and tg_op = 'UPDATE' then
     if new.kind = 'request' and new.status is distinct from old.status and new.status <> 'open' then
      insert into public.member_notifications (user_id, kind, title, body, href, meta)
      values (new.author_id, 'community_request_status',
              'Your request is ' || case new.status when 'planned' then 'planned' when 'building' then 'being built'
                                      when 'done' then 'done' else 'closed' end,
              left(new.title, 200), '/account/community?post=' || new.id,
              jsonb_build_object('post_id', new.id, 'status', new.status));
     end if;
    end if;
  exception when others then
    null;
  end;
  return null;
end $$;

drop trigger if exists community_posts_notify on public.community_posts;
create trigger community_posts_notify after insert or update of status on public.community_posts
  for each row execute function public.community_notify();
drop trigger if exists community_replies_notify on public.community_replies;
create trigger community_replies_notify after insert on public.community_replies
  for each row execute function public.community_notify();
drop trigger if exists community_reports_notify on public.community_reports;
create trigger community_reports_notify after insert on public.community_reports
  for each row execute function public.community_notify();

-- ── Row level security ──────────────────────────────────────────────────────
alter table public.community_posts   enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_needs   enable row level security;
alter table public.community_reports enable row level security;

-- Posts: members see what isn't hidden, and their own; we see everything.
drop policy if exists "community_posts read" on public.community_posts;
create policy "community_posts read" on public.community_posts for select to authenticated
  using (not hidden or author_id = auth.uid() or public.is_staff());
drop policy if exists "community_posts write" on public.community_posts;
create policy "community_posts write" on public.community_posts for insert to authenticated
  with check (author_id = auth.uid() or public.is_staff());
drop policy if exists "community_posts edit" on public.community_posts;
create policy "community_posts edit" on public.community_posts for update to authenticated
  using (author_id = auth.uid() or public.is_staff())
  with check (author_id = auth.uid() or public.is_staff());
drop policy if exists "community_posts delete" on public.community_posts;
create policy "community_posts delete" on public.community_posts for delete to authenticated
  using (author_id = auth.uid() or public.is_staff());

-- Replies: the same, and only under a post they can see.
drop policy if exists "community_replies read" on public.community_replies;
create policy "community_replies read" on public.community_replies for select to authenticated
  using ((not hidden or author_id = auth.uid() or public.is_staff())
         and exists (select 1 from public.community_posts p where p.id = post_id));
drop policy if exists "community_replies write" on public.community_replies;
create policy "community_replies write" on public.community_replies for insert to authenticated
  with check ((author_id = auth.uid() or public.is_staff())
              and exists (select 1 from public.community_posts p where p.id = post_id and not p.hidden));
drop policy if exists "community_replies edit" on public.community_replies;
create policy "community_replies edit" on public.community_replies for update to authenticated
  using (author_id = auth.uid() or public.is_staff())
  with check (author_id = auth.uid() or public.is_staff());
drop policy if exists "community_replies delete" on public.community_replies;
create policy "community_replies delete" on public.community_replies for delete to authenticated
  using (author_id = auth.uid() or public.is_staff());

-- Needs: your own, on a request you can see. The count is on the post.
drop policy if exists "community_needs read" on public.community_needs;
create policy "community_needs read" on public.community_needs for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
drop policy if exists "community_needs add" on public.community_needs;
create policy "community_needs add" on public.community_needs for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from public.community_posts p where p.id = post_id and p.kind = 'request' and not p.hidden));
drop policy if exists "community_needs remove" on public.community_needs;
create policy "community_needs remove" on public.community_needs for delete to authenticated
  using (user_id = auth.uid());

-- Reports: anyone can make one; only we read them.
drop policy if exists "community_reports add" on public.community_reports;
create policy "community_reports add" on public.community_reports for insert to authenticated
  with check (reporter_id = auth.uid());
drop policy if exists "community_reports staff" on public.community_reports;
create policy "community_reports staff" on public.community_reports for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

revoke all on public.community_posts, public.community_replies, public.community_needs,
              public.community_reports, public.community_members from anon;
