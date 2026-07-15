# SMM report — rules for turning the admin report into the client's report

The admin report is an internal working document: raw SocialPilot numbers plus our own
triage. The member's report at `/account/social` is a **client deliverable**. This file
is the set of rules for getting from one to the other. It is the source of truth for the
AI prompt, and it is meant to be argued with and edited — if a rule here is wrong, change
it here and the generator changes with it.

Nothing in the client report is invented. Every sentence must be derived from a number or
a note that exists in the admin report.

---

## 1. Who is reading

An estate agent or business owner. They are not a marketer. They did not ask for social
media metrics — they asked for TMKE to run their social media. They are skimming, once a
month, and the question in their head is **"is this working, and what are you doing?"**

Consequences:

- **Never make them do the interpretation.** "Interaction rate 12%" is data. "More people
  are engaging with your posts than we'd typically expect" is the report.
- **No jargon without a plain-English gloss.** Reach, impressions, interaction rate,
  non-follower reach — assume none of it is known.
- **Never imply homework.** They are not going to go and fix anything. We are.

## 2. Tone

- **Conversational, not corporate.** Write as their account manager would speak in a
  catch-up call. Contractions are fine.
- **Confident, not hedgy.** "We're changing the reel format" — not "we may look at
  potentially trialling".
- **Positive, but not dishonest.** See §4 — this is the rule most likely to go wrong.
- British English. TMKE house style: no italics for emphasis, no exclamation marks.

## 3. The written summary

Currently one line. It should be **3–5 sentences, one paragraph**, and read as prose
rather than a list of stats. The shape that works:

1. **The headline** — how the month went overall, in a sentence a human would say.
2. **The evidence** — the one or two numbers that actually moved, in plain English, with
   the "so what" attached.
3. **The context** — why that happened, if we know (a format, a campaign, a seasonal
   thing). If we don't know, say nothing; don't invent a cause.
4. **The forward look** — one line pointing at what it means for next month, which sets
   up the takeaways below it.

Do **not** restate every KPI — the numbers are on the Overview tab. The summary's job is
to say what they *mean*.

## 4. Positive framing — and its limit

Every takeaway lands as **something we're acting on**, never as a mark against the
account. The pattern:

> [what the numbers show, neutrally] → [what we're doing about it]

Worked examples:

| Admin note (internal) | Client report |
|---|---|
| `Reel interactions down 18%` | "The current reel format isn't landing as well as it was, so we're researching new formats and changing them up next month." |
| `Link taps 0 — needs attention` | "We're adding a clearer call to action to the bio and Stories to turn that reach into clicks through to you." |
| `Post interaction rate declining` | "Posts are getting seen but not talked about, so we're moving to more question-led captions to get conversations going." |
| `Continue reel-first strategy — 65% of reach` | "Reels are doing the heavy lifting for your reach, so we're keeping them front and centre." |

**The limit, and it matters:** positive framing means *never blaming the client and always
pairing a dip with our response*. It does **not** mean hiding a decline or dressing a bad
month as a good one. If reach halved, the report says reach is down and what we're doing —
it does not lead with a flattering side-metric and hope they don't notice. A client who
later works out the numbers were spun stops trusting every report we've ever sent, and
the reporting is the product.

So: **no red flags, no spin either.** Honest facts, constructive response.

## 5. Key takeaways

- **3–5 items.** More than five and it's a backlog, not takeaways.
- Each is **one sentence**, and each names **an action we are taking**.
- Written in **"we"** — the team's plan, not the client's to-do list.
- **No traffic lights.** The admin `type` (`go` / `caution` / `action`) drives our
  prioritisation and must not reach the client view as colour. It's fine as an input to
  the ordering: lead with what's working, then what we're changing.
- If a takeaway is only a restatement of a number, it isn't a takeaway — cut it.

## 6. Hard rules for the generator

1. **Never invent a number.** Only cite figures present in the report data.
2. **Never invent a cause.** No "this is likely because…" unless it's in the admin notes.
3. **Never promise a result.** "We're changing X" is a commitment we control. "This will
   double your reach" is not.
4. **Never compare to other clients**, named or implied.
5. **If a field is missing, say nothing about it** — don't fill the gap with filler.
6. **If a month has too little data to say anything true, say that** rather than
   generating three sentences of nothing.
7. Respect `report_settings` visibility: if a field is hidden from clients, it must not be
   referenced in the prose either. Hiding a metric and then discussing it is worse than
   showing it.

## 7. Where this runs (recommendation, not yet built)

Generate **in admin, at publish time** — not live on the member's page:

- A human at TMKE can read and edit it **before a client ever sees it**. This is copy
  making claims about someone's business; it should not go out unread.
- It's stable — the same month reads the same way every time it's opened.
- One generation per report, not one per page view.

Shape: a **"Generate client summary"** button on the report in admin → Worker → Anthropic
(infra already exists: `ANTHROPIC_API_KEY`, `claude-sonnet-4-6`) → returns
`{ summary, takeaways[] }` → saved onto the report, editable, then published. The member
page renders what's stored, exactly as it does today.

**Open:** does an unedited AI summary publish automatically, or does a report stay
unpublished until someone has read the copy? Recommend the latter.
