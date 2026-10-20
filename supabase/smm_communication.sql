-- A social media client file's Communication tab (Danielle, 20 Oct 2026).
--
-- 1. Messages a client sends from their hub ("Message your team") are saved
--    with channel 'hub', which the original check on booking_messages never
--    allowed (only email, note, system), so the save failed quietly and they
--    only ever arrived as an email to the manager. This widens the check.
--    'activity' is allowed too: Client activity already reads it.
-- 2. read_at: when someone at TMKE opened the Communication tab after it came
--    in. Unread ones are counted on the tab, "Communication (2)".
--
-- Safe to re-run.

-- Whatever the old channel check is called, it goes.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.booking_messages'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%channel%'
  loop
    execute format('alter table public.booking_messages drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.booking_messages add constraint booking_messages_channel_check
  check (channel in ('email', 'note', 'system', 'hub', 'activity')) not valid;

alter table public.booking_messages
  add column if not exists read_at timestamptz;

-- What's already there counts as read: only what arrives from now on is new.
update public.booking_messages set read_at = created_at
 where direction = 'inbound' and read_at is null;

notify pgrst, 'reload schema';
