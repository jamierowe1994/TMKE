-- A second open is not a duplicate
--
-- email_events_dedupe_idx keyed one row per (message, event, url). For a click
-- that is right: url is in the key, so two links both count and the same link
-- reported twice does not. For an OPEN there is no url, so the key collapses
-- to (message, "opened") -- one open per recipient, for all time.
--
-- Which throws away the wrong one. A scanner opens the message seconds after
-- delivery; the person opens it later. The scanner's open is written first and
-- every real one after it is refused as a duplicate. That is why a campaign to
-- people who know us reported a 0% open rate: the only opens we kept were the
-- machines', and the machines are exactly what we then filtered out.
--
-- The index still has a job -- Resend retries a webhook, and a retry carries
-- the SAME event timestamp. So put the timestamp in the key: a retry is still
-- a duplicate, a genuine second open is not.
--
-- Nothing is lost by running this. Opens already discarded are gone -- they
-- were never written -- but from here every one is kept.
--
-- Run in the Supabase SQL editor. Safe to re-run.

drop index if exists public.email_events_dedupe_idx;

create unique index if not exists email_events_dedupe_idx
  on public.email_events (message_id, event, coalesce(url, ''), occurred_at)
  where message_id is not null;

-- How lopsided it was: recipients for whom we hold exactly one open, which is
-- what the old key allowed at most.
select subject,
       count(*)                                  as recipients_with_an_open,
       count(*) filter (where opens = 1)         as held_exactly_one
  from (
    select subject, message_id, count(*) as opens
      from public.email_events
     where event = 'opened' and message_id is not null
     group by subject, message_id
  ) o
 group by subject
 order by recipients_with_an_open desc;
