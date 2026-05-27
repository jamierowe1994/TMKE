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

  if (typeof Lenis !== 'undefined') {
    initLenis();
  } else {
    let attempts = 0;
    const wait = setInterval(() => {
      if (typeof Lenis !== 'undefined') { clearInterval(wait); initLenis(); }
      else if (++attempts > 50) { clearInterval(wait); } // ~5s ceiling
    }, 100);
  }

  // ---------- Nav scrolled state ----------
  const nav = document.getElementById('nav');
  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 60);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

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
      //    "hold" window with a short fade on each side so the
      //    transitions feel decisive rather than perpetually crossfading.
      const stageRange = STAGE_END - STAGE_START;
      const slotSize   = stageRange / N_OVERLAYS;
      const slotFade   = slotSize * 0.16; // ~16% of a slot is the fade window
      const holdWidth  = slotSize - slotFade * 2;

      // Parallax: a small pixel drift that oscillates within each
      // stage's slot — gives the photos a "breathing" feel even when
      // they're sitting in their hold period.
      const localT = ((progress - STAGE_START) % slotSize + slotSize) % slotSize / slotSize;
      const parallaxY = (localT - 0.5) * -24; // ±12px range, inverted

      // Write everything to the frame so cascading CSS picks it up.
      frame.style.setProperty('--progress', progress.toFixed(4));
      frame.style.setProperty('--takeover', takeoverVal.toFixed(4));
      frame.style.setProperty('--intro-vis', introVis.toFixed(4));
      frame.style.setProperty('--parallax-y', parallaxY.toFixed(2) + 'px');

      // Photo 0 — the *intro hero* (the original chapter-4 image). Holds
      // at full opacity from the section start, through the zoom-in,
      // until the moment stage 1 starts taking over. Then crossfades
      // out as stage 1 fades in.
      const photo0Opacity = window_(progress, 0, STAGE_START, slotFade);
      frame.style.setProperty('--photo-0', photo0Opacity.toFixed(4));

      // Photos 1..N pair with overlays 1..N. The first stage now needs
      // a fade-in window too (crossfading out of photo 0).
      for (let i = 0; i < N_OVERLAYS; i++) {
        const slotStart = STAGE_START + i * slotSize;
        const slotEnd   = slotStart + slotSize;
        const holdStart = slotStart + slotFade;
        const holdEnd   = (i === N_OVERLAYS - 1) ? slotEnd : slotEnd - slotFade;
        const w = window_(progress, holdStart, holdEnd, slotFade);
        // Overlays gated by takeoverVal so they only appear when the
        // photo is fullscreen (or near it).
        frame.style.setProperty('--ov-' + (i + 1), (w * takeoverVal).toFixed(4));
        // Photo (i+1) follows the overlay slot, with the last photo
        // pinned at full opacity through the zoom-out tail so it
        // doesn't pop off as the section exits.
        let photoOpacity = w;
        if (i === N_OVERLAYS - 1 && progress >= ZOOM_OUT_START) {
          photoOpacity = Math.max(w, 1);
        }
        frame.style.setProperty('--photo-' + (i + 1), photoOpacity.toFixed(4));
      }
    };

    if (window.__lenis && typeof window.__lenis.on === 'function') {
      window.__lenis.on('scroll', updateTakeover);
    } else {
      window.addEventListener('scroll', updateTakeover, { passive: true });
    }
    window.addEventListener('resize', updateTakeover);
    updateTakeover();
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
