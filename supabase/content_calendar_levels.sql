-- ============================================================================
-- Content Calendar subscription: the levels (Danielle, 29 Oct 2026).
--
-- The four levels, what each costs and what each opens. Set in Admin >
-- Content calendar > Overview. The Worker's access check (/access/me) reads
-- the access columns, so a change here changes what members on that level
-- get. Nobody is on a paid level yet: everyone is Free until card
-- subscriptions and TEG billing are built.
--
-- Prices are a month, ex VAT. Seeded from the plan
-- (docs/content-calendar-plan, Chapter 02). Admins only for now; the account
-- page will read the names, prices and wording once the subscription launches.
--
-- Run in the Supabase SQL editor. Safe to re-run: it never overwrites a level
-- that's already been set.
-- ============================================================================

create table if not exists public.content_levels (
  key             text primary key
                  check (key in ('free', 'calendar', 'scheduling', 'done_for_you')),
  name            text not null,
  summary         text,                                -- the line under the name
  includes        text[] not null default '{}',        -- what members are told it includes
  price_card      numeric(8,2),                        -- independent agents, by card
  price_teg       numeric(8,2),                        -- TEG agents (the brand pays for the calendar)
  price_note      text,                                -- e.g. "To be confirmed"
  calendar        boolean not null default false,      -- this month's posts and the Studio pack
  next_month      boolean not null default false,      -- a preview of next month
  library_months  int,                                 -- past months: null none, n back, -1 all
  scheduling      boolean not null default false,
  done_for_you    boolean not null default false,
  sort_order      int not null default 0,
  updated_at      timestamptz not null default now(),
  updated_by      text
);

alter table public.content_levels enable row level security;

drop policy if exists "content_levels admin" on public.content_levels;
create policy "content_levels admin"
  on public.content_levels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop trigger if exists content_levels_touch on public.content_levels;
create trigger content_levels_touch before update on public.content_levels
  for each row execute function public.content_months_touch();

insert into public.content_levels
  (key, sort_order, name, summary, includes, price_card, price_teg, price_note,
   calendar, next_month, library_months, scheduling, done_for_you)
values
  ('free', 0, 'Free Member',
   'Everything agents need to get started with the Member Hub, create their own content and plan their marketing.',
   array['Design Studio, demo pack and any purchased packs',
         'Marketing Planner and Content Calendar for their own posts',
         'Free member blogs, beginner guides, monthly content trends and marketing tips',
         'Hub how-to guides and introductory training',
         'A blurred preview of the current subscription calendar, overlaid on their own Content Calendar'],
   0, 0, null, false, false, null, false, false),
  ('calendar', 1, 'Content Calendar',
   'Five ready-made posts every week, designed for estate agents to make their own, with captions and editing guidance for each one.',
   array['Everything included with free membership',
         'Five posts a week, ready to brand, edit and publish',
         'All posts available as a monthly pack in the Design Studio',
         'Ready-written captions, pre-filled with agency details',
         'How-to-edit instructions and guidance for every template',
         'The current month''s calendar and a preview of the next',
         'Additional platform training courses and marketing strategy sessions'],
   30, 25, 'TEG agents'' £25 is paid by their brand.', true, true, 0, false, false),
  ('scheduling', 2, 'Content Calendar + Scheduling',
   'All the content, without the extra steps. Agents can create, edit and schedule their posts directly from the Hub.',
   array['Everything included with Content Calendar',
         'Schedule and publish directly to Instagram and Facebook from the Hub',
         'Manage planned and scheduled posts in their own Content Calendar',
         'A rolling three-month library of previous content',
         'Additional platform training and strategy courses'],
   45, 15, 'TEG agents pay £15 on top of their brand''s calendar; £12 as a launch offer.', true, true, 3, true, false),
  ('done_for_you', 3, 'Done For You',
   'Our team takes care of branding and personalising ten posts every month, ready for the agent to review.',
   array['Everything included with Content Calendar + Scheduling',
         'Ten posts professionally branded and personalised each month',
         'Posts returned to the agent''s calendar for review and approval',
         'The full library of previously published content',
         'Advanced training courses and masterclasses',
         'Free seasonal Edit packs',
         'Discounted tickets to affiliated estate agency events'],
   null, null, 'To be confirmed: £79–99 to create, £99–129 to create and schedule.', true, true, -1, true, true)
on conflict (key) do nothing;
