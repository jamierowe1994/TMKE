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

## 4. Member hub as an installable app ✅ (31 Jul)

Two apps, not one: the admin centre and the member hub are used by different
people and each installs separately. The marketing site links no manifest, so
it is never offered for install.

- ✅ **TMKE Admin** — scope `/admin/`, opens on `/admin/`.
- ✅ **TMKE Studio** — scope `/account/`, opens on `/account/`. Named to match
  the icon James supplied, which reads STUDIO.
- ✅ Prerequisite: the hub moved to a single address prefix under `/account/`
  (see the migration commit) — an app is scoped to a path, not a list of pages.
- ✅ Wired in `BaseLayout.astro`; `AdminShell` wraps it too, so one path check
  covers both areas.
- **No service worker, on purpose.** Chrome dropped that requirement for
  installation (112 desktop / 108 mobile), and a worker caching signed-in admin
  pages risks serving one user another's stale data. Offline support stays a
  separate, deliberate decision.
- NB the old note here claimed the TEG paid-ads platform had a working PWA to
  crib from. It does not — it has PWA-shaped icons and no manifest or service
  worker. Built from scratch.
- ⬜ Icons are declared `purpose: "any"`, not maskable: both wordmarks run close
  to the edge and a circular mask would clip them. Fine on desktop; revisit
  with padded variants if members start installing on Android.

## 4b. Insights — website + member hub ⬜

Added 31 Jul. **Nothing surfaces any of it today.** There is no analytics
product on the site (no GA, no Plausible or similar), and no dashboard reading
what we already collect.

Worth knowing before anyone reaches for a third party: **`site_events` already
exists** (`supabase/site_events.sql`, written by `src/lib/track.js`) and is
already recording. It is keyed by `session_id` / `user_id`, so it can answer
hub questions — which pages members use, where they drop out — that Google
Analytics cannot, because it knows who is signed in.

- ⬜ Decide the split: a third party for anonymous marketing traffic, our own
  data for signed-in hub behaviour. They answer different questions and one
  won't do both well.
- ⬜ Audit what `site_events` records now, and what's missing.
- ⬜ An admin insights page. The funnel-audit page is the nearest existing
  pattern.

## 4c. SEO and Google indexing ⬜

Added 31 Jul, after James searched "TMKE" and the site didn't appear despite
being live for weeks. Checked the same day — **nothing is blocking Google**, so
this is almost certainly "never told Google it exists" rather than a fault:

- ✅ Not a robots problem. `robots.txt` is Cloudflare-generated (there is none
  in `public/`) and allows all search crawlers: `User-agent: * / Allow: /`. It
  blocks AI training bots (GPTBot, CCBot, ClaudeBot, Google-Extended and
  others) — which is a content decision, not an indexing one. `Google-Extended`
  is Gemini training, **not** Google Search.
- ✅ Not a noindex problem. Home, About, Services, Videography, Contact and Blog
  all carry no robots tag.
- ✅ The sitemap is live and healthy — `/sitemap-index.xml` → `/sitemap-0.xml`,
  **70 URLs**.
- ✅ **(31 Jul) Google Search Console verified**, by DNS TXT record on
  tmke.co.uk. Next: submit `https://tmke.co.uk/sitemap-index.xml` in Search
  Console if it wasn't done during setup, then give it days rather than weeks
  before judging. Coverage and Performance in Search Console are now the place
  to look, not a Google search.
- ⬜ **`robots.txt` does not point at the sitemap.** Since Cloudflare generates
  it, adding `Sitemap: https://tmke.co.uk/sitemap-index.xml` means either
  putting a real `robots.txt` in `public/` (which overrides Cloudflare's, so
  the AI-bot rules would need copying across) or adding it in the Cloudflare
  dashboard.
- ⬜ Then the ordinary SEO pass: titles, meta descriptions, headings, internal
  linking, and whether the pages say what people actually search for.

A new domain not appearing for its own brand name after a few weeks is normal
when it has never been submitted. It is not evidence of a penalty.

## 4d. App icons are cached for four hours ⓘ

Files in `public/` keep the same URL forever, and the CDN serves them with
`cache-control: max-age=14400`. So replacing an app icon deploys the new file
but browsers and the CDN keep serving the old one for up to four hours — which
is exactly what happened on 2 Aug when a new member icon appeared not to take.

