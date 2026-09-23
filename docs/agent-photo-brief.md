# The brand-approved photo

**For: the Design Studio chat. From: the Admin Centre chat. 23 Sep 2026.**

An agent's kit now holds **two pictures of them**, and the whole point is that
they are not interchangeable.

| | where it comes from | social | print |
|---|---|---|---|
| `kit.headshot` | they upload it themselves, square, ~600px | yes | **never** |
| `kit.brandPhoto` | supplied by TEG, full length, no background | yes | **only this** |

Print is the reason. A selfie cropped square holds up at 1080px on Instagram
and falls apart on a 6-sheet, and a board with a bad cut-out on it is a board
the brand has to live with for six weeks. So print takes the approved photo or
it takes nothing.

The example that prompted this: a Property Experts "Please Join Me" invitation —
full-height cut-out down the left edge, copy to the right, contact block at the
foot. That layout is only possible with a background-free full-length shot.

## What already exists

- `agent_profiles.brand_photo_url` — **per person per brand**, like everything
  else on that table. An agent who is a Property Expert and a Letting Expert is
  photographed in both liveries, and a Letting board must not carry the
  Property picture. (`supabase/agent_brand_photo.sql`)
- `kit.brandPhoto` comes back from `GET /member/brand-prefill` and is written
  into the brand cache, so it arrives with everything else the editor reads.
  Null when we hold no photo for them.
- It is **not** three-way merged. Every other field can become theirs if they
  edit it; this one always follows the brand, so a stale photo heals itself
  the next time they arrive. The brand kit page shows it and cannot change it.
- `GET /studio/stand-ins` → `{ ok, female, male, ghost }`. Any signed-in
  member may read it.

## Which picture, when

One resolution order, and it depends on what is being made:

```
print design      brandPhoto  →  ghost          (never headshot)
social design     brandPhoto  →  headshot  →  ghost
a headshot slot   headshot    →  brandPhoto  →  ghost
```

The third line is Danielle's: if they never set their own headshot, the brand
photo stands in for it. The first line is the one that matters — a print
export must refuse the headshot even when it is the only picture we hold.

## The ghost

`/images/agent-photo-ghost.svg` — a dashed slot with a grey standing figure in
it, proportioned 1:2.33, the shape a real cut-out arrives in. It reads as
"a photograph belongs here" and never as a photograph.

The slot should say so in words as well, in the editor's own chrome rather
than baked into the image: **"This is where the photo of you goes."** Text
drawn into the SVG would be four point high in a footer and forty point on a
6-sheet, which is why it isn't in there.

## The stand-ins

Two invented people, a man and a woman, set in **Studio → Studio branding**
and served by `/studio/stand-ins`. They exist so a template can be judged with
somebody in it — copy beside a person, at the size a person actually is.

They are a **design-time** choice and nothing else. A member never sees one:
the moment a real agent opens the design they get their own photo, or the
ghost. Whatever the Studio uses to remember "show me the woman while I work"
must not be able to leak into a saved design or an export.

## The decisions that matter

**Print refuses the headshot, silently is not good enough.** If a print design
has a photo slot and we hold no `brandPhoto`, say so where the person can see
it — "we don't have your brand photo yet" — rather than printing a ghost or
dropping the slot.

**A dual-brand agent's photo follows the brand switcher.** `brandPhoto` is
per brand and comes down inside the kit, so switching brand in the Studio
already swaps it — as long as the photo is read from the active kit each time
rather than cached at load. Same rule as the logo.

**The aspect ratio is the brand's, not the box's.** A cut-out has a real
shape; a slot should `contain` it and bottom-align it (people stand on the
floor), never `cover` it. The brief's tiles all do this and look right.

## Notes

- Nothing is wired to TEG yet. `brand_photo_source` records `'teg'` or
  `'admin'` so the feed can later be taught not to overwrite one a person at
  TMKE set by hand while the feed was down.
- Until then, the photo is set per brand in the contact drawer's TEG tab,
  uploaded into the `pack-images` bucket the brand logos already use.

---

## Studio side: done (23 Sep 2026)

The rules live in `public/scripts/editor.js`:

- `photoForSlot(role)` — a headshot slot takes the headshot and falls back to
  the brand photo; a photo slot on print takes the brand photo **or nothing**,
  and on social takes the brand photo first, then the headshot.
- `fillTemplatePhotos()` fills every `brandRole: "photo"` slot on load and on
  every brand switch, `contain` and bottom-aligned. A picture the member chose
  themselves (no `autoPhoto`) is left alone.
- `nudgeIfNoBrandPhoto()` shows the notice in the Studio (`#ed-photonudge`)
  when a print design has an empty photo slot — the "say so out loud" rule.
