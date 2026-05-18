# Customer login setup

Everything for `/login`, `/forgot-password`, `/reset-password`, and the
email-confirmation flow at `/auth/callback`. All of it runs on the same Supabase
project that powers the admin centre — Supabase's auth system handles both staff
and customer users from a single `auth.users` table.

## 1. Environment variables

Make sure these are set in **both** places:

- Your local `.env` (copy from `.env.example`)
- Railway → Variables (so production has them at build time)

```
PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Grab both from **Supabase dashboard → Project Settings → API**.

The `anon` key is safe to expose in the browser bundle. Never put the
`service_role` key here — it'd give anyone full database access.

## 2. Supabase auth settings

In the Supabase dashboard, open **Authentication → URL Configuration** and set:

| Field | Value (production) |
|---|---|
| Site URL | `https://your-domain.com` |
| Redirect URLs (one per line) | `https://your-domain.com/auth/callback`<br>`https://your-domain.com/reset-password`<br>`http://localhost:4321/auth/callback`<br>`http://localhost:4321/reset-password` |

The `localhost` entries let you test sign-up emails from your dev machine.
Replace `your-domain.com` with the Railway domain (or your custom one once
it's hooked up).

## 3. Email templates (optional but recommended)

Supabase ships with generic transactional emails. To match the TMKE brand,
edit them under **Authentication → Email Templates**:

- **Confirm signup** — sent on `/login` sign-up. Link points to `/auth/callback`.
- **Reset password** — sent from `/forgot-password`. Link points to `/reset-password`.
- **Magic link** — not used yet, leave default.

The default `{{ .ConfirmationURL }}` token does the right thing — you only need
to edit the wording / styling.

For production, point Supabase at a real SMTP provider under
**Authentication → SMTP Settings** (Resend, Postmark, or Mailgun all have
generous free tiers). The built-in Supabase mailer is rate-limited to ~4
emails per hour per project — fine for testing, not for real customers.

## 4. Auth provider settings

Under **Authentication → Providers**:

- **Email** — enabled. Keep "Confirm email" **ON** in production so addresses
  are verified. In dev you can turn it off for faster testing.
- **Google / GitHub / etc.** — optional. Each one needs OAuth credentials from
  the provider; we haven't wired any of these into `/login` yet.

## 5. What's wired up right now

| Page | What it does |
|---|---|
| `/login` | Tabbed sign-in + sign-up. Sign-up sends a confirmation email; success state shows "Check your inbox" with a resend button. |
| `/forgot-password` | Sends a password-reset email via `supabase.auth.resetPasswordForEmail()`. |
| `/reset-password` | Consumes the recovery token from the email link and lets the user set a new password. |
| `/auth/callback` | Handles the email-confirmation redirect — exchanges the code for a session and routes the user into the splash → `/account` (or `/profile` on first sign-in). |
| `/account` | Already gated — redirects to `/login?next=/account` if there's no session. |
| Nav | Already swaps "Login" → "Library" if a session is present. |

## 6. Testing locally

1. Run `npm run dev`.
2. Visit `http://localhost:4321/login` and switch to **Create account**.
3. Sign up. If Confirm Email is ON, check the inbox; click the link, you'll
   land on `/auth/callback` → splash → `/profile` (first-time) or `/account`.
4. Sign out from `/account`, then try **Forgot password?** to verify the
   reset flow.

If the confirmation email never arrives:
- Supabase free SMTP is throttled. Hit **Authentication → Users** in the
  dashboard, find the row, and click "Send confirmation email" again, or
  manually flip `Email confirmed` to true for the user.
- Or, in dev, toggle **Confirm email** off under **Authentication → Providers
  → Email** so sign-up returns an immediate session.

## 7. What's *not* yet wired

These are the next steps once customer login is solid:

- Brand kit currently lives in `localStorage` — should move to a
  `public.profiles` table keyed on `auth.users.id` so it follows the user.
- The `/edit` checkout flow doesn't actually take payment yet; Stripe wiring
  is the next milestone.
- The `packs` RLS policies currently grant write access to any authenticated
  user. Before customer signups go live in production, we need to tighten
  these to "service-role only" and add an `is_admin` claim.
