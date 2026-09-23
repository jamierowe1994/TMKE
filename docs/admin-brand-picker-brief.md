# Designing as a brand, in the admin studio

**For: the Design Studio chat. From: the Admin Centre chat. 23 Sep 2026.**

The Brand pane in the admin studio opens with **"Make this design yours"** —
which, when you are the one making it, is a strange thing to be asked. Worse,
a TPE postcard gets designed in TMKE's colours and nobody sees what it will
actually look like until a member opens it.

So the admin Brand pane wants a different shape from the member's:

```
ADMIN                           MEMBER (unchanged)
  Designing as: [ brand ▾ ]       Make this design yours
  that brand's colours            their colours
  that brand's fonts              their fonts
  that brand's logos              their logos
  ...                             ...
  Make this design yours          —
```

**Pick a brand at the top.** Choosing one makes that brand's kit the active
kit, exactly as the member brand switcher already does — colours, fonts,
logos, merge tags, the lot. The design redraws in that brand.

**"Make this design yours" moves to the bottom** and stays. Danielle's reason,
in her words: *"There might be an instance where I duplicate something that I
created for TPE and I want to change it for PPE, and rather than changing
everything independently, I can just use that."* So it stops being the thing
you are greeted by and becomes the tool it actually is — a bulk recolour,
useful precisely when the brand has changed underneath a finished design.

## The endpoint

`GET /studio/brand-kits` on the Worker (`api.tmke.co.uk`), admin bearer token.
Staff only — it is every brand at once, which is not a thing a member should
be able to ask for.

```json
{
  "ok": true,
  "studio": { "brand": "The Marketing Experts (hub)", "kit": { … } },
  "brands": [ { "brand": "The Property Experts", "kit": { … } }, … ],
  "standIns": { "female": "https://…", "male": "https://…",
                "ghost": "/images/agent-photo-ghost.svg" }
}
```

Each `kit` is the **same shape the editor already reads**, built by the same
conversion a member's kit goes through — colours as `{ hex, name }`, fonts as
`{ heading, subheading, body }`, logos as an array. What you put on the canvas
is what a member of that brand will get.

`studio` is the hub's own kit, from the reserved `__studio__` row. It is the
one the studio opens in, so it belongs at the top of the list, named rather
than filed under the reserved key.

**Order the list** by `BRAND_ORDER` in `src/data/brands.js` — Danielle's own
order, already shared by the Brands page and the pack picker. A brand not on
that list goes after them, alphabetically, so nothing ever quietly vanishes.

## The decisions that matter

**This is admin-only.** `isAdminMode()` already tells you. A member's Brand
pane must not gain a brand picker from this work — theirs is the switcher in
`docs/brand-switcher-brief.md`, which offers only the brands they actually
work for.

**A design should remember the brand it was made as**, the same way the
member switcher already does with `canvas.brand`. A TPE postcard reopened
next week in TMKE colours is the same mistake one step later, and for a
template it is worse: it ships.

**Nothing is written to anybody's kit.** Picking a brand sets the active kit
for the session. `__TMKE_SET_BRAND_KIT__` already does exactly this.

**The stand-ins belong here too.** `standIns` comes back on the same call, so
the pane can offer "show me a person" while designing — see
`docs/agent-photo-brief.md`. Design-time only: it must not be able to reach a
saved design or an export.

## Notes

- `brandHalf()` in the Worker is the single place a brand profile becomes a
  kit; `brandKitFor()` (members) and this endpoint both go through it, so the
  two cannot drift.
- A brand with an empty kit comes back with nulls rather than being missing —
  picking it should show empty wells, not fail.
