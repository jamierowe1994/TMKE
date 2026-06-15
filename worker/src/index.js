// TMKE R2 deliverables API — Cloudflare Worker
// ---------------------------------------------------------------------------
// Endpoints (all require a valid Supabase session token in `Authorization`):
//   POST   /create    { bookingId, fileName, contentType }  -> { key, uploadId }
//   PUT    /part?key=&uploadId=&partNumber=   (body = raw bytes) -> { partNumber, etag }
//   POST   /complete  { key, uploadId, parts:[{partNumber,etag}] } -> { ok }
//   POST   /abort     { key, uploadId } -> { ok }
//   GET    /list?bookingId=   -> { files:[{key,size,uploaded}] }
//   DELETE /object?key=       -> { ok }
//   GET    /download?key=     -> streams the file (admin preview)
//
// Auth: the caller sends the Supabase access_token as `Authorization: Bearer …`.
// We validate it by calling Supabase /auth/v1/user — so no JWT secret is needed
// and it works regardless of the project's signing scheme.
// ---------------------------------------------------------------------------

const PART_PREFIX = "deliverables";

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Echo the caller's origin so the booking widget works wherever the site is
  // hosted (tmke.co.uk, www, the Railway URL, previews, etc.). These endpoints
  // are either public (availability) or protected by a bearer token (R2 gallery
  // / uploads), so CORS is not the security boundary here. ALLOWED_ORIGINS is
  // kept as documentation / an easy way to force "*" if ever needed.
  const allowOrigin = allowed.includes("*") ? "*" : (origin || allowed[0] || "");
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(request, env) },
  });
}

// Cheap, network-free check: token present and not expired. Used on the hot
// upload path (parts), which additionally requires an unguessable uploadId that
// is only ever issued by the fully-authenticated /create endpoint.
function cheapValid(request) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(part));
    return !!(payload && payload.exp && payload.exp * 1000 > Date.now());
  } catch (_) {
    return false;
  }
}

// Validate the Supabase session token. Returns the user object or null.
async function getUser(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user && user.id ? user : null;
  } catch (_) {
    return null;
  }
}

// Admin gate for staff-only endpoints (e.g. sending email). Mirrors the client
// allowlist in src/lib/admin-gate.js: a TMKE-domain email, or the named extra.
const ADMIN_EMAIL_DOMAINS = ["tmke.co.uk"];
const ADMIN_EMAILS = ["james@therecruitmentexperts.co.uk"];
function isAdminEmail(user) {
  const e = String((user && user.email) || "").toLowerCase().trim();
  if (!e) return false;
  if (ADMIN_EMAILS.includes(e)) return true;
  return ADMIN_EMAIL_DOMAINS.includes(e.split("@")[1] || "");
}

// Read from Supabase with the service role (server-side only, never exposed).
async function sbGet(env, table, qs) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return null;
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

// The free teaser set = the first `teaserCount` image files (created order).
function teaserKeys(deliverables, teaserCount) {
  const imgs = (deliverables || []).filter((d) => d.kind === "image");
  return new Set(imgs.slice(0, Math.max(0, teaserCount || 0)).map((d) => d.r2_key));
}

// ---- Microsoft Graph (app-only / client credentials) --------------------
let _msToken = null; // { token, exp } cached per Worker isolate
async function msToken(env) {
  if (_msToken && _msToken.exp > Date.now() + 60000) return _msToken.token;
  const body = new URLSearchParams({
    client_id: env.MS_CLIENT_ID,
    client_secret: env.MS_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${env.MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Microsoft token request failed (" + res.status + ")");
  const j = await res.json();
  _msToken = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return _msToken.token;
}
async function graph(env, method, path, body) {
  const token = await msToken(env);
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) {}
  if (!res.ok) throw new Error("Graph " + res.status + ": " + (data && data.error ? data.error.message : text));
  return data;
}
// Insert a row into Supabase with the service role.
async function sbPost(env, table, row) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
}
const hmToMin = (hm) => { const [h, m] = String(hm).split(":").map(Number); return h * 60 + m; };
const minToHm = (min) => String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");

// Build a safe object key for a booking's file.
function safeKey(bookingId, fileName) {
  const id = String(bookingId || "unfiled").replace(/[^a-zA-Z0-9_-]/g, "");
  const clean = String(fileName || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
  return `${PART_PREFIX}/${id}/${clean}`;
}

// ---- Scheduled-post reminder emails (Resend) ----------------------------
async function sbPatch(env, table, qs, body) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
}
async function sbAdminUserEmail(env, userId) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}` },
  });
  if (!res.ok) return null;
  const u = await res.json();
  return u && u.email ? u.email : null;
}
function bufToBase64(buf) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function reminderHtml(item, platform, caption) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const cap = esc(caption);
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22">
    <h1 style="font-size:22px;margin:0 0 6px">Your post is ready to go out today</h1>
    <p style="color:#555;font-size:14px;margin:0 0 20px">Here's your scheduled <strong>${esc(platform)}</strong> post${item.title ? ` &mdash; &ldquo;${esc(item.title)}&rdquo;` : ""}. The image is attached &mdash; copy your caption below and you're set.</p>
    ${cap ? `<div style="background:#f2efe9;border-left:3px solid #474254;border-radius:4px;padding:14px 16px;font-size:14px;line-height:1.6;white-space:pre-wrap">${cap}</div>` : `<p style="color:#888;font-size:13px">No caption saved for this post.</p>`}
    <p style="font-size:13px;color:#555;margin:18px 0 0">&#128206; Your post image is attached to this email.</p>
    <p style="font-size:12px;color:#999;margin:24px 0 0">Sent by TMKE &middot; <a href="https://tmke.co.uk/account/schedule" style="color:#474254">View your calendar</a></p>
  </div>`;
}
function waitlistHtml({ name, service, pkg, date, time }) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let niceDate = esc(date);
  try { niceDate = new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch (_) {}
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22">
    <h1 style="font-size:22px;margin:0 0 6px">You're on the cancellation list</h1>
    <p style="color:#555;font-size:14px;margin:0 0 20px">Hi ${esc(name)}, thanks for registering your interest in <strong>${esc(service)}</strong>. We're fully booked right now, but you're on the list &mdash; we'll message you the moment a slot opens that matches what you're after.</p>
    <div style="background:#f4f2f1;border-left:3px solid #371e28;border-radius:4px;padding:14px 16px;font-size:14px;line-height:1.7">
      ${pkg ? `<div><strong>Package:</strong> ${esc(pkg)}</div>` : ""}
      <div><strong>Preferred date:</strong> ${niceDate}</div>
      <div><strong>Preferred time:</strong> ${esc(time)}</div>
    </div>
    <p style="font-size:13px;color:#555;margin:18px 0 0">No need to do anything &mdash; we'll be in touch. If your plans change, just reply to this email.</p>
    <p style="font-size:12px;color:#999;margin:24px 0 0">Sent by TMKE &middot; <a href="https://tmke.co.uk/videography" style="color:#371e28">tmke.co.uk</a></p>
  </div>`;
}
// ---- Videography booking confirmation (account + ICS + emails) -------------
function gbpW(p) { const v = (p || 0) / 100; return "£" + v.toLocaleString("en-GB", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
function icsEsc(s) { return String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
const dtLocalICS = (date, hm) => date.replace(/-/g, "") + "T" + hm.replace(":", "") + "00";
const utcStampICS = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
function buildICS({ uid, date, start, endHm, summary, description, location, organizer, attendeeEmail, attendeeName }) {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TMKE//Booking//EN", "CALSCALE:GREGORIAN", "METHOD:REQUEST",
    "BEGIN:VTIMEZONE", "TZID:Europe/London",
    "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0000", "TZOFFSETTO:+0100", "TZNAME:BST", "DTSTART:19700329T010000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0000", "TZNAME:GMT", "DTSTART:19701025T020000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${utcStampICS()}`,
    `DTSTART;TZID=Europe/London:${dtLocalICS(date, start)}`,
    `DTEND;TZID=Europe/London:${dtLocalICS(date, endHm)}`,
    `SUMMARY:${icsEsc(summary)}`,
    `DESCRIPTION:${icsEsc(description)}`,
    location ? `LOCATION:${icsEsc(location)}` : "",
    organizer ? `ORGANIZER;CN=TMKE:mailto:${organizer}` : "",
    attendeeEmail ? `ATTENDEE;CN=${icsEsc(attendeeName || attendeeEmail)};RSVP=TRUE:mailto:${attendeeEmail}` : "",
    "STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}
function bookingConfirmHtml({ name, service, packageLabel, dateNice, time, addOns, postcode, surchargePence, totalPence, manageUrl }) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = [
    ["Service", esc(service)],
    packageLabel ? [service && service.includes("Agent") ? "Packages" : "Package", esc(packageLabel)] : null,
    addOns && addOns.length ? ["Add-ons", esc(addOns.map((a) => a.name).join(", "))] : null,
    postcode ? ["Location", esc(postcode)] : null,
    ["Date", esc(dateNice)],
    ["Time", esc(time)],
    surchargePence ? ["Travel", gbpW(surchargePence) + " + VAT"] : null,
    totalPence != null ? ["Total", "<strong>" + gbpW(totalPence) + " inc. VAT</strong>"] : null,
  ].filter(Boolean);
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22">
    <h1 style="font-size:22px;margin:0 0 6px">Your booking is confirmed</h1>
    <p style="color:#555;font-size:14px;margin:0 0 20px">Hi ${esc(name)}, thanks for booking with TMKE. Here are the details &mdash; we've attached a calendar invite so you can add it to your diary.</p>
    <div style="background:#f4f2f1;border-left:3px solid #371e28;border-radius:4px;padding:16px 18px;font-size:14px;line-height:1.9">
      ${rows.map(([k, v]) => `<div><span style="color:#888">${k}:</span> ${v}</div>`).join("")}
    </div>
    <p style="font-size:13px;color:#555;margin:18px 0 0">We've set up your account so you can view, reschedule or cancel this booking any time${manageUrl ? ` at <a href="${manageUrl}" style="color:#371e28">your account</a>` : ""}. Please give at least 3 days' notice to cancel and 2 days to rearrange.</p>
    <p style="font-size:12px;color:#999;margin:24px 0 0">Sent by TMKE &middot; <a href="https://tmke.co.uk/videography" style="color:#371e28">tmke.co.uk</a></p>
  </div>`;
}
function jackNotifyHtml({ name, company, email, phone, service, packageLabel, addOns, postcode, distanceMiles, surchargePence, dateNice, time, totalPence, signedName, marketingOptIn }) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const row = (k, v) => v ? `<div><span style="color:#888">${k}:</span> ${esc(v)}</div>` : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22">
    <h1 style="font-size:20px;margin:0 0 6px">New booking — ${esc(service)}</h1>
    <div style="background:#f4f2f1;border-left:3px solid #371e28;border-radius:4px;padding:16px 18px;font-size:14px;line-height:1.9">
      ${row("Client", name)}${row("Company", company)}${row("Email", email)}${row("Phone", phone)}
      ${row("Package", packageLabel)}${addOns && addOns.length ? row("Add-ons", addOns.map((a) => a.name).join(", ")) : ""}
      ${row("Location", postcode)}${distanceMiles != null ? row("Distance", Math.round(distanceMiles) + " mi") : ""}
      ${surchargePence ? row("Travel surcharge", gbpW(surchargePence) + " + VAT") : ""}
      ${row("Date", dateNice)}${row("Time", time)}
      ${totalPence != null ? row("Total", gbpW(totalPence) + " inc. VAT") : ""}
      ${row("Signed", signedName)}${row("Marketing opt-in", marketingOptIn ? "Yes" : "No")}
    </div>
    <p style="font-size:12px;color:#999;margin:18px 0 0">It's in your calendar and the CRM pipeline (stage: booked).</p>
  </div>`;
}
async function sendEmail(env, { to, subject, html, attachments }) {
  if (!env.RESEND_API_KEY || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM || "TMKE <onboarding@resend.dev>", to, subject, html, ...(attachments ? { attachments } : {}) }),
    });
  } catch (_) { /* email is best-effort */ }
}

