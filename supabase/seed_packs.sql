-- TMKE — seed The Edit with 10 launch packs.
-- Idempotent: ON CONFLICT (slug) keeps existing rows untouched.
-- Run once in the Supabase SQL editor.

insert into public.packs
  (slug, title, description, price_pence, cover_image_url, contents, category, sort_order, status)
values
  (
    'heritage-townhouse',
    'Heritage Townhouse',
    'Refined editorial templates for period homes — Georgian, Victorian, Edwardian. Confident typography and warm, textural layouts that let the architecture speak.',
    29900,
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80',
    '["20 Instagram post templates", "8 reel cover designs", "12 story templates", "Stamp duty + viewing-day add-ons", "Editable in Canva (free + Pro)"]'::jsonb,
    'classic', 10, 'active'
  ),
  (
    'modern-mews',
    'Modern Mews',
    'Quiet, contemporary layouts built for new-builds and renovated mews. Plenty of negative space, soft sans-serifs, designed to flatter clean lines.',
    29900,
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1400&q=80',
    '["20 Instagram post templates", "8 reel cover designs", "12 story templates", "Carousel + just-listed sets", "Editable in Canva (free + Pro)"]'::jsonb,
    'contemporary', 20, 'active'
  ),
  (
    'coastal-retreat',
    'Coastal Retreat',
    'Sea-light palette and airy serifs for coastal properties, holiday lets and second homes. Made to feel like a long breath.',
    29900,
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1400&q=80',
    '["20 Instagram post templates", "8 reel cover designs", "12 story templates", "Holiday-let booking covers", "Editable in Canva (free + Pro)"]'::jsonb,
    'lifestyle', 30, 'active'
  ),
  (
    'estate-classic',
    'The Estate Classic',
    'Country-house cataloguing at its most poised. Built for manors, estates and prime market listings where understatement is the brief.',
    29900,
    'https://images.unsplash.com/photo-1613553474179-e1eda3ea5734?auto=format&fit=crop&w=1400&q=80',
    '["24 Instagram post templates", "10 reel cover designs", "12 story templates", "Brochure-style carousels", "Editable in Canva (free + Pro)"]'::jsonb,
    'classic', 40, 'active'
  ),
  (
    'city-penthouse',
    'City Penthouse',
    'High-contrast, late-evening palette for prime urban listings — penthouses, apartments and city pied-à-terres. Designed to glow on a phone at 9pm.',
    29900,
    'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?auto=format&fit=crop&w=1400&q=80',
    '["20 Instagram post templates", "8 reel cover designs", "12 story templates", "Skyline-friendly layouts", "Editable in Canva (free + Pro)"]'::jsonb,
    'contemporary', 50, 'active'
  ),
  (
    'garden-sanctuary',
    'Garden Sanctuary',
    'Botanical and exterior-led templates — for gardens, grounds, and properties where the outside sells the inside.',
    29900,
    'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=1400&q=80',
    '["20 Instagram post templates", "8 reel cover designs", "12 story templates", "Garden day + open-house sets", "Editable in Canva (free + Pro)"]'::jsonb,
    'lifestyle', 60, 'active'
  ),
  (
    'countryside-cottage',
    'Countryside Cottage',
    'Soft, hand-drawn flourishes and warm neutrals for rural cottages, barn conversions and quiet villages. Editorial, not twee.',
    29900,
    'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1400&q=80',
    '["20 Instagram post templates", "8 reel cover designs", "12 story templates", "Village + lifestyle add-ons", "Editable in Canva (free + Pro)"]'::jsonb,
    'classic', 70, 'active'
  ),
  (
    'loft-living',
    'Loft Living',
    'Type-led, concrete-and-glass templates for warehouse conversions and design-forward listings. Strong grids, no fluff.',
    29900,
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=80',
    '["20 Instagram post templates", "8 reel cover designs", "12 story templates", "Architectural carousel set", "Editable in Canva (free + Pro)"]'::jsonb,
    'contemporary', 80, 'active'
  ),
  (
    'family-forever',
    'Family Forever',
    'Warm, kitchen-table imagery for family homes — the kind of properties buyers fall for at the front gate. Comforting and confident.',
    29900,
    'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=1400&q=80',
    '["20 Instagram post templates", "8 reel cover designs", "12 story templates", "Open-house + viewing sets", "Editable in Canva (free + Pro)"]'::jsonb,
    'lifestyle', 90, 'active'
  ),
  (
    'winter-editorial',
    'Winter Editorial',
    'A seasonal capsule — winter palettes, gift-guide energy, Christmas-week listings. Refresh the grid without rebuilding the brand.',
    29900,
    'https://images.unsplash.com/photo-1551525212-a1dc18871d4a?auto=format&fit=crop&w=1400&q=80',
    '["16 Instagram post templates", "6 reel cover designs", "10 story templates", "Year-end review carousel", "Editable in Canva (free + Pro)"]'::jsonb,
    'seasonal', 100, 'active'
  )
on conflict (slug) do nothing;