**When you change an app icon, bump the version in its manifest**, e.g.
`/icons/hub-192.png?v=2` → `?v=3`. The cache is keyed on the full URL, so a new
query string is a fresh fetch. A `.webmanifest` is JSON and can't carry a
comment, hence this note.

Same trap as the editor script, which solves it with a build stamp
(`src/pages/account/editor.astro`).

## 4f. Diary slots now match the workbook ✅ (4 Aug)

The booking flow was reserving half the filming time the pricing workbook
allows. James confirmed: go with the workbook.

| Service | Was | Now |
|---|---|---|
| Property (Gold and Platinum) | 4 hrs | **8 hrs** |
| Agent / Location — Launch | 2 hrs | **4 hrs** (+30 min per add-on, unchanged) |
| Content Studio | 1.5 / 3 / 8 hrs | unchanged — already correct |

Changed in `VideographyBooking.astro` (the value sent to `/ms/availability` and
written to the calendar event), `src/data/videography.js`, and the admin rate
card. Content Studio was already right.

**Watch this.** Availability comes from the hours Jack ticks in
`videography_availability`, and a property shoot now needs an unbroken 8-hour
run. On a day with 9–5 open hours that is the entire day: a single 30-minute
meeting anywhere in it drops property availability to zero. That is consistent
with one on-location shoot a day, which James confirmed is the intent, but it
does mean Jack's calendar hygiene now directly gates bookability.

So `/ms/availability` no longer returns a bare empty list. It distinguishes
`day_too_short` (the open hours cannot hold the shoot at all) from
`no_gap_long_enough` (they could, but the calendar is broken up), and the
booking UI has copy for both. Previously every case read "No times available
that day", which would have looked like being fully booked and nobody would
have thought to widen the open hours.

## 4h. SMM invoices can't be paid - no Stripe link ✅ (built since; verified 22 Aug)

Raised by James 4 Aug: "I need to get social media management invoices out, and
at the minute Stripe isn't linked to the SMM invoicing option."

**Done — this entry was stale and read as outstanding for months.** Checked
against the Worker on 22 Aug: `invoicePayUrl` signs a link that goes into the
invoice email whenever the invoice is marked pay-by-card;
`GET /invoicing/pay` verifies the token, refuses an invoice already paid or
voided, opens a Stripe Checkout session and redirects; the webhook writes
status, paid date, method and payment reference back, filtered on
`status=neq.paid` so Stripe's retries cannot double-apply. With no Stripe key
configured the customer is told to pay by bank transfer rather than hitting an
error, and the return page reports what the webhook has actually recorded
instead of assuming success.

Original note below, kept for the history.

Where it stands after a look round:

- The invoicing engine is real and shared. `POST /invoicing/invoices` creates a
  numbered draft with VAT applied server-side, `/invoicing/invoices/send` mails
  it, and the SMM client card drives it via `renderInvoicing` in
  `src/pages/admin/social.astro` (~line 1079), linked by `booking_id`.
- Stripe is also real, but only on one path: `POST /stripe/checkout` in the
  Worker creates a Checkout session against a row in `orders`, with a webhook
  verifying the signature and marking it paid. Only `src/pages/edit.astro`
  calls it.
- Nothing joins the two. An SMM invoice can be raised, numbered and emailed,
  but it carries no pay link, and nothing marks it paid.

So the work is a bridge, not a new integration: give an invoice a Checkout
session, put the link in the email, and have the webhook write back to the
invoice rather than only to `orders`.

Two things to settle before writing any of it:

- **What the webhook updates.** It currently assumes `orders`. Invoices live
  elsewhere, so it needs to tell the two apart - most likely via Stripe
  metadata carrying the invoice id.
- **Whether direct debit clients should get a pay link at all.** The SMM cards
  already carry a direct debit date and an inter-brand invoice flag. A client on
  DD, or one invoiced to another TEG brand, probably should not be offered
  card payment. That decision shapes the UI more than the plumbing does.

Worth confirming `STRIPE_SECRET_KEY` and the webhook secret are set on the
Worker before starting - `/stripe/checkout` returns a 503 without the key, and
that would look like a code fault.

## 4g. Loose ends from the pricing workbook ⬜

