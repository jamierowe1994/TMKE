// TMKE — send-due-reminders Edge Function
//
// Triggered every 5 minutes by pg_cron (see supabase/calendar_reminders.sql).
// Pulls calendar_items that are due, emails each customer via Resend, and
// marks the row as 'reminder_sent'. Failed rows accumulate a send_attempts
// counter; after 5 misses we mark them 'failed' and stop trying.
//
// Required env vars (set with `supabase secrets set`):
//   RESEND_API_KEY   — from https://resend.com/api-keys
//   RESEND_FROM      — e.g. "TMKE <hello@tmke.co.uk>" (domain must be
//                      verified in Resend before this works)
//   SITE_URL         — e.g. "https://tmke.co.uk" — used for in-email links
// Auto-provided by the platform (don't override):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Deploy:
//   supabase functions deploy send-due-reminders --no-verify-jwt
//   (--no-verify-jwt because pg_cron passes the service-role key as a
//    bearer, not a user JWT.)

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ---------- Tunables ----------
const MAX_ATTEMPTS = 5;           // give up on a row after this many tries
const BATCH_SIZE   = 25;          // most we'll process in one cron tick

// ---------- Types ----------
interface CalendarItem {
  id: string;
  user_id: string;
  scheduled_date: string;
  scheduled_time: string;
  title: string;
  caption: string | null;
  asset_url: string | null;
  thumbnail_url: string | null;
  design_ref: string | null;
  platform_hint: string;
  send_attempts: number;
}

interface SendResult {
  id: string;
  ok: boolean;
  error?: string;
}

