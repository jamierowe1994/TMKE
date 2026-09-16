# Hub course screenshots

One per lesson of "Getting around your hub": `dashboard`, `studio`, `shop`,
`planner`, `orders`, `bookings`, `brand-kit`, `learn`.

They are made, not taken by hand. `scripts/hub-course-shots.mjs` opens each page
of the hub in a headless browser, hides anything floating over it (the cookie
banner, the first-visit nudge), photographs it at 1600x1000 on a retina screen,
then sets that inside a browser window on the brand's wine and saves the result
at 1800px wide as JPEG — around 250KB each, and identical to one another.

Re-run it (with the site running on localhost:4321) whenever the hub changes:

    node scripts/hub-course-shots.mjs

A slide shows its image at 16:10 as a background, so anything is better than
nothing: an area with no image shows a tinted placeholder instead.