Three gaps the workbook exposed, all recorded honestly in config rather than
guessed at:

- **Content Studio has external prices but cannot be sold externally.**
  `SERVICES["content-studio"].membersOnly` is `true`, so non-members get
  Register Interest — yet the workbook prices all three sessions for both
  external tiers (£255/£510/£1,265 standard, £300/£605/£1,495 scaleable).
  Either the gate is wrong or those prices are quote-only. Currently quote-only.
- **B-roll has no external price.** `10 × 60-second B-roll scenes` is £155 to
  members and absent from the workbook. Left `null` and shown as "Not set" — an
  invented figure would be worse, because someone would quote it.
- **Studio hire sits outside the package price.** The workbook lists it
  separately (£45/£90/£240) and labels the member cost "no Studio Hire".
  Whether it is rebilled to the client is unsettled; `STUDIO_HIRE_IS_REBILLED`
  is `false` and nothing charges it.

## 4e. Videography prices aren't editable ⬜

Noticed 2 Aug. The admin panel is called **Pricing & travel settings** but only
travel is real: base postcode, free radius, per-mile rate and VAT save to
`videography_settings` and are read by the Worker when quoting. Verified
end to end — that half works.

**No price is editable.** Every package and add-on rate lives in
`src/lib/videography-config.js`: Single Session £165, Half Day £325, Full Day
£785, Property Gold £550, Platinum £625, the twilight add-ons, all of it. The
admin page never mentions them. Changing a price is a code change and a deploy
— which is exactly what happened for the 2026 rate card on 27 Jul.

Not a tweak. Those prices are read by the booking flow, the website copy, the
quote calculation and the agreements, so making them editable means serving
them from one place at runtime and making sure a mid-flight booking can't see
one price and be charged another. Worth scoping properly.

Meanwhile the panel's title promises more than it delivers, which is how this
was spotted.

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

### 6a. `/edit` is slow to load and stiff to scroll ⬜ — raised 17 Aug

Both reported from the live site. A first look at the code turns up four
candidates; none is confirmed as *the* cause yet, so measure before changing.

- ⬜ **Smooth-scroll is a library, not the browser.** Lenis is loaded site-wide
  from a CDN and `/edit` leans on it hard — the page's own comments call it
  "deliberately floaty" and note it "emits NO native scroll events", so the
  panel logic hooks Lenis's callback and polls for it to appear. Floaty inertia
  is exactly what "stiff" describes. Worth trying the page with Lenis off
  before anything else — it is the cheapest test and the likeliest answer.
  (`src/layouts/BaseLayout.astro:115-120`, `src/pages/edit.astro:2298-2331`)
- ⬜ **Pack covers can't lazy-load.** They are painted as CSS
  `background-image`, not `<img>` — there is not a single `<img>` or
  `loading="lazy"` on the page — so every cover downloads at full size on first
  paint whether or not it is on screen. Prime suspect for the load time.
  (`src/pages/edit.astro`, 9 × `cover_image_url`)
- ⬜ **A `backdrop-filter` repaints on every frame** while scrolling. One use,
  cheap to test by removing.
- ⬜ **2,571 lines in one page file**, including three IntersectionObservers
  and the panel-snapping machinery. Worth a look once the above are ruled in
  or out.

Ruled out already: the two scroll listeners are both `passive` and
rAF-throttled, so they are not the stiffness. (`src/pages/edit.astro:1659`)

### 6c. Insights sits on a wider left margin than the rest of the site ✅ (21 Aug)

`/blog` (titled "Insights") indents its hero and archive further from the left
edge than any other page, and it grows with the viewport rather than staying
put:

    padding: … max(76px, calc((100vw - 1360px) / 2 + 76px));
    src/pages/blog/index.astro:198

The `max()` centres the content to a 1360px container and then adds 76px on
top, so past ~1512px wide the gutter keeps growing while every other page's
stays where it is. That is the difference being seen — the two agree at
narrow widths and diverge on a big screen.

Fixed by dropping the `+ 76px`, keeping the `calc()`. The diagnosis above was
right about the cause but wrong about the remedy: a flat `76px` would have
overcorrected, since About and Services start their hero text at the centred
1360 container's *edge* (`.about-lede-wrap` has no inner padding), not at a
fixed inset from the viewport. Measured on both: Insights now sits at 220px on
an 1800px screen, the same as Services, and both fall back to 76px below 1360.