async function runReminders(env) {
  if (!env.RESEND_API_KEY || !env.SUPABASE_SERVICE_ROLE) return;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }); // YYYY-MM-DD
  const due = (await sbGet(env, "calendar_items",
    `status=eq.scheduled&scheduled_date=eq.${today}&select=*`)) || [];
  for (const item of due) {
    try {
      const email = await sbAdminUserEmail(env, item.user_id);
      if (!email) continue;
      const attachments = [];
      if (item.asset_url) {
        try {
          const aRes = await fetch(item.asset_url);
          if (aRes.ok) {
            const buf = await aRes.arrayBuffer();
            const name = (item.asset_url.split("/").pop() || "post.png").split("?")[0] || "post.png";
            attachments.push({ filename: name, content: bufToBase64(buf) });
          }
        } catch (_) { /* attach nothing if the asset can't be fetched */ }
      }
      const platform = item.platform_hint || "instagram";
      const sent = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.MAIL_FROM || "TMKE <onboarding@resend.dev>",
          to: email,
          subject: `Your ${platform} post is scheduled for today`,
          html: reminderHtml(item, platform, item.caption || ""),
          attachments: attachments.length ? attachments : undefined,
        }),
      });
      if (sent.ok) {
        await sbPatch(env, "calendar_items", `id=eq.${item.id}`,
          { status: "reminder_sent", reminder_sent_at: new Date().toISOString() });
      }
    } catch (_) { /* skip this item, keep going */ }
  }
}

