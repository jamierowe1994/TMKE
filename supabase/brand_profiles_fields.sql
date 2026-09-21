-- Two more fields on a brand's kit
--
-- company: what the brand is CALLED on a design, which isn't always the key we
--          match agents on. Defaults to the key itself.
-- slogan:  every brand has one, and a template asks for it as {slogan}.
--
-- Safe to re-run.

alter table public.brand_profiles
  add column if not exists company text,
  add column if not exists slogan  text;

update public.brand_profiles set company = brand where company is null and brand <> '__studio__';
