# One design is one design, however many sides it has

**For: the Design Studio chat. From: the Admin Centre chat. 23 Sep 2026.**

Danielle published a two-page postcard. Her pack now offers **two designs**,
"TPE Just Listed Postcard - Test — 01" and "— 02". In her words: *"It's not
two designs. It is one design. Anything with one page or multiple pages, if
it's in one design, it is one design."*

She is right, and it is not a display bug. `doPublish` in `editor.astro`
writes **one template row per page**:

```js
for (let i = 0; i < data.pages.length; i++) {
  rows.push({ name: data.filename + (data.pages.length > 1 ? " — " + pad(i+1) : ""),
              canvas: pg.canvas, elements: pg.elements, sort_order: i, ... });
}
```

A postcard has a front and a back the way a letter has a first and a second
sheet. One thing.

## What is ready for you

`templates.pages jsonb` — `supabase/template_pages.sql`. Same shape as
`designs.pages`, which a member's own work has used all along:

```json
[ { "canvas": {...}, "elements": [...] }, ... ]
```

**`canvas` and `elements` stay as they are, holding page one.** The catalogue,
the shop, the thumbnails and the size checker all read those and must carry
on working untouched. `pages` is additive.

## What needs doing

1. **Publish writes one row.** All pages into `pages`, page one also into
   `canvas`/`elements`, `thumb_url`/`render_url` from **page one** — which
   also fixes the cover showing the back of the card, because the preview is
   currently rendered from whichever page was open when you saved.
2. **Re-publish updates in place for any page count.** Today it only does
   that at `data.pages.length === 1`; with more it falls through to the insert
   branch, so re-publishing a two-page design leaves the originals and adds
   two more. Danielle has been told not to re-publish a multi-page design
   until this is fixed.
3. **Opening a pack design loads every page.** `__TMKE_OPEN_PACK_TEMPLATES__`
   shapes rows for the chooser; it needs to carry `pages` through, and
   `loadTemplate` needs to restore them.
4. **One card per design.** The chooser then naturally shows one, since there
   is one row. Page count is worth saying on the card — "2 pages" reads as a
   postcard rather than a mystery.

## Afterwards, not before

Existing split designs need merging back. The SELECT at the foot of
`template_pages.sql` lists them; it changes nothing. The merge itself should
wait until the reader above ships, or a merged design would show one page and
lose the other until it does.

## Notes

- The chooser now draws each card at the design's own canvas ratio
  (`w`/`h` on the shaped row), so a landscape postcard is no longer framed as
  a portrait. That part is done.
- Naming: with one row per design the "— 01" suffix has nothing to
  distinguish, so drop it. Page names, if they are ever wanted, belong on the
  page inside `pages`.

---

## Studio side: done (23 Sep 2026)

`templates.pages` was already there on the live database — probed before
building on it, since a migration has shipped unrun before.

**1. Publish writes one row.** `doPublish` in `editor.astro` builds a single
row: every page into `pages`, page one also into `canvas`/`elements`, and
`thumb_url`/`render_url` rendered from page one. The stored `pages` carry
`canvas` and `elements` only — the thumb and render data URLs are stripped,
so the row stays small. The "— 01" suffix is gone; the design keeps its name.

Verified on a two-page postcard **sat on page two**, which is the case that
used to advertise a postcard by its back: the row's cover comes from page
one, and the two pages genuinely render differently, so it is a fix rather
than a coincidence.

**2. Re-publish updates in place at any page count.** The `data.pages.length
=== 1` condition is gone. Both the update and the insert fall back to a
`pages`-less write if they hit a database that has not run
`template_pages.sql`, and say so rather than failing silently.

**3. Opening a pack design loads every page.**
`__TMKE_OPEN_PACK_TEMPLATES__` carries `pages` through, and `loadTemplate`
restores them via a new `pagesFromStore`, which gives each page the id and
name the editor expects — the database holds `{canvas, elements}` and no
more. A template without `pages` opens exactly as it always did.

Every read of a template now asks for `pages`, each with a fallback to the
old column list: the three pack fetches, and both admin fetches. The admin
ones matter as much as the member ones — reopening a published postcard
without its `pages` would have dropped the back the next time it was saved.

**4. One card per design**, and the card says `2 pages` on the cover when
there is more than one.

Verified in the Studio: a two-page row opens as one design on the front with
the back on page two; a single-page row opens with one page; the chooser
reports `pages: 2` and `pages: 1` respectively.

**Not done, deliberately:** nothing has been published or merged against the
live database. Merging the already-split designs is the step the brief puts
afterwards, and it is Danielle's to trigger now the reader ships.
