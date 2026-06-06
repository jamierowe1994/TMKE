/* TMKE — front-end page transition.
   Two staggered panels sweep DOWN to cover the screen, the next page loads
   behind them, then they sweep DOWN and off the bottom to reveal it.

   The site is a classic MPA (every nav is a real reload), so the "reveal"
   half must already be covering before the new page paints. A tiny inline
   <head> script (in BaseLayout) reads sessionStorage['tmke:pt'] before paint
   and adds `html.pt-revealing`; this script plays the reveal-out, then handles
   the cover-on-click for the next navigation. */
(function () {
  'use strict';

  var FLAG = 'tmke:pt';
  // Must stay in step with --pt-cover in global.css. The two bars cover in
  // parallel (~0.8s); navigate with a touch of headroom so they've fully met.
  var COVER_MS = 860;

  var root = document.documentElement;
  var overlay = document.getElementById('page-transition');
  if (!overlay) return;

  var reduce = false;
  try {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) { /* matchMedia unavailable — treat as no preference */ }

  function lockScroll() { root.style.overflow = 'hidden'; }
  function unlockScroll() { root.style.overflow = ''; }

  function resetIdle() {
    overlay.classList.remove('is-covering', 'is-revealing');
    root.classList.remove('pt-revealing');
    unlockScroll();
    try { sessionStorage.removeItem(FLAG); } catch (_) { /* ignore */ }
  }

  // ---------- Reveal: arrived here via a transition ----------
  if (root.classList.contains('pt-revealing')) {
    try { sessionStorage.removeItem(FLAG); } catch (_) { /* ignore */ }

    if (reduce) {
      // No animation — just drop the cover immediately.
      resetIdle();
    } else {
      lockScroll();
      var revealed = false;
      var finishReveal = function () {
        if (revealed) return;
        revealed = true;
        resetIdle();
      };
      // Panels are pinned at translateY(0) by the critical CSS. Flip to the
      // reveal state on the next frame so the browser animates from covered.
      var playReveal = function () {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            root.classList.remove('pt-revealing');
            overlay.classList.add('is-revealing');
          });
        });
        // Both bars reveal in parallel over the same duration; clean up when the
        // left one ends, with a safety timeout in case the event is missed.
        overlay.addEventListener('animationend', function (e) {
          if (e.target && e.target.classList.contains('pt__panel--left')) finishReveal();
        });
        setTimeout(finishReveal, COVER_MS + 400);
      };
      // Hold the cover until the new page is actually ready — fonts loaded and
      // one paint done — so the reveal never exposes a half-rendered or
      // font-swapping page (the first-load flicker). Capped so a slow load
      // never leaves the cover hanging.
      var begun = false, readied = false;
      var begin = function () { if (begun) return; begun = true; playReveal(); };
      var ready = function () {
        if (readied) return;
        readied = true;
        if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
          document.fonts.ready.then(function () { requestAnimationFrame(begin); });
          setTimeout(begin, 800); // hard cap so the cover never hangs
        } else {
          begin();
        }
      };
      if (document.readyState === 'complete') ready();
      else {
        window.addEventListener('load', ready, { once: true });
        setTimeout(ready, 500); // don't wait on slow images/sub-resources
      }
    }
  }

  // ---------- Cover: intercept eligible internal link clicks ----------
  var navigating = false;

  function isEligible(a, e) {
    if (e.defaultPrevented) return false;
    if (e.button !== 0) return false;                       // left-click only
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    if (!a || a.id === 'nav-login') return false;           // login uses tmkeSplash
    if (a.target && a.target !== '_self') return false;     // new tab/window
    if (a.hasAttribute('download')) return false;
    if (a.closest('[data-no-transition]')) return false;

    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return false;      // same-page anchor
    var proto = (a.protocol || '').toLowerCase();
    if (proto === 'mailto:' || proto === 'tel:') return false;

    if (a.origin !== window.location.origin) return false;  // external

    var path = a.pathname || '';
    if (path === window.location.pathname && a.search === window.location.search) {
      return false;                                         // same page (e.g. #hash)
    }
    // Back-end destinations load normally — no cover.
    if (path.indexOf('/admin') === 0) return false;
    if (path === '/editor' || path === '/editor/') return false;

    return true;
  }

  function startCover(href) {
    if (navigating) return;
    navigating = true;
    try { sessionStorage.setItem(FLAG, '1'); } catch (_) { /* ignore */ }
    lockScroll();
    overlay.classList.add('is-covering');
    setTimeout(function () { window.location.href = href; }, COVER_MS);
  }

  document.addEventListener('click', function (e) {
    if (reduce || navigating) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || !isEligible(a, e)) return;
    e.preventDefault();
    startCover(a.href);
  });

  // ---------- bfcache: a restored page must never sit behind a panel ----------
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      navigating = false;
      resetIdle();
    }
  });
})();
