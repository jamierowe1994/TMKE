# Content Calendar subscription: the build list

From the plan (docs/content-calendar-plan/index.html, Chapters 03 and 04), split
between the two chats that own the files. Started 27 Oct 2026.

- **Admin**: the TMKE Admin Centre chat. Owns src/pages/admin/**, worker/src/index.js, supabase/*.sql.
- **Studio**: the TMKE Design Studio chat. Owns the member Studio, editor, Marketing Planner / Content Calendar and the account pages.
- The Monthly subscription chat keeps the plan document up to date. It doesn't build.

Nothing here is seen by members until Danielle says go. Tick items off as they land, with the date.

## How the two halves meet

Admin builds these first, so Studio builds against something real.

1. **The month tables**: `content_months` (month, brand set, status draft/published) and `content_month_posts` (date, tied to the day or not, type, content pillar, caption, how to edit, reel prompt, platforms, template id). Studio reads only published months.
2. **One access check**: a Worker route, `/access/me`, that says what a member gets: calendar months, library reach, scheduling, Done For You, course levels. It's worked out on the server from either source: a TEG brand paying for them, or their own card. Studio never decides access in the browser.

## Phase 1: now, hidden from members

| Done | Item | Who |
|---|---|---|
| | Month tables and their SQL (above) | Admin |
| | Month builder in the admin centre: a sheet per month of about 20 posts, each linked to a template the way a pack is; draft then publish, like Trending Month; built months ahead | Admin |
| | Content Calendar tab in the admin Design studio, beside Templates and Print, for each month's templates (built in the demo agency's name, so unbranded) | Admin |
| | A level on every course in the course editor, set to Free for now | Admin |
| | `/access/me`: everyone Free for now; staff can be given a level to test with | Admin |
| | Content Calendar month view reading a published month: our post on each weekday, full size in its day (staff only) | Studio |
| | Post pop-out: full size, content pillar, how to edit, caption, Use This Template | Studio |
| | The month as its own pack in the Studio; How to edit and the caption at the top of the Start panel | Studio |

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

- Prices for each level (Phase 2 can't start without them).
- TEG: the billing date, how mid-month joiners and leavers are handled, whether brands confirm the count before invoicing.
- Done For You: who chooses the ten posts, who schedules them.
