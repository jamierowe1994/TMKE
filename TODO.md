# TMKE backlog

The running list for the TMKE **website**, **admin centre** and **member hub**.
(The internal dashboard / project planner is a separate repo — TMKE-Dashboard —
and nothing here refers to it.)

Started 27 Jul 2026, from Dani's recall plus an audit of the repo. Items with a
`file:line` reference were verified in the code; the rest are from memory and
worth a sanity check before anyone acts on them.

No strict order. Tick things off as they land.

---

## 1. Training / Learn ⬜

**The plan itself needs revisiting before any more building.** The open question
isn't the software, it's the syllabus and who writes what:

- What do we actually need from a training perspective?
- **Dani writes** — the material only they can write.
- **Convert from PDFs** — training that already exists in PDF form and needs
  reworking into hub content.
- **Claude writes** — the tutorials and how-to-use-the-hub material.

**Good news: the mini-course work was NOT lost.** What survives:

- ✅ The whole Learn system is built — a `guides` table that handles both
  single guides and multi-lesson courses (`kind: 'guide' | 'course'`, lessons
  stored as an ordered list), draft/published status, members-vs-public
  audience, estimated minutes, and per-member progress tracking.
  (`supabase/guides.sql`, `supabase/guide_progress.sql`)
- ✅ An admin authoring tool at `/admin/guides`, a member-facing Learn page at
  `/account/guides`, and a reader at `/account/guides/read`.
- ✅ A seven-topic taxonomy: Getting started · Intro to social media ·
  Instagram & Facebook · Content strategy · Design & branding · Reels & video ·
  Analytics. (`src/data/guide-topics.js`)
- ✅ **A complete 8-lesson course, fully written** — "Getting around your hub",
  covering Dashboard, Studio, Shop, Planner, Orders, Bookings, Brand Kit and
  Learn. It sits as a **draft**, waiting only on screenshots.
  (`supabase/course_getting-around-your-hub.sql`)
- ✅ Three seeded guides with real copy — the hub tour, "Setting up your brand
  kit" (3 lessons) and "Creating your first post in the Studio" (3 lessons).
  (`supabase/guides_seed_hub.sql`)

Still to do:
- ⬜ **Screenshots for the hub course** — 8 PNGs into `public/images/learn/hub/`
  (`dashboard` · `studio` · `shop` · `planner` · `orders` · `bookings` ·
  `brand-kit` · `learn`). They appear automatically; until then each slide shows
  a tinted placeholder. Then flip the course to published from `/admin/guides`.
- ⬜ Two guides ship as "Coming soon" — *Using the content calendar* and
  *Captions that convert*. (`src/components/account/GuidesPanel.astro:37,44`)
- ⬜ The Learn page's links are deliberately blank `#` placeholders — 9 of them
  still to wire up. (`src/pages/account/guides.astro:12`)

## 2. Videography ⬜

The biggest unfinished area. Four strands:

**Payment + invoicing (admin centre)** — not built.
- ⬜ At booking, the customer needs to choose **how they're paying**:
  · **Invoice the brand** — where a marketing fee has already been paid to the
    brand. Primarily a Fine & Country arrangement.
  · **Pay themselves** — goes through Stripe.
- ⬜ The admin centre needs the matching back end: raising and tracking
  invoices, and reconciling them against bookings.
- ⬜ Tie invoicing back into the front end so the customer sees the right thing.

**Admin centre for videography** — ⬜ unfinished generally, beyond invoicing.

**Delivery of finished shoots** — ⬜ undecided.
- How does Jack save the edited files once a shoot is cut?
- How do clients then access them, and use them for their preview?

**Pricing** — ✅ (27 Jul) updated to the 2026 rate card. Property Gold £395 → £550,
Platinum £595 → £625; Studio (£165/£325/£785) and Agent (£295 + £155 B-roll)
unchanged. Applied in both places prices live — the booking flow
(`src/lib/videography-config.js`) and the website copy (`src/data/videography.js`)
— and the Property page's "what's included" list corrected to the real Gold
package, with the Platinum upgrade explained in the pricing copy.
- ⬜ **External (non-member) rates aren't modelled.** The rate card has two
  external tiers — Standard agency (Gold £680 / Platinum £770) and Scaleable
  agency (Gold £805 / Platinum £910) — but the system only knows "member" vs
  "non-member". Recorded in comments in videography-config.js for now.
