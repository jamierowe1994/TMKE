# Videography, part two: from shoot to paid to delivered

**Draft brief — 1 Aug 2026.** For James to tweak Monday, and to take to the
team meeting Wednesday. Everything marked ❓ needs an answer before it can be
built.

---

## 1. The decision that shapes everything

**Two delivery routes, split by one rule.**

| Route | Who | Platform |
|---|---|---|
| **Pixieset** | Fine & Country **property** shoots only | Pixieset (F&C-approved) |
| **TMKE gallery** | Everything else — all TEG brands, external agents, **and F&C content studio / agent shoots** | Ours |

**Why the split.** F&C's requirement is contractual: it sits in the F&C agent's
contract with their seller. The seller must get a password-protected link on an
F&C-approved platform to approve photos. Pixieset is approved; ours is not, and
getting approved is a negotiation with a third party on their timetable.

**Why it isn't a compromise.** The F&C property route mostly doesn't need a
preview — the office pays an invoice, not on seeing content. The TEG route is
where preview and selection matter most. The two platforms end up doing
genuinely different jobs rather than duplicating.

It also means we can build ours properly, prove it with real clients, and only
then decide whether to ask F&C to look at it.

---

## 1b. Three ways a booking gets paid for

Clarified by James, 1 Aug. Invoicing a business is **not** F&C-only — but the
two cases are different things and must not be collapsed.

| | Who pays | Whose money | Who decides |
|---|---|---|---|
| **Agent card** | The booking agent | Theirs | Default |
| **F&C office invoiced** | The Fine & Country office | **The seller's** — a marketing fee the office is holding | **The agent**, at booking |
| **TEG brand invoiced** | TPE, Prestige, etc. | **The brand's own** | **Us**, in advance |

**Why the last two aren't the same thing.**

Fine & Country is the agent spending money that already belongs to their seller.
The agent declares it at booking, confirms the office holds it, and is
personally liable if that turns out to be wrong. That's why it's a question in
the booking flow and why it has its own agreement.

A TEG brand paying is the brand choosing to foot the bill for one of its agents
— content studio covered by a joining fee, or an ad-hoc "yes, we'll pay for
that". No seller, no marketing fee, no personal liability.

### What that means for the build

**TEG brand invoicing must not be a question in the booking flow.** If agents
can tick "my brand is paying", they all will. It is a pre-arrangement between
TMKE and the brand, so it should be **set by us** — either known in advance from
the agent's record, or switched on the booking in the admin.

**It needs its own agreement**, or rather it needs the F&C one *without* the
marketing-fee confirmation and the personal-liability clause, neither of which
applies.

Data model: keep `payment_route` as `agent_card` / `brand_invoice`, and add a
reason — `fc_marketing_fee` or `teg_brand_covers`. Same mechanic, different
justification, different agreement, different evidence.

- ❓ Are there TEG brands other than TPE that would ever cover a booking?
- ❓ Is "TPE covers this agent" a standing arrangement we could hold on their
  record, or is it decided booking by booking?
- ⓘ Note: the new-starter **Studio Day** already runs as its own free flow, so
  the "content studio covered by the joining fee" case may already be handled.
  Worth confirming rather than building twice.

---

## 2. The process, start to finish

### Stage 1 — Booking *(built)*

| Step | State |
|---|---|
| Agent books online, account created or signed in | ✅ built |
| Contact created / updated in the CRM | ✅ built |
| Priced by brand — F&C Platinum £625, all other TEG Gold £550 | ✅ built |
| F&C property asked who pays, and signs the matching agreement | ✅ built |
| Booking written to the pipeline and to Jack's calendar | ✅ built |
| Email to Jack | ✅ built |
| One on-location shoot a day | ✅ built (1 Aug) |
| Marked as a videography client in the CRM | ❓ needs defining |
| Notification inside the admin centre | ⬜ not built |

### Stage 2 — Before the shoot

| Step | State |
|---|---|
| Booking appears in the member's hub | ⬜ not built |
| Live status tracker for the client | ⬜ not built |
| PDF prompt pack uploaded to the booking, shown in the hub | ⬜ not built |
| **F&C pre-checks:** right branch · branch holds the money · it is the marketing fee | ⬜ not built (columns exist) |

### Stage 3 — Shoot and edit

| Step | State |
|---|---|
| Jack moves the card through the pipeline | ✅ built (kanban exists) |
| Buffer after an off-location shoot for editing | ⬜ not built ❓ how many days |
| Uploads finished files | ✅ built (R2 + deliverables) |
| Adds links: floor plans, drone, anything external | ⬜ not built |
| Checks and adjusts the invoice total | ⬜ partly — extras field exists |

### Stage 4 — Delivery and payment

**Self-paying (TEG, external, F&C non-property):**

| Step | State |
|---|---|
| Preview gallery sent — some unlocked, rest locked | ✅ built |
| Client picks which images they want from their allowance | ⬜ **not built** |
| Client pays by card | ⬜ **Stripe not wired** |
| Full gallery unlocks | ✅ built |
| Client buys extra images beyond their package | ⬜ **not built** |

