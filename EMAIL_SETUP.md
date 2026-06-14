# Email studio (in-house mailer) — setup & handover

A Mailchimp-style email-template builder in the TMKE admin area. Marketing staff
build branded emails from blocks (or raw HTML), save them as templates, preview
them live, and send a test. The engine and data model are ported from the
Backed.CRM mass-emailer; the UI is rebuilt in TMKE's own vanilla-JS/Astro style.

This is **Phase 1 (template builder)**. Confirmation triggers and newsletter
sends build on top of it — see "Next phases" below.

## What's in this change

| File | What it is |
|------|-----------|
| `src/lib/email-render.js` | Pure renderer + mail-merge + block model. Turns a template (blocks/branding) into email-client-safe HTML. Runs in the browser (live preview) **and** server-side (sending). No dependencies. |
| `supabase/email_templates.sql` | The `email_templates` table + RLS. **Run this once** (see below). |
| `src/pages/admin/email.astro` | Template list (new / edit / duplicate / archive / delete). |
| `src/pages/admin/email/editor.astro` | The builder: block stack editor, branding, live desktop/mobile preview, HTML mode, save, Send test. |
| `worker/src/index.js` | New admin-gated `POST /email/send` endpoint that relays to Resend. |
| `src/pages/admin.astro` | New "Email studio" dashboard tile (#09) + live counts. |

## One-time setup

1. **Create the table.** In the Supabase SQL editor, run `supabase/email_templates.sql`.
   (It reuses `set_updated_at()` from `schema.sql` and is safe to re-run.)

2. **Deploy the Worker.** The send endpoint lives in the existing Worker:
   ```
   cd worker
   npx wrangler deploy
   ```
   `RESEND_API_KEY` and `MAIL_FROM` are already configured there (they power the
   reminder + waitlist emails), so nothing new to set. `MAIL_FROM` is currently
   `TMKE <posts@tmke.co.uk>` — emails send from that verified address.

3. **Confirm the site env.** The editor's "Send test" calls the Worker via
   `PUBLIC_R2_WORKER_URL` (already set for R2 uploads). No new env var.

That's it. Open **Admin → Email studio**.

## How it works

- **Blocks** (text, image, button, logo, divider, spacer, social, video) are
  stored as JSON in `email_templates.blocks`. The block model + defaults live in
  `src/lib/email-render.js` (one source of truth for the editor and the renderer).
- **Branding** (logo, accent colour, backgrounds, sign-off, social links) is
  stored per-template in `email_templates.branding`, pre-filled with TMKE defaults.
- **Merge fields**: `{{firstName}}`, `{{lastName}}`, `{{fullName}}`, `{{email}}`,
  `{{company}}`, `{{senderName}}`, `{{senderCompany}}`. Unknown tokens are left
  visible in the preview so typos are easy to spot.
- **HTML mode**: paste a full `<!doctype html>…` document for total control, or
  just an inner fragment and it's wrapped in the TMKE shell.
- **Send test** renders the current template for the address you enter and posts
  `{ to, subject, html }` to the Worker, which checks the caller is a TMKE admin
  and relays to Resend.

## Security

- Table reads/writes require an authenticated session (RLS). Email templates are
  **not** publicly readable (unlike the design `templates` table).
- The Worker's `/email/send` re-validates the Supabase token **and** requires a
  `@tmke.co.uk` (or the named allowlist) email — a signed-in customer can't drive
  the mailer.
- To tighten table writes to `public.is_admin()` once the admins-table RLS
  rollout lands, see the commented policy at the bottom of `email_templates.sql`.

## Next phases (not built yet)

1. **Confirmation triggers.** Wire a template's `trigger_key`
   (`account_welcome`, `order_confirmation`, `enquiry_received`,
   `waitlist_confirmation`) to fire automatically on that event. The render +
   send path already exists server-side (`email-render.js` + Worker `/email/send`);
   this phase looks up the active template for the event and sends it. The unique
   index already guarantees one active template per trigger.
2. **Audience + newsletter sends.** A real `email_subscribers` list and a
   "send to list" flow (queue table + batched send), instead of one-off tests.
3. **Workflow / process-map builder.** The visual "customer does X → email Y →
   then newsletter Z" automation builder.
