-- Regular invoices tidy-up (Dani, 10 Nov 2026). Safe to run twice.
--
-- 1. Southam's monthly invoice is tied to Southam's social media card, so it
--    shows once, under Social media, and its invoices count there.
-- 2. The three older recurring invoices made by hand (PPE Monthly Assets, TLE
--    Monthly Assets, TPE Marketing Hub) are stopped. The proper ones that go
--    out by themselves stay: Prestige Property Experts: agent assets, The
--    Letting Experts: agent assets, The Property Experts: marketing hub. Any
--    invoice tied to an old one moves to its proper one. Nothing is deleted,
--    no invoice changes otherwise, and nothing is sent.
--
-- A backup of every row touched is kept first. If a name doesn't match
-- exactly one row, it stops and changes nothing.

create table if not exists public.recurring_invoices_backup_tidy as
  select now() as backed_up_at, r.* from public.recurring_invoices r where false;
alter table public.recurring_invoices_backup_tidy enable row level security;
create table if not exists public.invoices_backup_tidy as
  select now() as backed_up_at, i.id, i.number, i.recurring_id, i.billing_month from public.invoices i where false;
alter table public.invoices_backup_tidy enable row level security;

do $$
declare
  pairs text[][] := array[
    ['PPE Monthly Assets', 'Prestige Property Experts: agent assets'],
    ['TLE Monthly Assets', 'The Letting Experts: agent assets'],
    ['TPE Marketing Hub',  'The Property Experts: marketing hub']
  ];
  p text[]; old_id uuid; new_id uuid; n int; lead uuid; south uuid; moved int;
begin
  -- 1. Southam
  select count(*) into n from public.smm_leads
   where pipeline_stage = 'active_client' and (business ilike '%southam%' or full_name ilike '%southam%');
  if n <> 1 then raise exception 'Expected one active Southam card, found %. Nothing changed.', n; end if;
  select id into lead from public.smm_leads
   where pipeline_stage = 'active_client' and (business ilike '%southam%' or full_name ilike '%southam%');
  select count(*) into n from public.recurring_invoices where active and kind = 'social' and name ilike '%southam%';
  if n <> 1 then raise exception 'Expected one Southam monthly invoice, found %. Nothing changed.', n; end if;
  select id into south from public.recurring_invoices where active and kind = 'social' and name ilike '%southam%';
  insert into public.recurring_invoices_backup_tidy select now(), r.* from public.recurring_invoices r where r.id = south;
  update public.recurring_invoices set lead_id = lead where id = south and lead_id is distinct from lead;
  raise notice 'Southam: monthly invoice tied to its card.';

  -- 2. The old ones
  foreach p slice 1 in array pairs loop
    select count(*) into n from public.recurring_invoices where name = p[2] and active;
    if n <> 1 then raise exception 'Expected one active "%", found %. Nothing changed.', p[2], n; end if;
    select id into new_id from public.recurring_invoices where name = p[2] and active;
    select count(*) into n from public.recurring_invoices where name = p[1] and active;
    if n = 0 then raise notice '"%" already stopped.', p[1]; continue; end if;
    if n > 1 then raise exception 'More than one active "%". Nothing changed.', p[1]; end if;
    select id into old_id from public.recurring_invoices where name = p[1] and active;
    insert into public.recurring_invoices_backup_tidy select now(), r.* from public.recurring_invoices r where r.id = old_id;
    insert into public.invoices_backup_tidy select now(), i.id, i.number, i.recurring_id, i.billing_month from public.invoices i where i.recurring_id = old_id;
    update public.invoices set recurring_id = new_id where recurring_id = old_id;
    get diagnostics moved = row_count;
    update public.recurring_invoices set active = false where id = old_id;
    raise notice '"%" stopped; % invoice(s) moved to "%".', p[1], moved, p[2];
  end loop;
end $$;

notify pgrst, 'reload schema';

-- What's left, to check: every active regular invoice, social ones with their card.
select r.name, r.kind, (r.lead_id is not null) as tied_to_card, r.amount_pence / 100.0 as amount, r.start_month
  from public.recurring_invoices r where r.active order by r.kind, r.name;
