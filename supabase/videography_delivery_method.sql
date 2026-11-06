-- How a shoot reaches the client (Dani, 6 Nov 2026). Pixieset is the default and
-- nothing about those shoots changes. Client portal means no gallery and no PIN:
-- Jack presses Content ready, and its folder shows in their portal once it's
-- paid, or management release it before payment. A released shoot stays in Needs
-- you on Invoicing until it's paid.
--
-- Adds three columns. Changes no existing shoot's delivery, sends nothing, and
-- is safe to run twice. Run it in the Supabase SQL editor.
alter table public.videography_bookings
  add column if not exists delivery_method    text not null default 'pixieset',
  add column if not exists released_unpaid_at timestamptz,
  add column if not exists released_unpaid_by text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'videography_bookings_delivery_method_check') then
    alter table public.videography_bookings
      add constraint videography_bookings_delivery_method_check check (delivery_method in ('pixieset', 'portal'));
  end if;
end $$;

-- What this should say: every shoot on pixieset, none on portal, none released.
select delivery_method, count(*) as shoots, count(released_unpaid_at) as released_before_payment
  from public.videography_bookings
 group by delivery_method;
