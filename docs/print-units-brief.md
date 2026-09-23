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

---

## Studio side: done (23 Sep 2026)

All of it, including the optional nudge. In `public/scripts/editor.js`, under
`// ---------- Print units ----------`: `PX_PER_MM`, `PX_PER_PT`, `trimOrigin`,
`pxToMm` / `mmToPx` (with a `fromTrim` flag), `pxToPt` / `ptToPx`, `mm1` and
`trimMm`. `isPrintDesign()` was already there from the agent-photo work and
decides which unit every one of these surfaces speaks.

- **X / Y / Width / Height** read millimetres on a print canvas, labelled
  `X (mm)`, step 0.1. Position measures from the trim, size measures itself.
  A box carries `data-unit="mm"` or `"mm-trim"`, and `bindGenericPropInputs`
  (and `bindRatioPair`, for the linked pair) converts back to pixels **only**
  in the change handler.
- **Font size** is points on print: `PT_PRESETS` in place of the pixel list,
  4–200pt, stepping 0.5. Points don't land on whole pixels, so the stored
  value keeps two decimals — 9pt is 37.5px. Rounding it made a box you typed
  9 into read back 9.1.
- **The top bar** leads with the finished size. Where the resize panel names
  the size, it reads `A6 Landscape · 148 × 105 mm`; where it doesn't — admin
  mode, a custom size, an older A-size with no bleed — it reads
  `148 × 105 mm (1819 × 1311 px)`, the brief's format. Keeping the name for
  members is the one deliberate deviation: it was already there and it is the
  clearest thing on the bar.
- **Arrow nudge** is 0.5mm a tap and 5mm with shift on print, unchanged at
  1px and 10px on screen.

Verified on an A6 landscape (1819 × 1311, 3mm bleed): a logo 10mm in from the
trim reads `10`; artwork at the canvas corner reads `-3`; typing `20` into X
puts the element at 271px, which is the bleed plus 20mm; typing `9` into the
size box stores 37.5px and reads back `9`. Eight full passes of
focus/blur/change across all four boxes without editing moved the element by
nothing — 271px before and after. Four taps of the arrow key moved it 2.03mm,
shift moved it 5.00mm. An A4 with no bleed (2480 × 3508) and the old business
card (1004 × 650) both read as print, measure from the canvas corner, and show
`210 × 297 mm` and `85 × 55 mm`. Social canvases are untouched: `X`, pixel
presets, 1px nudge, `Instagram Portrait` on the bar.

### Changed on Danielle's instruction, 23 Sep 2026

**Decision 1 is reversed: zero is the corner of the canvas, not the trim.**
She hit it within minutes of testing — something sitting on the edge read
`-3`, and a minus sign on the thing you have just placed at what looks like
zero reads as a bug, not as a convention.

Her reasoning, which is the right one for this audience: you cannot fold the
bleed into the axis, because everybody assumes they are starting from 0, and
then everything they place is three millimetres out. Where the cut falls is a
guide's job.

So the Print guide now carries the rule instead, in millimetres rather than
the pixels it used to imply:

- the cut line is drawn on every print canvas, switched on or not, and reads
  `Cut line — the 3mm outside it is trimmed off`
- the margin band reads `Cut at 3mm — keep words and logos 8mm in from the
  edge`, which is the number you would actually type into X

Everything else in the brief stands: millimetres on print, points for type,
the finished size on the top bar, the 0.5mm nudge, and pixels as the only
thing stored.

### And the bleed came off the canvas entirely, 23 Sep 2026

Danielle put a 148mm-wide picture on a 148mm postcard and got a gap down
both sides, because the canvas was 154mm: 148 plus 3mm of bleed on each
edge. Her instruction:

> The size of it has to be the size of a postcard that is printed. If it's
> 148 mm by 105 mm, the entire canvas has to be 148 mm by 105 mm, and then
> that 3 mm margin line is built within that.

So the print sizes in `src/data/studio-sizes.js` are now exactly what they
say — A6 landscape is 1748 x 1240, which is 148.0 x 105.0 mm at 300dpi — and
`PRINT_BLEED_MM` is now `PRINT_MARGIN_MM`: a line drawn 3mm inside the
canvas by the Print guide, reading "Keep words and logos inside this line —
3mm in from the edge". Nothing is added to a canvas and nothing is taken off
an axis.

A design saved while print canvases carried a bleed still reads as print
(`LEGACY_PRINT` in editor.js), so it keeps its millimetres.

If a printer needs bleed on a supplied file, that is a conversation to have
with the member — not something to do to their canvas behind their back.
