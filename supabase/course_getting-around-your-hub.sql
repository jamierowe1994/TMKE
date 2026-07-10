-- TMKE Learn — course: "Getting around your hub"
-- Idempotent: run any time to (re)seed this course. Keyed on slug.
-- Ships as DRAFT so you can drop the screenshots in and review before it goes
-- live to members — flip status to 'published' from /admin/guides when ready.
--
-- Screenshots: each slide references /images/learn/hub/<name>.png. Until those
-- files exist the frames show a clean tinted placeholder (no broken icons).
-- Drop the PNGs into public/images/learn/hub/ and they appear automatically.

insert into public.guides (slug, title, topic, kind, summary, cover_url, lessons, est_minutes, status, audience, sort_order)
values (
  'getting-around-your-hub',
  'Getting around your hub',
  'getting-started',
  'course',
  'Welcome to your hub — your own space to create, plan and manage everything in one place. This quick tour walks you through each part and what you can do there. Give it about five minutes.',
  '',
  $json$[
    {"title":"Your Dashboard","body_html":"<p>Your <strong>Dashboard</strong> is home base — every time you sign in, this is where you land.</p><figure class='gr-shot' style='background-image:url(/images/learn/hub/dashboard.png)'><figcaption>Your Dashboard</figcaption></figure><p>It gives you the quick version of everything: what's new, what needs a look, and a shortcut straight into creating something. From here you can jump to any part of the hub in a click.</p>"},
    {"title":"The Studio","body_html":"<p>The <strong>Studio</strong> is where you make things. Start from a blank canvas or one of your content packs, then make it yours — text, colours and images, all drag-and-drop.</p><figure class='gr-shot' style='background-image:url(/images/learn/hub/studio.png)'><figcaption>The Studio</figcaption></figure><p>Everything you create is saved under <strong>Your designs</strong>, ready to pick back up any time. When it's ready, download it or send it through to your Planner.</p>"},
    {"title":"The Shop","body_html":"<p>The <strong>Shop</strong> — we call it The Edit — is where you browse and buy content packs: ready-made sets of on-brand templates for a theme, season or campaign.</p><figure class='gr-shot' style='background-image:url(/images/learn/hub/shop.png)'><figcaption>The Shop</figcaption></figure><p>Have a flick through, and anything you buy drops straight into your Studio to edit and make your own.</p>"},
    {"title":"The Planner","body_html":"<p>The <strong>Planner</strong> is your content calendar — line up what's going out and when, so you're never staring at a blank week.</p><figure class='gr-shot' style='background-image:url(/images/learn/hub/planner.png)'><figcaption>The Planner</figcaption></figure><p>Drag posts around, see it all at a glance, and keep your socials ticking over with a plan instead of a panic.</p>"},
    {"title":"Orders","body_html":"<p><strong>Orders</strong> keeps every pack you've bought in one tidy place.</p><figure class='gr-shot' style='background-image:url(/images/learn/hub/orders.png)'><figcaption>Your Orders</figcaption></figure><p>Come here to re-open a purchase, download your files again, or look back over what you've spent — it's all logged for you.</p>"},
    {"title":"Bookings","body_html":"<p><strong>Bookings</strong> is home to anything we're doing with you in person or on a call — videography shoots, content-studio sessions and strategy calls.</p><figure class='gr-shot' style='background-image:url(/images/learn/hub/bookings.png)'><figcaption>Your Bookings</figcaption></figure><p>See what's coming up, review the details, and find everything tied to each booking in one place: confirmations, prep notes and your delivered files.</p>"},
    {"title":"Your Brand Kit","body_html":"<p>Your <strong>Brand Kit</strong> is what makes everything look unmistakably yours. Set your colours, fonts and logo once, and the Studio uses them everywhere.</p><figure class='gr-shot' style='background-image:url(/images/learn/hub/brand-kit.png)'><figcaption>Your Brand Kit</figcaption></figure><p>It's the quickest win in the whole hub — five minutes here and every design you touch comes out on-brand.</p>"},
    {"title":"Learn","body_html":"<p>And this is <strong>Learn</strong> — where you are right now. Guides walk you through the how-tos, and courses (like this one) take you a little deeper, step by step.</p><figure class='gr-shot' style='background-image:url(/images/learn/hub/learn.png)'><figcaption>The Learn section</figcaption></figure><p>The <strong>Blog</strong> sits alongside for ideas and inspiration — quick reads to help you post better. Dip in whenever you fancy it.</p>"}
  ]$json$::jsonb,
  5,
  'draft',
  'members',
  0
)
on conflict (slug) do update set
  title       = excluded.title,
  topic       = excluded.topic,
  kind        = excluded.kind,
  summary     = excluded.summary,
  cover_url   = excluded.cover_url,
  lessons     = excluded.lessons,
  est_minutes = excluded.est_minutes,
  audience    = excluded.audience,
  sort_order  = excluded.sort_order,
  updated_at  = now();
-- Note: status is intentionally NOT overwritten on re-run, so re-seeding won't
-- un-publish a course you've already made live.
