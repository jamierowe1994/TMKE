# Videography delivery — execution plan

How a shoot goes from booked to delivered, now that client-facing delivery runs
through Pixieset. Written to be worked through in order.

Last updated 5 August 2026.

---

## The shape of it

| | Where it lives | Who sees it | How long |
|---|---|---|---|
| Client's photos and video | **Pixieset** — `gallery.tmke.co.uk/<gallery-name>` | The client | ~3 months |
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
- **Payment is due within ten calendar days of the invoice date.**
- **Payment is not required until the shoot has taken place.** This must be
  stated on the invoice, or a client reading "due in 10 days" will think they
  are paying for something they have not had.
- **A day after the shoot, if unpaid, a reminder goes out** with the invoice
  attached.

Ten days rather than seven for a practical reason: the invoice goes out two
days before the shoot, and Jack may not finish editing until around day six.
Seven days would ask people to pay before they have seen anything. Ten leaves
room for previews to land first.

The reminder lands on day three of ten, so it is a nudge, not a chase. It
should read that way.

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
- ten calendar days from the invoice date

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

## Gallery expiry

Galleries live at `gallery.tmke.co.uk/<gallery-name>`. Jack creates the gallery
in Pixieset, then pastes that link into the booking so it can be shared.

A week before expiry:

- an automated email from TMKE tells the client their gallery is about to go
- a notice appears in their members hub

After that it is gone, as far as the client is concerned. We still hold the
archive, and if someone asks urgently we can help — but that is not advertised,
and nothing in the client-facing copy should hint at it.

`expiry_warned_at` (see `supabase/videography_gallery_expiry.sql`) makes sure
that warning goes out once rather than every time the check runs.

---

## Open questions

1. **Payment terms are a single global setting.** `payment_terms_days` in
   invoice settings is shared by every invoice we raise, so moving it to ten
   days moves social media management invoices too. Either that is fine, or
   terms need to become per-service. Worth deciding before it is changed.
2. **Where do floor plans actually live?** They need somewhere durable with a
   shareable link. Our existing storage is the obvious candidate, since it is
   already wired up and already holds the archive.
3. **Who sets the download cap?** It varies by package, and property has none.
   Either Jack sets it per booking, or it is derived from the package
   automatically. Deriving it is less to remember and harder to get wrong.
4. **Who sets the expiry date?** Jack can enter it, or we can default it to
   three months from the shoot date and let him correct it. Defaulting means
   one less thing to forget, and a wrong date here means either a warning that
   never fires or one that fires too early.
