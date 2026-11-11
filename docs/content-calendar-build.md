# Content Calendar subscription: the build list

From the plan (docs/content-calendar-plan/index.html, Chapters 03 and 04), split
between the two chats that own the files. Started 27 Oct 2026.

- **Admin**: the TMKE Admin Centre chat. Owns src/pages/admin/**, worker/src/index.js, supabase/*.sql.
- **Studio**: the TMKE Design Studio chat. Owns the member Studio, editor, Marketing Planner / Content Calendar and the account pages.
- The Monthly subscription chat keeps the plan document up to date. It doesn't build.

Nothing here is seen by members until Danielle says go. Tick items off as they land, with the date.

## Launch order and testing (Danielle, 11 Nov 2026) — read this first

**Who gets it, and when**
- **December 2026:** The Property Experts and Prestige Property Experts. Their brands pay for the Content Calendar, but agents can **upgrade from day one** to Content Calendar + Scheduling, paying the difference by card. So **Stripe card subscriptions are needed for December** (Danielle, 11 Nov), and so is the scheduling level itself.
- **Done For You launches in January, not December.** In December it's a **waitlist** with limited spaces (we can only do so many), on a page in the same format as the Halloween seasonal page (Danielle, 11 Nov). See the waitlist rows below.
- **January 2027:** The Letting Experts and The Mortgage Experts join.
- **February 2027:** independent agents, by card (Stripe). That gives a two-month buffer.
- Nothing goes live to members until the last week of November, and only when Danielle says so. Before that it has to be tested thoroughly.

**How we test: real ordinary member logins, not Danielle's and not the training account**
- Danielle's login is staff. `memberAccess` gives staff everything, and the month tables are admin-only in the database (`content_months admin` / `content_month_posts admin` policies). So on her login the calendar would look perfect while every real agent saw nothing.
- The training account isn't a login of its own: it reads through Danielle's admin login, so it has the same blind spot.
- Testing must use plain member logins that go through exactly the path a real agent will.

| Done | Item | Who |
|---|---|---|
| | Three real test member logins, non-staff, each with a contact and agent profile: one **The Property Experts**, one **Prestige Property Experts**, one with **no brand** (independent, should see the month blurred). Record them on the test accounts list, not in chat. **Danielle signs these up** (Claude doesn't create accounts): sign up at the Hub with each email, give the contact its agent profile in People, then add the email under Content calendar › Overview › Launch, which refuses staff logins and shows what each one sees. | Danielle / Admin |
| 11 Nov | **Test allow-list** in `memberAccess`: a short server-side list of test user ids that get the `calendar` level, with `source: "test"`. Nobody else changes. Removed when the real rule below goes live. Built as `content_calendar_settings.test_user_ids` (supabase/content_calendar_launch.sql, on the SQL list), edited under Overview › Launch. A test login is treated as if the December rule were on: a TPE/PPE login gets `calendar` with `source: "test"`; the no-brand login stays Free and sees the month blurred. `/access/me` also returns `test: true`. | Admin |
| 11 Nov (brand part) | **The December rule** in `memberAccess`, switched off until launch: agents whose brand is TPE or PPE (edition `property` / `prestige`) get `calendar`, `source: "teg"`. One switch to turn it on. An agent with a paid upgrade gets that level instead (`scheduling`; `done_for_you` from January), from their Stripe subscription. Brand part built: `content_calendar_settings.teg_live`, off; the switch is Overview › Launch › The December rule (asks before switching on). The upgrade part comes with the Stripe row below. | Admin |
| 11 Nov (built; needs member_subscriptions.sql and the test webhook) | **Stripe upgrades for TEG agents, needed for December:** card subscriptions for the difference only (TEG sees +£15 for scheduling, launch offer +£12; the Done For You difference from January), billed on the 1st with VAT (full month on joining, see Decided); failed payment twice → back to the brand-paid calendar; cancel runs to the end of the paid month; webhooks change access straight away and call `zernioDisconnectMember` on any cancellation or suspension. Brings Phase 2's Stripe rows forward. **Built 11 Nov (Admin):** tables `member_billing`, `member_subscriptions` (price kept as it started), `member_level_log` (every change of level) in supabase/member_subscriptions.sql. Test logins pay in Stripe's test mode (`STRIPE_TEST_SECRET_KEY`, with a test clock each), everyone else live. Prices are stand-ins in one place: Overview's TEG price for Scheduling, and `CC_LAUNCH_OFFER` in the Worker (£12 for upgrades before 1 March 2027, kept while subscribed; someone who cancels and comes back after that pays £15). Checkout charges this month in full as a one-off line and anchors the subscription on the next 1st (`proration_behavior: none`), VAT added at Invoicing's rate. `memberAccess` gives `scheduling` on top of the brand-paid calendar and returns `upgrade { level, status, renews_on | ends_on }`; `zernioMemberMayPost` and every scheduling route read it. Webhooks: live `/stripe/webhook` (needs `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed` added to the live endpoint before launch) and `/stripe/webhook-test` (`STRIPE_TEST_WEBHOOK_SECRET`). Second failed payment ends it straight away; ending calls `zernioDisconnectMember`. **For the account page (Studio):** `GET /billing/me` → `{ level, source, upgrade, offer { name, price_pence, vat_rate, total_pence, standard_pence, launch_offer, offer_until, billed } | null, why_not }` · `POST /billing/upgrade { level: "scheduling", return_to }` → `{ url }` (send them there; they come back with `?upgrade=done` or `?upgrade=cancelled`) · `POST /billing/cancel` / `POST /billing/resume` → `{ upgrade }` · `POST /billing/card { return_to }` → `{ url }`, Stripe's own page to change the card (Stripe's customer portal has to be saved once in each mode). Staff can try it now from Overview › Launch: Try the upgrade, Cancel, Jump to the 1st. | Admin |
| 11 Nov (route and switch) | **Members can't read the month tables yet.** `src/lib/calendar-month.js` reads `content_months` and `content_month_posts` straight from Supabase, and RLS lets only admins in. Add a Worker route (e.g. `GET /calendar/month?month=YYYY-MM`) that runs `memberAccess`, checks the month is inside their `library`, and returns the published month and posts for their edition. Studio switches `calendar-month.js` to it. Keeps "access decided on the server". **Routes live (11 Nov), GET with the member's Bearer token:** `/calendar/month?month=YYYY-MM[&edition=]` → `{ access, preview, month, editions, posts[] with template {id,name,thumb_url} }` (a member without the calendar gets this month and next as a preview: date, title, type, pillar and picture only; `month: null` when there's nothing for them) · `/calendar/months?from=YYYY-MM[&edition=]` → `{ months }` one per month with `cover` · `/calendar/post?id=` → `{ post }` with its `month` (replaces `loadPost`) · `/calendar/templates?month_id=` → `{ posts, templates }` whole designs (replaces `loadMonthTemplates`) · `/calendar/template?id=` → `{ template }`, only if it's on a post in a month they may open (replaces `fetchTemplateRow` for `?ccpost=`). Staff can add `&as=<level>`. **Studio switched 11 Nov (fbfe0f1):** `calendar-month.js` reads every one of these through the Worker, staff included, so staff see what a member would; `?as=` on the page passes through. Only if the Worker can't be reached does a staff login fall back to reading the tables itself; a member then sees nothing, as before. `?ccpost=` opens its design through `/calendar/template`. | Admin (route) / Studio (switch) |
| | Check the month's templates and their thumbnails load for a non-staff login (calendar templates are kept out of Templates and packs; make sure members can still open the ones in their month). **Found 11 Nov:** members can't read them straight from Supabase. Calendar designs are `status: draft` with no pack, and the `templates read active` policy only shows members active designs in a pack they can see. So the Studio must read designs through `/calendar/templates` and `/calendar/template`, not `supabase.from("templates")`. Pictures inside the designs still to check on a test login once the Studio has switched. | Admin / Studio |
| | **The Mortgage Experts** gets its own edition (its own posts and its own branding, Danielle 11 Nov). Not needed until January; set it up in December when the branding is ready: add it to `ACCESS_EDITION_OF_BRAND` and the month builder's editions. | Admin (December) |

**What the test logins need to be able to do before launch (member side, Studio)**

| Done | Item | Who |
|---|---|---|
| 11 Nov (built; check on a test login) | Month view and post pop-out for a non-staff member with `calendar` (built 28 Oct, staff-only so far). Reads through the Worker since 11 Nov, so nothing in the page is staff-only now. | Studio |
| 11 Nov (built; check on the no-brand login) | The month blurred for a member without it, "Subscribe to use December's posts". As the plan's demo: they open on their own calendar, the month pulls across blurred, posts can't be opened, and a card says "Subscribe to use December's posts" / "A ready-made post for every weekday, on its day, to brand and post." **No button yet:** the demo's "See the plans" has nowhere to go until the account page can subscribe (Phase 2). Staff can see it with `?as=free` on the planner. **Who sees it (Admin, 11 Nov):** as agreed, "Subscribe to use December's posts" for a member without the calendar, but only once launched: `/access/me` returns `preview` when the December rule is on, and before that for test logins and staff only, so publishing a month early shows nobody. No "Coming soon" (Danielle, 11 Nov: not needed; the `coming_soon` flag is gone). Test logins also see months still in draft, so an unfinished month can be tried without publishing. | Studio |
| 11 Nov (built; check on a test login) | Use This Template → the Studio → save → it lands on their calendar as Planned, marked On your calendar. Through Plan It (next row), not on save by itself, so the caption and date checks always run. The planned post carries `details.cc_post_id` and `details.cc_month`; the month's grid then marks that post **On your calendar**, and its pop-out says "On your calendar for Monday 1 December." The design keeps its post id on its first page (`canvas.ccPost`), so a saved copy reopened later still plans as that post. | Studio |
| 11 Nov (built; check on a test login) | Plan It: Add to Planner, the three caption choices, warnings for unfilled brackets and for moving a dated post. In the Studio's Plan this post: the post's title and date, Caption 1 / 2 / 3 with {tags} filled from the brand kit, then before it goes on: "Your caption still has [street] to fill in." and "This post is for Bonfire Night, on 5 November. Are you sure you want to post it on another day?", on linen, with Plan it anyway. Add to Planner & Schedule comes with scheduling. | Studio |
| 11 Nov (switched; check on a test login) | The month's pack in their Studio, How to edit and the caption at the top of Start (built 28 Oct; check on a member login). Reads through `/calendar/months` and `/calendar/templates` since 11 Nov. | Studio |
| | Training, onboarding walkthrough, What's New entry, ready to switch on at launch | Studio |

| | **Upgrade on the account page** for TEG agents: shows only the difference in price, takes the card through Stripe, and the new level shows straight away (Phase 2's account page row, brought forward) | Studio |
| | **Scheduling for upgraded members** (Phase 4, brought forward): connect Instagram and Facebook, schedule from the calendar, Planned / Scheduled / Posted / Failed; `zernioMemberMayPost` reads their level; Post it for me locked for everyone else | Admin / Studio |
| 11 Nov (built, held) | **Done For You waitlist page** for December, in the same format as the Halloween seasonal page (`src/pages/seasonal/[slug].astro`, one entry in `src/data/seasonal.js`, the Insights-style sideways scroll with the board that turns over to a sign-up). The sign-up joins a waitlist, not an account. **10 spaces**, and the page says spaces are limited, which is why there's a waitlist. **December: TEG agents only.** The same waitlist is used again when independent agents open in February. **Built 11 Nov:** `/waitlist/done-for-you` (unlinked, noindex), copy and stand-in prices in `src/data/dfy-waitlist.js`; the eight bottom tiles to be swapped for December template mock-ups Danielle picks. **Held (Danielle, 11 Nov): not pushed out or tested with sign-ups until the Content Calendar admin suite is built, because there's nowhere yet for the waitlist to sit in the admin centre.** | Website |
| 11 Nov (built) | **What the waitlist page covers:** the price, shown as the **RRP and then their price**, so a TEG agent sees the discount they're getting (TEG see the difference only). **Prices aren't agreed yet (Danielle, 11 Nov): use a clearly marked stand-in, `[RRP £—]` / `[TEG price £—]`, kept in one place so the real figures drop in; the page doesn't go out until they're set.** That Done For You is an extra tier of the subscription; what else that tier includes (scheduling, the full library, advanced training and masterclasses, seasonal Edit packs, event discounts); and the **two ways to have it**: (1) **the Done For You subscription**, paid monthly, with everything above; (2) **added on when each month's calendar is released**, without the tier: the branded posts only, so no scheduling, higher training and the rest unless they're on the Scheduling level. Copy through the tmke-copywriter agent. | Website (copy: copywriter) |
| 11 Nov (needs dfy_waitlist.sql) | **Waitlist behind it:** sign-ups saved with name, email, brand, which option they want; a count against the number of spaces; a confirmation email; a list in the admin centre so we can invite people in order for January. **Built:** table `dfy_waitlist` (supabase/dfy_waitlist.sql, run after content_calendar_launch.sql); spaces (10), who can join (`teg` now, `all` from February) and an on/off for sign-ups in `content_calendar_settings`, changed under Content calendar › Overview › Done For You waitlist, which lists everyone in order with Agent found / Not found and a status (Waiting, Invited, Joined, Removed). Past the spaces people go on a reserve list in order. Confirmation email from hello@tmke.co.uk (copy by tmke-copywriter; one version for a space, one for the reserve list; no prices). **For the page (Website):** `GET /dfy/waitlist/status` → `{ ready, open, audience, spaces, taken, left, brands[], options{subscription, add_on} }` (public). `POST /dfy/waitlist` with `{ name, email, brand, option: "subscription" | "add_on", turnstile_token, hp, source }` → `{ ok, place, spaces, reserve }`, or `{ ok, already: true, place }` if that email is already on it; `brand` must be one of `brands` (December: "The Property Experts" or "Prestige Property Experts"). While sign-ups are off it answers 403 "The waitlist isn't open yet." except for a test login's email or a signed-in staff/test Bearer token, so the page can be tried. | Admin |
| | **Done For You for members** (Phase 5): the monthly queue for staff, and the member's swap / approve / ask for changes. **January.** | Admin / Studio |

**Test pass, on each test login:** opens on December's posts (or blurred, for the no-brand login) · pop-out shows pillar, how to edit, caption · Use This Template opens the Studio in their brand kit · save lands on their calendar as Planned · Plan It warnings fire · nothing staff-only shows · the other brand's edition doesn't show · Post it for me is locked on the Content Calendar level · upgrading with a Stripe test card shows only the difference, then unlocks scheduling straight away · the Done For You waitlist page takes a sign-up and it shows in the admin list · a failed test payment drops them back to the brand-paid calendar · cancelling keeps the upgrade to the end of the paid month.

## How the two halves meet

Admin builds these first, so Studio builds against something real.

1. **The month tables**: `content_months` (month, brand set, status draft/published) and `content_month_posts` (date, tied to the day or not, type, content pillar, caption, how to edit, reel prompt, platforms, template id). Studio reads only published months.
2. **One access check**: a Worker route, `/access/me`, that says what a member gets: calendar months, library reach, scheduling, Done For You, course levels. It's worked out on the server from either source: a TEG brand paying for them, or their own card. Studio never decides access in the browser.

### What `/access/me` returns

GET with the member's Bearer token:

```
{ ok, level: "free" | "calendar" | "scheduling" | "done_for_you",
  staff, teg, edition, editions,      // edition = which month's posts: property | prestige | lettings | independent
  source: "staff" | "none" (later "teg" | "card"),
  calendar, preview,                  // preview = free member: show the month blurred
  library: { from, to } | null,       // months they can open, inclusive; from null = every month
  scheduling, done_for_you,
  course_levels: [...] }              // the guides.level values they can open
```

Staff can add `?as=free` (or any level) to see the hub as that level.

## Phase 1: now, hidden from members

| Done | Item | Who |
|---|---|---|
| 27 Oct | Month tables and their SQL (above): supabase/content_calendar_months.sql, run 28 Oct | Admin |
| 27 Oct | Month builder in the admin centre (Design studio › Content calendar): a sheet per month of about 20 posts, each linked to a template the way a pack is; draft then publish, like Trending Month; built months ahead | Admin |
| 27 Oct | Content Calendar tab in the admin Design studio, beside Templates and Print, for each month's templates (built in the demo agency's name, so unbranded) | Admin |
| 27 Oct | A level on every course in the course editor (Guides), set to Free for now | Admin |
| 27 Oct | `/access/me`: everyone Free for now; staff get everything, or any level with `?as=calendar` | Admin |
| 29 Oct | Overview tab (Admin › Content calendar): the four levels, prices and what each opens, in `content_levels` (supabase/content_calendar_levels.sql); `/access/me` reads it | Admin |
| 28 Oct | Content Calendar month view reading a published month: our post on each weekday, full size in its day (staff only) | Studio |
| 28 Oct | Post pop-out: full size, content pillar, how to edit, caption, Use This Template | Studio |
| 28 Oct | The month as its own pack in the Studio; How to edit and the caption at the top of the Start panel | Studio |

## Phase 2: once prices are set

| Done | Item | Who |
|---|---|---|
| | Stripe card subscriptions: one billing date, VAT added, two attempts on a failed payment then suspended, cancel runs to the end of the paid month | Admin |
| | Stripe webhooks change access straight away; every cancellation or suspension calls `zernioDisconnectMember` | Admin |
| | Subscribers in the CRM: level, a log of every change, give or remove access by hand | Admin |
| | TEG monthly review in TEG Sync: active agents per brand, changes since last month, an invoice per brand, leavers lose access | Admin |
| | Account page: subscribe, upgrade, downgrade, cancel, update the card ("Coming soon" until launch) | Studio |

## Phase 3: the first paid month

| Done | Item | Who |
|---|---|---|
| | The month blurred for free members, "Subscribe to use November's posts" | Studio |
| | Planning a post: Add to Planner, three caption choices, warnings for unfilled brackets and for moving a dated post | Studio |
| | Library rules: past months by level, never before the month they joined | Admin (rule) / Studio (view) |
| | Course level labels and one-off unlocks for members | Studio |
| | Emails: payment failed, access changed | Admin |
| | Training, onboarding walkthrough, What's New entry | Studio |

## Phase 4: scheduling

| Done | Item | Who |
|---|---|---|
| | Status back from Zernio (posted / failed) by webhook | Admin |
| | `zernioMemberMayPost` reads the member's level or the TEG add-on | Admin |
| | Connect Instagram and Facebook, schedule from the calendar, Planned / Scheduled / Posted / Failed, Reel upload; Post it for me shown locked below the level | Studio |
| | 4:5 version of posts if Instagram needs it | Studio |

## Phase 5: Done For You and the library

| Done | Item | Who |
|---|---|---|
| | Done For You queue: each client's ten posts, to do to approved; a staff-only login opening each with the client's brand kit | Admin |
| | Member side: swap posts before the cut-off, approve or ask for changes | Studio |
| | Brand It For Me orders and single course unlocks through the existing Stripe checkout | Admin (payment) / Studio (button) |
| | Emails: posts ready to review | Admin |

## Waiting on Danielle

- Done For You prices (RRP and TEG price) for both options: the tier, and adding it on to a month. To agree 12 Nov. Decided 11 Nov: 10 spaces, TEG see the difference only, TEG-only in December, the waitlist reused for independents from February.

- Prices for each level (Phase 2 can't start without them).
- TEG: whether brands confirm the count before invoicing.

## Decided

- **Billing date (Danielle, 11 Nov):** everyone is billed on the 1st, for that calendar month. Someone who joins mid-month pays the full month's price on the day they join (that month's posts are all there at once), then on the 1st from the next month. No part-month (pro-rata) prices. Cancelling runs to the end of the paid month. In Stripe: charge the first month in full on joining, then `billing_cycle_anchor` on the next 1st with `proration_behavior: none`. Applies to the Scheduling difference for TEG agents in December too.
- **The +£12 launch offer (Danielle, 11 Nov):** a TEG agent who upgrades to Scheduling in the first three months it's live (December 2026, January and February 2027) pays +£12 a month, and it stays at £12. Anyone upgrading from 1 March 2027 pays +£15. Read as: the £12 is kept for as long as they stay subscribed; still to confirm whether it's kept if they cancel and come back later. In Stripe: two prices, and the subscription keeps the one it started on.
- Done For You: who chooses the ten posts, who schedules them.
