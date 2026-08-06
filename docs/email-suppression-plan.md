# Email: marketing vs transactional, unsubscribes and suppression

A plan for splitting TMKE's outgoing email properly and handling unsubscribes,
bounces and spam complaints the way mailbox providers now expect.

Written 27 July 2026. **Status as of 30 July 2026: most of this is built.**
Parts 1–8 have shipped; what remains is DNS work, two decisions, and warming up
sending volume. The per-item marks below are current — trust those over the
prose, which was written before any of it existed.

---

## Part 0 — What the jargon actually means

Skip this if it's already familiar.

**Cloudflare Worker.** A small program that runs on the internet rather than on
anyone's computer. It sits behind the TMKE website and does the jobs a web page
can't do safely on its own — sending email, talking to the database with
privileged access, taking payments. Ours is called `tmke-deliverables-api`.
When this document says "the Worker", that's what it means.

**Wrangler.** A tool for managing that Worker by typing commands. You don't
need it — everything can be done from the Cloudflare website instead. See
Part 1.

**API key.** A password that lets our Worker log in to Resend and send email.
It must never be written into the code, because the code is on GitHub where
anyone can read it. It's stored as a "secret" instead — Cloudflare holds it,
the Worker can use it, nobody can read it back out.

**Webhook.** A way for another company's system to phone us up and tell us
something happened. Right now, when Resend tries to deliver an email and it
bounces, **we never find out.** A webhook is Resend calling our Worker to say
"that one bounced" so the CRM can act on it.

**List-Unsubscribe header.** Hidden text attached to an email that tells Gmail,
Outlook and Yahoo "this is marketing, and here's the official way to
unsubscribe." Those providers then show their *own* unsubscribe button next to
the sender's name, separate from the link in the footer. Since 2024 the big
providers effectively require it on bulk mail — without it, more of our email
lands in spam. It does not replace the visible link in the footer; you need
both.

**Email API vs Broadcasts/Audiences.** Two different ways to use Resend:

- *Email API* (what we use) — we keep the contact list in our own CRM and ask
  Resend to send one specific email to one specific person. Unsubscribes are
  our responsibility.
- *Broadcasts / Audiences* — Resend keeps the list, and handles unsubscribes
  for you.

**Recommendation: stay on the Email API.** The CRM is already the source of
truth for contacts, tags, opt-in and lifecycle. Moving to Audiences would mean
maintaining the same list in two places and keeping them in sync, which is a
reliable source of "why did that person get that email" problems. The trade-off
is that unsubscribe handling is ours to build — which is what the rest of this
document is about.

---

## Part 1 — Putting the Resend API key in place

No typing commands. Do it from the Cloudflare website:

