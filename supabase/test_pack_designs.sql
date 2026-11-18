-- Test packs show their designs (Danielle, 18 Nov 2026).
--
-- Catalogue › Final checks › Send me the test pack (and Send to a team
-- member) put a draft pack in a named login's Studio. The pack showed, but it
-- opened empty: a member reads a pack's designs only through can_see_pack(),
-- which waits for the pack's free window (Santa Baby... opens 20 Nov 8am), so
-- a test login saw nothing until then. A login named on the pack's
-- test_user_ids now sees its designs straight away. Nobody else's view
-- changes.
--
-- Builds on supabase/pack_training_view.sql (the latest can_see_pack()), with
-- one line added. Run in the Supabase SQL editor. Safe to re-run. Changes no
-- pack or design. Sends nothing.

create or replace function public.can_see_pack(p_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select case
    when p_id is null then true
    when public.is_staff() then true
    else exists (
      select 1 from public.packs p
      where p.id = p_id
        and (
          (p.training and p.status = 'active')
          or (auth.uid() is not null and auth.uid() = any(p.test_user_ids))
          or (
            (p.access <> 'brands' or p.brands && public.member_brands())
            and (p.access <> 'members' or auth.uid() is not null)
            and public.pack_open_now(p.available_from, p.available_until)
          )
        )
    )
  end
$$;

-- Check: each test pack, how many logins have it, and how many live designs
-- it has (what those logins will now see).
select p.title, cardinality(p.test_user_ids) as test_logins,
       (select count(*) from public.templates t where t.pack_id = p.id and t.status = 'active') as designs
  from public.packs p
 where cardinality(p.test_user_ids) > 0;
