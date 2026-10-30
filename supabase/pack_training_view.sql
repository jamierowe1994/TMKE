-- Let the training account see one print pack, for screenshots (Danielle, 30 Oct 2026).
--
-- The "Your First Print Design" course's walks need pictures of a Canvassing
-- Cards template, taken in the training account (Alex Mercer / Rimberio
-- Homes). Nobody is signed in there, so it reads as anon, and brand packs are
-- shut to anon. A pack marked `training` opens to everyone, signed in or not,
-- while it's active, and so do its active templates.
--
-- TEMPORARY. Once the shots are taken, close it again:
--   update public.packs set training = false where training;
-- The walks show pictures, not the live pack, so nothing breaks when it shuts.
-- While it's open, anybody with the site address could read that pack's
-- templates, so don't leave it on.
--
-- Builds on supabase/pack_free_window.sql (the latest can_see_pack() and
-- "packs read active"); everything else in those stays as it was. Run in the
-- Supabase SQL editor. Safe to re-run.

alter table public.packs
  add column if not exists training boolean not null default false;

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
          or (
            (p.access <> 'brands' or p.brands && public.member_brands())
            and (p.access <> 'members' or auth.uid() is not null)
            and public.pack_open_now(p.available_from, p.available_until)
          )
        )
    )
  end
$$;

drop policy if exists "packs read active" on public.packs;
create policy "packs read active"
  on public.packs for select
  using (
    status = 'active'
    and (
      training
      or public.is_staff()
      or (
        (access <> 'brands' or brands && public.member_brands())
        and (access <> 'members' or auth.uid() is not null)
        and public.pack_open_now(available_from, available_until)
      )
    )
  );

-- Switch it on for The Property Experts' canvassing pack.
update public.packs
   set training = true
 where kind = 'print'
   and 'The Property Experts' = any(brands)
   and title ilike '%canvass%';

-- Check: every TPE print pack, and which one is now open for training.
-- Exactly one row should say training = true; if none does, the title
-- didn't match, so look at the titles here and flag the right one by id.
select id, title, brands, status, training
  from public.packs
 where kind = 'print'
   and 'The Property Experts' = any(brands)
 order by training desc, title;