Still open: there is no shared gutter token anywhere — each page hard-codes its
own — so the next person still has to measure. Worth introducing one, but as
its own job rather than smuggled into a one-page fix.

### 6b. `/edit` shop — two visual fixes ⬜ — raised 17 Aug

- ⬜ **The bottom section's images need replacing** — placeholder imagery, real
  assets needed from Dani.
- ✅ (21 Aug) **Drop the line border around the pack images** in the shop
  section. It was an `outline` rather than a `border`, on `.pcard-media` —
  the three Shop the Packs cards. The hero reel's own active-tile outline is
  a selection indicator and was left alone.

## 7a. Deleting things, with permissions ⬜

Added 28 Jul. Two places, two different rules.

**Enquiries** (`/admin/enquiries`) currently offer only Mark spam, Close, Mark
replied and Reply via email.
- ⬜ Add **Delete**, visible **only to James and Danielle**. Nobody else on the
  team should see the button at all.

**Videography cards** (`/admin/videography`) can only be moved back a stage;
there is no delete.
- ⬜ Add **Delete**, and here the button **is** visible to everyone.
- ⬜ For anyone other than James or Danielle it becomes a **request to delete**:
  they press Delete, give a reason, and it goes to James or Danielle to approve.
  Jack is the obvious example.
- ⬜ **Needs clarifying:** Dani said "that will go through to me or James,
  because James doesn't need to know to approve the deletion" - unclear whether
  approval needs *either* of them or *both*. Assume either until confirmed.

Worth noting both need a real permission check server-side, not just a hidden
button - the admin gate is client-side (see §9), so hiding a button doesn't stop
anyone who knows the API. Same lesson as the packs lockdown.

## 7b. Brochure downloads ⬜

Checked 28 Jul:

- ✅ **Videography brochure is fine.** The PDF is live at
  `assets.tmke.co.uk/TMKE - Videography Services.pdf` (15.9 MB, returns 200).
  So if a request email didn't arrive, the fault is in the *email*, not the
  file - worth testing the request form end to end.
- ⬜ **The SMM brochure is broken.** Contrary to expectation the whole flow
  exists - a request form, the `POST /smm/brochure` endpoint, and a "Your TMKE
  social media brochure" email template - but the PDF it links to
  (`assets.tmke.co.uk/tmke-smm-brochure.pdf`, set in `src/lib/smm-config.js:136`
  and `worker/wrangler.toml:67`) **returns 404**. It was never uploaded.
  Anyone requesting it gets an email with a dead download link.
  Fix: upload the PDF to that exact filename in R2. No code change needed.

## 7c. Tag structure ⬜

There are far too many tags on contacts, and they've grown without a scheme.

This blocks the newsletter work: the plan for sending to a group
(docs/email-suppression-plan.md, outstanding item 1) is to select people **by
tag, lifecycle and company**. If the tags are a mess, the segments will be too,
and the first newsletter goes to the wrong people.

- ⬜ Audit what tags exist and how many contacts carry each.
- ⬜ Agree a naming scheme, and which tags are for segmentation versus which are
  just history.
- ⬜ Merge and retire the duplicates. NB `contact_tag_rules.sql` and the
  normalisation in the Worker already exist, so there's machinery to build on.

## 7. Admin centre ⬜

- ⬜ **Draft invoices can't be edited.** A draft is an invoice that hasn't been
  sent, so the obvious thing to want is a change before sending — but the only
  actions are Send, Mark paid, Void and Delete
  (`src/pages/admin/invoicing.astro:640`). Today the workaround is delete and
  re-key it.

  Not the ten-minute job it looks. The pieces and the traps, from a look on
  31 Jul:
  · The create form already exists (`invoicing.astro:77`, `#inv-form`) and can
    be reused — it needs a mode, and to PATCH rather than POST.
  · **The API can't do it yet.** `PATCH /invoicing/invoices` only accepts a
    `status` — it reads `b.status`, rejects anything else, and writes nothing
    but status and paid_date. Field edits need a new endpoint or a widened one.
  · **Guard it to drafts.** Editing a sent invoice would change what the client
    was already emailed, and a voided one is meant to be immutable.
  · **The stored PDF must be regenerated.** A PDF is rendered and put in R2 at
    creation (`invoices/<number>.pdf`); editing without re-rendering leaves the
    record and the document disagreeing — and the client's hub serves the PDF.
    The mark-paid path already re-renders, so there's a pattern to copy.
  · Numbering stays as issued — editing must not re-allocate an invoice number.

  Call it an hour done properly. It's money, so it wants the drafts-only guard
  and the PDF re-render, not just the form.


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

