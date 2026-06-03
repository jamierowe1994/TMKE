// TMKE — mark-post-status Edge Function
//
// Handles the "✓ Mark as posted" and "Cancel this post" buttons in the
// reminder email. Public endpoint (no auth required) — security comes
// from the row UUID being unguessable, same model as the order receipts
// reachable from /edit/thanks?order=<uuid>.
//
// Usage (from email links):
//   GET /functions/v1/mark-post-status?id=<calendar_items.id>&action=done
//   GET /functions/v1/mark-post-status?id=<calendar_items.id>&action=cancelled
//
// Returns an on-brand HTML confirmation page so the customer isn't
// dropped onto raw JSON. Idempotent — re-clicking a link that already
// did the thing shows "already marked" rather than erroring.
//
// Deploy:
//   supabase functions deploy mark-post-status --no-verify-jwt

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const VALID_ACTIONS = ["done", "cancelled"] as const;
type Action = (typeof VALID_ACTIONS)[number];

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const action = (url.searchParams.get("action") || "") as Action;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const siteUrl     = Deno.env.get("SITE_URL") || "https://tmke.co.uk";

  if (!supabaseUrl || !serviceKey) {
    return htmlResponse(renderError("Server is misconfigured — try again in a minute."), 500);
  }
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return htmlResponse(renderError("That link looks broken. Open your calendar and update the post from there."), 400);
  }
  if (!VALID_ACTIONS.includes(action)) {
    return htmlResponse(renderError("That link looks broken. Open your calendar and update the post from there."), 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Find the row first so we can give the customer a precise message.
  const { data: row, error: fetchErr } = await supabase
    .from("calendar_items")
    .select("id, title, scheduled_date, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) {
    return htmlResponse(renderError("Couldn't reach the calendar. Try opening it directly."), 500);
  }
  if (!row) {
    return htmlResponse(renderNotFound(siteUrl), 404);
  }

  // If the row is already in a terminal state, don't overwrite — just
  // tell the customer what's already there. Avoids "wait, did I cancel
  // it earlier?" confusion when they re-click an old email.
  if (row.status === action) {
    return htmlResponse(renderAlreadyDone({ row, action, siteUrl }));
  }
  if (row.status === "done" || row.status === "cancelled") {
    return htmlResponse(renderAlreadyDone({ row, action: row.status as Action, siteUrl }));
  }

  // Flip the row. We don't gate on previous status beyond the terminal
  // check above — a "scheduled" row never reached the cron yet, but the
  // user might still want to confirm they posted it manually.
  const { error: updErr } = await supabase
    .from("calendar_items")
    .update({ status: action, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updErr) {
    return htmlResponse(renderError("Couldn't save that change. Try again from your calendar."), 500);
  }

  return htmlResponse(renderSuccess({ row, action, siteUrl }));
});

// ---------- HTML responses ----------

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Prevent caching — the same URL can return different pages
      // depending on row state (e.g. after first click vs. second).
      "Cache-Control": "no-store",
    },
  });
}

