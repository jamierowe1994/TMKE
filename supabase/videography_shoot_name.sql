-- An optional name for a shoot (Dani, 7 Nov 2026), used as its title in the client
-- portal. Left empty, the title is the first line of the address, then the client's
-- name. Adds one empty column. Sends nothing and is safe to run twice. Run it in the
-- Supabase SQL editor.
alter table public.videography_bookings
  add column if not exists shoot_name text;

-- What this should say: no shoot names yet.
select count(shoot_name) as shoots_with_a_name from public.videography_bookings;