## 7d. Email builder — mobile spacing ✅

Found 30 Jul while amending the branded base, finished 31 Jul. Canvas and
renderer both fixed; verified against the real renderer by
`npm run test:email` (`scripts/check-email-spacing.mjs`, 11 assertions
including a no-regression check).

- ✅ **Canvas: mobile margin never applied, for any block.** `blockCard` passed
  the raw block to `resolveMargin` instead of `effectiveBlock(b, canvasDevice)`
  — every other property went through it, margin was missed. Same fix applied to
  the social block's padding, which had it too.
  (`src/pages/admin/email/editor.astro:625,582`)
- ✅ **"Blank = inherit desktop" is broken in the sent email.** Clearing a number
  field stores `undefined` (`editor.astro:1193` via `setPath` `:1076`), and the
  spread in `effectiveBlock` (`src/lib/email-render.js:300-310`) lets that
  `undefined` overwrite the desktop value — which then falls back to the *type
  default*, not desktop. Desktop `margin.b:40` + mobile `margin.t:10` renders as
  `10/0/16/0` and the 40 vanishes. Contradicts the UI's own placeholder and note
  (`editor.astro:821,835`). Fix: `delete` the key rather than assigning
  `undefined`, and/or strip undefined before the spread.
- ✅ **Mobile padding of 0 is silently dropped.** The `if (t||r||b||l)` guards at
  `email-render.js:292,316` skip an all-zero rule, so "set mobile padding to 0"
  leaves the desktop padding in place.
- ✅ **Mobile padding isn't merged with desktop** — `responsiveDecls:290-293` and
  `mobPad:313-317` read `m.pad.*` raw with a `0` fallback, so setting only Top
  wipes the other three sides. Margin *does* merge, so the two controls behave
  inconsistently for no reason a user could guess.
- ✅ **Columns blocks discard their own mobile spacing.** `blockResponsiveCss`
  (`email-render.js:378-383`) recurses into children and returns before the
  margin block at `:390`, though `wrapOuter:981` still stamps the `eb-mw-<id>`
  class on it. Social blocks ignore `mobile.pad` too
  (`socialResponsiveCss:352-374` only handles `iconSize`/`iconGap`).
- ✅ **Mobile padding placeholder shows the type default, not the desktop value**
  (`dPad`, `editor.astro:806-812`), so the UI mis-signals what blank means.
  `marginFields:821` does it correctly — copy that.

NB `src/lib/email-render.js` is the single renderer for every email actually
sent (the Worker imports it at `worker/src/index.js:20`), so changes there need
the rendered output checking, not just a build.

## 8. Member hub — other ⬜

- ⬜ **The invite-to-join flow is broken at the last step.** Invites link to
  `/join?email=…&name=…`, but `join.astro` never reads those values, so the
  invitee has to retype everything.
- ⬜ Brand kit doesn't reach the dashboard or caption generator on a new device
  until the member opens the Studio or profile first.
- ✅ (21 Aug) The Studio upload library's save-and-reload — confirmed working
  against real storage by Dani: historic uploads reappear on returning.
- ✅ (21 Aug) The Studio text list only covers the current page of a
  multi-page template. Not a fault — confirmed by Dani as the wanted
  behaviour: the list shows the current page's text, and moving to the next
  page shows that page's. Listing every page at once would be far too busy.
- ⬜ Schedule falls back to a hard-coded holiday list if `uk_observances` was
  never seeded. (`src/pages/account/schedule.astro:1249-1263`)

## 8b. Design Studio — editing behaviour ✅ (21 Aug) — raised 17 Aug

Raised while building pack templates, so these bite hardest on the work we do
most. The engine is `public/scripts/editor.js` (loaded with `<script src>`, not
bundled) with the panels in `src/pages/account/editor.astro` — both need
reading, the .astro alone tells you less than half.

