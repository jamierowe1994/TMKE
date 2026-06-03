# Archived — "Luffu-style" pinned hand/phone scene (Chapter 05 v1)

Saved 2026-05-30. This was the first redesign of the TMKE homepage Chapter 05
("The Edit") — a full-screen, scroll-snapping scene where a hand holds a phone
and the phone screen slides sideways between three stages over a soft drifting
gradient. The client passed on it for TMKE, but it's a self-contained, reusable
section (intended for the **GetBacked** project).

## What it needs
- **Asset:** `public/assets/hand.png` — a hand holding a phone with a **green
  chroma screen**. The screen content is positioned over the measured green
  region: left `30.33%`, top `29.95%`, right `63.93%`, bottom `86.4%` of the
  1500×2000 image. The `.edit-phone` overlay bleeds slightly past that so no
  green leaks at the edges.
- **Asset:** `public/assets/image.webp` — templates collage (one of the screens).
- **Smooth scroll:** assumes a Lenis instance exposed on `window.__lenis`
  (`.on('scroll', fn)` + `.scrollTo(y, {duration, easing})`). Falls back to the
  native `scroll` event if absent (snap won't fire without Lenis, but stages
  still change via IntersectionObserver).
- CSS custom props used elsewhere in TMKE: `--serif`, `--sans`, `--ink`,
  `--english-violet`, `--paper`. Swap for your own.

## How it works
- The section is `350vh` tall with a `position: sticky` pin. Three invisible
  full-height `.edit-snap` anchors mark the stages.
- An IntersectionObserver (centre line) flips `data-stage` on the section,
  which crossfades the headline and shifts the background colour.
- A scroll handler writes a continuous `--screen-pos` (0..N) that translates the
  horizontal `.edit-track`, so the phone reads as scrolling sideways.
- A debounced `lenis.scrollTo` "pings" to the nearest stage once scrolling
  settles inside the pinned region (scoped so the rest of the page scrolls free).

---

## Markup (Astro / plain HTML)