// ---------- Entry point ----------
Deno.serve(async (req) => {
  // pg_cron passes the service-role key as a bearer — this is the auth
  // we trust. If someone curls the function without it, refuse.
  const auth = req.headers.get("Authorization") || "";
  const expectedAuth = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (auth !== expectedAuth) {
    return json({ error: "unauthorized" }, 401);
  }

  // Required env. Bail loud (not silent) if anything is missing — easier
  // to debug than a partial send.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey   = Deno.env.get("RESEND_API_KEY");
  const resendFrom  = Deno.env.get("RESEND_FROM");
  const siteUrl     = Deno.env.get("SITE_URL") || "https://tmke.co.uk";

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!serviceKey)  missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!resendKey)   missing.push("RESEND_API_KEY");
  if (!resendFrom)  missing.push("RESEND_FROM");
  if (missing.length) {
    return json({ error: `missing env: ${missing.join(", ")}` }, 500);
  }

  const supabase = createClient(supabaseUrl!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---------- 1. Fetch due rows ----------
  // "Due" = scheduled_for (date + time, interpreted as UK local) is <= now.
  // We can't push the timezone-aware comparison into a single PostgREST
  // filter without a view, so we filter date/time loosely on the server
  // and re-check precisely client-side. That's fine — the worst case is
  // we pull a handful of rows we then skip.
  const todayYmd = new Date().toISOString().slice(0, 10);
  const { data: candidates, error: fetchErr } = await supabase
    .from("calendar_items")
    .select("id, user_id, scheduled_date, scheduled_time, title, caption, asset_url, thumbnail_url, design_ref, platform_hint, send_attempts")
    .eq("status", "scheduled")
    .is("reminder_sent_at", null)
    .lte("scheduled_date", todayYmd)
    .lt("send_attempts", MAX_ATTEMPTS)
    .order("scheduled_date", { ascending: true })
    .order("scheduled_time", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr) {
    return json({ error: "fetch_failed", detail: fetchErr.message }, 500);
  }

  const due = (candidates || []).filter((row) => isDue(row));
  if (due.length === 0) {
    return json({ ok: true, processed: 0, message: "nothing due" });
  }

  // ---------- 2. Process each row ----------
  const results: SendResult[] = [];
  for (const row of due) {
    try {
      // Resolve the user's email via the admin API (service-role only).
      const { data: userRes, error: userErr } = await supabase.auth.admin.getUserById(row.user_id);
      if (userErr || !userRes?.user?.email) {
        await markFailed(supabase, row, userErr?.message || "user not found");
        results.push({ id: row.id, ok: false, error: "user_lookup_failed" });
        continue;
      }
      const toEmail = userRes.user.email;
      const firstName = ((userRes.user.user_metadata as any)?.name || toEmail).split("@")[0].split(" ")[0];

      // Compose + send. supabaseUrl is needed so the email can deep-link
      // back to the mark-post-status Edge Function (the "✓ Posted it"
      // and "Cancel" buttons in the email body).
      const html = renderEmail({ row, firstName, siteUrl, supabaseUrl: supabaseUrl! });
      const subject = `Time to post: ${row.title}`;
      const sendErr = await sendViaResend({
        apiKey: resendKey!,
        from: resendFrom!,
        to: toEmail,
        subject,
        html,
      });

      if (sendErr) {
        await markAttempt(supabase, row, sendErr);
        results.push({ id: row.id, ok: false, error: sendErr });
        continue;
      }

      // Success — flip the row.
      const { error: updErr } = await supabase
        .from("calendar_items")
        .update({
          status: "reminder_sent",
          reminder_sent_at: new Date().toISOString(),
          send_attempts: row.send_attempts + 1,
          last_error: null,
        })
        .eq("id", row.id);
      if (updErr) {
        // Email sent, row didn't update — log and move on. Next run will
        // try to resend, which is annoying but not catastrophic.
        console.warn(`[reminder] sent but failed to mark row ${row.id}: ${updErr.message}`);
      }
      results.push({ id: row.id, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markAttempt(supabase, row, msg);
      results.push({ id: row.id, ok: false, error: msg });
    }
  }

  return json({
    ok: true,
    processed: results.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
});

// ---------- Helpers ----------

// UK-local "is it time yet?" check. Postgres stored scheduled_date +
// scheduled_time as wall-clock UK; we interpret them the same way here.
function isDue(row: CalendarItem): boolean {
  const ukNow = nowInLondon();
  const dueTs = new Date(`${row.scheduled_date}T${row.scheduled_time}`);
  return dueTs.getTime() <= ukNow.getTime();
}

// Returns a Date whose getTime() equals the current wall-clock time in
// Europe/London. We synthesise this rather than use real Date because
// Deno on Supabase runs in UTC and Europe/London drifts ±1h.
function nowInLondon(): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return new Date(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`);
}

async function markAttempt(supabase: any, row: CalendarItem, error: string) {
  const nextAttempts = (row.send_attempts || 0) + 1;
  const giveUp = nextAttempts >= MAX_ATTEMPTS;
  await supabase
    .from("calendar_items")
    .update({
      send_attempts: nextAttempts,
      last_error: error.slice(0, 500),
      ...(giveUp ? { status: "failed" } : {}),
    })
    .eq("id", row.id);
}

async function markFailed(supabase: any, row: CalendarItem, error: string) {
  await supabase
    .from("calendar_items")
    .update({
      send_attempts: (row.send_attempts || 0) + 1,
      last_error: error.slice(0, 500),
      status: "failed",
    })
    .eq("id", row.id);
}

async function sendViaResend(opts: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<string | null> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        from: opts.from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return `resend ${res.status}: ${detail.slice(0, 200)}`;
    }
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;",
  }[c]!));
}

// On-brand HTML email. Keeps inline styles (most clients strip <style>).
// One column, table-based — bog-standard transactional layout.
function renderEmail(opts: {
  row: CalendarItem;
  firstName: string;
  siteUrl: string;
  supabaseUrl: string;
}): string {
  const { row, firstName, siteUrl, supabaseUrl } = opts;
  const platformLabel = (
    { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", tiktok: "TikTok" } as Record<string, string>
  )[row.platform_hint] || "your socials";

  const titleEsc   = escapeHtml(row.title);
  const captionEsc = row.caption ? escapeHtml(row.caption).replace(/\n/g, "<br>") : "";
  const editUrl    = row.design_ref ? `${siteUrl}/editor?template=${encodeURIComponent(row.design_ref)}` : `${siteUrl}/editor`;
  const calUrl     = `${siteUrl}/account/schedule`;
  // One-click action URLs that bypass auth (security is the row UUID).
  // Same pattern the order receipts use at /edit/thanks?order=<uuid>.
  const markDoneUrl   = `${supabaseUrl}/functions/v1/mark-post-status?id=${encodeURIComponent(row.id)}&action=done`;
  const markCancelUrl = `${supabaseUrl}/functions/v1/mark-post-status?id=${encodeURIComponent(row.id)}&action=cancelled`;
  const fname      = escapeHtml(firstName.charAt(0).toUpperCase() + firstName.slice(1));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Time to post — TMKE</title>
</head>
<body style="margin:0;padding:0;background:#f2efe9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1d22;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f2efe9;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="background:#ffffff;border-radius:8px;box-shadow:0 18px 40px -16px rgba(46,31,84,0.25);overflow:hidden;">
        <!-- Header strip -->
        <tr><td style="background:#2e1f54;padding:28px 36px;color:#f2efe9;">
          <div style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(240,238,235,0.7);font-weight:700;">TMKE · Content calendar</div>
          <h1 style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:500;letter-spacing:-0.01em;">Time to post, ${fname}.</h1>
        </td></tr>

        <!-- Image preview -->
        ${row.asset_url ? `
        <tr><td align="center" style="padding:24px 36px 8px;">
          <img src="${escapeHtml(row.asset_url)}" alt="${titleEsc}" width="488" style="display:block;width:100%;max-width:488px;height:auto;border-radius:4px;border:1px solid rgba(28,29,34,0.08);">
        </td></tr>` : ``}

        <!-- Title + meta -->
        <tr><td style="padding:18px 36px 4px;">
          <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#2e1f54;font-weight:700;">${escapeHtml(platformLabel)} · ${row.scheduled_time.slice(0,5)}</div>
          <h2 style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:500;letter-spacing:-0.01em;">${titleEsc}</h2>
        </td></tr>

        ${row.caption ? `
        <!-- Caption (copy-paste-able) -->
        <tr><td style="padding:14px 36px 4px;">
          <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(28,29,34,0.5);font-weight:700;margin-bottom:6px;">Your caption</div>
          <div style="background:#f7f5f1;border:1px solid rgba(28,29,34,0.08);border-radius:4px;padding:14px 16px;font-size:14px;line-height:1.55;color:#1c1d22;white-space:pre-wrap;">${captionEsc}</div>
          <div style="font-size:11px;color:rgba(28,29,34,0.5);margin-top:6px;">Long-press / triple-click to copy.</div>
        </td></tr>` : ``}

        <!-- How-to -->
        <tr><td style="padding:22px 36px 6px;">
          <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(28,29,34,0.5);font-weight:700;margin-bottom:10px;">How to post</div>
          <ol style="margin:0;padding:0 0 0 20px;font-size:14px;line-height:1.65;color:rgba(28,29,34,0.75);">
            <li>Save the image above to your phone (long-press → Save).</li>
            <li>Open ${escapeHtml(platformLabel)} and create a new post.</li>
            <li>Paste your caption and publish.</li>
          </ol>
        </td></tr>

        <!-- Buttons. Primary action is "Posted it" because that's what
             the customer is most likely to do right after we email them.
             "Open calendar" stays as a secondary; "Edit design" tucks in
             smaller below since it's a rarer action. -->
        <tr><td style="padding:22px 36px 12px;" align="left">
          <a href="${escapeHtml(markDoneUrl)}" style="display:inline-block;background:#2e1f54;color:#f2efe9;text-decoration:none;padding:12px 22px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;margin-right:8px;">✓ I've posted it</a>
          <a href="${escapeHtml(calUrl)}" style="display:inline-block;background:transparent;color:#2e1f54;text-decoration:none;padding:11px 20px;border:1px solid rgba(46,31,84,0.4);border-radius:4px;font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;">Open calendar →</a>
        </td></tr>
        <tr><td style="padding:0 36px 24px;font-size:12px;color:rgba(28,29,34,0.55);">
          <a href="${escapeHtml(editUrl)}" style="color:#2e1f54;text-decoration:none;font-weight:600;">Edit the design</a>
          <span style="color:rgba(28,29,34,0.25);margin:0 8px;">·</span>
          <a href="${escapeHtml(markCancelUrl)}" style="color:rgba(28,29,34,0.55);text-decoration:none;border-bottom:1px solid rgba(28,29,34,0.2);">Cancel this post</a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:18px 36px 28px;border-top:1px solid rgba(28,29,34,0.08);font-size:11px;color:rgba(28,29,34,0.5);line-height:1.6;">
          You're getting this because you scheduled a post on TMKE for today.<br>
          Manage everything from your <a href="${escapeHtml(calUrl)}" style="color:#2e1f54;text-decoration:none;font-weight:600;">content calendar</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
