# Videography — go-live setup checklist

Do these in order. Nothing here is code — it's credentials + settings that switch
on the upload, delivery, and booking features.

## 0. Gather these values first
- **Supabase URL + anon key** — Supabase dashboard → Project Settings → API
  (same as the site's `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`).
- **Supabase `service_role` key** — same page, under "Project API keys".
  ⚠️ Full-access secret. Only ever goes into the Worker — never the site/browser.
- **Microsoft client secret** — the value you saved from the Entra app.
- (Already known: MS client ID `543c20ac…`, tenant `bd9416b6…`, Jack `jack@tmke.co.uk`.)

## 1. Run the database tables (Supabase → SQL Editor)
Run each file's contents in a new query, in this order:
1. `supabase/videography.sql`
2. `supabase/videography_deliverables.sql`
3. `supabase/videography_deliveries.sql`

## 2. Deploy the Worker
In a terminal, from the `worker/` folder:
```
cd worker
npm install
```
Edit `wrangler.toml` and set:
- `SUPABASE_URL` = your Supabase URL
- `SUPABASE_ANON_KEY` = your anon key
(MS_CLIENT_ID / MS_TENANT_ID / JACK_UPN are already filled in.)

Then:
```
npx wrangler login          # opens a browser, sign in to Cloudflare
npx wrangler deploy         # creates the Worker, prints its URL — COPY IT
npx wrangler secret put MS_CLIENT_SECRET        # paste the Entra client secret
npx wrangler secret put SUPABASE_SERVICE_ROLE   # paste the Supabase service_role key
```
(Each `secret put` re-deploys automatically.)

## 3. Point the site at the Worker
Use the Worker URL from step 2 (e.g. `https://tmke-deliverables-api.<sub>.workers.dev`):
- **Local:** add to `.env` → `PUBLIC_R2_WORKER_URL=https://…`
- **Production:** Railway → your service → Variables → add `PUBLIC_R2_WORKER_URL` → redeploy.

## 4. Enable Microsoft sign-in (SSO)
- Supabase dashboard → Authentication → Providers → **Azure** → enable.
- Paste the **client ID**, **client secret**, and set **Azure Tenant** = `bd9416b6…`.
- In the Entra app, make sure the redirect URI includes:
  `https://<your-project-ref>.supabase.co/auth/v1/callback`

## 5. Verify
- `/admin/videography` → **Connections**: the 365 chip should say **Connected**
  (if not, the line underneath shows the exact error).
- **Deliver tab**: pick a booking, drag a small file — it should upload.
- **/book**: pick a service + day → real times appear → book a test slot →
  check it lands in Jack's calendar + the Pipeline.
- **/admin/login**: "Sign in with Microsoft" should work.
