-- Keeping a member's kit in step with their brand
--
-- When a brand changes — a new logo, a tweaked palette, a rewritten tone —
-- every agent in it should get the change. But an agent who has made their kit
-- their own must not have their work trampled.
--
-- So we remember WHAT WE GAVE THEM. Three values per field: what the brand
-- says now, what we handed over (the base), and what they actually have. If
-- theirs still matches the base, they never touched it and it updates. If it
-- differs, it is theirs and we leave it alone. Field by field, so somebody who
-- rewrote their slogan still gets the new colours.
--
-- Safe to re-run.

alter table public.member_brand_kits
  -- The brand's values at the moment we last handed them over.
  add column if not exists base        jsonb,
  add column if not exists base_brand  text,
  add column if not exists synced_at   timestamptz;

comment on column public.member_brand_kits.base is
  'What the brand said when we last gave it to them. A field they have not changed still matches this, and may be updated; one that differs is theirs.';

-- A kit with no base predates this and belongs to somebody who built their own.
-- Those people are OFFERED their brand's kit rather than given it.
