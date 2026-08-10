# Videography — the complete journey

Every action, email, record and prompt from booking to delivered, both payment
routes and both endings. Written from the code on 8 August 2026 and checked
against it, not from memory.

**Who acts**

| | |
|---|---|
| 👤 | A person in the admin centre (Jack, Danielle, admin) |
| ⚙️ | The system, no prompting |
| ⏰ | The daily 08:00 job |
| 🧑‍💼 | The client |

**Where things are recorded**

- **Booking record** — the client's file. `channel: email` is correspondence
  they can see in their hub; `channel: note` is internal and members cannot
  read it, enforced by RLS.
- **Email history** — the contact's send log in the CRM.
- **Notes** — the internal notes panel, with an audit trail.

---

## 1 · Booking

| Step | Who | What happens | Email | Recorded |
|---|---|---|---|---|
| Books online | 🧑‍💼 | Service, package, add-ons, date, postcode, property address, agreement signed | | |
| Property shoots | 🧑‍💼 | Full property address is required before they can confirm | | |
| F&C property | 🧑‍💼 | Asked whether a seller's marketing fee is held, and by which office | | |
| Contact | ⚙️ | Created or merged in the CRM, tagged by service and brand | | Email history |
| Booking row | ⚙️ | Written to videography at stage **Booked** | | Booking record |
| Diary | ⚙️ | Slot held in Jack's 365 calendar, shoot address on the event | | |
| Confirmation | ⚙️ | | `vid_booking_client` + .ics | Booking record `email` |
| Team alert | ⚙️ | | `vid_booking_team` → Jack | |
| **Or** manual | 👤 | Jack adds the shoot himself; 15-min slots, studio address auto-fills | | |
| Manual → CRM | ⚙️ | Same contact merge and tag rules as an online booking | | Email history |

## 2 · Fine & Country only — is the fee actually held?

| Step | Who | What happens | Email | Recorded |
|---|---|---|---|---|
| Panel appears | ⚙️ | On brand-invoiced bookings at Booked: which office, what the agent claimed | | |
| Ask the office | 👤 | Jack enters the accounts address and sends, once he has checked the details | `vid_fc_fee_confirm` | Booking record `email` · Notes |
| Waiting | ⚙️ | Panel shows "Asked 8 Aug — waiting on their reply" | | |
| They confirm | 👤 | Jack ticks it; stamped with who and when | | Notes (audit) |
| Until then | ⚙️ | **Raising the invoice is blocked** | | |

## 3 · Invoicing

| Step | Who | What happens | Email | Recorded |
|---|---|---|---|---|
| Two days out | ⏰ | Any shoot in two days with no invoice raised | `vid_invoice_prompt` → Jack + accounts | |
| | ⚙️ | F&C shoots with the fee unconfirmed are flagged in that table | | |
| Raise it | 👤 | From the booking. Lines seeded from what was booked, travel separate | | |
| Card payment | ⚙️ | On for a client, off for a brand — still a toggle | | |
| Terms | ⚙️ | Ten days. Invoice says payment isn't due until the shoot has happened, and that content is locked until paid | | |
| Send | 👤 | **Client:** pay by card or transfer · **Brand:** names the agent and property, says why they are receiving it | `invoice_sent` | Invoice record |
| Stage | ⚙️ | Moves to **Invoiced** | | |
| Due date | ⏰ | Reminder: amount, card link, PDF again, and that content stays locked until paid | `invoice_due_today` | Booking record `email` · Email history · **Invoice panel** |
| Day after due | ⏰ | Alert: who, how much, when due, where sent. Marking it paid releases the PIN and stops chasers | `invoice_overdue_team` | Booking record `note` · Email history · **Invoice panel** |

## 4 · The shoot

| Step | Who | What happens | Email | Recorded |
|---|---|---|---|---|
| On the day | ⚙️ | Moves to **Shoot day** | | |
| Next morning | ⚙️ | Moves to **Editing** on its own | | |
| Next morning, unpaid | ⏰ | "Great to see you yesterday" — editing under way, invoice attached, card link | `vid_payment_reminder` | Booking record `email` |

## 5 · Editing — two uploads

| Step | Who | What happens | Email | Recorded |
|---|---|---|---|---|
| Edit | 👤 | Off app | | |
| Folder name | 👤 | Generated from shoot type · client · date · location; editable | | |
| Create folders | 👤 | Per shoot type — Studio 2, Property 7, Agent 4 | | Booking |
| Upload | 👤 | Into category boxes; files land in the matching folder | | Deliverables |
| Check | 👤 | **Open in Cloudflare** goes straight to the folder | | |
| Tick 1 | 👤 | Archive copy uploaded to our own storage | | Booking |
| Pixieset prompt | ⚙️ | Build the collection: TMKE preset, Watermark 3, agreed naming, photo and video as separate sets — with the guide | | |
| Tick 2 | 👤 | Content uploaded to the Pixieset gallery | | Booking |
| Moving on | ⚙️ | Either tick missing → asks before moving to Gallery ready | | |

