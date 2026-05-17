# Admin centre — Supabase setup

The TMKE admin centre is powered by Supabase (database, file storage, auth).
This is a **one-time** setup. After it's done, marketing logs in at
`/admin/login` and can add/edit/swap packs that go live on `/edit` instantly.

---

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Pick a name (`tmke-prod` or similar), a strong DB password, and a region close to your users (e.g. `eu-west-2 / London`).
3. Once provisioned, open **Project Settings → API**. You'll need two values:
   - **Project URL** → `PUBLIC_SUPABASE_URL`
   - **anon / public key** → `PUBLIC_SUPABASE_ANON_KEY`

## 2. Wire the env vars

Locally:

```bash
cp .env.example .env
# edit .env and paste the two values
```

On Railway → **Variables**: add the same two keys.

> Both keys are safe to expose to the browser — read/write rules are enforced
> by the database's row-level security (set up in step 3).

## 3. Apply the database schema

In the Supabase dashboard → **SQL Editor** → **New query**, paste and run:

1. The contents of [`supabase/schema.sql`](supabase/schema.sql) — creates the `packs` table and locks it down with RLS.
2. The contents of [`supabase/templates.sql`](supabase/templates.sql) — creates the `templates` table for the in-house design studio (read by `/editor`, edited from `/admin/templates`).

## 4. Create the storage bucket

In **Storage**:

1. Click **New bucket**.
2. Name it exactly `pack-images`.
3. Toggle **Public bucket** **ON** (cover images need to be readable by visitors).
4. Save.

Then back in the **SQL Editor**, run:

2. The contents of [`supabase/storage.sql`](supabase/storage.sql) — grants upload/update/delete to signed-in admins.

## 5. Create the admin user (the "shared password")

In **Authentication → Users → Add user → Create new user**:

- Email: e.g. `admin@tmke.co.uk` (any email you control — used to recover the password)
- Password: a strong shared password the marketing team can use
- **Auto Confirm User**: ON (skip email verification)

That single account is what the team will use to log in. To rotate the password, change it here and tell the team. To add per-person accounts later, just create more users — RLS already grants access to any authenticated user.

## 6. Lock down sign-ups (important)

To stop random visitors making themselves admins:

**Authentication → Providers → Email** → turn **Enable Sign-Ups** **OFF**. New admins can only be created from the dashboard.

## 7. Try it

```bash
npm install
npm run dev
```

- Visit `http://localhost:4321/admin` — you should be redirected to `/admin/login`.
- Sign in with the admin user from step 5.
- Click **Catalogue** → **+ New pack** → fill in title, price, upload a cover, save.
- Visit `/edit` in a new tab — the new pack appears.

---

## How it works at a glance

| File | Purpose |
| --- | --- |
| `supabase/schema.sql` | `packs` table + RLS policies (public reads active packs; admins read/write everything) |
| `supabase/storage.sql` | Storage policies for the `pack-images` bucket |
| `src/lib/supabase.js` | Browser client + `gbpFromPence` / `slugify` helpers |
| `src/lib/admin-gate.js` | `requireAdmin()` redirect-if-not-logged-in helper |
| `src/pages/admin/login.astro` | Email + password sign-in |
| `src/pages/admin.astro` | Dashboard hub (auth-gated) |
| `src/pages/admin/packs.astro` | Pack CRUD: list, add, edit, archive, upload cover, set price |
| `src/pages/edit.astro` | Customer-facing storefront — reads active packs live from Supabase |

## What's not built yet (future passes)

The dashboard cards for **Orders**, **Members**, **Subscribers**, **Stock photos**, and **Enquiries** are placeholders. They follow the same pattern as Packs once you're ready to add them: a `*.sql` migration, an `/admin/<thing>.astro` page, and (if customer-facing) a public page that reads from the same table.
