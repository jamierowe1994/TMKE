-- A member may see their own photograph
--
-- The Studio looks up the brand-approved photo in the member's own browser,
-- under their own session, and found nothing: `agent_profiles` is staff-only.
-- Everything in the admin centre reads it through the service role, so the
-- gap never showed until something ran as a member.
--
-- The answer is NOT to open that table. It holds join dates, packages,
-- trainer details and a 100%-discount promo code. One function, one field.
--
-- Per brand, because the photo belongs to (person, brand): an agent who is a
-- Property Expert and a Letting Expert is photographed in both liveries, and
-- a Letting board must not carry the Property picture. Pass the brand to get
-- that brand's photo; pass nothing to get their primary one.
--
-- Run in the Supabase SQL editor. Safe to re-run.

create or replace function public.member_brand_photo(p_brand text default null)
  returns text
  language sql
  stable
  security definer
  set search_path = public
as $$
  select ap.brand_photo_url
  from public.contacts c
  join public.agent_profiles ap on ap.contact_id = c.id
  where ap.left_at is null
    and ap.brand_photo_url is not null
    and (
      c.user_id = auth.uid()
      or (c.user_id is null
          and lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
    )
    and (p_brand is null or lower(btrim(ap.brand)) = lower(btrim(p_brand)))
  -- Their primary brand first, so "no brand asked for" means the one their
  -- Studio opens in rather than whichever row was created first.
  order by ap.is_primary desc, ap.created_at
  limit 1
$$;

grant execute on function public.member_brand_photo(text) to authenticated;

-- What you should see, signed in as yourself in the SQL editor: nothing,
-- because auth.uid() is null here. Test it from the hub, not from here.
select public.member_brand_photo() as should_be_null_in_this_editor;
