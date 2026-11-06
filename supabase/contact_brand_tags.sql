-- Brand tags on contacts (Dani, 6 Nov 2026): under Network, which brand someone
-- works for, so an email or funnel can go to just one brand.
--
--   Brand: The-Property-Experts
--   Brand: Prestige-Property-Experts
--   Brand: The-Letting-Experts
--   Brand: The-Letting-Experts-Scotland (Scottish agents also get The-Letting-Experts)
--
-- Worked out from agent_profiles, one tag per live brand, so a dual-brand agent
-- has both. Nobody types them. They follow by themselves: add a brand and the tag
-- appears; mark someone as left and it goes. Fine & Country has no brand tag,
-- because Network: Fine-and-Country already says it. All other tags are left alone.
--
-- Nothing is sent: tags added here don't start a funnel. Updating these contacts
-- doesn't move them up the Contacts list either. Safe to run twice. The list at
-- the end shows how many have each tag, and how many TEG contacts have none.

create or replace function public.contact_brand_tags_for(p_contact uuid)
returns text[] language sql stable as $$
  select coalesce(array_agg(distinct tag), '{}') from (
    select 'Brand: ' || regexp_replace(replace(btrim(ap.brand), '&', 'and'), '\s+', '-', 'g') as tag
      from public.agent_profiles ap
     where ap.contact_id = p_contact and ap.left_at is null
       and ap.brand is not null and btrim(ap.brand) <> ''
       and btrim(ap.brand) not ilike 'fine%country%'
    union
    select 'Brand: The-Letting-Experts'
      from public.agent_profiles ap
     where ap.contact_id = p_contact and ap.left_at is null
       and btrim(ap.brand) = 'The Letting Experts Scotland'
  ) t
$$;

create or replace function public.sync_contact_brand_tags(p_contact uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  wanted text[] := public.contact_brand_tags_for(p_contact);
begin
  update public.contacts c
     set tags = array(select x from unnest(coalesce(c.tags, '{}')) x where x not like 'Brand: %') || wanted
   where c.id = p_contact
     and (select coalesce(array_agg(x order by x), '{}') from unnest(coalesce(c.tags, '{}')) x where x like 'Brand: %')
         is distinct from (select coalesce(array_agg(x order by x), '{}') from unnest(wanted) x);
end $$;

create or replace function public.agent_profiles_sync_brand_tags()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' then perform public.sync_contact_brand_tags(old.contact_id); end if;
  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.contact_id is distinct from old.contact_id
                            or new.brand is distinct from old.brand or new.left_at is distinct from old.left_at) then
    perform public.sync_contact_brand_tags(new.contact_id);
  end if;
  return null;
end $$;

drop trigger if exists trg_agent_profiles_brand_tags on public.agent_profiles;
create trigger trg_agent_profiles_brand_tags
  after insert or update or delete on public.agent_profiles
  for each row execute function public.agent_profiles_sync_brand_tags();

-- Everyone now, without moving them up the Contacts list (it sorts by last updated).
alter table public.contacts disable trigger trg_touch_contacts;
do $$
declare r record;
begin
  for r in select distinct contact_id from public.agent_profiles loop
    perform public.sync_contact_brand_tags(r.contact_id);
  end loop;
end $$;
alter table public.contacts enable trigger trg_touch_contacts;

select tag, count(*) as contacts
  from public.contacts, unnest(tags) as tag
 where tag like 'Brand: %'
 group by tag
union all
select 'Network: TEG with no brand tag', count(*)
  from public.contacts c
 where 'Network: TEG' = any(c.tags)
   and not exists (select 1 from unnest(c.tags) x where x like 'Brand: %')
 order by 2 desc;
