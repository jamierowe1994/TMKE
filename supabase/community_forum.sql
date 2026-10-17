-- The Community as a forum (Dani, 17 Oct 2026)
--
--   · Go-live times. A topic goes live at 8am UK time on its start date
--     (`publish_at`, worked out from starts_on unless set). Before then only
--     staff and the previewers below can see it.
--   · A notice in every member's bell when a topic goes live: "Spill the tea.
--     We've got something to discuss. ☕" -- no email. Each topic queues its
--     own Hub notice (member_broadcasts), which the Worker's five-minute tick
--     already sends; moving or hiding the topic moves or cancels it.
--   · Replies to a comment. A comment's author hears about it (in their bell)
--     when somebody replies to their comment, and not for every comment after
--     theirs.
--   · Reactions on posts and comments: heart, thumbs up, hug, cry, laugh. One
--     per person per thing; choosing another swaps it.
--
-- Run after community.sql and community_fortnight.sql, in the Supabase SQL
-- editor. Safe to re-run.

-- ── Who's asking: a signed-in person, or us in the SQL editor / the Worker ──
-- Requests from the site carry a role of anon or authenticated; the SQL editor
-- and the service key carry none or service_role, and are trusted.
create or replace function public.community_trusted()
  returns boolean language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '')
         not in ('anon', 'authenticated');
$$;

-- ── Preview: who sees a topic before it goes live (besides staff) ──────────
create table if not exists public.community_previewers (
  email text primary key check (email = lower(email))
);
alter table public.community_previewers enable row level security;
-- Nobody reads or writes this from the site; the policies below look it up.
insert into public.community_previewers (email) values
  ('danielle@tmke.co.uk'), ('danielle@themarketingexperts.co.uk')
on conflict do nothing;

create or replace function public.community_previewer()
  returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_staff()
      or exists (select 1 from public.community_previewers
                 where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
grant execute on function public.community_previewer() to authenticated;

-- ── Posts: when they go live ───────────────────────────────────────────────
alter table public.community_posts add column if not exists publish_at timestamptz;

create or replace function public.community_posts_guard()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare staff boolean := public.is_staff() or public.community_trusted();
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
      new.publish_at := null;
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
      new.publish_at := old.publish_at;
      new.need_count := old.need_count;
      new.reply_count := old.reply_count;
      new.last_activity_at := old.last_activity_at;
      new.created_at := old.created_at;
    end if;
  end if;
  -- A dated topic goes live at 8am UK time on its first day, unless told
  -- otherwise; moving the date moves the time with it.
  if new.kind = 'topic' and new.starts_on is not null
     and (new.publish_at is null
          or (tg_op = 'UPDATE' and new.starts_on is distinct from old.starts_on
              and new.publish_at is not distinct from old.publish_at)) then
    new.publish_at := (new.starts_on + time '08:00') at time zone 'Europe/London';
  end if;
  return new;
end $$;

-- Members see a topic once it has gone live; staff and previewers see it early.
drop policy if exists "community_posts read" on public.community_posts;
create policy "community_posts read" on public.community_posts for select to authenticated
  using (
    public.community_previewer()
    or (
      (not hidden or author_id = auth.uid())
      and (kind <> 'topic' or (
        (publish_at is null or publish_at <= now())
        and (starts_on is null or starts_on <= (now() at time zone 'Europe/London')::date)
      ))
    )
  );

-- Previewers may comment on what they can see, so the format can be tried.
drop policy if exists "community_replies write" on public.community_replies;
create policy "community_replies write" on public.community_replies for insert to authenticated
  with check ((author_id = auth.uid() or public.is_staff())
              and exists (select 1 from public.community_posts p where p.id = post_id and not p.hidden));

-- ── Replies to a comment ───────────────────────────────────────────────────
alter table public.community_replies
  add column if not exists parent_id uuid references public.community_replies (id) on delete cascade;
create index if not exists community_replies_parent_idx on public.community_replies (parent_id);

create or replace function public.community_replies_guard()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare
  staff boolean := public.is_staff() or public.community_trusted();
  par public.community_replies;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.author_id := auth.uid(); end if;
    new.is_staff := staff;
    if not staff then new.hidden := false; end if;
    -- One level deep, and always under the same post: a reply to a reply
    -- joins the comment it hangs from.
    if new.parent_id is not null then
      select * into par from public.community_replies where id = new.parent_id;
      if par.id is null or par.post_id <> new.post_id then
        new.parent_id := null;
      elsif par.parent_id is not null then
        new.parent_id := par.parent_id;
      end if;
    end if;
  else
    new.updated_at := now();
    if not staff then
      new.post_id := old.post_id;
      new.parent_id := old.parent_id;
      new.author_id := old.author_id;
      new.is_staff := old.is_staff;
      new.hidden := old.hidden;
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;

-- ── Telling people ─────────────────────────────────────────────────────────
-- Us: every new post, comment or report from a member.
-- Them: a reply to their comment; a comment on a conversation or request they
-- started; their request moving on. Never throws.
create or replace function public.community_notify()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare
  post   public.community_posts;
  par    public.community_replies;
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
  label := case post.kind when 'request' then 'request' when 'topic' then 'discussion' else 'conversation' end;
  select display_name into who from public.community_names where user_id = auth.uid();

  begin
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
                else coalesce(who, 'A member') || ' commented on ' || '"' || left(post.title, 80) || '"' end,
              left(case when tg_table_name = 'community_posts' then post.title else new.body end, 280),
              '/admin/community?post=' || post.id,
              array['danielle@tmke.co.uk'], jsonb_build_object('post_id', post.id));
    end if;
  exception when others then
    null;
  end;

  begin
    -- (Nested, not and-ed: plpgsql reads every field in a condition, and a
    -- reply has no kind, a report no author.)
    if tg_table_name = 'community_replies' then
      if new.parent_id is not null then
        select * into par from public.community_replies where id = new.parent_id;
        if par.author_id is not null and par.author_id <> new.author_id then
          insert into public.member_notifications (user_id, kind, title, body, href, meta)
          values (par.author_id, 'community_reply',
                  case when new.is_staff then 'TMKE replied to your comment'
                       else coalesce(who, 'A member') || ' replied to your comment' end,
                  left(new.body, 200), '/account/community?post=' || post.id,
                  jsonb_build_object('post_id', post.id, 'reply_id', new.id));
        end if;
      elsif post.kind <> 'topic' and post.author_id <> new.author_id then
        insert into public.member_notifications (user_id, kind, title, body, href, meta)
        values (post.author_id, 'community_reply',
                case when new.is_staff then 'TMKE replied to your ' || label
                     else coalesce(who, 'A member') || ' replied to your ' || label end,
                left(new.body, 200), '/account/community?post=' || post.id,
                jsonb_build_object('post_id', post.id));
      end if;
    end if;

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

