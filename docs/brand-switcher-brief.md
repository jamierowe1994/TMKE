# The brand switcher

**For: the Design Studio chat. From: the Admin Centre chat. 22 Sep 2026.**

Nine TEG agents work for two brands. Bernadine Williams is a Property Expert
covering St Albans and a Letting Expert covering Hertfordshire & Bedfordshire —
different colours, different logo, different job title, different patch,
sometimes a different work number and email. One person, one account, and she
is not going to keep two logins to get at both.

So the Studio needs a way to say **which brand she is designing as**, and
everything her design pulls from her kit has to follow it.

## What already exists

The data is done and live.

- `agent_profiles` is now **one row per person per brand** — each carries its
  own `job_title`, `area`, `date_joined`, `email`, `phone`, and `is_primary`.
  (`supabase/dual_brand_agents.sql`)
- `member_brands()` returns every brand they work for; `member_brand()` returns
  the primary — the one their Studio should open in.
- A brand pack reaches them if **any** of their brands is named on it, so pack
  visibility needs nothing further.
- `brand_profiles` holds each brand's kit: company name, slogan, website, tone
  of voice, six colours, three fonts, two logos.

## The endpoint

`GET /member/brand-prefill` on the Worker (`api.tmke.co.uk`), with the member's
Supabase token as a bearer.

```
GET /member/brand-prefill              → their primary brand
GET /member/brand-prefill?brand=The%20Letting%20Experts
```

Returns:

```json
{
  "ok": true,
  "brand": "The Letting Experts",
  "brands": ["The Property Experts", "The Letting Experts"],
  "kit": {
    "company": "The Letting Experts",
    "slogan": "…", "website": "…", "tone": "…",
    "location": "Hertfordshire & Bedfordshire",
    "colors": ["#…"], "fonts": { "heading": "…", "subheading": "…", "body": "…" },
    "logos": [{ "url": "…" }],
    "about": { "name": "…", "role": "Letting Expert", "phone": "…", "email": "…" }
  }
}
```

`brands` is the whole list — **that is what tells you whether to show a
switcher at all**. One entry, no switcher, nothing changes for the 99% of
members who have one brand or none.

`kit` is built for that brand alone: its colours, its logo, its tone, and
*their* job title, patch, phone and email **at that brand**.

## What the switcher does

1. Shows the brands from `brands`, with the current one marked.
2. On a change, fetches the kit for the chosen brand and makes it the active
   kit — the same kit the editor already reads for colours, fonts, logo slots
   and merge tags.
3. Redraws the open design: `{company name}`, `{area}`, `{job title}`,
   `{telephone}`, `{email}`, `{local expert}`, the logo slot and the headshot
   all resolve from the new kit.
4. Remembers the choice for the session. Their primary is the default on a
   fresh visit.

## The decisions that matter

**Never merge two brands into one kit.** Both logos available at once invites a
letting board with the property logo on it, and print cannot be taken back.
One active brand, always.

**A design saved while designing as a brand should remember it.** Reopening a
Letting Experts board next week in Property Experts colours is the same
mistake, one step later. A `brand` on the saved design, restored on open,
solves it; the switcher then shows what it was made as.

**Do not overwrite what they have typed.** A member may have edited their own
kit — a different phone, a better slogan. Switching brands changes the brand
half (colours, fonts, logo, company, tone) and their own details for that
brand; it must not silently discard a personal edit. If that turns out to be
hard to tell apart, ask rather than guess.

**The member never sees the word "brand kit" twice.** They see "Designing as:
The Letting Experts". The machinery stays out of it.

## Where it should live

A control in the Studio's own chrome — near the design's name, or in the Brand
pane — that is visible while designing, not buried in settings. It answers the
question "whose logo is about to go on this?", and that question should be
answerable at a glance.

## Notes

- Nine people have two brands today; the rest have one or none. Build for the
  many: no switcher unless `brands.length > 1`.
