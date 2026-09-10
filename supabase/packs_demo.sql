-- The demo pack.
--
-- One pack, flagged demo, that is hidden from the shop, offered in the Member
-- Hub demo for visitors to try the Studio with, and free with every account:
-- a signed-in member sees it among their packs without an order. Admin ->
-- Studio -> Catalogue has a panel to create it and to copy templates into it.
--
-- Run in the Supabase SQL editor. Safe to re-run.

alter table public.packs add column if not exists demo boolean not null default false;
