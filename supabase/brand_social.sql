-- ============================================================================
-- Brand kit — social links (master). Adds the shared TMKE social URLs to the
-- singleton brand_settings row so they're set once (Settings → Brand kit) and
-- flow into every email (the social + footer blocks pull them). Run AFTER
-- supabase/brand_settings.sql. Safe to re-run.
-- ============================================================================
alter table public.brand_settings add column if not exists website   text;
alter table public.brand_settings add column if not exists linkedin  text;
alter table public.brand_settings add column if not exists instagram text;
alter table public.brand_settings add column if not exists facebook  text;
alter table public.brand_settings add column if not exists twitter   text;
alter table public.brand_settings add column if not exists youtube   text;

-- Pre-fill the website from the house domain if it's not set yet.
update public.brand_settings set website = 'https://tmke.co.uk' where id = 1 and (website is null or website = '');
