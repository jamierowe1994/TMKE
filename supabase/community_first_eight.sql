-- The Community's first eight discussions (Dani, 17 Oct 2026), as written in
-- "TMKE Community | First 8 Discussions".
--
--   title      the question
--   category   the topic, shown above it
--   body       the introduction
--   viewpoint  TMKE's first comment
--
-- Week 01 is the pinned intro: always first, live at 8am on Monday 19 October.
-- Weeks 02-08 each go live at 8am UK time on their date and run until the
-- next one starts. Until then only staff and the previewers (Danielle) see
-- them; each one sends the "Spill the tea" notice to every member's bell as
-- it goes live.
--
-- Run after supabase/community_forum.sql. Safe to re-run: a discussion
-- already there (same question) is left alone.

with author as (
  select coalesce(
    (select id from auth.users where lower(email) = 'danielle@tmke.co.uk'),
    (select user_id from public.admins limit 1)
  ) as id
),
rows (sort, category, title, body, viewpoint, pinned, starts_on, ends_on, publish_at) as (values
  (1, 'Getting to know our community',
   $q$What's your biggest marketing headache right now?$q$,
   $b$We're kicking things off by getting to know you, the people behind the businesses.

Whether you're struggling to find time to post, running out of ideas or just wondering if any of it is actually working, we want to hear what's going on in your world.

So, introduce yourself, tell us a little about your business and share the one marketing challenge you'd happily never deal with again.$b$,
   $v$We'll go first!

One of the biggest challenges we see is agents feeling like they need to do everything. Post daily, film reels, follow trends, write blogs, send emails. It's exhausting, demoralising and, most of the time, completely unnecessary.

We're big believers in doing fewer things, but doing them properly. The first step to a successful marketing strategy is figuring out what matters to your goals, rather than what everyone else tells you, you should be doing.

We're looking forward to hearing what everyone's working on and hopefully helping each other out along the way.$v$,
   true, null::date, null::date, timestamptz '2026-10-19 08:00 Europe/London'),

  (2, 'Halloween special',
   $q$What's the biggest marketing horror you've witnessed?$q$,
   $b$It's spooky season, so we're sharing the marketing decisions that still haunt us.

Terrible graphics, questionable captions, painfully awkward videos or campaigns that should never have made it past the drawing board.

What's the worst bit of marketing you've seen, created or accidentally approved?$b$,
   $v$We've seen some absolute horrors over the years.

However, one recent trend giving us nightmares is AI-generated social media posts with so much information crammed onto them that you need a magnifying glass to work out what they're advertising.

You know the ones. Five different calls to action, ten competing headlines and a handful of AI-generated images featuring someone who looks absolutely nothing like you because you uploaded one photo of yourself from 2010 with bear ears or cat whiskers.

No naming and shaming, though. Unless it's your own work!$v$,
   false, date '2026-10-27', date '2026-11-10', null::timestamptz),

  (3, 'Artificial intelligence',
   $q$Is AI making estate agency marketing worse?$q$,
   $b$AI has made creating content quicker and easier than ever.

But when everyone's using the same tools, making similar requests and generating generic content, are we losing the personality that makes businesses different?

Is AI genuinely improving estate agency marketing, or just helping us produce more of the same?$b$,
   $v$First things first, we're not anti-AI. We use it ourselves. A lot!

For planning, strategy, content ideas and reviewing what's working, we think it's brilliant. But there's a big difference between using AI to support your marketing and expecting it to become your entire marketing department.

Our biggest issue is AI-generated graphics. Just because you've given ChatGPT ten pieces of information doesn't mean all ten need to appear on one canvas. Good design is as much about knowing what to leave out as what to include.

And, let's not forget AI is only as good as the information you give it. If it doesn't understand your business, audience or goals, why would it create anything different from what it produces for everyone else?

Our view? AI is a brilliant assistant, but not always a great designer.

Are we being too harsh?$v$,
   false, date '2026-11-10', date '2026-11-24', null::timestamptz),

  (4, 'Getting comfortable on camera',
   $q$Do you show your face on your agency's socials?$q$,
   $b$Everyone seems to be telling estate agents to get in front of the camera.

But for some, that's easier said than done.

Whether you love filming yourself, avoid it at all costs or have been promising to start for the last six months, we'd love to know where you stand.

What's stopping you, or what changed when you finally gave it a go?$b$,
   $v$Hands up, we'll be the first to admit that getting in front of the camera is one of our biggest marketing struggles. Which is slightly embarrassing considering we're a social media marketing agency with our own videographer.

On paper, we have absolutely no excuse. In reality, none of us particularly enjoy being on camera, and it's probably the one thing we put off more than anything else. The irony? We'll spend five hours creating an AI-generated image of ourselves walking down the street when we could've just taken a photo in 30 seconds – make it make sense!

We know that showing the real people behind a business is one of the best ways to build connections, not to mention that it's some of the best-performing content on social media. But knowing that and actually doing it are two very different things.

Our goal is to stop overthinking it and just take the bloody photo.

If anyone's got any tips for getting comfortable on camera, please share them. We genuinely need them!$v$,
   false, date '2026-11-24', date '2026-12-08', null::timestamptz),

  (5, 'Christmas marketing',
   $q$How do you make Christmas content relevant without being cheesy?$q$,
   $b$It's that time of year when every business suddenly discovers Christmas graphics, festive puns and the same five seasonal captions.

But how much of it means anything to your audience?

Are you embracing the Christmas content, keeping things business as usual or avoiding festive marketing altogether?$b$,
   $v$We love a bit of seasonal content, but not everything needs a Christmas hat stuck on it.

No, seriously. Last year we witnessed far too many Santa hats digitally added to professional headshots for our liking. Enough is enough.

For estate agents, December is a great opportunity to showcase your local community, celebrate the year and remind people there's a real person behind the business.

Local Christmas events, favourite independent shops, community initiatives or even a look back at the year's highlights. There's plenty to talk about without turning every post into a Christmas card.

So, what's your approach to Christmas content? Are you going all out, keeping it subtle or avoiding it altogether?$v$,
   false, date '2026-12-08', date '2026-12-22', null::timestamptz),

  (6, 'Personal branding',
   $q$Do people care about your personal brand?$q$,
   $b$If you're an estate agent, you've probably heard the phrase "people buy from people" more times than you can count.

But does building a personal brand really mean your audience needs to know what you had for breakfast, where you're spending Christmas or what you're currently watching on Netflix?

Where do you draw the line between showing your personality and simply oversharing?$b$,
   $v$Personal branding is often misunderstood.

It's not about documenting every part of your life. It's about giving people a reason to recognise, remember and trust you.

Your opinions, local knowledge, personality and how you approach your work all contribute to that.

And sometimes, sharing something completely unrelated to property can help people connect with you. But there's a difference between being personable and feeling obligated to share everything.

We're curious where everyone draws that line.$v$,
   false, date '2026-12-22', date '2027-01-05', null::timestamptz),

  (7, 'New year, new marketing habits',
   $q$What's one marketing habit you're leaving behind this year?$q$,
   $b$New year, fresh start and approximately 400 posts telling you to set bigger goals.

We're taking a slightly different approach, because bigger goals don't automatically mean better results.

Rather than asking what you're going to start doing, we want to know what you're going to stop.

What's one marketing habit, task or approach you're determined to leave behind in 2026?$b$,
   $v$Our New Year's resolution? If we believed in setting New Year's resolutions, is to get our shit together. 😂

We have two problems over here at TMKE. We're perfectionists, and we're chronic overthinkers. Everything takes seven times longer than it should because nothing ever feels quite finished.

And then there's the planning. Oh, we LOVE a plan. Give us a spreadsheet, a strategy document or an excuse to build an entirely new app to organise our lives, and we're in our element.

Actually sticking to said plan? Different story.

We've got approximately 400 ideas on the go, another 200 in the pipeline and a habit of starting something new before we've finished the last thing, then wondering why work-life balance hasn't been a thing since 2020.

So, this year, we're keeping it simple. Stop overthinking, stop procrastinating, accept that not everything needs to be perfect and, for the love of God, stop building apps to help us follow plans we already have.

We'll let you know how it goes...$v$,
   false, date '2027-01-05', date '2027-01-19', null::timestamptz),

  (8, 'Looking at your own marketing',
   $q$Would you follow your own estate agency on social media?$q$,
   $b$Here's a slightly uncomfortable question.

If you weren't an estate agent and had absolutely no plans to move house, would you genuinely want to follow your own business on social media?

Would you find the content interesting, entertaining or useful enough to stick around?

Or would you scroll straight past?$b$,
   $v$We think this is one of the most useful questions a business can ask itself, because it's easy to get caught up in what we think we should be posting and forget about what people actually want to see.

Your followers aren't necessarily looking to buy or sell today.

But if your content gives them a reason to stick around, you'll already be familiar when that time comes.

Our challenge? Look at your last nine posts as though you've never seen your business before. Would you hit follow?$v$,
   false, date '2027-01-19', date '2027-02-02', null::timestamptz)
)
insert into public.community_posts (kind, category, title, body, viewpoint, pinned, starts_on, ends_on, publish_at, author_id)
select 'topic', r.category, r.title, r.body, r.viewpoint, r.pinned, r.starts_on, r.ends_on, r.publish_at, a.id
from rows r cross join author a
where not exists (select 1 from public.community_posts p where p.kind = 'topic' and p.title = r.title)
order by r.sort;

-- What went in, and when each goes live (UK time).
select category, title, pinned, starts_on, ends_on,
       to_char(publish_at at time zone 'Europe/London', 'Dy DD Mon YYYY HH24:MI') as goes_live
from public.community_posts where kind = 'topic' order by pinned desc, starts_on;