- An empty photo slot never builds an `<img>`; `renderElement` paints the
  ghost (`/images/agent-photo-ghost.svg`, with "This is where the photo of you
  goes.") straight into the DOM. Admin mode can swap the ghost for a stand-in
  via `__TMKE_SET_STAND_IN__("female" | "male")`, reading
  `window.__TMKE_STAND_INS__`.
- The photo is read from the active kit on every render, so it follows the
  brand switcher. While fixing that, `loadBrand()` was split: `ownBrand()` now
  reads the member's own saved kit, so the "their headshot is theirs at either
  brand" rule can no longer carry a headshot borrowed from one brand over to
  the other.

Verified in the browser across six cases (social/print × photo, headshot-only,
neither): print with no brand photo shows the ghost and the notice and never
the headshot; social falls back to the headshot; the stand-in is ignored
outside admin mode; and an exported PNG of an empty print slot is plain
background, with nothing in the saved design data.

---

## The photo was never reaching the member (23 Sep 2026)

Danielle set a brand-approved photo for The Property Experts in Contacts and
it did not appear on a canvassing card. The Studio was not at fault and
neither was Contacts — nothing joined them.

- Contacts writes `agent_profiles.brand_photo_url`, per person per brand.
- The Studio reads `kit.brandPhoto`.
- The member's kit comes from `member_brand_kits.kit`, which only ever holds
  what the member themselves saved. Nothing copied one to the other.

`syncBrandCache` (src/lib/brand-cache.js) now looks it up alongside the kit:
`contacts` by `user_id` → `agent_profiles` by `contact_id` → the row whose
`brand` matches the kit's company, else `is_primary`, else the first one that
has not `left_at`. It is refreshed on every sync rather than stored in the
member's own kit, so someone at TMKE changing it reaches the member without
them re-saving anything, and there is no field in the Brand Kit for them to
edit it away. A failed lookup returns "leave it alone" rather than clearing
what is there.

### Two things this needs from the Admin Centre

**1. A member has to be able to read their own rows.** The lookup runs in the
member's browser under their own session. `contacts.astro` goes through the
service role specifically to avoid `agent_profiles`'s `is_admin()` check,
which suggests a member cannot read that table at all — in which case this
lookup quietly returns nothing and the ghost still shows. It needs either a
policy along the lines of *a member may read the `agent_profiles` rows whose
`contact_id` is the contact carrying their `user_id`* (the photo url and
brand are enough; nothing else on that table need be exposed), or a Worker
endpoint that returns the photo for the signed-in member.

I could not test which it is from here without a member session.

**2. Switching brand does not swap the photo yet.** The switcher hands over a
kit from `brand_profiles`, which holds no brand photo — the photo belongs to
(person, brand), not to the brand. So a dual-brand agent gets whichever photo
the sync put on the kit, on both brands. A Letting board must not carry the
Property picture, so this wants solving before dual-brand print goes out:
either `__TMKE_SET_BRAND_KIT__` is handed the right `brandPhoto` with the kit,
or it looks it up per brand the way the sync does.

Verified on the Studio side: a print design with a photo slot and a kit
carrying `brandPhoto` fills the slot with it and hides the notice; the same
design with no `brandPhoto` shows the ghost and the notice. The rule itself is
unchanged — print takes the brand photo or nothing.

---

## Both of those, answered (23 Sep 2026, Admin Centre)

**1. Reading it as a member: `member_brand_photo()`.**
`supabase/member_brand_photo.sql` — a `security definer` function, granted to
`authenticated`, returning one text field:

```js
const { data: photo } = await supabase.rpc('member_brand_photo', { p_brand: company });
// or .rpc('member_brand_photo') for their primary brand
```

Not a policy on `agent_profiles`. That table holds join dates, packages,
trainer details and a 100%-discount promo code, and none of that needs to be
readable by the person it describes just so a photograph can load. The
function matches the member the same way `member_brands()` does — by
`user_id`, falling back to the email on the JWT for someone whose contact has
not been linked yet — and skips a row with `left_at` set.

**2. Which also answers the brand switcher.** Pass the brand and you get that
brand's photo; pass nothing and you get their primary one. So
`__TMKE_SET_BRAND_KIT__` can ask for the photo belonging to (person, brand)
rather than inheriting whatever the sync last wrote. A Letting board stops
being able to carry the Property picture.

A member with no photo gets `null`, which your lookup already treats as
"leave it alone".

---

## Merge tags were resolving in the admin studio (23 Sep 2026, Admin Centre)

Designing as a brand wrote the *designer's own details* into the design.
Danielle saw her name, job title, telephone and email — from the member kit
cached in that browser, not from her admin account — filled into a template's
footer in the admin studio.

Two causes, both in `reapplyBrandToDesign` / `__TMKE_SET_BRAND_KIT__`:

- The text loop that re-resolves tags had no `isAdminMode()` guard. Only the
  logo/headshot/photo fills below it were guarded.
- `__TMKE_SET_BRAND_KIT__` folds `ownBrand()` in so a member keeps their own
  name and patch across a brand switch — right for a member, wrong for an
  admin, whose own kit is cached in the same browser like anybody else's.

**A tag IS the placeholder when you are the one making the template.** Fixed
both, and added `restoreMergeTags()`: on opening a template in admin mode,
any text where `mergeOut` still equals `text` is put back to `mergeSrc`, with
a toast saying how many. That substitution was entirely ours, so undoing it
is safe — and a template already saved with somebody's real name in it heals
when an admin next opens it, rather than waiting to be noticed.

Touched `public/scripts/editor.js`, which is yours — small and contained, but
worth a look, and worth knowing a template saved earlier today may have had
real details in it.
