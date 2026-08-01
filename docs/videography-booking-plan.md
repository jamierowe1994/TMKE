# Videography booking — Fine & Country payment routes

Written 31 July 2026, from James's *Updated TEG Property Videography Terms* and
a read of the current booking code. Working notes for the build, not final
wording.

---

## The business rule, in one paragraph

Every TEG brand can book online. **Fine & Country sits a tier above** the other
TEG brands, so property videography costs more: **Platinum £625** for F&C,
**Gold £550** for everyone else. The real complication is not price, it is *who
pays*. F&C agents often charge the seller a **marketing fee up front**, which
the **F&C office holds** and spends on marketing. In that case TMKE invoices the
office rather than taking payment from the agent — which is a different
commercial relationship and therefore a different agreement.

This affects **property videography only**, and only when the agent signs in
with an F&C email address. A `@thepropertyexperts.co.uk` agent sees Gold
pricing, is never asked the payment question, and signs the existing agreement.

---

## Three property agreements, not one

| # | Who | Package | Who pays | Preview? |
|---|---|---|---|---|
| A | All TEG brands | Gold £550 | The client, after preview | Yes |
| B | Fine & Country | Platinum £625 | The **agent**, after preview | Yes |
| C | Fine & Country | Platinum £625 | The **F&C office**, invoiced **after the shoot** | **No** |

Agreement C carries two clauses the others don't:

- **Agent fallback liability.** If the office doesn't hold the funds or fails to
  pay for any reason, the booking agent becomes personally liable on demand.
- **No preview.** Files are released when payment clears; withholding beyond 72
  hours while payment is outstanding is explicitly not late delivery.

B and C also carry a **Property size** clause (pricing assumes up to 5,000 sq
ft) that agreement A does not. See the open questions.

---

## What already exists

More than expected. The groundwork was laid and then left.

- **Agreements are structured data, not prose.** `TERMS_BY_SERVICE` in
  `src/lib/videography-config.js` holds clauses as objects, with shared clauses
  (`CLAUSE_BOOKING`, `CLAUSE_PAYMENT`…) as constants so wording can't drift
  between agreements. **Clause numbers are assigned at render time from array
  order**, so the document's "renumber all subsequent clauses automatically" is
  already handled — inserting a clause renumbers everything below it for free.
- **Brand detection from the email domain.** `audienceForEmail()` returns the
  brand; `propertyTierForBrand()` already maps `fc → platinum` and every other
  TEG brand → `gold`.
- **The database columns already exist.** `supabase/videography_payment_route.sql`
  adds `payment_route` (`agent_card` | `brand_invoice`), `marketing_fee_claimed`
  (what the agent said), `brand_fee_confirmed` + `_at` + `_by` (Jack's check with
  F&C), and `invoice_recipient_id` into the invoicing address book.

**But none of it is wired.** `payment_route` appears nowhere in `src/` or
`worker/src/` outside that migration — the columns are there and nothing reads
or writes them. Whether the migration has even been *run* in production is
unverified (see TODO.md §9; one unverified migration turned out to be actively
breaking every form on 30 Jul, so this is worth checking rather than assuming).

---

## The one architectural change

Agreements are currently keyed by **service**:

```js
termsForService("property")   // one agreement per service
```

They now need to be keyed by **service + tier + payment route**:

```js
termsFor({ service: "property", tier: "platinum", route: "brand_invoice" })
```

That is the whole shape of the change. Everything else — the clause
constants, automatic numbering, the signature capture, the booking row — stays
as it is. Agreement A is the existing property agreement with the universal
edits applied; B and C are new arrays built from mostly-existing clause
constants plus three new ones (property size, agent-payment, F&C-invoiced).

---

## Universal wording changes (all agreements)

Applies wherever the clause appears, **except Studio Day unless stated**.

1. **Split `Delivery` into `Delivery` + `Amends`.** New wording supplied. Do not
   add to Studio Day. Renumbering is automatic.
2. **`Use of content, licence & footage retention`** — new wording, and the
   licence trigger differs: **"On full payment"** in paid agreements,
   **"On delivery"** in the free Studio Day agreement.
