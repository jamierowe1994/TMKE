/* TMKE — editorial home behaviours */
(function () {
  'use strict';

  // ---------- Lenis: floaty smooth scrolling ----------
  // easeOutExpo — strong deceleration, glides past then settles.
  const easeOutExpo = (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x));

  // Lenis is loaded with `defer` in BaseLayout, while this script is not —
  // so Lenis may not be defined yet when we hit this block. Poll briefly
  // for the class to become available, then instantiate. Once instantiated
  // the instance is exposed on window.__lenis so other scripts (e.g. the
  // Parade cinematic scroll-scrub) can hook into lenis.on('scroll', fn).
  const initLenis = () => {
    const lenis = new Lenis({
      duration: 1.6,
      easing: easeOutExpo,
      smoothWheel: true,
      wheelMultiplier: 1.05,
      touchMultiplier: 1.6,
      lerp: 0.08,
    });
    window.__lenis = lenis;

    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    // Anchor links — let Lenis handle the glide instead of native smooth-scroll.
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (!id || id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: 0, duration: 2.0, easing: easeOutExpo });
      });
    });
  };

  // The admin app shell (/admin) is a fixed, self-scrolling layout — `.ash` is
  // position:fixed/overflow:hidden and `.ash-content` does its own overflow
  // scrolling. Lenis would hijack the wheel and try to scroll the locked body
  // instead, so trackpad/wheel scrolling looks dead (only dragging the scrollbar
  // works). Skip Lenis entirely there; native scrolling of `.ash-content` is fine.
  const isAdminShell = location.pathname.startsWith('/admin') || !!document.getElementById('ash');
  if (!isAdminShell) {
    if (typeof Lenis !== 'undefined') {
      initLenis();
    } else {
      let attempts = 0;
      const wait = setInterval(() => {
        if (typeof Lenis !== 'undefined') { clearInterval(wait); initLenis(); }
        else if (++attempts > 50) { clearInterval(wait); } // ~5s ceiling
      }, 100);
    }
  }

  // ---------- Nav scrolled state ----------
  const nav = document.getElementById('nav');
  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 60);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Fallback for browsers without :has() — flag pages with a dark full-bleed
  // hero so the nav shows in white until the user scrolls (CSS handles the rest).
  if (document.querySelector('.about-hero, .smm-hero, .contact-hero')) {
    document.body.classList.add('has-dark-hero');
  }

  // ---------- Reveal on scroll ----------
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => revealObserver.observe(el));

  // Section-level "in" for hero / feature / news (drives bg motion).
  const rootObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          rootObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0 }
  );
  document.querySelectorAll('[data-reveal-root]').forEach((el) => rootObserver.observe(el));

  // Hero plays its opening sequence immediately.
  const hero = document.querySelector('.hero');
  if (hero) requestAnimationFrame(() => hero.classList.add('in'));

  // Hero video — only fade in once the browser has frames to render, so the
  // video never pops in once it finishes buffering. Falls back to a 2-second
  // safety reveal in case the events never fire (e.g. autoplay blocked).
  const heroVideo = document.querySelector('.hero-video');
  if (heroVideo) {
    const markReady = () => heroVideo.classList.add('is-ready');
    if (heroVideo.readyState >= 3) {
      markReady();
    } else {
      ['playing', 'canplaythrough', 'loadeddata'].forEach((ev) =>
        heroVideo.addEventListener(ev, markReady, { once: true })
      );
      setTimeout(markReady, 2000);
    }
  }

  // ---------- Scroll-driven typewriter for "Edit" ----------
  const tw = document.getElementById('edit-typewriter');
  if (tw) {
    const word = 'Edit';
    const textEl = tw.querySelector('.typewriter-text');
    const section = tw.closest('section');
    let lastCount = -1;
    const update = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      // Type as the top of the section moves from ~vh down to ~vh*0.35 (about 65% travel).
      const start = vh * 0.9;     // start typing when section is near the bottom of viewport
      const end   = vh * 0.35;    // finish typing as section reaches mid-viewport
      const range = start - end;
      const progress = Math.max(0, Math.min(1, (start - rect.top) / range));
      const count = Math.round(progress * word.length);
      if (count !== lastCount) {
        textEl.textContent = word.slice(0, count);
        lastCount = count;
      }
    };
    if (window.__lenis && typeof window.__lenis.on === 'function') {
      window.__lenis.on('scroll', update);
    } else {
      window.addEventListener('scroll', update, { passive: true });
    }
    window.addEventListener('resize', update);
    update();
  }

  // ---------- Approach: zoom-takeover controller (Ch 04 v3) ----------
  // The new pinned section uses ONE master --progress (0..1 across the
  // whole section) and derives everything else from it. The phases:
  //   [0.00, 0.10]  intro panel visible, photo contained
  //   [0.10, 0.22]  zoom-in: photo expands to fullscreen, intro fades
  //   [0.22, 0.85]  4 stages cross-fade behind the same overlay layout
  //   [0.85, 1.00]  zoom-out: photo shrinks back to contained
  // Parallax: a small Y drift derived from the current stage's local
  // progress, applied to every photo so they all feel "alive".
  const takeover = document.querySelector('.approach--takeover');
  if (takeover) {
    const frame = takeover.querySelector('.approach-frame');
    const photos = takeover.querySelectorAll('.approach-photo');
    const overlays = takeover.querySelectorAll('.approach-overlay--stage');
    const N_PHOTOS = photos.length;
    const N_OVERLAYS = overlays.length;

    // Phase boundaries — keep these in sync with the CSS comments.
    const ZOOM_IN_START = 0.10;
    const ZOOM_IN_END   = 0.22;
    const ZOOM_OUT_START = 0.85;
    const ZOOM_OUT_END   = 1.00;
    const STAGE_START    = ZOOM_IN_END;
    const STAGE_END      = ZOOM_OUT_START;

    // Eased interpolation helpers — slow but tasteful (the user's brief).
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const smooth  = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); }; // smoothstep

    // Trapezoid window: 0 outside [start - fade, end + fade], rises with
    // smoothstep over `fade` width on either side, and holds at 1 across
    // [start, end]. This gives each stage a "hold" period at full
    // brightness in the middle of its slot, plus a soft crossfade at the
    // boundaries — much cleaner than a triangle that's perpetually mid-fade.
    const window_ = (progress, start, end, fade) => {
      if (progress < start - fade) return 0;
      if (progress < start) return smooth((progress - (start - fade)) / fade);
      if (progress < end) return 1;
      if (progress < end + fade) return 1 - smooth((progress - end) / fade);
      return 0;
    };

    const updateTakeover = () => {
      const rect = takeover.getBoundingClientRect();
      const total = takeover.offsetHeight - window.innerHeight;
      const scrolled = Math.max(0, Math.min(total, -rect.top));
      const progress = total > 0 ? scrolled / total : 0;

      // 1. Master takeover (clip-path inset multiplier). The photo is
      //    contained at 0 and fullscreen at 1. Smoothstep both ends so
      //    the zoom feels slow at the start and end, gathering speed
      //    in the middle.
      let takeoverVal;
      if (progress < ZOOM_IN_START) {
        takeoverVal = 0;
      } else if (progress < ZOOM_IN_END) {
        takeoverVal = smooth((progress - ZOOM_IN_START) / (ZOOM_IN_END - ZOOM_IN_START));
      } else if (progress < ZOOM_OUT_START) {
        takeoverVal = 1;
      } else if (progress < ZOOM_OUT_END) {
        takeoverVal = 1 - smooth((progress - ZOOM_OUT_START) / (ZOOM_OUT_END - ZOOM_OUT_START));
      } else {
        takeoverVal = 0;
      }

      // 2. Intro overlay visibility — visible at the start, fading out
      //    in lockstep with the zoom-in so the title clears the way
      //    for the photo takeover.
      const introVis = 1 - takeoverVal;

      // 3. Per-stage windows. The stage band [STAGE_START, STAGE_END]
      //    is split evenly across N stages. Each stage gets a trapezoid
      //    "hold" window with a short fade on each side. v5 narrows the
      //    fade (16% → 10% of a slot) so each stage holds longer and
      //    feels deliberate when it lands.
      const stageRange = STAGE_END - STAGE_START;
      const slotSize   = stageRange / N_OVERLAYS;
      const slotFade   = slotSize * 0.10;

      // Write the master state variables. Per-photo scale + pan-y get
      // computed inside the per-stage loop below.
      frame.style.setProperty('--progress', progress.toFixed(4));
      frame.style.setProperty('--takeover', takeoverVal.toFixed(4));
      frame.style.setProperty('--intro-vis', introVis.toFixed(4));

      // Photo 0 — the *intro hero* (the original chapter-4 image). Holds
      // at full opacity from the section start, through the zoom-in,
      // until the moment stage 1 starts taking over. Then crossfades
      // out as stage 1 fades in. No swipe; just a very slow Ken Burns
      // scale-down through the zoom-in so the contained → fullscreen
      // morph reads as a single connected motion.
      const photo0Opacity = window_(progress, 0, STAGE_START, slotFade);
      frame.style.setProperty('--photo-0', photo0Opacity.toFixed(4));
      const photo0Scale = 1.10 - 0.06 * smooth(progress / STAGE_START);
      frame.style.setProperty('--scale-0', photo0Scale.toFixed(4));

      // Swipe helpers — each stage's photo + overlay slide in from the
      // right and out to the left as the user scrolls through the
      // section. The offset is interpolated as a pixel value (in vw)
      // so the swipe distance is viewport-relative and stays consistent
      // on any screen size.
      //   incomingX(progress, fadeStart) → +100vw at fadeStart, 0 at hold
      //   outgoingX(progress, fadeEnd)   → 0 at hold, -100vw at fadeEnd
      // Text uses a stronger multiplier so it visibly zooms past the
      // photo rather than scrolling at the same pace.
      const swipeOffset = (progress, fadeStart, fadeEnd, holdStart, holdEnd, magnitude) => {
        if (progress < fadeStart) return magnitude;            // off-right
        if (progress < holdStart) {
          const t = smooth((progress - fadeStart) / (holdStart - fadeStart));
          return magnitude * (1 - t);
        }
        if (progress < holdEnd) return 0;                       // in place
        if (progress < fadeEnd) {
          const t = smooth((progress - holdEnd) / (fadeEnd - holdEnd));
          return -magnitude * t;
        }
        return -magnitude;                                       // off-left
      };

      // Photos 1..N pair with overlays 1..N. Each photo (and its overlay)
      // swipes in from the right and out to the left over a wider
      // "alive" window than the inner hold. Opacity stays at 1 for the
      // whole alive window so the swipe motion is unbroken — the
      // photo's translateX is what carries it on and off the viewport,
      // not a fade.
      for (let i = 0; i < N_OVERLAYS; i++) {
        const slotStart = STAGE_START + i * slotSize;
        const slotEnd   = slotStart + slotSize;
        const fadeStart = slotStart - slotFade;     // photo starts entering
        const fadeEnd   = slotEnd + slotFade;       // photo finishes leaving
        const holdStart = slotStart + slotFade;
        const holdEnd   = (i === N_OVERLAYS - 1) ? slotEnd : slotEnd - slotFade;
        const isLast    = i === N_OVERLAYS - 1;

        // Photo: opacity 1 across the whole alive window so the swipe
        // reads as a horizontal pan rather than a fade.
        let photoOpacity = window_(progress, fadeStart, fadeEnd, 0.005);
        if (isLast && progress >= ZOOM_OUT_START) {
          photoOpacity = Math.max(photoOpacity, 1);
        }
        frame.style.setProperty('--photo-' + (i + 1), photoOpacity.toFixed(4));

        // Overlay text: keep a stricter hold window so each stage's
        // copy gets a clean readable moment, but use the same fade
        // length so the text and photo swipe arrive/leave in sync.
        // Gated by takeoverVal so overlays never appear during the
        // contained intro/outro phases.
        const overlayOpacity = window_(progress, holdStart, holdEnd, slotFade) * takeoverVal;
        frame.style.setProperty('--ov-' + (i + 1), overlayOpacity.toFixed(4));

        // Swipe X. Photo travels exactly a viewport-width; the text
        // travels 1.4× so it visibly "zooms past" — sells the pan.
        const photoX = swipeOffset(progress, fadeStart, fadeEnd, holdStart, holdEnd, 100);
        const textX  = swipeOffset(progress, fadeStart, fadeEnd, holdStart, holdEnd, 140);
        // The last stage shouldn't swipe out during the zoom-out — keep
        // it pinned at 0 so it shrinks back to contained without sliding.
        const finalPhotoX = (isLast && progress >= holdEnd) ? 0 : photoX;
        const finalTextX  = (isLast && progress >= holdEnd) ? 0 : textX;
        frame.style.setProperty('--photo-x-' + (i + 1), finalPhotoX.toFixed(2) + 'vw');
        frame.style.setProperty('--ov-x-'    + (i + 1), finalTextX.toFixed(2)  + 'vw');

        // Ken Burns "pulling back" pan — scale slowly eases from 1.10
        // when the photo arrives to 1.02 when it leaves. Coupled with a
        // soft Y drift (-12px → +12px) so the camera feels like it's
        // gently pulling away during the hold. Computed using a local
        // progress that spans the entire alive window so the motion is
        // continuous from slide-in through hold to slide-out.
        const alive = Math.max(0, Math.min(1, (progress - fadeStart) / (fadeEnd - fadeStart)));
        const stageScale = 1.10 - 0.08 * smooth(alive);
        const stagePanY  = -12 + 24 * smooth(alive);
        frame.style.setProperty('--scale-' + (i + 1), stageScale.toFixed(4));
        frame.style.setProperty('--pan-y-' + (i + 1), stagePanY.toFixed(2) + 'px');
      }
    };

    if (window.__lenis && typeof window.__lenis.on === 'function') {
      window.__lenis.on('scroll', updateTakeover);
    } else {
      window.addEventListener('scroll', updateTakeover, { passive: true });
    }
    window.addEventListener('resize', updateTakeover);
    updateTakeover();

    // ---------- Snap-to-stage (Ch 04) ----------
    // Free scrolling can strand the user mid-transition ("halfway house").
    // The section has a handful of clean rest states: the contained intro,
    // each fullscreen stage, and the zoomed-out outro. This waits for the
    // scroll to settle, reads travel direction, and glides to the right rest
    // state so a stage always lands cleanly. Hysteresis (COMMIT) means a small
    // nudge inside a stage snaps back to it rather than skipping ahead.
    const lenis = window.__lenis;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (lenis && typeof lenis.scrollTo === 'function' && !prefersReduced) {
      // Snap targets in master-progress space, derived from the same phase
      // constants the renderer uses above.
      const slot = (STAGE_END - STAGE_START) / N_OVERLAYS;
      const snaps = [ZOOM_IN_START * 0.5];                                  // contained intro
      for (let i = 0; i < N_OVERLAYS; i++) snaps.push(STAGE_START + (i + 0.5) * slot); // stage holds
      snaps.push(ZOOM_OUT_END - (ZOOM_OUT_END - ZOOM_OUT_START) * 0.15);   // contained outro

      const COMMIT = 0.3;     // fraction of a gap you must cross to commit forward/back
      const EPS = 0.008;      // "already there" tolerance
      const SETTLE_MS = 150;  // quiet period that counts as "stopped scrolling"

      let lastY = window.scrollY;
      let dir = 0;
      let settleTimer = null;
      let snapping = false;

      const metrics = () => {
        const rect = takeover.getBoundingClientRect();
        const total = takeover.offsetHeight - window.innerHeight;
        const scrolled = -rect.top;
        const progress = total > 0 ? Math.max(0, Math.min(1, scrolled / total)) : 0;
        const sectionTop = rect.top + window.scrollY;
        return { total, scrolled, progress, sectionTop };
      };

      // Choose a target snap point given current progress + travel direction.
      const pickTarget = (p, d) => {
        const first = snaps[0], last = snaps[snaps.length - 1];
        if (p <= first) return d > 0 ? first : null;   // entering — pull to intro; leaving up — let go
        if (p >= last)  return d < 0 ? last : null;    // leaving down — let go
        let prev = first, next = last;
        for (let i = 0; i < snaps.length - 1; i++) {
          if (p >= snaps[i] && p <= snaps[i + 1]) { prev = snaps[i]; next = snaps[i + 1]; break; }
        }
        const frac = (p - prev) / (next - prev);
        let t;
        if (d > 0) t = frac > COMMIT ? next : prev;
        else if (d < 0) t = frac < (1 - COMMIT) ? prev : next;
        else t = frac < 0.5 ? prev : next;
        return Math.abs(t - p) < EPS ? null : t;
      };

      const doSnap = () => {
        if (snapping) return;
        const { total, scrolled, progress, sectionTop } = metrics();
        if (total <= 0 || scrolled <= 1 || scrolled >= total - 1) return; // not pinned
        const target = pickTarget(progress, dir);
        if (target == null) return;
        const targetY = Math.round(sectionTop + target * total);
        const dist = Math.abs(targetY - window.scrollY);
        if (dist < 2) return;
        const dur = Math.min(1.0, Math.max(0.45, dist / 2600));   // longer glides for bigger jumps
        snapping = true;
        lenis.scrollTo(targetY, {
          duration: dur,
          easing: (t) => 1 - Math.pow(1 - t, 3),                  // easeOutCubic
          onComplete: () => { snapping = false; },
        });
        // Fallback unlock in case onComplete never fires (e.g. user interrupts).
        setTimeout(() => { snapping = false; }, dur * 1000 + 260);
      };

      const onSnapScroll = () => {
        const y = window.scrollY;
        if (y !== lastY) { dir = y > lastY ? 1 : -1; lastY = y; }
        if (snapping) return;
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(doSnap, SETTLE_MS);
      };

      lenis.on('scroll', onSnapScroll);
    }
  }

  // ---------- Approach: legacy cinematic-stages controller (no-op now) ----------
  const approach = document.querySelector('.approach:not(.approach--takeover)');
  if (approach) {
    const stages = approach.querySelectorAll('.approach-stage');
    const dots = approach.querySelectorAll('.approach-rail-dot');
    const fill = approach.querySelector('#approach-rail-fill');
    const N = stages.length;

    let activeIdx = -1;
    const setStage = (idx) => {
      if (idx === activeIdx) return;
      activeIdx = idx;
      stages.forEach((el, i) => {
        el.classList.toggle('is-active', i === idx);
        el.classList.toggle('is-leaving', i < idx);
      });
      dots.forEach((el, i) => el.classList.toggle('is-active', i === idx));
    };

    const updateApproach = () => {
      const rect = approach.getBoundingClientRect();
      const total = approach.offsetHeight - window.innerHeight;
      const scrolled = Math.max(0, Math.min(total, -rect.top));
      const progress = total > 0 ? scrolled / total : 0;
      const idx = Math.max(0, Math.min(N - 1, Math.floor(progress * N + 0.0001)));
      setStage(idx);
      if (fill) fill.style.height = (progress * 100) + '%';
    };

    if (window.__lenis && typeof window.__lenis.on === 'function') {
      window.__lenis.on('scroll', updateApproach);
    } else {
      window.addEventListener('scroll', updateApproach, { passive: true });
    }
    window.addEventListener('resize', updateApproach);
    updateApproach();

    // Editorial right-aside fades out as approach rises into view, so the
    // sticky copy doesn't get visually clipped by the pinned section above it.
    // The Ch 03 redesign drops the sticky positioning (the aside sits in its
    // own grid row underneath the lead), so this fade is scoped away from
    // the new variant via :not(.editorial-side--below).
    const editorialSide = document.querySelector('.editorial-side:not(.editorial-side--below)');
    if (editorialSide) {
      const updateAsideFade = () => {
        const rect = approach.getBoundingClientRect();
        const vh = window.innerHeight;
        // Full opacity while approach is more than 0.55vh below viewport top;
        // fully hidden by the time its top reaches the viewport top.
        const fadeStart = vh * 0.55;
        const t = rect.top / fadeStart;
        const opacity = Math.max(0, Math.min(1, t));
        editorialSide.style.opacity = String(opacity);
      };
      if (window.__lenis && typeof window.__lenis.on === 'function') {
        window.__lenis.on('scroll', updateAsideFade);
      } else {
        window.addEventListener('scroll', updateAsideFade, { passive: true });
      }
      window.addEventListener('resize', updateAsideFade);
      updateAsideFade();
    }
  }

  // ---------- News subscribe (placeholder) ----------
  const form = document.getElementById('news-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const btn = form.querySelector('button');
      if (!input || !input.value) return;
      const original = btn.textContent;
      btn.textContent = "You're in ✓";
      setTimeout(() => {
        btn.textContent = original;
        input.value = '';
      }, 2400);
    });
  }
})();