- ✅ **Multi-select on Cmd.** It turned out multi-select was already built —
  bound to Shift, which is why it looked missing. Cmd now adds to the
  selection too (and Ctrl off-Mac, where ctrl-click is not already a
  right-click). Marquee box-select accepts the same modifiers.

- ✅ **Panels do not follow the selection.** With Position open, clicking a
  different item leaves the panel showing the *previous* item's numbers — you
  have to close it and reopen it before it reads the thing you just clicked.
  Whatever panel is open should re-read on every selection change.

- ✅ **The open panel is dropped when you select something else.** Change a
  text colour, click the next text item, and you are back at the generic
  selection panel instead of still on Text colour. The common case is
  recolouring several items in a row, so the panel should stay put and be
  dismissed deliberately.

  These two were one underlying fault, as suspected, and took one fix. Each
  popover's panel is appended to <body> while its trigger sits in the context
  bar, which is wiped and rebuilt on every selection change — so the panel
  outlived its button, kept showing the previous element's values, and leaked
  a node per render. Popovers are registered and disposed with the bar now,
  and whichever was open is reopened against the new selection.

- ✅ **The Text colour overlay does not cover the left column.** The panel
  underneath shows through down the side and along the bottom (see the swatch
  grid: the Start / Brand / Elements rail is clear, but the panel behind the
  overlay is not). Fixed by sizing it off the grid: the shell is
  `76px 360px 1fr` and the overlay was pinned at `left: 100px`, a stale number
  from when the rail was 100 wide (the comment above the grid still says so).
  It now starts where the rail ends and is exactly as wide as the panel.

## 9. Security + infrastructure

- ✅ **(27 Jul) Backstage tables locked to admins.** The admin area and member
  hub are two doors into one database, and the database was only asking "are
  you signed in?" — which every member is. The pack catalogue was writable and
  deletable by any member, and contacts, email templates and the automations
  tables were readable *and* writable. All now gated on the staff list
  (`public.admins`). Applied to production and verified.
  (`supabase/packs_admin_rls.sql`, `supabase/admin_tables_rls.sql`)
- ✅ **Every booking is readable by any signed-in member.** Fixed 6 Aug
  (`supabase/videography_rls.sql`). Bookings are now admin, or the member the
  booking belongs to; the other five videography tables are admin-only. The
  gallery PIN moved to its own admin-only table, because RLS is row-level and a
  member legitimately reads their own row — leaving the PIN on it would have
  let them read it before paying, which is the one thing the delivery design
  rests on. Original description below.

- ⬜ ~~**Every booking is readable by any signed-in member.**~~ All six videography
  tables (`videography_bookings`, availability, booking flow, deliveries,
  deliverables, promo codes) are still `using (true)` — the same hole we closed
  on packs and contacts. `/account/bookings` filters to "my bookings" **in the
  browser**, so the database isn't enforcing it: drop the filter and you get
  every client's name, email, phone, shoot postcode, amount and signature.
  Fix is different from the others — it's not admin-only, it's *admin **or** the
  member the booking belongs to* (`account_user_id = auth.uid()` or a matching
  `client_email`), with writes left to admins and the Worker. Needs testing
  against `/account/bookings` afterwards. NB the invoicing tables were done
  properly already.

  **This got worse on 5 Aug.** `videography_bookings` now stores Pixieset
  gallery PINs (`gallery_pin`), and the whole delivery design rests on "no PIN
  until paid". With `using (true)` that guarantee does not hold: any signed-in
  member can read every PIN on every booking, paid or not, along with the
  gallery URL and the client email the gallery is gated to — which is the exact
  pair Pixieset asks for at download. Agreed with James to fix at a natural
  break; it should land **before** the automated PIN release goes live, or we
  are protecting a secret that is already readable.
- ⬜ **Every contact-form enquiry is readable by any signed-in member** — same
  hole, found 30 Jul. `supabase/enquiries.sql:63-67` is `for select to
  authenticated using (true)`, so any member can read every enquirer's name,
  email, phone and message. Update at `:69-73` is the same. Should be
  admin-only (`public.is_admin()`), like contacts — nothing member-facing reads
  this table. Worth doing in the same pass as the videography tables above.
