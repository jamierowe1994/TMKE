# Running a videography booking — a guide for Jack

This is the practical, step-by-step version of how a booking moves through
the admin centre, from the moment a client books to the moment their gallery
expires. It tells you what to do at each stage, what happens on its own, and
what to watch out for.

For the full technical record of every email and database field, see
[videography-journey.md](videography-journey.md). This guide is the version
for actually running the job.

---

## The seven stages, at a glance

A booking moves left to right across the board in **Admin → Videography**:

**Booked → Invoiced → Shoot day → Editing → Gallery ready → Sent → Delivered**

Most of these moves happen when you click a button on the booking. A couple
happen by themselves overnight. One thing to know up front: **the automatic
moves only run when someone has the Videography admin page open** — they're
not a background job. If the page hasn't been opened in a while, a card can
sit one stage behind where it "should" be. This doesn't affect any of the
client emails below — those go out on their own schedule regardless — but if
a card looks stuck, opening the page is usually all it takes to catch it up.

---

## 1. A new booking lands

**If the client booked online**, you don't need to do anything to create the
record — it's already in **Booked** by the time you see it, with:

- The contact created or matched in the CRM automatically
- A slot held in your 365 calendar (shoot address on the event)
- A confirmation + calendar invite sent to the client
- A "new booking" alert sent to you

**If you're booking it in for them** (phone, email, in person), use **Add
shoot** in the admin centre instead. Slots are in 15-minute increments, and
for studio jobs the address fills in for you. It goes through the same CRM
matching as an online booking, so you don't create duplicate contacts.

**If it's a Fine & Country property shoot**, a panel appears on the booking
asking whether the seller's marketing fee is being held, and by which F&C
office. Leave this until you're ready to chase it — see the next section.

---

## 2. Fine & Country jobs — confirm the fee is held

This step only appears on brand-invoiced F&C property bookings. **Skip it
for anything else.**

1. Open the booking. There's a panel showing what the agent claimed about
   the marketing fee.
2. Check the accounts office address is right, then send — this emails the
   F&C office asking them to confirm the fee is held.
3. The panel now shows "Asked [date] — waiting on their reply."
4. Once they've come back to you (by whatever channel), tick it as
   confirmed. This is stamped with your name and the date, so there's a
   record of who checked.

**The invoice screen won't let you raise the invoice until this is ticked.**
If you're ever tempted to raise the invoice anyway before hearing back from
the office, that's the guard rail doing its job — don't work around it,
chase the confirmation instead.

---

## 3. Raising and sending the invoice

**Two days before the shoot**, if no invoice has been raised yet, you and
accounts get an email listing it — including a separate note for any F&C
job where the fee still isn't confirmed. Use that as your prompt if you
haven't already raised it.

To raise it:

1. Click **Raise invoice** on the booking. The line items are pre-filled
   from what was booked; travel is a separate line if it applies.
2. Card payment is on by default for direct clients, off for brand-invoiced
   jobs — it's a toggle, so check it's set the way you want.
3. Terms are ten days by default. The invoice itself tells the client
   payment isn't due until after the shoot, and that their content stays
   locked until they've paid.
4. Send it. A client gets a pay-by-card-or-bank-transfer email; a brand
   invoice names the agent and property so it's clear why they're being
   billed.

The booking moves to **Invoiced** automatically once it's sent.

From here, two reminders go out without you doing anything:

- **On the due date** — a reminder to the client with the amount, the card
  link, and the invoice again.
- **The day after it's overdue** — an alert to you and accounts with who
  owes what and since when. **Marking the invoice paid is what stops these
  chasers and releases the gallery PIN**, so if a client pays by bank
  transfer, go and mark it paid as soon as you know — see step 6b below for
  why that matters.

---

## 4. Shoot day

The booking moves to **Shoot day** on the day itself, and to **Editing** the
next morning — both happen on their own (next time the admin page loads).
You can also move it manually with the buttons on the card if you want it
to reflect reality sooner.

If the shoot's happened but the invoice is still unpaid, the client gets a
gentle nudge the next morning — thanking them for yesterday, letting them
know editing is under way, with the invoice and card link attached again.

---

## 5. Editing — two uploads, two ticks

This is the one stage with real manual work in it.

1. **Edit the footage** — off the app, in whatever software you use.
2. **Folder name** — the system suggests one from the shoot type, client,
   date and location. Edit it if you need to.
3. **Create the category folders** for the shoot type (Studio jobs get 2,
   Property gets 7, Agent gets 4) and upload into the matching boxes — files
   land in the right folder for you.
4. Use **Open in Cloudflare** to jump straight to the folder and check
   everything's landed correctly.