## 6 · Gallery ready

| Step | Who | What happens | Email | Recorded |
|---|---|---|---|---|
| Links | 👤 | Gallery URL, gallery email, PIN, expiry, floor plan, ad-hoc link | | Booking · PIN in its own admin-only table |
| Email check | ⚙️ | Warns if the gallery email differs from the booking email — Pixieset gates downloads on it | | |
| Before you send | ⚙️ | **Is the invoice paid?** Says the PIN will be withheld if not, and that it sends itself when payment lands | | |

### 6a · The client HAS paid

| Step | Who | What happens | Email | Recorded |
|---|---|---|---|---|
| Send | 👤 | Gallery, floor plan, ad-hoc link, **the PIN**, which address to use with it, amendments clause, three months | `vid_gallery_ready_paid` | Booking record `email` · Notes (audit) |
| Stage | ⚙️ | Moves to **Sent** | | |
| Hub | ⚙️ | Links appear, **PIN revealed** | | |
| | | *Nothing further is owed. Straight to §8.* | | |

### 6b · The client has NOT paid

| Step | Who | What happens | Email | Recorded |
|---|---|---|---|---|
| Send | 👤 | Same links, **no PIN**. Watermarked until payment, PIN follows automatically. Card button + invoice PDF attached | `vid_gallery_ready_unpaid` | Booking record `email` · Notes (audit) |
| Stage | ⚙️ | Moves to **Sent** | | |
| Hub | ⚙️ | Links appear. PIN block explains *why* downloads are locked | | |
| Guard | ⚙️ | A PIN cannot leave the building unless `paid_at` is set — checked server-side, from the database | | |
| Then they pay | 🧑‍💼 | **Card:** webhook marks invoice **and** booking paid · **Transfer:** marked paid by hand | | Notes (audit) |
| PIN follows | ⚙️ | Thank you, the PIN, which address to use, three months, we'll remind you, Previous Bookings in TMKE Studio | `vid_pin_released` | Booking record `email` · Notes (audit) |
| Hub | ⚙️ | **PIN revealed** | | |
| Sends once | ⚙️ | `pin_released_at` guards it; only fires if the gallery already went without the PIN | | |

## 7 · If nothing moves

| Step | Who | What happens | Email |
|---|---|---|---|
| Stalled | ⏰ | Editing 10 days · Gallery ready 5 · Sent 10. One table: client, service, stage, days stuck | `vid_stalled_digest` → Jack + accounts |
| Repeat | ⚙️ | Once when it stalls, then weekly. A shoot that stalls at a *different* stage is reported afresh | |

## 8 · Closing

| Step | Who | What happens | Email | Recorded |
|---|---|---|---|---|
| Edits | 🧑‍💼 | One round included under their agreement | | |
| Settle | 👤 | Tick that edits are done or declined; stamped | | Notes (audit) |
| Deliver | 👤 | **Blocked** unless paid **and** edits settled | | |
| Delivered | ⚙️ | Job closed | | |
| A week before expiry | ⏰ | Names the shoot, the date filmed and the expiry date; links to it; mentions Previous Bookings | `vid_gallery_expiring` | Booking record `email` |
| Expiry | ⚙️ | Client access ends. Archive stays — not advertised | | |

## 9 · Anywhere along the way

| Step | Who | What happens | Email |
|---|---|---|---|
| Client cancels or reschedules | 🧑‍💼 | Calendar updated, both sides emailed | `vid_cancel` / `vid_reschedule` |
| Internal note | 👤 | With @mentions; tagged colleagues are emailed | |
| Message the client | 👤 | Optionally emails them, with an attachment | Booking record `email` |
| Documents | 👤 | Shared with the client — guidance, agreements, paperwork | |

---

## The daily 08:00 run, in order

1. `runVideographyChasers` — day-after payment reminder · gallery expiry warning
2. `runInvoiceChasers` — due today (client) · overdue (team)
3. `runStallCheck` — shoots sitting still
4. `runInvoicePrompt` — invoices to raise, two days out

Every one stamps a column so it sends once: `reminder_sent_at`,
`expiry_warned_at`, `due_reminder_sent_at`, `overdue_alerted_at`,
`stalled_alerted_at`, `invoice_prompt_sent_at`.

## What still needs a person — on purpose

| Action | Why it isn't automatic |
|---|---|
| Confirming the F&C fee is held | Asking is a button; believing the answer is a judgement |
| Raising and sending the invoice | The amount and recipient deserve a look |
| Both uploads, and their ticks | Neither is recoverable later without redoing work |
| Gallery links and PIN, and pressing send | The one moment content reaches a client |
| Marking a bank transfer paid | Nothing tells us; only accounts knows |
| Confirming edits are settled | Only the person who spoke to them knows |