- ⬜ **Website inline editor: two security-adjacent items.** Edited wording is
  stored as HTML and re-injected **without sanitising**, and the read policy
  **exposes unpublished drafts to anonymous readers**.
  (`docs/website-editor-setup.md:107-118`)
- ⬜ Same file: published edits are fetched client-side, so heavy edits **flash
  before applying**.
- ✅ **(30 Jul) `contact_dedup_review` was NOT applied — and it was breaking
  every form on the site.** Found while debugging why the contact form created
  no contact. The migration does two things: drops the one-contact-per-email
  rule (`:20-44`) and replaces `upsert_contact` with a version that doesn't
  need it. In production the first half had happened and the second hadn't —
  most likely `contact_tag_rules.sql` was re-run afterwards and redefined the
  function back, which is exactly the ordering its own header warns about. So
  the live function still said "insert, on conflict update" against a
  constraint that no longer existed, and Postgres rejected **every** call:
  `42P10, there is no unique or exclusion constraint matching the ON CONFLICT
  specification`. Newsletter, member signup, videography enquiry/brochure/
  discovery/booking, SMM enquiry/brochure/discovery and the contact form all
  route through that one function, so **nobody had entered the CRM through any
  form** for as long as it had been in that state. Re-running the migration
  fixed it. Two things hid it: the Worker discarded the error, and every form
  reports success to the visitor regardless. Both now addressed —
  `sbRpc` reports failures and `/contact/enquirer` returns what happened.
- ⬜ **Confirm the other migrations were actually run in production** — the same
  class of problem, and one of the five has now proved real rather than
  theoretical: `member_brand_kits`, `email_template_folders`,
  `contact_secondary_email`, `brand_social`. Plus `email_events_automation.sql`,
  or funnel events don't tie back to the automation that sent them. Worth
  checking deliberately rather than waiting for the next silent breakage.
- ⬜ **No record of which migrations have been applied.** `supabase/` is a flat
  folder of hand-run scripts with no ordering and no applied-state tracking, so
  "has this been run?" is unanswerable and re-running an older file can silently
  revert a newer one — which is what happened above. Worth a `schema_migrations`
  table, or numbered filenames at minimum.
- ⬜ **Merging two contacts isn't recorded in the consent audit trail.**
  `merge_contacts()` ORs the two opt-in flags
  (`supabase/contact_dedup_review.sql:170`), so merging a non-consenting contact
  into a consenting one silently flips the survivor to opted-in with nothing in
  `contact_consent_events` to say why. Every other path that changes consent now
  logs (30 Jul). Fix belongs inside the SQL function rather than the Worker,
  which is why it was left. Rare enough not to be urgent — do it next time
  anyone is in that file.
- ⬜ A stub payment path still exists on `/edit`: if Stripe isn't configured,
  checkout fakes a delay and records an unpaid order.
  (`src/pages/edit.astro:2516-2546`)
- ⬜ Instagram auto-posting (reminders v2) not started — blocked on Meta App
  Review. Today it's a manual-posting email.
- ⬜ Two mailers in play: M365 for Studio test-sends, Resend for the calendar
  reminder. Worth settling on one if bulk deliverability matters.
- ⬜ **P&L on the Dashboard's management-only Revenue card.** The Revenue card
  (monthly + YTD + a per-month graph, `src/pages/admin.astro`) shipped
  2026-08-08 with revenue only. Danielle wants profit calculated there too,
  once expenses are tracked somewhere queryable — explicitly deferred until
  everything else on the redesigned Dashboard is finished.
- ⬜ **No hours-capacity tracking for Videography editing or SMM client work.**
  Danielle wants the Dashboard to show, for the current month: hours of
  filming + editing currently in Jack's diary (Videography), and hours of
  work scheduled per social media client (SMM). Filming hours are queryable
  today (`videography_bookings.duration_min`, summed by `shoot_date` in the
  month). Editing hours and SMM per-client hours have **no field to read
  from at all** — `videography_bookings` has no editing-duration column, and
  `smm_leads` has no monthly-hours column. Needs new columns + a decision on
  where that data gets entered (per booking? per client, as a standing
  monthly allocation?) before this can be built. Raised with Danielle
  2026-08-08, not yet resolved.
