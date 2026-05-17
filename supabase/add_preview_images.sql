-- TMKE — add a per-pack preview gallery.
-- On the storefront the cover image cycles through preview_images on hover so
-- buyers get a feel for what's inside before clicking through. Safe to re-run.

alter table public.packs
  add column if not exists preview_images jsonb not null default '[]'::jsonb;

-- Hydrate the 10 launch packs with 3 themed previews each.
-- Image URLs are stock Unsplash photos that match the pack's aesthetic.
update public.packs set preview_images = '[
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1505842465776-3d90f616310d?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1400&q=80"
]'::jsonb where slug = 'heritage-townhouse';

update public.packs set preview_images = '[
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=80"
]'::jsonb where slug = 'modern-mews';

update public.packs set preview_images = '[
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=80"
]'::jsonb where slug = 'coastal-retreat';

update public.packs set preview_images = '[
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1400&q=80"
]'::jsonb where slug = 'estate-classic';

update public.packs set preview_images = '[
  "https://images.unsplash.com/photo-1430285561322-7808604715df?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=1400&q=80"
]'::jsonb where slug = 'city-penthouse';

update public.packs set preview_images = '[
  "https://images.unsplash.com/photo-1518733057094-95b53143d2a7?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1600121848594-d8644e57abab?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1400&q=80"
]'::jsonb where slug = 'garden-sanctuary';

update public.packs set preview_images = '[
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1400&q=80"
]'::jsonb where slug = 'countryside-cottage';

update public.packs set preview_images = '[
  "https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1430285561322-7808604715df?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1400&q=80"
]'::jsonb where slug = 'loft-living';

update public.packs set preview_images = '[
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80"
]'::jsonb where slug = 'family-forever';

update public.packs set preview_images = '[
  "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=1400&q=80"
]'::jsonb where slug = 'winter-editorial';
