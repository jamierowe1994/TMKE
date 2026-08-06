-- ============================================================
-- Internal notes must not be readable by the client
-- ============================================================
-- Run this BEFORE using the notes panel. It closes a live leak.
--
-- THE PROBLEM
-- booking_messages carries a `channel`: 'email' is correspondence actually sent
-- to the client, 'note' and 'system' are internal. The member read policy did
-- not look at channel:
--
--   using (account_user_id = auth.uid()
--          or lower(client_email) = lower(auth.jwt() ->> 'email'))
--
-- Every note is written against the client's own email (that is how the row is
-- attributed to their booking), so a client could read every internal note on
-- their job. That is already true of any note written today with "email the
-- client" left unticked - not just of the notes panel being added now.
--
-- Members now see channel = 'email' only: the things we actually sent them.
--
-- Documents are deliberately NOT touched. They are how guidance and PDFs get
-- shared with the client, so a client seeing their own documents is the point.
-- Only messages change here.
-- ============================================================

drop policy if exists "booking_messages read own" on public.booking_messages;
create policy "booking_messages read own"
  on public.booking_messages for select
  to anon, authenticated
  using (
    channel = 'email'
    and (
      account_user_id = auth.uid()
      or lower(client_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- ============================================================
-- Check it worked. As an admin this returns everything (the Worker uses the
-- service role and bypasses RLS), so verify from the member side instead:
-- sign in to the hub as a client and confirm /account/bookings still shows
-- their correspondence and paperwork, and nothing else.
--
--   select channel, count(*) from public.booking_messages group by channel;
-- ============================================================
