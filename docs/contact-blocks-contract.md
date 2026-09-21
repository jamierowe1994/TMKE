# Contact blocks (footers) — the shared contract

Two chats build this: the **Admin Centre** chat (this file's author) and the
**Design Studio** chat. This is the agreement between them, so neither has to
guess what the other stored.

## What a contact block is

A group of elements — name, job title, company, phone, email, website, a
location pin, a headshot — that a member drops into a design. It is designed in
the Studio in admin mode, like any template, and saved as a template row.

**The canvas it was drawn on is a workspace, not part of the block.** Danielle
will draw the four footers on a standard Instagram portrait canvas
(1080 × 1350). When a member adds one to a 1080 × 1080 post, or to an A5 print
sheet, nothing of that canvas comes with it: no size, no background colour, no
background image. Only the elements, as a group.

## The record

`templates` gains three columns (`supabase/contact_blocks.sql`):

| column | value |
| --- | --- |
| `kind` | `'template'` (default, every existing row) or `'block'` |
| `block_variant` | `contact-small`, `contact-small-photo`, `contact-full`, `contact-other` |
| `block_box` | `{ x, y, w, h, canvasW, canvasH }` in the drawing canvas's units |

`block_box` x/y/w/h is the tight bounding box round the block's elements;
`canvasW`/`canvasH` is the canvas it was drawn on. The Admin Centre computes
this when the block is marked, from the saved `elements`, and recomputes it
whenever the design is edited and re-marked.

`elements` and `canvas` stay exactly as the editor already writes them — no new
save format. A block row is a normal template row with `kind = 'block'`.

Members read blocks through the existing `templates read active` RLS policy, so
a block only reaches the Elements panel once its status is `active`.

## Inserting (Design Studio side)

Given the target design's canvas `T` and the block's `box`:

```
s = T.width / box.canvasW          // one scale factor, width-proportional
```

That is the whole rule: **a block takes up the same share of the width it took
up when it was drawn.** A footer that spanned 89% of a 1080-wide canvas spans
89% of any canvas, portrait, square or print.

Then, for each element, copy it and multiply every measurement by `s` —
`x`, `y`, `w`, `h`, font size, letter spacing, line height, corner radius,
stroke width, shadow offsets — after shifting it to the group's own origin:

```
el.x = (el.x - box.x) * s + dropX
el.y = (el.y - box.y) * s + dropY
```

Default drop position, if the member hasn't dragged it anywhere: keep the
margins it was drawn with, anchored to the bottom.

```
dropX = box.x * s
dropY = T.height - (box.canvasH - box.y) * s
```

If that pushes the block off the top of a short canvas, clamp `dropY` to a
bottom margin of `box.x * s` instead.

Do **not** copy: `canvas.background`, `canvas.bgSrc` or anything else on the
block's canvas; the block's own `id`; any element flagged as a backdrop.

Give every inserted element a shared `groupId` so the block moves and scales as
one thing. The member can move it, scale it and delete it; they do not restyle
the parts.

## Sizes a block isn't offered at

`NO_BLOCK_SIZES` in `src/data/studio-sizes.js` lists the canvases a contact
block is never offered on — a Facebook cover today. A footer is a strip of
details that sits on a design; a cover is 820 × 312 of almost nothing but
strip, so a footer scaled onto one stops being a footer.

The admin size check already honours it. The Elements panel should too: don't
offer blocks when the design is at one of those sizes.

## The placeholders

Text placeholders are the merge tags the editor already resolves — nothing new
in the format, `{like this}`. The set for footers:

One tag per brand-kit field, named the way the field is named. These eight are
the whole menu (`TAG_MENU` in `public/scripts/editor.js`):

| tag | filled from the brand kit |
| --- | --- |
| `{company name}` | `company` |
| `{area}` | `location` |
| `{slogan}` | `slogan` (or an older kit's `tagline`) |
| `{website}` | `website` — added to the brand kit in this change |
| `{agent name}` | `about.name` |
| `{job title}` | `about.role` |
| `{telephone}` | `about.phone`, falling back to `phone` |
| `{email}` | `about.email`, falling back to `email` |

Older spellings — `{company}`, `{brand}`, `{location}`, `{town}`, `{tagline}`,
`{phone}`, `{your name}`, `{role}` — still resolve (`TAG_ALIASES`), because the
catalogue is already written with them. They are off the menu and must stay
off it: four ways to print the company only invites templates that disagree.

Two are images, not text, and use the flag that already exists:

- headshot → `brandRole: "headshot"`
- logo → `brandRole: "logo"`

The **location pin is artwork, not a placeholder**: it is a shape or icon
element in the block, sitting beside a `{location}` text element. Nothing fills
it in.

### What the Studio chat needs to add to `public/scripts/editor.js`

1. ~~The merge tags~~ — done: `mergeTagMap()` reads the `about` fields, and the
   menu is the eight above.
2. Elements panel: list `kind = 'block'`, `status = 'active'` templates,
   grouped by `block_variant`, and insert per the maths above.
3. The Position/insert UI for a dropped group.

`{website}` already resolves from `BRAND.website`; the brand kit now writes it.

## One open question for Danielle

She listed both "a company name" and "the company that they work for". The
brand kit has one company field, so both currently resolve to the same value.
If those are meant to be different things for TEG agents — the agency name and
the brand above it — the kit needs a second field. Flagged, not guessed.
