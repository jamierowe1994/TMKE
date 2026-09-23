-- The brand-approved photo
--
-- An agent's kit holds two pictures of them, and they are not interchangeable.
--
--   headshot     theirs. They upload it, they can change it, and it is the
--                one that appears on their social posts if they want it to.
--   brand photo  ours. A full-length cut-out on no background, supplied by
--                The Experts Group, and the ONLY one that may go on print.
--
-- Print is the reason for the distinction: a selfie cropped square looks fine
-- at 1080px on Instagram and falls apart on a 6-sheet. Print takes one photo,
-- the approved one, or it takes none.
--
-- Per person PER BRAND, like everything else on this table: an agent who is a
-- Property Expert and a Letting Expert is photographed in both liveries, and
-- a Letting board must not carry the Property picture.
--
-- `source` records who put it there, because the TEG feed must never overwrite
-- one a person at TMKE set by hand while the feed was down.
--
-- Run in the Supabase SQL editor. Safe to re-run.

alter table public.agent_profiles
  add column if not exists brand_photo_url        text,
  add column if not exists brand_photo_source     text,   -- 'teg' | 'admin'
  add column if not exists brand_photo_updated_at timestamptz;

-- ---------------------------------------------------------- the stand-ins --
-- Two invented people, a man and a woman, for designing against. A template
-- with nobody in it cannot be judged: the designer needs to see how the copy
-- sits beside a person, at the size a person actually is. They are never
-- served to a member — the moment a real agent opens a design they get their
-- own photo, or the ghost if we do not hold one.
--
-- Kept on the reserved __studio__ row in brand_profiles, beside the rest of
-- the studio's own furniture, so the design studio reads it where it already
-- reads everything else.
alter table public.brand_profiles
  add column if not exists stand_ins jsonb;

-- ------------------------------------------------------------- where now --
select c.first_name, c.last_name, btrim(ap.brand) as brand,
       ap.brand_photo_url is not null as has_photo, ap.brand_photo_source
  from public.agent_profiles ap
  join public.contacts c on c.id = ap.contact_id
 where ap.brand is not null and ap.left_at is null
 order by has_photo, c.last_name;
