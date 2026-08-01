# Videography: the process from booking to paid, picked apart

Written 1 Aug 2026, from James's walkthrough of the intended process and a read
of what's actually built. Flags what's already there, what's missing, what I'd
push back on, and what needs answers from Jack and Paula.

---

## 1. Availability — answered, and better than assumed

**It is auto-pulled from Jack's calendar.** Two layers:

1. **Working hours** live in `videography_availability` — one row per weekday,
   editable in the admin under *Diary & availability*.
2. **Real busy time** comes from Jack's actual Microsoft 365 calendar, live, via
   Graph `getSchedule` (`worker/src/index.js:2818`). Anything in his diary
   disappears from the offered slots.

Both call bookings and shoot bookings use this. Confirming a booking **writes an
event into his calendar**, and it **re-checks the calendar immediately before
creating** — so two people loading the page at once can't both take the slot.

**Jack can already block time out** by putting anything in his own Outlook. That
works today and needs no build.

### What's missing: any notion of a buffer

There is **no buffer logic of any kind** — no edit time, no travel gap, and
crucially **no minimum notice**. As it stands:

- Someone can book **tomorrow at 8am**, with no warning to Jack
- Two off-location shoots can be booked **back to back**, with no travel time
  and no editing time between them

James's instinct on edit buffer is right. I'd argue **minimum notice is the more
urgent of the two** — a same-day booking is a worse failure than a tight one,
and it's the simpler fix.

Suggested shape, all admin-editable per service:

| Service | Min notice | Buffer after |
|---|---|---|
| Content Studio | 2 days? | none — James's call, agreed |
| Property (off location) | 3 days? | 1–2 days for editing + travel |
| Agent (off location) | 3 days? | 1 day |
| Discovery call | 1 day? | none |

**Numbers need Jack.** The mechanism is the same either way: extend the
availability check to subtract a lead-in window and to look at neighbouring days
for off-location shoots.

---

## 2. The big finding: most of the delivery flow already exists

James described building a preview, a payment step, and a gated file release.
**That system is already built**, minus one piece.

`supabase/videography_deliveries.sql` — one row per "send to client", holding:

- `token` — the unguessable public link
- `teaser_count` — **how many preview images are free** (default 3)
- `base_pence` + extras — the price breakdown
- `status` — the payment gate
- Files themselves in R2 via `videography_deliverables`

There is a **client-facing gallery** at `/deliver` that reads that token.

**The only missing piece is Stripe.** `src/pages/deliver/index.astro:175` reads:
`// Stripe checkout slots in here (Phase 5). Until then:`

So "preview, then pay, then release" is not a build — it's **finishing one
integration**.

### Which makes Pixieset a real decision, not a detail

If Jack uploads finished work to Pixieset and we store the link, we have **two
delivery systems**: the gallery TMKE built (with the paywall, teasers and
tokens) and a third-party one with none of that.

That matters because:

- **Payment gating only works if we hold the files.** A Pixieset link can be
  forwarded, and we can't withhold it once sent. The whole "release on payment"
  model depends on us controlling access.
- The agreement says files are released once payment clears. That's enforceable
  with the R2 gallery. It isn't, with a link to someone else's platform.

**Question for Jack:** is Pixieset his *editing and proofing* tool, or his
*client delivery* tool? If it's the former — he exports finished files and
uploads them to us — everything works and Pixieset never enters our system. If
it's the latter, we're choosing between two delivery mechanisms, and I'd argue
for the one with the paywall built in.

---

## 3. Where I'd push back: dropping the preview

James: *"theoretically we shouldn't need to do a preview... we send the invoice,
that gets paid while we're editing."*

I'd keep the preview for **self-paying clients**, for one reason: **it is the
thing that makes people pay quickly.** Asking someone to pay for work they
haven't seen is a much harder ask than "here are three images from your shoot,
settle up and the full set unlocks." That's exactly what `teaser_count` is for.

The tension James identified isn't real on inspection:

> 7-day terms, but the client wants content in 3 days

**Seven days is a maximum, not a wait.** Nothing stops them paying within an
hour of the preview and getting files the same day. The term protects TMKE; it
doesn't delay the client. Removing the preview doesn't make delivery faster — it
removes the prompt that makes payment fast.

**For the F&C invoiced route, no preview is correct** — the office is paying an
invoice, not reacting to content, and the agreement already says so.

---

## 4. Invoice timing — instinct is right

James: *"I don't feel comfortable invoicing before we've actually done the
shoot."* That's the right call and it's standard practice.

The alternative floated — invoicing at the point cancellation becomes chargeable
(72 hours before) — is defensible but I'd advise against it:

- It invoices for work not yet done, which is what the discomfort is about
- The agreement lists weather, illness and equipment failure as things that force
  a reschedule. Invoice first and you're issuing credit notes when that happens
- It complicates reconciliation for a few days' cashflow

**Recommendation: invoice the day after the shoot**, as originally described,
with the 7-day term.

---

## 5. What the process description doesn't cover

Gaps worth deciding before building, in rough order of how much they'll hurt.

1. **What happens when nobody pays.** Files are withheld — then what? A chase
   sequence, a late fee, a point where it escalates? The agreement mentions a
   late fee and "further action", but there's no process or state behind it.
   This is the most likely thing to bite.
2. **What "mark them a videography member" actually means.** A tag? A lifecycle
   change? Something on the contact card? The contact is already created at
   booking — this needs defining before it can be built.
3. **The admin notification.** Jack gets an email today (`jackNotifyHtml`).
   There is a `src/lib/notifications.js`, but it's member-facing. An in-admin
   notification is a new build — worth confirming it's wanted on top of the
   email, rather than instead of it.
4. **Who checks the F&C pre-checks, and when.** The columns exist
   (`brand_fee_confirmed` + `_at` + `_by`). Undecided: does an unconfirmed check
   block anything, or is it just a to-do on the card? Since nobody pays before
   the shoot, it can't block the shoot — so presumably it blocks the invoice.
5. **Does TPE ever get invoiced?** James wasn't sure. If yes, the invoice route
   isn't F&C-only and the agreement set needs a fourth variant. **This one
   changes the data model, so it's worth answering early.**
6. **Amounts at delivery.** James mentions Jack checking invoice amounts are
   right. Worth deciding whether he can *edit* the total at that point (extras,
   twilight images, over-5,000 sq ft) — the delivery table already has an extras
   field, which suggests yes.

---

## 6. Questions for Monday

**For Jack:**
- Is Pixieset your editing tool or how you deliver to clients? Do you use it for
  TPE as well as F&C?
- Minimum notice: how far ahead must a booking be to be workable?
- Buffer: how many days after an off-location shoot before you can shoot again?
- Do you want an in-admin notification as well as the email?

**For Paula / accounts:**
- Is the F&C office list settled — Midlands and Stratford, or more?
- Does TPE ever get invoiced rather than paying by card?

**For James:**
- What does "mark them a videography member" mean in the CRM?
- Chase process for unpaid invoices: how many nudges, over how long, then what?

---

## 7. Suggested build order

1. **Minimum notice + buffer** on availability. Small, self-contained, and it
   stops a same-day booking landing on Jack tomorrow.
2. **Stripe on the delivery gallery** — finishes a flow that's otherwise built,
   and unlocks the whole self-pay path.
3. **The pipeline card**: booking details, F&C pre-checks, edit state, content
   links.
4. **Invoice on completion** for the invoiced route, with the 7-day term.
5. **Chase / unpaid states**, once 2 and 4 exist and there's something to chase.
