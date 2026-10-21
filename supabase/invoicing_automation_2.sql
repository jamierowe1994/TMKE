-- Automatic invoicing, part 2 (Danielle, 21 Oct 2026), from her
-- "Invoicing Automation" sheet. Run after invoicing_automation.sql.
--
--   recurring_invoices   who approves it (Abbie for social media), the day
--                        it's due, the template, the BCC, and a monthly
--                        number to fill in (the TPE hub's agents) before it
--                        can go
--   recurring_quantities that number, month by month
--   videography_bookings the Fine & Country fee check: when Paula was
--                        asked, and her answer
--
-- Then the sheet's rows, loaded once (re-running skips any already there).
-- Ray's (The Auction Company, Ray Purchase) is left out until his new amount
-- is in. Everything starts in November 2026; automatic invoicing itself is
-- still off until it's switched on in Invoicing > Approvals.

alter table public.recurring_invoices
  add column if not exists kind            text not null default 'recurring',  -- recurring | social
  add column if not exists lead_id         uuid,     -- the social media client, so their hub shows it
  add column if not exists approver_email  text,     -- asked to approve before it sends (Abbie)
  add column if not exists due_day         integer,  -- due on this day of the month (e.g. 28)
  add column if not exists template        text,     -- minimal | banded
  add column if not exists bcc_email       text,
  add column if not exists quantity_label  text;     -- e.g. "Number of agents": a number per month, times the line's amount

-- The blind copy each invoice goes with (hello@ for the automatic ones).
alter table public.invoices add column if not exists bcc_email text;

create table if not exists public.recurring_quantities (
  recurring_id uuid not null references public.recurring_invoices(id) on delete cascade,
  month        text not null,                -- 'YYYY-MM'
  qty          numeric not null,
  entered_by   text,
  entered_at   timestamptz not null default now(),
  primary key (recurring_id, month)
);
alter table public.recurring_quantities enable row level security;
drop policy if exists "recurring_quantities admin read" on public.recurring_quantities;
create policy "recurring_quantities admin read" on public.recurring_quantities for select to authenticated using (public.is_admin());

alter table public.videography_bookings
  add column if not exists fc_fee_asked_at    timestamptz,
  add column if not exists fc_fee_answer      text,          -- yes | no
  add column if not exists fc_fee_answered_at timestamptz,
  add column if not exists fc_fee_answered_by text;

-- ---- The sheet's rows ----------------------------------------------------
-- Social media: issued on the 5th, due the 28th, Abbie confirms each month.
-- Internal: sent on their day with no approval; the TPE hub waits for the
-- month's number of agents.
insert into public.recurring_invoices
  (name, kind, lead_id, contact_name, match_email, bill_to_name, bill_to_email, cc_email, bcc_email,
   line_items, amount_pence, frequency, day_of_month, due_day, template, pay_by_card, auto_send,
   approver_email, quantity_label, start_month, active)
select v.name, v.kind,
       (select l.id from public.smm_leads l
         where v.kind = 'social' and v.contact_name is not null
           and (l.full_name ilike v.contact_name or l.business ilike v.contact_name)
         order by l.created_at desc limit 1),
       v.contact_name, lower(v.email), v.bill_to, v.email, v.cc, 'hello@tmke.co.uk',
       jsonb_build_array(jsonb_build_object('description', v.line, 'qty', 1, 'unit_pence', v.pence)),
       v.pence, 'monthly', v.day, v.due, 'minimal', v.card, true,
       case when v.kind = 'social' then 'Abigail.Saunders@themarketingexperts.co.uk' end,
       v.qty_label, '2026-11', true
from (values
  ('Terry Robinson: social media',            'social',    'Terry Robinson',  'Fine & Country (Midlands)',          'Paula@newman.uk.com',                'accountspayable@newman.uk.com, Rosie-Anne@newman.uk.com',                                     'Social media management - Shot and Scheduled (Month YYYY)', 84500, false, 5, 28, null),
  ('Miranda Menzies: social media',           'social',    'Miranda Menzies', 'The Property Experts',               'accountspayable@newman.uk.com',      'paula@newman.uk.com, Rosie-Anne@newman.uk.com, jim@thepropertyexperts.co.uk',                 'Social media management - Bespoke (Month YYYY)',           51700, false, 5, 28, null),
  ('Henry James: newsletter',                 'social',    'Henry James',     'Henry James',                        'Henry@thepropertyexperts.co.uk',     'accountspayable@newman.uk.com, paula@newman.uk.com, Rosie-Anne@newman.uk.com',                'Social media management - Newsletter (Month YYYY)',         7900, false, 5, 28, null),
  ('Sean Coleman: social media',              'social',    'Sean Coleman',    'EB Mortgage Services Ltd',           'coleman_332@hotmail.co.uk',          'accountspayable@newman.uk.com, paula@newman.uk.com, Rosie-Anne@newman.uk.com',                'Social media management - LinkedIn (Month YYYY)',          40000, true,  5, 28, null),
  ('Nathaniel Cleaver: social media',         'social',    'Nathaniel Cleaver','Nathaniel Cleaver',                 'Nathaniel@ThePropertyExperts.co.uk', 'paula@newman.uk.com, Rosie-Anne@newman.uk.com',                                               'Social media management - Bespoke (Month YYYY)',           19900, true,  5, 28, null),
  ('Ian Anthony: social media',               'social',    'Ian Anthony',     'Ian Anthony',                        'tony@iananthonyestates.co.uk',       'paula@newman.uk.com, Rosie-Anne@newman.uk.com, Abigail.Saunders@themarketingexperts.co.uk',  'Social media management - Bespoke (Month YYYY)',           49900, true,  5, 28, null),
  ('The Southam Property Experts: social media','social',  'Mark',            'The Southam Property Experts',       'Mark@thepropertyexperts.co.uk',      'accounts@newman.uk.com, paula@newman.uk.com, Rosie-Anne@newman.uk.com',                       'Social media management - Silver (Month YYYY)',            59900, true,  5, 28, null),
  ('The Gavel Drops: social media',           'social',    'The Gavel Drops', 'The Auction Company',                'accountspayable@newman.uk.com',      'paula@newman.uk.com, Rosie-Anne@newman.uk.com, ray@theauctioncompany.co.uk',                  'Social media management - Bespoke (Month YYYY)',           52500, false, 5, 28, null),
  ('Prestige Property Experts: agent assets', 'recurring', null,              'Prestige Property Experts',          'accountspayable@newman.uk.com',      'paula@newman.uk.com, Rosie-Anne@newman.uk.com, jim@thepropertyexperts.co.uk',                 'PPE Monthly Agent Assets — Month YYYY',                    15000, false, 5, 21, null),
  ('The Letting Experts: agent assets',       'recurring', null,              'The Letting Experts (Nationwide) Ltd','accountspayable@newman.uk.com',     'paula@newman.uk.com, Rosie-Anne@newman.uk.com, susan@thelettingexperts.co.uk',                'TLE Monthly Agent Assets — Month YYYY',                    30000, false, 5, 21, null),
  ('The Property Experts: marketing hub',      'recurring', null,              'The Property Experts INTL Ltd',      'accountspayable@newman.uk.com',      'paula@newman.uk.com, Rosie-Anne@newman.uk.com, jim@thepropertyexperts.co.uk',                 'TPE Marketing Hub - Month YYYY - £25 x {qty} agents',      2500, false, 15, 28, 'Number of agents')
) as v(name, kind, contact_name, bill_to, email, cc, line, pence, card, day, due, qty_label)
where not exists (select 1 from public.recurring_invoices r where r.name = v.name);

notify pgrst, 'reload schema';
