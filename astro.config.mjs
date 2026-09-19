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
        // The member hub and the admin centre: real pages, but empty until you
        // sign in, so there is nothing for a search engine to show. Listing
        // them spent Google's attention on blank shells instead of the pack
        // pages, and risked those shells turning up in results.
        !/\/account(\/|$)/.test(page) &&
        !/\/admin(\/|$)/.test(page) &&
        // Redirects into the hub (/studio, /dashboard, /profile, /editor) -
        // a sitemap should list the destination, not the signpost.
        !/\/(studio|dashboard|profile|editor)(\/|$)/.test(page) &&
        // Sign-in plumbing and one-off links sent to a person: nothing to find
        // in search, and "forgot password" ranking for the brand looks broken.
        !/\/(auth|forgot-password|reset-password|manage|edits|leave-a-review|review)(\/|$)/.test(page) &&
        !/\/privacy(\/|$)/.test(page) &&
        !/\/cookies(\/|$)/.test(page),
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
  image: {
    // Allow Astro to fetch + optimise the client's full-size R2 blog images at
    // build time (they ship as 4–9 MB PNGs; we downscale + convert to WebP).
    domains: ['assets.tmke.co.uk'],
  },
});
