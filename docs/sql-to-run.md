# SQL to run

Run these in the Supabase SQL editor, in order, top to bottom. Each one is safe to run twice. Once one has run, tell Claude and it's ticked off.

## Waiting

- [ ] supabase/content_calendar_levels.sql — the four Content Calendar levels, their prices and what each opens, for Content calendar › Overview (29 Oct)
- [ ] Training pack off, one line: `update public.packs set training = false where training;` — the course screenshots are done, so the training account stops seeing TPE's canvassing pack (31 Oct)

## Done

- [x] supabase/content_calendar_notes.sql — notes on each Content Calendar month, for ideas and rough planning (28 Oct; found run 31 Oct)
- [x] supabase/print_guide.sql — the words for each brand's Your Print Materials guide, edited in Design studio › Print › Print materials; run after pack_training_view.sql (30 Oct; ran 31 Oct)
- [x] supabase/pack_training_view.sql — lets the training account see TPE's canvassing print pack for the course screenshots; temporary, switch it off after (30 Oct)
- [x] supabase/content_calendar_months.sql — Content Calendar months and posts, calendar templates, course levels (28 Oct)
- [x] supabase/invoices_management_writes.sql — only management can change invoices; everyone can still see them (28 Oct)
- [x] supabase/smm_video_notes.sql — videography notes on social media clients (27 Oct)
- [x] supabase/template_page_images.sql — a picture of every page (25 Oct)
- [x] supabase/mockup_printed_posts_eight_fresh.sql — Printed posts - Eight put back fresh (25 Oct)
- [x] supabase/mockup_printed_posts_size.sql — printed-posts mockups to 1600 x 2000 (25 Oct)
- [x] supabase/mockup_printed_posts.sql — two printed-posts mockups, eight and fifteen, on the Mockups tab (25 Oct)
- [x] supabase/pack_story.sql — pack story text (24 Oct)
- [x] supabase/smm_leaving_date.sql — leaving dates for social media clients (23 Oct)
- [x] supabase/pack_free_window.sql — free packs for a limited time, e.g. Halloween (22 Oct)
- [x] supabase/booking_document_strategy.sql — strategy document uploads (22 Oct)
- [x] supabase/invoicing_automation_3.sql — Abbie's monthly invoice list (22 Oct)
- [x] supabase/invoicing_automation_2.sql — the invoice schedule from your sheet (21 Oct)
- [x] supabase/invoicing_automation.sql — automatic invoicing (21 Oct)
- [x] supabase/booking_document_categories.sql — content plan uploads (21 Oct)
