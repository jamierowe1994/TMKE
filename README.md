# TMKE — The Marketing Experts Hub

Marketing hub for TMKE: monthly content calendar, template library, training, community, and blog. Built as a static site, deployed on Railway.

## Pages

- `index.html` — Hub home (hero, May calendar phone preview, "Show You Around", Stop the Scroll, services, coming soon, founder quotes).
- `templates.html` — Template Library with sidebar filters, search, sort, and Classic/Contemporary style toggle.

## Local development

```bash
npm install
npm start
```

Then open http://localhost:3000.

## Deploy

Railway auto-detects via `railway.json` and `package.json`. The `start` script binds to `$PORT` provided by Railway.

## Stack

- Plain HTML / CSS / JS (no framework).
- Google Fonts: Cormorant Garamond + Darker Grotesque.
- `serve` for static hosting in production.
