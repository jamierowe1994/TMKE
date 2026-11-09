-- Pack orders: closed to the public (Dani, 9 Nov 2026).
--
-- Until now anyone could read every order, add one marked as paid, and any
-- signed-in member could change one. From here:
--   * staff can see and change every order
--   * a signed-in member can see their own orders, and change nothing
--   * nobody else can see or do anything
--
-- Checkout, the Stripe webhook and the thank-you page all go through the Worker,
-- which is not affected by these rules. Run the new Worker and site first.
--
-- It's one block on purpose: it makes the change, tests it as a signed-out
-- visitor, a member and a member of staff, and if any test fails the whole lot
-- is undone. Safe to run twice. Deletes no orders and sends nothing.

do $$
declare
  p record;
  v_total int;
  v_seen int;
  v_expected int;
  v_buyer text;
  v_admin_id uuid;
  v_admin_email text;
begin
  if not exists (select 1 from public.admins) then
    raise exception 'The staff list (public.admins) is empty, so this would lock everyone out. Nothing has changed.';
  end if;

  -- The website lets these people into the admin by their email alone, so they
  -- go on the staff list too, or they'd lose Pack orders.
  insert into public.admins (user_id, email)
  select id, email from auth.users
  where email_confirmed_at is not null
    and (lower(email) like '%@tmke.co.uk' or lower(email) = 'james@therecruitmentexperts.co.uk')
  on conflict (user_id) do nothing;

  alter table public.orders enable row level security;

  -- Every old rule goes, whatever it's called: rules add together, so one left
  -- behind would keep the door open.
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'orders' loop
    execute format('drop policy %I on public.orders', p.policyname);
  end loop;

  create policy "orders admin"
    on public.orders for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

  create policy "orders read own"
    on public.orders for select
    to authenticated
    using (
      user_id = auth.uid()
      or lower(trim(buyer_email)) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );

  -- ---- The tests ----
  select count(*) into v_total from public.orders;

  -- Signed out: sees nothing.
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  select count(*) into v_seen from public.orders;
  reset role;
  if v_seen <> 0 then
    raise exception 'A signed-out visitor could still see % orders. Nothing has changed.', v_seen;
  end if;

  -- A member: sees their own orders and can't change any.
  select lower(trim(buyer_email)) into v_buyer from public.orders
    where buyer_email is not null order by created_at desc limit 1;
  if v_buyer is not null then
    select count(*) into v_expected from public.orders where lower(trim(buyer_email)) = v_buyer;
    perform set_config('request.jwt.claims',
      json_build_object('sub', gen_random_uuid(), 'email', v_buyer, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_seen from public.orders;
    if v_seen <> v_expected then
      reset role;
      raise exception 'A member saw % orders instead of their own %. Nothing has changed.', v_seen, v_expected;
    end if;
    update public.orders set status = status;
    get diagnostics v_seen = row_count;
    reset role;
    if v_seen <> 0 then
      raise exception 'A member could still change % orders. Nothing has changed.', v_seen;
    end if;
  end if;

  -- Staff: see every order.
  select user_id, email into v_admin_id, v_admin_email from public.admins limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin_id, 'email', v_admin_email, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_seen from public.orders;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_seen <> v_total then
    raise exception 'Staff saw % of % orders. Nothing has changed.', v_seen, v_total;
  end if;
end $$;

-- What you should see: the two rules below, and "All tests passed".
select
  'All tests passed' as result,
  (select string_agg(policyname, ', ' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'orders') as rules_now,
  (select count(*) from public.admins) as staff_on_the_list,
  (select count(*) from public.orders) as orders_kept;
