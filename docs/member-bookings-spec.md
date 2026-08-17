# Bookings in the member hub — what it needs to hold

Written before the rebuild, so the design answers a known list rather than a
guess. Scope is `/account/bookings`. It covers videography shoots, discovery
calls and studio sessions — every row in `videography_bookings` that belongs to
the signed-in member.

The question the page exists to answer is **"where is my video?"** — without
the member emailing anyone. Everything below either answers that or is a thing
they came here to do.

---

## What the page does today

It is not starting from nothing. Already working:

- Upcoming / Previous split, sorted, with a card per booking.
- A stage label per card (`STAGE_LABEL`), but as a word, not a track.
- A detail panel that slides in.
- Reschedule and cancel, both through the Worker's tokenised routes.
- The T&Cs agreement card, and `signed_name` / `signed_at` once signed.
- Gallery link, gallery email, store link, 360 tour, and the PIN via
  `/videography/my-pin`.

What it does **not** do, and this rebuild is mostly about:

- No stage track — the member sees a word, not a position in a process.
- No documents at all. `booking_documents` exists and the admin centre uploads
  to it; the hub has never read it.
- No correspondence. `booking_messages` is readable by the member at RLS level
  and is not shown.
- No edit requests, though `videography_edit_requests` drives a whole paid flow.
- Not on `ws-system.css` — it is the last hub page still on the old vocabulary.

---

## 1 · The stage track

The database keeps its seven stages — the admin centre's kanban runs on them
and nothing here changes that. The member sees a **shorter track mapped from
them**, because two of the seven are bookkeeping rather than progress:

```
Booked  →  Shoot day  →  Editing  →  Your edits  →  Delivered
                                                    (+ Cancelled)
```

| Database stage | Member sees | Why |
|---|---|---|
| `booked` | Booked | |
| `invoiced` | Booked | Invoicing is its own section and attaches to the booking. It is not a step in getting their video. |
| `shoot_day` | Shoot day | |
| `editing` | Editing | We are cutting it. |
| `gallery_ready` | Your edits | The gallery being up *is* the window in which they ask for changes. |
| `delivered` | Delivered | |
| `cancelled` | Cancelled | Replaces the track rather than sitting in it. |

**Naming, so two different things stay apart:** *Editing* is us cutting the
footage. *Your edits* is their paid twilight / extra-image request. Same word,
opposite actors — the labels have to carry the difference.

Each stage says what it means for them, not just its own name — "Editing: we
have your footage, your gallery follows" beats the word "Editing" alone.

**Dates we can hang off the track**, all already stored:
`created_at`, `shoot_date`, `paid_at`, `pixieset_uploaded_at`,
`gallery_sent_at`, `pin_released_at`, `edits_settled_at`,
`edits_complete_email_sent_at`, `gallery_expires_on`.

---

## 2 · The detail of the booking

Everything here is a column the admin centre already fills.

| Group | Fields |
|---|---|
| What | `service_type`, `package`, `add_ons[]`, `kind`, `duration_min` |
| When | `shoot_date`, `duration_min` |
| Where | `property_address`, `postcode`, `distance_miles`, `fc_office` |
| Who | `client_name`, `client_email`, `client_phone`, `company`, `brand` |
| Cost | `base_pence`, `surcharge_pence`, `discount_pence`, `promo_code`, `total_pence`, VAT (see `orders_vat.sql`) |
| Agreement | `signed_name`, `signed_at` |
| Money state | `paid_at`, `payment_route` |

Travel surcharge should be shown as what it is — a travel charge, with the
mileage — rather than an unexplained line on the total.

---

## 3 · The links — and the paid gate

Four links, and **every one of them is gated on payment**. Until the invoice is
settled the member should see the row, know it exists, and be told plainly what
unlocks it — not find a blank space and wonder.

| Link | Source | Gated |
|---|---|---|
| Gallery | `gallery_url` + `gallery_email` + `gallery_expires_on` | yes |
| 360 tour | `/videography/my-tour` | yes |
| Gallery PIN | `/videography/my-pin` | yes — server-side, already |
| Their edit page | `videography_edit_requests.edits_token` | yes |

The **gallery email** goes with the gallery link, always. Pixieset gates
downloads to that address, so the link without it is a dead end.

**The edit page link** is the one from the "your edits" email — same page, so
they can find it in the hub instead of digging through their inbox. Edit
requests themselves stay on that existing page; this is a link out, not a
rebuild.

### Revealing the PIN

Blurred out by default, with a **Reveal** control — the banking-app gesture. No
password, no second factor; it is a nicety, not a security layer. The actual
security is that `/videography/my-pin` will not return a PIN at all until
`paid_at` is set, and `videography_gallery_pins` is admin-only at RLS. The blur
is over a value the server already agreed to send.

Which means: **before payment there is nothing to blur.** The row shows the
locked state and what clears it. It does not fetch a PIN and hide it.

**Not on this page:** `archive_url` and `archive_folder`. The Cloudflare/R2
archive is internal.

## 4 · The order of the page

One booking, opened, reads top to bottom:

1. **Stage track** — where the shoot is.
2. **Booking detail** — what, when, where, who.
3. **The links** — gallery, tour, PIN, edit page. Gated (§3).
4. **Invoicing** — the invoice and its state, pulled from the documents.
5. **Attachments** — everything else filed against the booking.
6. **Correspondence** — what we have sent them.

