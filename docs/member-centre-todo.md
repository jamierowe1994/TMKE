# Member centre — what still needs building

The running list for `/account`. Raised 14 August 2026. Newest sections at the
bottom; tick things off here rather than in a chat thread.

---

## 1 · Bookings — show the member where their shoot actually is

**Today:** `/account/bookings` lists a booking and its raw `stage`. The member
can see *that* they booked something, not what is happening to it.

**Wanted:** the booking page mirrors the admin centre's stage flow, so a client
can answer "where is my video?" without emailing anyone.

- A visible stage track: **Booked → Invoiced → Shoot day → Editing → Gallery
  ready → Sent → Delivered**, with the current stage marked and the ones
  behind it settled.
- When a gallery exists, the member follows the link straight through from
  here — gallery URL, which email address to use with it, and the PIN once
  payment has landed.
- Pulls the detail the admin centre already holds: shoot date and address,
  what was booked, the expiry date on the gallery.

**Constraints that already exist and must hold:**

- The PIN is released **only** when `paid_at` is set, checked server-side.
  Nothing about this display may weaken that.
- Internal notes are `channel: note` and must never reach the member view.
  Correspondence is `channel: email` and may.
- The Cloudflare/R2 archive link is internal. It does not appear in the hub.

## 2 · Social media management clients

Three gaps for members on an SMM retainer.

### 2a · Invoices

Let an SMM client see and pay their own invoices.

**Blocker:** `public.invoices` currently carries an admin policy only —
`for all to authenticated using (is_admin())`. A member cannot read their own
row. Needs a decision:

- a narrow RLS policy scoped to the member's own invoices, **or**
- a Worker endpoint using the service role that returns only that member's
  invoices.

The second keeps the table shut and is easier to reason about; the first is
less code. Either way it is a deliberate widening of what members can read and
wants signing off, not slipping in.

Once it exists, the dashboard's rotating hero stat should read from it too —
it currently infers "payment due" from `videography_bookings.paid_at`, which
covers shoots only.

### 2b · Monthly reports

Somewhere for the client to read the monthly report we already produce. See
`docs/smm-report-rules.md` and `src/lib/report-fields.js` for what the report
holds today.

### 2c · Contact their account manager

A direct line from the hub, rather than the generic contact form — so the
message arrives attached to their account and the right person gets it.

---

## 3 · Starter ideas — the parts still to do

The quiet-week starter row ships automatic: `src/data/content-calendar.js`
holds UK dated hooks already turned into estate agency angles, resolved in the
browser so they are right on the day someone opens the page rather than on the
day we last deployed. Nobody has to load next month's dates.

Two things it does not yet do.

**Carry the idea into the editor.** "Design this post" opens
`/account/editor` with nothing pre-filled. The editor reads `?template=` and
`?schedule=` and would need a third parameter to seed a title or caption from
the angle. Deliberately not faked with a parameter that does nothing.

**Let a person override it.** Everything is currently code. An admin surface
would want to: add or edit a dated hook without a deploy, pin one for a given
week, and suppress one. That is a table plus a tab, and it is only worth
building once the automatic version has been watched for a month — most of
these entries will not want touching.

## 4 · Editor — corrected

An earlier version of this file claimed two editor faults. Both were wrong and
have been removed. The cause: the editor's engine is `public/scripts/editor.js`,
loaded with `<script src>`, and the search that produced those claims only
covered `src/`. Half the code was never read.

For the record, both work:

- `window.__TMKE_LOAD_BLANK__` is defined at `public/scripts/editor.js:7285`, so
  the launcher's blank-canvas size chooser applies the size picked.
- `?template=<id>` is read at line 7301 and loads that template
  (`loadTemplate`). `/account/editor?template=tmpl-01` opens "Just Listed — 01"
  with its ten elements on the canvas — so the dashboard's "Continue with this
  pack" card has been working all along.

The lesson worth keeping: `editor.astro` reads `mode`, `pack`, `schedule`,
`design` and `id`; the engine separately reads `template`, `design` and `mode`.
Grepping the `.astro` file alone tells you less than half of what the editor
honours.

**Still genuinely outstanding.** "Design this post" opens a blank Instagram
portrait via `?blank=1`, but the idea and its hint are not carried across. When
the in-canvas brief is built, add a parameter and read it in the engine. And the
"Reels that actually get watched" guide does not exist yet — its card points at
the guides index until it does.

## 5 · The design gallery

`/account/editor` with no parameters used to be "Start a Design" — three entry
cards, your packs, twelve of your designs. All of it except the blank-canvas
card was something Studio already does, and Studio does it better, so it was a
click between wanting to design and designing.

It is now one thing: **every design you have made**, newest first, with search.
Studio's "See All Designs" points here, as it always did.

What stayed and why:

- The packs grid and the pack-designs view are still in the DOM, hidden.
  `/account/editor?pack=<id>` — which is what Studio's pack shelf links to —
  renders the pack list into that grid before opening the pack, and it is the
  "All packs" target when you go back from one. Deleting the section would
  have broken the shelf.
- The blank-canvas size chooser is now unreachable: nothing links to it since
  the entry cards went. It is harmless, and the editor's own resize (presets
  and custom, both wired) does the same job once you are on a canvas. Worth
  removing on the next pass through this file.

Still to do here: the page has not been brought onto ws-system.css. It uses its
own `ed-ob-*` styling and does not match the dashboard or Studio yet.

## Notes

- The dashboard's "New in The Studio" row is **placeholder copy and images**.
  The links go to real pages but nothing fetches those four items. If it should
  list real packs and guides, that is a separate piece of work.
