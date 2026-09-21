/* =============================================================
   TMKE Studio — the resize engine
   =============================================================

   Lifted out of editor.js so that two things can run it: the member's
   Studio, when they resize a design, and the admin size checker, when
   Danielle looks at how a template lands on the other sizes before anyone
   buys it. A copy of this maths in the admin centre would drift within a
   month and the check would start lying, which is worse than not checking.

   It works on a plain page — { canvas: { width, height }, elements: [...] } —
   and mutates it in place. The one thing it cannot do on its own is measure
   text, because that needs the fonts the host has loaded, so the host passes
   a textLineCount(el, size) in. */

export function createResizeEngine(deps) {
  const textLineCount = (deps && deps.textLineCount) || function () { return 1; };

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* Resizing a design rearranges it, not just the canvas.

     Changing only the canvas size left every element at its old pixel position,
     so portrait -> landscape pushed the bottom third off the page and portrait
     -> story left the design in the top half. Now each page is laid out again
     for the new size, one axis at a time:

     - Anything spanning the whole axis edge to edge (a background photo, a
       full-width band) stretches to the new edges.
     - Elements are sorted into "bands" along each axis (runs of elements that
       overlap there, e.g. a photo and the words on it). The bands keep their
       order and the space between them takes most of the change.
     - The margin is kept: RESIZE_MARGIN at a 1080 short side, scaled with the
       short side, so 100 on a portrait post stays 100 on a square or a story.
     - Anything centred on the canvas stays centred; left-aligned words stay on
       the left margin.

     Words follow their own rule. At the same width they already fit the line
     they had, so they keep their size and the pictures and gaps make the room;
     a story gets them a little larger (RESIZE_STORY_TEXT). When the width
     changes they scale with everything else. If the words cannot keep their
     size and still fit, everything scales together.

     Every resize starts from the design as it was before the first one, so
     trying Square, Story, Landscape and back to Square ends exactly where one
     click on Square would, rather than shrinking a little more each time. */
  const RESIZE_MARGIN = 100;          // px at a 1080 short side
  const RESIZE_GAP_FLOOR = 0.5;       // gaps may shrink to half the overall shrink, no further
  const RESIZE_MIN_TEXT = 8;          // smallest font size a resize will produce
  const RESIZE_STORY_TEXT = 1.25;     // words on a story, against the post they came from (30 -> 38)
  const RESIZE_TEXT_WIDEN = 1.5;      // how much wider a text box may get on a wider canvas
  const RESIZE_TITLE_SIZE = 50;       // text this big (at a 1080 short side) is a title, not a subheading
  const RESIZE_TITLE_SHRINK = 0.75;   // how far a title may come down to hold its line count
  const RESIZE_TITLE_LEADING = 0.9;   // line spacing for a title that has to take another line

  function resizeUnits(elements) {
    // A group moves and scales as one unit, so its members keep their layout.
    const byGroup = new Map();
    const units = [];
    elements.forEach((el) => {
      if (el.group) {
        if (!byGroup.has(el.group)) { const u = { els: [] }; byGroup.set(el.group, u); units.push(u); }
        byGroup.get(el.group).els.push(el);
      } else units.push({ els: [el] });
    });
    units.forEach((u) => {
      const x0 = Math.min.apply(null, u.els.map((e) => e.x || 0));
      const y0 = Math.min.apply(null, u.els.map((e) => e.y || 0));
      const x1 = Math.max.apply(null, u.els.map((e) => (e.x || 0) + (e.w || 0)));
      const y1 = Math.max.apply(null, u.els.map((e) => (e.y || 0) + (e.h || 0)));
      u.box = { x: [x0, x1], y: [y0, y1] };
      u.hasText = u.els.some((e) => e.type === "text");
    });
    // A shape or photo with words sitting inside it is their backing: it has
    // to stay big enough to hold them, so it follows the words' rule.
    units.forEach((u) => {
      if (u.hasText) return;
      u.holds = units.some((v) => v !== u && v.hasText &&
        v.box.x[0] >= u.box.x[0] - 2 && v.box.x[1] <= u.box.x[1] + 2 &&
        v.box.y[0] >= u.box.y[0] - 2 && v.box.y[1] <= u.box.y[1] + 2);
    });
    return units;
  }

  // "left" / "right" when a unit is words aligned to that side, else null.
  function textSide(u) {
    const al = u.els.map((e) => e.type === "text" ? (e.align || "left") : null);
    return al.every((v) => v === "left") ? "left" : al.every((v) => v === "right") ? "right" : null;
  }

  // Everything one axis needs: which units stretch, the bands the rest fall
  // into, and the region they are laid out in before and after.
  function resizeAxisPlan(units, ax, L, L2, M, M2) {
    const tol = Math.max(4, L * 0.02);
    const g = M > 0 ? M2 / M : L2 / L;          // how the margin itself scales
    const live = [];
    const other = ax === "x" ? "y" : "x";
    units.forEach((u) => {
      const [a, b] = u.box[ax];
      u[ax + "Bleed"] = a <= tol && b >= L - tol;
      // A divider running margin to margin keeps doing so.
      const thin = !u.hasText && u.box[other][1] - u.box[other][0] <= 8;
      u[ax + "Span"] = !u[ax + "Bleed"] && thin && Math.abs(a - M) <= tol && Math.abs(b - (L - M)) <= tol;
      if (!u[ax + "Bleed"] && !u[ax + "Span"]) live.push(u);
    });
    live.sort((p, q) => p.box[ax][0] - q.box[ax][0]);
    const bands = [];
    live.forEach((u) => {
      const [a, b] = u.box[ax];
      const last = bands[bands.length - 1];
      if (last && a < last.end) { last.end = Math.max(last.end, b); last.units.push(u); }
      else bands.push({ start: a, end: b, units: [u] });
      u[ax + "Band"] = bands[bands.length - 1];
    });
    const plan = { ax, L, L2, g, M2, bands, pref: Infinity, k: 1 };
    if (!bands.length) return plan;
    const A = Math.min(M, bands[0].start);
    const Z = Math.max(L - M, bands[bands.length - 1].end);
    const A2 = A * g, Z2 = L2 - (L - Z) * g;
    const sumB = bands.reduce((t, bd) => t + (bd.end - bd.start), 0);
    const cur = Z - A, target = Z2 - A2;
    const k = cur > 0 ? target / cur : 1;
    Object.assign(plan, { A, Z, A2, Z2, sumB, sumD: cur - sumB, target, k });
    // How much this axis would like everything scaled, when everything scales
    // together. Growing: by the growth. Shrinking: by less than the shrink,
    // letting the gaps give more.
    let pref = k;
    if (k < 1 && plan.sumD > 0.5 && sumB > 0) {
      pref = Math.sqrt(k);
      const floor = RESIZE_GAP_FLOOR * k;
      if ((target - sumB * pref) / plan.sumD < floor) pref = (target - plan.sumD * floor) / sumB;
      pref = clamp(pref, k, 1);
    }
    plan.pref = pref;
    return plan;
  }

  // How much each unit grows or shrinks across (kx) and down (ky), and its
  // words (kt). s is the layout scale; t, when set, is the words' own scale.
  function resizeUnitFactors(units, s, t, live, widen) {
    units.forEach((u) => {
      if (t == null || !(u.hasText || u.holds)) { u.kx = u.ky = u.kt = s; return; }
      // A band running edge to edge is stretched across anyway.
      const w = u.xBleed ? 0 : u.box.x[1] - u.box.x[0];
      if (u.els.length > 1 || u.holds) {
        // Several things together can't be rewrapped, so they scale as one,
        // no wider than the margins allow.
        const k = w * t > live ? Math.max(s, live / w) : t;
        u.kx = u.ky = u.kt = k;
        return;
      }
      // One text box: the words keep scale t; a box that would pass the
      // margins stays inside them and the words take another line instead.
      u.kt = t;
      const want = t * (widen || 1);
      u.kx = w * want > live ? Math.max(live / w, 0.01) : want;
      u.ky = t * t / u.kx;
    });
  }

  function bandLength(bd, ax, s) {
    let end = 0;
    bd.units.forEach((u) => {
      const [a, b] = u.box[ax];
      end = Math.max(end, (a - bd.start) * s + (b - a) * u["k" + ax]);
    });
    return end;
  }

  // The largest layout scale at which everything fits with the words at t,
  // or null when the words can't keep that size at all. Only used when the
  // width is unchanged, so only the height is checked: across, every text box
  // is already held inside the margins and the gaps beside it simply close.
  function resizeFixedText(plans, units, t, live, widen) {
    const fits = (s) => {
      resizeUnitFactors(units, s, t, live, widen);
      // Gaps give way twice as fast as pictures, down to the floor.
      const gap = Math.max(2 * s - 1, 0);
      return plans.every((p) => {
        if (p.ax !== "y" && !widen) return true;
        if (!p.bands.length) return true;
        const gf = Math.max(gap, RESIZE_GAP_FLOOR * Math.min(p.k, 1));
        const need = p.bands.reduce((n, bd) => n + bandLength(bd, p.ax, s), 0) + p.sumD * gf;
        return need <= p.target + 1;
      });
    };
    if (fits(1)) return 1;
    if (!fits(0.15)) return null;
    let lo = 0.15, hi = 1;
    for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
    return lo;
  }

  // Place every unit along one axis, given the layout scale s.
  function resizeAxisPlace(plan, units, s) {
    const { ax, L, L2, g, bands } = plan;
    units.forEach((u) => {
      if (!u[ax + "Bleed"]) return;
      const [a, b] = u.box[ax];
      const a2 = a * g, b2 = L2 - (L - b) * g;
      u[ax + "New"] = { start: a2, f: (b2 - a2) / Math.max(1, b - a) };
    });
    units.forEach((u) => {
      if (!u[ax + "Span"]) return;
      const [a, b] = u.box[ax];
      u[ax + "New"] = { start: plan.M2, f: (L2 - 2 * plan.M2) / Math.max(1, b - a) };
    });
    if (!bands.length) return;
    // gaps[0] is before the first band, gaps[n] after the last.
    const gaps = [bands[0].start - plan.A];
    bands.forEach((bd, i) => gaps.push((bands[i + 1] ? bands[i + 1].start : plan.Z) - bd.end));
    const lens = bands.map((bd) => bandLength(bd, ax, s));
    const spare = plan.target - lens.reduce((t, n) => t + n, 0);
    let gaps2;
    if (spare < plan.sumD) {
      // Less room: every gap gives up the same share of itself.
      const sg = plan.sumD > 0.5 ? Math.max(0, spare / plan.sumD) : 0;
      gaps2 = gaps.map((d) => d * sg);
      if (plan.sumD <= 0.5) { gaps2[0] += spare / 2; gaps2[gaps2.length - 1] += spare / 2; }
    } else {
      // More room: shared out evenly between the real gaps, so a design spreads
      // down a story instead of all the new space landing in its biggest gap.
      // Anything flush to a margin, or butted against its neighbour, stays so.
      const extra = spare - plan.sumD;
      const open = gaps.filter((d) => d >= 8).length;
      gaps2 = gaps.map((d) => d + (open && d >= 8 ? extra / open : 0));
      if (!open) {
        // Nothing to share it between. Left-aligned words keep to the left
        // margin (their box is often centred while the words are not), right-
        // aligned to the right; anything else is centred.
        const sides = ax === "x" ? units.filter((u) => !u.xBleed).map(textSide) : [];
        const side = sides.length && sides.every((v) => v === sides[0]) ? sides[0] : null;
        if (side === "left") gaps2[gaps2.length - 1] += extra;
        else if (side === "right") gaps2[0] += extra;
        else { gaps2[0] += extra / 2; gaps2[gaps2.length - 1] += extra / 2; }
      }
    }
    let pos = plan.A2 + gaps2[0];
    bands.forEach((bd, i) => {
      bd.start2 = pos;
      pos += lens[i] + gaps2[i + 1];
    });
    const ctol = Math.max(3, L * 0.01);
    units.forEach((u) => {
      if (u[ax + "Bleed"] || u[ax + "Span"]) return;
      const [a, b] = u.box[ax];
      const f = u["k" + ax];
      let start = u[ax + "Band"].start2 + (a - u[ax + "Band"].start) * s;
      if (Math.abs((a + b) / 2 - L / 2) <= ctol && !(ax === "x" && textSide(u))) start = (L2 - (b - a) * f) / 2;
      u[ax + "New"] = { start, f };
    });
  }

  // Everything measured in pixels that is not position or size. kt scales the
  // words, k everything else.
  function resizeElementDetail(el, kt, k) {
    const r = (v, f) => Math.round(v * f * 100) / 100;
    if (el.type === "text") {
      if (el.size) el.size = Math.max(RESIZE_MIN_TEXT, Math.round(el.size * kt));
      if (el.letterSpacing) el.letterSpacing = r(el.letterSpacing, kt);
      if (el.textOutline && el.textOutline.width) el.textOutline.width = r(el.textOutline.width, kt);
      if (el.textBg) ["padX", "padY", "radius"].forEach((p) => { if (el.textBg[p]) el.textBg[p] = r(el.textBg[p], kt); });
      if (el.textShadow) ["offsetX", "offsetY", "blur"].forEach((p) => { if (el.textShadow[p]) el.textShadow[p] = r(el.textShadow[p], kt); });
      // A light-locked field's drawn size moves with it (see fitLockedText).
      if (el.lockSize) el.lockSize = Math.max(RESIZE_MIN_TEXT, Math.round(el.lockSize * kt));
    }
    if (el.shadow) ["offsetX", "offsetY", "blur"].forEach((p) => { if (el.shadow[p]) el.shadow[p] = r(el.shadow[p], k); });
    if (el.radius) el.radius = r(el.radius, k);
    if (el.radii) Object.keys(el.radii).forEach((p) => { if (el.radii[p] != null) el.radii[p] = r(el.radii[p], k); });
    if (el.strokeWidth) el.strokeWidth = Math.max(1, r(el.strokeWidth, k));
    if (el.imgOffsetX) el.imgOffsetX = r(el.imgOffsetX, k);
    if (el.imgOffsetY) el.imgOffsetY = r(el.imgOffsetY, k);
  }

  // Work out how much everything scales, and the plans that place it.
  // Vertical first, across the whole page. Across is then worked out row by
  // row: a footer's headshot and logo spread to the margins of a landscape
  // with the band they sit on, rather than being pulled in to line up with
  // the photo above them.
  function resizeSolve(units, W, H, W2, H2, M, M2, live) {
    const py = resizeAxisPlan(units, "y", H, H2, M, M2);
    const rows = py.bands.map((bd) => bd.units).concat(units.filter((u) => u.yBleed).map((u) => [u]));
    const pxs = rows.map((row) => resizeAxisPlan(row, "x", W, W2, M, M2));
    const plans = [py].concat(pxs);

    let s = null;
    if (Math.abs(W2 / W - 1) < 0.02) {
      const toStory = H2 / W2 >= 1.7 && H / W < 1.7;
      const tries = toStory ? [RESIZE_STORY_TEXT, 1] : [1];
      for (const t of tries) {
        s = resizeFixedText(plans, units, t, live);
        if (s != null) break;
      }
      // Too many words to keep their size: shrink them only as far as they
      // must, rather than all the way down with everything else.
      if (s == null) {
        let lo = Math.min.apply(null, plans.map((p) => p.pref));
        if (isFinite(lo) && lo < 1 && resizeFixedText(plans, units, lo, live) != null) {
          let hi = 1;
          for (let i = 0; i < 14; i++) {
            const mid = (lo + hi) / 2;
            if (resizeFixedText(plans, units, mid, live) != null) lo = mid; else hi = mid;
          }
          s = resizeFixedText(plans, units, lo, live);
        }
      }
    } else if (W2 > W * 1.1 && H2 < H) {
      // Wider and shorter (a post going landscape): words may spread into the
      // new width, up to half as wide again, so they wrap onto fewer lines
      // and can stay larger than everything else shrinking would leave them.
      let lo = Math.min.apply(null, plans.map((p) => p.pref));
      if (isFinite(lo) && lo < 1 && resizeFixedText(plans, units, lo, live, RESIZE_TEXT_WIDEN) != null) {
        let hi = 1;
        for (let i = 0; i < 14; i++) {
          const mid = (lo + hi) / 2;
          if (resizeFixedText(plans, units, mid, live, RESIZE_TEXT_WIDEN) != null) lo = mid; else hi = mid;
        }
        s = resizeFixedText(plans, units, lo, live, RESIZE_TEXT_WIDEN);
      }
    }
    if (s == null) {
      s = Math.min.apply(null, plans.map((p) => p.pref));
      if (!isFinite(s)) s = Math.min(W2 / W, H2 / H);
      resizeUnitFactors(units, s, null, live);
    }
    return { s, py, rows, pxs, plans };
  }

  /* The grid posts, by hand.

     Four pictures in a 2x2 grid is the shape we use most, and Dani has set
     where it lands on a story or reel: the pictures keep their width and
     become RESIZE_GRID_BOX tall, the top pair starting at RESIZE_GRID_TOP and
     the bottom pair a hair below them; whatever sits under the grid (the rule
     and the line of text) keeps its size and moves down as one, to sit
     RESIZE_GRID_BOTTOM off the bottom. Measured at 1080 wide and scaled from
     there. Anything above the grid stays where it is.

     This runs instead of the general layout when the shape matches, so the
     template we use most lands exactly as she wants it rather than nearly. */
  const RESIZE_GRID_TOP = 200;
  const RESIZE_GRID_BOX = 660;
  const RESIZE_GRID_GAP = 4;
  const RESIZE_GRID_BOTTOM = 200;

  function resizeIsBleed(el, W, H) {
    const tx = Math.max(4, W * 0.02), ty = Math.max(4, H * 0.02);
    return (el.x || 0) <= tx && (el.x || 0) + (el.w || 0) >= W - tx &&
           (el.y || 0) <= ty && (el.y || 0) + (el.h || 0) >= H - ty;
  }

  // The four pictures of a 2x2 grid, or null when this isn't one.
  function resizeGridOf(elements, W, H) {
    const pics = elements.filter((e) => (e.type === "image" || e.type === "frame") && !resizeIsBleed(e, W, H));
    if (pics.length !== 4) return null;
    const w0 = pics[0].w, h0 = pics[0].h;
    if (!pics.every((e) => Math.abs(e.w - w0) <= 4 && Math.abs(e.h - h0) <= 4)) return null;
    const xs = [...new Set(pics.map((e) => Math.round(e.x / 4)))];
    const ys = [...new Set(pics.map((e) => Math.round(e.y / 4)))];
    if (xs.length !== 2 || ys.length !== 2) return null;
    const rows = [...new Set(pics.map((e) => e.y))].sort((a, b) => a - b);
    if (rows.length !== 2) return null;
    return { pics, rows };
  }

  function resizeGridPost(page, W2, H2) {
    const W = page.canvas.width, H = page.canvas.height;
    if (Math.abs(W2 / W - 1) > 0.02) return false;          // the width has to stay
    if (!(H2 / W2 >= 1.7 && H / W < 1.7)) return false;     // going to a story or reel
    const els = page.elements || [];
    const grid = resizeGridOf(els, W, H);
    if (!grid) return false;

    const k = W2 / 1080;
    const top = RESIZE_GRID_TOP * k, boxH = RESIZE_GRID_BOX * k;
    const rowY = [top, top + boxH + RESIZE_GRID_GAP * k];
    const gridTop0 = Math.min.apply(null, grid.pics.map((e) => e.y));
    const gridBottom0 = Math.max.apply(null, grid.pics.map((e) => e.y + e.h));

    // Anything sitting on a picture travels with it, keeping its distance from
    // whichever edge of the picture it was nearest.
    const riders = [];
    els.forEach((el) => {
      if (grid.pics.includes(el) || resizeIsBleed(el, W, H)) return;
      const host = grid.pics.find((p) => el.x >= p.x - 2 && el.x + el.w <= p.x + p.w + 2 &&
        el.y >= p.y - 2 && el.y + el.h <= p.y + p.h + 2);
      if (host) riders.push({ el, host, fromTop: el.y - host.y, fromBottom: (host.y + host.h) - (el.y + el.h) });
    });

    grid.pics.forEach((p) => {
      p.y = Math.round(rowY[p.y === grid.rows[0] ? 0 : 1]);
      p.h = Math.round(boxH);
    });
    riders.forEach((r) => {
      r.el.y = Math.round(r.fromTop <= r.fromBottom ? r.host.y + r.fromTop : r.host.y + r.host.h - r.fromBottom - r.el.h);
    });

    // Measure the words rather than trusting the height they were stored
    // with, so "200 off the bottom" is 200 off what you can see.
    els.forEach((el) => {
      if (el.type !== "text" || !el.text) return;
      const lines = resizeLineCount(el, el.size || 16, el.w || 1);
      el.h = Math.ceil(lines * (el.size || 16) * (el.lineHeight || 1.3));
    });
    // The rule and the words under the grid: same size, moved down together.
    const under = els.filter((el) => !grid.pics.includes(el) && !resizeIsBleed(el, W, H) &&
      !riders.some((r) => r.el === el) && el.y >= gridBottom0 - 2);
    if (under.length) {
      const wasBottom = Math.max.apply(null, under.map((el) => el.y + el.h));
      const dy = Math.round((H2 - RESIZE_GRID_BOTTOM * k) - wasBottom);
      under.forEach((el) => { el.y += dy; });
    }
    // Anything above the grid keeps its place, unless the grid moved down from
    // under it - then it travels with the gap it had.
    const above = els.filter((el) => !grid.pics.includes(el) && !resizeIsBleed(el, W, H) &&
      !riders.some((r) => r.el === el) && el.y + el.h <= gridTop0 + 2);
    const dTop = Math.round(top - gridTop0);
    if (dTop > 0) above.forEach((el) => { el.y += dTop; });

    // Backgrounds fill the new page.
    els.forEach((el) => {
      if (!resizeIsBleed(el, W, H)) return;
      el.x = 0; el.y = 0; el.w = W2; el.h = H2;
    });
    page.canvas.width = W2;
    page.canvas.height = H2;
    page.canvas.sizeChosen = true;
    return true;
  }

  // How many lines this text takes at a given size and box width.
  function resizeLineCount(el, size, w) {
    return textLineCount(Object.assign({}, el, { w: Math.max(1, w) }), Math.max(1, size));
  }

  /* Fit the words to the width they are about to have, BEFORE the final
     layout, so the layout works from the heights they will really be.

     A title that wraps onto an extra line is the thing that looks wrong: "Your
     Autumn Move" over two lines where it used to be one reads as a mistake
     rather than a design. So a title comes down in size, a little, to keep the
     number of lines it had. If it can't (RESIZE_TITLE_SHRINK is as far as it
     goes), the extra line is accepted and the lines are closed up to
     RESIZE_TITLE_LEADING, which is what a big two-line title wants anyway.
     Body copy is left to wrap as body copy does. */
  function resizeFitText(elements, units, W, H) {
    const big = RESIZE_TITLE_SIZE * Math.min(W, H) / 1080;
    let changed = false;
    units.forEach((u) => {
      u.els.forEach((el) => {
        if (el.type !== "text" || !el.text) return;
        const kt = u.kt || 1, kx = u.kx || 1, ky = u.ky || 1;
        const w0 = el.w || 1, w2 = Math.max(1, w0 * kx);
        let size = Math.max(RESIZE_MIN_TEXT, Math.round((el.size || 16) * kt));
        const was = resizeLineCount(el, el.size || 16, w0);
        let now = resizeLineCount(el, size, w2);
        let lh = el.lineHeight || 1.3;
        if ((el.size || 0) >= big && now > was) {
          const floor = Math.max(RESIZE_MIN_TEXT, Math.round(size * RESIZE_TITLE_SHRINK));
          for (let sz = size - 1; sz >= floor; sz--) {
            if (resizeLineCount(el, sz, w2) <= was) { size = sz; now = was; break; }
          }
          if (now > was && lh > RESIZE_TITLE_LEADING) { lh = RESIZE_TITLE_LEADING; el.lineHeight = lh; changed = true; }
        }
        // Store what the factors will turn into the wanted size and height.
        const h2 = Math.ceil(now * size * lh);
        const nextSize = size / kt, nextH = h2 / ky;
        if (Math.abs(nextSize - (el.size || 16)) > 0.01 || Math.abs(nextH - (el.h || 0)) > 0.5) changed = true;
        el.size = nextSize;
        el.h = nextH;
      });
    });
    return changed;
  }

  function resizePage(page, W2, H2) {
    const W = page.canvas.width, H = page.canvas.height;
    if (W === W2 && H === H2) return;
    const M = RESIZE_MARGIN * Math.min(W, H) / 1080;
    const M2 = RESIZE_MARGIN * Math.min(W2, H2) / 1080;
    const live = W2 - 2 * M2;
    if (resizeGridPost(page, W2, H2)) return;
    // Two passes: work out the scales, fit the words to them, then work the
    // scales out again from the heights the words will really have.
    for (let pass = 0; pass < 2; pass++) {
      const u0 = resizeUnits(page.elements || []);
      resizeSolve(u0, W, H, W2, H2, M, M2, live);
      if (!resizeFitText(page.elements, u0, W, H)) break;
    }
    const units = resizeUnits(page.elements || []);
    const { s, py, rows, pxs } = resizeSolve(units, W, H, W2, H2, M, M2, live);
    resizeAxisPlace(py, units, s);
    pxs.forEach((p, i) => resizeAxisPlace(p, rows[i], s));
    units.forEach((u) => {
      const nx = u.xNew, ny = u.yNew;
      u.els.forEach((el) => {
        el.x = Math.round(nx.start + ((el.x || 0) - u.box.x[0]) * nx.f);
        el.y = Math.round(ny.start + ((el.y || 0) - u.box.y[0]) * ny.f);
        el.w = Math.max(1, Math.round((el.w || 0) * nx.f));
        el.h = Math.max(1, Math.round((el.h || 0) * ny.f));
        resizeElementDetail(el, u.kt, Math.min(u.kx, u.ky));
      });
    });
    page.canvas.width = W2;
    page.canvas.height = H2;
    page.canvas.sizeChosen = true;
  }

  return {
    resizePage,
    resizeElementDetail,
    resizeGridOf,
    RESIZE_MARGIN, RESIZE_MIN_TEXT, RESIZE_STORY_TEXT,
    RESIZE_TITLE_SIZE, RESIZE_TITLE_SHRINK, RESIZE_TITLE_LEADING,
  };
}
