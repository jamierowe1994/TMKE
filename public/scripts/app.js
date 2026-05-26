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

  // ---------- Approach: pinned cinematic stages ----------
  const approach = document.querySelector('.approach');
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
      // 5 stages spread over progress 0–1, each slot 1/N wide.
      // Add 0.5 / N offset so a stage is centered in its slot.
      const idx = Math.max(0, Math.min(N - 1, Math.floor(progress * N + 0.0001)));
      setStage(idx);
      if (fill) fill.style.height = (progress * 100) + '%';
    };

    // Hook into Lenis if available for smoothest updates, else fall back to scroll.
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
