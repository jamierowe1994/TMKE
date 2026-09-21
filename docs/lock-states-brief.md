# Two locks: dead lock and light lock

**For: the Design Studio chat. From: the Admin Centre chat.**

Print is the reason this is needed now. A board, a brochure or a window card
is drawn once by us and then goes to a printer with an agent's details on it.
Most of it has to be untouchable — the brand's colour bands, the logo's
position, the legal small print — while the parts that make it *theirs* still
have to be filled in. One lock can't do both jobs, so there are two, the way
Canva does it.

## The two states

**Dead lock.** Nothing is adjustable. It cannot be moved, resized, rotated,
restyled, recoloured, reordered or deleted, and its content cannot be edited.
It is in that place, at that size, in that colour. Selecting it should show
that it is locked and offer nothing else.

**Light lock.** The placement is fixed; the content is editable. The member
cannot move it, resize it, rotate it, change its font, size, colour, alignment
or layer order — but they can change what it *says* or what photo is *in* it.
A name, a phone number, a price, a headshot, a property photo.

Everything else stays as it is today: an element with neither lock is fully
editable, and admin mode can always change anything.

## Where the state lives

On the element, beside the existing `locked` flag:

```js
el.lock = "dead" | "light" | undefined
```

`el.locked === true` is the flag today, and it behaves as a dead lock. Read it
as `"dead"` when `el.lock` is absent so nothing already drawn changes meaning,
and write `el.lock` from now on. Don't migrate the stored designs: a template
saved before this went in is correct either way.

## What each state has to block

The checks matter more than the UI, because an element is reachable from more
than one place. Both locks must hold against: dragging on canvas, the resize
handles, rotate, arrow-key nudges, the Position popover, the properties panel
(font, size, colour, alignment, spacing, radius, opacity, shadow), Arrange
(forward/back/front/back), align and distribute, multi-select drag, group
operations, cut/copy/paste-over, delete and Backspace, and the "reset to
template" path.

A **light lock** lets exactly two things through:

- text: editing the words (typing, paste, the text box's own content), and
  merge tags resolving as normal
- image / frame: replacing the picture — Change image, drag-and-drop onto it,
  the picture chooser, brand headshot and logo slots filling themselves

It must **not** let through: the font controls, the colour controls, size,
alignment, letter spacing, line height, or anything geometric. If a member
types a much longer name, the box stays the size it is — that is the point of
the lock, and it is why an admin should size these boxes for the longest
plausible value.

## In the member's Studio

A light-locked element should feel like a field, not a design object. Clicking
it puts the caret in the text or opens the picture chooser; it does not show
resize handles. A dead-locked element ideally isn't selectable at all, or
selects with a plain "this part is fixed" note.

Nothing about this should appear in a member's UI as jargon. They never see the
words "dead lock" or "light lock" — they see a thing they can change and a
thing they can't.

## In the admin template builder

The Lock button in the properties panel becomes three states, on one control:

- **Unlocked** — as now
- **Fixed** (light lock) — "Stays put. They can change the words / the photo."
- **Locked** (dead lock) — "Can't be touched."

Show it on the element too, the way logo and headshot slots already carry a
tag: a small marker in admin mode only, so a design full of fixed fields can be
read at a glance. Multi-select should be able to set all three at once —
drawing a brochure means locking twenty things, and doing that one at a time is
how it doesn't get done.

## Why this is worth doing properly

Every print asset carries a printer's cost and an agent's name. A design a
member can accidentally drag out of alignment gets printed out of alignment,
and neither of us finds out until it is on a board outside a house. The lock is
the only thing standing between a template we drew and a hundred variations of
it we didn't.

## Notes

- `NO_BLOCK_SIZES` in `src/data/studio-sizes.js` and
  `docs/contact-blocks-contract.md` cover the contact-block side; this is
  separate, and applies to any template.
- Print packs, and who can see them, are done: `supabase/print_packs.sql`,
  `kind` / `access` / `brands` on `packs`, gated in RLS by the member's brand.
- The admin size checker (`/admin/sizes`) renders from stored elements, so it
  will show locked elements correctly without changes.
