-- The print materials guide: what each print design is for (Danielle, 30 Oct 2026).
--
-- Feeds "Your Print Materials", the member guide at /account/guides/print/<brand>/
-- (one per brand, because each brand's templates differ), and is edited in
-- Admin > Design studio > Print > Print materials.
--
--   packs.print_type       which page of the guide a print pack goes on:
--                          canvassing-cards, brochures, leaflets or other
--   print_guide            one row per print template:
--     title                optional; blank means the template's name without
--                          its "TPE_CC_" / "PPE_Flyer_" prefix (print_guide_title)
--     summary              what it is
--     when_to_use          when an agent would use it
--
-- Members read a template's row only when they can already read the template
-- (active, in a pack they can see: can_see_pack()), so each brand's agents see
-- their own brand's words and nobody else's. Staff read everything; admins
-- write. Seeded with the drafts from src/data/print-materials.js, matched to
-- the templates by their front preview, so nothing is lost when the guide
-- switches over. The seed never overwrites a row that's already there.
--
-- Builds on supabase/pack_training_view.sql (can_see_pack()). Run in the
-- Supabase SQL editor. Safe to re-run.

alter table public.packs
  add column if not exists print_type text;

alter table public.packs drop constraint if exists packs_print_type_check;
alter table public.packs add constraint packs_print_type_check
  check (print_type is null or print_type in ('canvassing-cards', 'brochures', 'leaflets', 'other'));

create table if not exists public.print_guide (
  template_id  text primary key references public.templates(id) on delete cascade,
  title        text,
  summary      text,
  when_to_use  text,
  updated_at   timestamptz not null default now(),
  updated_by   text
);

alter table public.print_guide enable row level security;

drop policy if exists "print_guide read" on public.print_guide;
create policy "print_guide read"
  on public.print_guide for select
  using (
    public.is_staff()
    or exists (
      select 1 from public.templates t
      where t.id = print_guide.template_id
        and t.status = 'active'
        and public.can_see_pack(t.pack_id)
    )
  );

drop policy if exists "print_guide admin write" on public.print_guide;
create policy "print_guide admin write"
  on public.print_guide for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop trigger if exists print_guide_touch on public.print_guide;
create trigger print_guide_touch before update on public.print_guide
  for each row execute function public.content_months_touch();

-- A template's name as the guide shows it when no title is set:
-- "TPE_CC_Valuation Invitation" -> "Valuation Invitation".
create or replace function public.print_guide_title(p_name text)
  returns text
  language sql
  immutable
as $$
  select btrim(replace(regexp_replace(coalesce(p_name, ''), '^[A-Za-z]+_[A-Za-z0-9]+_', ''), '_', ' '))
$$;

grant execute on function public.print_guide_title(text) to anon, authenticated;

-- The pack types, for the four print packs live on 30 Oct.
update public.packs p
   set print_type = v.print_type
  from (values
  ('422cadb3-0e74-4f54-89aa-150e115e052f'::uuid, 'canvassing-cards'),
  ('77e2bf1a-a3cf-424c-98d1-d315434049e2'::uuid, 'brochures'),
  ('e741af78-8353-4298-b377-3332282d0efd'::uuid, 'canvassing-cards'),
  ('ad1f3f17-bf3f-433a-8685-dc9a5c0d6132'::uuid, 'brochures')
  ) as v(id, print_type)
 where p.id = v.id and p.print_type is null;

-- The drafts, matched by pack and front preview (or, failing that, by name).
-- A title is kept only where it differs from the template's own name.
with seed(pack_id, front, title, summary, when_to_use) as (values
  ('422cadb3-0e74-4f54-89aa-150e115e052f'::uuid, '1ipjg0b-4zkz.jpg', 'Valuation Invitation',
   'Invites homeowners to book a free, no-obligation valuation, with your details and a QR code on the back.',
   'When canvassing an area where you''d like more instructions, or following up a sale nearby.'),
  ('422cadb3-0e74-4f54-89aa-150e115e052f'::uuid, '19807nw-3fkb.jpg', 'Sorry I Missed You',
   'A friendly note for when you''ve called and nobody was home, inviting them to get in touch.',
   'Through the door after an unanswered knock, while door-knocking or calling by.'),
  ('422cadb3-0e74-4f54-89aa-150e115e052f'::uuid, 'cqkvsa-83rn.jpg', 'New To Market',
   'Announces a property you''ve just listed, with its photos, key details and guide price.',
   'Around a new listing, to find buyers and show neighbours you''re active in their area.'),
  ('422cadb3-0e74-4f54-89aa-150e115e052f'::uuid, 'tb8fnz-4lrj.jpg', 'Open House Invitation',
   'Invites people to an open house, with the date, time and the property''s details.',
   'In the week or two before an open house, delivered around the property.'),
  ('422cadb3-0e74-4f54-89aa-150e115e052f'::uuid, '107tcje-74d7.jpg', 'Recently Sold',
   'Shares a recent sale and tells nearby homeowners you have buyers looking for similar homes.',
   'Once a sale is agreed or completes, delivered to the streets around it.'),
  ('77e2bf1a-a3cf-424c-98d1-d315434049e2'::uuid, '1x1828g-5a93.jpg', '10 Ways To Attract More Buyers',
   'A practical guide for sellers: ten ways to attract more buyers, from photography and staging to video and targeted adverts.',
   'For homeowners whose property hasn''t sold, or to leave behind after a valuation.'),
  ('77e2bf1a-a3cf-424c-98d1-d315434049e2'::uuid, '11pap97-76j7.jpg', '20 Reasons To Choose The Property Experts',
   'Twenty reasons to choose The Property Experts, from one agent start to finish to marketing that reaches more buyers.',
   'At or after a valuation appointment, or alongside a pitch for an instruction.'),
  ('e741af78-8353-4298-b377-3332282d0efd'::uuid, 'ohlszx-8awj.jpg', 'Valuation Invitation',
   'Invites homeowners to book a free, no-obligation valuation, with your details and a QR code on the back.',
   'When canvassing an area where you''d like more instructions, or following up a sale nearby.'),
  ('e741af78-8353-4298-b377-3332282d0efd'::uuid, '1lqjv4z-33hj.jpg', 'Sorry I Missed You',
   'A friendly note for when you''ve called and nobody was home, inviting them to get in touch.',
   'Through the door after an unanswered knock, while door-knocking or calling by.'),
  ('e741af78-8353-4298-b377-3332282d0efd'::uuid, '1d50v2i-79ir.jpg', 'New To Market',
   'Announces a property you''ve just listed, with its photos, key details and guide price.',
   'Around a new listing, to find buyers and show neighbours you''re active in their area.'),
  ('e741af78-8353-4298-b377-3332282d0efd'::uuid, '14vvg68-4xaf.jpg', 'Open House Invitation',
   'Invites people to an open house, with the date, time and the property''s details.',
   'In the week or two before an open house, delivered around the property.'),
  ('e741af78-8353-4298-b377-3332282d0efd'::uuid, '1tohjbz-5x1n.jpg', 'Recently Sold',
   'Shares a recent sale and tells nearby homeowners you have buyers looking for similar homes.',
   'Once a sale is agreed or completes, delivered to the streets around it.'),
  ('ad1f3f17-bf3f-433a-8685-dc9a5c0d6132'::uuid, 'wacacq-5b1b.jpg', '10 Ways To Attract More Buyers',
   'A practical guide for sellers: ten ways to attract more buyers, from photography and staging to video and targeted adverts.',
   'For homeowners whose property hasn''t sold, or to leave behind after a valuation.'),
  ('ad1f3f17-bf3f-433a-8685-dc9a5c0d6132'::uuid, 'b0zab7-8s8v.jpg', '20 Reasons To Choose The Property Experts',
   'Twenty reasons to choose The Property Experts, from one agent start to finish to marketing that reaches more buyers.',
   'At or after a valuation appointment, or alongside a pitch for an instruction.')
), matched as (
  select distinct on (t.id) t.id, t.name, s.title, s.summary, s.when_to_use
    from seed s
    join public.templates t
      on t.pack_id = s.pack_id
     and (split_part(t.thumb_url, '?', 1) like '%/' || s.front
          or lower(public.print_guide_title(t.name)) = lower(s.title))
   order by t.id, (split_part(t.thumb_url, '?', 1) like '%/' || s.front) desc
)
insert into public.print_guide (template_id, title, summary, when_to_use, updated_by)
select id, nullif(title, public.print_guide_title(name)), summary, when_to_use, 'seed: print-materials.js'
  from matched
on conflict (template_id) do nothing;

-- Check: every print template, its pack's type and whether it has words.
-- Each of the 14 seeded designs should say has_words = true.
select (select string_agg(b, ', ') from unnest(p.brands) b) as brands,
       p.title as pack, p.print_type, t.name as template, t.status,
       coalesce(g.title, public.print_guide_title(t.name)) as shown_as,
       g.template_id is not null as has_words
  from public.templates t
  join public.packs p on p.id = t.pack_id
  left join public.print_guide g on g.template_id = t.id
 where p.kind = 'print'
 order by brands, p.sort_order, t.sort_order;