- A leaver's brand disappears from `brands` the moment they are marked, so
  someone who leaves one brand simply stops being offered it.
- `{local expert}` renders "The Hertfordshire & Bedfordshire Letting Expert",
  or "Your local Letting Expert" when we have no patch — so a switch always
  produces a whole sentence, never a gap.

## Studio side: done (22 Sep, Design Studio chat)

- **Where.** "Designing as" sits at the top of the Brand pane — a select, with
  a line saying what follows the choice. A readout of the current brand also
  sits beside the design's name on a wide screen (≥1380px) and opens that pane;
  the top bar has no room for a control of its own at laptop widths.
- **Only for the nine.** Nothing shows unless `brands.length > 1`.
- **Switching** fetches `/member/brand-prefill?brand=…`, makes that kit the
  active one for the session (`__TMKE_SET_BRAND_KIT__` in editor.js) and
  redraws the open design. Their own saved kit is never written to; their
  headshot is carried across, since it is theirs at either brand.
- **Words that came from tags** are rewritten from the new kit. Each text
  element now keeps what it was written from (`mergeSrc`) and what we last made
  of it (`mergeOut`): if the words still match, they follow the brand; if the
  member has typed since, they are theirs and are left alone. A tag the old
  brand had no answer for resolves on the switch.
- **The logo slot** swaps only when it still holds the brand's own mark.
- **The design remembers**: `canvas.brand` on every page, saved with the design
  and restored on open, so reopening a Letting Experts board opens as one. The
  switcher waits for a design to load before choosing, so a saved brand beats
  the session's choice, which beats their primary.
- **Undoable**: a switch is one history step.

Tested with two stand-in kits: company, name and job title, `{local expert}`,
the logo and the fonts all follow the brand; a website the member had typed
over survived both switches; the design reported the brand it was made as.
Not yet tested against the live endpoint with a real two-brand member — that
needs one of the nine, or Danielle signed in as one.

## Two kits, and where they live (23 Sep, Design Studio chat)

Danielle: the Brand kit page needs the switch too — they may want to edit one
brand's details, or simply see both. So the page now carries a burgundy card
across the top with a pill per brand.

Each brand keeps its own kit. Stored in the one `member_brand_kits` row, since
that is one row per person:

```
kit = { …the brand on show…, activeBrand: "The Letting Experts",
        byBrand: { "The Property Experts": { …that kit… } } }
```

The kit on show stays at the top level, so everything that reads a kit carries
on unchanged; the other brand's sits beside it. Switching on the page saves
what is on screen under the brand it belongs to, then reloads on the other —
every field, swatch, font picker and logo tile is built once from the kit the
page opened with, and a reload is honest about that. The Studio's switcher
prefers `byBrand[brand]` when it exists, so an edit made on the page shows in
the Studio.

**Admin Centre, two things to know:**

1. If `/member/brand-sync` or `/member/brand-adopt` ever writes the whole kit
   back, `byBrand` and `activeBrand` must be carried, or one brand's edits are
   lost. Patching named fields is fine.
2. If you would rather this were a row per person per brand, say so and I'll
   move to it — the page and the Studio both go through one helper.

Also fixed on the way: a brand's logos are `{ url, name }` while a kit has
always used `{ src }`, so a kit filled from a brand drew no logos at all.
Converted on read and write (`normaliseKit`), so kits already saved wrong mend
themselves.

## One for the Worker (23 Sep)

`kitIsBrands()` compares `logos` object for object, but a brand holds
`{ url, name }` and a member's kit holds `{ src, primary }` — so a kit filled
straight from the brand reads as "gone their own way", and "Using your own
branding" was offered to someone already on their brand's kit. The hub now
decides this for itself (`kitMatchesBrand` in `src/lib/brand-cache.js`,
comparing what the fields say rather than their shapes). Worth making the same
change in the Worker, since `matches` is presumably read elsewhere.