```html
<section id="edit" class="edit-scene" data-stage="0">
  <div class="edit-pin">
    <div class="edit-bg" aria-hidden="true">
      <span class="edit-blob edit-blob--a"></span>
      <span class="edit-blob edit-blob--b"></span>
    </div>

    <div class="edit-head">
      <div class="chapter chapter--center edit-head-chapter">Chapter 05 &mdash; The Edit</div>
      <div class="edit-head-stages">
        <div class="edit-head-stage" data-stage="0">
          <h2 class="edit-head-title">The Edit</h2>
          <p class="edit-head-copy">Ready-made social media assets, built for estate agents &mdash; professional, polished, and ready to make yours.</p>
        </div>
        <div class="edit-head-stage" data-stage="1">
          <h2 class="edit-head-title">Designed for property. <em>Made yours.</em></h2>
          <p class="edit-head-copy">Every asset is built around the content pillars that actually work for the sector. Pick a template, drop in your brand, and it&rsquo;s ready to post.</p>
        </div>
        <div class="edit-head-stage" data-stage="2">
          <h2 class="edit-head-title">Templates. <em>Updated monthly.</em></h2>
          <p class="edit-head-copy">A curated shop that keeps growing. Pick what you need and post with confidence.</p>
          <a class="edit-cta edit-head-cta" href="/edit">
            <span class="edit-cta-label">Browse the Edit</span>
            <span class="edit-cta-arrow" aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </div>
    </div>

    <div class="edit-stage-wrap">
      <div class="edit-hand">
        <img class="edit-hand-img" src="/assets/hand.png" alt="A hand holding a phone showing the TMKE Edit" />
        <div class="edit-phone">
          <div class="edit-track">
            <div class="edit-screen edit-screen--editor">
              <div class="ph-status"><span>9:41</span><span class="ph-status-ic" aria-hidden="true"></span></div>
              <div class="ph-body">
                <div class="ph-head">
                  <span class="ph-eyebrow">The Edit</span>
                  <span class="ph-chip">Live</span>
                </div>
                <div class="ph-feature">
                  <span class="ph-feature-tag">Just Listed</span>
                  <span class="ph-feature-title">Set the tone</span>
                </div>
                <div class="ph-thumbs">
                  <span class="ph-thumb"></span>
                  <span class="ph-thumb"></span>
                  <span class="ph-thumb"></span>
                </div>
                <div class="ph-palette">
                  <span class="ph-palette-label">Brand colour</span>
                  <div class="ph-palette-strip" aria-hidden="true">
                    <div class="ph-palette-track">
                      <i style="background:#5b4b7a"></i><i style="background:#7a4933"></i><i style="background:#1c1d22"></i><i style="background:#c9b79c"></i><i style="background:#8a6f4e"></i><i style="background:#473f54"></i>
                      <i style="background:#5b4b7a"></i><i style="background:#7a4933"></i><i style="background:#1c1d22"></i><i style="background:#c9b79c"></i><i style="background:#8a6f4e"></i><i style="background:#473f54"></i>
                    </div>
                  </div>
                </div>
                <div class="ph-btn">Make it yours <span aria-hidden="true">&rarr;</span></div>
              </div>
            </div>

            <div class="edit-screen edit-screen--catalog">
              <div class="ph-status"><span>9:41</span><span class="ph-status-ic" aria-hidden="true"></span></div>
              <div class="ph-body">
                <div class="ph-head">
                  <span class="ph-eyebrow">Packs</span>
                  <span class="ph-chip">12</span>
                </div>
                <div class="ph-packs" aria-hidden="true">
                  <span class="ph-pack is-on">Just Listed</span><span class="ph-pack">Sold</span><span class="ph-pack">Open House</span><span class="ph-pack">Lettings</span><span class="ph-pack">Market Tips</span>
                </div>
                <div class="ph-film" aria-hidden="true">
                  <div class="ph-film-track">
                    <span class="ph-tile" style="--g:linear-gradient(135deg,#5b4b7a,#9a86b8)"><b>New to Market</b></span>
                    <span class="ph-tile" style="--g:linear-gradient(135deg,#7a4933,#c9a07a)"><b>Price Reduced</b></span>
                    <span class="ph-tile" style="--g:linear-gradient(135deg,#2f2b3a,#6a6080)"><b>Open House</b></span>
                    <span class="ph-tile" style="--g:linear-gradient(135deg,#9a86b8,#e7ddef)"><b>Just Sold</b></span>
                    <span class="ph-tile" style="--g:linear-gradient(135deg,#5b4b7a,#9a86b8)"><b>New to Market</b></span>
                    <span class="ph-tile" style="--g:linear-gradient(135deg,#7a4933,#c9a07a)"><b>Price Reduced</b></span>
                    <span class="ph-tile" style="--g:linear-gradient(135deg,#2f2b3a,#6a6080)"><b>Open House</b></span>
                    <span class="ph-tile" style="--g:linear-gradient(135deg,#9a86b8,#e7ddef)"><b>Just Sold</b></span>
                  </div>
                </div>
                <div class="ph-btn">Pick this pack <span aria-hidden="true">&rarr;</span></div>
              </div>
            </div>

            <div class="edit-screen edit-screen--collage">
              <img src="/assets/image.webp" alt="A selection of TMKE social media templates" loading="lazy" decoding="async" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="edit-snap" data-stage="0" aria-hidden="true"></div>
  <div class="edit-snap" data-stage="1" aria-hidden="true"></div>
  <div class="edit-snap" data-stage="2" aria-hidden="true"></div>
</section>
```

## Controller (inline script)

```js
(function () {
  const scene = document.getElementById('edit');
  if (!scene) return;
  const anchors = scene.querySelectorAll('.edit-snap');
  const STAGES = anchors.length - 1; // max stage index

  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) scene.setAttribute('data-stage', e.target.dataset.stage);
    });
  }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
  anchors.forEach(function (a) { io.observe(a); });

  function sectionScroll() {
    return window.scrollY - (scene.getBoundingClientRect().top + window.scrollY);
  }
  function updatePos() {
    const vh = window.innerHeight;
    let pos = sectionScroll() / vh;
    pos = Math.max(0, Math.min(STAGES, pos));
    scene.style.setProperty('--screen-pos', pos.toFixed(4));
  }
  updatePos();
  window.addEventListener('resize', updatePos);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const easeOutExpo = function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  let timer = null, snapping = false;

  function nearestSnap() {
    const lenis = window.__lenis;
    if (!lenis || snapping) return;
    const vh = window.innerHeight;
    const s = sectionScroll();
    if (s < -0.5 * vh || s > (STAGES + 0.5) * vh) return; // only near the pin
    const docTop = scene.getBoundingClientRect().top + window.scrollY;
    const stage = Math.max(0, Math.min(STAGES, Math.round(s / vh)));
    const targetY = docTop + stage * vh;
    if (Math.abs(window.scrollY - targetY) < 6) return;
    snapping = true;
    lenis.scrollTo(targetY, { duration: 0.8, easing: easeOutExpo });
    setTimeout(function () { snapping = false; }, 880);
  }
  function onScroll() {
    updatePos();
    if (reduce || snapping) return;
    clearTimeout(timer);
    timer = setTimeout(nearestSnap, 150);
  }
  if (window.__lenis && typeof window.__lenis.on === 'function') {
    window.__lenis.on('scroll', onScroll);
  } else {
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();
```