-- ── The "Spill the tea" notice, queued per topic ───────────────────────────
alter table public.member_broadcasts add column if not exists community_post_id uuid;
create unique index if not exists member_broadcasts_community_post
  on public.member_broadcasts (community_post_id) where community_post_id is not null;

create or replace function public.community_topic_notice()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare b public.member_broadcasts;
begin
  if new.kind <> 'topic' then return null; end if;
  begin
    select * into b from public.member_broadcasts where community_post_id = new.id;
    if new.hidden or new.publish_at is null then
      -- Not going live: take back a notice that hasn't gone yet.
      update public.member_broadcasts set status = 'cancelled'
        where community_post_id = new.id and status = 'scheduled';
    elsif b.id is null then
      -- Only for a topic still to go live; one already out has had its moment.
      if new.publish_at > now() then
        insert into public.member_broadcasts (title, body, href, link_label, send_at, status, community_post_id)
        values ('Spill the tea. We''ve got something to discuss. ☕',
                'A new discussion has landed in the community. We''ve shared our take, now we want to hear yours.',
                '/account/community', 'The Community', new.publish_at, 'scheduled', new.id);
      end if;
    elsif b.status in ('scheduled', 'cancelled') then
      update public.member_broadcasts
        set send_at = new.publish_at,
            status = case when new.publish_at > now() then 'scheduled' else b.status end
        where id = b.id;
    end if;
  exception when others then
    null;
  end;
  return null;
end $$;

drop trigger if exists community_topic_notice on public.community_posts;
create trigger community_topic_notice after insert or update of publish_at, hidden, starts_on on public.community_posts
  for each row execute function public.community_topic_notice();

-- ── Reactions ──────────────────────────────────────────────────────────────
create table if not exists public.community_reactions (
  target_id   uuid not null,                       -- a post or a comment
  target_kind text not null check (target_kind in ('post', 'reply')),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  emoji       text not null check (emoji in ('heart', 'thumbs', 'hug', 'cry', 'laugh')),
  created_at  timestamptz not null default now(),
  primary key (target_id, user_id)
);
alter table public.community_reactions enable row level security;

drop policy if exists "community_reactions own" on public.community_reactions;
create policy "community_reactions own" on public.community_reactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Everyone sees the totals, nobody sees who.
create or replace view public.community_reaction_counts as
  select target_id, emoji, count(*)::int as n from public.community_reactions group by target_id, emoji;
revoke all on public.community_reaction_counts from anon;
grant select on public.community_reaction_counts to authenticated;
revoke all on public.community_reactions from anon;
