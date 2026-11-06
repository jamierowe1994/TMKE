# SQL to run

Run these in the Supabase SQL editor, in order, top to bottom. Each one is safe to run twice. Once one has run, tell Claude and it's ticked off.

## Waiting



## Done

- [x] supabase/accounts_portal.sql — the accounts portal (private link and passcode), notes and not-paid reasons on invoices, and Revenue's costs and sectors. Until it's run, Invoicing and the portal say so instead of opening (6 Nov; ran 6 Nov)
- [x] supabase/tpe_ppe_dual_brand.sql — one-off from Sam: every live TPE and PPE agent gets both brands and their photo copied across, except Elliott Wakefield, Gavin Pretorious, Nicholas Charles and Vivienne Sharman-Lewis. It lists everyone at the end (6 Nov; ran 6 Nov)
- [x] supabase/morning_jobs_switch.sql — the on/off switch for the 8am jobs, in Invoicing › Settings › Automatic invoicing. They stay off until you turn them on (6 Nov; ran 6 Nov)
- [x] supabase/reset_sarah_test.sql — one-off: Sarah Test back to a fresh enquiry for the team walkthrough. Deletes her notes, emails, files, invoices (TMKE1098, TMKE1099) and monthly invoice; keeps her contact details and the original Enquiry received note (5 Nov; ran 5 Nov)
- [x] supabase/recurring_pays_ahead.sql — Pays a month ahead on a social media client's monthly invoice: raised in December, for January. On for new clients and Terry; until it's run, monthly invoices can't be saved from a client file (5 Nov; ran 5 Nov)
- [x] supabase/booking_document_brand.sql — brand assets for social media clients: several files uploaded from Onboarding, kept as one Brand assets folder in Paperwork (5 Nov; ran 5 Nov)
- [x] supabase/smm_pricing_settings.sql — the social media calculator figures (planning, creation, reporting hours, rates, software, property pack, margins), so they can be edited and saved on Packages & pricing; only management can change them (5 Nov; ran 5 Nov)
- [x] supabase/smm_meeting_link.sql — a booked social media call remembers if it's a Teams call and its link, so the file can ask for the link and add it to everyone's invite (5 Nov; ran 5 Nov)
- [x] supabase/smm_discovery_booked_stage.sql — social media cards with a discovery call booked move from Enquiry to Discovery call, with the call on the file (5 Nov; ran 5 Nov)
- [x] supabase/smm_stages_and_follow_ups.sql — the social media client file by stage: how someone added by hand came in (referral and who), the brand that pays for an inter-brand client, and follow-up and check-in dates (5 Nov; ran 5 Nov)
- [x] supabase/client_portal_smm.sql — social media clients get their own portal automatically: made when their first shoot is booked, emailing their manager (Abby for hers) when Jack presses Content ready (4 Nov; ran 4 Nov)
- [x] supabase/videography_service_names.sql — renames every existing videography booking's service to the new list (New-starter Studio Day, Property video, Event coverage…) and shows you each change; old names are kept in the booking's notes (4 Nov; ran 4 Nov)
- [x] supabase/client_portal_notify.sql — a portal can email someone when a folder is added (Michelle, for the TEG New Starter portal), and you can choose a passcode such as TEG (4 Nov; ran 4 Nov)
- [x] supabase/studio_admin_shared_uploads.sql — one uploads library for every admin in the admin Studio: uploads and folders shared, so Sam sees the folders you make; members' uploads stay their own (3 Nov; ran 3 Nov)
- [x] supabase/content_calendar_levels.sql — the four Content Calendar levels, their prices and what each opens, for Content calendar › Overview (29 Oct; ran 2 Nov)
- [x] Training pack off, one line: `update public.packs set training = false where training;` — the course screenshots are done, so the training account stops seeing TPE's canvassing pack (31 Oct; ran 2 Nov)
- [x] supabase/print_guide_kind.sql — a type pill for each print design (Booklet, Leaflet) in Your Print Materials; run after print_guide.sql (31 Oct; ran 2 Nov)
- [x] supabase/client_portal.sql — client portals: a client's private link and passcode to watch and download their shoots from the Library, in Videography › Client portals and on each shoot's Delivery section (2 Nov; ran 2 Nov)
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
