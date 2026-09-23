# Millimetres on print, pixels on screen

**For: the Design Studio chat. From: the Admin Centre chat. 23 Sep 2026.**

Nobody sets a postcard up in pixels. You place a logo 12mm from the trim and
set the body at 9pt, and every printer, proof and brand guideline in the
industry speaks that language. Right now the inspector says `x: 142` on an A6
and the designer has to do arithmetic to know whether that clears the cut.

**Nothing about how a design is stored changes.** Pixels stay the truth on
disk, in the render and in the export. This is a display layer on the number
boxes and one line in the top bar.

## What the editor already knows

All of it, which is why this is small:

- `sizeFamily(W, H)` → `"print"` or `"social"`, from the resize cards
- `printBleed(W, H)` → the bleed in pixels for that size
- `300 / 25.4` px per mm — already in `guides.print.zones`
- the trim line is already drawn

## The conversion

```
mm  = px / (300 / 25.4)          // 11.811 px per mm
pt  = px / (300 / 72)            // 4.1667 px per pt
```

## The three decisions

**1. Measure from the trim, not from the canvas.** `x: 0` is the corner of the
finished card. Artwork in the bleed reads `-3mm`, which is correct and is how
every print designer already thinks: the only edge that exists once it is cut
is the cut. Measuring from the bleed corner would make "10mm from the edge"
mean 13mm, which is the kind of thing that ships wrong.

**2. Type in points, not millimetres.** A 9pt body is 37.5px at 300dpi. Nobody
has ever specified 3.2mm type. Font size switches to pt on a print canvas and
stays px on social.

**3. Pixels remain the truth; mm is a view of them.** Show to 0.1mm, and only
write pixels back when the field is actually edited. If every focus/blur
re-derives px from a rounded mm, tabbing through the inspector walks an
element across the page one rounding error at a time.

## Also worth doing while you are in there

The top bar says `1819 × 1311` on an A6 landscape, which is the file the
printer wants — 148 × 105mm plus 3mm bleed all round, at 300dpi. It is
correct and it is baffling, and it cost Danielle a puzzled minute today.

On a print canvas it should lead with the finished size:

```
148 × 105 mm        (1819 × 1311 px)
```

Social is unchanged — pixels are the real unit there.

## Optional, if it is cheap

Arrow-key nudge in round numbers on print: 0.5mm a tap, 5mm with shift. A
1px nudge is 0.08mm, which is not a distance anybody means.

## Notes

- Designs made before the size list — an A-size or the old business card with
  no bleed — already count as print via `sizeFamily`'s fallback. They have
  `printBleed` 0, so the trim origin is the canvas origin and mm still reads
  correctly.
- A member never sees a print canvas they did not choose, so there is no
  migration and nothing to explain to anyone already mid-design.
