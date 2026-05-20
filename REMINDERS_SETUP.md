# Content calendar — reminder emails

Wires up the scheduled-post reminder pipeline:

1. Customer schedules a post in `/editor` → row lands in `calendar_items`.
2. Every 5 minutes, **pg_cron** pings a Supabase **Edge Function** (`send-due-reminders`).
3. The function finds any rows whose `scheduled_date + scheduled_time` is ≤ "now in UK", sends each customer an email via **Resend**, and marks the row `reminder_sent`.

This is v1 (manual posting). v2 will replace the email with an auto-post to Instagram once Meta App Review is approved.

---

## Prerequisites

- The `calendar_items` table exists — i.e. you've already run `supabase/calendar.sql` and `supabase/calendar_storage.sql`.
- Supabase **CLI** installed locally: `npm i -g supabase` (or `brew install supabase/tap/supabase`).
- You're logged in to the CLI and linked to your project:
  ```bash
  supabase login
  supabase link --project-ref YOUR-PROJECT-REF
  ```

---

## 1. Resend account

1. Sign up at **https://resend.com** (free tier covers 3,000 emails/month — plenty for v1).
2. **Add and verify your sending domain** (`tmke.co.uk`). Resend → Domains → Add → follow the DNS records. **You can't send from an unverified domain in production.**
3. Create an API key: Resend → API Keys → Create. Save it somewhere safe.
4. Pick a **From** address on the verified domain — e.g. `TMKE <hello@tmke.co.uk>` or `TMKE <calendar@tmke.co.uk>`.

For dev testing, you *can* use Resend's `onboarding@resend.dev` from-address without verifying a domain, but it'll only deliver to your own Resend account email — fine for one-off testing, not for customer-facing.

---

## 2. Deploy the Edge Functions

Two functions to ship from the repo root:

```bash
supabase functions deploy send-due-reminders --no-verify-jwt
supabase functions deploy mark-post-status   --no-verify-jwt
```

`--no-verify-jwt` is intentional:

- **`send-due-reminders`** is called by pg_cron, which authenticates with the service-role key as a Bearer (not a Supabase user JWT). The function checks the Bearer matches `SUPABASE_SERVICE_ROLE_KEY` itself, so unauthenticated traffic is rejected.
- **`mark-post-status`** is the public endpoint the reminder email links to (the "✓ I've posted it" and "Cancel this post" buttons). Security comes from the row UUID being unguessable — same model as the order receipts at `/edit/thanks?order=<uuid>`.

Then set the env vars (run once per project):

```bash
supabase secrets set \
  RESEND_API_KEY="re_xxxxxxxxxx" \
  RESEND_FROM="TMKE <hello@tmke.co.uk>" \
  SITE_URL="https://tmke.co.uk"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform — don't set them yourself.

---

## 3. Schedule the cron

Open `supabase/calendar_reminders.sql`, find these two placeholders near the bottom, and replace them with your real values:

| Placeholder | Where to find it |
|---|---|
| `YOUR-PROJECT-REF` | Supabase dashboard → Project Settings → General → **Reference ID** |
| `YOUR-SERVICE-ROLE-KEY` | Supabase dashboard → Project Settings → API → **service_role** secret |

Then run the entire file in the Supabase SQL editor. This:

- Adds `send_attempts` + `last_error` columns to `calendar_items` (idempotent — safe to re-run).
- Widens the status check to include `'failed'`.
- Enables `pg_cron` + `pg_net` extensions.
- Schedules the job (`send-due-reminders`) to run every 5 minutes.

---

## 4. Verify it's working

### Confirm the job is scheduled
```sql
select jobid, schedule, command from cron.job where jobname = 'send-due-reminders';
```

You should see one row with schedule `*/5 * * * *`.

### Watch recent runs
```sql
select * from cron.job_run_details
  where jobid = (select jobid from cron.job where jobname = 'send-due-reminders')
  order by start_time desc limit 10;
```

The `return_message` column contains the HTTP request_id. Successful runs show `succeeded`.

### Send a test reminder right now
Insert a row that's already overdue (replace `<your-user-id>`):

```sql
insert into public.calendar_items (
  user_id, scheduled_date, scheduled_time, title, caption, asset_url, thumbnail_url, platform_hint
) values (
  '<your-user-id>',
  current_date,
  (now() - interval '5 minutes')::time,
  'Reminder smoke test',
  'Testing the reminder pipeline — ignore.',
  'https://placehold.co/1080x1350/png',
  'https://placehold.co/1080x1350/png',
  'instagram'
);
```

Within 5 minutes the email lands. Verify by:

```sql
select id, status, send_attempts, last_error, reminder_sent_at
from public.calendar_items
where title = 'Reminder smoke test';
```

You can also invoke the function manually without waiting for cron:

```sql
select net.http_post(
  url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-due-reminders',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer YOUR-SERVICE-ROLE-KEY'
  ),
  body := jsonb_build_object('source', 'manual')
);
```

### Tail the function logs
```bash
supabase functions logs send-due-reminders --tail
supabase functions logs mark-post-status   --tail
```

You'll see one log line per cron tick for `send-due-reminders`. Empty ticks (nothing due) return `{ ok: true, processed: 0 }`. `mark-post-status` logs one line per email-link click.

### Try the "Mark as posted" link without an email

Open this URL in a browser (substitute a real row id):

```
https://YOUR-PROJECT-REF.supabase.co/functions/v1/mark-post-status?id=<row-uuid>&action=done
```

You should land on an on-brand confirmation page. The row's status flips to `done` immediately. Re-clicking the link shows "Already marked as posted" — idempotent by design so customers re-clicking old emails don't get an error. The `&action=cancelled` variant does the same thing for cancellation.

---

## Troubleshooting

**Function returns 401 unauthorized.** Cron job is calling with a wrong/expired key. Re-check `YOUR-SERVICE-ROLE-KEY` in `calendar_reminders.sql` matches the current value in Project Settings → API.

**Function returns 500 `missing env`.** You didn't run `supabase secrets set` for `RESEND_API_KEY` / `RESEND_FROM`. Re-run the secrets command and redeploy.

**Resend returns 403 Forbidden / 422 Validation.** Almost always means the From-address isn't on a verified domain. Resend → Domains → confirm DNS is green.

**Rows go to `status = 'failed'` after 5 tries.** Look at `last_error` on those rows — usually a bad asset URL (storage bucket isn't public) or a Resend issue. Once fixed, you can re-queue them:

```sql
update public.calendar_items
  set status = 'scheduled', send_attempts = 0, last_error = null
  where status = 'failed' and id in (...);
```

**Timezone weirdness.** The function interprets `scheduled_date + scheduled_time` as UK local (Europe/London). DST is handled — no action needed twice a year. If a customer schedules `09:00`, that's 09:00 in London regardless of where the server runs.

**Customer didn't get the email.** Check (in order):
1. `cron.job_run_details` — did the cron tick that should have caught it run?
2. `calendar_items.send_attempts` — did the function try?
3. `calendar_items.last_error` — what did Resend say?
4. Resend dashboard → Logs — was the email accepted? bounced? marked spam?
