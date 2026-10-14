/* The ready gate, from a page's own scripts.

   A page that sets `readyGate` on BaseLayout stays behind the loading cover
   until every section that shows real content says it is ready (see the
   comment in BaseLayout). These are the calls, and they are safe anywhere:
   on a page without the gate they do nothing, so a component shared between
   a gated page and an ungated one needs no checks of its own.

     gateWait("designs");               // before the work starts, if the
                                        // section has no data-gate in markup
     ...fetch, draw the real cards...
     gateReady("designs", rowEl);       // waits for rowEl's pictures too

     gateFailed("designs", rowEl);      // it did not load: the page shows its
                                        // own message there, and stops waiting

   Never draw sample or stand-in content while waiting. Dani, 14 Oct: "If the
   real thing is not ready to load, we do not show them anything." */

function gate() {
  try { return window.__tmkeGate && window.__tmkeGate.on ? window.__tmkeGate : null; } catch (_) { return null; }
}

export function gateOn() { return !!gate(); }

export function gateWait(name) {
  const g = gate();
  if (g) g.wait(name);
}

export function gateReady(name, el) {
  const g = gate();
  if (g) g.ready(name, el || null);
}

export function gateFailed(name, el) {
  if (el && el.setAttribute) el.setAttribute('data-gate-failed', '');
  const g = gate();
  if (g) g.ready(name, null);
}

/* Run something once the page is showing (true if it opened on the time
   limit rather than because everything was ready). */
export function whenGateOpen(fn) {
  const g = gate();
  if (g) g.whenOpen(fn); else fn(false);
}