## Styles (CSS)

```css
.edit-scene {
  position: relative;
  height: 350vh;
  --edit-bg: #f4f1e9;
  --blob-a: #e8e3d4;
  --blob-b: #ddd2e6;
  background: var(--edit-bg);
  transition: background 0.9s ease;
}
.edit-snap { position: absolute; left: 0; width: 1px; height: 100vh; pointer-events: none; }
.edit-snap[data-stage="0"] { top: 0; }
.edit-snap[data-stage="1"] { top: 100vh; }
.edit-snap[data-stage="2"] { top: 200vh; }
.edit-scene[data-stage="1"] { --edit-bg: #efe7ec; --blob-a: #ecd9e4; --blob-b: #f1ddc9; }
.edit-scene[data-stage="2"] { --edit-bg: #ece6f2; --blob-a: #d8cbe9; --blob-b: #c6b8df; }

.edit-pin { position: sticky; top: 0; height: 100vh; overflow: hidden; }

.edit-bg { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.edit-blob {
  position: absolute; display: block; border-radius: 50%;
  filter: blur(90px); opacity: 0.7; transition: background 0.9s ease; will-change: transform;
}
.edit-blob--a {
  width: 70vw; height: 70vw; top: -18vw; left: -10vw;
  background: radial-gradient(circle at 50% 50%, var(--blob-a), transparent 68%);
  animation: editBlobA 28s ease-in-out infinite;
}
.edit-blob--b {
  width: 64vw; height: 64vw; bottom: -22vw; right: -12vw;
  background: radial-gradient(circle at 50% 50%, var(--blob-b), transparent 68%);
  animation: editBlobB 34s ease-in-out infinite;
}
@keyframes editBlobA {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  33%      { transform: translate3d(8vw, 6vh, 0) scale(1.08); }
  66%      { transform: translate3d(-4vw, 10vh, 0) scale(0.96); }
}
@keyframes editBlobB {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  40%      { transform: translate3d(-7vw, -6vh, 0) scale(1.10); }
  70%      { transform: translate3d(5vw, -3vh, 0) scale(0.95); }
}

.edit-head { position: absolute; top: 9vh; left: 0; right: 0; z-index: 3; text-align: center; padding: 0 8vw; pointer-events: none; }
.edit-head-chapter { margin-bottom: 22px; }
.edit-head-stages { position: relative; min-height: 26vh; }
.edit-head-stage {
  position: absolute; left: 0; right: 0; top: 0;
  opacity: 0; transform: translateY(10px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.edit-scene[data-stage="0"] .edit-head-stage[data-stage="0"],
.edit-scene[data-stage="1"] .edit-head-stage[data-stage="1"],
.edit-scene[data-stage="2"] .edit-head-stage[data-stage="2"] { opacity: 1; transform: none; }
.edit-scene[data-stage="2"] .edit-head-stage[data-stage="2"] { pointer-events: auto; }
.edit-head-title { font-family: var(--serif); font-weight: 400; font-size: clamp(30px, 4vw, 58px); line-height: 1.04; letter-spacing: -0.02em; color: var(--ink); margin: 0 auto; max-width: 18ch; }
.edit-head-title em { font-style: italic; color: var(--english-violet); }
.edit-head-copy { font-family: var(--sans); font-size: clamp(14px, 1.15vw, 17px); line-height: 1.55; color: rgba(28, 29, 34, 0.62); margin: 18px auto 0; max-width: 52ch; }
.edit-head-cta { margin-top: 26px; display: inline-flex; }

.edit-stage-wrap { position: absolute; inset: 0; z-index: 2; }
.edit-hand { position: absolute; left: 50%; bottom: -7vh; transform: translateX(-50%); height: 96vh; aspect-ratio: 3 / 4; }
.edit-hand-img { display: block; width: 100%; height: 100%; object-fit: contain; }

/* Screen overlay positioned over the green chroma area of hand.png. */
.edit-phone {
  position: absolute;
  left: 29.5%; top: 29.2%; width: 35%; height: 58%;
  overflow: hidden; border-radius: clamp(20px, 3.4vh, 46px);
  font-size: clamp(7px, 1.45vh, 12px); background: #f6f4ef;
}
.edit-track { position: absolute; inset: 0; display: flex; width: 100%; transform: translate3d(calc(var(--screen-pos, 0) * -100%), 0, 0); will-change: transform; }
.edit-screen { position: relative; flex: 0 0 100%; width: 100%; height: 100%; overflow: hidden; background: #f6f4ef; }
.edit-screen--collage img { width: 100%; height: 100%; object-fit: cover; display: block; }

.edit-screen--editor { background: #f6f4ef; color: var(--ink); display: flex; flex-direction: column; }
.ph-status { display: flex; justify-content: space-between; align-items: center; padding: 1.1em 1.4em 0.4em; font: 600 0.95em/1 var(--sans); }
.ph-status-ic { width: 2.4em; height: 0.8em; border-radius: 2px; background: rgba(28, 29, 34, 0.5); }
.ph-body { flex: 1; display: flex; flex-direction: column; gap: 1.05em; padding: 0.6em 1.4em 1.4em; min-height: 0; }
.ph-head { display: flex; align-items: baseline; justify-content: space-between; }
.ph-eyebrow { font-family: var(--serif); font-size: 2.1em; letter-spacing: -0.02em; }
.ph-chip { font: 700 0.85em/1 var(--sans); letter-spacing: 0.18em; color: var(--english-violet); border: 1px solid rgba(91, 75, 122, 0.4); border-radius: 999px; padding: 0.3em 0.7em; }
.ph-feature { position: relative; flex: 1; min-height: 0; border-radius: 1.2em; overflow: hidden; background: linear-gradient(135deg, #5b4b7a, #9a86b8 50%, #7a6aa6); background-size: 220% 220%; animation: phFlow 9s ease-in-out infinite; }
@keyframes phFlow { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
.ph-feature-tag { position: absolute; top: 0.9em; left: 0.9em; font: 700 0.8em/1 var(--sans); letter-spacing: 0.16em; text-transform: uppercase; color: #fff; background: rgba(0, 0, 0, 0.22); padding: 0.35em 0.7em; border-radius: 999px; }
.ph-feature-title { position: absolute; bottom: 0.8em; left: 0.9em; font-family: var(--serif); font-size: 1.7em; color: #fff; }
.ph-thumbs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6em; }
.ph-thumb { aspect-ratio: 1; border-radius: 0.7em; background: #e6e0d4; }
.ph-thumb:nth-child(2) { background: #d9cfe2; }
.ph-thumb:nth-child(3) { background: #e7d9cb; }
.ph-palette { display: flex; flex-direction: column; gap: 0.5em; }
.ph-palette-label { font: 600 0.95em/1 var(--sans); color: rgba(28, 29, 34, 0.6); letter-spacing: 0.04em; }
.ph-palette-strip { overflow: hidden; }
.ph-palette-track { display: flex; gap: 0.55em; width: max-content; animation: phPalette 7s linear infinite; }
.ph-palette-track i { width: 1.6em; height: 1.6em; border-radius: 50%; display: block; flex: 0 0 auto; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08); }
@keyframes phPalette { from { transform: translateX(0); } to { transform: translateX(-50%); } }

.edit-screen--catalog { color: var(--ink); display: flex; flex-direction: column; }
.ph-packs { display: flex; gap: 0.5em; overflow: hidden; }
.ph-pack { flex: 0 0 auto; font: 600 0.9em/1 var(--sans); letter-spacing: 0.01em; padding: 0.55em 0.9em; border-radius: 999px; white-space: nowrap; background: #ece7dd; color: rgba(28, 29, 34, 0.7); }
.ph-pack.is-on { background: var(--english-violet); color: #f6f4ef; }
.ph-film { flex: 1; min-height: 0; overflow: hidden; border-radius: 1em; }
.ph-film-track { display: flex; gap: 0.7em; height: 100%; width: max-content; animation: phFilm 18s linear infinite; }
.ph-tile { position: relative; flex: 0 0 auto; width: 8.5em; height: 100%; border-radius: 0.9em; overflow: hidden; background: var(--g, #5b4b7a); }
.ph-tile::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 45%, rgba(0, 0, 0, 0.4)); }
.ph-tile b { position: absolute; left: 0.7em; right: 0.7em; bottom: 0.7em; z-index: 1; font: 700 0.95em/1.2 var(--sans); color: #fff; }
@keyframes phFilm { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.ph-btn { margin-top: auto; text-align: center; font: 600 1.05em/1 var(--sans); letter-spacing: 0.02em; color: #f6f4ef; background: var(--ink); border-radius: 999px; padding: 0.95em 1em; }
.ph-btn span { margin-left: 0.3em; }

@media (max-width: 880px) {
  .edit-head { top: 7vh; }
  .edit-head-title { font-size: clamp(26px, 7vw, 40px); }
  .edit-head-copy { font-size: 14px; }
  .edit-hand { height: 74vh; bottom: -4vh; }
}
@media (prefers-reduced-motion: reduce) {
  .edit-blob, .ph-feature, .ph-palette-track, .ph-film-track { animation: none; }
  .edit-head-stage { transition: none; }
}
```
