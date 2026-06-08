-- ============================================================
-- TMKE — condense the catalogue to 6 packs + seed placeholder
-- designs into each, so the studio's "open a pack → pick a
-- design" flow has real content to choose from.
--
-- Each design is an editable template (Unsplash photo + headline +
-- sub + rule), mirroring the bundled library shape so they render
-- and edit correctly. These are PLACEHOLDERS — replace them by
-- designing real templates in the studio and publishing into the pack.
--
-- Safe to re-run: it only touches the six named packs and the
-- 'seed-%' template ids it creates.
-- Run AFTER schema.sql + templates.sql, in the Supabase SQL editor.
-- ============================================================

-- 1) Keep six packs; archive the four extras (reversible — just flip
--    status back to 'active' to restore them).
update public.packs set status = 'archived'
where slug in ('countryside-cottage', 'loft-living', 'family-forever', 'winter-editorial');

update public.packs set status = 'active'
where slug in (
  'modern-mews', 'heritage-townhouse', 'coastal-retreat',
  'estate-classic', 'city-penthouse', 'garden-sanctuary'
);

-- 2) Clear any previously-seeded placeholder designs so this re-runs cleanly.
delete from public.templates where id like 'seed-%';

-- 3) Build + insert 6 designs per pack.
with pack_photos(slug, photos) as (
  values
    ('modern-mews',        array['1560448204-e02f11c3d0e2','1512917774080-9991f1c4c750','1448630360428-65456885c650','1583847268964-b28dc8f51f92','1600566753190-17f0baa2a6c3','1600585154526-990dced4db0d']),
    ('heritage-townhouse', array['1501183638710-841dd1904471','1493663284031-b7e3aefcae8e','1519710164239-da123dc03ef4','1600210491892-03d54c0aaf87','1513694203232-719a280e022f','1503174971373-b1f69850bded']),
    ('coastal-retreat',    array['1600210492486-724fe5c67fb0','1502672260266-1c1ef2d93688','1567016432779-094069958ea5','1600607687939-ce8a6c25118c','1600573472556-e636c2acda88','1494526585095-c41746248156']),
    ('estate-classic',     array['1600585154340-be6161a56a0c','1600596542815-ffad4c1539a9','1505691938895-1758d7feb511','1505842465776-3d90f616310d','1493663284031-b7e3aefcae8e','1501183638710-841dd1904471']),
    ('city-penthouse',     array['1430285561322-7808604715df','1512917774080-9991f1c4c750','1600566753190-17f0baa2a6c3','1554995207-c18c203602cb','1583847268964-b28dc8f51f92','1600585154526-990dced4db0d']),
    ('garden-sanctuary',   array['1600121848594-d8644e57abab','1518733057094-95b53143d2a7','1469854523086-cc02fe5d8800','1505693416388-ac5ce068fe85','1513694203232-719a280e022f','1505842465776-3d90f616310d'])
),
meta(n, headline, category, sub) as (
  values
    (1, 'Just Listed',       'Just Listed', 'Three bedrooms, south-facing garden, ready to view.'),
    (2, 'New To Market',     'Coming Soon', 'Be the first to know when it hits the market.'),
    (3, 'Featured Property', 'Spotlight',   'An editor''s pick from this week''s selection.'),
    (4, 'Open House Sunday',  'Open House',  'Sunday, 11am–1pm. No appointment needed.'),
    (5, 'Step Inside',       'Home Tour',   'A guided tour through every room.'),
    (6, 'Now Showing',       'Now Showing', 'Open for viewings from this weekend.')
),
pal(n, bg, fg, accent) as (
  values
    (1, '#1c1d22', '#F0EEEB', '#B9826A'),
    (2, '#474254', '#F0EEEB', '#BCB3B9'),
    (3, '#B9826A', '#F0EEEB', '#1c1d22'),
    (4, '#1c1d22', '#F0EEEB', '#B9826A'),
    (5, '#474254', '#F0EEEB', '#BCB3B9'),
    (6, '#333747', '#F0EEEB', '#B9826A')
),
rows as (
  select
    pp.slug,
    m.n,
    pp.photos[m.n] as photo,
    m.headline, m.category, m.sub,
    pl.bg, pl.fg, pl.accent
  from pack_photos pp
  cross join meta m
  join pal pl on pl.n = m.n
)
insert into public.templates (id, name, category, thumb_url, canvas, elements, pack_id, status, sort_order)
select
  'seed-' || r.slug || '-' || lpad(r.n::text, 2, '0'),
  r.headline || ' — ' || lpad(r.n::text, 2, '0'),
  r.category,
  'https://images.unsplash.com/photo-' || r.photo || '?auto=format&fit=crop&w=600&h=750&q=80',
  jsonb_build_object('width', 1080, 'height', 1350, 'background', r.bg),
  jsonb_build_array(
    jsonb_build_object('id','bg-photo','type','image','x',0,'y',0,'w',1080,'h',1350,'rotation',0,
      'src','https://images.unsplash.com/photo-'||r.photo||'?auto=format&fit=crop&w=1080&h=1350&q=80',
      'opacity',0.85,'locked',false),
    jsonb_build_object('id','tint','type','rect','x',0,'y',0,'w',1080,'h',1350,'rotation',0,
      'fill',r.bg,'opacity',0.18,'stroke','transparent','strokeWidth',0,'radius',0),
    jsonb_build_object('id','eyebrow','type','text','x',80,'y',110,'w',540,'h',32,'rotation',0,
      'text',upper(r.category),'font','Darker Grotesque','size',18,'weight',700,'italic',false,
      'color',r.fg,'align','left','letterSpacing',6,'lineHeight',1.2),
    jsonb_build_object('id','rule','type','rect','x',80,'y',950,'w',80,'h',2,'rotation',0,
      'fill',r.accent,'opacity',1,'stroke','transparent','strokeWidth',0,'radius',0),
    jsonb_build_object('id','headline','type','text','x',80,'y',980,'w',920,'h',220,'rotation',0,
      'text',r.headline,'font','Cormorant Garamond','size',96,'weight',500,'italic',false,
      'color',r.fg,'align','left','letterSpacing',-1,'lineHeight',1),
    jsonb_build_object('id','sub','type','text','x',80,'y',1210,'w',800,'h',80,'rotation',0,
      'text',r.sub,'font','Cormorant Garamond','size',26,'weight',400,'italic',true,
      'color',r.fg,'align','left','letterSpacing',0,'lineHeight',1.35)
  ),
  p.id,
  'active',
  r.n
from rows r
join public.packs p on p.slug = r.slug;

-- 4) Refresh the six packs' cover images to their first design's photo.
update public.packs p
set cover_image_url = 'https://images.unsplash.com/photo-' || c.photo || '?auto=format&fit=crop&w=1400&q=80'
from (values
  ('modern-mews',        '1560448204-e02f11c3d0e2'),
  ('heritage-townhouse', '1501183638710-841dd1904471'),
  ('coastal-retreat',    '1600210492486-724fe5c67fb0'),
  ('estate-classic',     '1600585154340-be6161a56a0c'),
  ('city-penthouse',     '1430285561322-7808604715df'),
  ('garden-sanctuary',   '1600121848594-d8644e57abab')
) as c(slug, photo)
where p.slug = c.slug;

-- Sanity check (optional): how many designs each active pack now has.
-- select p.slug, count(t.id) as designs
-- from public.packs p left join public.templates t on t.pack_id = p.id and t.status='active'
-- where p.status='active' group by p.slug order by p.slug;
