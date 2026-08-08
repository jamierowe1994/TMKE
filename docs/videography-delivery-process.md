# Videography delivery — execution plan

How a shoot goes from booked to delivered, now that client-facing delivery runs
through Pixieset. Written to be worked through in order.

Last updated 5 August 2026.

---

## The process, end to end

James's workflow, 7 August. This is the spec; everything below it is detail.

| # | Step | Where | Built |
|---|---|---|---|
| 1 | Booking added — online or manual | Admin | ✅ |
| 2 | F&C: office confirms the marketing fee is held | Admin | ✅ blocks the invoice |
| 3 | Invoice raised, two days before the shoot | Admin | ✅ raised by hand |
| 4 | Shoot day | Off app | ✅ stage auto-advances |
| 5 | **Payment reminder, day after the shoot, if still unpaid** | Auto | ❌ needs a scheduler |
| 6 | Editing | Off app | ✅ |
| 7 | Content uploaded to the archive (Cloudflare) | Admin | ✅ |
| 8 | Pixieset upload | Off app | ✅ |
| 9 | Links, expiry date and PIN added | Admin | ✅ |
| 10 | **Paid:** links + PIN + edit process | Auto | ✅ |
| 11 | **Unpaid:** links + invoice + payment prompt, no PIN | Auto | ✅ |
| 12 | Unpaid, then pays: PIN follows in a second email | Auto | ✅ |
| 13 | **Hub shows the links when the email goes** | Hub | ❌ |
| 14 | **Hub reveals the PIN when payment lands** | Hub | ❌ |
| 15 | Edits confirmed | Admin | ✅ |
| 16 | Delivery complete | Admin | ✅ needs paid + edits settled |
| 17 | **Expiry warning, a week before Pixieset drops it** | Auto | ❌ needs a scheduler |

Remaining gaps, in the order they are worth doing:

1. **The members hub (13, 14).** Two states of one screen: links on send, PIN
   on payment.
2. **The two scheduled emails (5, 17).** Both need something running daily,
   which is a different kind of build to everything so far - nothing else here
   runs without a person pressing something.

Step 12 fires from the Stripe webhook when a card payment lands, and from Mark
paid when it arrives by bank transfer. It only sends when the client already
has the gallery without the PIN, so it can never duplicate the gallery-ready
email, and `pin_released_at` stops it sending twice.

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

### How a client actually downloads

Pixieset asks for **their email address and the PIN**. The email is whatever was
entered when the gallery was created, so only that person can download.

That restriction exists to protect the download allowance. A cap counts every
download regardless of who made it — so if someone from our team or the group
marketing team pulls ten photos, they have spent the client's allowance, not
ours.

**This makes `gallery_email` a correctness constraint, not a note.** The PIN
must be emailed to the same address the gallery was created with. Send it
anywhere else and the client cannot download — and we would never find out,
because the failure happens inside Pixieset. So:

- the PIN email goes to `gallery_email`, not to whatever else is on the booking
- if `gallery_email` differs from the booking's client email, the admin says so
  before saving. Sometimes it is deliberate; it should never be accidental.

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
- Client email the gallery was created with (what they will type to download)
- Store URL
- Floor plan link
- Download cap (blank = uncapped)
- "Archive copy uploaded" tick → sets `archived_at`

**Done when:** Jack can finish a job without leaving the admin centre, and the
PIN is stored but shown nowhere client-facing.

---

## Phase 2 — pipeline stages ✅

`booked → invoiced → shoot_day → editing → gallery_ready → sent → delivered`
(plus `cancelled`).

`sent` added 7 Aug. `gallery_ready` had been carrying three separate jobs —
build the gallery, enter the links, send it — so a shoot sitting there might
need Jack to do something or might be waiting on a client to pay. Each stage
now asks for exactly one thing, and the action for the stage you are on renders
inside the stage card rather than as a separate card below it.

Run `supabase/videography_stage_sent.sql`. Additive: it only makes `sent` legal
and moves no rows.

`invoiced` sits early because the invoice goes out two days before the shoot.
`gallery_ready` means the gallery exists but the PIN is held; `delivered` means
the client has it.

Payment is **not** a stage — it arrives at different points by different routes
— so it stays a flag (`paid_at`) that any stage can carry.

Run `supabase/videography_stages_v2.sql`. **This one rewrites existing rows**,
unlike the other videography migrations: `final_draft → editing`,
`invoice_out → gallery_ready`, `complete → delivered`. The file has a snapshot
query at the top if you want to be able to look back.

### Who settles the booking

The booking now shows the payment route, which the database has carried since
the Fine & Country work but nothing ever displayed:

- **Customer pays by card** — raise the invoice from Invoicing with card
  payment switched on, so the client gets a pay link.
- **Invoice the brand (internal)** — for Fine & Country, this opens the extra
  step: name the office holding the seller's marketing fee, and confirm with
  F&C that it is actually held. Until both are done the booking warns.

That confirmation is stamped with who ticked it and when. It gates the money,
not the shoot, so it warns rather than blocks — but invoicing against a fee
nobody has verified is precisely what it exists to prevent.

---

## Phase 3 — invoice wording ✅

A shoot invoice now carries, in the "How to pay" block and in the covering
email:

- **Payment is not required until your shoot has taken place.**
- Content stays watermarked and locked until payment is received; the PIN
  follows payment and unlocks downloading.
- Ten days rather than the usual seven.

Switched on per invoice with **Shoot invoice: Yes** on the Invoicing page,
which also sets terms to ten days and moves the due date to match. Off by
default, so a general invoice never promises anything about content.

Payment terms are now **per invoice** (`terms_days`) rather than the single
global. Videography gets ten days without moving social media management
invoices, which was the reason this had been left undecided.

Run `supabase/invoicing_terms.sql`.

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

## The property address

Added 6 Aug. Nothing held the address of the property being shot: the booking
flow asks for a **postcode**, and it asks for it to work out travel, not to
record where the shoot is. `location` is a free-text admin field.

A Fine & Country invoice is billed to the office rather than the agent, so it
has to say on its face which property the work was for — hence
`property_address` on the booking (`supabase/videography_property_address.sql`).

**The public booking flow still does not collect it**, so a client-made booking
arrives with it empty and someone has to fill it in before invoicing F&C. Worth
adding to that flow for property shoots.

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