3. **Studio Day `Cancellations`** — new wording: a late cancellation or no-show
   *forfeits* the session, TMKE is not obliged to replace it, and any
   replacement is subject to availability and may be charged.

---

## The booking form change (F&C property only)

After the agent is identified as F&C, before the agreement is shown:

> **How will this videography booking be paid for?** *(radio, one only)*
> - **Seller's Marketing Fee** — the seller has paid a marketing fee held by the
>   F&C office, which will pay for this booking
> - **Agent Payment** — I will pay for the booking directly

If **Seller's Marketing Fee**, a **required** confirmation:

> ☐ I confirm that the Fine & Country office specified below is currently
> holding the seller's marketing fee, that the fee is available to pay for this
> booking, and that I have authority to commit the office to payment.

Then the matching agreement (B or C) is shown for signature.

Mapping to the columns that already exist:

| Answer | `marketing_fee_claimed` | `payment_route` | Agreement |
|---|---|---|---|
| Agent Payment | `false` | `agent_card` | B |
| Seller's Marketing Fee | `true` | `brand_invoice` | C |
| Not F&C (never asked) | `null` | `agent_card` | A |

`marketing_fee_claimed` is deliberately separate from `payment_route` so that if
Jack later switches a booking to card payment, we still know what the agent
originally claimed. That matters given the fallback-liability clause.

---

## Answers from James, 31 Jul

1. **Domain: `fineandcountry.com`.** ✅ Fixed. It was a live bug — the booking
   config listed only `.co.uk`, so every real F&C agent resolved as a
   **non-member with no property tier**: wrong price, and no route to the F&C
   agreement. Nothing would have surfaced it, because a non-member booking is a
   legitimate outcome rather than an error. Both domains now map to `fc`.

2. **The agent picks their office.** We don't hold branch data, so the agent
   must choose. Expected to be **F&C Midlands** or **F&C Stratford**, but the
   list is still being settled with Paula in accounts — so build it as data
   (a small table or config list), not two hard-coded options.

3. **Nobody pays before the shoot.** ⚠️ **This contradicts the agreement
   wording.** Agreement C's subtitle reads *"The relevant Fine & Country office
   is invoiced before the shoot"*, but the process is: shoot first, invoice
   after. The rest of agreement C is already consistent with invoicing
   afterwards — no preview, files released once payment clears — so only the
   subtitle needs rewording. **Needs James's replacement line.**

   What happens *before* the shoot is a **check**, not an invoice: Jack confirms
   with F&C that it's the right branch, that the branch holds the money, and
   that it is the marketing fee. That is what `brand_fee_confirmed` records.
   Since it no longer gates a payment, decide what it does gate — presumably it
   must be true before the invoice is raised after the shoot.

4. **Property size clause stays F&C-only.** Confirmed deliberate: TPE are
   unlikely to list a property of that size.

5. ✅ **Migrations run (31 Jul / 1 Aug):** `videography_payment_route.sql`,
   `videography_fc_office.sql` and `videography_cancelled_stage.sql`.
   In plain terms: that file adds the new columns to the bookings table, and
   someone has to paste it into the Supabase SQL editor once. If it hasn't been
   run, the columns don't exist and saving a payment route will fail. Worth
   checking rather than assuming — on 30 Jul a migration that had only been
   half-applied was silently breaking every form on the site.

6. **What Jack's confirmation looks like** — still open. A control on the admin
   booking card, presumably, that records the three checks in #3.

## Suggested build order

Each step is useful alone and safe to stop after.

1. **Settle the domain question** (#1). Everything branches off it, and it may
   be a live pricing bug today.
2. **Apply the universal wording changes** to the existing agreements. No new
   logic, immediately correct, and shrinks what's left.
3. **Add agreements B and C** as clause arrays, and change `termsForService` to
   `termsFor({ service, tier, route })`.
4. **Add the payment question** to the F&C property flow, writing
   `marketing_fee_claimed` and `payment_route`, plus the office details from #2.
5. **Admin: the confirmation control** and raising the invoice against the F&C
   office.
6. **Delivery differences** — suppress the preview on route C and gate file
   release on payment clearing.

Steps 1–3 are the wording work and are largely mechanical. Steps 4–6 are the
process build and depend on the open questions.
