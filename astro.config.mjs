// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tmke.co.uk',
  integrations: [
    sitemap({
      // Keep work-in-progress + private areas out of the public sitemap. Still
      // reachable via direct URL but not advertised to search engines. The legal
      // pages carry a noindex meta while they're pending sign-off, so keep them
      // out of the sitemap too (don't advertise a noindexed page).
      filter: (page) =>
        !/\/estate-agency(\/|$)/.test(page) &&
        !/\/deliver(\/|$)/.test(page) &&
        !/\/privacy(\/|$)/.test(page) &&
        !/\/cookies(\/|$)/.test(page),
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
});