Above the list, an **upcoming shoot banner**: days until, where, what was
booked, and the prep document if one is attached.

---

## 5 · Attachments and documents

`booking_documents` already holds these, uploaded from the admin centre, keyed
to `booking_id` + `booking_source`, with `account_user_id` and `client_email`
for ownership. Categories in use:

```
agreement · prep · invoice · delivery · content_plan · insights_report · other
```

`invoice` splits out into its own section above; the rest are attachments.
Files live in R2 under `booking-docs/…`, so downloads go through the Worker
rather than a public URL.

### The agreement attaches itself

If they booked through the website and signed, that agreement should appear as
an attachment without anyone uploading it. We hold `signed_name` and
`signed_at`, and the page already renders the T&Cs — so the document exists in
substance, just not as a file.

Two ways to do it, and this needs a decision at build time:

- **Render it on demand** — the same route that builds the pack receipt
  (`orders/receipt.astro`, added this week) builds a signed agreement PDF from
  `signed_name` / `signed_at` and the clause text. Nothing to store, never out
  of sync, and it works retrospectively for every booking already signed.
- **Write a row at signing time** — a `booking_documents` row with
  `category: agreement`. Simpler to read, but only covers bookings signed from
  now on, and needs a backfill for the rest.

The first is the better fit, and it reuses machinery we now have.

### Member read access — what "via RLS" means

Right now both `/booking/document` routes are admin-gated, so nothing in the
hub can read this table. Two ways to open it up:

- **A Worker endpoint** — a new `/booking/documents/mine` that checks who you
  are and returns your rows.
- **An RLS policy** — a rule stored *in the database itself* saying "a signed-in
  member may select rows where the booking is theirs." Postgres then enforces
  it on every query, so the browser can read the table directly and cannot see
  anyone else's rows even if the page asked for them.

The second is fewer moving parts and it is what `booking_messages` already
does — the same shape, one table over. That is the one to use.

---

## 6 · Correspondence

`booking_messages` already has exactly the right policy:

```sql
using ( channel = 'email' and ( account_user_id = auth.uid()
        or lower(client_email) = lower(auth.jwt() ->> 'email') ) )
```

So the confirmation, the reschedule note, the "your gallery is ready" — the
member can see the trail of what we sent them. `channel = 'note'` is internal
and the database itself refuses it.

---

## 7 · Shoots covered by a social media package

These appear here, alongside paid shoots. Jack works them through the admin
centre identically; the only difference is that the money arrived through the
monthly package rather than an invoice. So the booking is real, the stage track
is real, and the gallery is theirs — but the page must not ask them to pay.

Two kinds:

- **Shot and booked** — a normal booking row, covered by the package.
- **Included but not yet booked** — an entitlement from their marketing plan.
  They still arrange the date with Jack, but the hub should show that it is
  theirs and waiting, rather than saying nothing at all.

An indicator on the card says which — *Included in your package* rather than a
price and a Pay button.

### The gap this opens

**There is no marker in the data for this today.** `payment_route` allows only
`agent_card`, `brand_invoice` and `brand_invoice_teg` — none of which means
"covered by their SMM package". And the whole of §3 gates on `paid_at`.

So either the admin centre sets `paid_at` when a package shoot is booked (which
works immediately and needs no migration, but overloads a field that means
"money landed"), or `payment_route` gains an `smm_package` value and every paid
check becomes `paid_at is not null or payment_route = 'smm_package'`.

The second is the honest one, and the number of places that test `paid_at` is
small enough to change safely. Either way **this must be settled before the
gating is written**, or package clients get locked out of galleries they have
already paid for.

The SMM tab gets its own link through to this page — that is a job for the SMM
section, not this one.

---

## Constraints that must hold

Carried from `docs/member-centre-todo.md` and confirmed against the SQL:

1. **The PIN is released only when `paid_at` is set, server-side.** Nothing in
   this rebuild may weaken it or read the pins table from the browser.
2. **Internal notes never reach the member.** `channel: note` is internal,
   `channel: email` is shareable. Enforced at RLS — keep it that way.
3. **The archive link does not appear in the hub.**
4. **Nothing is released to a client who has not paid their invoice.**

### One thing worth fixing while we are here

`videography_deliverables` — the per-file gallery table — has RLS

```sql
create policy "videography_deliverables authed all" ... to authenticated
  using (true) with check (true);
```

Any logged-in member can read *every* booking's deliverables, and write them.
`videography_rls_fix.sql` intended to replace this with admin-only and lists the
table, so it may already be corrected in the live database — but the permissive
policy is still what a fresh run of the file creates. Worth confirming against
production before this page goes anywhere near that table.

---

## Decisions taken

- Stage track shortened to five, mapped from the seven in the database (§1).
- Every link gated on payment, with a stated locked state (§3).
- PIN blurred behind a Reveal, no password (§3).
- Edit requests link out to the existing page; the hub carries the link (§3).
- Documents opened to members with an RLS policy, not a new endpoint (§5).
- SMM-covered shoots appear on this page with an *Included* indicator (§7).

## Open before build

1. **How an SMM-covered shoot is marked as paid** (§7). Blocking — it decides
   whether package clients can reach their gallery.
2. **Agreement: rendered on demand or stored as a row** (§5). Leaning rendered.
3. **`videography_deliverables` RLS** — confirm production is admin-only before
   this page reads it.
