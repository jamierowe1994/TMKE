-- The cover photo on a client's delivery emails (Dani, 7 Nov 2026). Chosen on the
-- shoot's Delivery section and saved as a 16:9 picture at a permanent address.
-- Adds one empty column. Sends nothing and is safe to run twice. Run it in the
-- Supabase SQL editor.
alter table public.videography_bookings
  add column if not exists cover_url text;

-- What this should say: no covers yet.
select count(cover_url) as shoots_with_a_cover from public.videography_bookings;
