-- ============================================================
-- Per-invoice payment terms, and content-release wording
-- ============================================================
-- Additive and safe to re-run. Adds two empty columns to `invoices`; no
-- existing invoice changes and no permissions change.
--
-- WHY PER-INVOICE TERMS
-- payment_terms_days in invoice_settings is a single global. Videography needs
-- ten days - the invoice goes out two days before the shoot and editing may not
-- finish until around day six, so a shorter term asks people to pay before they
-- have seen anything. Social media management does not need that, and moving
-- the global would have silently changed those invoices too.
--
-- terms_days is therefore a per-invoice override. NULL means "use the global",
-- so every existing invoice and every future SMM invoice is unaffected.
--
-- WHY A RELEASE FLAG
-- A videography invoice has to say two things an SMM invoice must not:
--   - payment is not required until the shoot has taken place
--   - content cannot be downloaded until payment has been received
--
-- That could have been inferred from booking_source, but invoices raised from
-- the standalone Invoicing page default to 'videography' whether or not they
-- are for a shoot - so inferring it would put a promise about content on
-- invoices that have nothing to do with content. An explicit flag, set by the
-- person raising the invoice, cannot be wrong by accident.
-- ============================================================

alter table public.invoices
  add column if not exists terms_days         integer,
  add column if not exists release_on_payment boolean not null default false;
