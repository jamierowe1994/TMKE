// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tmke.co.uk',
  integrations: [
    sitemap({
      // Keep work-in-progress areas out of the public sitemap. They're still
      // reachable via direct URL but won't be advertised to search engines.
      filter: (page) => !/\/estate-agency(\/|$)/.test(page),
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
});