function shell(opts: { title: string; eyebrow: string; body: string; siteUrl: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(opts.title)} — TMKE</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      background: #f2efe9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1c1d22;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
    }
    .card {
      max-width: 480px;
      width: 100%;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 22px 50px -20px rgba(46, 31, 84, 0.3);
      overflow: hidden;
    }
    .card-head {
      background: #2e1f54;
      color: #f2efe9;
      padding: 28px 32px;
    }
    .card-head .eyebrow {
      font-size: 10px;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      font-weight: 700;
      color: rgba(240, 238, 235, 0.7);
    }
    .card-head h1 {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 28px;
      font-weight: 500;
      letter-spacing: -0.01em;
      margin: 8px 0 0;
    }
    .card-body {
      padding: 24px 32px 28px;
    }
    .card-body p {
      margin: 0 0 12px;
      font-size: 14px;
      line-height: 1.6;
      color: rgba(28, 29, 34, 0.75);
    }
    .meta {
      background: #f7f5f1;
      border: 1px solid rgba(28, 29, 34, 0.08);
      border-radius: 4px;
      padding: 12px 14px;
      margin: 14px 0 18px;
      font-size: 13px;
      line-height: 1.5;
      color: #1c1d22;
    }
    .meta strong {
      font-family: Georgia, "Times New Roman", serif;
      font-weight: 500;
      letter-spacing: -0.005em;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }
    .btn {
      display: inline-block;
      padding: 12px 22px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      text-decoration: none;
      transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
    }
    .btn-primary {
      background: #2e1f54;
      color: #f2efe9;
      box-shadow: 0 10px 22px -10px rgba(46, 31, 84, 0.55);
    }
    .btn-primary:hover { transform: translateY(-1px); background: #1c1d22; }
    .btn-ghost {
      background: transparent;
      color: #2e1f54;
      border: 1px solid rgba(46, 31, 84, 0.4);
    }
    .btn-ghost:hover { background: rgba(46, 31, 84, 0.06); }
    .foot {
      padding: 16px 32px 24px;
      border-top: 1px solid rgba(28, 29, 34, 0.08);
      font-size: 11px;
      color: rgba(28, 29, 34, 0.5);
    }
    .foot a { color: #2e1f54; text-decoration: none; font-weight: 600; }
    .icon {
      display: inline-flex;
      width: 18px; height: 18px;
      border-radius: 999px;
      align-items: center; justify-content: center;
      font-size: 12px;
      margin-right: 6px;
      vertical-align: -3px;
    }
    .icon-tick { background: rgba(46, 111, 79, 0.18); color: #2e6f4f; }
    .icon-cross { background: rgba(28, 29, 34, 0.12); color: rgba(28, 29, 34, 0.7); }
    .icon-warn { background: rgba(201, 122, 58, 0.18); color: #8a4d1f; }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-head">
      <div class="eyebrow">${escapeHtml(opts.eyebrow)}</div>
      <h1>${escapeHtml(opts.title)}</h1>
    </div>
    <div class="card-body">
      ${opts.body}
    </div>
    <div class="foot">
      Manage everything from your <a href="${escapeHtml(opts.siteUrl)}/account/schedule">content calendar</a>.
    </div>
  </div>
</body>
</html>`;
}

function renderSuccess(opts: { row: any; action: Action; siteUrl: string }): string {
  const { row, action, siteUrl } = opts;
  const fmtDate = formatUkDate(row.scheduled_date);

  if (action === "done") {
    return shell({
      title: "Marked as posted.",
      eyebrow: "TMKE · Content calendar",
      siteUrl,
      body: `
        <p><span class="icon icon-tick">✓</span> Nice — we'll keep this on your calendar so you can see what's gone out and when.</p>
        <div class="meta"><strong>${escapeHtml(row.title)}</strong><br>${escapeHtml(fmtDate)}</div>
        <p>Want to schedule the next one? Head back to the editor.</p>
        <div class="actions">
          <a href="${escapeHtml(siteUrl)}/account/schedule" class="btn btn-primary">Open calendar →</a>
          <a href="${escapeHtml(siteUrl)}/editor" class="btn btn-ghost">New post</a>
        </div>
      `,
    });
  }

  return shell({
    title: "Post cancelled.",
    eyebrow: "TMKE · Content calendar",
    siteUrl,
    body: `
      <p><span class="icon icon-cross">×</span> No worries — we won't email you about this one again.</p>
      <div class="meta"><strong>${escapeHtml(row.title)}</strong><br>${escapeHtml(fmtDate)}</div>
      <p>You can still see it on your calendar in case you change your mind.</p>
      <div class="actions">
        <a href="${escapeHtml(siteUrl)}/account/schedule" class="btn btn-primary">Open calendar →</a>
      </div>
    `,
  });
}

function renderAlreadyDone(opts: { row: any; action: Action; siteUrl: string }): string {
  const { row, action, siteUrl } = opts;
  const fmtDate = formatUkDate(row.scheduled_date);
  const wasDone = action === "done";

  return shell({
    title: wasDone ? "Already marked as posted." : "Already cancelled.",
    eyebrow: "TMKE · Content calendar",
    siteUrl,
    body: `
      <p><span class="icon icon-warn">!</span> This post is already <strong>${wasDone ? "marked as posted" : "cancelled"}</strong>. Nothing else to do here.</p>
      <div class="meta"><strong>${escapeHtml(row.title)}</strong><br>${escapeHtml(fmtDate)}</div>
      <div class="actions">
        <a href="${escapeHtml(siteUrl)}/account/schedule" class="btn btn-primary">Open calendar →</a>
      </div>
    `,
  });
}

function renderNotFound(siteUrl: string): string {
  return shell({
    title: "Post not found.",
    eyebrow: "TMKE · Content calendar",
    siteUrl,
    body: `
      <p><span class="icon icon-warn">!</span> We couldn't find that scheduled post — it may have been deleted, or the link is from an older draft.</p>
      <div class="actions">
        <a href="${escapeHtml(siteUrl)}/account/schedule" class="btn btn-primary">Open calendar →</a>
      </div>
    `,
  });
}

function renderError(message: string): string {
  return shell({
    title: "Something went wrong.",
    eyebrow: "TMKE · Content calendar",
    siteUrl: "https://tmke.co.uk",
    body: `
      <p><span class="icon icon-warn">!</span> ${escapeHtml(message)}</p>
      <div class="actions">
        <a href="https://tmke.co.uk/account/schedule" class="btn btn-primary">Open calendar →</a>
      </div>
    `,
  });
}

// ---------- Helpers ----------

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;",
  }[c]!));
}

function formatUkDate(ymd: string): string {
  // ymd is "YYYY-MM-DD". Parse as local (the date itself is timezone-agnostic).
  const d = new Date(`${ymd}T12:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
