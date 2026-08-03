/** Install-this-app button.
 *
 *  Chrome decides on its own when to show the address-bar install icon, and
 *  once you've installed an app it stops offering it — even after you delete
 *  it, until the browser forgets. That leaves people with no visible way back
 *  in, which is exactly what happened here.
 *
 *  `beforeinstallprompt` lets us own that moment instead: the browser tells us
 *  the app is installable, we show our own button, and clicking it opens the
 *  same install dialog. Nothing is downloaded — the browser installs the page
 *  it is already on, which is why there is no file to fetch.
 *
 *  Chromium only. Safari has no equivalent and needs Share → Add to Dock by
 *  hand, so on Safari the button never appears rather than appearing and
 *  failing.
 */

export function wireInstallButton(buttonId) {
  if (typeof window === "undefined") return;
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  // Already running as an installed app? Then there is nothing to offer.
  const installed = window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
  if (installed) return;

  let deferred = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    // Chrome would otherwise show its own mini-infobar; we want the button.
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });

  btn.addEventListener("click", async () => {
    if (!deferred) return;
    btn.disabled = true;
    try {
      deferred.prompt();
      await deferred.userChoice;
    } catch (_) { /* dismissed — nothing to do */ }
    // The event is single-use: Chrome fires a fresh one if it's still
    // installable, so hide the button rather than leaving a dead control.
    deferred = null;
    btn.hidden = true;
    btn.disabled = false;
  });

  window.addEventListener("appinstalled", () => { deferred = null; btn.hidden = true; });
}