5. **Tick 1 — Archive uploaded**: tick this once the archive copy is up in
   our own storage.
6. **Build the Pixieset gallery**: the panel gives you the settings to use
   — TMKE preset, Watermark 3, the agreed naming convention, photos and
   video as separate sets — with a guide alongside if you need it.
7. **Tick 2 — Gallery uploaded**: tick this once the content is live on
   Pixieset.

If you try to move the card on to **Gallery ready** with either tick still
missing, it'll stop and ask you to confirm — it's not a hard block, just a
check that you haven't forgotten a folder.

---

## 6. Gallery ready — sending the client their content

Fill in on the booking: the gallery URL, the gallery email address, the
PIN, the expiry date, the floor plan link, and any ad-hoc link. The PIN is
stored separately from the rest of the booking and only admin can see it.

Before you send, the system checks:

- **Does the gallery email match the booking email?** Pixieset gates
  downloads on the email the client uses, so if these differ, you'll get a
  warning — worth fixing before sending, or the client may not be able to
  log in.
- **Has the invoice been paid?** What happens next depends on the answer.

### 6a — Already paid

Send as normal. The email includes the gallery link, floor plan, ad-hoc
link, **the PIN**, which address to use it with, the amendments clause, and
the three-month access window. The booking moves to **Sent**, and the PIN
appears in their hub straight away. Nothing further is owed — skip to
Closing below.

### 6b — Not paid yet

Send the same links, but **the PIN is deliberately left out**. The email
explains the gallery is watermarked until payment, and includes a card
button plus the invoice again. The booking still moves to **Sent**, and the
client's hub shows the links with a note explaining why downloads are
locked.

This isn't just a front-end thing — the PIN genuinely cannot leave the
building until the invoice is marked paid in the database, checked on the
server. So:

- If they **pay by card**, the payment webhook marks both the invoice and
  the booking paid automatically, and the PIN email goes out on its own —
  you don't need to do anything.
- If they **pay by bank transfer**, someone has to go and mark the invoice
  paid by hand. Until you do, the client cannot get their PIN — however
  much they ask. **This is the one place in the whole process where you
  personally are the only thing standing between a paid client and their
  content**, so if someone tells you they've transferred the money, go and
  mark it paid promptly.

Either way, the PIN-release email only ever sends once, and only if the
gallery originally went out without the PIN — so there's no risk of it
firing twice.

---

## 7. If a job stalls

You don't need to track this yourself — a digest goes to you and accounts
automatically if a job sits too long in one place:

- **Editing** for more than 10 days
- **Gallery ready** for more than 5 days
- **Sent** (i.e. awaiting payment or edits) for more than 10 days

It fires once, then weekly for as long as it stays stuck. If a job clears
one stall and then gets stuck again at a different stage later, that's
reported as a fresh alert — so don't assume a repeat email means the same
problem as before.

---

## 8. Closing the job

Most bookings include one round of client edits.

1. Once the client has confirmed edits are done (or that they don't want
   any), tick it on the booking — this is stamped with your name and the
   date.
2. **Close this job** is blocked until both the invoice is paid and the
   edits tick is set. If you can't close it, check which of the two is
   missing.
3. Once closed, the booking moves to **Delivered** and there's nothing
   further to do.

Separately, **a week before the gallery expires**, the client gets a
reminder naming the shoot, the date it was filmed, and the expiry date,
with a link back into their gallery. At expiry, their access ends — the
archive copy stays with us, but it isn't offered back to the client by
default.

---

## Anytime, at any stage

- **Client cancels or reschedules**: update it and both sides get an email
  automatically; the calendar updates too.
- **Internal notes**: use @mentions to loop in a colleague — they'll get an
  email. These notes are internal only; clients can never see them, even in
  their own hub.
- **Messaging the client directly**: you can email them from the booking at
  any point, with an attachment if needed. This is saved to their record
  the same way any client-visible correspondence is.
- **Sharing documents**: guidance, agreements and paperwork can be attached
  to the booking and shared with the client from there.

---

## Quick reference — what's automatic vs what needs you

| Needs you | Runs on its own |
|---|---|
| Confirming an F&C fee is actually held | Booking confirmation + calendar invite |
| Raising and sending the invoice | Due-date and overdue payment reminders |
| Both editing uploads and their ticks | Stage moves (once the admin page is open) |
| Building and sending the gallery link + PIN | PIN release once a card payment clears |
| Marking a bank transfer as paid | Stalled-job digest |
| Confirming edits are settled with the client | Gallery expiry warning, a week out |

If in doubt: **the only payment method that needs you to act is bank
transfer.** Everything else — reminders, card payments, PIN release —
takes care of itself once the booking is set up correctly.