export default {
  // Daily cron (see wrangler.toml [triggers]) — emails posts due today.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReminders(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      // ---- AI: read text + positions from a finished design image ----
      // Powers the studio's "Read text with AI" (Canva import). Holds the
      // Anthropic key as a Worker secret so it never reaches the browser.
      if (path.endsWith("/ai/parse") && request.method === "POST") {
        if (!cheapValid(request)) return json({ error: "Sign in to use AI." }, 401, request, env);
        if (!env.ANTHROPIC_API_KEY) return json({ error: "AI isn't configured — set the ANTHROPIC_API_KEY secret on the Worker (wrangler secret put ANTHROPIC_API_KEY)." }, 503, request, env);
        let body;
        try { body = await request.json(); } catch (_) { return json({ error: "Bad JSON" }, 400, request, env); }
        const W = Math.max(1, Math.round(body.width || 1080));
        const H = Math.max(1, Math.round(body.height || 1350));
        const raw = String(body.image || "");
        const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(raw);
        const mediaType = m ? m[1] : "image/jpeg";
        const b64 = m ? m[2] : raw;
        if (!b64) return json({ error: "Missing image" }, 400, request, env);
        const clampN = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : lo; };
        const prompt =
          "The attached image is a finished social-media graphic, exactly " + W + "x" + H + " pixels. " +
          "Identify every distinct piece of TEXT visible in it and report it so it can be recreated as editable layers. " +
          "Respond with ONLY a JSON array (no prose, no markdown fences). Each item: " +
          '{"text": string (the exact words; keep line breaks as \\n), ' +
          '"x": number (left edge in px), "y": number (top edge in px), ' +
          '"w": number (block width px), "h": number (block height px), ' +
          '"fontSize": number (approx px), "color": "#rrggbb", "weight": 400 or 700, ' +
          '"align": "left"|"center"|"right"}. ' +
          "All coordinates are in the " + W + "x" + H + " pixel space of the image. " +
          "Group words that share a line/paragraph and style into one block. " +
          "Only include real text — ignore logos drawn as images, photographic content, and decorative graphics. " +
          "If there is no text, return [].";
        let aiRes;
        try {
          aiRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
            body: JSON.stringify({
              model: env.AI_MODEL || "claude-sonnet-4-6",
              max_tokens: 4000,
              messages: [{ role: "user", content: [
                { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
                { type: "text", text: prompt },
              ] }],
            }),
          });
        } catch (e) { return json({ error: "Couldn't reach the AI service." }, 502, request, env); }
        if (!aiRes.ok) {
          const t = await aiRes.text().catch(() => "");
          return json({ error: "AI request failed (" + aiRes.status + ").", detail: t.slice(0, 300) }, 502, request, env);
        }
        const data = await aiRes.json();
        const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
        let parsed = [];
        try {
          const s = text.indexOf("["), e = text.lastIndexOf("]");
          parsed = JSON.parse(text.slice(s, e + 1));
        } catch (_) { return json({ error: "Couldn't read the AI output.", raw: text.slice(0, 200) }, 502, request, env); }
        const blocks = (Array.isArray(parsed) ? parsed : [])
          .filter((b) => b && typeof b.text === "string" && b.text.trim())
          .map((b) => ({
            text: String(b.text),
            x: clampN(b.x, 0, W), y: clampN(b.y, 0, H),
            w: clampN(b.w, 12, W), h: clampN(b.h, 12, H),
            fontSize: clampN(b.fontSize != null ? b.fontSize : b.size, 6, 400),
            color: /^#[0-9a-f]{6}$/i.test(b.color || "") ? b.color : "#1c1d22",
            weight: parseInt(b.weight, 10) >= 600 ? 700 : 400,
            align: ["left", "center", "right"].includes(b.align) ? b.align : "left",
          }));
        return json({ blocks, usage: data.usage || null }, 200, request, env);
      }

    // ---- PUBLIC client gallery (token-gated, NO login required) ----
      if (path.endsWith("/g/meta") && request.method === "GET") {
        const token = url.searchParams.get("token") || "";
        const rows = token
          ? await sbGet(env, "videography_deliveries", `token=eq.${encodeURIComponent(token)}&select=*`)
          : null;
        const d = rows && rows[0];
        if (!d) return json({ error: "Not found" }, 404, request, env);
        const files =
          (await sbGet(env, "videography_deliverables",
            `booking_id=eq.${d.booking_id}&select=r2_key,file_name,kind,size_bytes,category&order=created_at.asc`)) || [];
        const teasers = teaserKeys(files, d.teaser_count);
        const paid = d.status === "paid";
        return json({
          clientName: d.client_name, message: d.message, status: d.status,
          basePence: d.base_pence, extras: d.extras || [], totalPence: d.total_pence,
          teaserCount: d.teaser_count, paid,
          files: files.map((f) => ({
            key: f.r2_key, name: f.file_name, kind: f.kind, size: f.size_bytes,
            category: f.category || null,
            unlocked: paid || teasers.has(f.r2_key),
          })),
        }, 200, request, env);
      }

      if (path.endsWith("/g/file") && request.method === "GET") {
        const token = url.searchParams.get("token") || "";
        const key = url.searchParams.get("key") || "";
        const dl = url.searchParams.get("dl") === "1";
        const rows = token
          ? await sbGet(env, "videography_deliveries", `token=eq.${encodeURIComponent(token)}&select=*`)
          : null;
        const d = rows && rows[0];
        if (!d || !key) return json({ error: "Forbidden" }, 403, request, env);
        const files =
          (await sbGet(env, "videography_deliverables",
            `booking_id=eq.${d.booking_id}&select=r2_key,kind&order=created_at.asc`)) || [];
        if (!files.some((f) => f.r2_key === key)) return json({ error: "Not found" }, 404, request, env);
        const allowed = d.status === "paid" || teaserKeys(files, d.teaser_count).has(key);
        if (!allowed) return json({ error: "Locked" }, 403, request, env);
        const obj = await env.BUCKET.get(key);
        if (!obj) return json({ error: "Not found" }, 404, request, env);
        const headers = new Headers(corsHeaders(request, env));
        obj.writeHttpMetadata(headers);
        headers.set("etag", obj.httpEtag);
        const name = key.split("/").pop();
        headers.set("Content-Disposition", `${dl ? "attachment" : "inline"}; filename="${name}"`);
        return new Response(obj.body, { headers });
      }

      // Available hours for a weekday row: prefer hours[] (new block model),
      // fall back to the old start_time/end_time range. Returns a sorted int[].
      const rowHours = (row) => {
        let h = Array.isArray(row && row.hours) ? row.hours.slice() : [];
        if (!h.length && row && row.is_available !== false && row.start_time && row.end_time) {
          const s = Math.floor(hmToMin(row.start_time) / 60), e = Math.ceil(hmToMin(row.end_time) / 60);
          for (let x = s; x < e; x++) h.push(x);
        }
        return h.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
      };

      // ---- Which weekdays are bookable (for the booking calendar) ----
      if (path.endsWith("/ms/config") && request.method === "GET") {
        const rows = (await sbGet(env, "videography_availability", `select=weekday,hours,is_available,start_time,end_time`)) || [];
        const weekdays = {};
        rows.forEach((r) => { const h = rowHours(r); if (h.length) weekdays[r.weekday] = h; });
        return json({ weekdays }, 200, request, env);
      }

      // ---- Travel distance + surcharge (Property / Agent shoots) ----
      // Geocodes Jack's base + the shoot postcode and returns the driving
      // distance and travel surcharge. Settings (base postcode, free radius,
      // per-mile rate) come from `videography_settings`; the Maps key is a
      // secret (`wrangler secret put GOOGLE_MAPS_API_KEY`). Without the key we
      // fall back to a straight-line estimate via postcodes.io (free, no key).
      if (path.endsWith("/videography/distance") && request.method === "GET") {
        const to = (url.searchParams.get("to") || "").trim();
        if (!to) return json({ error: "Missing destination postcode" }, 400, request, env);
        let base = "NN14 1AA", freeRadius = 40, perMile = 55;
        try {
          const s = await sbGet(env, "videography_settings", "id=eq.1&select=base_postcode,free_radius_miles,surcharge_pence_per_mile");
          if (s && s[0]) {
            base = s[0].base_postcode || base;
            if (s[0].free_radius_miles != null) freeRadius = s[0].free_radius_miles;
            if (s[0].surcharge_pence_per_mile != null) perMile = s[0].surcharge_pence_per_mile;
          }
        } catch (_) {}
        let miles = null, source = null;
        if (env.GOOGLE_MAPS_API_KEY) {
          try {
            const u = `https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&region=uk&origins=${encodeURIComponent(base)}&destinations=${encodeURIComponent(to)}&key=${env.GOOGLE_MAPS_API_KEY}`;
            const d = await (await fetch(u)).json();
            const el = d && d.rows && d.rows[0] && d.rows[0].elements && d.rows[0].elements[0];
            if (el && el.status === "OK" && el.distance) { miles = el.distance.value / 1609.344; source = "drive"; }
          } catch (_) {}
        }
        if (miles == null) {
          try {
            const clean = (p) => encodeURIComponent(p.replace(/\s+/g, ""));
            const [b, t] = await Promise.all([
              fetch("https://api.postcodes.io/postcodes/" + clean(base)).then((r) => r.json()),
              fetch("https://api.postcodes.io/postcodes/" + clean(to)).then((r) => r.json()),
            ]);
            if (b.result && t.result) {
              const R = 3958.8, rad = (x) => (x * Math.PI) / 180;
              const dLa = rad(t.result.latitude - b.result.latitude), dLo = rad(t.result.longitude - b.result.longitude);
              const a = Math.sin(dLa / 2) ** 2 + Math.cos(rad(b.result.latitude)) * Math.cos(rad(t.result.latitude)) * Math.sin(dLo / 2) ** 2;
              miles = 2 * R * Math.asin(Math.sqrt(a)); source = "estimate";
            }
          } catch (_) {}
        }
        if (miles == null) return json({ error: "Couldn't resolve that postcode" }, 422, request, env);
        const surcharge_pence = Math.max(0, Math.ceil(miles - freeRadius)) * perMile;
        return json({ miles: Math.round(miles * 10) / 10, surcharge_pence, free_radius_miles: freeRadius, pence_per_mile: perMile, source }, 200, request, env);
      }

      // ---- Live headshots: newest N images in the assets "Jack - headshots/"
      // folder. Public GET; powers the auto-updating Agent gallery. ----
      if (path.endsWith("/headshots") && request.method === "GET") {
        if (!env.ASSETS) return json({ images: [] }, 200, request, env);
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "60", 10)));
        const prefix = "Jack - headshots/";
        const listed = await env.ASSETS.list({ prefix });
        const imgs = (listed.objects || [])
          .filter((o) => /\.(jpe?g|png|webp|avif)$/i.test(o.key))     // images only (skip the intro video etc.)
          .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded)) // newest first
          .slice(0, limit)
          .map((o) => "https://assets.tmke.co.uk/" + o.key.split("/").map(encodeURIComponent).join("/"));
        return json({ images: imgs }, 200, request, env);
      }

      // ---- Bookable slots for a day (Jack's diary hours minus 365 busy) ----
      if (path.endsWith("/ms/availability") && request.method === "GET") {
        const date = url.searchParams.get("date"); // YYYY-MM-DD
        const duration = parseInt(url.searchParams.get("duration") || "60", 10);
        if (!date) return json({ error: "Missing date" }, 400, request, env);
        const wd = new Date(date + "T12:00:00Z").getUTCDay(); // 0=Sun..6=Sat
        const rows = (await sbGet(env, "videography_availability", `weekday=eq.${wd}&select=*`)) || [];
        const hours = rowHours(rows[0]);
        if (!hours.length) return json({ slots: [], duration }, 200, request, env);
        const STEP = 30;
        const openHours = new Set(hours);
        const dayStartMin = Math.min(...hours) * 60;
        const dayEndMin = (Math.max(...hours) + 1) * 60;
        const need = Math.max(1, Math.ceil(duration / STEP));
        const sched = await graph(env, "POST", `/users/${encodeURIComponent(env.JACK_UPN)}/calendar/getSchedule`, {
          schedules: [env.JACK_UPN],
          startTime: { dateTime: `${date}T${minToHm(dayStartMin)}:00`, timeZone: "Europe/London" },
          endTime: { dateTime: `${date}T${minToHm(dayEndMin)}:00`, timeZone: "Europe/London" },
          availabilityViewInterval: STEP,
        });
        const view = (sched.value && sched.value[0] && sched.value[0].availabilityView) || "";
        const totalSlots = Math.floor((dayEndMin - dayStartMin) / STEP);
        const slots = [];
        for (let i = 0; i + need <= totalSlots; i++) {
          let ok = true;
          for (let k = 0; k < need; k++) {
            const slotMin = dayStartMin + (i + k) * STEP;
            const busy = view[i + k];
            if (!openHours.has(Math.floor(slotMin / 60)) || (busy && busy !== "0")) { ok = false; break; }
          }
          if (ok) slots.push(minToHm(dayStartMin + i * STEP));
        }
        return json({ slots, duration }, 200, request, env);
      }

      // ---- Create a booking (writes to Jack's calendar + pipeline) ----
      if (path.endsWith("/ms/book") && request.method === "POST") {
        const b = await request.json();
        const { date, start, duration, name, email, phone, service, notes } = b || {};
        if (!date || !start || !name) return json({ error: "Missing booking details" }, 400, request, env);
        const dur = parseInt(duration || "60", 10);
        const endHm = minToHm(hmToMin(start) + dur);
        // Re-check the slot is still free (guards against double-booking)
        const check = await graph(env, "POST", `/users/${encodeURIComponent(env.JACK_UPN)}/calendar/getSchedule`, {
          schedules: [env.JACK_UPN],
          startTime: { dateTime: `${date}T${start}:00`, timeZone: "Europe/London" },
          endTime: { dateTime: `${date}T${endHm}:00`, timeZone: "Europe/London" },
          availabilityViewInterval: Math.max(15, dur),
        });
        const view = (check.value && check.value[0] && check.value[0].availabilityView) || "";
        if (view && /[^0]/.test(view)) return json({ error: "That time was just taken — please choose another." }, 409, request, env);
        const ev = await graph(env, "POST", `/users/${encodeURIComponent(env.JACK_UPN)}/events`, {
          subject: `${service || "Shoot"} — ${name}`,
          body: { contentType: "text", content: [notes && `Notes: ${notes}`, phone && `Phone: ${phone}`, email && `Email: ${email}`].filter(Boolean).join("\n") },
          start: { dateTime: `${date}T${start}:00`, timeZone: "Europe/London" },
          end: { dateTime: `${date}T${endHm}:00`, timeZone: "Europe/London" },
          attendees: email ? [{ emailAddress: { address: email, name }, type: "required" }] : [],
        });
        await sbPost(env, "videography_bookings", {
          client_name: name, client_email: email || null, client_phone: phone || null,
          service: service || null, shoot_date: `${date}T${start}:00`, stage: "booked", notes: notes || null,
        });
        return json({ ok: true, eventId: ev.id }, 200, request, env);
      }

      // ---- Full booking (account + record + confirmation emails + pipeline) --
      // Public: the booking flow's final step. Creates/links a Supabase account
      // (never overwrites an existing one), books Jack's 365 diary, writes the
      // full pipeline row, and emails the client (with an .ics) + Jack.
      if (path.endsWith("/videography/book") && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const {
          date, start, duration, service, service_type, audience, brand,
          add_ons, postcode, distance_miles, surcharge_pence,
          name, email, phone, company, notes, signed_name, signed_at,
          marketing_opt_in, password, total_pence, account_exists, promo_code, discount_pence,
        } = b || {};
        const pkg = b && b.package;
        if (!date || !start || !name || !email) return json({ error: "Missing booking details" }, 400, request, env);
        // New customers create an account (password required). Existing members
        // sign in client-side first and send account_exists, so no password here.
        if (!account_exists && (!password || String(password).length < 8)) return json({ error: "A password of at least 8 characters is required." }, 400, request, env);
        const dur = parseInt(duration || "60", 10);
        const endHm = minToHm(hmToMin(start) + dur);

        // 1) Re-check the slot is still free (guards against double-booking).
        const check = await graph(env, "POST", `/users/${encodeURIComponent(env.JACK_UPN)}/calendar/getSchedule`, {
          schedules: [env.JACK_UPN],
          startTime: { dateTime: `${date}T${start}:00`, timeZone: "Europe/London" },
          endTime: { dateTime: `${date}T${endHm}:00`, timeZone: "Europe/London" },
          availabilityViewInterval: Math.max(15, dur),
        });
        const view = (check.value && check.value[0] && check.value[0].availabilityView) || "";
        if (view && /[^0]/.test(view)) return json({ error: "That time was just taken — please choose another." }, 409, request, env);

        // 2) Create or link the Supabase account (never overwrite an existing one).
        let accountUserId = null, accountCreated = false;
        try {
          if (account_exists) {
            // Existing member (already signed in client-side) — just link the id.
            const look = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
              headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}` },
            });
            if (look.ok) { const d = await look.json(); const list = (d && d.users) || d; if (Array.isArray(list) && list[0]) accountUserId = list[0].id; }
          } else {
            const cr = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
              method: "POST",
              headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json" },
              body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: name, company: company || null, phone: phone || null } }),
            });
            if (cr.ok) { const u = await cr.json(); accountUserId = (u && u.id) || null; accountCreated = true; }
            else {
              // Already registered — find their id so the booking still links (best-effort).
              const look = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
                headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}` },
              });
              if (look.ok) { const d = await look.json(); const list = (d && d.users) || d; if (Array.isArray(list) && list[0]) accountUserId = list[0].id; }
            }
          }
        } catch (_) { /* account is best-effort; the booking still proceeds */ }

        // If a promo code was applied, redeem it (increments redemptions; best-effort).
        if (promo_code) {
          try {
            await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/redeem_promo_code`, {
              method: "POST",
              headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json" },
              body: JSON.stringify({ p_code: String(promo_code).toUpperCase() }),
            });
          } catch (_) {}
        }

        // 3) Book Jack's 365 calendar.
        const ev = await graph(env, "POST", `/users/${encodeURIComponent(env.JACK_UPN)}/events`, {
          subject: `${service || "Shoot"} — ${name}`,
          body: { contentType: "text", content: [notes && `Notes: ${notes}`, phone && `Phone: ${phone}`, email && `Email: ${email}`, postcode && `Postcode: ${postcode}`].filter(Boolean).join("\n") },
          start: { dateTime: `${date}T${start}:00`, timeZone: "Europe/London" },
          end: { dateTime: `${date}T${endHm}:00`, timeZone: "Europe/London" },
          location: postcode ? { displayName: postcode } : undefined,
          attendees: [{ emailAddress: { address: email, name }, type: "required" }],
        });

        // 4) Write the full pipeline row.
        const rescheduleToken = (crypto.randomUUID && crypto.randomUUID()) || `${date}-${Math.abs(hmToMin(start))}-${ev.id || ""}`;
        await sbPost(env, "videography_bookings", {
          kind: "booking", service_type: service_type || null, audience: audience || null, brand: brand || null,
          package: pkg || null, add_ons: Array.isArray(add_ons) ? add_ons : [], postcode: postcode || null,
          distance_miles: distance_miles ?? null, surcharge_pence: surcharge_pence || 0,
          client_name: name, client_email: email, client_phone: phone || null, company: company || null,
          service: service || null, shoot_date: `${date}T${start}:00`, stage: "booked", notes: notes || null,
          signed_name: signed_name || null, signed_at: signed_at || null, marketing_opt_in: !!marketing_opt_in,
          promo_code: promo_code || null, discount_pence: discount_pence || 0,
          account_user_id: accountUserId, reschedule_token: rescheduleToken, total_pence: total_pence ?? null,
          ms_event_id: ev.id || null, duration_min: dur,
        });

        // 5) Confirmation emails (best-effort, never block the booking).
        const dateNice = (() => { try { return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch (_) { return date; } })();
        const packageLabel = service && service.toLowerCase().includes("content") ? (pkg || "") : (b.package_label || pkg || "");
        const siteUrl = (env.SITE_URL || "https://tmke.co.uk").replace(/\/+$/, "");
        const ics = buildICS({
          uid: `${ev.id || rescheduleToken}@tmke.co.uk`, date, start, endHm,
          summary: `${service || "TMKE Shoot"}`,
          description: [service, packageLabel, postcode && `Location: ${postcode}`, total_pence != null && `Total: ${gbpW(total_pence)} inc. VAT`].filter(Boolean).join("\n"),
          location: postcode || "", organizer: env.JACK_UPN, attendeeEmail: email, attendeeName: name,
        });
        const icsB64 = bufToBase64(new TextEncoder().encode(ics).buffer);
        await sendEmail(env, {
          to: email, subject: `Booking confirmed — ${service || "TMKE"}`,
          html: bookingConfirmHtml({ name, service, packageLabel, dateNice, time: start, addOns: add_ons, postcode, surchargePence: surcharge_pence, totalPence: total_pence, manageUrl: `${siteUrl}/manage?token=${encodeURIComponent(rescheduleToken)}` }),
          attachments: [{ filename: "booking.ics", content: icsB64, contentType: "text/calendar" }],
        });
        await sendEmail(env, {
          to: env.JACK_NOTIFY || env.JACK_UPN, subject: `New booking — ${service || "Shoot"} — ${name}`,
          html: jackNotifyHtml({ name, company, email, phone, service, packageLabel, addOns: add_ons, postcode, distanceMiles: distance_miles, surchargePence: surcharge_pence, dateNice, time: start, totalPence: total_pence, signedName: signed_name, marketingOptIn: marketing_opt_in }),
        });

        return json({ ok: true, eventId: ev.id, account_created: accountCreated }, 200, request, env);
      }

      // ---- Non-member enquiry (Property / Agent) — lands in the Enquiries inbox
      // (/admin/enquiries), tagged with a videography source, plus an FYI email
      // to Jack. It is NOT added to Jack's videography pipeline (that's bookings).
      if (path.endsWith("/videography/enquiry") && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const { service, service_type, name, email, phone, company, postcode, message, marketing_opt_in } = b || {};
        if (!name || !email) return json({ error: "Please add your name and email." }, 400, request, env);
        // Split the full name — the enquiries table needs a non-empty last name.
        const nameParts = String(name).trim().split(/\s+/);
        const firstName = nameParts.shift() || name;
        const lastName = nameParts.join(" ") || "—";
        // Fold the fields the enquiries table has no column for into the message.
        const fullMessage = [
          message || "",
          postcode ? `Property / shoot postcode: ${postcode}` : "",
          `Marketing opt-in: ${marketing_opt_in ? "yes" : "no"}`,
        ].filter(Boolean).join("\n\n");
        await sbPost(env, "enquiries", {
          first_name: firstName, last_name: lastName, email,
          phone: phone || null, business_name: company || null,
          industry: service || null, message: fullMessage,
          source: `videography_${service_type || "general"}`, status: "new",
        });
        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        await sendEmail(env, {
          to: email, subject: `Thanks for your enquiry — ${service || "TMKE"}`,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22">
            <h1 style="font-size:22px;margin:0 0 6px">Thanks — we'll be in touch</h1>
            <p style="color:#555;font-size:14px;margin:0 0 18px">Hi ${esc(name)}, thanks for your interest in ${esc(service || "our videography")}. Jack will be in touch shortly to talk through what you need and put a quote together.</p>
            ${message ? `<div style="background:#f4f2f1;border-left:3px solid #371e28;border-radius:4px;padding:14px 16px;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(message)}</div>` : ""}
            <p style="font-size:12px;color:#999;margin:24px 0 0">Sent by TMKE &middot; <a href="https://tmke.co.uk/videography" style="color:#371e28">tmke.co.uk</a></p></div>`,
        });
        await sendEmail(env, {
          to: env.JACK_NOTIFY || env.JACK_UPN, subject: `New enquiry — ${service || "Videography"} — ${name}`,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22">
            <h1 style="font-size:20px;margin:0 0 6px">New enquiry — ${esc(service || "Videography")}</h1>
            <div style="background:#f4f2f1;border-left:3px solid #371e28;border-radius:4px;padding:16px 18px;font-size:14px;line-height:1.9">
              <div><span style="color:#888">Client:</span> ${esc(name)}</div>
              ${company ? `<div><span style="color:#888">Company:</span> ${esc(company)}</div>` : ""}
              <div><span style="color:#888">Email:</span> ${esc(email)}</div>
              ${phone ? `<div><span style="color:#888">Phone:</span> ${esc(phone)}</div>` : ""}
              ${postcode ? `<div><span style="color:#888">Location:</span> ${esc(postcode)}</div>` : ""}
              ${message ? `<div><span style="color:#888">Message:</span> ${esc(message)}</div>` : ""}
            </div>
            <p style="font-size:12px;color:#999;margin:18px 0 0">Saved to the Enquiries inbox (/admin/enquiries).</p></div>`,
        });
        return json({ ok: true }, 200, request, env);
      }

      // ---- Register interest (Content Studio non-members) --------------------
      if (path.endsWith("/videography/register-interest") && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const email = String((b && b.email) || "").trim();
        const service = (b && b.service) || "content-studio";
        const optin = !!(b && b.marketing_opt_in);
        if (!email) return json({ error: "Please add your email." }, 400, request, env);
        await sbPost(env, "videography_bookings", {
          kind: "register_interest", service_type: service, audience: "non-member",
          client_email: email, service: "Content Studio", stage: "enquiry_non_member",
          notes: "Register interest (members-only service)", marketing_opt_in: optin,
        });
        return json({ ok: true }, 200, request, env);
      }

      // ---- Does this email already have a TMKE account? (booking gate) -------
      if (path.endsWith("/videography/account-exists") && request.method === "GET") {
        const email = (url.searchParams.get("email") || "").trim().toLowerCase();
        if (!email) return json({ exists: false }, 200, request, env);
        try {
          const look = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
            headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}` },
          });
          if (look.ok) { const d = await look.json(); const list = (d && d.users) || d; return json({ exists: Array.isArray(list) && list.length > 0 }, 200, request, env); }
        } catch (_) {}
        return json({ exists: false }, 200, request, env);
      }

      // ---- Validate a promo code (admin-managed table) -----------------------
      if (path.endsWith("/videography/promo") && request.method === "GET") {
        const code = (url.searchParams.get("code") || "").trim().toUpperCase();
        const service = (url.searchParams.get("service") || "").trim();
        if (!code) return json({ ok: false, error: "Enter a code." }, 200, request, env);
        const rows = await sbGet(env, "videography_promo_codes", `code=eq.${encodeURIComponent(code)}&select=*`);
        const p = rows && rows[0];
        if (!p) return json({ ok: false, error: "That code isn't recognised." }, 200, request, env);
        if (p.active === false) return json({ ok: false, error: "That code is no longer active." }, 200, request, env);
        if (p.expires_at && new Date(p.expires_at) < new Date()) return json({ ok: false, error: "That code has expired." }, 200, request, env);
        if (p.max_redemptions != null && p.redemptions != null && p.redemptions >= p.max_redemptions) return json({ ok: false, error: "That code has been fully redeemed." }, 200, request, env);
        if (Array.isArray(p.services) && p.services.length && service && !p.services.includes(service)) return json({ ok: false, error: "That code doesn't apply to this service." }, 200, request, env);
        return json({ ok: true, code: p.code, kind: p.kind, value: p.value, label: p.label || p.code }, 200, request, env);
      }

      // ---- Discovery call — books a short call + a CRM lead ------------------
      if (path.endsWith("/videography/discovery") && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const { date, start, duration, interests, name, email, phone, company, message } = b || {};
        if (!date || !start || !name || !email) return json({ error: "Missing call details" }, 400, request, env);
        const dur = parseInt(duration || "30", 10);
        const endHm = minToHm(hmToMin(start) + dur);
        const check = await graph(env, "POST", `/users/${encodeURIComponent(env.JACK_UPN)}/calendar/getSchedule`, {
          schedules: [env.JACK_UPN],
          startTime: { dateTime: `${date}T${start}:00`, timeZone: "Europe/London" },
          endTime: { dateTime: `${date}T${endHm}:00`, timeZone: "Europe/London" },
          availabilityViewInterval: Math.max(15, dur),
        });
        const view = (check.value && check.value[0] && check.value[0].availabilityView) || "";
        if (view && /[^0]/.test(view)) return json({ error: "That time was just taken — please choose another." }, 409, request, env);
        const interestList = Array.isArray(interests) ? interests : [];
        const ev = await graph(env, "POST", `/users/${encodeURIComponent(env.JACK_UPN)}/events`, {
          subject: `Discovery Call — ${name}`,
          body: { contentType: "text", content: [interestList.length && `Interested in: ${interestList.join(", ")}`, message && `Notes: ${message}`, phone && `Phone: ${phone}`, company && `Company: ${company}`].filter(Boolean).join("\n") },
          start: { dateTime: `${date}T${start}:00`, timeZone: "Europe/London" },
          end: { dateTime: `${date}T${endHm}:00`, timeZone: "Europe/London" },
          attendees: [{ emailAddress: { address: email, name }, type: "required" }],
          isOnlineMeeting: true,
        });
        const token = (crypto.randomUUID && crypto.randomUUID()) || `${date}-${start}`;
        await sbPost(env, "videography_bookings", {
          kind: "discovery", service_type: "discovery", client_name: name, client_email: email,
          client_phone: phone || null, company: company || null, service: "Discovery Call",
          shoot_date: `${date}T${start}:00`, stage: "discovery_call_booked",
          discovery_interests: interestList, notes: message || null, reschedule_token: token, ms_event_id: ev.id || null, duration_min: dur,
        });
        const dateNice = (() => { try { return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch (_) { return date; } })();
        const ics = buildICS({ uid: `${ev.id || token}@tmke.co.uk`, date, start, endHm, summary: "Discovery Call — TMKE", description: ["A quick call with Jack to talk through your videography.", interestList.length && `Interested in: ${interestList.join(", ")}`].filter(Boolean).join("\n"), location: "Online / phone", organizer: env.JACK_UPN, attendeeEmail: email, attendeeName: name });
        const icsB64 = bufToBase64(new TextEncoder().encode(ics).buffer);
        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        await sendEmail(env, {
          to: email, subject: `Your discovery call is booked — ${dateNice}`,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22">
            <h1 style="font-size:22px;margin:0 0 6px">Your call is booked</h1>
            <p style="color:#555;font-size:14px;margin:0 0 18px">Hi ${esc(name)}, your discovery call with Jack is confirmed for <strong>${esc(dateNice)} at ${esc(start)}</strong>. We've attached a calendar invite &mdash; no prep needed, just bring your questions.</p>
            <p style="font-size:13px;color:#555;margin:0 0 8px">Need to change it? <a href="${(env.SITE_URL || "https://tmke.co.uk").replace(/\/+$/, "")}/manage?token=${encodeURIComponent(token)}" style="color:#371e28">Reschedule or cancel your call</a>.</p>
            <p style="font-size:12px;color:#999;margin:24px 0 0">Sent by TMKE &middot; <a href="https://tmke.co.uk/videography" style="color:#371e28">tmke.co.uk</a></p></div>`,
          attachments: [{ filename: "discovery-call.ics", content: icsB64, contentType: "text/calendar" }],
        });
        await sendEmail(env, {
          to: env.JACK_NOTIFY || env.JACK_UPN, subject: `New discovery call — ${name} — ${dateNice} ${start}`,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22">
            <h1 style="font-size:20px;margin:0 0 6px">Discovery call booked</h1>
            <div style="background:#f4f2f1;border-left:3px solid #371e28;border-radius:4px;padding:16px 18px;font-size:14px;line-height:1.9">
              <div><span style="color:#888">Client:</span> ${esc(name)}</div>
              ${company ? `<div><span style="color:#888">Company:</span> ${esc(company)}</div>` : ""}
              <div><span style="color:#888">Email:</span> ${esc(email)}</div>
              ${phone ? `<div><span style="color:#888">Phone:</span> ${esc(phone)}</div>` : ""}
              <div><span style="color:#888">When:</span> ${esc(dateNice)} at ${esc(start)}</div>
              ${interestList.length ? `<div><span style="color:#888">Interested in:</span> ${esc(interestList.join(", "))}</div>` : ""}
              ${message ? `<div><span style="color:#888">Notes:</span> ${esc(message)}</div>` : ""}
            </div></div>`,
        });
        return json({ ok: true, eventId: ev.id }, 200, request, env);
      }

      // ---- Manage a booking by token (portal + tokenised email links) -------
      // Authorised by the per-booking reschedule_token (a capability). Used by
      // the account portal and the email "manage your booking" links.
      if (path.endsWith("/videography/booking") && request.method === "GET") {
        const token = (url.searchParams.get("token") || "").trim();
        if (!token) return json({ error: "Missing token" }, 400, request, env);
        const rows = await sbGet(env, "videography_bookings", `reschedule_token=eq.${encodeURIComponent(token)}&select=id,kind,service,service_type,client_name,client_email,shoot_date,stage,postcode,total_pence,discovery_interests,duration_min`);
        const bk = rows && rows[0];
        if (!bk) return json({ error: "Booking not found" }, 404, request, env);
        const days = bk.shoot_date ? (new Date(bk.shoot_date) - new Date()) / 86400000 : null;
        return json({ booking: bk, can_cancel: days != null && days >= 3, can_reschedule: days != null && days >= 2 }, 200, request, env);
      }

      // ---- Cancel a booking (≥3 days' notice; enforced server-side) ----------
      if (path.endsWith("/videography/cancel") && request.method === "POST") {
        const { token } = await request.json().catch(() => ({}));
        if (!token) return json({ error: "Missing token" }, 400, request, env);
        const rows = await sbGet(env, "videography_bookings", `reschedule_token=eq.${encodeURIComponent(token)}&select=*`);
        const bk = rows && rows[0];
        if (!bk) return json({ error: "Booking not found" }, 404, request, env);
        if (bk.stage === "cancelled") return json({ ok: true, already: true }, 200, request, env);
        const days = bk.shoot_date ? (new Date(bk.shoot_date) - new Date()) / 86400000 : 0;
        if (days < 3) return json({ error: "Cancellations within 3 days can't be made online — please email jack@tmke.co.uk. Note: cancellations within 48 hours are chargeable in full." }, 422, request, env);
        if (bk.ms_event_id) { try { await graph(env, "DELETE", `/users/${encodeURIComponent(env.JACK_UPN)}/events/${bk.ms_event_id}`); } catch (_) {} }
        await sbPatch(env, "videography_bookings", `id=eq.${bk.id}`, { stage: "cancelled" });
        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        await sendEmail(env, {
          to: bk.client_email, subject: `Booking cancelled — ${bk.service || "TMKE"}`,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22"><h1 style="font-size:22px;margin:0 0 6px">Your booking is cancelled</h1><p style="color:#555;font-size:14px;margin:0 0 18px">Hi ${esc(bk.client_name || "")}, we've cancelled your ${esc(bk.service || "booking")}. If this was a mistake or you'd like to rebook, just head back to <a href="https://tmke.co.uk/videography" style="color:#371e28">tmke.co.uk/videography</a>.</p></div>`,
        });
        await sendEmail(env, { to: env.JACK_NOTIFY || env.JACK_UPN, subject: `Cancelled — ${bk.service || "Booking"} — ${bk.client_name || ""}`, html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1d22"><p>${esc(bk.client_name || "")} cancelled their ${esc(bk.service || "booking")} (was ${esc(bk.shoot_date || "")}).</p></div>` });
        return json({ ok: true }, 200, request, env);
      }

      // ---- Reschedule a booking (≥2 days' notice; moves the 365 event) -------
      if (path.endsWith("/videography/reschedule") && request.method === "POST") {
        const { token, date, start } = await request.json().catch(() => ({}));
        if (!token || !date || !start) return json({ error: "Missing details" }, 400, request, env);
        const rows = await sbGet(env, "videography_bookings", `reschedule_token=eq.${encodeURIComponent(token)}&select=*`);
        const bk = rows && rows[0];
        if (!bk) return json({ error: "Booking not found" }, 404, request, env);
        if (bk.stage === "cancelled") return json({ error: "This booking was cancelled." }, 422, request, env);
        const days = bk.shoot_date ? (new Date(bk.shoot_date) - new Date()) / 86400000 : 0;
        if (days < 2) return json({ error: "Rescheduling within 2 days can't be done online — please email jack@tmke.co.uk." }, 422, request, env);
        // Slot length: the stored duration, else read the existing 365 event, else 60.
        let dur = bk.duration_min || 0;
        if (!dur && bk.ms_event_id) {
          try {
            const ev0 = await graph(env, "GET", `/users/${encodeURIComponent(env.JACK_UPN)}/events/${bk.ms_event_id}?$select=start,end`);
            if (ev0 && ev0.start && ev0.end) { const d = Math.round((new Date(ev0.end.dateTime) - new Date(ev0.start.dateTime)) / 60000); if (d > 0) dur = d; }
          } catch (_) {}
        }
        if (!(dur > 0)) dur = 60;
        const endHm = minToHm(hmToMin(start) + dur);
        // Re-check the new slot is free (the existing event sits at the old time).
        const check = await graph(env, "POST", `/users/${encodeURIComponent(env.JACK_UPN)}/calendar/getSchedule`, {
          schedules: [env.JACK_UPN],
          startTime: { dateTime: `${date}T${start}:00`, timeZone: "Europe/London" },
          endTime: { dateTime: `${date}T${endHm}:00`, timeZone: "Europe/London" },
          availabilityViewInterval: Math.max(15, dur),
        });
        const view = (check.value && check.value[0] && check.value[0].availabilityView) || "";
        if (view && /[^0]/.test(view)) return json({ error: "That time isn't free — please pick another." }, 409, request, env);
        if (bk.ms_event_id) {
          await graph(env, "PATCH", `/users/${encodeURIComponent(env.JACK_UPN)}/events/${bk.ms_event_id}`, {
            start: { dateTime: `${date}T${start}:00`, timeZone: "Europe/London" },
            end: { dateTime: `${date}T${endHm}:00`, timeZone: "Europe/London" },
          });
        }
        await sbPatch(env, "videography_bookings", `id=eq.${bk.id}`, { shoot_date: `${date}T${start}:00` });
        const dateNice = (() => { try { return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch (_) { return date; } })();
        const ics = buildICS({ uid: `${bk.ms_event_id || bk.reschedule_token}@tmke.co.uk`, date, start, endHm, summary: bk.service || "TMKE Booking", description: ["Rescheduled booking.", bk.postcode && `Location: ${bk.postcode}`].filter(Boolean).join("\n"), location: bk.postcode || "", organizer: env.JACK_UPN, attendeeEmail: bk.client_email, attendeeName: bk.client_name });
        const icsB64 = bufToBase64(new TextEncoder().encode(ics).buffer);
        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        await sendEmail(env, {
          to: bk.client_email, subject: `Booking rescheduled — ${dateNice}`,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22"><h1 style="font-size:22px;margin:0 0 6px">Your booking has moved</h1><p style="color:#555;font-size:14px;margin:0 0 18px">Hi ${esc(bk.client_name || "")}, your ${esc(bk.service || "booking")} is now <strong>${esc(dateNice)} at ${esc(start)}</strong>. An updated calendar invite is attached.</p></div>`,
          attachments: [{ filename: "booking.ics", content: icsB64, contentType: "text/calendar" }],
        });
        await sendEmail(env, { to: env.JACK_NOTIFY || env.JACK_UPN, subject: `Rescheduled — ${bk.service || "Booking"} — ${bk.client_name || ""}`, html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1d22"><p>${esc(bk.client_name || "")} moved their ${esc(bk.service || "booking")} to ${esc(dateNice)} at ${esc(start)}.</p></div>` });
        return json({ ok: true }, 200, request, env);
      }

      // Cancellation waitlist (gated). The studio/section is "fully booked", so we
      // capture an approved-domain partner's details + preferred slot and email a
      // confirmation. The allow-list is server-side (NOT client-supplied).
      if (path.endsWith("/waitlist/register") && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const { section, name, email, phone, date, time, service } = b || {};
        const pkg = (b && b.package) || "";
        if (!name || !email || !date || !time) return json({ error: "Missing details" }, 400, request, env);
        const allowed = (env.WAITLIST_DOMAINS || "fineandcountry.com,thepropertyexperts.co.uk")
          .split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
        const mm = String(email).toLowerCase().trim().match(/@([^@\s]+)$/);
        const dom = mm ? mm[1] : "";
        const ok = dom && allowed.some((d) => dom === d || dom.endsWith("." + d));
        if (!ok) return json({ error: "That email isn't on an approved partner domain." }, 403, request, env);
        await sbPost(env, "session_waitlist", {
          section: section || "studio", package: pkg || null,
          name, email, phone: phone || null, email_domain: dom,
          preferred_date: date, preferred_time: time, status: "waiting",
        });
        if (env.RESEND_API_KEY) {
          try {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: env.MAIL_FROM || "TMKE <onboarding@resend.dev>",
                to: email,
                subject: `You're on the cancellation list — ${service || section || "The Studio"}`,
                html: waitlistHtml({ name, service: service || section || "The Studio", pkg, date, time }),
              }),
            });
          } catch (_) { /* email is best-effort */ }
        }
        return json({ ok: true }, 200, request, env);
      }
    } catch (err) {
      return json({ error: String(err && err.message ? err.message : err) }, 500, request, env);
    }

    // Auth. Hot upload path (part/complete/abort) uses a fast local expiry check
    // — it already requires an unguessable uploadId minted by the fully-authed
    // /create. Everything else does full Supabase validation.
    const hot = path.endsWith("/part") || path.endsWith("/complete") || path.endsWith("/abort");
    if (hot) {
      if (!cheapValid(request)) return json({ error: "Unauthorised" }, 401, request, env);
    } else {
      const user = await getUser(request, env);
      if (!user) return json({ error: "Unauthorised" }, 401, request, env);
    }

    try {
      // ---- Send an email via Resend (admin only) ----
      // Powers the admin email-template builder's "Send test", and is the relay
      // for marketing/transactional sends generally. The caller is already a
      // valid Supabase user (gated below); we additionally require a TMKE admin
      // email so a signed-in customer can't drive the mailer. The verified
      // sender domain comes from MAIL_FROM — callers may only set a display name.
      if (path.endsWith("/email/send") && request.method === "POST") {
        const sender = await getUser(request, env);
        if (!isAdminEmail(sender)) return json({ error: "Admins only." }, 403, request, env);
        if (!env.RESEND_API_KEY) return json({ error: "Email isn't configured — set the RESEND_API_KEY secret on the Worker (wrangler secret put RESEND_API_KEY)." }, 503, request, env);
        let body;
        try { body = await request.json(); } catch (_) { return json({ error: "Bad JSON" }, 400, request, env); }
        const toRaw = body && body.to;
        const to = (Array.isArray(toRaw) ? toRaw : [toRaw])
          .map((x) => String(x || "").trim()).filter(Boolean).slice(0, 50);
        const subject = String((body && body.subject) || "").replace(/[\r\n]+/g, " ").slice(0, 300);
        const html = String((body && body.html) || "");
        if (!to.length) return json({ error: "No recipient address." }, 400, request, env);
        if (!html) return json({ error: "Nothing to send." }, 400, request, env);
        let from = env.MAIL_FROM || "TMKE <onboarding@resend.dev>";
        const fromName = body && body.fromName ? String(body.fromName).replace(/[<>\r\n]/g, "").trim().slice(0, 80) : "";
        if (fromName) {
          const m = /<([^>]+)>/.exec(from);
          from = `${fromName} <${m ? m[1] : from}>`;
        }
        const sent = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to, subject, html }),
        });
        const data = await sent.json().catch(() => ({}));
        if (!sent.ok) return json({ error: (data && (data.message || data.error)) || `Send failed (${sent.status}).` }, 502, request, env);
        return json({ ok: true, id: data && data.id }, 200, request, env);
      }

      // ---- Microsoft 365 connection health (admin) ----
      if (path.endsWith("/ms/status") && request.method === "GET") {
        try {
          const u = await graph(env, "GET", `/users/${encodeURIComponent(env.JACK_UPN)}?$select=displayName,mail,userPrincipalName`);
          return json({ connected: true, name: u.displayName, upn: u.userPrincipalName || u.mail }, 200, request, env);
        } catch (e) {
          return json({ connected: false, error: String(e && e.message ? e.message : e) }, 200, request, env);
        }
      }

      // ---- Create a multipart upload ----
      if (path.endsWith("/create") && request.method === "POST") {
        const { bookingId, fileName, contentType } = await request.json();
        const key = safeKey(bookingId, `${Date.now()}-${fileName}`);
        const mp = await env.BUCKET.createMultipartUpload(key, {
          httpMetadata: contentType ? { contentType } : undefined,
        });
        return json({ key, uploadId: mp.uploadId }, 200, request, env);
      }

      // ---- Upload one part (bytes streamed in the request body) ----
      if (path.endsWith("/part") && request.method === "PUT") {
        const key = url.searchParams.get("key");
        const uploadId = url.searchParams.get("uploadId");
        const partNumber = parseInt(url.searchParams.get("partNumber") || "0", 10);
        if (!key || !uploadId || !partNumber)
          return json({ error: "Missing key/uploadId/partNumber" }, 400, request, env);
        const mp = env.BUCKET.resumeMultipartUpload(key, uploadId);
        const body = await request.arrayBuffer();
        const part = await mp.uploadPart(partNumber, body);
        return json({ partNumber, etag: part.etag }, 200, request, env);
      }

      // ---- Complete the multipart upload ----
      if (path.endsWith("/complete") && request.method === "POST") {
        const { key, uploadId, parts } = await request.json();
        if (!key || !uploadId || !Array.isArray(parts))
          return json({ error: "Missing key/uploadId/parts" }, 400, request, env);
        const mp = env.BUCKET.resumeMultipartUpload(key, uploadId);
        const obj = await mp.complete(
          parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag }))
        );
        return json({ ok: true, key, size: obj.size }, 200, request, env);
      }

      // ---- Abort ----
      if (path.endsWith("/abort") && request.method === "POST") {
        const { key, uploadId } = await request.json();
        const mp = env.BUCKET.resumeMultipartUpload(key, uploadId);
        await mp.abort();
        return json({ ok: true }, 200, request, env);
      }

      // ---- List a booking's files ----
      if (path.endsWith("/list") && request.method === "GET") {
        const bookingId = (url.searchParams.get("bookingId") || "").replace(/[^a-zA-Z0-9_-]/g, "");
        const prefix = `${PART_PREFIX}/${bookingId}/`;
        const listed = await env.BUCKET.list({ prefix });
        return json(
          {
            files: listed.objects.map((o) => ({
              key: o.key,
              size: o.size,
              uploaded: o.uploaded,
            })),
          },
          200,
          request,
          env
        );
      }

      // ---- Delete an object ----
      if (path.endsWith("/object") && request.method === "DELETE") {
        const key = url.searchParams.get("key");
        if (!key) return json({ error: "Missing key" }, 400, request, env);
        await env.BUCKET.delete(key);
        return json({ ok: true }, 200, request, env);
      }

      // ---- Download / preview an object ----
      if (path.endsWith("/download") && request.method === "GET") {
        const key = url.searchParams.get("key");
        if (!key) return json({ error: "Missing key" }, 400, request, env);
        const obj = await env.BUCKET.get(key);
        if (!obj) return json({ error: "Not found" }, 404, request, env);
        const headers = new Headers(corsHeaders(request, env));
        obj.writeHttpMetadata(headers);
        headers.set("etag", obj.httpEtag);
        const name = key.split("/").pop();
        headers.set("Content-Disposition", `inline; filename="${name}"`);
        return new Response(obj.body, { headers });
      }

      return json({ error: "Not found" }, 404, request, env);
    } catch (err) {
      return json({ error: String(err && err.message ? err.message : err) }, 500, request, env);
    }
  },
};
