-- One-off (Dani, 9 Nov 2026): her December plan into The Property Experts' December.
--
-- Fills in each post's title, type, pillar, tied day and team note, matched by date.
-- Designs, captions, guidance and platforms aren't touched.
-- Keeps a copy of December as it was in content_month_posts_backup_dec_plan first.
-- If the 23 dates don't all match, it stops and nothing changes. Sends nothing.

create table if not exists public.content_month_posts_backup_dec_plan as
  select p.* from public.content_month_posts p
  join public.content_months m on m.id = p.month_id
  where m.month = '2026-12-01' and m.edition = 'property';

alter table public.content_month_posts_backup_dec_plan enable row level security;

do $plan$
declare
  v_month uuid;
  v_n int;
begin
  select id into v_month from public.content_months where month = '2026-12-01' and edition = 'property';
  if v_month is null then raise exception 'December for The Property Experts was not found. Nothing has changed.'; end if;

  update public.content_month_posts p
     set title = v.title, post_type = v.post_type, pillar = v.pillar,
         date_tied = v.date_tied, occasion = v.occasion, note = v.note
    from (values
    ('2026-12-01'::date, 'Hello December', 'single', 'Lifestyle', true, 'Start of December', 'A simple, warm opening to the month. Copy: “Hello, December. A new month, a fresh start and plenty to look forward to.”'),
    ('2026-12-02'::date, 'It''s the Little Things', 'single', 'Property', false, null, 'Feature one distinctive detail from a listing: a window seat, fireplace, original flooring or garden corner. Copy: “Sometimes it''s the smallest details that make a house feel like home.”'),
    ('2026-12-03'::date, 'Leasehold vs Freehold: What''s the Difference?', 'carousel', 'Educational', false, null, 'Explain ownership, lease lengths, ground rent, service charges and questions to ask before buying. Plain English, particularly useful for first-time buyers. Cover: “Leasehold or freehold? Here''s what you need to know.”'),
    ('2026-12-04'::date, 'A Local''s Guide to Prepping for Christmas', 'carousel', 'Community', false, 'Christmas preparations', 'Christmas preparations: A practical local guide to ordering food, booking Christmas meals, shopping independently and preparing for guests. Cover: “Your local Christmas checklist.”'),
    ('2026-12-07'::date, 'How I Sold This [Location] Home', 'carousel', 'Service', false, null, 'Real case study: the property, seller''s circumstances, marketing decisions, challenges and result. Cover: “How I sold this [Location] home.” Supporting line: “A look at what went into getting this property sold.”'),
    ('2026-12-08'::date, 'My Favourite Way to Spend a Morning / Evening in [Location]', 'reel', 'Personal', false, null, 'Agent films their genuine local routine: coffee, a favourite walk, a market or somewhere they regularly visit. Cover: “My favourite way to spend a morning in [Location].”'),
    ('2026-12-09'::date, 'Could You See Yourself Living Here?', 'carousel', 'Property', false, null, 'Showcase one listing through everyday lifestyle moments rather than room specifications. Cover: “Could you see yourself living here?” Slides could focus on Sunday mornings, family dinners, relaxing evenings and outdoor space.'),
    ('2026-12-10'::date, 'To be confirmed', 'single', 'Personal / Lifestyle', false, null, 'A lighter, relatable concept to balance the educational and property content. Potential direction: “Things estate agents hear all the time.”'),
    ('2026-12-11'::date, 'My Monthly Favourites in [Location]', 'carousel', 'Community', false, 'Monthly series', 'Monthly series: Three personal recommendations: a café, independent shop, activity or local discovery. Cover: “A few of my favourite things in [Location] this month.”'),
    ('2026-12-14'::date, 'Questions You''re Too Embarrassed to Ask Your Estate Agent', 'carousel', 'Service', false, null, 'Answer genuine questions people may hesitate to ask, such as whether they can offer below asking price, view twice or change their mind. Cover: “Questions you''re too embarrassed to ask your estate agent.”'),
    ('2026-12-15'::date, 'Expert Insight: What Does Sold STC Mean?', 'single', 'Educational', false, 'Expert Insight series', 'Expert Insight series: Explain that Sold Subject to Contract means an offer has been accepted but contracts have not yet been exchanged. Copy: “Sold STC doesn''t mean the sale is legally complete. Here''s what happens next.”'),
    ('2026-12-16'::date, 'Come On, I''ll Show You Around', 'reel', 'Property', false, null, 'Relaxed agent-led property tour highlighting two or three interesting features rather than listing specifications. Cover: “Come on, I''ll show you around.”'),
    ('2026-12-17'::date, 'What Happens During a Property Survey?', 'carousel', 'Educational', false, null, 'Explain the purpose of a survey, common survey levels, what surveyors look for and what buyers can do with the findings. Cover: “Buying a home? Here''s what a property survey can tell you.”'),
    ('2026-12-18'::date, 'Somewhere Worth Visiting', 'single', 'Community', false, 'Recurring series', 'Recurring series: Feature one local destination, business or attraction. Explain what makes it worth visiting, using genuine local knowledge. Copy: “Somewhere worth visiting in [Location].”'),
    ('2026-12-21'::date, 'Unpopular Estate Agent Opinion', 'single', 'Personal', false, 'Recurring series', 'Recurring series: A conversation starter that reflects the agent''s perspective. Potential copy: “You don''t have to love every room to love a home.” Caption explores seeing past décor and recognising potential.'),
    ('2026-12-22'::date, 'Local Businesses, Local People', 'single', 'Community', false, 'Recurring series', 'Recurring series: Introduce an independent local business and the person or people behind it. Copy: “Local businesses. Local people. Meet [Business Name].”'),
    ('2026-12-23'::date, 'A Little Imagination Goes a Long Way', 'single', 'Property', false, null, 'Showcase a listing with potential. Encourage buyers to consider the layout, location, light or opportunities to personalise. Copy: “A little imagination goes a long way. Sometimes the right home is the one you can make your own.”'),
    ('2026-12-24'::date, 'Christmas Eve', 'single', 'Lifestyle', true, 'Christmas Eve', 'A simple festive message without making it another property promotion. Copy: “Christmas Eve. Wherever you''re spending it, I hope it''s a lovely one.”'),
    ('2026-12-25'::date, 'Merry Christmas', 'single', 'Seasonal', true, 'Christmas Day', 'The main Christmas greeting. Copy: “Merry Christmas. Wishing you and your loved ones a wonderful day.”'),
    ('2026-12-28'::date, 'Expert Insight: Looking Ahead to the New Year', 'single', 'Educational', false, 'Between Christmas and New Year', 'Between Christmas and New Year: A practical reflection on preparing to buy or sell in the coming year. Copy: “Thinking about moving next year? A little preparation now can make the process easier when you''re ready.”'),
    ('2026-12-29'::date, 'My Month in Photos', 'carousel', 'Personal', false, 'Monthly series', 'Monthly series: A genuine selection of photos from the agent''s month, mixing work and life. Cover: “My December in photos.”'),
    ('2026-12-30'::date, 'December in Numbers', 'single', 'Educational', false, 'Monthly market update', 'Monthly market update: Editable local property market figures: new listings, sales agreed, average asking prices or other verified data. Copy: “December''s property market in numbers. Here''s what happened in [Location].”'),
    ('2026-12-31'::date, 'New Year''s Eve', 'single', 'Lifestyle', true, 'New Year''s Eve', 'A short, personal year-end message, distinct from the monthly photo roundup. Copy: “Here''s to the year ahead. Happy New Year!”')
    ) as v(post_date, title, post_type, pillar, date_tied, occasion, note)
   where p.month_id = v_month and p.post_date = v.post_date;

  get diagnostics v_n = row_count;
  if v_n <> 23 then raise exception 'Expected to fill 23 posts but matched %. Nothing has changed.', v_n; end if;
end $plan$;

select
  'Done' as result,
  (select count(*) from public.content_month_posts p join public.content_months m on m.id = p.month_id
    where m.month = '2026-12-01' and m.edition = 'property' and p.note is not null) as posts_with_a_plan,
  (select count(*) from public.content_month_posts_backup_dec_plan) as posts_backed_up;
