-- TMKE Learn — seed the "Getting started" hub guides (real content).
-- Run once in the Supabase SQL editor AFTER guides.sql. Safe to re-run — each
-- guide upserts on its slug, so you can re-run to pull in edits.
-- (Prices/wording are evergreen product how-tos; edit freely in Admin → Guides.)

-- ============================================================
-- 1) Getting around your hub
-- ============================================================
insert into public.guides (slug, title, topic, kind, summary, est_minutes, status, audience, sort_order, lessons)
values (
  'getting-around-your-hub',
  'Getting around your hub',
  'getting-started', 'guide',
  'A quick tour of your members hub — what each area does, and where to find it.',
  4, 'published', 'members', 1,
  jsonb_build_array(
    jsonb_build_object(
      'title', 'The tour',
      'body_html',
      '<p>Welcome in. Your hub is where everything lives — your designs, your content plan, your brand, and your learning. Here''s what each area does, so you always know where to go.</p>'
      '<h3>Along the top</h3>'
      '<ul>'
      '<li><strong>Dashboard</strong> — your home base. A quick view of what''s on and where to pick up.</li>'
      '<li><strong>Studio</strong> — where you create. Design posts from scratch, from a template pack, or reopen something you''ve made.</li>'
      '<li><strong>Planner</strong> — plan and schedule your content so you always know what''s going out and when.</li>'
      '<li><strong>Orders</strong> &amp; <strong>Bookings</strong> — your pack purchases and any videography shoots you''ve booked.</li>'
      '<li><strong>Shop</strong> — The Edit. Browse and buy template packs built for property.</li>'
      '<li><strong>Guides</strong> — you''re here. Short, practical guides to help you get more from the hub and grow on social.</li>'
      '</ul>'
      '<h3>In the top-right menu</h3>'
      '<ul>'
      '<li><strong>Brand Kit</strong> — your colours, fonts and logo. Set them once and every design you make uses them automatically.</li>'
      '<li><strong>Managed Socials</strong> — if we run your channels for you, this is your window into it.</li>'
      '<li><strong>Billing</strong> and <strong>Your profile</strong> — account bits and bobs.</li>'
      '</ul>'
      '<h3>Where to start</h3>'
      '<p>If you''re brand new, do these two things first: <strong>set up your Brand Kit</strong> (so everything looks like you), then <strong>create your first post in the Studio</strong>. There''s a guide for each — they''re the next two in this topic.</p>'
    )
  )
)
on conflict (slug) do update set
  title = excluded.title, topic = excluded.topic, kind = excluded.kind, summary = excluded.summary,
  est_minutes = excluded.est_minutes, status = excluded.status, audience = excluded.audience,
  sort_order = excluded.sort_order, lessons = excluded.lessons;

-- ============================================================
-- 2) Setting up your brand kit
-- ============================================================
insert into public.guides (slug, title, topic, kind, summary, est_minutes, status, audience, sort_order, lessons)
values (
  'setting-up-your-brand-kit',
  'Setting up your brand kit',
  'getting-started', 'guide',
  'Colours, fonts and logo — set them once and every design you make looks unmistakably yours.',
  6, 'published', 'members', 2,
  jsonb_build_array(
    jsonb_build_object(
      'title', 'Why it matters',
      'body_html',
      '<p>Your <strong>brand kit</strong> is the set of colours, fonts and logos that make your content recognisably <em>yours</em>. Set it up once and the Studio applies it to everything you create — so every post looks consistent without you thinking about it.</p>'
      '<p>Consistency is what builds recognition. When your feed looks like it belongs to one confident brand, people remember you — and trust you a little more before you''ve even spoken.</p>'
    ),
    jsonb_build_object(
      'title', 'Add your logo and colours',
      'body_html',
      '<p>Open <strong>Brand Kit</strong> from the top-right menu (it lives on your profile). Everything here <strong>saves automatically</strong> as you go — there''s no save button to remember.</p>'
      '<h3>Your logo</h3>'
      '<p>Drag your logo files into the <strong>Logos</strong> area (or click to upload). Add a couple of versions if you have them — for example a full-colour logo and a white one for dark backgrounds.</p>'
      '<h3>Your colours</h3>'
      '<p>In the <strong>Colours</strong> section, drop in your brand colours. These become one-tap swatches inside the editor, so you never have to hunt for a hex code again.</p>'
      '<p><strong>Tip:</strong> two or three colours is plenty — a main colour, a secondary, and a neutral. Restraint looks more premium than a rainbow.</p>'
    ),
    jsonb_build_object(
      'title', 'Fonts, and putting it to work',
      'body_html',
      '<p>Pick your <strong>fonts</strong> in the typography section — usually one for headings and one for body text.</p>'
      '<p>That''s the whole kit. From now on, when you design in the <strong>Studio</strong>, your colours, fonts and logo are all one tap away. Head to the next guide, <em>Creating your first post in the Studio</em>, to put it to use.</p>'
    )
  )
)
on conflict (slug) do update set
  title = excluded.title, topic = excluded.topic, kind = excluded.kind, summary = excluded.summary,
  est_minutes = excluded.est_minutes, status = excluded.status, audience = excluded.audience,
  sort_order = excluded.sort_order, lessons = excluded.lessons;

