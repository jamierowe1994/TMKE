-- Buy one, get one free (Danielle, 26 Nov 2026, for Black Friday).
--
-- A fifth kind of offer in the shop, beside the site-wide discount, the
-- discount on one pack, the bundle and the members' price. The packs in a
-- basket pair up and the cheaper of each pair is free; pack_ids holds any
-- packs left out of it. Until this runs, Catalogue › Offers can't save one.
--
-- Run this in the Supabase SQL editor, after supabase/shop_basket.sql.
-- Safe to run again.

alter table public.shop_offers drop constraint if exists shop_offers_kind_check;
alter table public.shop_offers add constraint shop_offers_kind_check
  check (kind in ('sitewide', 'pack', 'bundle', 'member', 'bogof'));

-- What's there now, in one result.
select
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'shop_offers_kind_check') as kinds_allowed,
  (select count(*) from public.shop_offers)                                       as offers,
  (select string_agg(kind || case when active then ' (on)' else ' (off)' end, ', ' order by created_at) from public.shop_offers) as offers_now;
