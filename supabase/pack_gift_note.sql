-- TMKE: a gifted pack's message, and whether its bell has gone (Danielle, 27 Nov 2026).
-- Run in Supabase (SQL editor). Safe to run twice.
--
-- gift_note: the team's message from Gift a pack, up to 90 characters. It goes
--   in the gift email and under the bell notification, and shows in
--   Pack orders > Gifted.
-- gift_notified_at: when the bell notification went. Someone gifted a pack
--   before they had an account gets theirs the first time they sign in, and
--   this stops it going twice.

alter table public.orders add column if not exists gift_note text;
alter table public.orders add column if not exists gift_notified_at timestamptz;

alter table public.orders drop constraint if exists orders_gift_note_length;
alter table public.orders add constraint orders_gift_note_length check (gift_note is null or char_length(gift_note) <= 90);

select count(*) filter (where payment_method = 'gift') as gifts,
       count(*) filter (where gift_note is not null) as with_a_message
  from public.orders;
