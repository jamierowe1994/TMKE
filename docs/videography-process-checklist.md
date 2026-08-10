# Videography — every step, and who does it

James's end-to-end walkthrough, 8 August, checked against the code. Every step
the process touches, including the automatic emails he didn't list.

**Who**: 👤 a person (Jack, Danielle, admin) · ⚙️ the system, no prompting ·
🧑‍💼 the client.

---

## 1 · Booking

| # | Step | Who | Status |
|---|---|---|---|
| 1.1 | Client books online — service, package, add-ons, date, postcode, property address, agreement signed | 🧑‍💼 | ✅ |
| 1.2 | Contact created or merged in the CRM, tagged by service and brand | ⚙️ | ✅ |
| 1.3 | Booking written to videography, visible on the board and in calendar view | ⚙️ | ✅ |
| 1.4 | Slot held in Jack's 365 calendar, with the shoot address on the event | ⚙️ | ✅ |
| 1.5 | Confirmation email to the client, with a calendar invite | ⚙️ | ✅ `vid_booking_client` |
| 1.6 | Booking alert to Jack | ⚙️ | ✅ `vid_booking_team` |
| 1.7 | **Or:** Jack adds the shoot by hand | 👤 | ✅ |
| 1.8 | A manual booking also reaches the CRM, same tag rules | ⚙️ | ✅ |

## 2 · Fine & Country, where a marketing fee is held

| # | Step | Who | Status |
|---|---|---|---|
| 2.1 | Agent states at booking that the office holds a marketing fee | 🧑‍💼 | ✅ |
| 2.2 | Which office is recorded, separately from where the invoice is sent | ⚙️ | ✅ |
| 2.3 | Email the office to confirm they hold the funds | 👤 | ✅ |
| 2.4 | The panel tells Jack to send it, and shows whether he has | ⚙️ | ✅ |
| 2.5 | Tick that the office confirmed — stamped with who and when | 👤 | ✅ |
| 2.6 | Raising the invoice is blocked until that tick | ⚙️ | ✅ |

## 3 · Invoicing — two days before the shoot

| # | Step | Who | Status |
|---|---|---|---|
| 3.1 | Reminder to Jack and Danielle at 08:00, two days out: raise this invoice | ⚙️ | ✅ `vid_invoice_prompt` |
| 3.2 | Raise the invoice from the booking, seeded from what was booked | 👤 | ✅ |
| 3.3 | Card payment on for a client, off for a brand — still a toggle | ⚙️ | ✅ |
| 3.4 | Ten days to pay, and the invoice says payment isn't due until the shoot has happened | ⚙️ | ✅ |
| 3.5 | Client invoice: pay by card or bank transfer | 🧑‍💼 | ✅ |
| 3.6 | Brand invoice: different wording, names the agent and property, says why they're receiving it | ⚙️ | ✅ |
| 3.7 | Invoice emailed with the PDF attached | 👤 | ✅ `invoice_sent` |
| 3.8 | Stage moves to Invoiced when it sends | ⚙️ | ✅ |

## 4 · The shoot

| # | Step | Who | Status |
|---|---|---|---|
| 4.1 | Moves to Shoot day on the morning of the shoot | ⚙️ | ✅ |
| 4.2 | Moves to Editing on its own the morning after the shoot | ⚙️ | ✅ |
| 4.3 | Day after the shoot, if unpaid: "great to see you yesterday", invoice attached, card link | ⚙️ | ✅ `vid_payment_reminder` |

## 5 · Editing and the archive

| # | Step | Who | Status |
|---|---|---|---|
| 5.1 | Edit the footage | 👤 | off app |
| 5.2 | Open Deliver work from the booking, check the folder name | 👤 | ✅ |
| 5.3 | Create the folders — per shoot type | 👤 | ✅ |
| 5.4 | Upload into the right category boxes | 👤 | ✅ |
| 5.5 | Open in Cloudflare to check what landed | 👤 | ✅ |
| 5.6 | Tick "archive copy uploaded to our own storage" | 👤 | ✅ |
| 5.7 | Prompt to go and build the Pixieset gallery | ⚙️ | ✅ |
| 5.8 | Link to the Pixieset guide | ⚙️ | ✅ `/guides/TMKE-Guide-to-Pixieset.pdf` |
| 5.9 | Tick "content uploaded to Pixieset" | 👤 | ✅ |

