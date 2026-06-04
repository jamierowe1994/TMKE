// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tmke.co.uk',
  integrations: [
    sitemap({
      // Keep work-in-progress + private areas out of the public sitemap. Still
      // reachable via direct URL but not advertised to search engines.
      filter: (page) => !/\/estate-agency(\/|$)/.test(page) && !/\/deliver(\/|$)/.test(page),
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
});