1. Sign in at **dash.cloudflare.com**
2. Left-hand menu → **Workers & Pages**
3. Click the worker named **`tmke-deliverables-api`**
4. **Settings** tab → **Variables and Secrets**
5. **+ Add** → change the type to **Secret** (not "Text" — Text is readable
   afterwards, Secret isn't)
6. Name: `RESEND_API_KEY` — exactly that, capitals and underscores included
7. Value: paste the key
8. **Deploy** / **Save**

Two notes:

- There is very likely **already** a `RESEND_API_KEY` there, used by the
  scheduled-post reminder emails. If so, edit that one rather than adding a
  second. Replacing it with the new sending-only key is a straight swap and
  nothing should break.
- The key is only ever pasted into Cloudflare's own screen. Don't paste it into
  chat, a document, or a code file.

While you're there, one more secret will be needed later for the webhook —
covered in Part 5.

---

## Part 2 — Which mail goes down which route

Agreed rule:

| | Route | Examples |
|---|---|---|
| **The customer did something, and this is the response** | Microsoft 365 | Booking confirmation, password reset, order receipt, "your files are ready", the preview/payment email |
| **Internal notifications to us** | Microsoft 365 | Jack's new-booking alert, admin notifications |
| **We decided to send it, they didn't ask** | **Resend** | Everything in a marketing funnel, newsletters, campaigns, nurture sequences |

The test: *did the customer's own action cause this specific email?* If yes,
Microsoft 365. If we chose the timing, Resend.

**Why it matters beyond tidiness.** Resend only reports bounces and spam
complaints for mail *Resend* sent. Anything going via Microsoft 365 is
invisible to the suppression system. So marketing must be on Resend for any of
this to work — and keeping transactional mail on Microsoft 365 protects it,
because transactional mail should never be blocked by a marketing unsubscribe.
Someone who unsubscribes from marketing must still get their booking
confirmation.

**Where the switch lives.** In the automation step, as Dani suggested — not the
email builder. Each "send email" step in an automation gets a **Marketing** or
**Transactional** setting:

- *Marketing* → sends via Resend, carries the unsubscribe footer and the
  List-Unsubscribe headers, and respects suppression and opt-out.
- *Transactional* → sends via Microsoft 365, no unsubscribe furniture, and is
  **not** blocked by a marketing opt-out (but still blocked by hard
  suppression, since a hard-bounced address is simply undeliverable).

The automation step is the right home because the same template can legitimately
be used both ways — the intent belongs to the sending, not the design.

**Existing steps default to Transactional** — reversed from this plan's first
draft, which said Marketing. The original reasoning was that failing to send is
safer than emailing someone who opted out. In practice that default would have
been a live regression: Dani's read is that nearly every existing automation is
transactional, so defaulting them all to Marketing would have started demanding
a marketing opt-in before a booking confirmation could go out. Anyone who never
ticked the newsletter box would silently stop receiving their own confirmations.

So the default preserves exactly today's behaviour, and Marketing has to be set
deliberately on a step. The unsubscribe path is not weakened by this, because an
unsubscribe also sets `dnd_email`, and do-not-contact stops *both* kinds — so an
unsubscribe still bites immediately, whatever a step is labelled.

The trade-off to keep in mind: a genuinely-marketing step that nobody remembers
to relabel will keep sending to people without opt-in. That's why identifying
the marketing automations (decision 2 below) matters.

---

## Part 3 — What the CRM needs to record

Three separate ideas, deliberately kept apart, because collapsing them loses
information we'll want later.

**1. Marketing opt-in** — *already exists* (`marketing_opt_in`). Did they say
yes to marketing in the first place?

**2. Unsubscribed** — *they asked us to stop.* New:

- `unsubscribed_at` — when
- `unsubscribe_source` — the footer link, the Gmail/Outlook button, or set by
  an admin by hand

Per Dani: an unsubscribe also sets the existing **do-not-contact** flag
(`dnd_email`), so it's caught by the gate that already exists in the automation
runner.

**3. Suppressed** — *the address itself is a problem.* New:

- `suppressed_at` — when
- `suppression_reason` — one of `hard_bounce`, `spam_complaint`,
  `resend_suppressed`, `repeated_soft_bounce`
- `soft_bounce_count` — a running count, reset on a successful delivery
- `last_email_event` — the raw event, kept for audit

Why keep unsubscribed and suppressed apart: *unsubscribed* is a choice we must
respect and should never quietly undo. *Suppressed* is a technical fact that can
legitimately change — someone's mailbox is full today and fine next month. If
both were one flag, we could never safely clear one without risking the other.

---

## Part 4 — A real unsubscribe page

Today the unsubscribe "link" is a `mailto:` to hello@tmke.co.uk. Someone has to
read that inbox and update the contact by hand. In practice that means
unsubscribes get missed, which is both a compliance problem and a deliverability
one.

Replace it with a real page:

- Each marketing email carries a link unique to that recipient, with a **signed
  token** in it. Signed means the address is tamper-proof — you can't edit the
  URL to unsubscribe a colleague. Nothing sensitive is exposed in the link.
- One click unsubscribes; the page confirms it plainly and offers a single
  "that was a mistake, resubscribe" button.
- It sets `unsubscribed_at`, `unsubscribe_source` and `dnd_email` in one go.
- It must work **without being logged in**, and must not require any other step
  — a required login or a "are you sure" chain is treated as a dark pattern by
  the providers.

---

## Part 5 — Bounces and complaints coming back from Resend

Resend needs somewhere to report to: a new endpoint on the Worker,
`/resend/webhook`.

**It must verify the signature.** Resend signs each call so we can prove it
genuinely came from them. Without that check, anyone who knows the URL could
POST to it and suppress our entire contact list. That's why a second secret is
needed alongside the API key — Resend provides a signing secret when the webhook
is created, and it goes into Cloudflare exactly like Part 1.

Event handling, per the agreed spec:

| Resend event | CRM action |
|---|---|
| Delivered | No change — but reset `soft_bounce_count` to zero |
| Permanent / hard bounce | **Suppress**, reason `hard_bounce` |
| Spam complaint | **Suppress**, reason `spam_complaint`, and unsubscribe from marketing |
| `email.suppressed` | **Suppress**, reason `resend_suppressed` |
| Transient / soft bounce | Increment `soft_bounce_count`, record the event, **do not suppress** |
| Unsubscribe | Unsubscribe from marketing (as Part 4) |

A spam complaint does both: technically it suppresses, but it's also
unambiguously someone saying "stop emailing me", so it should be recorded as an
unsubscribe too.

**One decision needed:** at how many consecutive soft bounces does an address
become suppressed? A common default is **5**, reset by any successful delivery.
Flagging it rather than assuming.

---

## Part 6 — One gate every marketing send passes through

Currently the only check happens inside the automation runner. Any other send
path added in future bypasses it — which is precisely how we ended up here.

So: a single function that every marketing send must call, which refuses to send
when the contact is suppressed, unsubscribed, do-not-contact, or has no
marketing opt-in. It records *why* it refused, so "why didn't this campaign
reach 400 people" has an answer.

Transactional sends call the same function in a different mode: blocked by
suppression only, never by a marketing opt-out.

---

## Order of work

Each step is useful on its own and safe to stop after.

1. **The API key** (Part 1) — Dani, in Cloudflare. Nothing else can be tested
   until it's there.
2. **CRM fields** (Part 3) — a database migration. Additive and safe; adds empty
   columns and changes no behaviour.
3. **The send gate** (Part 6) — wire it into the existing automation runner
   first, so opt-outs are respected immediately. *This is the step that closes
   the current compliance gap, so it should not wait for the rest.*
4. **The unsubscribe page** (Part 4) — replaces the mailto, and gives Part 5
   somewhere to point.
5. **List-Unsubscribe headers** — small, but needs step 4 in place first, since
   the header points at that page.
6. **The Resend webhook** (Part 5) — ✅ **built (28 Jul)**: `/resend/webhook` on
   the Worker, signature-verified, with per-automation insights on the funnel
   audit page. Needs two one-time manual steps to go live:
   - **Resend dashboard → Webhooks → Add endpoint**: URL is the Worker URL +
     `/resend/webhook`; tick all the `email.*` events. Copy the signing secret
     (starts `whsec_`) and add it in Cloudflare as a Secret named
     `RESEND_WEBHOOK_SECRET` (same steps as Part 1).
   - **Resend dashboard → Domains → tmke.co.uk**: turn on open + click
     tracking, or the insights can never show opens/clicks.
   Also run `supabase/email_events_automation.sql` once, so events tie back to
   the automation that sent them.
7. **Marketing/Transactional switch** on automation steps (Part 2), and moving
   the marketing funnels across to Resend.
8. **Admin visibility** — showing suppression status and reason on the contact
   card, and a filter for suppressed/unsubscribed contacts.

Steps 2 and 3 together fix the immediate problem: today an unsubscribed contact
who isn't flagged do-not-contact will still receive automation emails.

---

## Also outstanding (added 27 Jul, after reviewing Dani's list)

Written plainly, matching the wording on Dani's own to-do list.

**1. Send to a group, not just one person.** ✅ **done (28 Jul).** The `audience`
trigger enrols everyone already carrying any of the chosen tags when the funnel
is activated, and anyone who gains a qualifying tag later joins too. Built in
the automation builder with a live audience count
(`src/pages/admin/automations/edit.astro`, Worker
`/automations/enroll-audience`). Still gated on the tag tidy-up (§7c of
TODO.md) — the mechanism works, but the segments are only as good as the tags.

**2. Fix Microsoft 365 email authentication.** 🔶 **SPF done, DKIM published and
waiting on Microsoft (30 Jul).**

- ✅ **SPF** — now `v=spf1 include:spf.protection.outlook.com
  include:secureserver.net -all`. Microsoft is authorised; GoDaddy's include is
  kept until the DMARC digests show whether anything still sends through it.
  3 of the permitted 10 lookups.
- 🔶 **DKIM** — both CNAMEs are published in Cloudflare and verified resolving
  through to real keys (`v=DKIM1; k=rsa; …`) on public resolvers. Microsoft's
  portal still reports `CnameMissing`; its own error says sync takes "a few
  minutes to as many as 4 days". **Nothing further to do in DNS — just retry
  the Enable toggle** at security.microsoft.com → Email authentication
  settings → DKIM.

Two things learned that are worth keeping:

- **The tenant is GoDaddy-federated.** Sign-in for @tmke.co.uk routes through
  `sso.godaddy.com`, and the initial domain is `NETORGFT20795242.onmicrosoft.com`.
  That is why SPF named `secureserver.net`, why DMARC reported to a GoDaddy
  address, and why the tenant has limited self-service. James's own
  @therecruitmentexperts.co.uk login is a **different tenant**
  (`9f6c0962-…` vs TMKE's `bd9416b6-…`) and cannot administer this one.
- **Mailbox display names come from GoDaddy, not Microsoft.** Found 6 Aug after
  clients and colleagues saw "The Recruitment Experts" against @tmke.co.uk
  addresses. The tenant was provisioned through the TRE GoDaddy account, so the
  organisation name on the directory is the TRE one, and Microsoft falls back to
  it when labelling mailboxes. It is NOT in this codebase: recipients are sent
  as bare addresses with no display name, and only the From carries
  MAIL_FROM_NAME. admin.microsoft.com shows the field read-only because GoDaddy
  owns it; the fix is GoDaddy → Email & Office → the mailbox. Signing in as the
  affected user does not help - changing a display name is an admin action, and
  the "contact your IT or HR department" message means exactly that. Corrected
  for hello@, danielle@ and jack@. Jack's was the one that mattered: his mailbox
  sends booking confirmations and calendar invites, so clients saw it.
- **Microsoft has changed the DKIM CNAME target format.** It is now
  `selector1-tmke-co-uk._domainkey.NETORGFT20795242.k-v1.dkim.mail.microsoft`,
  not the older `….onmicrosoft.com`. The `.microsoft` TLD is real. Guides
  online still show the old form and it silently fails validation.

Original finding, 27 Jul: the domain's
SPF record is `v=spf1 include:secureserver.net -all` (GoDaddy) with a hard fail,
Microsoft is not included, and no DKIM key was found on the usual selector.
DMARC is `p=quarantine`. So mail sent via Microsoft 365 from @tmke.co.uk can be
junked — which is the route carrying booking confirmations and receipts. Needs
`include:spf.protection.outlook.com` in SPF and M365 DKIM enabled. **Resend is
correctly configured** (`send.tmke.co.uk` SPF via amazonses.com, DKIM at
`resend._domainkey`, aligns under the relaxed DMARC policy) — this is only the
Microsoft side.

**DNS is on Cloudflare, not GoDaddy** (nameservers `aiden`/`melissa.ns.
cloudflare.com`, confirmed 30 Jul). The `secureserver.net` in the SPF record and
the old `onsecureserver.net` DMARC address are stale *values* carried across
when the domain moved — which is very likely why nobody noticed the reports
were going nowhere. Both DKIM selectors (`selector1`/`selector2._domainkey`)
were still empty as of 30 Jul, so M365 mail satisfies neither SPF nor DKIM
alignment and, under `p=quarantine`, is delivering on sender reputation alone.
That holds until volume changes — and the first marketing funnel is exactly
that change. Wait for a fortnight of DMARC digests, then fix SPF and DKIM
together in the Cloudflare dashboard.

**3. Send DMARC reports somewhere we can read them.** ✅ **done (30 Jul).**
`rua` now points at Postmark's free DMARC Digests
(`re+ohejkwmmwsu@dmarc.postmarkapp.com`), which parses the raw XML and emails a
readable weekly summary to hello@. Only the `rua` changed — `p=quarantine` and
the relaxed alignment are exactly as they were. Verified live on Cloudflare's
nameservers and 1.1.1.1.

First digest within a week, and only if reports arrive. **Expect it to look
bad**: it should show a large share of mail failing authentication, which is
item 2 below finally becoming visible rather than anything new breaking. That
report is the input to fixing it — it names which senders fail and how often,
so the SPF/DKIM work is evidence-led rather than guesswork.

**4. Record when and how someone agreed to marketing.** ✅ **done (30 Jul).**
`contact_consent_events` is an append-only log of every consent change, with
`basis` (consent / legitimate_interest / withdrawn / unknown) kept deliberately
apart from `source`, and it surfaces on the contact card's Activity tab. Written
at every point consent changes: the public forms via `fireTrigger`, CSV import
including the TEG auto-opt-in, unsubscribe, resubscribe and the admin toggle.
The backfill split the existing list honestly — 113 TEG agents as legitimate
interest, the rest as "recorded before the audit trail existed".
(`supabase/contact_consent_events.sql`.)

Consequence worth knowing: **99% of the mailable list is TEG**, opted in because
they're in the group rather than by any act of consent. Defensible for B2B, but
it shapes the first newsletter — it should read as "from your group", not as
cold marketing, and the unsubscribe must be easy to find.

Not covered: merging two contacts can flip the survivor to opted-in without
logging it. Deferred deliberately as rare (TODO.md §9).

**5. Choose marketing or transactional per email step.** ✅ **done (28 Jul).**
The control is on the send step in the builder
(`src/pages/admin/automations/edit.astro:572`), and the funnel list labels each
automation marketing or system.

**6. Review existing automations** — ✅ **done (28 Jul).** Dani confirms every
existing automated email is service or admin related, and none is marketing.

So the transactional default is correct for all of them and nothing needs
relabelling. It also vindicates reversing this plan's original "default to
Marketing" position: had that stood, every one of these would have started
demanding a marketing opt-in before it could send.

Consequence worth knowing: **nothing currently uses the marketing path.** The
Resend routing, the per-recipient unsubscribe links and the List-Unsubscribe
headers are all built and deployed, but no automation is flagged Marketing, so
none of it is exercised yet. The first thing to use it will be the first real
marketing funnel — which makes that funnel the moment to test the whole chain
end to end, unsubscribe link included, rather than assuming it works.

**7. Show unsubscribes and bounces on a contact.** ✅ **done (29 Jul).**
Unsubscribed / Suppressed / Bouncing badges on the contact card with
plain-English detail, and an "Email issues" filter on the contacts board showing
everyone a campaign can't reach.

**8. Marketing to come from a real address.** ✅ **done.** Marketing sends from
`MARKETING_MAIL_FROM`, which defaults to `TMKE <hello@tmke.co.uk>`
(`worker/src/index.js:1332`). Transactional still goes from `posts@` with a
reply-to on `hello@`.

**9. Build up sending volume gradually.** A domain that has never sent bulk mail
suddenly sending thousands is a classic spam signal. Stagger the first sends.

## Decisions needed before building

1. ✅ **Soft-bounce threshold** — settled at **3**, which is what James asked
   for; this plan's suggestion of 5 is superseded. Built and live
   (`SOFT_BOUNCE_LIMIT`, `worker/src/index.js:1694`). No change needed.
2. ✅ **Which existing automations are marketing?** Answered by item 6 above —
   none of them are. Superseded; nothing to decide.
3. ⬜ **Should an unsubscribe also set do-not-contact for phone/SMS**, or email
   only? Built as email only (`dnd_email`), leaving the broader `dnd` flag
   alone. Confirm that's wanted.
4. ✅ **Who gets told** when someone complains about spam? Done (29 Jul) — a
   spam complaint emails both James and hello@, naming who complained and which
   email, and confirming they were unsubscribed and suppressed automatically.

---

## Open risk, unrelated but adjacent

The `contacts` table now only accepts admin access (fixed 27 Jul), but this plan
adds an unsubscribe page that must work for a **logged-out** visitor. That page
therefore has to run through the Worker, which holds privileged access, rather
than talking to the database from the browser. Noted here so it isn't
rediscovered halfway through step 4.
