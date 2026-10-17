-- The Community, from the Admin Centre (Dani, 17 Oct 2026)
--
--   · A reply sent from the Admin Centre shows as "TMKE", not the name of
--     whoever on the team sent it (Danielle and Sam may answer from there
--     rather than their own hub account). `as_tmke`, which only staff can set.
--   · Admin notices: "<name> raised a request" (a conversation is still
--     "started"); and the Community's notices sit under "community", not "hub".
--
-- Run in the Supabase SQL editor. Safe to re-run.

alter table public.community_replies add column if not exists as_tmke boolean not null default false;

create or replace function public.community_replies_guard()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare
  staff boolean := public.is_staff() or public.community_trusted();
  par public.community_replies;
begin
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1 then return new; end if;
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.author_id := auth.uid(); end if;
    new.is_staff := staff;
    if not staff then new.hidden := false; new.as_tmke := false; end if;
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
      new.as_tmke := old.as_tmke;
      new.hidden := old.hidden;
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;

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
      values ('community', 'community_report', 'A post was reported',
              left(coalesce(new.reason, ''), 280), '/admin/community?post=' || post.id,
              array['danielle@tmke.co.uk'], jsonb_build_object('post_id', post.id));
    elsif tg_op = 'INSERT' and not new.is_staff then
      insert into public.admin_notifications (area, event, title, body, href, recipients, meta)
      values ('community',
              case when tg_table_name = 'community_posts' then 'community_post' else 'community_reply' end,
              case when tg_table_name = 'community_posts'
                then coalesce(who, 'A member') || case when post.kind = 'request' then ' raised a request' else ' started a ' || label end
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

-- The notices already sent move across too.
update public.admin_notifications set area = 'community' where event like 'community\_%' and area = 'hub';
update public.admin_notifications set title = regexp_replace(title, ' started a request$', ' raised a request')
  where event = 'community_post' and title like '% started a request';
