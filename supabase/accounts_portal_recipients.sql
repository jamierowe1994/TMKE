-- Who gets the accounts emails (Dani, 6 Nov 2026): to Paula and accounts payable,
-- with Rosie-Anne copied in. Both can be changed under Invoicing > Settings >
-- Accounts portal. Sends nothing. Safe to run twice.
alter table public.accounts_portal
  add column if not exists email_cc text;

update public.accounts_portal
   set email_to = 'Paula@newman.uk.com, accountspayable@newman.uk.com',
       email_cc = 'Rosie-Anne@newman.uk.com'
 where id = 1;

select email_to, email_cc, emails_on from public.accounts_portal where id = 1;
