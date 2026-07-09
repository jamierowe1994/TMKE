-- ============================================================================
-- TMKE Invoicing — seed the company/finance details (editable later in
-- Admin → Invoicing → Settings). Run AFTER supabase/invoicing.sql. Safe to re-run.
-- ============================================================================
update public.invoice_settings set
  company_name       = 'The Marketing Experts (Nationwide) Ltd',
  company_address    = '5 Regent Street, Rugby, Warwickshire, CV21 2PE, United Kingdom',
  company_reg_no     = '15221860',
  vat_number         = '443906487',
  vat_rate           = 20,
  account_name       = 'The Property Experts Intl Ltd',
  sort_code          = '20-73-48',
  account_number     = '43322629',
  payment_terms_days = 7,
  invoice_prefix     = 'TMKE',
  accounts_cc_email  = 'Paula@newman.uk.com, danielle@tmke.co.uk',
  next_number        = coalesce(next_number, 1001)
where id = 1;