## 6 · Gallery

| # | Step | Who | Status |
|---|---|---|---|
| 6.1 | Build the gallery in Pixieset | 👤 | off app |
| 6.2 | Add gallery link, gallery email, PIN, expiry, floor plan, ad-hoc link | 👤 | ✅ |
| 6.3 | Warn if the gallery email differs from the booking email | ⚙️ | ✅ |
| 6.4 | "Before you send" panel: is the invoice paid? | ⚙️ | ✅ |
| 6.5 | **Paid** → links + PIN + three months + Studio + amendments clause | ⚙️ | ✅ `vid_gallery_ready_paid` |
| 6.6 | **Unpaid** → links, no PIN, invoice attached, card link | ⚙️ | ✅ `vid_gallery_ready_unpaid` |
| 6.7 | A PIN cannot leave the building unless `paid_at` is set | ⚙️ | ✅ enforced server-side |
| 6.8 | Stage moves to Sent when the email goes | ⚙️ | ✅ |
| 6.9 | Hub shows the links once the email has gone | 🧑‍💼 | ✅ |

## 7 · Payment and release

| # | Step | Who | Status |
|---|---|---|---|
| 7.1 | Client pays by card | 🧑‍💼 | ✅ |
| 7.2 | Card payment marks the invoice **and** the booking paid | ⚙️ | ✅ |
| 7.3 | Bank transfer marked paid by hand | 👤 | ✅ |
| 7.4 | PIN email sends itself when payment lands | ⚙️ | ✅ `vid_pin_released` |
| 7.5 | Hub reveals the PIN once paid | 🧑‍💼 | ✅ |

## 8 · Closing

| # | Step | Who | Status |
|---|---|---|---|
| 8.1 | Client requests their included round of edits | 🧑‍💼 | off app |
| 8.2 | Tick that edits are settled — stamped, and written to notes | 👤 | ✅ |
| 8.3 | Delivered blocked until paid **and** edits settled | ⚙️ | ✅ |
| 8.4 | A week before the gallery expires: reminder to download | ⚙️ | ✅ `vid_gallery_expiring` |
| 8.5 | Gallery expires; archive stays, not advertised | ⚙️ | ✅ by design |

## 9 · Elsewhere in the same system

| # | Step | Who | Status |
|---|---|---|---|
| 9.1 | Non-member enquiry → acknowledgement + team alert | ⚙️ | ✅ |
| 9.2 | Brochure request | ⚙️ | ✅ |
| 9.3 | Discovery call booked → client confirmation + team alert | ⚙️ | ✅ |
| 9.4 | Client cancels or reschedules → email both ways, calendar updated | ⚙️ | ✅ |
| 9.5 | Internal notes with @mentions, and an audit trail | 👤 | ✅ |

---

## What is left

**Nothing.** Every step James walked through, plus the three he added
afterwards, is built.

The process now runs on its own from booking to delivery: stages advance
themselves, the team is told when an invoice needs raising, the client is
reminded on the due date, the team is told the day after if it is still
unpaid, the PIN releases itself on payment, and a shoot that stops moving gets
reported.

What still needs a person, by design:

- Jack confirming the Fine & Country fee is held (asking is a button; believing
  the answer is a judgement)
- Raising and sending the invoice
- The two uploads, and their ticks
- Adding the gallery links and PIN, and pressing send
- Marking a bank transfer paid
- Confirming edits are settled

Everything else happens whether anyone remembers or not.

## Stall thresholds

Only the stages where a shoot genuinely waits on us. Booked, Invoiced and Shoot
day all move themselves - on the shoot date, and again the morning after - so
nothing can rot in them unseen.

| Stage | Flagged after |
|---|---|
| Editing | 10 days |
| Gallery ready | 5 days |
| Sent | 10 days |

Reported once when a shoot stalls, then weekly while it stays put.
