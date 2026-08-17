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

Seven stages, from the CHECK constraint on `videography_bookings.stage`:

```
booked → invoiced → shoot_day → editing → gallery_ready → delivered
                                                          (+ cancelled)
```

The current stage is marked; the ones behind it read as settled; the ones ahead
are dim. `cancelled` replaces the track rather than sitting in it.

Each stage should say what it *means for them*, not just name itself — "Editing:
we have your footage, your gallery follows" beats the word "Editing" alone.

**Dates we can hang off the track**, all already stored:
`created_at`, `shoot_date`, `paid_at`, `pixieset_uploaded_at`,
`gallery_sent_at`, `pin_released_at`, `archived_at`, `gallery_expires_on`.

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

## 3 · The links

The reason this section exists. Each appears only when its column is set.

- **Gallery** — `gallery_url`, plus `gallery_email` (the address Pixieset gates
  downloads to; useless without it) and `gallery_expires_on`.
- **The PIN** — never from the table. `videography_gallery_pins` is admin-only
  at RLS and must stay that way. The hub asks `/videography/my-pin`, which
  releases only when `paid_at` is set.
- **360 tour** — `/videography/my-tour`.
- **Store** — `store_url`, for buying extra downloads.
- **Floorplan** — `floorplan_url`.
- **Anything else** — `extra_link_label` / `extra_link_url`.
- **Edit requests** — `/videography/edit-request`, the paid twilight/extra-image
  flow. Show its status (`pending` / `paid` / `notified`) if one exists.

**Not on this page:** `archive_url` and `archive_folder`. The Cloudflare/R2
archive is internal.

---

## 4 · Attachments and documents

`booking_documents` already holds these, uploaded from the admin centre, keyed
to `booking_id` + `booking_source`, with `account_user_id` and `client_email`
for ownership. Categories in use:

```
agreement · prep · invoice · delivery · content_plan · insights_report · other
```

The member should see their agreement, prep notes, invoices and delivery notes
against the booking they belong to. Files live in R2 under `booking-docs/…`, so
downloads go through the Worker rather than a public URL.

**Open point — needs a decision before build:** the upload and delete routes are
admin-gated, and I have not found a member-side read route. Either
`booking_documents` needs a "read own" RLS policy in the shape
`booking_messages` already uses, or the Worker needs a `/booking/documents/mine`.
The RLS route is the smaller change and matches the existing precedent.

---

## 5 · Correspondence

`booking_messages` already has exactly the right policy:

```sql
using ( channel = 'email' and ( account_user_id = auth.uid()
        or lower(client_email) = lower(auth.jwt() ->> 'email') ) )
```

So the confirmation, the reschedule note, the "your gallery is ready" — the
member can see the trail of what we sent them. `channel = 'note'` is internal
and the database itself refuses it; the page does not need to filter, but it
should not select columns as though it might.

---

## 6 · Upcoming

The current split is by date-or-terminal-stage. Worth sharpening:

- A next-shoot banner: how many days, where, what was booked, what to prepare.
- Reschedule and cancel on the upcoming one, as now.
- The prep document, if one is attached, surfaced here rather than buried.

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

## Still to confirm with James

- **SMM bookings.** `booking_documents.booking_source` allows `smm`, and the
  todo has a separate SMM section. Does this page show SMM alongside shoots, or
  do they stay apart?
- **Documents route** — RLS policy or Worker endpoint (see §4).
- **Edit requests** — full flow on this page, or a link out to the existing one?
