# Editing a print template: one tab, every field, nothing else

**From: the Design Studio chat, 23 Sep 2026, on Danielle's spec. For her to
read first thing, and for the Admin Centre chat to know what is coming.**

Her words: *"the less there is on here, the less they can try to mess up. We
don't really want them adding anything, so we just need to give them the
ability to change everything that is there."*

## The idea

A print template is a form, not a canvas. A canvassing card has a street
name, a number of bedrooms, a price, three photographs and a footer — and the
agent's job is to put their own words in those places, not to design. So the
Studio's left rail, which exists to help someone build a design, is the wrong
furniture for it.

**Author side.** When an admin draws a text box, they can name what it is:
not "Text 1" but `Street name`, not "Text 2" but `Bedrooms`. The name is a
label on the element, saved with the template.

**Member side.** The Start tab becomes **Edit**: one row per named field, in
the order the author set, each one a box you type into. Everything the agent
needs to change, in one list, and nothing they don't.

## The rail, on a print template

| Tab | Her call | My view |
|---|---|---|
| Start → **Edit** | replaces Start | agreed — it becomes the whole job |
| Templates | remove | agreed: they opened the design they wanted |
| Elements | remove | agreed: nothing should be added to a print piece |
| Text | remove | agreed, **if** Edit covers size and colour where allowed |
| Images | keep | keep, but see below |
| Background | keep | agreed |
| Layers | remove | agreed |
| Brand kit | keep | agreed — it is the one place they change everything at once |

## The flaw worth naming

She asked. There is one, and it is about **Images**.

Her instinct — *"do we keep images, or do we just literally strip the whole
thing out so that they can only edit it from one place"* — is the right one,
and the answer is strip it. If a photograph is a field on the card, it belongs
in the Edit list as a field: a row that says `Front photograph` with the
picture in it and "Change" beside it. Leaving the Images tab as well gives two
ways to do one thing, and the second way is the one that lets someone drop a
fourth photograph onto a three-photograph card.

So: **Images goes too, and a photo field appears in Edit like any other.**
That also answers what happens when a slot is the agent photo — it is not
theirs to change, so it simply is not in the list.

The other thing to decide before building: **what happens to a field the
author never named.** A template drawn before this exists has no names on
anything, and an Edit tab that lists nothing is worse than no Edit tab. I
would fall back to listing every unlocked text box with its own first line as
the label — "New to the market in [Location]…" — so an unnamed template is
still editable, and naming is what makes it *good* rather than what makes it
work.

## What it depends on

- A `name` (and a `kind`: text / photo) on an element, written by the admin
  Studio and saved in the template. Nothing in the engine today carries it.
- Knowing a design is print, which it already does (`sizeFamily`).
- The lock states, which already exist: a field the member may edit is
  exactly a light-locked element, and the Edit list is arguably just "every
  light-locked element, in order". That may mean **no new element property at
  all** — the lock says which, the name says what to call it.

That last point is worth half an hour before any code: if Edit is a view of
the locks we already have, this is a much smaller job than it looks.

## Not started

Danielle asked for this first thing in the morning, before an afternoon
meeting. Nothing above is built.
