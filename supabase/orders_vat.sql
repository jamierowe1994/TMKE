-- ============================================================
-- VAT on direct purchases
-- ============================================================
-- Additive and safe to re-run.
--
-- Packs and the videography edit upsells are advertised ex-VAT ("£24 +VAT",
-- "£25 +VAT per image") but were charging the bare net figure, so no VAT was
-- ever collected on either. The worker now grosses up before it reaches
-- Stripe; these columns record the split it used, the same way public.invoices
-- already stores subtotal / vat / total.
--
-- Existing rows are deliberately left NULL rather than back-filled. Those
-- customers really were charged the net figure, and an invoice has to match
-- the money that actually moved — so a row with no split is rendered by
-- treating amount_pence as VAT-INCLUSIVE and working backwards. Writing a
-- split onto them would claim a payment that never happened.
-- ============================================================

-- amount_pence keeps its meaning: the NET, ex-VAT figure.
alter table public.orders
  add column if not exists vat_pence   integer,
  add column if not exists total_pence integer;

comment on column public.orders.amount_pence is 'Net, ex-VAT. The advertised pack price.';
comment on column public.orders.vat_pence   is 'VAT charged. NULL on pre-VAT orders — treat amount_pence as gross.';
comment on column public.orders.total_pence is 'Gross actually charged to the card. NULL on pre-VAT orders.';

-- Same split for the videography edit upsells (faux twilight, extra images).
alter table public.videography_edit_requests
  add column if not exists vat_pence   integer,
  add column if not exists total_pence integer;