**Invoiced (F&C property):**

| Step | State |
|---|---|
| Invoice raised the day after the shoot, 7-day terms | ⬜ not built |
| Files delivered via Pixieset, link + password to agent and seller | manual, stays manual |
| Payment marked off against the booking | ⬜ not built |

### Stage 5 — After payment *(none of this is built)*

Everything lands in the member's hub:

- Links to photos, videos, floor plans, drone footage
- A copy of the paid invoice
- A prompt to leave a review — stored internally for now, Google Business later

---

## 3. What the gallery does today

Live demo: **`tmke.co.uk/deliver?demo=1`** — sample data, no database row.

### Built and working

- **Token link.** Unguessable URL per delivery. No account needed.
- **Locked and unlocked in one view.** Locked images are shown desaturated and
  dimmed under a veil with a lock, so the client sees what they're buying.
  Unlocked ones carry a TMKE watermark.
- **Category tabs** with counts — Exteriors, Interiors, Twilight, Drone, Video.
- **Free teasers.** A per-delivery count of images unlocked up front (default 3).
- **Price breakdown.** Base shoot plus editable extras.
- **Unlock card.** What's locked, the total, view invoice, pay to unlock.
- **Per-file download** once unlocked.
- **Files in R2**, served through the Worker — access is ours to control.

### Not built

| Gap | Notes |
|---|---|
| **Stripe checkout** | The button exists; there's a literal TODO where the checkout goes. Everything else in the paid path is done. |
| **Password on the link** | Today it's an unguessable token only. F&C need a password — relevant if we ever seek approval. |
| **Selection** | Client choosing *which* 5 of 30 they want. |
| **Buy extra images** | £10–15 an image beyond the package. |
| **External links** | Floor plans, drone — files only today. |
| **Lightbox** | Clicking an image to view it large. |
| **Watermarked derivatives** | See the security note below. |
| **Invoice link** | The button is there; nothing behind it. |

### ⚠️ One real security point

The demo dims locked images **in CSS**, which means the full-resolution file is
already in the browser. That's fine for a demo and **not acceptable in
production** — anyone can open devtools and take it.

A real gallery must serve a **downscaled, watermarked derivative** for anything
locked, and only serve the original once paid. That's a genuine piece of work
(image processing on upload or on the fly), not a detail, and it should be
scoped before launch rather than after.

---

## 4. Selection and upsell — the new idea

Worth calling out separately because it's the one thing here that **makes
money** rather than saving time.

Jack shoots 30. The package includes 10. Today the other 20 are wasted.

**Proposal:** the client picks their 10 from the full set, and can come back
later and buy any of the rest at a fixed price per image.

Questions before it can be built:

- ❓ Price per extra image — £10? £15? Different for stills and video?
- ❓ Can they change their selection after choosing, or is it final?
- ❓ Does buying extras go through the same checkout, or a lighter one?
- ❓ Does the allowance differ by package, and is it recorded anywhere today?

---

## 5. Members hub — the missing chunk

Nothing here is built, and it's the biggest single piece.

**A live status tracker**, Domino's-style — not the styling, the idea of always
knowing where you are:

`Booked → Prompt pack ready → Shoot day → Editing → Preview ready → Paid → Delivered`

**Plus, on the booking card:** shoot details, the PDF prompt pack, the preview
link when it exists, final content links, a copy of the paid invoice, and a
prompt to leave a review.

- ❓ Do the F&C property clients see the tracker too, given delivery happens off
  our platform? Suggest yes up to "Delivered", then a link out to Pixieset.
- ❓ Is the review per booking, or per client?

---

## 6. Open questions

**For Jack**
- Do you use Pixieset for TPE as well, or only F&C?
- How many days after an off-location shoot before you can shoot again?
- Minimum notice — how far ahead does a booking need to be?
- Which shoots come with a PDF prompt pack?
- Do you want an in-admin notification as well as the email?
- Floor plans and drone — always external links, or sometimes files?

**For Paula / accounts**
- Is the F&C office list settled — Midlands and Stratford, or more?
- ✅ Answered: yes, but for a different reason to F&C - see section 1b.
- Which brands besides TPE would ever cover a booking?

**For James**
- What does "mark them a videography client" mean in the CRM — a tag, a
  lifecycle, something on the card?
- Chase process for an unpaid invoice: how many nudges, over how long, then what?
- Price per extra image.
- Do we want the password on our gallery links regardless, or only if we pursue
  F&C approval?

---

## 7. Suggested order

1. **Stripe on the gallery** — finishes an otherwise-complete flow and unlocks
   the whole self-pay path. Biggest result for the effort.
2. **Watermarked derivatives** — must land before any real client sees a
   preview.
3. **Pipeline card**: pre-checks, content links, invoice adjustment.
4. **Members hub**: booking card, tracker, prompt pack.
5. **Invoice on completion** for the F&C property route.
6. **Selection and upsell** — the revenue one, once the basics are solid.
7. **Chase / unpaid states**.

Buffer and minimum notice sit outside this list — they're small, self-contained,
and only need Jack's numbers.
