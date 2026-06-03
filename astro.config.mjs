// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tmke.co.uk',
  integrations: [
    sitemap({
      // Keep unlisted/private pages out of the sitemap (and search engines).
      filter: (page) => !page.includes('/videography/studio'),
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
});