- ⬜ **The public page quotes £550 to everyone**, including non-TEG visitors who
  would actually be quoted £680+. The copy hedges ("your rate is calculated
  automatically"), but worth deciding whether non-members should see their own
  "from" figure.

**Terms** — ⬜ need going through and amending.
- The new-starter booking page currently tells visitors its own terms are a
  draft: *"Working draft — the final wording will be confirmed before this goes
  live."* (`src/pages/videography/new-starter.astro:31`)
- Same page still has a placeholder studio photo the client was to replace.
- The "Recent work" showreel is unwired — all three packages have an empty
  `showcase`, so the section renders nothing. Waiting on Cloudflare Stream IDs.
  (`src/data/videography.js:106,167,222`)

## 3. Member hub — Your SMM ⬜

Believed unfinished:
- ⬜ Make **Your Plan** clickable — opens a card with fuller detail of the
  member's plan.
- ⬜ Monthly performance was still being worked through.
- ⬜ Add it to the **invoicing** tab.

Related, found in the audit:
- ⬜ **The SMM report AI generator doesn't exist.** `docs/smm-report-rules.md`
  was adopted on 16 Jul as the source of truth for the AI prompt, but there's
  no generation endpoint — summaries and key takeaways are hand-typed today.
- ⬜ **No review step before a client sees a report.** The rules doc says a
  report must stay invisible to the client until reviewed, but saving one
  publishes it immediately — there's no draft/published column on
  `smm_reports`, and the member read returns every row.

## 4. Member hub as an installable app ⬜

Install it from Chrome and have it on the desktop, so members reach the Studio
without going through the website. Not a native app — a PWA.

- ⬜ Nothing exists yet: there's no web manifest anywhere in the repo.
- Needs: a manifest, icons, a service worker, and a decision on what the app
  opens into (the dashboard rather than the marketing site).
- NB: the same thing was done on the TEG paid-ads platform, so there's a
  working reference to crib from.

## 5. Social media portfolio ⬜

Not complete. Needs scoping — what's missing, and what "complete" looks like.

## 6. Public website ⬜

- ⬜ **The privacy policy has a placeholder live on the site** — "ICO
  registration: [to be confirmed — registration in progress]". Should be filled
  in or the line removed. (`src/pages/privacy.astro:37`; page dated 16 June 2026)
- ⬜ `/edit`'s scroll-driven panel switching **was never verified on the live
  site** — it couldn't be tested in the preview environment, and it's the
  default layout.
- ⬜ The Studio panel on `/edit` uses pack designs as stand-in imagery instead
  of Studio screenshots. (`src/pages/edit.astro:2202-2210`)
- ⬜ Two fallback layouts (`?layout=classic`, `?hero=classic`) are still carried
  on `/edit` — meant to be removed once the design settled.
- ⬜ **`README.md` is completely stale** — describes a plain HTML site with
  `index.html`. It's Astro, ~86 pages, a Cloudflare Worker and Supabase.

## 7. Admin centre ⬜

- ⬜ **Contacts import doesn't retro-fill people already in the system** — the
  ~30 Lettings agents and Daniel Turnbull won't have the TEG tab, agent profile,
  postcode or marketing opt-in until the import is re-run with the new toggle,
  or each card is set by hand.
- ⬜ The enrolled-count fix and the funnel audit page (Jul PRs #484/#485)
  shipped **unverified** — they couldn't be rendered in dev. Worth eyeballing
  on the live admin.
- ⬜ The funnel audit only explains steps that run from now on; emails sent
  before the change show as bare "Email · ran".
- ⬜ The 9 brand-wrapped client emails can't be previewed or test-sent.
- ⬜ Booking confirmations, the setup reminder and the DD invoice were left out
  of the brand wrap pending a separate typography pass — never done.
- ⬜ Unsubscribe is a mailto opt-out, not a real one-click unsubscribe page.
- ⬜ No newsletter / send-to-a-list flow.
- ⬜ `ADMIN_SETUP.md` and `AUTH_SETUP.md` are both stale — they list things as
  unbuilt (Orders, Subscribers, Enquiries, Stripe) that now exist.

## 8. Member hub — other ⬜

- ⬜ **The invite-to-join flow is broken at the last step.** Invites link to
  `/join?email=…&name=…`, but `join.astro` never reads those values, so the
  invitee has to retype everything.
- ⬜ Brand kit doesn't reach the dashboard or caption generator on a new device
  until the member opens the Studio or profile first.
- ⬜ The Studio upload library's save-and-reload was never tested against real
  storage.
- ⬜ The Studio text list only covers the current page of a multi-page template.
- ⬜ Schedule falls back to a hard-coded holiday list if `uk_observances` was
  never seeded. (`src/pages/account/schedule.astro:1249-1263`)

## 9. Security + infrastructure

- ✅ **(27 Jul) Backstage tables locked to admins.** The admin area and member
  hub are two doors into one database, and the database was only asking "are
  you signed in?" — which every member is. The pack catalogue was writable and
  deletable by any member, and contacts, email templates and the automations
  tables were readable *and* writable. All now gated on the staff list
  (`public.admins`). Applied to production and verified.
  (`supabase/packs_admin_rls.sql`, `supabase/admin_tables_rls.sql`)
- ⬜ **Website inline editor: two security-adjacent items.** Edited wording is
  stored as HTML and re-injected **without sanitising**, and the read policy
  **exposes unpublished drafts to anonymous readers**.
  (`docs/website-editor-setup.md:107-118`)
- ⬜ Same file: published edits are fetched client-side, so heavy edits **flash
  before applying**.
- ⬜ **Confirm five migrations were actually run in production** — each fails
  silently if it wasn't: `member_brand_kits`, `email_template_folders`,
  `contact_secondary_email`, `contact_dedup_review`, `brand_social`.
- ⬜ A stub payment path still exists on `/edit`: if Stripe isn't configured,
  checkout fakes a delay and records an unpaid order.
  (`src/pages/edit.astro:2516-2546`)
- ⬜ Instagram auto-posting (reminders v2) not started — blocked on Meta App
  Review. Today it's a manual-posting email.
- ⬜ Two mailers in play: M365 for Studio test-sends, Resend for the calendar
  reminder. Worth settling on one if bulk deliverability matters.
