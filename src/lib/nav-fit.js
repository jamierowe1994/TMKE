/* The hub's top bar stays on one line (Danielle, 30 Oct: "We should never
 * have anything going over onto the hero, over two lines"). Between a phone,
 * where the tabs go into the burger, and a wide screen there is a stretch of
 * widths where eight tabs, Install app and the icons do not all fit, and
 * "Your SMM" broke onto two lines.
 *
 * The tab names never wrap (CSS, white-space: nowrap). When the row is still
 * too long, Install app steps out first -- it is in the browser's own menu
 * too -- and then the gaps between the tabs close up. Measured, not a
 * breakpoint, because the row's length changes with the install button
 * appearing and the fonts arriving. Shared by WorkspaceHeader and the
 * dashboard's own copy of the bar. */
export function fitNavRow(nav) {
  if (!nav) return;
  const tabs = nav.querySelector('.ws-tabs');
  const install = nav.querySelector('.ws-install');
  if (!tabs) return;
  const over = () => tabs.offsetWidth > 0
    && (tabs.scrollWidth > tabs.clientWidth + 1 || nav.scrollWidth > nav.clientWidth + 1);
  const fit = () => {
    tabs.style.gap = '';
    if (install) install.style.removeProperty('display');
    if (over() && install && !install.hidden) install.style.display = 'none';
    if (over()) tabs.style.gap = '12px';
  };
  fit();
  addEventListener('resize', fit);
  try { document.fonts && document.fonts.ready.then(fit); } catch (_) {}
  // Install app is unhidden later, once the browser says the hub can be installed.
  if (install) new MutationObserver(fit).observe(install, { attributes: true, attributeFilter: ['hidden'] });
}
