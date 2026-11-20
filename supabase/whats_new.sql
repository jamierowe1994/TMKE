-- ============================================================================
-- What's new in your Member Hub (Danielle, 20 Nov 2026).
--
-- One row per update. Edited under Admin › Member hub › What's new; the site
-- reads the published rows when it builds (src/data/whats-new.js) and the
-- editor rebuilds the site on Publish. Each member sees the latest five meant
-- for them: audience empty is everyone, otherwise any of the brands named.
--
-- Seeded with the seven updates that lived in src/data/whats-new.js until now.
-- Run in the Supabase SQL editor. Safe to re-run: the seed only goes in while
-- the table is empty.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.whats_new (
  id          uuid primary key default gen_random_uuid(),
  status      text not null default 'draft' check (status in ('draft', 'published')),
  live_on     date not null default current_date,   -- "Added" on the card
  title       text not null default '',             -- what you can now do
  area        text,                                 -- the part of the hub it's in
  find_it     text,                                 -- the clicks to reach it
  what        text,                                 -- what it is, two sentences at most
  why         text,                                 -- what it saves or makes possible
  tip         text,                                 -- the wine TMKE tip box
  link_href   text,
  link_label  text,
  media_url   text,                                 -- 1080 x 1350 (4:5)
  audience    text[] not null default '{}',         -- empty = every member; else brand names, 'none' = members with no brand
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Who sees it (Dani, 20 Nov), for a table made before the column was.
alter table public.whats_new add column if not exists audience text[] not null default '{}';

create index if not exists whats_new_live_idx on public.whats_new (status, live_on desc, created_at desc);

alter table public.whats_new enable row level security;

-- The site build reads with the public key, so published rows are readable by
-- anyone (they are shown to every member anyway). Drafts only to admins.
drop policy if exists "whats_new read published" on public.whats_new;
create policy "whats_new read published"
  on public.whats_new for select
  to anon, authenticated
  using (status = 'published' or public.is_admin());

drop policy if exists "whats_new admin" on public.whats_new;
create policy "whats_new admin"
  on public.whats_new for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.whats_new_touch()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists whats_new_touch on public.whats_new;
create trigger whats_new_touch
  before update on public.whats_new
  for each row execute function public.whats_new_touch();

-- The seven updates already live, so nothing changes for members on day one.
insert into public.whats_new (status, live_on, title, area, find_it, what, why, tip, link_href, link_label, media_url, created_at)
select 'published', v.*
from (values
  ($wn$2026-10-18$wn$::date, $wn$Meet Your Marketing Planner$wn$, $wn$Marketing Planner$wn$, $wn$Marketing Planner → Marketing Planner | Content Calendar$wn$, $wn$The Planner is now your Marketing Planner, with two views at the top. Marketing Planner shows everything you’ve planned: posts, print, events, shoots, campaigns and follow-ups. Content Calendar shows just what you’re posting, with your post ideas and key dates.$wn$, $wn$Your marketing is more than your social media, but some days you only want to see what’s going out. One view for all of it, one for your content, and nothing you’ve planned is ever lost between them.$wn$, $wn$Plan your month in the Marketing Planner, then switch to the Content Calendar when you sit down to create your posts.$wn$, $wn$/account/schedule$wn$, $wn$Open your Marketing Planner$wn$, $wn$/images/learn/hub/areas/planner-v5.jpg$wn$, now() - interval '0 seconds'),
  ($wn$2026-10-01$wn$::date, $wn$October’s See What’s Working Is Here$wn$, $wn$Studio$wn$, $wn$Studio → See what’s working$wn$, $wn$October’s edition of See What’s Working is here, featuring five social media trends worth exploring this month. Discover what each trend involves, why it’s gaining attention and how you can adapt it to create relevant content for your estate agency.$wn$, $wn$You don’t need to spend hours researching trends or figuring out how they fit into property. We’ve done the research and broken down the ideas, so you can focus on creating content that works for your business.$wn$, $wn$You don’t need to try every trend. Choose the ones that suit your personality, audience and brand, then make them your own. A trend should complement your content, not dictate it.$wn$, $wn$/account/studio$wn$, $wn$Open the Studio$wn$, $wn$/images/learn/hub/areas/whats-new-trending-oct26.jpg$wn$, now() - interval '1 seconds'),
  ($wn$2026-09-21$wn$::date, $wn$Preview Before You Post$wn$, $wn$Studio$wn$, $wn$Studio → Guides → Safe zones$wn$, $wn$New preview guides in the Studio show you which parts of your design will be visible across Instagram. Check how a post or Reel cover will crop on your profile grid, or switch to Story and Reel views to see where Instagram’s interface could cover your content.$wn$, $wn$You can check your layout before you download, keeping important text, logos and faces where people will actually see them.$wn$, $wn$Check every format you plan to use. A design that works perfectly on your grid might need adjusting before you share it to Stories.$wn$, $wn$/account/editor$wn$, $wn$Open the Studio$wn$, $wn$/images/learn/hub/areas/studio-v2.jpg$wn$, now() - interval '2 seconds'),
  ($wn$2026-09-21$wn$::date, $wn$Add Your Contact Details in One Click$wn$, $wn$Brand Kit & Studio$wn$, $wn$Brand Kit → About you, then Studio → Elements$wn$, $wn$Your Brand Kit now stores your name, job title, telephone number, email and headshot. In the Studio, you can use these details to add ready-made contact footers to your designs, already formatted and filled in with your information.$wn$, $wn$Add a professional call to action to carousel end slides and other content without rebuilding your contact details every time.$wn$, $wn$Complete all of your contact fields and add a headshot first. Your contact footers will then be ready whenever you need them.$wn$, $wn$/account/profile$wn$, $wn$Update your Brand Kit$wn$, $wn$/images/learn/hub/areas/brand-kit-v4.jpg$wn$, now() - interval '3 seconds'),
  ($wn$2026-09-21$wn$::date, $wn$Reset Any Template in One Click$wn$, $wn$Studio$wn$, $wn$Studio → Start → Reset to the original template$wn$, $wn$Taken an edit too far? Designs created from one of our templates can now be reset to the original from the Start menu. Your Brand Kit will still be applied, giving you a clean version of the template without having to find it and start again.$wn$, $wn$Experiment as much as you like. If it doesn't work, you can get back to your original starting point without abandoning the design.$wn$, $wn$Changed your mind after resetting? Use Undo straight afterwards and your previous changes will come back.$wn$, $wn$/account/editor$wn$, $wn$Open the Studio$wn$, $wn$/images/learn/hub/areas/studio-v4.jpg$wn$, now() - interval '4 seconds'),
  ($wn$2026-09-16$wn$::date, $wn$Getting Started Just Got Easier$wn$, $wn$Learn$wn$, $wn$Learn → Getting Started$wn$, $wn$There's a new four-part Getting Started series in Learn, covering the essentials of using your Member Hub. Get familiar with the Hub, build your Brand Kit, edit your first template and learn how to start planning your content.$wn$, $wn$Follow a clear route through the basics, with practical guidance and interactive walkthroughs that let you learn while using the Hub itself.$wn$, $wn$Start with Getting Around Your Hub and work through the four courses in order. Each one builds on what you've already set up.$wn$, $wn$/account/guides$wn$, $wn$Go to Learn$wn$, $wn$/images/learn/hub/areas/learn-v4.jpg$wn$, now() - interval '5 seconds'),
  ($wn$2026-09-10$wn$::date, $wn$Your First Three Templates Are Free$wn$, $wn$Studio$wn$, $wn$Studio → Demo Pack$wn$, $wn$Every Member now has three free templates inside their Studio, whether you've purchased a content pack or not. Find them in your Demo Pack, customise them with your own branding and content, then download and use them like any other template.$wn$, $wn$Try the Studio properly on finished designs, learn how template editing works and create content you can actually use when you're done.$wn$, $wn$New to the Studio? Edit one of your Demo Pack templates before starting from scratch. It's the quickest way to learn how everything works.$wn$, $wn$/account/studio$wn$, $wn$Go to the Studio$wn$, $wn$/images/learn/hub/areas/start-design-v4.jpg$wn$, now() - interval '6 seconds')
) as v(live_on, title, area, find_it, what, why, tip, link_href, link_label, media_url, created_at)
where not exists (select 1 from public.whats_new);

select count(*) as updates, count(*) filter (where status = 'published') as published from public.whats_new;
