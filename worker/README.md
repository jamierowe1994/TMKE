# TMKE Deliverables API (Cloudflare Worker)

A tiny Worker bound directly to the `tmke-deliverables` R2 bucket. It mints
multipart uploads, accepts file parts, completes/aborts uploads, lists, deletes
and streams files. **No R2 Access Key / Secret is needed** — the `BUCKET`
binding gives the Worker native R2 access. Every request is authenticated by
validating the caller's Supabase session token.

## One-time setup

1. Install deps:
   ```
   cd worker
   npm install
   ```
2. Edit `wrangler.toml` and set:
   - `SUPABASE_URL` → your Supabase project URL (same as `PUBLIC_SUPABASE_URL`)
   - `SUPABASE_ANON_KEY` → your Supabase anon key (public — safe to put here)
   - `ALLOWED_ORIGINS` → your site origins (already includes localhost + tmke.co.uk)
3. Add the service-role secret (needed for the public client gallery —
   `/g/meta` + `/g/file` read deliveries securely without exposing client data):
   ```
   npx wrangler secret put SUPABASE_SERVICE_ROLE
   # paste your Supabase service_role key (Project Settings → API). Server-side
   # only — it lives in the Worker, never in the site/browser.
   ```
4. Deploy:
   ```
   npx wrangler login        # first time only
   npx wrangler deploy
   ```
   Wrangler prints the Worker URL, e.g. `https://tmke-deliverables-api.<sub>.workers.dev`.

4. Put that URL in the site env as `PUBLIC_R2_WORKER_URL`:
   - Local: add to `.env`
   - Production: Railway → Variables

That's it — the admin Deliver tab will start uploading straight to R2.

## Bucket CORS

The browser uploads parts through this Worker (not directly to the bucket), so
you do **not** need to set bucket-level CORS. CORS for the Worker itself is
handled in `src/index.js` via `ALLOWED_ORIGINS`.

## Notes

- Parts are 50 MB (set in the site uploader). A 10 GB file = ~200 parts, each
  retried independently on failure.
- Auth currently allows any logged-in Supabase user (matches the admin gate).
  To restrict to specific staff, add an email allowlist check in `getUser()`.
