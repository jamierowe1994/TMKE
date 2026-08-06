# Videography delivery — execution plan

How a shoot goes from booked to delivered, now that client-facing delivery runs
through Pixieset. Written to be worked through in order.

Last updated 5 August 2026.

---

## The shape of it

| | Where it lives | Who sees it | How long |
|---|---|---|---|
| Client's photos and video | **Pixieset** | The client | ~3 months |
| Our copy of everything | **Our own storage** | The team | Indefinitely |
| Floor plans | **Separate — Pixieset can't hold them** | The client, by link | Indefinitely |

Jack uploads **twice**: once to Pixieset for the client, once to our archive. The
second one is not optional — Pixieset expires, and the team needs this content
for promotional use long afterwards.

---

## The money, and the PIN

Payment and delivery are joined by one rule:

> **No PIN until payment has been received.**

The gallery is visible but watermarked and locked. Paying releases the PIN.

- **Invoice goes out two days before the shoot.**
- **Payment is due within seven days of the invoice date.**
- **Payment is not required until the shoot has taken place.** This must be
  stated on the invoice, or a client reading "due in 7 days" will think they
  are paying for something they have not had.
- **A day after the shoot, if unpaid, a reminder goes out** with the invoice
  attached.

Note the reminder lands on roughly day three of a seven-day term, so it is a
nudge, not a chase. It should read that way.

Two payment routes, one signal. Agents pay by card at booking; brands (F&C,
TPE) are invoiced. Either way what matters downstream is a single `paid_at`
flag — the PIN release keys off that and does not care how the money arrived.

---

## Phase 1 — Jack's fields *(blocking him; do first)*

**Run** `supabase/videography_pixieset.sql`. Additive only.

Then add a **Delivery** section to the booking modal:

- Pixieset gallery URL
- Gallery PIN
- Client email the gallery is gated to
- Store URL
- Floor plan link
- Download cap (blank = uncapped)
- "Archive copy uploaded" tick → sets `archived_at`

**Done when:** Jack can finish a job without leaving the admin centre, and the
PIN is stored but shown nowhere client-facing.

---

## Phase 2 — the pipeline stages are wrong

Today: `booked → shoot_day → editing → final_draft → invoice_out → complete`.

`invoice_out` sits after editing, but invoicing now happens **before** the
shoot. Left alone, every job will misreport. Needs reordering to roughly:

`booked → invoiced → shoot_day → editing → gallery_ready → delivered`

Payment is **not** a stage — it can land at several points. It stays a flag.

**Done when:** the board reflects what is actually true of a job.

---

## Phase 3 — invoice wording

The invoice must say, plainly:

- payment is not required until the shoot has taken place
- content cannot be downloaded until payment is received
- seven days from the invoice date

**Done when:** a client can read the invoice and predict exactly what happens.

---

## Phase 4 — automate the release

1. Payment recorded → `paid_at` set (card route already does this via Stripe;
   the invoice route now has the same signal).
2. `paid_at` set → PIN email fires automatically.
3. Day after shoot, still unpaid → reminder with invoice attached, once only
   (`reminder_sent_at` guards against repeats).

**Done when:** nobody has to remember to send a PIN.

---

## Phase 5 — members hub

Per shoot: gallery link, store link, floor plan link, and the **PIN once paid**.
Before payment the hub shows the gallery and what is outstanding — never the
PIN.

---

## Open questions

1. **Which email does Pixieset gate downloads to?** Currently believed to be
   `info@themarketingexperts.co.uk`. If that is the gate on client galleries
   rather than the account address, then every client downloads as us — and
   both the per-client cap and the "stop someone else using their downloads"
   goal stop working. Worth confirming on a live gallery before Phase 1 fields
   are trusted.
2. **What happens at three months?** Client access disappears when the Pixieset
   gallery expires. We will still hold the archive, but there is no
   client-facing route back to it. Do we warn them beforehand, re-share on
   request, or is expiry simply the end of it?
3. **Where do floor plans actually live?** They need somewhere durable with a
   shareable link. Our existing storage is the obvious candidate, since it is
   already wired up and already holds the archive.
4. **Who sets the download cap?** It varies by package, and property has none.
   Either Jack sets it per booking, or it is derived from the package
   automatically. Deriving it is less to remember and harder to get wrong.