-- ============================================================
-- 3) Creating your first post in the Studio
-- ============================================================
insert into public.guides (slug, title, topic, kind, summary, est_minutes, status, audience, sort_order, lessons)
values (
  'creating-your-first-post',
  'Creating your first post in the Studio',
  'getting-started', 'guide',
  'From blank canvas to finished post — design something on-brand in a few minutes.',
  7, 'published', 'members', 3,
  jsonb_build_array(
    jsonb_build_object(
      'title', 'Start a design',
      'body_html',
      '<p>Open the <strong>Studio</strong> from the top navigation. There are three ways to start:</p>'
      '<ul>'
      '<li><strong>Blank canvas</strong> — begin from scratch and choose your size (perfect for a quick post or story).</li>'
      '<li><strong>From a pack</strong> — start from one of the template packs you own. This is the fastest route: the layout''s done, you just make it yours.</li>'
      '<li><strong>Your designs</strong> — reopen anything you''ve already created to edit or repurpose it.</li>'
      '</ul>'
      '<p>Don''t own a pack yet? Browse <strong>Shop</strong> (The Edit) — the packs are built specifically for property and drop straight into your Studio.</p>'
    ),
    jsonb_build_object(
      'title', 'Make it yours',
      'body_html',
      '<p>Inside the editor, click any element to change it:</p>'
      '<ul>'
      '<li><strong>Text</strong> — click to edit the words; use the toolbar to change size, weight and alignment.</li>'
      '<li><strong>Images</strong> — swap in your own property photo or upload a new one.</li>'
      '<li><strong>Colours &amp; fonts</strong> — your Brand Kit swatches and fonts are right there, so a few taps and it''s on-brand.</li>'
      '</ul>'
      '<p><strong>Tip:</strong> keep one clear message per post. If everything shouts, nothing gets heard.</p>'
    ),
    jsonb_build_object(
      'title', 'Save, download, schedule',
      'body_html',
      '<p>When it looks right:</p>'
      '<ul>'
      '<li><strong>Save</strong> keeps it in <em>Your designs</em> so you can come back to it any time.</li>'
      '<li><strong>Download</strong> exports a high-quality image ready to post.</li>'
      '<li><strong>Schedule</strong> sends it to your <strong>Planner</strong>, so you can line up what''s going out and when.</li>'
      '</ul>'
      '<p>That''s it — you''ve made your first on-brand post. The more you use your Brand Kit and packs, the faster this gets.</p>'
    )
  )
)
on conflict (slug) do update set
  title = excluded.title, topic = excluded.topic, kind = excluded.kind, summary = excluded.summary,
  est_minutes = excluded.est_minutes, status = excluded.status, audience = excluded.audience,
  sort_order = excluded.sort_order, lessons = excluded.lessons;
