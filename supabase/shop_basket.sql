-- The shop's basket and offers (Danielle, 26 Nov 2026).
--
-- One payment can now cover several packs, and a pack can be sold for less
-- than its usual price: a site-wide percentage, a discount on one pack, a
-- bundle price, or the members' discount. The Worker works every price out
-- (never the browser) and writes what it charged on each order.
--
-- An order is still ONE row per pack, so the library, Your orders and the
-- pack figures keep working as they are. Packs paid for together share a
-- checkout_id.
--
-- Run this in the Supabase SQL editor. Safe to run again.

-- ---- Orders: the basket it came in, and the discount it was sold at -------
alter table public.orders add column if not exists checkout_id      uuid;
alter table public.orders add column if not exists list_price_pence integer;   -- the pack's usual price, ex VAT, when it was bought
alter table public.orders add column if not exists discount_kind    text;      -- sitewide | pack | bundle | member, or null at the usual price
alter table public.orders add column if not exists discount_label   text;      -- what the customer was shown, e.g. "Black Friday, 20% off"
alter table public.orders add column if not exists is_test          boolean not null default false;   -- paid in Stripe's test mode by a test login
create index if not exists orders_checkout_idx on public.orders (checkout_id);

-- ---- Offers ---------------------------------------------------------------
--   sitewide  percent off every pack, except the ones in pack_ids
--   pack      percent off, or a sale price (price_pence), for the pack in pack_id
--   bundle    the pack in pack_id sells at price_pence when the basket also
--             holds one of the packs in pack_ids
--   member    percent off every pack for anyone signed in
-- starts_at / ends_at are optional; an offer only counts while active is true
-- and now is inside its dates.
create table if not exists public.shop_offers (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('sitewide', 'pack', 'bundle', 'member', 'bogof')),   -- bogof: supabase/shop_bogof.sql adds it where this ran first
  active      boolean not null default false,
  label       text,
  percent     numeric(5,2) check (percent is null or (percent > 0 and percent <= 100)),
  price_pence integer check (price_pence is null or price_pence >= 0),
  pack_id     uuid references public.packs(id) on delete cascade,
  pack_ids    uuid[] not null default '{}',
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.shop_offers enable row level security;
drop policy if exists "shop_offers admin" on public.shop_offers;
create policy "shop_offers admin" on public.shop_offers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- The shop's own settings: one row --------------------------------------
-- basket_live: off, the shop is as it was for everyone but the team and the
-- test logins, who see the basket so it can be tried first. On, everyone has it.
create table if not exists public.shop_settings (
  id               integer primary key default 1 check (id = 1),
  basket_live      boolean not null default false,
  banner_on        boolean not null default false,
  banner_text      text,
  banner_starts_at timestamptz,
  banner_ends_at   timestamptz,
  updated_at       timestamptz not null default now()
);
insert into public.shop_settings (id) values (1) on conflict (id) do nothing;
alter table public.shop_settings enable row level security;
drop policy if exists "shop_settings admin" on public.shop_settings;
create policy "shop_settings admin" on public.shop_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- What's there now, in one result.
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'orders'
     and column_name in ('checkout_id', 'list_price_pence', 'discount_kind', 'discount_label', 'is_test')) as order_columns_of_5,
  (select count(*) from public.shop_offers)                               as offers,
  (select basket_live from public.shop_settings where id = 1)             as basket_live,
  (select string_agg(tablename || ': ' || policyname, ', ' order by tablename)
     from pg_policies where schemaname = 'public' and tablename in ('shop_offers', 'shop_settings')) as rules;
