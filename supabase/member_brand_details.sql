-- Their details AT THIS BRAND — all of them, not just the photograph
--
-- An agent who works for two brands is two different people on paper. Danielle
-- put it exactly right: a Prestige agent often covers a narrower patch than
-- they do for The Property Experts, has a different email address at each, and
-- may have been photographed twice in different liveries.
--
-- `agent_profiles` has held all of that per person per brand since the dual-
-- brand work. What has been missing is a way for the MEMBER's own browser to
-- read their row for a NAMED brand — so a Prestige canvassing card fills in
-- from their Prestige row rather than from whichever brand they happen to
-- have marked as their main one.
--
-- One function, one row, only their own. The table stays shut: it also holds
-- join dates, packages, trainer details and a 100%-discount promo code.
--
-- Run in the Supabase SQL editor, after supabase/member_brand_photo.sql.
-- Safe to re-run.

create or replace function public.member_brand_details(p_brand text default null)
  returns jsonb
  language sql
  stable
  security definer
  set search_path = public
as $$
  select to_jsonb(d) from (
    select btrim(ap.brand)    as brand,
           ap.is_primary      as is_primary,
           ap.job_title       as job_title,
           ap.area            as area,
           ap.email           as email,
           ap.phone           as phone,
           ap.brand_photo_url as photo
    from public.contacts c
    join public.agent_profiles ap on ap.contact_id = c.id
    where ap.left_at is null
      and ap.brand is not null
      and (
        c.user_id = auth.uid()
        or (c.user_id is null
            and lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      )
      -- Asked for a brand: that brand and no other. A Prestige card must not
      -- fall back to the Property Experts row -- wrong patch, wrong address,
      -- wrong photograph, printed.
      and (p_brand is null or lower(btrim(ap.brand)) = lower(btrim(p_brand)))
    order by ap.is_primary desc, ap.created_at
    limit 1
  ) d
$$;

grant execute on function public.member_brand_details(text) to authenticated;

-- Null in this editor (auth.uid() is null here). Test it from the hub.
select public.member_brand_details() as should_be_null_in_this_editor;
