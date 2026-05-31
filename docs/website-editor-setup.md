# Website Editor — setup (Phase 2)

The Website Editor lets an authenticated admin open any page with `?edit=1`,
tweak elements (type, spacing, colour, layout, wording, images), and **Publish**
so the changes go live for everyone. Edits are stored per page in Supabase.

## 1. Create the database table

Run this in the Supabase SQL editor (project → SQL):

```sql
create table if not exists public.site_overrides (
  path        text primary key,
  draft       jsonb not null default '{}'::jsonb,
  published   jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.site_overrides enable row level security;

-- The live site (anonymous visitors) must be able to READ published overrides.
create policy "public read site_overrides"
  on public.site_overrides for select
  using (true);

-- Only signed-in admins can WRITE (save drafts / publish).
create policy "authed insert site_overrides"
  on public.site_overrides for insert
  with check (auth.role() = 'authenticated');

create policy "authed update site_overrides"
  on public.site_overrides for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
```

## 2. Environment variables

These are the **same** vars the rest of the auth/admin already uses — no new
ones needed:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

Set locally in `.env` and in production (Railway → Variables). If they're
missing the editor automatically falls back to **localStorage** (per-browser),
so it still works for a demo.

## 3. How it's used

1. Sign in at `/admin/login`.
2. Add `?edit=1` to any page (e.g. `/?edit=1`).
3. Click an element → adjust it in the panel. Each change auto-saves a **draft**.
4. Hit **Publish** to make the page's changes live for all visitors.
5. **Done** exits edit mode.

## Notes / next steps

- **Auth gate:** with Supabase configured, edit mode requires a session; without
  it, edit mode opens freely (local-only) for development/demo.
- **FOUC:** published overrides are fetched client-side on load, so heavy text/
  image changes can flash briefly before applying. For zero-flash we'd inline
  the published overrides at render time (SSR) — a follow-up.
- **Draft visibility:** the read policy above exposes `draft` to anon reads too.
  For a marketing site that's fine; if needed we can split published into its own
  table or use a security-definer view.
- **Sanitisation:** edited wording is stored as HTML and re-injected. Before
  going fully public this should be sanitised server-side.
