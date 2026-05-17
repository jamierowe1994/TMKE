// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tmke.co.uk',
  integrations: [sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
});
