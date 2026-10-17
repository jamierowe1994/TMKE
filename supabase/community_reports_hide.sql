-- Reported, then hidden until we've looked (Dani, 17 Oct 2026)
--
-- "If somebody reports something, we temporarily hide it until it has been
-- reviewed by a member of the admin team. We don't want to leave anything up
-- there that could be offensive while somebody gets around to looking at it."
--
-- A report hides the post or comment straight away (not ours: TMKE's own
-- posts and comments stay up). In Admin → Community → Reports we either put
-- it back or keep it hidden; both close the report.
--
-- Run after community_forum.sql. Safe to re-run.

-- The replies guard lets the database's own updates through (a report hiding
-- a comment runs as the member who reported it, who could never hide it
-- themselves).
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
    if not staff then new.hidden := false; end if;
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

create or replace function public.community_report_hides()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.reply_id is not null then
    update public.community_replies set hidden = true where id = new.reply_id and not is_staff;
  elsif new.post_id is not null then
    update public.community_posts set hidden = true where id = new.post_id and not is_staff;
  end if;
  return null;
end $$;

drop trigger if exists community_report_hides on public.community_reports;
create trigger community_report_hides after insert on public.community_reports
  for each row execute function public.community_report_hides();
