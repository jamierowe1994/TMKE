# What the admin centre should be telling us

**Audit, 24 Sep 2026.** Every point where something happens that a person at
TMKE needs to know about — what it does today, and what it should do.

The rule Danielle set: *anything fundamental to running the business needs a
notification in the admin centre.* Email stays where it already earns its
place; the notification is the thing that survives a deleted inbox.

---

## 1. Bookings — today: email to Jack, nothing in the admin centre

| What happens | Emails today | Notify |
|---|---|---|
| Videography shoot booked | `JACK_NOTIFY` | Jack + admin |
| New-starter Studio Day booked | `JACK_NOTIFY` | Jack + admin |
| Discovery call booked (videography) | `JACK_NOTIFY` | Jack + admin |
| Discovery call booked (social) | `SMM_NOTIFY` + calendar invite | Abigail + admin |
| Booking **cancelled** | `JACK_NOTIFY` | Jack + admin |
| Booking **rescheduled** | `JACK_NOTIFY` | Jack + admin |

A cancellation is the one that hurts most if missed: a slot sits empty and
nobody knows it is free.

## 2. Somebody got in touch — today: email, nothing in the admin centre

| What happens | Emails today | Notify |
|---|---|---|
| Videography enquiry | `JACK_NOTIFY` | Jack + admin |
| Social media enquiry | `SMM_NOTIFY` | Abigail + admin |
| General contact form | `ENQUIRY_NOTIFY` (hello@) | Admin |
| SMM waitlist joined | `SMM_NOTIFY` + Samantha | Abigail + admin |
| Brochure requested | *(logged, nobody told)* | Admin |

## 3. Money — today: mostly SILENT

| What happens | Emails today | Notify |
|---|---|---|
| **Pack order paid** (Stripe) | **nothing** | **Admin — missing entirely** |
| **Invoice paid by card** | **nothing** | **Admin — missing entirely** |
| Edit request paid | `notifyEditRequest` → Jack | Jack + admin |
| Invoice due today / overdue | accounts + Jack (cron) | Admin |
| "Raise this invoice" prompt | accounts + Jack (cron) | Admin |

**A pack being bought and an invoice being paid tell nobody.** Two of the
three ways money arrives are invisible until somebody opens Stripe. That is
the single biggest hole in this list.

## 4. Something went wrong — today: silent or buried

| What happens | Emails today | Notify |
|---|---|---|
| A Resend send failed (`blocked`) | nothing | Admin |
| Spam complaint | Danielle + hello@ | Admin |
| Funnel stalled | accounts + Jack (cron) | Admin |
| Contact bounced / suppressed | nothing | Admin (digest is fine here) |

## 5. Members — today: silent

| What happens | Emails today | Notify |
|---|---|---|
| **Brand-kit request filed** | **nothing** | **Admin — raised 22 Sep** |
| New member signs up | nothing | Admin |
| Member leaves / marked a leaver | nothing | Admin |

---

## Who "admin" means

Three audiences, and the difference matters:

- **A person** — Jack for a shoot, Abigail for social. They already get the
  email; the notification is so it is still there tomorrow.
- **Admin** — everyone with an admin login sees it in the centre. Read state
  is per person: Sam clearing one must not hide it from Danielle.
- **A person AND admin** — the default for anything operational. The named
  person acts; everybody else can see it happened.

Nothing in this list should be admin-only-by-email. Email is the alert;
the admin centre is the record.

## What it needs to be

- One table, one shape: what happened, where it points, when, who has seen it.
  Written by the Worker and by admin pages alike.
- A count in the shell (`src/components/admin/AdminShell.astro`), visible from
  wherever you are, and a panel listing newest first.
- Every notification links to the thing itself, never to a page to go hunting.
- Never a digest for anything with a person waiting at the other end of it.
