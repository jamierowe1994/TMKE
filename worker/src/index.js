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

// Marketing-automation email rendering reuses the site's pure render lib so
// automation emails look identical to Email Studio previews. (No deps — safe to
// bundle into the Worker.)
import { renderTemplate, mergeContextFor, defaultBrand } from "../../src/lib/email-render.js";
// Invoice PDF: reuse the same pure renderer the admin preview uses, then print
// it to a real A4 PDF with Browser Rendering (headless Chrome).
import { renderInvoiceHtml, money } from "../../src/lib/invoice-render.js";
import puppeteer from "@cloudflare/puppeteer";

const PART_PREFIX = "deliverables";

// Render invoice HTML to an A4 PDF (Uint8Array). The template is already sized
// in millimetres for A4, so Chrome prints it 1:1 with no extra layout work.
async function renderInvoicePdf(env, settings, invoice) {
  const html = renderInvoiceHtml({ settings, invoice });
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({ printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}

// Format an invoice due date the way the covering email says it.
function invoiceDueNice(inv) {
  return inv.due_date ? new Date(inv.due_date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
}
// The default covering-email text (plain, with line breaks). Mirrored on the
// client so the sender can edit it before sending; kept here as the fallback.
// Keys off the invoice's actual due date rather than a fixed "within N days".
function defaultInvoiceEmailText(settings, inv) {
  const company = settings.company_name || "The Marketing Experts (Nationwide) Ltd";
  const due = invoiceDueNice(inv);
  const lines = [
    `Dear ${inv.bill_to_name || "Sir or Madam"},`, "",
    `Please find attached invoice ${inv.number} from ${company}.`, "",
    `Amount due: ${money(inv.total_pence)}`,
  ];
  if (due) lines.push(`Due date: ${due}`);
  lines.push("", `Payment is due${due ? ` by ${due}` : ""} by bank transfer — the account details are on the invoice, and please quote ${inv.number} as the reference. If you have any questions, just reply to this email.`, "", "Kind regards,", company);
  return lines.join("\n");
}
// The invoice covering email: a body (the sender's edited text if provided, else
// the default) followed by the optional footer image. PDF attached separately.
function invoiceEmailHtml(settings, inv, customBodyText) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const br = (s) => esc(s).replace(/\n/g, "<br>");
  const bodyText = (customBodyText != null && String(customBodyText).trim()) ? customBodyText : defaultInvoiceEmailText(settings, inv);
  const footer = settings.email_footer_image_url
    ? `<div style="margin-top:26px"><img src="${esc(settings.email_footer_image_url)}" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0" /></div>`
    : "";
  return `<div style="max-width:600px"><div style="font-family:Arial,Helvetica,sans-serif;color:#2a1b22;font-size:15px;line-height:1.6">${br(bodyText)}</div>${footer}</div>`;
}

// ---- Direct Debit "ghost" invoices --------------------------------------
const DD_DEFAULT_RECIPIENT = "danielle@tmke.co.uk";
// TESTING SWITCH: while true, EVERY invoice email (client send, DD ghost, void)
// is redirected to Danielle only — no real clients, no Paula. Set to false to
// go fully live.
const INVOICE_TEST_MODE = true;
const INVOICE_TEST_RECIPIENT = "danielle@tmke.co.uk";
function invoiceMailTo(to, cc) {
  return INVOICE_TEST_MODE ? { to: INVOICE_TEST_RECIPIENT, cc: null } : { to, cc };
}
// Parse a free-text price like "£750 / month" → pence.
function parsePricePence(s) {
  const m = String(s || "").match(/[\d,]+(\.\d+)?/);
  return m ? Math.round(parseFloat(m[0].replace(/,/g, "")) * 100) : 0;
}
// The accounts reminder body for a DD ghost invoice.
function ddReminderHtml(client, monthLabel, inv) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#2a1b22;font-size:15px;line-height:1.6;max-width:560px">
    <p style="margin:0 0 14px">This is an automated reminder for the books — <strong>no action needed with the client</strong> (they pay by Direct Debit through QuickBooks).</p>
    <table style="border-collapse:collapse;margin:0 0 14px;font-size:15px">
      <tr><td style="padding:2px 18px 2px 0;color:#7a6b70">Client</td><td style="padding:2px 0"><strong>${esc(client)}</strong></td></tr>
      <tr><td style="padding:2px 18px 2px 0;color:#7a6b70">Period</td><td style="padding:2px 0">${esc(monthLabel)}</td></tr>
      <tr><td style="padding:2px 18px 2px 0;color:#7a6b70">Amount</td><td style="padding:2px 0"><strong>${money(inv.total_pence)}</strong></td></tr>
      <tr><td style="padding:2px 18px 2px 0;color:#7a6b70">Invoice</td><td style="padding:2px 0">${esc(inv.number)}</td></tr>
      <tr><td style="padding:2px 18px 2px 0;color:#7a6b70">DD collection</td><td style="padding:2px 0">${esc(inv.due_date || "")}</td></tr>
    </table>
    <p style="margin:0">The full invoice PDF is attached. It'll be marked paid once the Direct Debit is confirmed.</p>
  </div>`;
}
// Raise (or return the existing) DD ghost invoice for a client + month (YYYY-MM).
// Creates the invoice, saves the PDF, emails the ghost recipient. Idempotent.
async function ensureDdInvoice(env, lead, ym) {
  const existing = await sbGet(env, "invoices", `booking_id=eq.${encodeURIComponent(lead.id)}&billing_month=eq.${ym}&payment_method=eq.direct_debit&select=id,number&limit=1`);
  if (existing && existing[0]) return { invoice: existing[0], created: false };

  const amount = parsePricePence(lead.price);
  const [y, mo] = ym.split("-").map(Number);
  const monthLabel = new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const ddDay = Math.min(28, Math.max(1, Number(lead.direct_debit_day) || 1));
  const st = (await sbGet(env, "invoice_settings", "id=eq.1&select=*"))?.[0] || {};
  const vatRate = st.vat_rate != null ? Number(st.vat_rate) : 20;
  const nextNum = st.next_number || 1001;
  const number = `${st.invoice_prefix || "TMKE"}${nextNum}`;
  const subtotal = amount, vat = Math.round(subtotal * vatRate / 100), total = subtotal + vat;
  const billName = lead.business || [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() || lead.full_name || lead.email || "Client";
  const items = [{ description: `Social media management (${monthLabel})`, qty: 1, unit_pence: amount }];
  const row = {
    number, booking_id: lead.id, booking_source: "smm",
    bill_to_name: billName, bill_to_email: lead.email || null, bill_to_address: lead.business_address || null,
    line_items: items, subtotal_pence: subtotal, vat_pence: vat, total_pence: total,
    status: "sent", issued_date: `${ym}-01`, due_date: `${ym}-${String(ddDay).padStart(2, "0")}`,
    payment_method: "direct_debit", billing_month: ym, cc_email: null, created_by: "auto (direct debit)",
  };
  const res = await sbPost(env, "invoices", row, "return=representation");
  let inv = null; try { const j = await res.json(); inv = Array.isArray(j) ? j[0] : j; } catch (_) {}
  if (!inv || !inv.id) return { invoice: null, created: false };
  await fetch(`${env.SUPABASE_URL}/rest/v1/invoice_settings?id=eq.1`, {
    method: "PATCH", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ next_number: nextNum + 1 }),
  });
  const recipient = (lead.dd_invoice_email && lead.dd_invoice_email.trim()) || DD_DEFAULT_RECIPIENT;
  try {
    const pdf = await renderInvoicePdf(env, { ...st, template: inv.template || st.template }, inv);
    await env.BUCKET.put(`invoices/${inv.number || inv.id}.pdf`, pdf, { httpMetadata: { contentType: "application/pdf" } });
    await sendEmail(env, {
      to: invoiceMailTo(recipient, null).to,
      subject: `Direct Debit invoice ${inv.number} — ${billName} (${monthLabel})`,
      html: ddReminderHtml(billName, monthLabel, inv),
      attachments: [{ filename: `Invoice-${inv.number}.pdf`, content: bufToBase64(pdf), contentType: "application/pdf" }],
    });
    await fetch(`${env.SUPABASE_URL}/rest/v1/invoices?id=eq.${inv.id}`, {
      method: "PATCH", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ sent_to: recipient }),
    });
  } catch (_) { /* PDF/email best-effort */ }
  return { invoice: inv, created: true };
}
const ymNow = () => { const d = new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
// On the 1st of the month, raise this month's ghost invoice for every DD client.
async function runDdMonthly(env) {
  if (new Date().getUTCDate() !== 1) return;   // only fires on the 1st
  const ym = ymNow();
  const leads = (await sbGet(env, "smm_leads", "direct_debit=eq.true&select=*&limit=500")) || [];
  for (const lead of leads) { try { await ensureDdInvoice(env, lead, ym); } catch (_) {} }
}

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
    if (!user || !user.id) return null;
    // Resolve admin status ONCE per request so every gated endpoint agrees with
    // the client gate: the staff domain/allowlist, OR a row in the admins table
    // (how team-added admins like non-tmke.co.uk staff are granted access).
    user._isAdmin = emailLooksAdmin(user);
    if (!user._isAdmin) {
      try {
        const rows = await sbGet(env, "admins", `user_id=eq.${encodeURIComponent(user.id)}&select=user_id`);
        user._isAdmin = !!(rows && rows.length);
      } catch (_) {}
    }
    return user;
  } catch (_) {
    return null;
  }
}

// Look up an auth user by EXACT email. NB the admin list endpoint IGNORES an
// `email` query param (it just returns the paginated user list), so the old
// `?email=` lookups matched EVERY address — any random email looked like it
// "had an account", and `list[0].id` was simply the first user in the database.
// `filter` narrows server-side (it's what the Supabase dashboard search uses)
// and the exact-match find guarantees correctness either way.
async function findUserByEmail(env, email) {
  const em = String(email || "").trim().toLowerCase();
  if (!em) return null;
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(em)}&per_page=200`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}` },
    });
    if (!res.ok) return null;
    const d = await res.json();
    const list = (d && d.users) || d;
    if (!Array.isArray(list)) return null;
    return list.find((u) => String(u.email || "").toLowerCase() === em) || null;
  } catch (_) {
    return null;
  }
}

// A strong random temporary password (upper + lower + digit + symbol) for a
// freshly-created admin login. The person is emailed it and asked to change it.
function genTempPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ", lower = "abcdefghijkmnpqrstuvwxyz", digits = "23456789";
  const pool = upper + lower + digits;
  const a = new Uint32Array(9); crypto.getRandomValues(a);
  let s = upper[a[0] % upper.length] + lower[a[1] % lower.length] + digits[a[2] % digits.length];
  for (let i = 3; i < 9; i++) s += pool[a[i] % pool.length];
  return "Tmke-" + s + "!";
}

// ---- Internal-agent (TEG) free-videography codes ------------------------
const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const PACKAGE_PREFIX = { academy: "ACAD", pro: "PRO" };

// Build a personalised free-videography code + create the single-use 100% promo
// row (restricted to the agent service). Format: PACKAGE-INITIALS-MMMYY
// (e.g. PRO-JB-AUG26); a numeric suffix is appended if that already exists so
// codes stay unique. Returns { code, id } or null if the package is ineligible.
async function generateAgentCode(env, { pkg, firstName, lastName, inductionMonth, label }) {
  const prefix = PACKAGE_PREFIX[String(pkg || "").toLowerCase()];
  if (!prefix) return null;
  const initials = ((String(firstName || "")[0] || "") + (String(lastName || "")[0] || "")).toUpperCase().replace(/[^A-Z]/g, "") || "XX";
  let mmmyy = "";
  const m = String(inductionMonth || "").match(/^(\d{4})-(\d{2})$/);
  if (m) mmmyy = MONTH_ABBR[Math.max(0, Math.min(11, parseInt(m[2], 10) - 1))] + m[1].slice(2);
  const base = [prefix, initials, mmmyy].filter(Boolean).join("-");
  let code = base, n = 1;
  for (let i = 0; i < 30; i++) {
    const existing = await sbGet(env, "videography_promo_codes", `code=eq.${encodeURIComponent(code)}&select=id`);
    if (!existing || !existing.length) break;
    n += 1; code = `${base}-${n}`;
  }
  const res = await sbPost(env, "videography_promo_codes", {
    code, label: label || "New-starter free videography", kind: "percent", value: 100,
    services: ["agent"], active: true, max_redemptions: 1, redemptions: 0,
  }, "return=representation");
  let id = null;
  try { const j = await res.json(); const rec = Array.isArray(j) ? j[0] : j; id = (rec && rec.id) || null; } catch (_) {}
  return { code, id };
}

// Create/update a contact's agent_profiles row: generate the free-videography
// code once (if an eligible new starter without one), upsert the profile, and
// enrol them into the videography onboarding funnel. Shared by POST /agent/profile
// (the contact-drawer TEG tab) and the Google-Sheet sync so the two never drift.
// `contact` needs { first_name, last_name, email }. Returns the row + _enrolled.
async function ensureAgentProfile(env, contactId, contact, input) {
  const existingRows = await sbGet(env, "agent_profiles", `contact_id=eq.${encodeURIComponent(contactId)}&select=*`);
  const existing = (existingRows && existingRows[0]) || null;
  const pkg = ["academy", "pro"].includes(String(input.package || "").toLowerCase()) ? String(input.package).toLowerCase() : null;
  const isNewStarter = !!input.is_new_starter;
  const inductionMonth = (typeof input.induction_month === "string" && /^\d{4}-\d{2}$/.test(input.induction_month)) ? input.induction_month : null;

  let promoCode = (existing && existing.promo_code) || null;
  let promoCodeId = (existing && existing.promo_code_id) || null;
  if (isNewStarter && pkg && inductionMonth && !promoCode) {
    const label = `New-starter free videography — ${[contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email}`;
    const gen = await generateAgentCode(env, { pkg, firstName: contact.first_name, lastName: contact.last_name, inductionMonth, label });
    if (gen) { promoCode = gen.code; promoCodeId = gen.id; }
  }

  const coalesce = (a, b) => (a != null && a !== "" ? a : (b != null ? b : null));
  const row = {
    contact_id: contactId,
    brand: coalesce(input.brand, existing && existing.brand),
    date_joined: coalesce(input.date_joined, existing && existing.date_joined),
    postcode: coalesce(input.postcode, existing && existing.postcode),
    is_new_starter: isNewStarter,
    induction_month: inductionMonth,
    package: pkg,
    promo_code: promoCode,
    promo_code_id: promoCodeId,
    trainer_name: coalesce(input.trainer_name, (existing && existing.trainer_name)) || "Kelly Bailey",
    trainer_email: coalesce(input.trainer_email, (existing && existing.trainer_email)) || "kelly@theexpertsgroup.co.uk",
  };
  await fetch(`${env.SUPABASE_URL}/rest/v1/agent_profiles?on_conflict=contact_id`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  // Identifying CRM tag for visibility/filtering (the funnel is trigger-driven,
  // NOT tag-driven). One package tag; the opposite is cleared so it never doubles.
  if (isNewStarter && pkg) {
    const nsTag = pkg === "pro" ? "Videography-New-Starter: Pro" : "Videography-New-Starter: Academy";
    try {
      const crow = await sbGet(env, "contacts", `id=eq.${encodeURIComponent(contactId)}&select=tags`);
      const cur = (crow && crow[0] && crow[0].tags) || [];
      const next = normalizeTags([...cur.filter((t) => !/^Videography-New-Starter:/i.test(t)), nsTag]);
      await sbPatch(env, "contacts", `id=eq.${encodeURIComponent(contactId)}`, { tags: next });
    } catch (_) {}
  }
  const enrol = !!(isNewStarter && pkg && promoCode);
  if (enrol) {
    try { await fireTrigger(env, "new_starter_videography", { email: contact.email, first_name: contact.first_name, last_name: contact.last_name }, { package: pkg, code: promoCode }); } catch (_) {}
  }
  return { ...row, _enrolled: enrol };
}

// ── TEG new-starter Google Sheet → CRM sync ────────────────────────────────
// The TEG-owned sheet is the single entry point: adding a Pro/Academy row auto-
// creates the contact + agent_profile + code and enrols them into the funnel.
// Header row is ROW 2 (row 1 is blank); some headers carry a trailing space.
const AGENT_SHEET_ID = "1_LiFsbrPiaNIuOdvIkn8Teo_D8_8sCDACU5ZHgXazb0";
const AGENT_SHEET_TAB = "New Starters";

// "August 2026" / "Aug-26" / "2026-08" / "12/08/2026" → "2026-08" (or null).
function parseShootMonth(s) {
  s = String(s || "").trim(); if (!s) return null;
  let m = s.match(/^(\d{4})[-/](\d{1,2})/); if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}`;
  const mn = s.match(/([A-Za-z]{3,})[\s\-/]*(\d{2,4})/);
  if (mn) { const mi = MONTHS_FULL.findIndex((x) => x.toLowerCase().startsWith(mn[1].slice(0, 3).toLowerCase())); if (mi >= 0) { let y = mn[2]; if (y.length === 2) y = "20" + y; return `${y}-${String(mi + 1).padStart(2, "0")}`; } }
  const d = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/); if (d) { let y = d[3]; if (y.length === 2) y = "20" + y; return `${y}-${String(d[2]).padStart(2, "0")}`; }
  return null;
}
// "2026-08-12" / "12/08/2026" (UK DD/MM/YYYY) → "2026-08-12" (or null).
function parseISODate(s) {
  s = String(s || "").trim(); if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/); if (m) { let y = m[3]; if (y.length === 2) y = "20" + y; return `${y}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`; }
  return null;
}

// Induction cancelled (sheet "Cancelled" = yes): void the single-use code so it
// can't be booked/redeemed, mark do-not-contact, log a note, and pull them out of
// the funnel. Idempotent (skips if already cancelled). Returns true if it acted.
async function cancelAgentStarter(env, contactId) {
  const rows = await sbGet(env, "agent_profiles", `contact_id=eq.${encodeURIComponent(contactId)}&select=status,promo_code,promo_code_id`);
  const p = rows && rows[0];
  if (p && p.status === "cancelled") return false; // already handled
  if (p && (p.promo_code_id || p.promo_code)) {
    const filter = p.promo_code_id ? `id=eq.${encodeURIComponent(p.promo_code_id)}` : `code=ilike.${encodeURIComponent(p.promo_code)}`;
    try { await sbPatch(env, "videography_promo_codes", filter, { active: false }); } catch (_) {}
  }
  try { await sbPatch(env, "contacts", `id=eq.${encodeURIComponent(contactId)}`, { dnd: true }); } catch (_) {}
  try { await sbPost(env, "contact_notes", { contact_id: contactId, body: "Induction cancelled (TEG sheet) — free-videography code voided and marked do-not-contact.", author: "Sheet sync" }); } catch (_) {}
  try {
    const funnels = await sbGet(env, "automations", `trigger_type=eq.new_starter_videography&select=id`);
    const fids = (funnels || []).map((a) => a.id);
    if (fids.length) await sbPatch(env, "automation_enrollments", `contact_id=eq.${encodeURIComponent(contactId)}&status=eq.active&automation_id=in.(${fids.join(",")})`, { status: "stopped" });
  } catch (_) {}
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/agent_profiles?on_conflict=contact_id`, {
      method: "POST", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ contact_id: contactId, status: "cancelled" }),
    });
  } catch (_) {}
  return true;
}

// Write the booked shoot date/time back to the TEG sheet's "Shoot Booked" column
// for the row matching this email. Best-effort — needs the sheet shared with EDIT
// access to the service account.
async function agentSheetWriteBooked(env, email, whenText) {
  if (!env.GOOGLE_SHEETS_SA_JSON) return;
  const rows = await googleSheetRows(env, AGENT_SHEET_ID, `${AGENT_SHEET_TAB}!A2:Z`);
  if (!rows || !rows.length) return;
  const headers = (rows[0] || []).map((h) => String(h || "").trim().toLowerCase());
  const emailCol = headers.indexOf("email");
  const bookedCol = headers.indexOf("shoot booked");
  if (emailCol < 0 || bookedCol < 0) return;
  const want = String(email || "").toLowerCase();
  for (let i = 1; i < rows.length; i++) {
    const val = (rows[i] && rows[i][emailCol]) ? String(rows[i][emailCol]).trim().toLowerCase() : "";
    if (val === want) {
      await googleSheetUpdate(env, AGENT_SHEET_ID, `${AGENT_SHEET_TAB}!${colLetter(bookedCol)}${2 + i}`, [[whenText]]);
      return;
    }
  }
}

async function syncAgentSheet(env) {
  if (!env.GOOGLE_SHEETS_SA_JSON || !env.SUPABASE_SERVICE_ROLE) return { ok: false, error: "Sheet sync not configured." };
  let rows;
  try { rows = await googleSheetRows(env, AGENT_SHEET_ID, `${AGENT_SHEET_TAB}!A2:Z`); }
  catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  if (!rows || !rows.length) return { ok: true, rows: 0, processed: 0, enrolled: 0, cancelled: 0, skipped: 0 };
  const headers = (rows[0] || []).map((h) => String(h || "").trim().toLowerCase());
  const col = (name) => headers.indexOf(name.toLowerCase());
  const idx = { name: col("Agent Name"), brand: col("Brand"), phone: col("Phone Number"), email: col("Email"), postcode: col("Post Code"), package: col("Package"), induction: col("Induction Date"), month: col("Preferred Shoot Month"), cancelled: col("Cancelled") };
  let processed = 0, enrolled = 0, cancelled = 0, skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const cell = (c) => (c >= 0 ? String(r[c] || "").trim() : "");
    const email = cell(idx.email).toLowerCase();
    const pkg = cell(idx.package).toLowerCase();
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email) || !["pro", "academy"].includes(pkg)) { skipped++; continue; }
    const parts = cell(idx.name).split(/\s+/).filter(Boolean);
    const first = parts.shift() || null, last = parts.join(" ") || null;
    const brand = cell(idx.brand) || null;
    const isCancelled = /^(y|yes|true|1|cancelled)$/i.test(cell(idx.cancelled));
    try {
      const cid = await sbRpc(env, "upsert_contact", { p_email: email, p_first_name: first, p_last_name: last, p_phone: cell(idx.phone) || null, p_company: brand, p_source: "agent_sheet_sync", p_tags: crmTags(email, [], {}) });
      const contactId = Array.isArray(cid) ? cid[0] : cid;
      if (!contactId) { skipped++; continue; }
      if (isCancelled) {
        const acted = await cancelAgentStarter(env, contactId);
        if (acted) cancelled++; else skipped++;
        continue;
      }
      const res = await ensureAgentProfile(env, contactId, { first_name: first, last_name: last, email }, {
        brand, date_joined: parseISODate(cell(idx.induction)), postcode: cell(idx.postcode) || null,
        is_new_starter: true, induction_month: parseShootMonth(cell(idx.month)), package: pkg,
      });
      processed++; if (res._enrolled) enrolled++;
    } catch (_) { skipped++; }
  }
  return { ok: true, rows: rows.length - 1, processed, enrolled, cancelled, skipped };
}

// Admin gate for staff-only endpoints (e.g. sending email). Mirrors the client
// allowlist in src/lib/admin-gate.js: a TMKE-domain email, or the named extra.
const ADMIN_EMAIL_DOMAINS = ["tmke.co.uk"];
const ADMIN_EMAILS = ["james@therecruitmentexperts.co.uk"];
// Owners can additionally manage the Brand kit + who has admin access. Everyone
// else with admin access can fully operate the site but not those two things.
const OWNER_EMAILS = ["james@therecruitmentexperts.co.uk", "danielle@tmke.co.uk"];
// Fast, offline check: the staff domain or the explicit allowlist.
function emailLooksAdmin(user) {
  const e = String((user && user.email) || "").toLowerCase().trim();
  if (!e) return false;
  if (ADMIN_EMAILS.includes(e)) return true;
  return ADMIN_EMAIL_DOMAINS.includes(e.split("@")[1] || "");
}
// Any admin: the allowlist OR a row in the admins table (getUser resolves the
// table lookup and stamps user._isAdmin). Falls back to the email check if the
// user object didn't come through getUser.
function isAdminEmail(user) {
  if (user && user._isAdmin !== undefined) return user._isAdmin;
  return emailLooksAdmin(user);
}
function isOwner(user) {
  const e = String((user && user.email) || "").toLowerCase().trim();
  return !!e && OWNER_EMAILS.includes(e);
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

// Debounce site rebuilds so rapid publishes/saves don't queue many deploys.
let _lastDeployAt = 0;

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

// ---- Google Sheets (service account, read-only) -------------------------
// Signs a JWT with the service-account private key (RS256) and exchanges it
// for an access token. Used to poll the TEG new-starter sheet.
const _b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const _b64urlStr = (str) => btoa(str).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
let _gsToken = null; // { token, exp } cached per isolate
async function googleAccessToken(env, scope) {
  if (_gsToken && _gsToken.exp > Date.now() + 60000 && _gsToken.scope === scope) return _gsToken.token;
  const sa = JSON.parse(env.GOOGLE_SHEETS_SA_JSON);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${_b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${_b64urlStr(JSON.stringify({ iss: sa.client_email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }))}`;
  const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${_b64url(sig)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Google token: " + (j.error_description || j.error || res.status));
  _gsToken = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000, scope };
  return j.access_token;
}
async function googleSheetMeta(env, sheetId) {
  const token = await googleAccessToken(env, "https://www.googleapis.com/auth/spreadsheets.readonly");
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title,sheets.properties.title`, { headers: { Authorization: "Bearer " + token } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Sheets meta: " + (j.error && j.error.message ? j.error.message : res.status));
  return j;
}
async function googleSheetRows(env, sheetId, range) {
  const token = await googleAccessToken(env, "https://www.googleapis.com/auth/spreadsheets.readonly");
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`, { headers: { Authorization: "Bearer " + token } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Sheets read: " + (j.error && j.error.message ? j.error.message : res.status));
  return j.values || [];
}
// Write values back into a sheet (needs the sheet shared with EDIT access to the
// service account + the read/write scope). Used for the shoot-booked write-back.
async function googleSheetUpdate(env, sheetId, range, values) {
  const token = await googleAccessToken(env, "https://www.googleapis.com/auth/spreadsheets");
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Sheets write: " + (j.error && j.error.message ? j.error.message : res.status));
  return j;
}
// 0-based column index → A1 letter (0→A … 25→Z, 26→AA …).
function colLetter(n) {
  let s = ""; n = Math.max(0, n | 0);
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

// Insert a row into Supabase with the service role.
async function sbPost(env, table, row, prefer) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: prefer || "return=minimal",
    },
    body: JSON.stringify(row),
  });
}

// Call a Postgres function (RPC) with the service role; returns the JSON result.
async function sbRpc(env, fn, args) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args || {}),
  });
  if (!res.ok) return null;
  try { return await res.json(); } catch (_) { return null; }
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

// ---- Booking correspondence + documents ---------------------------------
// Log a piece of correspondence against a booking (service role). Automated
// confirmations call this alongside the email; admin calls it for manual notes.
// Fail-soft: a booking must never break because the message log write failed
// (e.g. the booking_messages table hasn't been created yet).
async function logBookingMessage(env, m) {
  if (!m || !m.booking_id) return;
  try {
    await sbPost(env, "booking_messages", {
      booking_id: m.booking_id,
      booking_source: m.booking_source || "videography",
      account_user_id: m.account_user_id || null,
      client_email: m.client_email || null,
      direction: m.direction || "outbound",
      channel: m.channel || "email",
      kind: m.kind || null,
      subject: m.subject || null,
      body: m.body || null,
      is_automated: m.is_automated !== false,
      created_by: m.created_by || "system",
      external_id: m.external_id || null,
    });
  } catch (_) {}
}

// Create or merge an SMM lead by email — so repeat actions from the same person
// (brochure, enquiry, discovery call…) land on ONE card showing the most recent
// action, instead of spawning a duplicate each time. Returns { id, existed }.
async function upsertSmmLead(env, email, fields) {
  const existing = email ? (await sbGet(env, "smm_leads", `email=ilike.${encodeURIComponent(String(email))}&select=*&order=created_at.desc&limit=1`))?.[0] : null;
  if (existing) {
    const patch = {};
    // Only refresh the "most recent action" type if they haven't progressed in
    // the pipeline yet — never downgrade a client back to "brochure".
    const early = !existing.pipeline_stage || existing.pipeline_stage === "inquiry";
    if (early) { for (const k of ["kind", "tag", "stage"]) if (fields[k] != null) patch[k] = fields[k]; }
    // Fill in any contact details we didn't already have (don't clobber).
    for (const k of ["first_name", "last_name", "full_name", "phone", "business", "message", "account_user_id"]) {
      if (fields[k] != null && fields[k] !== "" && !existing[k]) patch[k] = fields[k];
    }
    // Booking-specific fields always reflect the latest action (e.g. a new call).
    for (const k of ["call_at", "duration_min", "reschedule_token", "ms_event_id"]) {
      if (fields[k] != null) patch[k] = fields[k];
    }
    if (fields.marketing_opt_in) patch.marketing_opt_in = true;
    if (fields.brochure_sent) patch.brochure_sent = true;
    if (fields.account_created && !existing.account_created) patch.account_created = true;
    if (Object.keys(patch).length) {
      try {
        await fetch(`${env.SUPABASE_URL}/rest/v1/smm_leads?id=eq.${encodeURIComponent(existing.id)}`, {
          method: "PATCH", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        });
      } catch (_) {}
    }
    return { id: existing.id, existed: true };
  }
  const saved = await sbPost(env, "smm_leads", fields, "return=representation");
  if (!saved.ok) return { id: null, existed: false, error: await saved.text().catch(() => "") };
  let id = null; try { const a = await saved.json(); id = Array.isArray(a) && a[0] ? a[0].id : null; } catch (_) {}
  return { id, existed: false };
}

// Resolve a booking's owner (email + account) + a label across the two source
// tables, so a message/document can be attributed to the right member.
async function lookupBooking(env, source, id) {
  if (!id) return null;
  if (source === "smm") {
    const r = await sbGet(env, "smm_leads", `id=eq.${encodeURIComponent(id)}&select=id,email,account_user_id,full_name`);
    const b = r && r[0];
    return b ? { id: b.id, email: b.email, account_user_id: b.account_user_id, name: b.full_name, service: "Social media discovery call" } : null;
  }
  const r = await sbGet(env, "videography_bookings", `id=eq.${encodeURIComponent(id)}&select=id,client_email,account_user_id,client_name,service`);
  const b = r && r[0];
  return b ? { id: b.id, email: b.client_email, account_user_id: b.account_user_id, name: b.client_name, service: b.service } : null;
}

// All of a member's booking ids across the two source tables — by linked
// account OR by the email on the booking (case-insensitive). Lets the member
// portal read its whole correspondence through the service role, so a message
// is never lost to an RLS/email-casing mismatch.
async function memberBookingIds(env, user) {
  const email = String((user && user.email) || "").toLowerCase();
  const out = [];
  const vid = (await sbGet(env, "videography_bookings", `or=(account_user_id.eq.${user.id},client_email.ilike.${encodeURIComponent(email)})&select=id`)) || [];
  const smm = (await sbGet(env, "smm_leads", `or=(account_user_id.eq.${user.id},email.ilike.${encodeURIComponent(email)})&select=id`)) || [];
  for (const r of vid) out.push(r.id);
  for (const r of smm) out.push(r.id);
  return out;
}

// ---- CRM tag helpers ----------------------------------------------------
// Network from the email domain: *experts.co.uk → TEG, fineandcountry.com →
// Fine-and-Country, everything else → External.
function networkTag(email) {
  const dom = (String(email || "").toLowerCase().match(/@([^@\s]+)$/) || [])[1] || "";
  if (!dom) return null;
  if (dom.endsWith("experts.co.uk")) return "Network: TEG";
  if (dom === "fineandcountry.com") return "Network: Fine-and-Country";
  return "Network: External";
}
function videographyProductTag(serviceType) {
  const map = { content: "Content-Studio", "content-studio": "Content-Studio", property: "Property-Videography", agent: "Agent-Videography" };
  const p = map[serviceType]; return p ? `Videography-Product: ${p}` : null;
}
// Compose the standard CRM tags: service tag(s) + consent + membership + network.
// optIn: true → Newsletter-Subscriber; false → Marketing-Not-Opted-In;
// undefined → neither (flows with no opt-in choice, e.g. a purchase).
function crmTags(email, service, { optIn, member } = {}) {
  const t = (Array.isArray(service) ? service.slice() : service ? [service] : []).filter(Boolean);
  if (optIn === true) t.push("Newsletter-Subscriber");
  else if (optIn === false) t.push("Marketing-Not-Opted-In");
  if (member) t.push("TMKE-Account-Member");
  const n = networkTag(email); if (n) t.push(n);
  return t;
}

// Reconcile a contact's tags to the rules (mirrors normalize_contact_tags in
// SQL — keep the two in sync). Consent is one state; SMM-Status is one value;
// becoming a client supersedes that service's Interest / Discovery-call tags.
function normalizeTags(tags) {
  let t = Array.from(new Set((tags || []).map((x) => String(x || "").trim()).filter(Boolean)));
  const has = (x) => t.includes(x);
  const dropAll = (...xs) => { t = t.filter((v) => !xs.includes(v)); };

  if (has("Unsubscribed")) dropAll("Newsletter-Subscriber", "Marketing-Not-Opted-In");
  else if (has("Newsletter-Subscriber")) dropAll("Marketing-Not-Opted-In");

  if (t.filter((v) => v.startsWith("SMM-Status:")).length > 1) {
    const keep = has("SMM-Status: Active") ? "SMM-Status: Active"
      : has("SMM-Status: Paused") ? "SMM-Status: Paused" : "SMM-Status: Ended";
    t = t.filter((v) => !v.startsWith("SMM-Status:")).concat(keep);
  }

  if (t.some((v) => v.startsWith("SMM-Status:"))) dropAll("Interest: SMM", "Discovery-Call-Booked: SMM");
  if (has("Videography-Client")) dropAll("Interest: Videography", "Discovery-Call-Booked: Videography");

  return t;
}

// Upsert a CRM contact from a paid order, so pack purchasers become contacts.
// No marketing_opt_in (buying ≠ consent). Tags: Pack-Purchased + Pack Name.
async function contactFromOrder(env, order) {
  if (!order || !order.buyer_email) return;
  const parts = String(order.buyer_name || "").trim().split(/\s+/);
  const packTags = ["Pack-Purchased", order.pack_title ? `Pack Name: ${order.pack_title}` : null];
  try {
    await sbRpc(env, "upsert_contact", {
      p_email: order.buyer_email,
      p_first_name: parts.shift() || order.buyer_name || null,
      p_last_name: parts.join(" ") || null,
      p_phone: order.buyer_phone || null,
      p_company: order.buyer_company || null,
      p_source: "pack_purchase",
      p_lifecycle: "customer",
      p_tags: crmTags(order.buyer_email, packTags, { member: !!order.user_id }),
      p_user_id: order.user_id || null,
    });
  } catch (_) {}
}

// ---- Stripe (hosted Checkout) -------------------------------------------
// Call the Stripe REST API with form-encoded params. `params` is a flat object
// whose keys are already bracketed (e.g. "line_items[0][quantity]"). The secret
// key lives only here as a Worker secret — never in the browser or the repo.
async function stripeApi(env, path, params) {
  const body = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null) body.append(k, String(v)); });
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data && data.error && data.error.message) || ("Stripe " + res.status));
  return data;
}

// Verify a Stripe webhook signature ("t=…,v1=…") against the raw request body,
// using the endpoint's signing secret. Returns true only on an exact HMAC match
// within a 5-minute tolerance (replay guard).
async function stripeVerify(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = {};
  sigHeader.split(",").forEach((p) => { const [k, v] = p.split("="); if (k) parts[k.trim()] = (v || "").trim(); });
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // 5-min replay window
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${rawBody}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
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
  const asset = item && item.asset_url ? esc(item.asset_url) : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22">
    <h1 style="font-size:22px;margin:0 0 6px">Your post is ready to go out</h1>
    <p style="color:#555;font-size:14px;margin:0 0 20px">Here's your planned <strong>${esc(platform)}</strong> post${item.title ? ` &mdash; &ldquo;${esc(item.title)}&rdquo;` : ""}. The image is attached, and there's a download button below &mdash; copy your caption and you're set.</p>
    ${cap ? `<div style="background:#f2efe9;border-left:3px solid #371e28;border-radius:4px;padding:14px 16px;font-size:14px;line-height:1.6;white-space:pre-wrap">${cap}</div>` : `<p style="color:#888;font-size:13px">No caption saved for this post.</p>`}
    ${asset ? `<p style="margin:20px 0 0"><a href="${asset}" style="display:inline-block;background:#371e28;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 22px;border-radius:6px">Download the image &darr;</a></p><p style="font-size:12px;color:#999;margin:8px 0 0">Tip: open this on your phone and tap Download to save it to your camera roll.</p>` : `<p style="font-size:13px;color:#555;margin:18px 0 0">&#128206; Your post image is attached to this email.</p>`}
    <p style="font-size:12px;color:#999;margin:24px 0 0">Sent by TMKE &middot; <a href="https://tmke.co.uk/account/schedule" style="color:#371e28">View your calendar</a></p>
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
// Branded, per-service booking confirmation. The booking's service_type (or the
// display name, as a fallback) picks the heading, which detail rows show, and
// the "before your shoot/session/call" prep block. Email-safe (tables + inline
// styles + web-safe fonts so it renders in Outlook/Gmail/Apple Mail).
function bookingConfirmHtml({ name, service, serviceType, packageLabel, dateNice, time, addOns, postcode, surchargePence, totalPence, manageUrl }) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const st = String(serviceType || "").toLowerCase();
  const svc = String(service || "").toLowerCase();
  const kind = (st.includes("content") || svc.includes("studio")) ? "studio"
    : (st.includes("property") || svc.includes("property")) ? "property"
    : (st.includes("agent") || svc.includes("agent") || svc.includes("location")) ? "agent"
    : (st.includes("discovery") || svc.includes("call") || svc.includes("discovery")) ? "call"
    : "generic";
  const isCall = kind === "call";

  const heading = ({ studio: "Your Content Studio session is booked.", property: "Your property shoot is booked.", agent: "Your shoot is booked.", call: "Your call with Jack is booked.", generic: "Your booking is confirmed." })[kind];
  const eyebrow = isCall ? "You're booked in" : "Booking confirmed";
  const intro = isCall
    ? `Hi ${esc(name || "there")}, looking forward to chatting. Here's when &mdash; we've attached a calendar invite so it's in your diary.`
    : `Hi ${esc(name || "there")}, you're all set &mdash; here are the details. We've attached a calendar invite so you can drop it straight into your diary.`;
  const cta = isCall ? "Reschedule the call" : "Manage your booking";

  const rowsArr = isCall
    ? [["Call with", "Jack &middot; TMKE"], service ? ["About", esc(service)] : null, ["Date", esc(dateNice)], ["Time", esc(time)]]
    : [
        ["Service", esc(service)],
        packageLabel ? [(svc.includes("agent") ? "Packages" : "Package"), esc(packageLabel)] : null,
        addOns && addOns.length ? ["Add-ons", esc(addOns.map((a) => a.name).join(", "))] : null,
        postcode ? ["Location", esc(postcode)] : null,
        ["Date", esc(dateNice)],
        ["Time", esc(time)],
        surchargePence ? ["Travel", gbpW(surchargePence) + " + VAT"] : null,
      ];
  const rowsHtml = rowsArr.filter(Boolean).map(([k, v]) => `<tr><td style="padding:5px 0;color:#8a8690;width:36%;">${k}</td><td style="padding:5px 0;font-weight:bold;color:#1c1d22;">${v}</td></tr>`).join("");
  const totalHtml = (!isCall && totalPence != null)
    ? `<tr><td style="padding:13px 0 0;color:#8a8690;border-top:1px solid #e7e3dc;">Total</td><td style="padding:13px 0 0;border-top:1px solid #e7e3dc;font-weight:bold;font-size:17px;color:#1c1d22;">${gbpW(totalPence)} <span style="font-weight:normal;color:#8a8690;font-size:12px;">inc. VAT</span></td></tr>`
    : "";

  const prepByKind = {
    studio: [["Your prompt pack is coming.", "About 3 days before, we'll email a set of tailored conversational prompts so you make the most of your time in the studio."], ["Bring your bits.", "Any outfits, props or scripts you'd like to use on the day."], ["Arrive on time.", "Sessions start and end at the scheduled time, so getting there promptly keeps the full session yours."]],
    property: [["Access &amp; permissions.", "Please make sure we have safe, timely access to the property at the agreed time, and consent of anyone who may appear on camera."], ["Drone is weather-dependent.", "Jack holds a valid CAA licence; capturing drone footage on the day is subject to weather and local airspace. If it's not possible, we'll talk through the options."], ["Twilight add-ons.", "Faux-twilight images are confirmed and quoted after the shoot, once we know how many you'd like."]],
    agent: [["Be ready at the location.", "Please be ready and available at the agreed location and time."], ["Permissions &amp; consent.", "Make sure you have permission to film at the location and the consent of anyone who may appear on camera."]],
    call: [["No pressure, no pitch.", "It's a relaxed chat to understand what you're after and which service would suit you best."], ["Jack will call you", "at the time above on the number you gave us. If anything changes, you can rearrange any time."]],
    generic: [],
  };
  const prep = prepByKind[kind] || [];
  const prepTitle = isCall ? "What to expect" : ("Before your " + (kind === "studio" ? "session" : "shoot"));
  const prepHtml = prep.length
    ? `<div style="padding:28px 32px 0;"><div style="font-size:11px;font-weight:bold;letter-spacing:0.18em;color:#371e28;text-transform:uppercase;margin-bottom:13px;">${prepTitle}</div>${prep.map(([h, t], i) => `<div style="font-size:14px;line-height:1.55;color:#55565b;${i < prep.length - 1 ? "margin-bottom:11px;" : ""}"><strong style="color:#1c1d22;">${h}</strong> ${t}</div>`).join("")}</div>`
    : "";

  const policy = isCall
    ? "Can't make it? You can rearrange any time from your account."
    : (kind === "property" || kind === "agent")
    ? "Travel is included in your total, calculated from the postcode above; if the location changes we'll re-quote before the shoot. Reschedule with 2 days' notice or cancel with 3 days' notice from your account."
    : "Need to change something? Reschedule with 2 days' notice or cancel with 3 days' notice from your account. Cancellations inside 72 hours are chargeable in full.";

  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f1efec;margin:0;padding:24px 0;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <div style="background:#371e28;padding:20px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-family:Georgia,'Times New Roman',serif;font-size:21px;letter-spacing:0.05em;color:#ffffff;">TMKE</td>
          <td align="right" style="font-size:11px;letter-spacing:0.22em;color:rgba(255,255,255,0.62);">VIDEOGRAPHY</td>
        </tr></table>
      </div>
      <div style="padding:34px 32px 0;">
        <div style="font-size:11px;font-weight:bold;letter-spacing:0.2em;color:#b9826a;text-transform:uppercase;margin-bottom:12px;">${eyebrow}</div>
        <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:29px;line-height:1.18;color:#1c1d22;">${heading}</h1>
      </div>
      <div style="padding:16px 32px 0;font-size:15px;line-height:1.6;color:#55565b;">${intro}</div>
      <div style="padding:22px 32px 0;"><div style="background:#f6f4f1;border-radius:10px;padding:18px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">${rowsHtml}${totalHtml}</table></div></div>
      ${manageUrl ? `<div style="padding:24px 32px 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#371e28;border-radius:8px;"><a href="${esc(manageUrl)}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">${cta} &rarr;</a></td></tr></table></div>` : ""}
      ${prepHtml}
      <div style="padding:22px 32px 0;font-size:12.5px;line-height:1.6;color:#8a8690;">${policy}</div>
      <div style="margin-top:28px;padding:24px 32px;border-top:1px solid #ece9e4;">
        <div style="font-family:Georgia,serif;font-size:16px;color:#371e28;">TMKE</div>
        <div style="margin-top:6px;font-size:12px;line-height:1.6;color:#9a9aa0;">Questions? Just reply to this email or contact <a href="mailto:hello@tmke.co.uk" style="color:#371e28;text-decoration:none;">hello@tmke.co.uk</a>.<br><a href="https://tmke.co.uk/videography" style="color:#9a9aa0;">tmke.co.uk</a></div>
      </div>
    </div>
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
// Transactional email via Microsoft 365 (Graph `sendMail`), sent from the TMKE
// mailbox — so it genuinely comes from info@tmke.co.uk, replies land in the
// real inbox, and a copy sits in Sent Items. Reuses the same app-only token as
// the calendar integration (needs the `Mail.Send` application permission).
// Best-effort: never throws — the caller's record is already saved.
async function sendEmail(env, { to, cc, subject, html, attachments, from, fromName }) {
  if (!to) return { ok: false, error: "No recipient." };
  const sender = from || env.MAIL_SENDER || env.JACK_UPN;
  if (!sender) return { ok: false, error: "No sender mailbox configured." };
  // Split comma/semicolon-separated strings so a single field can hold several
  // addresses (e.g. the accounts-dept CC "a@x.com, b@y.com").
  const toAddr = (list) => (Array.isArray(list) ? list : [list])
    .flatMap((a) => String(a || "").split(/[;,]/))
    .map((a) => a.trim())
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address } }));
  const recipients = toAddr(to);
  if (!recipients.length) return { ok: false, error: "No valid recipient address." };
  const message = {
    subject,
    body: { contentType: "HTML", content: html },
    toRecipients: recipients,
  };
  const ccList = cc ? toAddr(cc) : [];
  if (ccList.length) message.ccRecipients = ccList;
  const dispName = fromName || env.MAIL_FROM_NAME;
  if (dispName) message.from = { emailAddress: { address: sender, name: dispName } };
  if (attachments && attachments.length) {
    message.attachments = attachments.map((a) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: a.filename || a.name || "attachment",
      contentType: a.contentType || "application/octet-stream",
      contentBytes: a.content || a.contentBytes,
    }));
  }
  try {
    await graph(env, "POST", `/users/${encodeURIComponent(sender)}/sendMail`, { message, saveToSentItems: true });
    return { ok: true };
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.error("sendEmail (Graph) failed:", msg);
    return { ok: false, error: msg };
  }
}

// Cloudflare Turnstile verification (SMM form spam protection). Returns true when
// no secret is configured, so forms keep working before keys are set — the
// honeypot still guards. With a secret set, a missing/invalid token fails.
async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: String(token) });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
    });
    const d = await res.json().catch(() => ({}));
    return !!(d && d.success);
  } catch (_) { return false; }
}

// SMM password policy — min 8 incl. a number and a special character. Mirrors
// PASSWORD_RULE in src/lib/smm-config.js (keep the two in sync).
const smmPasswordOk = (pw) => /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(String(pw || ""));
// Email a planned post (caption + image attached + a download link) — used by
// both the daily reminder and the "email it to me now" button.
async function sendPostEmail(env, { email, item, subject }) {
  if (!env.RESEND_API_KEY || !email) return false;
  const platform = item.platform_hint || "instagram";
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
  try {
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.MAIL_FROM || "TMKE <onboarding@resend.dev>",
        to: email,
        subject: subject || `Your ${platform} post`,
        html: reminderHtml(item, platform, item.caption || ""),
        attachments: attachments.length ? attachments : undefined,
      }),
    });
    return sent.ok;
  } catch (_) { return false; }
}

async function runReminders(env) {
  if (!env.RESEND_API_KEY || !env.SUPABASE_SERVICE_ROLE) return;
  // Fired by both the 07:00 and 08:00 UTC crons; only actually send at 8am UK,
  // so it stays 8am across BST/GMT.
  const ukHour = parseInt(new Date().toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }), 10);
  if (ukHour !== 8) return;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }); // YYYY-MM-DD
  const due = (await sbGet(env, "calendar_items",
    `status=eq.scheduled&scheduled_date=eq.${today}&select=*`)) || [];
  for (const item of due) {
    try {
      if (item.reminder === false) continue; // they opted out of the reminder
      const email = await sbAdminUserEmail(env, item.user_id);
      if (!email) continue;
      const platform = item.platform_hint || "instagram";
      const ok = await sendPostEmail(env, { email, item, subject: `Your ${platform} post is planned for today` });
      if (ok) {
        await sbPatch(env, "calendar_items", `id=eq.${item.id}`,
          { status: "reminder_sent", reminder_sent_at: new Date().toISOString() });
      }
    } catch (_) { /* skip this item, keep going */ }
  }
}

// ============================================================================
// Marketing-automations engine (Phase 1)
//   fireTrigger()        — upsert the contact + enrol it into matching active
//                          automations when an event happens.
//   runAutomationsTick() — advance every enrolment whose next step is due
//                          (runs on the frequent cron).
// ============================================================================
const AUTO_NODE_CAP = 40; // max steps advanced per enrolment per tick (loop guard)
const nowISO = () => new Date().toISOString();
function autoEdgeTo(graph, from, branch) {
  const e = ((graph && graph.edges) || []).find((x) => x.from === from && (x.branch || "next") === (branch || "next"));
  return e ? e.to : null;
}
function autoWaitMs(cfg) {
  const amt = Math.max(0, Number(cfg.amount) || 0);
  const unit = cfg.unit || "days";
  const mult = unit === "minutes" ? 60e3 : unit === "hours" ? 3600e3 : unit === "weeks" ? 7 * 864e5 : 864e5;
  return amt * mult;
}

async function fireTrigger(env, triggerType, contactInput, payload) {
  if (!triggerType || !contactInput || !contactInput.email || !env.SUPABASE_SERVICE_ROLE) return { ok: false };
  const cid = await sbRpc(env, "upsert_contact", {
    p_email: contactInput.email,
    p_first_name: contactInput.first_name || null,
    p_last_name: contactInput.last_name || null,
    p_phone: contactInput.phone || null,
    p_company: contactInput.company || null,
    p_source: contactInput.source || triggerType,
    p_lifecycle: contactInput.lifecycle || null,
    p_marketing_opt_in: typeof contactInput.marketing_opt_in === "boolean" ? contactInput.marketing_opt_in : null,
    p_tags: contactInput.tags || null,
    p_user_id: contactInput.user_id || null,
  });
  const contactId = Array.isArray(cid) ? cid[0] : cid;   // scalar uuid from the RPC
  if (!contactId) return { ok: false };

  const autos = (await sbGet(env, "automations", `status=eq.active&trigger_type=eq.${encodeURIComponent(triggerType)}&select=id,graph,trigger_config`)) || [];
  let enrolled = 0;
  for (const a of autos) {
    const tc = a.trigger_config || {};
    if (tc.tag && payload && payload.tag && tc.tag !== payload.tag) continue; // simple filter
    const firstId = autoEdgeTo(a.graph, "trigger", "next");
    if (!firstId) continue;
    // The partial unique index blocks a second live enrolment; a 409 here just
    // means "already enrolled" — we ignore it.
    const res = await sbPost(env, "automation_enrollments", {
      automation_id: a.id, contact_id: contactId, status: "active",
      current_node_id: firstId, next_run_at: nowISO(), context: payload || {},
    });
    if (res && res.ok) enrolled++;
  }
  return { ok: true, contact_id: contactId, enrolled };
}

async function autoEvalCondition(env, cfg, contact) {
  const op = cfg.op || "is";
  const v = String(cfg.value ?? "").trim().toLowerCase();
  const flip = (b) => (op === "is_not" ? !b : b);

  // Tag match — one OR many tags. "is" = has ANY of them; "is_not" = has none.
  if (cfg.field === "tag" || cfg.field === "has_tag") {
    const want = (Array.isArray(cfg.values) && cfg.values.length ? cfg.values : (cfg.value ? [cfg.value] : []))
      .map((x) => String(x).trim().toLowerCase()).filter(Boolean);
    const have = (contact.tags || []).map((t) => String(t).toLowerCase());
    return flip(want.some((w) => have.includes(w)));
  }
  if (cfg.field === "has_purchased") {
    const rows = await sbGet(env, "orders", `buyer_email=eq.${encodeURIComponent(contact.email)}&status=eq.paid&select=id&limit=1`);
    return flip(!!(rows && rows.length));
  }
  if (cfg.field === "marketing_opt_in") return flip(!!contact.marketing_opt_in === (v ? v === "true" : true));

  const actual = String(contact[cfg.field] ?? "").toLowerCase(); // lifecycle, company, …
  if (op === "contains") return actual.includes(v);
  return op === "is_not" ? actual !== v : actual === v;
}

// Master social links from the shared Brand kit (Settings → Brand kit). Set
// once, they flow into every email's social + footer blocks. Only non-empty
// values are returned so they overlay cleanly (and win over any stale per-
// template value).
async function brandMasterSocials(env) {
  try {
    const rows = await sbGet(env, "brand_settings", "id=eq.1&select=website,linkedin,instagram,facebook,twitter,youtube");
    const b = (rows && rows[0]) || {};
    const out = {};
    for (const k of ["website", "linkedin", "instagram", "facebook", "twitter", "youtube"]) if (b[k]) out[k] = b[k];
    return out;
  } catch (_) { return {}; }
}

// Wrap a transactional email's HTML in the admin-designed "Branded base" template
// (Email Studio, status=active) so every automated email shares one chrome. The
// base's own sample message/CTA blocks are swapped for `contentHtml`; its logo,
// divider, footer + branding are kept. Falls back to the raw content if there's
// no base template (never breaks a send).
async function wrapInBrandedBase(env, contentHtml) {
  try {
    const rows = await sbGet(env, "email_templates", "name=ilike.*base*&status=eq.active&select=branding,blocks&order=updated_at.desc&limit=1");
    const base = rows && rows[0];
    if (!base || !Array.isArray(base.blocks) || !base.blocks.length) return contentHtml;
    const out = []; let injected = false;
    for (const blk of base.blocks) {
      if (blk.type === "text" || blk.type === "button") {
        // Inject the email content where the base's sample message sits, and
        // carry that block's own spacing so the message keeps the base's margins
        // (vertical) + padding (horizontal inset) — otherwise tuned spacing is lost.
        if (!injected) {
          const p = blk.pad || {};
          const inner = (p.t || p.r || p.b || p.l)
            ? `<div style="padding:${p.t || 0}px ${p.r || 0}px ${p.b || 0}px ${p.l || 0}px;">${contentHtml}</div>`
            : contentHtml;
          const slot = { type: "code", id: "txc", html: inner };
          if (blk.margin) slot.margin = blk.margin;
          out.push(slot);
          injected = true;
        }
        continue; // drop the base's sample message + CTA
      }
      out.push(blk);
    }
    if (!injected) out.push({ type: "code", id: "txc", html: contentHtml });
    const brand = { ...defaultBrand(), ...(base.branding || {}), ...(await brandMasterSocials(env)) };
    const { html } = renderTemplate({ mode: "blocks", blocks: out, branding: base.branding }, { brand });
    return html || contentHtml;
  } catch (_) { return contentHtml; }
}

const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthLabel(ym) {
  const m = String(ym || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return "";
  return `${MONTHS_FULL[Math.max(0, Math.min(11, parseInt(m[2], 10) - 1))]} ${m[1]}`;
}

// Videography new-starter funnel merge context. Pulls the contact's agent_profiles
// row and builds the personalised booking link + {{code}}/{{shootMonth}}/{{trainerName}}
// so the funnel emails resolve those tokens. Returns {} for non-funnel contacts.
async function agentFunnelContext(env, contact) {
  try {
    const rows = await sbGet(env, "agent_profiles", `contact_id=eq.${encodeURIComponent(contact.id)}&select=promo_code,induction_month,trainer_name`);
    const p = rows && rows[0];
    if (!p || !p.promo_code) return {};
    const site = String(env.SITE_URL || "https://tmke.co.uk").replace(/\/+$/, "");
    const params = new URLSearchParams({ code: p.promo_code });
    const nm = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
    if (nm) params.set("name", nm);
    if (contact.email) params.set("email", contact.email);
    if (p.induction_month) params.set("month", p.induction_month);
    return {
      bookingLink: `${site}/videography/new-starter?${params.toString()}`,
      code: p.promo_code,
      shootMonth: monthLabel(p.induction_month),
      trainerName: p.trainer_name || "Kelly Bailey",
    };
  } catch (_) { return {}; }
}

async function autoExecAction(env, node, contact) {
  const c = node.config || {};
  try {
    if (node.type === "send_email") {
      if (contact.dnd || contact.dnd_email || !c.template_id) return;
      const tRows = await sbGet(env, "email_templates", `id=eq.${c.template_id}&select=*`);
      const t = tRows && tRows[0]; if (!t) return;
      const brand = { ...defaultBrand(), ...(t.branding || {}), ...(await brandMasterSocials(env)) };
      const recipient = { name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email, first_name: contact.first_name || "", email: contact.email, company: contact.company || "" };
      // Hydrate the videography funnel tokens ({{bookingLink}}, {{code}}, …) when
      // this contact is a new starter with a generated code.
      Object.assign(recipient, await agentFunnelContext(env, contact));
      const { subject, html } = renderTemplate(
        { subject: t.subject, preheader: t.preheader, mode: t.mode, blocks: t.blocks, customHtml: t.custom_html, branding: t.branding },
        { brand, mergeCtx: mergeContextFor(recipient, brand) }
      );
      await sendEmail(env, { to: contact.email, subject, html });
    } else if (node.type === "add_tag" && c.tag) {
      const tags = Array.from(new Set([...(contact.tags || []), c.tag])); contact.tags = tags;
      await sbPatch(env, "contacts", `id=eq.${contact.id}`, { tags });
    } else if (node.type === "remove_tag" && c.tag) {
      const tags = (contact.tags || []).filter((t) => t !== c.tag); contact.tags = tags;
      await sbPatch(env, "contacts", `id=eq.${contact.id}`, { tags });
    } else if (node.type === "add_note" && c.body) {
      await sbPost(env, "contact_notes", { contact_id: contact.id, body: c.body, author: "Automation" });
    } else if (node.type === "create_task" && c.title) {
      const due = c.due_days != null ? new Date(Date.now() + Number(c.due_days) * 864e5).toISOString() : null;
      await sbPost(env, "contact_tasks", { contact_id: contact.id, title: c.title, due_at: due });
    } else if (node.type === "set_dnd") {
      contact.dnd = true; await sbPatch(env, "contacts", `id=eq.${contact.id}`, { dnd: true });
    } else if (node.type === "set_field" && c.field) {
      const patch = {}; patch[c.field] = c.value; contact[c.field] = c.value;
      await sbPatch(env, "contacts", `id=eq.${contact.id}`, patch);
    } else if (node.type === "notify_team") {
      // Recipient: a fixed address, or the contact's trainer (agent_profiles).
      let to = "";
      if (c.to_mode === "trainer") {
        const rows = await sbGet(env, "agent_profiles", `contact_id=eq.${encodeURIComponent(contact.id)}&select=trainer_email`);
        to = (rows && rows[0] && rows[0].trainer_email) || "";
      } else {
        to = c.to || "";
      }
      if (!to) return;
      // Content: a saved Email Studio template (merged from the enrolled contact),
      // or a short note. Either way it's delivered to `to` (the team/trainer), so
      // the contact's do-not-contact does NOT apply.
      if (c.body_mode === "template" && c.template_id) {
        const tRows = await sbGet(env, "email_templates", `id=eq.${c.template_id}&select=*`);
        const t = tRows && tRows[0]; if (!t) return;
        const brand = { ...defaultBrand(), ...(t.branding || {}), ...(await brandMasterSocials(env)) };
        const recipient = { name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email, first_name: contact.first_name || "", email: contact.email, company: contact.company || "" };
        Object.assign(recipient, await agentFunnelContext(env, contact));
        const { subject, html } = renderTemplate(
          { subject: t.subject, preheader: t.preheader, mode: t.mode, blocks: t.blocks, customHtml: t.custom_html, branding: t.branding },
          { brand, mergeCtx: mergeContextFor(recipient, brand) }
        );
        await sendEmail(env, { to, subject, html });
      } else {
        await sendEmail(env, { to, subject: `Automation — ${c.note || "update"}`, html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1d22"><p>${String(c.note || "An automation step fired").replace(/</g, "&lt;")}</p><p style="color:#888;font-size:12px">Contact: ${String(contact.email).replace(/</g, "&lt;")}</p></div>` });
      }
    }
  } catch (_) { /* one failed action shouldn't wedge the tick */ }
}

async function advanceEnrollment(env, enr) {
  const stop = (status, extra) => sbPatch(env, "automation_enrollments", `id=eq.${enr.id}`, { status, ...(extra || {}) });
  const aRows = await sbGet(env, "automations", `id=eq.${enr.automation_id}&select=id,status,graph`);
  const auto = aRows && aRows[0];
  if (!auto || auto.status !== "active") return stop("stopped");
  const cRows = await sbGet(env, "contacts", `id=eq.${enr.contact_id}&select=*`);
  const contact = cRows && cRows[0];
  if (!contact) return stop("stopped");
  const graph = auto.graph || { nodes: [], edges: [] };
  const nodes = graph.nodes || [];
  let cur = enr.current_node_id;
  for (let steps = 0; steps < AUTO_NODE_CAP; steps++) {
    const node = nodes.find((n) => n.id === cur);
    if (!node) return stop("completed");
    if (node.type === "wait") {
      const next = autoEdgeTo(graph, cur, "next");
      return sbPatch(env, "automation_enrollments", `id=eq.${enr.id}`, {
        current_node_id: next, next_run_at: new Date(Date.now() + autoWaitMs(node.config || {})).toISOString(),
        status: next ? "active" : "completed",
      });
    }
    let branch = "next";
    if (node.type === "if_else") branch = (await autoEvalCondition(env, node.config || {}, contact)) ? "yes" : "no";
    else await autoExecAction(env, node, contact);
    await sbPost(env, "automation_runs", { enrollment_id: enr.id, automation_id: auto.id, contact_id: contact.id, node_id: cur, node_type: node.type, outcome: "ok" });
    const next = autoEdgeTo(graph, cur, branch);
    if (!next) return stop("completed", { current_node_id: cur });
    cur = next;
  }
  // Step cap reached — resume shortly (guards against graph loops).
  return sbPatch(env, "automation_enrollments", `id=eq.${enr.id}`, { current_node_id: cur, next_run_at: new Date(Date.now() + 60e3).toISOString() });
}

async function runAutomationsTick(env) {
  if (!env.SUPABASE_SERVICE_ROLE) return 0;
  const due = (await sbGet(env, "automation_enrollments", `status=eq.active&next_run_at=lte.${encodeURIComponent(nowISO())}&select=*&order=next_run_at.asc&limit=50`)) || [];
  for (const enr of due) {
    try { await advanceEnrollment(env, enr); }
    catch (_) { await sbPatch(env, "automation_enrollments", `id=eq.${enr.id}`, { status: "error" }); }
  }
  return due.length;
}

// ---- Abandoned password-setup reminder ------------------------------------
// A buyer can pay and then never set a password (orders.user_id stays null),
// so they never see the pack they bought. ~30 min after a paid order is still
// unclaimed, email them a one-click link back to set it. Sends once (stamped
// via setup_reminder_sent_at) and skips anyone who already has an account for
// that email (an existing customer who'll just sign in).
function setupReminderHtml({ name, pack, link }) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const first = esc(String(name || "there").trim().split(/\s+/)[0] || "there");
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22">
    <h1 style="font-size:22px;margin:0 0 6px">Your pack is waiting${pack ? ` &mdash; ${esc(pack)}` : ""}</h1>
    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 20px">Hi ${first}, thanks for your purchase! You haven't set a password yet, so your library is still locked. Set one now and your pack unlocks straight away.</p>
    <p style="margin:0 0 26px"><a href="${esc(link)}" style="display:inline-block;background:#371e28;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 22px;border-radius:6px">Set my password &amp; open my library &rarr;</a></p>
    <p style="font-size:12px;color:#999;line-height:1.6;margin:0">If the button doesn't work, paste this into your browser:<br><span style="color:#777">${esc(link)}</span></p>
    <p style="font-size:12px;color:#999;margin:24px 0 0">Sent by TMKE &middot; <a href="https://tmke.co.uk" style="color:#371e28">tmke.co.uk</a></p>
  </div>`;
}

async function runSetupReminders(env) {
  if (!env.SUPABASE_SERVICE_ROLE) return;
  const MINUTES = 30; // remind once a paid order has been unclaimed this long
  try {
    const newer = new Date(Date.now() - MINUTES * 60 * 1000).toISOString();
    const older = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // don't chase ancient orders
    const rows = await sbGet(
      env,
      "orders",
      `status=eq.paid&user_id=is.null&setup_reminder_sent_at=is.null` +
        `&created_at=lt.${encodeURIComponent(newer)}&created_at=gt.${encodeURIComponent(older)}` +
        `&select=id,buyer_email,buyer_name,pack_title&order=created_at.asc&limit=50`
    );
    if (!rows || !rows.length) return;
    for (const o of rows) {
      if (!o.buyer_email) continue;
      // Stamp first so a slow/failed send can't double-email on the next tick.
      await sbPatch(env, "orders", `id=eq.${o.id}`, { setup_reminder_sent_at: new Date().toISOString() });
      // Skip if an account already exists for this email — they can just sign in.
      const hasAccount = !!(await findUserByEmail(env, o.buyer_email));
      if (hasAccount) continue;
      const link = `${(env.SITE_URL || "https://tmke.co.uk").replace(/\/+$/, "")}/edit/thanks?order=${encodeURIComponent(o.id)}`;
      await sendEmail(env, {
        to: o.buyer_email,
        subject: "Set your password to unlock your TMKE pack",
        html: setupReminderHtml({ name: o.buyer_name, pack: o.pack_title, link }),
      });
    }
  } catch (_) { /* best-effort; the next tick retries any newly-eligible orders */ }
}

// ---- Inbound email capture (Phase 4) -----------------------------------
// Polls the SMM manager's mailbox on the frequent cron and logs client replies
// into the correspondence thread as inbound emails, matched to the lead by
// sender address. Best-effort: needs the Mail.Read application permission on the
// Graph app (admin-consented); without it the Graph read 403s and we skip.
async function pollSmmInbox(env) {
  const mailbox = env.SMM_MAIL_SENDER || env.MAIL_SENDER;
  if (!mailbox) return { ok: false, error: "No mailbox configured (SMM_MAIL_SENDER / MAIL_SENDER)." };
  // Look back a generous window and dedup by the Graph message id, so a message
  // is never logged twice however often the cron runs.
  const sinceIso = new Date(Date.now() - 2 * 3600000).toISOString();
  let messages = [];
  try {
    const q = `/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages?$filter=receivedDateTime ge ${sinceIso}&$select=id,subject,bodyPreview,from,receivedDateTime&$orderby=receivedDateTime desc&$top=40`;
    const data = await graph(env, "GET", q);
    messages = (data && data.value) || [];
  } catch (err) { return { ok: false, error: (err && err.message) || "Graph read failed (Mail.Read may be missing)." }; }
  if (!messages.length) return { ok: true, read: 0, captured: 0 };

  // Message ids we've already captured recently, to dedup.
  const seen = new Set();
  try {
    const rows = await sbGet(env, "booking_messages", `booking_source=eq.smm&direction=eq.inbound&external_id=not.is.null&select=external_id&order=created_at.desc&limit=200`);
    for (const r of (rows || [])) if (r.external_id) seen.add(r.external_id);
  } catch (_) {}

  let captured = 0;
  for (const m of messages) {
    if (!m.id || seen.has(m.id)) continue;
    const from = m.from && m.from.emailAddress && m.from.emailAddress.address;
    if (!from) continue;
    // Match to the most recent SMM lead with this sender address.
    let lead = null;
    try {
      const rows = await sbGet(env, "smm_leads", `email=ilike.${encodeURIComponent(String(from).toLowerCase())}&select=id,email,account_user_id&order=created_at.desc&limit=1`);
      lead = rows && rows[0];
    } catch (_) {}
    if (!lead) continue;
    await logBookingMessage(env, {
      booking_id: lead.id, booking_source: "smm", account_user_id: lead.account_user_id, client_email: lead.email,
      direction: "inbound", channel: "email", kind: "reply", subject: m.subject || null,
      body: (m.bodyPreview || "").trim(), is_automated: false, created_by: from, external_id: m.id,
    });
    captured++;
  }
  return { ok: true, read: messages.length, captured };
}

export default {
  // Cron (see wrangler.toml [triggers]). The 07:00 & 08:00 daily runs send post
  // reminders (runReminders self-gates to 8am UK); every other (frequent) run
  // advances automations + chases any paid-but-no-password orders.
  async scheduled(event, env, ctx) {
    if (event && (event.cron === "0 7 * * *" || event.cron === "0 8 * * *")) { ctx.waitUntil(runReminders(env)); ctx.waitUntil(runDdMonthly(env)); }
    else {
      ctx.waitUntil(runAutomationsTick(env));
      ctx.waitUntil(runSetupReminders(env));
      ctx.waitUntil(pollSmmInbox(env));
      // Poll the TEG new-starter sheet ~every 15 min (the 5-min tick, gated to
      // :00/:15/:30/:45) so new Pro/Academy rows enrol into the funnel.
      let mins = 0; try { mins = new Date(event.scheduledTime).getUTCMinutes(); } catch (_) {}
      if (mins % 15 === 0) ctx.waitUntil(syncAgentSheet(env));
    }
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      // ---- Trigger a site rebuild (publish/edit a blog -> push live) ----------
      // The public site is a static Astro build, so DB writes don't change the
      // live pages until a redeploy. The admin editor calls this after a
      // publish/save so Railway rebuilds (re-runs `astro build`, which re-queries
      // Supabase) and the new/edited post goes live — no manual deploy.
      // Railway has no incoming deploy-hook URL, so we call its GraphQL API.
      // Set on the Worker:
      //   wrangler secret put RAILWAY_API_TOKEN     (Account/Project API token)
      //   [vars] RAILWAY_SERVICE_ID, RAILWAY_ENVIRONMENT_ID  (ids of the prod service)
      if (path.endsWith("/deploy") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user) return json({ ok: false, error: "Sign in to publish." }, 401, request, env);
        if (!isAdminEmail(user)) return json({ ok: false, error: "Not authorised." }, 403, request, env);
        if (!env.RAILWAY_API_TOKEN || !env.RAILWAY_SERVICE_ID || !env.RAILWAY_ENVIRONMENT_ID) {
          return json({ ok: false, error: "Auto-deploy isn't configured — set RAILWAY_API_TOKEN (secret), plus RAILWAY_SERVICE_ID and RAILWAY_ENVIRONMENT_ID, on the Worker." }, 503, request, env);
        }
        const now = Date.now();
        // A rebuild already in flight picks up the latest content, so coalesce
        // bursts (e.g. publish then a quick edit) into one deploy.
        if (now - _lastDeployAt < 45000) {
          return json({ ok: true, queued: false, message: "A site update is already in progress — your changes will be included." }, 200, request, env);
        }
        _lastDeployAt = now;
        try {
          const r = await fetch("https://backboard.railway.com/graphql/v2", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.RAILWAY_API_TOKEN}` },
            body: JSON.stringify({
              query: "mutation Redeploy($e: String!, $s: String!) { serviceInstanceRedeploy(environmentId: $e, serviceId: $s) }",
              variables: { e: env.RAILWAY_ENVIRONMENT_ID, s: env.RAILWAY_SERVICE_ID },
            }),
          });
          const out = await r.json().catch(() => ({}));
          if (!r.ok || (out && out.errors && out.errors.length)) {
            _lastDeployAt = 0; // allow a retry
            const msg = (out && out.errors && out.errors[0] && out.errors[0].message) || ("Railway API returned " + r.status);
            return json({ ok: false, error: msg }, 502, request, env);
          }
        } catch (e) {
          _lastDeployAt = 0;
          return json({ ok: false, error: "Couldn't reach the Railway API." }, 502, request, env);
        }
        return json({ ok: true, queued: true, message: "Site is updating — your post will be live in a minute or two." }, 200, request, env);
      }

      // ---- Admin image upload → R2 (assets.tmke.co.uk), returns the URL -------
      // The email builder (and any admin tool) POSTs a file here; we store it in
      // the public ASSETS bucket and hand back its URL to drop into an image field.
      if (path.endsWith("/admin/upload") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user) return json({ error: "Sign in to upload." }, 401, request, env);
        if (!isAdminEmail(user)) return json({ error: "Not authorised." }, 403, request, env);
        if (!env.ASSETS) return json({ error: "Asset storage isn't configured on the Worker." }, 503, request, env);
        const form = await request.formData().catch(() => null);
        const file = form && form.get("file");
        if (!file || typeof file === "string") return json({ error: "No file uploaded." }, 400, request, env);
        const type = file.type || "application/octet-stream";
        if (!/^image\//.test(type)) return json({ error: "Images only." }, 415, request, env);
        const buf = await file.arrayBuffer();
        if (buf.byteLength > 12 * 1024 * 1024) return json({ error: "Image is too large (max 12MB)." }, 413, request, env);
        const extFromType = (type.split("/")[1] || "jpg").replace("jpeg", "jpg").replace("svg+xml", "svg");
        const nameExt = ((file.name || "").split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const ext = nameExt || extFromType;
        const key = `email-uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        try {
          await env.ASSETS.put(key, buf, { httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000" } });
        } catch (e) {
          return json({ error: "Upload failed — try again." }, 502, request, env);
        }
        const fileUrl = "https://assets.tmke.co.uk/" + key.split("/").map(encodeURIComponent).join("/");
        return json({ ok: true, url: fileUrl }, 200, request, env);
      }

      // ---- Stripe: create a hosted Checkout Session ---------------------------
      // The browser posts the pack id + buyer details; we re-read the pack price
      // from Supabase (never trust the client), create a `pending` order with the
      // service role, then hand back Stripe's hosted payment URL to redirect to.
      if (path.endsWith("/stripe/checkout") && request.method === "POST") {
        if (!env.STRIPE_SECRET_KEY) return json({ error: "Payments aren't set up yet — add the STRIPE_SECRET_KEY secret to the Worker." }, 503, request, env);
        let body;
        try { body = await request.json(); } catch (_) { return json({ error: "Bad JSON" }, 400, request, env); }
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim();
        const phone = String(body.phone || "").trim();
        const company = String(body.company || "").trim();
        const packId = String(body.pack_id || "").trim();
        if (!packId || !name || !email) return json({ error: "Please complete your details." }, 400, request, env);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "That email doesn't look right." }, 400, request, env);

        const packs = await sbGet(env, "packs", `id=eq.${encodeURIComponent(packId)}&status=eq.active&select=id,slug,title,price_pence,cover_image_url&limit=1`);
        const pack = packs && packs[0];
        if (!pack) return json({ error: "That pack isn't available." }, 404, request, env);
        const amount = pack.price_pence || 0;

        // Only redirect back to a known-good origin.
        const origin = request.headers.get("Origin") || "";
        const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
        const base = allowed.includes(origin) ? origin : (env.SITE_URL || "https://tmke.co.uk");

        // Create the order up-front as `pending` (or `paid` for free packs).
        const ins = await sbPost(env, "orders", {
          pack_id: pack.id, pack_slug: pack.slug, pack_title: pack.title, amount_pence: amount,
          buyer_name: name, buyer_email: email, buyer_phone: phone || null, buyer_company: company || null,
          payment_method: "card", status: amount === 0 ? "paid" : "pending",
        }, "return=representation");
        const created = await ins.json().catch(() => null);
        const order = Array.isArray(created) ? created[0] : created;
        if (!order || !order.id) return json({ error: "Couldn't start your order. Please try again." }, 500, request, env);

        // Free pack — no Stripe needed. Still a customer → make/merge a contact.
        if (amount === 0) { await contactFromOrder(env, order); return json({ url: `${base}/edit/thanks?order=${order.id}` }, 200, request, env); }

        try {
          const session = await stripeApi(env, "checkout/sessions", {
            mode: "payment",
            "payment_method_types[0]": "card",
            success_url: `${base}/edit/thanks?order=${order.id}`,
            cancel_url: `${base}/edit?canceled=1`,
            customer_email: email,
            client_reference_id: order.id,
            "metadata[order_id]": order.id,
            "line_items[0][quantity]": 1,
            "line_items[0][price_data][currency]": "gbp",
            "line_items[0][price_data][unit_amount]": amount,
            "line_items[0][price_data][product_data][name]": pack.title,
          });
          await sbPatch(env, "orders", `id=eq.${order.id}`, { stripe_session_id: session.id });
          return json({ url: session.url }, 200, request, env);
        } catch (e) {
          await sbPatch(env, "orders", `id=eq.${order.id}`, { status: "failed" });
          return json({ error: "Couldn't reach the payment provider. Please try again." }, 502, request, env);
        }
      }

      // ---- Stripe: webhook (the source of truth that marks an order paid) -----
      // Stripe POSTs here after checkout. We verify the signature against the raw
      // body, then flip the matching order to `paid` with the PaymentIntent id.
      if (path.endsWith("/stripe/webhook") && request.method === "POST") {
        const raw = await request.text();
        const ok = await stripeVerify(raw, request.headers.get("Stripe-Signature") || "", env.STRIPE_WEBHOOK_SECRET);
        if (!ok) return json({ error: "Bad signature" }, 400, request, env);
        let event;
        try { event = JSON.parse(raw); } catch (_) { return json({ error: "Bad JSON" }, 400, request, env); }
        if (event.type === "checkout.session.completed") {
          const s = event.data && event.data.object;
          const orderId = (s && s.metadata && s.metadata.order_id) || (s && s.client_reference_id);
          const pi = s && (typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent && s.payment_intent.id));
          if (orderId) {
            // Only existing columns here, so this can't fail if orders_stripe.sql
            // hasn't run yet. status=neq.paid keeps it idempotent on Stripe retries.
            await sbPatch(env, "orders", `id=eq.${encodeURIComponent(orderId)}&status=neq.paid`, {
              status: "paid", payment_ref: pi || null,
            });
            // Pack purchaser → make/merge a CRM contact.
            const orows = await sbGet(env, "orders", `id=eq.${encodeURIComponent(orderId)}&select=buyer_name,buyer_email,buyer_company,buyer_phone,pack_title,user_id&limit=1`);
            await contactFromOrder(env, orows && orows[0]);
          }
        }
        return json({ received: true }, 200, request, env);
      }

      // ---- AI: generate a social caption (+ hashtags) for a member's post ----
      // Two routes: a structured PROPERTY post, or a free-form "what's it about".
      // The voice rules live in CAPTION_RULES so the client's own captioning
      // guidelines can be dropped in later without touching the wiring.
      if (path.endsWith("/ai/caption") && request.method === "POST") {
        if (!cheapValid(request)) return json({ error: "Sign in to use AI." }, 401, request, env);
        if (!env.ANTHROPIC_API_KEY) return json({ error: "AI isn't configured — set the ANTHROPIC_API_KEY secret on the Worker." }, 503, request, env);
        let body; try { body = await request.json(); } catch (_) { return json({ error: "Bad JSON" }, 400, request, env); }
        const mode = body.mode === "property" ? "property" : "general";
        const clean = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n || 200);

        // Universal caption rules for estate-agent social media (client-supplied).
        // Edit this list to tune the house style; nothing else needs to change.
        const CAPTION_RULES = [
          "You are writing a social-media caption (Instagram/Facebook) AS a knowledgeable LOCAL UK estate agent — not a marketer, not an AI. The reader should feel they're hearing from a real agent with genuine experience and knowledge of their area. Build familiarity, trust and engagement.",
          "LENGTH: aim for 80 to 180 words. Go longer only for educational or advice content where extra explanation genuinely adds value; keep announcements, property launches and market updates shorter. Never pad to hit a word count — every sentence must earn its place.",
          "STRUCTURE (natural, never formulaic): a natural attention-catching opening, then the main message or story, then supporting context or value, then ONE clear call to action. Do not open every caption with a question or reuse the same opening style.",
          "TONE: write as if speaking directly to a client, in everyday language, confident but not promotional or corporate. Service-led content (property marketing, valuations, market updates, business announcements) should be more confident and informative, focused on expertise, process and value. Personal or community content (lifestyle, behind-the-scenes, community features, local recommendations) should be more relaxed and conversational, focused on personality, local knowledge and relationships.",
          "PUNCTUATION: do NOT use em dashes anywhere; use commas or full stops instead. Limit exclamation marks. Avoid excessive ellipses.",
          "EMOJI: only use an emoji if it genuinely suits the tone of the post. Use AT MOST ONE in the whole caption; zero is completely fine; never more than one.",
          "AVOID AI-sounding language. Never use: in today's market; in today's world; ever wondered; here's why; game changer; unlock; elevate; leverage; delve; imagine this; whether you're…; it's not just… it's…; at the end of the day; rest assured; needless to say; without further ado; next level; revolutionary; cutting-edge; seamless; dynamic; powerful solution; transform your…; maximise your potential. Choose wording that sounds like natural conversation.",
          "USE ESTATE-AGENCY CLICHÉS SPARINGLY (only where genuinely natural): dream home; forever home; your next chapter; making memories; perfect property; property journey; exceptional service; trusted experts; market-leading; bespoke service; award-winning team. Prefer fresher, more authentic alternatives.",
          "FORMATTING: short readable paragraphs, mostly two to three sentences. Use a single-sentence paragraph only deliberately, for emphasis or a question. Do not start a new paragraph after every sentence and do not write large blocks of text. Space it as a person naturally would.",
          "CALL TO ACTION: finish with ONE clear, relevant CTA that reads as a natural conclusion (e.g. ask a genuine question, invite opinions or local recommendations, invite direct messages or enquiries, invite a valuation booking, encourage arranging a viewing, or offer advice). Not tacked on for its own sake.",
          "ENGAGEMENT: encourage genuine conversation with questions people would naturally want to answer. Never use engagement bait such as 'comment YES', 'tag three friends', 'smash the like button', 'don't forget to like and follow'.",
          "AUTHENTICITY: write honestly, with no exaggerated claims, and not overly sales-focused unless the post is specifically promotional.",
          "LOCAL RELEVANCE: reference the local area naturally only where it fits (schools, parks, businesses, landmarks, community events). NEVER invent local information, prices, names or any detail you were not given; only use facts provided.",
          "GRAMMAR: British English. Use contractions naturally (you're, we're, it's, don't). Keep spelling, grammar and punctuation accurate. Write numbers naturally within sentences.",
          "READABILITY: clear, conversational and easy to read. Prefer straightforward language. Vary sentence length for a natural rhythm; do not make every sentence the same length.",
          "VARIETY: write the caption as its own original piece — vary the opening, sentence structure and closing rather than following a template.",
          "FINAL CHECK before answering: does this sound like a real local estate agent rather than AI? Is every sentence adding value? Is the tone right for the content type? Is there exactly one clear CTA? Are the paragraphs naturally formatted? Have clichés and AI language been avoided? Would someone enjoy reading this on Facebook or Instagram? If any answer is no, rewrite it until it feels natural, authentic and human.",
        ].join("\n- ");

        let brief;
        if (mode === "property") {
          const p = body.property || {};
          const angleMap = { "coming-soon": "Coming soon", "new-to-market": "New to market", "open-house": "Open house / viewing day", "price-adjustment": "Price adjustment", "just-sold": "Just sold / let" };
          const fields = [
            p.location ? `Location: ${clean(p.location, 120)}` : "",
            p.propertyType ? `Property type: ${clean(p.propertyType, 80)}` : "",
            p.beds ? `Bedrooms: ${clean(p.beds, 20)}` : "",
            p.price ? `Price: ${clean(p.price, 40)}` : "",
            (p.angle && angleMap[p.angle]) ? `Post angle: ${angleMap[p.angle]}` : "",
            p.features ? `Standout features: ${clean(p.features, 600)}` : "",
          ].filter(Boolean).join("\n");
          if (!fields) return json({ error: "Add at least a location or a couple of details." }, 400, request, env);
          brief = `Write a caption for a PROPERTY post (service-led content). Use only these details:\n${fields}`;
        } else {
          const topic = clean(body.topic, 900);
          if (!topic) return json({ error: "Tell us what the post is about." }, 400, request, env);
          brief = `Write a caption for a social post about the following. Judge from it whether this is service-led or personal/community content, and pitch the tone accordingly:\n${topic}`;
        }

        // Hashtags: off by default unless the member ticks "add hashtags"; max 4.
        const wantTags = body.hashtags === true;
        const tagsLine = wantTags
          ? "\n\nAlso provide UP TO FOUR genuinely relevant hashtags separately (location, property, estate agency, community). Fewer than four is fine; never a long block of generic tags."
          : "\n\nDo not include any hashtags; return an empty hashtags array.";

        // The member's own brand tone of voice (from their Brand Kit). Takes
        // priority on tone/personality, but the house rules above still hold —
        // especially the emoji limit.
        const tone = clean(body.tone, 800);
        const toneBlock = tone ? `\n\nThis client's own brand voice — match it closely for tone and personality (while still following every rule above, especially the one-emoji limit):\n${tone}` : "";
        const prompt = `- ${CAPTION_RULES}${toneBlock}\n\n${brief}${tagsLine}\n\nReturn ONLY minified JSON, no markdown fences, exactly: {"caption": "caption text with line breaks as \\n", "hashtags": ["#tag1", "#tag2"]}.`;
        let aiRes;
        try {
          aiRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
            body: JSON.stringify({ model: env.AI_MODEL || "claude-sonnet-4-6", max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
          });
        } catch (e) { return json({ error: "Couldn't reach the AI service." }, 502, request, env); }
        if (!aiRes.ok) { const t = await aiRes.text().catch(() => ""); return json({ error: "AI request failed (" + aiRes.status + ").", detail: t.slice(0, 300) }, 502, request, env); }
        const dataRes = await aiRes.json();
        const text = (dataRes.content || []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
        let out;
        try { const s = text.indexOf("{"), e = text.lastIndexOf("}"); out = JSON.parse(text.slice(s, e + 1)); } catch (_) { out = { caption: text, hashtags: [] }; }
        const caption = String(out.caption || "").trim();
        let hashtags = (wantTags && Array.isArray(out.hashtags)) ? out.hashtags.map((h) => String(h).trim()).filter(Boolean).map((h) => (h[0] === "#" ? h : "#" + h.replace(/^#+/, ""))).slice(0, 4) : [];
        if (!caption) return json({ error: "Couldn't generate a caption — please try again." }, 502, request, env);
        return json({ ok: true, caption, hashtags }, 200, request, env);
      }

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

      // ---- Email a planned post to the signed-in member now ------------------
      // The "Email it to me now" button in the editor's plan modal — sends the
      // caption + image to their own inbox straight away (grab it on your phone).
      if (path.endsWith("/calendar/send-now") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !user.email) return json({ error: "Sign in first." }, 401, request, env);
        if (!env.RESEND_API_KEY) return json({ error: "Email isn't configured on the Worker." }, 503, request, env);
        const b = await request.json().catch(() => ({}));
        const item = { asset_url: String((b && b.asset_url) || ""), caption: (b && b.caption) || "", title: (b && b.title) || "", platform_hint: (b && b.platform) || "instagram" };
        if (!item.asset_url) return json({ error: "Nothing to send." }, 400, request, env);
        const ok = await sendPostEmail(env, { email: user.email, item, subject: `Your ${item.platform_hint} post — ready to go` });
        if (!ok) return json({ error: "Couldn't send the email — try again." }, 502, request, env);
        return json({ ok: true, to: user.email }, 200, request, env);
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

      // ---- Live media listing: images + videos in an assets folder, newest
      // first. Public GET; powers the auto-updating videography galleries. The
      // ?prefix= param selects the folder (defaults to the whole headshots
      // folder for backward compatibility). Returns videos first so a gallery
      // can lead with its film. ----
      if (path.endsWith("/headshots") && request.method === "GET") {
        if (!env.ASSETS) return json({ images: [], videos: [], items: [] }, 200, request, env);
        const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "60", 10)));
        const prefix = url.searchParams.get("prefix") || "Jack - headshots/";
        const toUrl = (o) => "https://assets.tmke.co.uk/" + o.key.split("/").map(encodeURIComponent).join("/");
        const listed = await env.ASSETS.list({ prefix });
        const rows = (listed.objects || [])
          .filter((o) => !o.key.endsWith("/"))                              // skip folder markers
          .filter((o) => /\.(jpe?g|png|webp|avif|mp4|mov|webm|m4v)$/i.test(o.key))
          .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));     // newest first
        const videos = rows.filter((o) => /\.(mp4|mov|webm|m4v)$/i.test(o.key)).map(toUrl);
        const images = rows.filter((o) => /\.(jpe?g|png|webp|avif)$/i.test(o.key)).map(toUrl);
        const items = [
          ...videos.map((u) => ({ url: u, type: "video" })),
          ...images.map((u) => ({ url: u, type: "image" })),
        ].slice(0, limit);
        return json({ images: images.slice(0, limit), videos, items }, 200, request, env);
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
            const u = await findUserByEmail(env, email);
            if (u) accountUserId = u.id;
          } else {
            const cr = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
              method: "POST",
              headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json" },
              body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: name, company: company || null, phone: phone || null } }),
            });
            if (cr.ok) { const u = await cr.json(); accountUserId = (u && u.id) || null; accountCreated = true; }
            else {
              // Already registered — find their id so the booking still links (best-effort).
              const u = await findUserByEmail(env, email);
              if (u) accountUserId = u.id;
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

        // 4) Write the full pipeline row (capture the id so we can thread the
        //    confirmation into the member's booking correspondence).
        const rescheduleToken = (crypto.randomUUID && crypto.randomUUID()) || `${date}-${Math.abs(hmToMin(start))}-${ev.id || ""}`;
        let newBookingId = null;
        try {
          const insRes = await sbPost(env, "videography_bookings", {
            kind: "booking", service_type: service_type || null, audience: audience || null, brand: brand || null,
            package: pkg || null, add_ons: Array.isArray(add_ons) ? add_ons : [], postcode: postcode || null,
            distance_miles: distance_miles ?? null, surcharge_pence: surcharge_pence || 0,
            client_name: name, client_email: email, client_phone: phone || null, company: company || null,
            service: service || null, shoot_date: `${date}T${start}:00`, stage: "booked", notes: notes || null,
            signed_name: signed_name || null, signed_at: signed_at || null, marketing_opt_in: !!marketing_opt_in,
            promo_code: promo_code || null, discount_pence: discount_pence || 0,
            account_user_id: accountUserId, reschedule_token: rescheduleToken, total_pence: total_pence ?? null,
            ms_event_id: ev.id || null, duration_min: dur,
          }, "return=representation");
          const arr = await insRes.json();
          newBookingId = Array.isArray(arr) && arr[0] ? arr[0].id : null;
        } catch (_) {}

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
          html: bookingConfirmHtml({ name, service, serviceType: service_type, packageLabel, dateNice, time: start, addOns: add_ons, postcode, surchargePence: surcharge_pence, totalPence: total_pence, manageUrl: `${siteUrl}/manage?token=${encodeURIComponent(rescheduleToken)}` }),
          attachments: [{ filename: "booking.ics", content: icsB64, contentType: "text/calendar" }],
        });
        await sendEmail(env, {
          to: env.JACK_NOTIFY || env.JACK_UPN, subject: `New booking — ${service || "Shoot"} — ${name}`,
          html: jackNotifyHtml({ name, company, email, phone, service, packageLabel, addOns: add_ons, postcode, distanceMiles: distance_miles, surchargePence: surcharge_pence, dateNice, time: start, totalPence: total_pence, signedName: signed_name, marketingOptIn: marketing_opt_in }),
        });

        // Thread the confirmation into the member's booking correspondence.
        await logBookingMessage(env, {
          booking_id: newBookingId, booking_source: "videography",
          account_user_id: accountUserId, client_email: email,
          kind: "confirmation", subject: `Booking confirmed — ${service || "TMKE"}`,
          body: `Your ${service || "booking"} is confirmed for ${dateNice} at ${start}.`
            + (postcode ? ` Location: ${postcode}.` : "")
            + (total_pence != null ? ` Total ${gbpW(total_pence)} inc. VAT, invoiced on delivery.` : "")
            + ` We'll be in touch the day before to confirm the details.`,
        });

        // CRM + automations: upsert the contact; a brand-new account kicks off
        // any "account created" automation (e.g. the welcome series).
        try {
          const fn = String(name || "").trim().split(/\s+/);
          const bkTags = crmTags(email, ["Videography-Client", videographyProductTag(service_type)], { optIn: !!marketing_opt_in, member: !!(accountCreated || accountUserId) });
          const ci = { email, first_name: fn.shift() || name, last_name: fn.join(" ") || null, phone, company,
            source: "videography_" + (service_type || "booking"), lifecycle: "customer",
            marketing_opt_in: !!marketing_opt_in, tags: bkTags, user_id: accountUserId };
          if (accountCreated) await fireTrigger(env, "account_created", ci, { service, package: pkg });
          else await sbRpc(env, "upsert_contact", { p_email: email, p_first_name: ci.first_name, p_last_name: ci.last_name, p_phone: phone || null, p_company: company || null, p_source: ci.source, p_lifecycle: "customer", p_marketing_opt_in: !!marketing_opt_in, p_tags: bkTags, p_user_id: accountUserId });
        } catch (_) {}

        return json({ ok: true, eventId: ev.id, account_created: accountCreated }, 200, request, env);
      }

      // ---- TEG new-starter "Studio Day" booking (free to them; bill-to-TPE) ----
      // Reuses the normal booking machinery (account, Jack's calendar, code
      // redemption, confirmation email) but takes no payment and marks the row
      // bill_to='TPE'. Also flips the agent's TEG record to 'booked'.
      if (path.endsWith("/new-starter/book") && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const { date, start, name, phone, notes, password, code } = b || {};
        const em = String((b && b.email) || "").trim().toLowerCase();
        if (!date || !start || !name || !em) return json({ error: "Missing booking details." }, 400, request, env);
        if (!password || String(password).length < 8) return json({ error: "A password of at least 8 characters is required." }, 400, request, env);
        const dur = 180; // half-day = 3 hours
        const endHm = minToHm(hmToMin(start) + dur);

        // 0) The single-use code must exist and still be live. It's voided when an
        // induction is cancelled, so this blocks a cancelled starter from booking.
        if (!code) return json({ error: "A booking code is required — please use the personalised link from your email." }, 400, request, env);
        {
          const pcRows = await sbGet(env, "videography_promo_codes", `code=ilike.${encodeURIComponent(String(code))}&select=active,redemptions,max_redemptions`);
          const pc = pcRows && pcRows[0];
          if (!pc || pc.active !== true || (pc.max_redemptions != null && (pc.redemptions || 0) >= pc.max_redemptions)) {
            return json({ error: "This booking code is no longer valid. If you think this is a mistake, please contact us." }, 403, request, env);
          }
        }

        // 1) Re-check Jack's calendar is free for the slot.
        try {
          const check = await graph(env, "POST", `/users/${encodeURIComponent(env.JACK_UPN)}/calendar/getSchedule`, {
            schedules: [env.JACK_UPN],
            startTime: { dateTime: `${date}T${start}:00`, timeZone: "Europe/London" },
            endTime: { dateTime: `${date}T${endHm}:00`, timeZone: "Europe/London" },
            availabilityViewInterval: 30,
          });
          const view = (check.value && check.value[0] && check.value[0].availabilityView) || "";
          if (view && /[^0]/.test(view)) return json({ error: "That slot was just taken — please choose another." }, 409, request, env);
        } catch (_) {}

        // 2) Account: existing → verify their password and link; new → create.
        let accountUserId = null, accountCreated = false;
        const existing = await findUserByEmail(env, em);
        if (existing) {
          let ok = false;
          try {
            const tr = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
              method: "POST", headers: { apikey: env.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({ email: em, password }),
            });
            ok = tr.ok;
          } catch (_) {}
          if (!ok) return json({ error: "That email already has a TMKE account — the password didn't match. Use your existing password, or reset it on the sign-in page." }, 401, request, env);
          accountUserId = existing.id;
        } else {
          try {
            const cr = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
              method: "POST", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json" },
              body: JSON.stringify({ email: em, password, email_confirm: true, user_metadata: { full_name: name, phone: phone || null } }),
            });
            if (cr.ok) { const u = await cr.json(); accountUserId = (u && u.id) || null; accountCreated = true; }
            else { const u = await findUserByEmail(env, em); if (u) accountUserId = u.id; }
          } catch (_) {}
        }

        // 3) Redeem their single-use code (best-effort).
        if (code) {
          try {
            await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/redeem_promo_code`, {
              method: "POST", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json" },
              body: JSON.stringify({ p_code: String(code).toUpperCase() }),
            });
          } catch (_) {}
        }

        // 4) Block Jack's calendar (studio session).
        let ev = {};
        try {
          ev = await graph(env, "POST", `/users/${encodeURIComponent(env.JACK_UPN)}/events`, {
            subject: `Studio Day (new starter) — ${name}`,
            body: { contentType: "text", content: [`New-starter Studio Day.`, phone && `Phone: ${phone}`, `Email: ${em}`, notes && `Notes: ${notes}`].filter(Boolean).join("\n") },
            start: { dateTime: `${date}T${start}:00`, timeZone: "Europe/London" },
            end: { dateTime: `${date}T${endHm}:00`, timeZone: "Europe/London" },
            location: { displayName: "TMKE Content Studio" },
            attendees: [{ emailAddress: { address: em, name }, type: "required" }],
          });
        } catch (_) {}

        // 5) Insert the booking row — bill-to-TPE, £295 + VAT (£354 inc).
        const rescheduleToken = (crypto.randomUUID && crypto.randomUUID()) || `${date}-${start}-${ev.id || ""}`;
        let newBookingId = null;
        try {
          const insRes = await sbPost(env, "videography_bookings", {
            kind: "booking", service_type: "content-studio", service: "New-Starter Studio Day",
            client_name: name, client_email: em, client_phone: phone || null,
            shoot_date: `${date}T${start}:00`, stage: "booked", notes: notes || null,
            promo_code: code || null, discount_pence: 0, bill_to: "TPE", total_pence: 35400,
            account_user_id: accountUserId, reschedule_token: rescheduleToken,
            ms_event_id: ev.id || null, duration_min: dur, marketing_opt_in: false,
          }, "return=representation");
          const arr = await insRes.json();
          newBookingId = Array.isArray(arr) && arr[0] ? arr[0].id : null;
        } catch (_) {}

        // 6) CRM: tag like a normal videography booking + flip the TEG record to booked.
        // The "Videography-Booked" tag is the funnel's exit signal — an If/else on
        // it drops them out of the email sequence once they've booked.
        try {
          const fn = String(name || "").trim().split(/\s+/);
          const tags = crmTags(em, ["Videography-Client", videographyProductTag("content-studio"), "Videography-Booked"], { member: true });
          await sbRpc(env, "upsert_contact", { p_email: em, p_first_name: fn.shift() || name, p_last_name: fn.join(" ") || null, p_phone: phone || null, p_source: "new_starter_booking", p_lifecycle: "customer", p_tags: tags, p_user_id: accountUserId });
          const cRows = await sbGet(env, "contacts", `email=eq.${encodeURIComponent(em)}&select=id`);
          const cid = cRows && cRows[0] && cRows[0].id;
          if (cid) {
            await fetch(`${env.SUPABASE_URL}/rest/v1/agent_profiles?contact_id=eq.${encodeURIComponent(cid)}`, {
              method: "PATCH", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
              body: JSON.stringify({ status: "booked", shoot_booked_at: `${date}T${start}:00` }),
            });
            // Belt-and-braces: pull them out of any running videography funnel now,
            // so no email fires between booking and the next If/else check.
            try {
              const funnels = await sbGet(env, "automations", `trigger_type=eq.new_starter_videography&select=id`);
              const fids = (funnels || []).map((a) => a.id);
              if (fids.length) await sbPatch(env, "automation_enrollments", `contact_id=eq.${cid}&status=eq.active&automation_id=in.(${fids.join(",")})`, { status: "stopped" });
            } catch (_) {}
          }
        } catch (_) {}

        // 7) Confirmation email to the starter + heads-up to Jack (best-effort).
        const dateNice = (() => { try { return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch (_) { return date; } })();
        const first = String(name || "there").trim().split(/\s+/)[0];
        const cHtml = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:8px 4px;">
          <div style="font-size:20px;font-weight:800;letter-spacing:0.14em;color:#371e28;margin:0 0 18px;">TMKE</div>
          <p style="margin:0 0 14px;font-size:15px;color:#1c1d22;">Hi ${first},</p>
          <p style="margin:0 0 14px;font-size:15px;color:#1c1d22;">Your <strong>Studio Day</strong> is booked. Here are the details:</p>
          <p style="margin:0 0 6px;font-size:15px;color:#1c1d22;"><strong>${dateNice}</strong> at <strong>${start}</strong> (about 3 hours)</p>
          <p style="margin:0 0 18px;font-size:15px;color:#1c1d22;">at the <strong>TMKE Content Studio</strong>. We'll confirm the full address and how to prepare in a reminder before the day.</p>
          <p style="margin:0 0 18px;font-size:14px;color:#6b6b70;">There's nothing for you to pay — your session is part of your induction package.</p>
          <p style="margin:0;font-size:12.5px;color:#9a9aa0;">Need to change it? Just reply to this email.</p>
        </div>`;
        try { await sendEmail(env, { to: em, subject: "Your Studio Day is booked — TMKE", html: cHtml }); } catch (_) {}
        try { await sendEmail(env, { to: env.JACK_NOTIFY || env.JACK_UPN, subject: `New Studio Day booking — ${name}`, html: `<p>New-starter Studio Day booked.</p><p><strong>${name}</strong> — ${dateNice} at ${start} (3 hrs), TMKE Content Studio.</p><p>${em}${phone ? " · " + phone : ""}</p><p>Bill to <strong>TPE</strong> — £295 + VAT.</p>` }); } catch (_) {}

        await logBookingMessage(env, {
          booking_id: newBookingId, booking_source: "videography", account_user_id: accountUserId, client_email: em,
          kind: "confirmation", subject: "Studio Day booked",
          body: `New-starter Studio Day booked for ${dateNice} at ${start}. Billed to TPE.`,
        });

        // Write the booked slot back to the TEG sheet's "Shoot Booked" column
        // (best-effort — needs the sheet shared with EDIT access to the service account).
        try { await agentSheetWriteBooked(env, em, `${dateNice}, ${start}`); } catch (_) {}

        return json({ ok: true, account_created: accountCreated }, 200, request, env);
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
        // Hardened: don't fake success if the insert is rejected.
        const saved = await sbPost(env, "enquiries", {
          first_name: firstName, last_name: lastName, email,
          phone: phone || null, business_name: company || null,
          industry: service || null, message: fullMessage,
          source: `videography_${service_type || "general"}`, status: "new",
        });
        if (!saved.ok) {
          const detail = await saved.text().catch(() => "");
          console.error("videography enquiry insert failed", saved.status, detail);
          return json({ error: "We couldn't save your enquiry just then — please try again, or email hello@tmke.co.uk." }, 502, request, env);
        }
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
        // CRM + automations: this is a form submission — upsert the lead and fire
        // any "form submitted" automation.
        try {
          await fireTrigger(env, "form_submitted", {
            email, first_name: firstName, last_name: lastName === "—" ? null : lastName,
            phone: phone || null, company: company || null, source: "videography_enquiry",
            lifecycle: "lead", marketing_opt_in: !!marketing_opt_in,
            tags: crmTags(email, "Interest: Videography", { optIn: !!marketing_opt_in }),
          }, { form: service_type || "videography" });
        } catch (_) {}
        return json({ ok: true }, 200, request, env);
      }

      // ---- Social Media — Get in Touch (Form 3): a general enquiry, optional
      //      account. Tag "General Enquiry". Auto-ack on every submit. ----------
      if (path.endsWith("/smm/enquiry") && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const { first_name, last_name, business, email, phone, message, password, marketing_opt_in, turnstile_token, hp } = b || {};
        // Honeypot — a bot filled the hidden field. Pretend success, drop silently.
        if (hp) return json({ ok: true }, 200, request, env);
        // Spam protection (no-ops until TURNSTILE_SECRET_KEY is set).
        const ip = request.headers.get("CF-Connecting-IP") || "";
        if (!(await verifyTurnstile(env, turnstile_token, ip))) return json({ error: "Spam check failed — please try again." }, 400, request, env);
        if (!first_name || !last_name || !business || !email || !message)
          return json({ error: "Please complete all required fields." }, 400, request, env);
        const fullName = `${first_name} ${last_name}`.trim();

        // Signed-in members are identified by their session token — the enquiry
        // links straight to their account, no password prompt needed.
        const authedUser = await getUser(request, env);

        // Optional account creation (password is optional on this form).
        let accountUserId = authedUser ? authedUser.id : null, accountCreated = false;
        if (!authedUser && password) {
          if (!smmPasswordOk(password)) return json({ error: "Password must be at least 8 characters and include a number and a special character." }, 400, request, env);
          try {
            const cr = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
              method: "POST",
              headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json" },
              body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName, company: business || null, phone: phone || null } }),
            });
            if (cr.ok) { const u = await cr.json(); accountUserId = (u && u.id) || null; accountCreated = true; }
            else {
              const u = await findUserByEmail(env, email);
              if (u) accountUserId = u.id;
            }
          } catch (_) { /* account is best-effort; the enquiry still saves */ }
        }

        // Persist the lead — merged onto the existing card if this email is known.
        const up = await upsertSmmLead(env, email, {
          kind: "enquiry", tag: "General Enquiry", stage: "general_enquiry",
          first_name, last_name, full_name: fullName, email, phone: phone || null,
          business: business || null, message: message || null,
          marketing_opt_in: !!marketing_opt_in,
          account_user_id: accountUserId, account_created: accountCreated,
        });
        if (!up.id) {
          console.error("smm enquiry upsert failed", up.error || "");
          return json({ error: "We couldn't save your message just then — please try again, or email hello@tmke.co.uk." }, 502, request, env);
        }
        const smmEnquiryId = up.id;
        await logBookingMessage(env, { booking_id: smmEnquiryId, booking_source: "smm", account_user_id: accountUserId, client_email: email, channel: "note", kind: "note", body: `Submitted a general enquiry${message ? `: ${message}` : "."}` });

        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Auto-acknowledgement to the sender — ALWAYS (per brief).
        await sendEmail(env, {
          to: email, subject: "Thanks — we've got your message",
          html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22">
            <h1 style="font-size:22px;margin:0 0 6px">Thanks, ${esc(first_name)} — message received</h1>
            <p style="color:#555;font-size:14px;margin:0 0 18px">We've received your enquiry and a member of the TMKE team will be in touch within one working day.</p>
            ${message ? `<div style="background:#f4f2f1;border-left:3px solid #371e28;border-radius:4px;padding:14px 16px;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(message)}</div>` : ""}
            ${accountCreated ? `<p style="color:#555;font-size:14px;margin:18px 0 0">We've also created your TMKE account — sign in any time at <a href="https://tmke.co.uk/login" style="color:#371e28">tmke.co.uk/login</a>.</p>` : ""}
            <p style="font-size:12px;color:#999;margin:24px 0 0">Sent by TMKE &middot; <a href="https://tmke.co.uk/services" style="color:#371e28">tmke.co.uk</a></p></div>`,
        });
        await logBookingMessage(env, {
          booking_id: smmEnquiryId, booking_source: "smm",
          account_user_id: accountUserId, client_email: email,
          kind: "confirmation", subject: "Thanks — we've got your message",
          body: `Auto-acknowledgement sent: we've received ${first_name}'s enquiry and will be in touch within one working day.`,
        });

        // Notify the SMM team.
        await sendEmail(env, {
          to: env.SMM_NOTIFY || env.MAIL_SENDER || env.JACK_NOTIFY, subject: `New enquiry — Social Media — ${fullName}`,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22">
            <h1 style="font-size:20px;margin:0 0 6px">New Social Media enquiry</h1>
            <div style="background:#f4f2f1;border-left:3px solid #371e28;border-radius:4px;padding:16px 18px;font-size:14px;line-height:1.9">
              <div><span style="color:#888">Name:</span> ${esc(fullName)}</div>
              <div><span style="color:#888">Business:</span> ${esc(business)}</div>
              <div><span style="color:#888">Email:</span> ${esc(email)}</div>
              ${phone ? `<div><span style="color:#888">Phone:</span> ${esc(phone)}</div>` : ""}
              <div><span style="color:#888">Message:</span> ${esc(message)}</div>
              <div><span style="color:#888">Marketing:</span> ${marketing_opt_in ? "Opted in" : "No"}</div>
              <div><span style="color:#888">Account:</span> ${accountCreated ? "Created" : (accountUserId ? "Existing" : "None")}</div>
            </div>
            <p style="font-size:12px;color:#999;margin:18px 0 0">In the SMM pipeline as a lead (general_enquiry).</p></div>`,
        });

        // CRM + automations: upsert the contact + fire any "form submitted" flow.
        try {
          await fireTrigger(env, "form_submitted", {
            email, first_name, last_name, phone: phone || null, company: business || null,
            source: "smm_enquiry", lifecycle: "lead", marketing_opt_in: !!marketing_opt_in,
            tags: crmTags(email, "Interest: SMM", { optIn: !!marketing_opt_in, member: !!(accountUserId || accountCreated) }), user_id: accountUserId || null,
          }, { form: "smm_enquiry", tag: "General Enquiry" });
        } catch (_) {}

        return json({ ok: true, account_created: accountCreated }, 200, request, env);
      }

      // ---- Social Media — Download a Brochure (Form 1): emails the brochure,
      //      stores the email as a lead, optional account. Brochure goes out on
      //      EVERY submit regardless of account creation. ---------------------
      if (path.endsWith("/smm/brochure") && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const { full_name, email, password, marketing_opt_in, turnstile_token, hp } = b || {};
        if (hp) return json({ ok: true }, 200, request, env);
        const ip = request.headers.get("CF-Connecting-IP") || "";
        if (!(await verifyTurnstile(env, turnstile_token, ip))) return json({ error: "Spam check failed — please try again." }, 400, request, env);
        if (!full_name || !email) return json({ error: "Please add your name and email." }, 400, request, env);

        // Optional account creation (password is optional on this form).
        let accountUserId = null, accountCreated = false;
        if (password) {
          if (!smmPasswordOk(password)) return json({ error: "Password must be at least 8 characters and include a number and a special character." }, 400, request, env);
          try {
            const cr = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
              method: "POST",
              headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json" },
              body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name } }),
            });
            if (cr.ok) { const u = await cr.json(); accountUserId = (u && u.id) || null; accountCreated = true; }
            else {
              const u = await findUserByEmail(env, email);
              if (u) accountUserId = u.id;
            }
          } catch (_) { /* account is best-effort; the brochure still sends */ }
        }

        const up = await upsertSmmLead(env, email, {
          kind: "brochure", tag: "Brochure Download", stage: "brochure_downloaded", brochure_sent: true,
          full_name, email, marketing_opt_in: !!marketing_opt_in,
          account_user_id: accountUserId, account_created: accountCreated,
        });
        if (!up.id) {
          console.error("smm brochure upsert failed", up.error || "");
          return json({ error: "We couldn't process that just then — please try again, or email hello@tmke.co.uk." }, 502, request, env);
        }
        const smmBrochureId = up.id;
        await logBookingMessage(env, { booking_id: smmBrochureId, booking_source: "smm", account_user_id: accountUserId, client_email: email, channel: "note", kind: "note", body: "Downloaded the social media brochure." });

        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const brochureUrl = env.SMM_BROCHURE_URL || "https://assets.tmke.co.uk/tmke-smm-brochure.pdf";
        const firstName = String(full_name).trim().split(/\s+/)[0] || "there";

        // Email the brochure (a link — works the moment the PDF is uploaded).
        await sendEmail(env, {
          to: email, subject: "Your TMKE social media brochure",
          html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22">
            <h1 style="font-size:22px;margin:0 0 6px">Here's your brochure, ${esc(firstName)}</h1>
            <p style="color:#555;font-size:14px;margin:0 0 22px">Thanks for your interest in TMKE social media management. Everything's in the brochure below — what's included, how it works, and what it costs.</p>
            <p style="margin:0 0 22px"><a href="${esc(brochureUrl)}" style="display:inline-block;background:#1c1d22;color:#fff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:14px 26px;border-radius:6px">Download the brochure &rarr;</a></p>
            ${accountCreated ? `<p style="color:#555;font-size:14px;margin:0 0 6px">We've also created your TMKE account so you can manage your downloads and bookings in one place — sign in any time at <a href="https://tmke.co.uk/login" style="color:#371e28">tmke.co.uk/login</a>.</p>` : ""}
            <p style="font-size:12px;color:#999;margin:24px 0 0">Sent by TMKE &middot; <a href="https://tmke.co.uk/services" style="color:#371e28">tmke.co.uk</a></p></div>`,
        });
        await logBookingMessage(env, {
          booking_id: smmBrochureId, booking_source: "smm",
          account_user_id: accountUserId, client_email: email,
          kind: "confirmation", subject: "Your TMKE social media brochure",
          body: `Brochure sent to ${firstName}. Link: ${brochureUrl}`,
        });

        // CRM + automations: upsert the contact + fire any "form submitted" flow.
        try {
          const bparts = String(full_name).trim().split(/\s+/);
          await fireTrigger(env, "form_submitted", {
            email, first_name: bparts.shift() || full_name, last_name: bparts.join(" ") || null,
            source: "smm_brochure", lifecycle: "lead", marketing_opt_in: !!marketing_opt_in,
            tags: crmTags(email, "Interest: SMM", { optIn: !!marketing_opt_in, member: !!(accountUserId || accountCreated) }), user_id: accountUserId || null,
          }, { form: "smm_brochure", tag: "Brochure Download" });
        } catch (_) {}

        return json({ ok: true, account_created: accountCreated, brochure_url: brochureUrl }, 200, request, env);
      }

      // ---- Social Media — Discovery-call availability (Form 2). Slots for the
      //      SMM account manager's diary (SMM_MANAGER_UPN). Reuses the shared
      //      working-hours in videography_availability. Gated until the manager
      //      mailbox is set. -----------------------------------------------------
      if (path.endsWith("/smm/availability") && request.method === "GET") {
        const cal = env.SMM_MANAGER_UPN;
        if (!cal) return json({ slots: [], not_configured: true }, 200, request, env);
        const date = url.searchParams.get("date");
        const duration = parseInt(url.searchParams.get("duration") || "30", 10);
        if (!date) return json({ error: "Missing date" }, 400, request, env);
        const wd = new Date(date + "T12:00:00Z").getUTCDay();
        const rows = (await sbGet(env, "videography_availability", `weekday=eq.${wd}&select=*`)) || [];
        const hours = rowHours(rows[0]);
        if (!hours.length) return json({ slots: [], duration }, 200, request, env);
        const STEP = 30;
        const openHours = new Set(hours);
        const dayStartMin = Math.min(...hours) * 60;
        const dayEndMin = (Math.max(...hours) + 1) * 60;
        const need = Math.max(1, Math.ceil(duration / STEP));
        const sched = await graph(env, "POST", `/users/${encodeURIComponent(cal)}/calendar/getSchedule`, {
          schedules: [cal],
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

      // ---- Social Media — Book a Discovery Call (Form 2). Mandatory account.
      //      Books the SMM manager's calendar, stores the lead, confirms by
      //      email with an ICS. ------------------------------------------------
      if (path.endsWith("/smm/discovery") && request.method === "POST") {
        const cal = env.SMM_MANAGER_UPN;
        if (!cal) return json({ error: "Discovery call booking is being set up — please check back shortly." }, 503, request, env);
        const b = await request.json().catch(() => ({}));
        const { first_name, last_name, business, email, phone, password, marketing_opt_in, date, start, duration, turnstile_token, hp } = b || {};
        if (hp) return json({ ok: true }, 200, request, env);
        const ip = request.headers.get("CF-Connecting-IP") || "";
        if (!(await verifyTurnstile(env, turnstile_token, ip))) return json({ error: "Spam check failed — please try again." }, 400, request, env);
        if (!first_name || !last_name || !business || !email || !date || !start) return json({ error: "Please complete all required fields and pick a time." }, 400, request, env);
        // Signed-in members are identified by their session token and book
        // straight onto their existing account; everyone else must set a
        // password (account creation is part of booking a call).
        const authedUser = await getUser(request, env);
        if (!authedUser && (!password || !smmPasswordOk(password))) return json({ error: "A password of at least 8 characters including a number and a special character is required." }, 400, request, env);
        const fullName = `${first_name} ${last_name}`.trim();
        const dur = parseInt(duration || "30", 10);
        const endHm = minToHm(hmToMin(start) + dur);

        // Slot still free?
        const check = await graph(env, "POST", `/users/${encodeURIComponent(cal)}/calendar/getSchedule`, {
          schedules: [cal],
          startTime: { dateTime: `${date}T${start}:00`, timeZone: "Europe/London" },
          endTime: { dateTime: `${date}T${endHm}:00`, timeZone: "Europe/London" },
          availabilityViewInterval: Math.max(15, dur),
        });
        const view = (check.value && check.value[0] && check.value[0].availabilityView) || "";
        if (view && /[^0]/.test(view)) return json({ error: "That time was just taken — please choose another." }, 409, request, env);

        // Account creation is mandatory at this step (signed-in members already
        // have one — their verified id is used directly).
        let accountUserId = authedUser ? authedUser.id : null, accountCreated = false;
        if (!authedUser) try {
          const cr = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
            method: "POST",
            headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName, company: business || null, phone: phone || null } }),
          });
          if (cr.ok) { const u = await cr.json(); accountUserId = (u && u.id) || null; accountCreated = true; }
          else {
            const u = await findUserByEmail(env, email);
            if (u) accountUserId = u.id;
          }
        } catch (_) { /* account is best-effort; the booking still proceeds */ }

        const ev = await graph(env, "POST", `/users/${encodeURIComponent(cal)}/events`, {
          subject: `Discovery Call — ${fullName}`,
          body: { contentType: "text", content: [business && `Business: ${business}`, phone && `Phone: ${phone}`].filter(Boolean).join("\n") },
          start: { dateTime: `${date}T${start}:00`, timeZone: "Europe/London" },
          end: { dateTime: `${date}T${endHm}:00`, timeZone: "Europe/London" },
          attendees: [
            { emailAddress: { address: email, name: fullName }, type: "required" },
            // The SMM manager (Abigail) — gets the invite in her own calendar even
            // though her mailbox is on a different tenant. Skipped if it equals the
            // host mailbox (avoids inviting hello@ to its own event).
            ...(env.SMM_NOTIFY && env.SMM_NOTIFY.toLowerCase() !== cal.toLowerCase()
              ? [{ emailAddress: { address: env.SMM_NOTIFY, name: "TMKE Social Media" }, type: "required" }] : []),
          ],
          isOnlineMeeting: true,
        });
        const token = (crypto.randomUUID && crypto.randomUUID()) || `${date}-${start}`;

        const up = await upsertSmmLead(env, email, {
          kind: "discovery", tag: "Discovery Call", stage: "discovery_call_booked",
          first_name, last_name, full_name: fullName, email, phone: phone || null, business: business || null,
          call_at: `${date}T${start}:00`, duration_min: dur, reschedule_token: token, ms_event_id: ev.id || null,
          marketing_opt_in: !!marketing_opt_in, account_user_id: accountUserId, account_created: accountCreated,
        });
        const smmDiscoveryId = up.id;
        if (!smmDiscoveryId) console.error("smm discovery upsert failed", up.error || "");  // calendar event still created — don't fake failure

        const dateNice = (() => { try { return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch (_) { return date; } })();
        const ics = buildICS({ uid: `${ev.id || token}@tmke.co.uk`, date, start, endHm, summary: "Discovery Call — TMKE Social Media", description: "A call with TMKE to talk through your social media.", location: "Online / phone", organizer: cal, attendeeEmail: email, attendeeName: fullName });
        const icsB64 = bufToBase64(new TextEncoder().encode(ics).buffer);
        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        await sendEmail(env, {
          to: email, subject: `Your call is booked — ${dateNice}`,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22">
            <h1 style="font-size:22px;margin:0 0 6px">Your call is booked</h1>
            <p style="color:#555;font-size:14px;margin:0 0 18px">Hi ${esc(first_name)}, your call with the TMKE team is confirmed for <strong>${esc(dateNice)} at ${esc(start)}</strong>. We've attached a calendar invite &mdash; no prep needed, just bring your questions.</p>
            ${accountCreated ? `<p style="color:#555;font-size:14px;margin:0 0 8px">We've created your TMKE account so your call details, documents, and future bookings live in one place — sign in any time at <a href="https://tmke.co.uk/login" style="color:#371e28">tmke.co.uk/login</a>.</p>` : ""}
            <p style="font-size:13px;color:#555;margin:0 0 8px">Need to change it? Just reply to this email or contact <a href="mailto:hello@tmke.co.uk" style="color:#371e28">hello@tmke.co.uk</a>.</p>
            <p style="font-size:12px;color:#999;margin:24px 0 0">Sent by TMKE &middot; <a href="https://tmke.co.uk/services" style="color:#371e28">tmke.co.uk</a></p></div>`,
          attachments: [{ filename: "discovery-call.ics", content: icsB64, contentType: "text/calendar" }],
        });
        await logBookingMessage(env, {
          booking_id: smmDiscoveryId, booking_source: "smm",
          account_user_id: accountUserId, client_email: email,
          kind: "confirmation", subject: `Your call is booked — ${dateNice}`,
          body: `Your social media discovery call is booked for ${dateNice} at ${start}. It's an online/phone call — no prep needed, just bring your questions.`,
        });
        await sendEmail(env, {
          to: env.SMM_NOTIFY || env.MAIL_SENDER || env.JACK_NOTIFY, subject: `New discovery call — Social Media — ${fullName} — ${dateNice} ${start}`,
          html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22">
            <h1 style="font-size:20px;margin:0 0 6px">Discovery call booked (Social Media)</h1>
            <div style="background:#f4f2f1;border-left:3px solid #371e28;border-radius:4px;padding:16px 18px;font-size:14px;line-height:1.9">
              <div><span style="color:#888">Client:</span> ${esc(fullName)}</div>
              <div><span style="color:#888">Business:</span> ${esc(business)}</div>
              <div><span style="color:#888">Email:</span> ${esc(email)}</div>
              ${phone ? `<div><span style="color:#888">Phone:</span> ${esc(phone)}</div>` : ""}
              <div><span style="color:#888">When:</span> ${esc(dateNice)} at ${esc(start)}</div>
            </div></div>`,
        });
        // CRM + automations: upsert the contact + fire form-submitted (and
        // account-created, since a booking always makes an account).
        try {
          await fireTrigger(env, "form_submitted", {
            email, first_name, last_name, phone: phone || null, company: business || null,
            source: "smm_discovery", lifecycle: "lead", marketing_opt_in: !!marketing_opt_in,
            tags: crmTags(email, ["Interest: SMM", "Discovery-Call-Booked: SMM"], { optIn: !!marketing_opt_in, member: !!(accountUserId || accountCreated) }), user_id: accountUserId || null,
          }, { form: "smm_discovery", tag: "Discovery Call" });
          if (accountCreated) await fireTrigger(env, "account_created", {
            email, first_name, last_name, company: business || null, user_id: accountUserId || null, lifecycle: "lead",
          }, { form: "smm_discovery" });
        } catch (_) {}
        return json({ ok: true, account_created: accountCreated, eventId: ev.id }, 200, request, env);
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
        try {
          await fireTrigger(env, "form_submitted", {
            email, source: "videography_register_interest", lifecycle: "lead",
            marketing_opt_in: optin, tags: crmTags(email, "Interest: Videography", { optIn: optin }),
          }, { form: "videography_register_interest" });
        } catch (_) {}
        return json({ ok: true }, 200, request, env);
      }

      // ---- Videography — Download a Brochure: emails the videography brochure,
      //      stores the lead, optional account creation (password only offered to
      //      people who don't already have a TMKE account — the form checks
      //      /videography/account-exists first). Brochure goes out on EVERY
      //      submit regardless of account creation. ----------------------------
      if (path.endsWith("/videography/brochure") && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const { full_name, email, password, marketing_opt_in, hp } = b || {};
        if (hp) return json({ ok: true }, 200, request, env);
        if (!full_name || !email) return json({ error: "Please add your name and email." }, 400, request, env);

        // Optional account creation (password is optional; the form only shows
        // it to people who don't yet have an account).
        let accountUserId = null, accountCreated = false;
        if (password) {
          if (!smmPasswordOk(password)) return json({ error: "Password must be at least 8 characters and include a number and a special character." }, 400, request, env);
          try {
            const cr = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
              method: "POST",
              headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json" },
              body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name } }),
            });
            if (cr.ok) { const u = await cr.json(); accountUserId = (u && u.id) || null; accountCreated = true; }
            else {
              const u = await findUserByEmail(env, email);
              if (u) accountUserId = u.id;
            }
          } catch (_) { /* account is best-effort; the brochure still sends */ }
        }

        // NB videography_bookings has no account_created column — sending it
        // makes PostgREST reject the whole insert.
        await sbPost(env, "videography_bookings", {
          kind: "brochure", service_type: "brochure", audience: accountUserId ? "member" : "non-member",
          client_email: email, client_name: full_name, service: "Videography Brochure",
          stage: "brochure_downloaded", notes: "Brochure download", marketing_opt_in: !!marketing_opt_in,
          account_user_id: accountUserId,
        });

        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const brochureUrl = env.VIDEOGRAPHY_BROCHURE_URL || "https://assets.tmke.co.uk/TMKE%20-%20Videography%20Services.pdf";
        const firstName = String(full_name).trim().split(/\s+/)[0] || "there";

        // Email the brochure (a link — works the moment the PDF is uploaded).
        await sendEmail(env, {
          to: email, subject: "Your TMKE videography brochure",
          html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22">
            <h1 style="font-size:22px;margin:0 0 6px">Here's your brochure, ${esc(firstName)}</h1>
            <p style="color:#555;font-size:14px;margin:0 0 22px">Thanks for your interest in TMKE videography. Everything's in the brochure below — what's included, how it works, and what it costs.</p>
            <p style="margin:0 0 22px"><a href="${esc(brochureUrl)}" style="display:inline-block;background:#1c1d22;color:#fff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:14px 26px;border-radius:6px">Download the brochure &rarr;</a></p>
            ${accountCreated ? `<p style="color:#555;font-size:14px;margin:0 0 6px">We've also created your TMKE account so you can manage your downloads and bookings in one place — sign in any time at <a href="https://tmke.co.uk/login" style="color:#371e28">tmke.co.uk/login</a>.</p>` : ""}
            <p style="font-size:12px;color:#999;margin:24px 0 0">Sent by TMKE &middot; <a href="https://tmke.co.uk/videography" style="color:#371e28">tmke.co.uk</a></p></div>`,
        });

        // CRM + automations: upsert the contact + fire any "form submitted" flow.
        try {
          const bparts = String(full_name).trim().split(/\s+/);
          await fireTrigger(env, "form_submitted", {
            email, first_name: bparts.shift() || full_name, last_name: bparts.join(" ") || null,
            source: "videography_brochure", lifecycle: "lead", marketing_opt_in: !!marketing_opt_in,
            tags: crmTags(email, "Interest: Videography", { optIn: !!marketing_opt_in, member: !!accountUserId }), user_id: accountUserId || null,
          }, { form: "videography_brochure", tag: "Brochure Download" });
        } catch (_) {}

        return json({ ok: true, account_created: accountCreated, brochure_url: brochureUrl }, 200, request, env);
      }

      // ---- Does this email already have a TMKE account? (booking gate) -------
      if (path.endsWith("/videography/account-exists") && request.method === "GET") {
        const email = (url.searchParams.get("email") || "").trim().toLowerCase();
        if (!email) return json({ exists: false }, 200, request, env);
        const u = await findUserByEmail(env, email);
        return json({ exists: !!u }, 200, request, env);
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

      // ---- Automations: fire a trigger (enrol a contact) --------------------
      // Called by trusted, signed-in surfaces (e.g. admin records an order, a new
      // customer signs up). Requires a valid session so it can't be spammed.
      if (path.endsWith("/automations/fire") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user) return json({ error: "Unauthorised" }, 401, request, env);
        const b = await request.json().catch(() => ({}));
        if (!b || !b.trigger || !b.email) return json({ error: "Need a trigger and email." }, 400, request, env);
        const r = await fireTrigger(env, b.trigger, {
          email: b.email, first_name: b.first_name, last_name: b.last_name,
          phone: b.phone, company: b.company, source: b.source,
          lifecycle: b.lifecycle, marketing_opt_in: b.marketing_opt_in, tags: b.tags, user_id: b.user_id,
        }, b.payload || {});
        return json(r, 200, request, env);
      }

      // ---- Automations: manual tick (admin testing; cron runs it normally) ---
      if (path.endsWith("/automations/tick") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Unauthorised" }, 401, request, env);
        const n = await runAutomationsTick(env);
        return json({ ok: true, processed: n }, 200, request, env);
      }

      // ---- Automations: inbound email webhook -------------------------------
      // Point an inbound email provider (Cloudflare Email Routing → Worker, or
      // Resend/Mailgun inbound) at this URL. It fires the "inbound_email" trigger
      // for the sender. If AUTOMATIONS_INBOUND_SECRET is set, the provider must
      // pass ?secret=… (wrangler secret put AUTOMATIONS_INBOUND_SECRET).
      if (path.endsWith("/automations/inbound") && request.method === "POST") {
        if (env.AUTOMATIONS_INBOUND_SECRET && url.searchParams.get("secret") !== env.AUTOMATIONS_INBOUND_SECRET) {
          return json({ error: "Unauthorised" }, 401, request, env);
        }
        const b = await request.json().catch(() => ({}));
        const fromRaw = b.from || b.sender || (b.envelope && b.envelope.from) || "";
        const m = /<([^>]+)>/.exec(String(fromRaw));     // strip "Name <email>"
        const email = (m ? m[1] : String(fromRaw)).trim().toLowerCase();
        if (!email) return json({ error: "No sender address" }, 400, request, env);
        const r = await fireTrigger(env, "inbound_email", { email, source: "inbound_email" }, { subject: b.subject || null });
        return json(r, 200, request, env);
      }

      // ---- Discovery call — books a short call + a CRM lead ------------------
      if (path.endsWith("/videography/discovery") && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const { date, start, duration, interests, name, email, phone, company, message, password, marketing_opt_in } = b || {};
        if (!date || !start || !name || !email) return json({ error: "Missing call details" }, 400, request, env);
        // Account treatment mirrors /smm/discovery: a verified session token
        // books straight onto the member's account; everyone else sets a
        // password (account-at-booking).
        const authedUser = await getUser(request, env);
        if (!authedUser && (!password || !smmPasswordOk(password))) return json({ error: "A password of at least 8 characters including a number and a special character is required." }, 400, request, env);
        let accountUserId = authedUser ? authedUser.id : null, accountCreated = false;
        if (!authedUser) try {
          const cr = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
            method: "POST",
            headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: name, company: company || null, phone: phone || null } }),
          });
          if (cr.ok) { const u = await cr.json(); accountUserId = (u && u.id) || null; accountCreated = true; }
          else {
            const u = await findUserByEmail(env, email);
            if (u) accountUserId = u.id;
          }
        } catch (_) { /* account is best-effort; the call still books */ }
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
        let discoveryId = null;
        try {
          const insRes = await sbPost(env, "videography_bookings", {
            kind: "discovery", service_type: "discovery", client_name: name, client_email: email,
            client_phone: phone || null, company: company || null, service: "Discovery Call",
            shoot_date: `${date}T${start}:00`, stage: "discovery_call_booked",
            discovery_interests: interestList, notes: message || null, reschedule_token: token, ms_event_id: ev.id || null, duration_min: dur,
            account_user_id: accountUserId, marketing_opt_in: !!marketing_opt_in,
          }, "return=representation");
          const arr = await insRes.json();
          discoveryId = Array.isArray(arr) && arr[0] ? arr[0].id : null;
        } catch (_) {}
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
        await logBookingMessage(env, {
          booking_id: discoveryId, booking_source: "videography",
          account_user_id: accountUserId, client_email: email,
          kind: "confirmation", subject: `Your discovery call is booked — ${dateNice}`,
          body: `Your discovery call with Jack is confirmed for ${dateNice} at ${start}. It's an online/phone call — no prep needed, just bring your questions.`,
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
        // CRM: upsert the contact (this endpoint previously skipped it).
        try {
          const parts = String(name || "").trim().split(/\s+/);
          const ci = { email, first_name: parts.shift() || name, last_name: parts.join(" ") || null,
            phone: phone || null, company: company || null, source: "videography_discovery",
            lifecycle: "lead", marketing_opt_in: !!marketing_opt_in,
            tags: crmTags(email, ["Interest: Videography", "Discovery-Call-Booked: Videography"], { optIn: !!marketing_opt_in, member: !!(accountUserId || accountCreated) }), user_id: accountUserId || null };
          await fireTrigger(env, "form_submitted", ci, { form: "videography_discovery", tag: "Discovery Call" });
          if (accountCreated) await fireTrigger(env, "account_created", ci, { form: "videography_discovery" });
        } catch (_) {}
        return json({ ok: true, eventId: ev.id, account_created: accountCreated }, 200, request, env);
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
        await logBookingMessage(env, {
          booking_id: bk.id, booking_source: "videography", account_user_id: bk.account_user_id, client_email: bk.client_email,
          kind: "cancellation", subject: `Booking cancelled — ${bk.service || "TMKE"}`,
          body: `Your ${bk.service || "booking"} has been cancelled. If this was a mistake or you'd like to rebook, head to tmke.co.uk/videography.`,
        });
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
        await logBookingMessage(env, {
          booking_id: bk.id, booking_source: "videography", account_user_id: bk.account_user_id, client_email: bk.client_email,
          kind: "reschedule", subject: `Booking rescheduled — ${dateNice}`,
          body: `Your ${bk.service || "booking"} has moved to ${dateNice} at ${start}. An updated calendar invite is on its way.`,
        });
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
      // ---- Public: newsletter / subscribe (NO auth — anonymous visitors) -----
      // Must live in this pre-auth block: the homepage + videography subscribe
      // boxes POST here with no session token, so it can't sit behind the login
      // gate below (that silently 401'd every signup and dropped the contact).
      if (path.endsWith("/newsletter") && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        if (b && b.hp) return json({ ok: true }, 200, request, env); // honeypot
        const email = String((b && b.email) || "").trim();
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Please add a valid email." }, 400, request, env);
        const name = String((b && b.name) || "").trim();
        const parts = name.split(/\s+/).filter(Boolean);
        try {
          await fireTrigger(env, "form_submitted", {
            email, first_name: parts.shift() || null, last_name: parts.join(" ") || null,
            source: "newsletter", lifecycle: "lead", marketing_opt_in: true,
            tags: crmTags(email, [], { optIn: true }),
          }, { form: "newsletter" });
        } catch (_) {}
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
      // ---- Admin: preview an automated email (renders the REAL builder with
      // sample data — read-only, changes nothing that sends). ------------------
      if (path.endsWith("/email/preview") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const id = url.searchParams.get("id") || "";
        const SAMPLES = {
          post_reminder: () => ({ subject: "Your Instagram post is planned for today", html: reminderHtml({ title: "Spring launch teaser", asset_url: "https://assets.tmke.co.uk/white-1.webp" }, "Instagram", "New season, new listings ✨\n\nSwipe to see what's just come to market — book a viewing before they're gone.") }),
          setup_reminder: () => ({ subject: "Set your password to unlock your TMKE pack", html: setupReminderHtml({ name: "Alex Morgan", pack: "The Spring Collection", link: "https://tmke.co.uk/set-password?token=sample" }) }),
          waitlist_register: () => ({ subject: "You're on the cancellation list — The Studio", html: waitlistHtml({ name: "Alex Morgan", service: "The Studio", pkg: "Half day", date: "2026-08-25", time: "10:00" }) }),
          vid_booking_client: () => ({ subject: "Booking confirmed — Property Videography", html: bookingConfirmHtml({ name: "Alex Morgan", service: "Property Videography", serviceType: "property", packageLabel: "Premium", dateNice: "Tuesday, 25 August 2026", time: "10:00", addOns: ["Drone footage"], postcode: "NN14 1AA", surchargePence: 0, totalPence: 60000, manageUrl: "https://tmke.co.uk/manage?token=sample" }) }),
          vid_booking_team: () => ({ subject: "New booking — Property Videography — Alex Morgan", html: jackNotifyHtml({ name: "Alex Morgan", company: "Acme Estates", email: "alex@example.com", phone: "07700 900123", service: "Property Videography", packageLabel: "Premium", addOns: ["Drone footage"], postcode: "NN14 1AA", distanceMiles: 12, surchargePence: 0, dateNice: "Tuesday, 25 August 2026", time: "10:00", totalPence: 60000, signedName: "Jack", marketingOptIn: true }) }),
          invoice_sent: () => ({ subject: "Invoice TMKE1001 from The Marketing Experts (Nationwide) Ltd", html: invoiceEmailHtml({ company_name: "The Marketing Experts (Nationwide) Ltd", email_footer_image_url: null }, { number: "TMKE1001", bill_to_name: "Fine & Country", total_pence: 75000, due_date: "2026-08-31" }, null) }),
          invoice_dd_reminder: () => ({ subject: "Direct Debit invoice TMKE1002 — Acme Estates (August 2026)", html: ddReminderHtml("Acme Estates", "August 2026", { number: "TMKE1002", total_pence: 90000, due_date: "2026-08-15" }) }),
        };
        const fn = SAMPLES[id];
        if (!fn) return json({ ok: true, supported: false }, 200, request, env);
        try {
          const out = fn();
          let html = out.html;
          // ?branded=1 → wrap the email in the active "Branded base" template.
          if (url.searchParams.get("branded") === "1") html = await wrapInBrandedBase(env, html);
          return json({ ok: true, supported: true, subject: out.subject, html }, 200, request, env);
        } catch (e) { return json({ ok: false, error: String((e && e.message) || e) }, 200, request, env); }
      }

      // for marketing/transactional sends generally. The caller is already a
      // valid Supabase user (gated below); we additionally require a TMKE admin
      // email so a signed-in customer can't drive the mailer. The verified
      // sender domain comes from MAIL_FROM — callers may only set a display name.
      if (path.endsWith("/email/send") && request.method === "POST") {
        const sender = await getUser(request, env);
        if (!isAdminEmail(sender)) return json({ error: "Admins only." }, 403, request, env);
        let body;
        try { body = await request.json(); } catch (_) { return json({ error: "Bad JSON" }, 400, request, env); }
        const toRaw = body && body.to;
        const to = (Array.isArray(toRaw) ? toRaw : [toRaw])
          .map((x) => String(x || "").trim()).filter(Boolean).slice(0, 50);
        const subject = String((body && body.subject) || "").replace(/[\r\n]+/g, " ").slice(0, 300);
        const html = String((body && body.html) || "");
        if (!to.length) return json({ error: "No recipient address." }, 400, request, env);
        if (!html) return json({ error: "Nothing to send." }, 400, request, env);
        const fromName = body && body.fromName ? String(body.fromName).replace(/[<>\r\n]/g, "").trim().slice(0, 80) : "";
        // Send via Microsoft 365 (MAIL_SENDER = hello@tmke.co.uk) — the SAME pipeline
        // the automated/transactional emails use, so a Studio test matches the real
        // send and isn't limited to your own address (as the Resend sandbox is until
        // its domain is verified).
        const result = await sendEmail(env, { to, subject, html, fromName: fromName || undefined });
        if (!result.ok) return json({ error: result.error || "Send failed." }, 502, request, env);
        return json({ ok: true }, 200, request, env);
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

      // ============================================================
      // Booking correspondence + documents (member portal + admin)
      // ============================================================

      // ---- Admin: post a manual message to a booking (optionally email it) ----
      if (path.endsWith("/booking/message") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const bookingId = b && b.booking_id;
        const source = b && b.source === "smm" ? "smm" : "videography";
        const bodyText = b && b.body;
        if (!bookingId || !bodyText) return json({ error: "Missing booking or message." }, 400, request, env);
        const bk = await lookupBooking(env, source, bookingId);
        if (!bk) return json({ error: "Booking not found." }, 404, request, env);
        await logBookingMessage(env, {
          booking_id: bookingId, booking_source: source,
          account_user_id: bk.account_user_id, client_email: bk.email,
          channel: b.notify ? "email" : "note", kind: "manual", subject: b.subject || null,
          body: bodyText, is_automated: false, created_by: user.email || "admin",
        });
        if (b.notify && bk.email) {
          const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          // Attach a booking document to the email when one was sent with the message.
          let attachments;
          if (b.document_id) {
            try {
              const drows = await sbGet(env, "booking_documents", `id=eq.${encodeURIComponent(b.document_id)}&select=r2_key,file_name,content_type`);
              const d = drows && drows[0];
              if (d && d.r2_key) {
                const obj = await env.BUCKET.get(d.r2_key);
                if (obj) { const buf = await obj.arrayBuffer(); attachments = [{ filename: d.file_name || "attachment", content: bufToBase64(buf), contentType: d.content_type || "application/octet-stream" }]; }
              }
            } catch (_) {}
          }
          // SMM correspondence sends from the SMM manager's mailbox when one is
          // configured (SMM_MAIL_SENDER — Danielle's for now, Abby's later), so
          // replies land in her inbox; otherwise falls back to the TMKE mailbox.
          const smmFrom = source === "smm" ? env.SMM_MAIL_SENDER : null;
          const smmFromName = source === "smm" ? (env.SMM_MAIL_FROM_NAME || "TMKE Social Media") : null;
          try {
            await sendEmail(env, {
              to: bk.email, subject: b.subject || `A message about your ${bk.service || "booking"}`,
              html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22"><p style="color:#555;font-size:14px;margin:0 0 12px">Hi ${esc(bk.name || "")},</p><div style="font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(bodyText)}</div>${attachments ? `<p style="color:#888;font-size:12px;margin:14px 0 0">📎 A document is attached to this email.</p>` : ""}<p style="color:#888;font-size:12px;margin:18px 0 0">You can view this and manage your booking in your TMKE workspace.</p></div>`,
              attachments,
              from: smmFrom || undefined, fromName: smmFrom ? smmFromName : undefined,
            });
          } catch (_) {}
        }
        return json({ ok: true }, 200, request, env);
      }

      // ---- Admin: pin / unpin a thread note ----
      if (path.endsWith("/booking/message/pin") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const id = b && b.id;
        if (!id) return json({ error: "Missing id" }, 400, request, env);
        await fetch(`${env.SUPABASE_URL}/rest/v1/booking_messages?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ is_pinned: !!(b && b.pinned) }),
        });
        return json({ ok: true }, 200, request, env);
      }

      // ---- Admin: delete a thread note / message ----
      if (path.endsWith("/booking/message") && request.method === "DELETE") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const id = (url.searchParams.get("id") || "").trim();
        if (!id) return json({ error: "Missing id" }, 400, request, env);
        await fetch(`${env.SUPABASE_URL}/rest/v1/booking_messages?id=eq.${encodeURIComponent(id)}`, {
          method: "DELETE", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}` },
        });
        return json({ ok: true }, 200, request, env);
      }

      // ---- Admin: team access (who can use the admin centre) -----------------
      // Anyone on the @tmke.co.uk domain (or the named allowlist) is an admin via
      // SSO and never appears here. This manages the `admins` table — the way to
      // grant admin access to anyone OUTSIDE the domain, and to revoke it.

      // List everyone who's been granted admin access via the table.
      if (path.endsWith("/admin/team") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user || !isOwner(user)) return json({ error: "Only the account owner can manage admin access." }, 403, request, env);
        const rows = (await sbGet(env, "admins", "select=user_id,email,created_at&order=created_at.asc")) || [];
        const profs = (await sbGet(env, "admin_profiles", "select=user_id,full_name,role")) || [];
        const pm = {}; for (const p of profs) pm[p.user_id] = p;
        const admins = rows.map((r) => ({
          user_id: r.user_id, email: r.email, created_at: r.created_at,
          full_name: (pm[r.user_id] || {}).full_name || null, role: (pm[r.user_id] || {}).role || null,
        }));
        return json({ ok: true, admins, self: user.id }, 200, request, env);
      }

      // Grant admin access: create their login if new, add them to `admins`,
      // and email them how to sign in.
      if (path.endsWith("/admin/team") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isOwner(user)) return json({ error: "Only the account owner can manage admin access." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const email = String((b && b.email) || "").trim().toLowerCase();
        const fullName = String((b && b.full_name) || "").trim();
        const role = String((b && b.role) || "").trim() || "Admin";
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400, request, env);

        // Find or create the auth user.
        let u = await findUserByEmail(env, email);
        let tempPassword = null, created = false;
        if (!u) {
          tempPassword = genTempPassword();
          const cr = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
            method: "POST",
            headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: tempPassword, email_confirm: true, user_metadata: { full_name: fullName || null } }),
          });
          if (cr.ok) { u = await cr.json(); created = true; }
          else {
            u = await findUserByEmail(env, email);
            if (!u) { const t = await cr.text().catch(() => ""); return json({ error: "Couldn't create that login. " + t.slice(0, 160) }, 502, request, env); }
            tempPassword = null; // it existed after all — don't claim a new password
          }
        }
        if (!u || !u.id) return json({ error: "Couldn't resolve that account." }, 502, request, env);

        // Grant admin (idempotent upsert on the primary key).
        await fetch(`${env.SUPABASE_URL}/rest/v1/admins?on_conflict=user_id`, {
          method: "POST",
          headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ user_id: u.id, email }),
        });
        // Seed their admin profile name/role for a brand-new login (don't clobber existing).
        if (created && fullName) {
          await fetch(`${env.SUPABASE_URL}/rest/v1/admin_profiles?on_conflict=user_id`, {
            method: "POST",
            headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify({ user_id: u.id, full_name: fullName, role }),
          });
        }

        // Email them how to get in (best-effort — never fail the grant on send).
        const loginUrl = "https://tmke.co.uk/admin/login";
        const who = fullName ? fullName.split(" ")[0] : "there";
        const credLine = tempPassword
          ? `<p style="margin:0 0 6px;font-size:15px;color:#1c1d22;">Sign in with your email and this temporary password:</p>
             <p style="margin:0 0 18px;"><span style="display:inline-block;font-family:ui-monospace,Menlo,monospace;font-size:16px;font-weight:700;letter-spacing:0.04em;background:#f4f2f1;border:1px solid #e4ded9;border-radius:8px;padding:9px 14px;color:#371e28;">${tempPassword}</span></p>
             <p style="margin:0 0 18px;font-size:13.5px;color:#6b6b70;">Please change it once you're in (Forgot password on the sign-in screen).</p>`
          : `<p style="margin:0 0 18px;font-size:15px;color:#1c1d22;">Sign in with your existing email and password.</p>`;
        const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:8px 4px;">
          <div style="font-size:20px;font-weight:800;letter-spacing:0.14em;color:#371e28;margin:0 0 18px;">TMKE</div>
          <p style="margin:0 0 14px;font-size:15px;color:#1c1d22;">Hi ${who},</p>
          <p style="margin:0 0 14px;font-size:15px;color:#1c1d22;">You've been given access to the <strong>TMKE admin centre</strong>.</p>
          ${credLine}
          <p style="margin:0 0 22px;"><a href="${loginUrl}" style="display:inline-block;background:#371e28;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:9px;padding:12px 22px;">Open the admin centre</a></p>
          <p style="margin:0;font-size:12.5px;color:#9a9aa0;">If you weren't expecting this, you can ignore this email.</p>
        </div>`;
        try { await sendEmail(env, { to: email, subject: "Your TMKE admin access", html }); } catch (_) {}

        return json({ ok: true, created, temp_password: tempPassword, admin: { user_id: u.id, email, full_name: fullName || null, role } }, 200, request, env);
      }

      // Revoke admin access (removes their `admins` row; the login itself stays).
      if (path.endsWith("/admin/team") && request.method === "DELETE") {
        const user = await getUser(request, env);
        if (!user || !isOwner(user)) return json({ error: "Only the account owner can manage admin access." }, 403, request, env);
        const userId = (url.searchParams.get("user_id") || "").trim();
        if (!userId) return json({ error: "Missing user_id" }, 400, request, env);
        if (userId === user.id) return json({ error: "You can't remove your own access." }, 400, request, env);
        await fetch(`${env.SUPABASE_URL}/rest/v1/admins?user_id=eq.${encodeURIComponent(userId)}`, {
          method: "DELETE", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}` },
        });
        return json({ ok: true }, 200, request, env);
      }

      // Rename an admin (their display name across the admin). Upserts admin_profiles.
      if (path.endsWith("/admin/team") && request.method === "PATCH") {
        const user = await getUser(request, env);
        if (!user || !isOwner(user)) return json({ error: "Only the account owner can manage admin access." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const userId = String((b && b.user_id) || "").trim();
        const fullName = String((b && b.full_name) || "").trim();
        if (!userId) return json({ error: "Missing user_id" }, 400, request, env);
        if (!fullName) return json({ error: "Enter a name." }, 400, request, env);
        const row = { user_id: userId, full_name: fullName };
        if (b && typeof b.role === "string" && b.role.trim()) row.role = b.role.trim();
        await fetch(`${env.SUPABASE_URL}/rest/v1/admin_profiles?on_conflict=user_id`, {
          method: "POST",
          headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(row),
        });
        return json({ ok: true }, 200, request, env);
      }

      // Reset an admin's password: set a fresh temporary password and email it.
      if (path.endsWith("/admin/team/reset") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isOwner(user)) return json({ error: "Only the account owner can manage admin access." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const userId = String((b && b.user_id) || "").trim();
        if (!userId) return json({ error: "Missing user_id" }, 400, request, env);
        const email = await sbAdminUserEmail(env, userId);
        if (!email) return json({ error: "Couldn't find that account." }, 404, request, env);
        const tempPassword = genTempPassword();
        const up = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
          method: "PUT",
          headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json" },
          body: JSON.stringify({ password: tempPassword }),
        });
        if (!up.ok) { const t = await up.text().catch(() => ""); return json({ error: "Couldn't reset the password. " + t.slice(0, 160) }, 502, request, env); }

        let fullName = "";
        try { const p = await sbGet(env, "admin_profiles", `user_id=eq.${encodeURIComponent(userId)}&select=full_name`); fullName = (p && p[0] && p[0].full_name) || ""; } catch (_) {}
        const who = fullName ? fullName.split(" ")[0] : "there";
        const loginUrl = "https://tmke.co.uk/admin/login";
        const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:8px 4px;">
          <div style="font-size:20px;font-weight:800;letter-spacing:0.14em;color:#371e28;margin:0 0 18px;">TMKE</div>
          <p style="margin:0 0 14px;font-size:15px;color:#1c1d22;">Hi ${who},</p>
          <p style="margin:0 0 14px;font-size:15px;color:#1c1d22;">Your <strong>TMKE admin</strong> password has been reset. Your previous password no longer works.</p>
          <p style="margin:0 0 6px;font-size:15px;color:#1c1d22;">Sign in with your email and this temporary password:</p>
          <p style="margin:0 0 18px;"><span style="display:inline-block;font-family:ui-monospace,Menlo,monospace;font-size:16px;font-weight:700;letter-spacing:0.04em;background:#f4f2f1;border:1px solid #e4ded9;border-radius:8px;padding:9px 14px;color:#371e28;">${tempPassword}</span></p>
          <p style="margin:0 0 18px;font-size:13.5px;color:#6b6b70;">Please change it once you're in (Forgot password on the sign-in screen).</p>
          <p style="margin:0 0 22px;"><a href="${loginUrl}" style="display:inline-block;background:#371e28;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:9px;padding:12px 22px;">Open the admin centre</a></p>
          <p style="margin:0;font-size:12.5px;color:#9a9aa0;">If you didn't expect this, contact hello@tmke.co.uk.</p>
        </div>`;
        try { await sendEmail(env, { to: email, subject: "Your TMKE admin password has been reset", html }); } catch (_) {}

        return json({ ok: true, temp_password: tempPassword, email }, 200, request, env);
      }

      // ---- Admin: internal-agent (TEG) profile on a contact -------------------
      // Reads/writes the agent_profiles row for a contact. On save, when the
      // contact is a new starter on Academy/Pro and has no code yet, generates
      // their personalised 100% single-use free-videography code.
      if (path.endsWith("/agent/profile") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const cid = (url.searchParams.get("contact_id") || "").trim();
        if (!cid) return json({ error: "Missing contact_id" }, 400, request, env);
        const rows = await sbGet(env, "agent_profiles", `contact_id=eq.${encodeURIComponent(cid)}&select=*`);
        return json({ ok: true, profile: (rows && rows[0]) || null }, 200, request, env);
      }

      if (path.endsWith("/agent/profile") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const contactId = String((b && b.contact_id) || "").trim();
        if (!contactId) return json({ error: "Missing contact_id" }, 400, request, env);

        const cRows = await sbGet(env, "contacts", `id=eq.${encodeURIComponent(contactId)}&select=id,first_name,last_name,email`);
        const contact = cRows && cRows[0];
        if (!contact) return json({ error: "Contact not found." }, 404, request, env);

        await ensureAgentProfile(env, contactId, contact, {
          brand: (b && b.brand) || null,
          date_joined: (b && b.date_joined) || null,
          postcode: (b && b.postcode) || null,
          is_new_starter: !!(b && b.is_new_starter),
          induction_month: (b && b.induction_month) || null,
          package: (b && b.package) || null,
          trainer_name: (b && b.trainer_name) || null,
          trainer_email: (b && b.trainer_email) || null,
        });
        const saved = await sbGet(env, "agent_profiles", `contact_id=eq.${encodeURIComponent(contactId)}&select=*`);
        return json({ ok: true, profile: (saved && saved[0]) || null }, 200, request, env);
      }

      // ---- TEG new-starter sheet sync (manual "sync now" for testing) ---------
      if (path.endsWith("/agent/sync") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const summary = await syncAgentSheet(env);
        return json(summary, summary.ok ? 200 : 502, request, env);
      }

      // ---- Admin: invoicing settings (company/finance details) ---------------
      if (path.endsWith("/invoicing/settings") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const rows = await sbGet(env, "invoice_settings", "id=eq.1&select=*");
        return json({ ok: true, settings: (rows && rows[0]) || null }, 200, request, env);
      }
      if (path.endsWith("/invoicing/settings") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const allowed = ["company_name", "company_address", "company_reg_no", "vat_number", "vat_rate", "bank_name", "account_name", "sort_code", "account_number", "payment_terms_days", "invoice_prefix", "next_number", "accounts_cc_email", "footer_note", "template", "accent_color", "logo_url", "show_bank", "font_family", "font_size", "email_footer_image_url"];
        const row = { id: 1 };
        for (const k of allowed) if (b && k in b) row[k] = b[k];
        await fetch(`${env.SUPABASE_URL}/rest/v1/invoice_settings?on_conflict=id`, {
          method: "POST",
          headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(row),
        });
        return json({ ok: true }, 200, request, env);
      }

      // ---- Brand kit (shared, admin-centre-wide: colours, fonts, logos) -------
      if (path.endsWith("/brand") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const rows = await sbGet(env, "brand_settings", "id=eq.1&select=*");
        return json({ ok: true, brand: (rows && rows[0]) || null }, 200, request, env);
      }
      if (path.endsWith("/brand") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isOwner(user)) return json({ error: "Only the account owner can change the brand kit." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const SOCIAL_KEYS = ["website", "linkedin", "instagram", "facebook", "twitter", "youtube"];
        const row = { id: 1 };
        for (const k of ["colors", "heading_font", "subheading_font", "body_font", "logo_url", "footer_image_url", ...SOCIAL_KEYS]) if (b && k in b) row[k] = b[k];
        if (row.colors && !Array.isArray(row.colors)) delete row.colors;
        const upsert = (payload) => fetch(`${env.SUPABASE_URL}/rest/v1/brand_settings?on_conflict=id`, {
          method: "POST",
          headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(payload),
        });
        let res = await upsert(row);
        // If the social columns don't exist yet (migration not run), save the
        // rest so the brand kit still works — but flag it so the UI can tell the
        // user the socials didn't persist (run brand_social.sql).
        let socialsSkipped = false;
        const hadSocial = SOCIAL_KEYS.some((k) => k in row);
        if (!res.ok && hadSocial) {
          const base = { ...row }; SOCIAL_KEYS.forEach((k) => delete base[k]);
          res = await upsert(base);
          if (res.ok) socialsSkipped = true;
        }
        if (!res.ok) { const t = await res.text().catch(() => ""); return json({ error: "Couldn't save the brand kit. " + t.slice(0, 200) }, 502, request, env); }
        return json({ ok: true, socialsSkipped }, 200, request, env);
      }

      // ---- Client report settings (super-admin: what clients see in reports) --
      if (path.endsWith("/report-settings") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const rows = await sbGet(env, "report_settings", "id=eq.1&select=visibility");
        return json({ ok: true, visibility: (rows && rows[0] && rows[0].visibility) || {} }, 200, request, env);
      }
      if (path.endsWith("/report-settings") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isOwner(user)) return json({ error: "Only a super-admin can change what clients see." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const vis = (b && b.visibility && typeof b.visibility === "object" && !Array.isArray(b.visibility)) ? b.visibility : {};
        // Keep only boolean values (defence against junk keys).
        const clean = {};
        for (const k of Object.keys(vis)) if (typeof vis[k] === "boolean") clean[k] = vis[k];
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/report_settings?on_conflict=id`, {
          method: "POST",
          headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ id: 1, visibility: clean }),
        });
        if (!res.ok) { const t = await res.text().catch(() => ""); return json({ error: "Couldn't save report settings. " + t.slice(0, 200) }, 502, request, env); }
        return json({ ok: true }, 200, request, env);
      }

      // ---- Admin: invoice recipients (address book) --------------------------
      if (path.endsWith("/invoicing/recipients") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const rows = (await sbGet(env, "invoice_recipients", "select=*&order=name.asc")) || [];
        return json({ ok: true, recipients: rows }, 200, request, env);
      }
      if (path.endsWith("/invoicing/recipients") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const name = String((b && b.name) || "").trim();
        const email = String((b && b.email) || "").trim();
        if (!name || !email) return json({ error: "A name and email are required." }, 400, request, env);
        const res = await sbPost(env, "invoice_recipients", { name, email, contact_name: (b && b.contact_name) || null, address: (b && b.address) || null, notes: (b && b.notes) || null }, "return=representation");
        let rec = null; try { const j = await res.json(); rec = Array.isArray(j) ? j[0] : j; } catch (_) {}
        return json({ ok: true, recipient: rec }, 200, request, env);
      }
      if (path.endsWith("/invoicing/recipients") && request.method === "DELETE") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const id = (url.searchParams.get("id") || "").trim();
        if (!id) return json({ error: "Missing id" }, 400, request, env);
        await fetch(`${env.SUPABASE_URL}/rest/v1/invoice_recipients?id=eq.${encodeURIComponent(id)}`, {
          method: "DELETE", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}` },
        });
        return json({ ok: true }, 200, request, env);
      }

      // ---- Admin: send an invoice (render PDF → email + CC accounts → sent) ---
      if (path.endsWith("/invoicing/invoices/send") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const id = String((b && b.id) || "").trim();
        if (!id) return json({ error: "Missing invoice id." }, 400, request, env);
        const rows = await sbGet(env, "invoices", `id=eq.${encodeURIComponent(id)}&select=*`);
        const inv = rows && rows[0];
        if (!inv) return json({ error: "Invoice not found." }, 404, request, env);
        if (!inv.bill_to_email) return json({ error: "This invoice has no recipient email — add one first." }, 400, request, env);
        const st = (await sbGet(env, "invoice_settings", "id=eq.1&select=*"))?.[0] || {};
        // The person raising the invoice can pick the style; fall back to the saved default.
        const stForPdf = { ...st, template: inv.template || st.template };

        let pdf;
        try { pdf = await renderInvoicePdf(env, stForPdf, inv); }
        catch (err) { return json({ error: "Couldn't render the PDF: " + (err && err.message ? err.message : err) }, 502, request, env); }

        // Keep a copy in R2 (deterministic key by number).
        const pdfKey = `invoices/${(inv.number || inv.id)}.pdf`;
        try { await env.BUCKET.put(pdfKey, pdf, { httpMetadata: { contentType: "application/pdf" } }); } catch (_) {}

        // The sender can edit the subject, body and CC on the review step before
        // sending; fall back to the invoice's stored values / defaults otherwise.
        const subject = (b && typeof b.email_subject === "string" && b.email_subject.trim()) ? b.email_subject.trim() : `Invoice ${inv.number} from ${st.company_name || "The Marketing Experts (Nationwide) Ltd"}`;
        const cc = (b && b.cc !== undefined) ? (String(b.cc || "").trim() || null) : (inv.cc_email || null);

        // Covering email with the PDF attached; accounts dept CC'd. If the email
        // doesn't actually go, don't mark it sent — tell the caller so they retry.
        const mail = invoiceMailTo(inv.bill_to_email, cc);
        const emailed = await sendEmail(env, {
          to: mail.to,
          cc: mail.cc,
          subject,
          html: invoiceEmailHtml(st, inv, b && b.email_body),
          attachments: [{ filename: `Invoice-${inv.number}.pdf`, content: bufToBase64(pdf), contentType: "application/pdf" }],
        });
        if (!emailed.ok) return json({ error: "The invoice was saved but the email didn't send: " + (emailed.error || "unknown error") + " (recipient: " + inv.bill_to_email + (cc ? ", cc: " + cc : "") + ")" }, 502, request, env);

        // Mark sent (don't downgrade an already-paid invoice). Persist any edited CC.
        const newStatus = inv.status === "paid" ? "paid" : "sent";
        await fetch(`${env.SUPABASE_URL}/rest/v1/invoices?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ status: newStatus, sent_to: inv.bill_to_email, cc_email: cc }),
        });
        return json({ ok: true, status: newStatus, sent_to: inv.bill_to_email }, 200, request, env);
      }

      // ---- Admin: invoices (create draft / list / mark paid) -----------------
      if (path.endsWith("/invoicing/invoices") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const extra = url.searchParams.get("booking_id") ? `&booking_id=eq.${encodeURIComponent(url.searchParams.get("booking_id"))}` : "";
        const rows = (await sbGet(env, "invoices", `select=id,number,bill_to_name,bill_to_email,cc_email,total_pence,status,issued_date,due_date,paid_date,payment_method,billing_month,created_at${extra}&order=created_at.desc&limit=300`)) || [];
        return json({ ok: true, invoices: rows }, 200, request, env);
      }
      // Ensure a Direct Debit client's ghost invoice exists for the current month
      // (called when their Invoicing tab opens), then return their invoice list.
      if (path.endsWith("/invoicing/dd/ensure") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const bookingId = String((b && b.booking_id) || "").trim();
        if (!bookingId) return json({ error: "Missing booking_id." }, 400, request, env);
        const lead = (await sbGet(env, "smm_leads", `id=eq.${encodeURIComponent(bookingId)}&select=*`))?.[0];
        if (lead && lead.direct_debit) { try { await ensureDdInvoice(env, lead, ymNow()); } catch (_) {} }
        const rows = (await sbGet(env, "invoices", `booking_id=eq.${encodeURIComponent(bookingId)}&select=id,number,bill_to_name,bill_to_email,total_pence,status,issued_date,due_date,paid_date,payment_method,billing_month,created_at&order=created_at.desc&limit=300`)) || [];
        return json({ ok: true, invoices: rows }, 200, request, env);
      }
      if (path.endsWith("/invoicing/invoices") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const items = (Array.isArray(b.line_items) ? b.line_items : [])
          .map((it) => ({ description: String((it && it.description) || "").trim(), qty: it && it.qty != null ? Number(it.qty) : 1, unit_pence: Math.round(Number((it && it.unit_pence) || 0)) }))
          .filter((it) => it.description || it.unit_pence);
        if (!items.length) return json({ error: "Add at least one line item." }, 400, request, env);
        const billName = String((b && b.bill_to_name) || "").trim();
        if (!billName) return json({ error: "A recipient name is required." }, 400, request, env);

        const srows = await sbGet(env, "invoice_settings", "id=eq.1&select=*");
        const st = (srows && srows[0]) || {};
        const vatRate = st.vat_rate != null ? Number(st.vat_rate) : 20;
        const nextNum = st.next_number || 1001;
        const number = `${st.invoice_prefix || "TMKE"}${nextNum}`;
        const subtotal = items.reduce((sum, it) => sum + it.unit_pence * (it.qty || 1), 0);
        const vat = Math.round(subtotal * vatRate / 100);
        const total = subtotal + vat;

        const template = (b && (b.template === "banded" || b.template === "minimal")) ? b.template : null;
        const row = {
          number, booking_id: (b && b.booking_id) || null, booking_source: (b && b.booking_source) || "videography",
          recipient_id: (b && b.recipient_id) || null,
          bill_to_name: billName, bill_to_email: (b && b.bill_to_email) || null, bill_to_address: (b && b.bill_to_address) || null,
          line_items: items, subtotal_pence: subtotal, vat_pence: vat, total_pence: total,
          status: "draft", issued_date: (b && b.issued_date) || null, due_date: (b && b.due_date) || null,
          notes: (b && b.notes) || null, template,
          // Per-invoice CC — the builder pre-fills the accounts default but the
          // sender can edit/clear it. Only fall back to the default if the field
          // wasn't sent at all (so a deliberate clear = no CC).
          cc_email: (b && b.cc_email !== undefined) ? (String(b.cc_email || "").trim() || null) : (st.accounts_cc_email || null),
          created_by: user.email || null,
        };
        let res = await sbPost(env, "invoices", row, "return=representation");
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          // The per-invoice template column is optional (supabase/invoicing_template_choice.sql).
          // If it isn't there yet, save without it rather than failing the whole invoice.
          if (/template/.test(errText) && row.template != null) {
            const { template: _t, ...rowNoTpl } = row;
            res = await sbPost(env, "invoices", rowNoTpl, "return=representation");
          }
          if (!res.ok) return json({ error: "Couldn't save the invoice." + (errText ? " " + errText.slice(0, 180) : "") }, 502, request, env);
        }
        let inv = null; try { const j = await res.json(); inv = Array.isArray(j) ? j[0] : j; } catch (_) {}
        if (!inv || !inv.id) return json({ error: "Couldn't save the invoice." }, 502, request, env);
        await fetch(`${env.SUPABASE_URL}/rest/v1/invoice_settings?id=eq.1`, {
          method: "PATCH", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ next_number: nextNum + 1 }),
        });
        return json({ ok: true, invoice: inv }, 200, request, env);
      }
      if (path.endsWith("/invoicing/invoices") && request.method === "PATCH") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const id = String((b && b.id) || "").trim();
        const status = ["draft", "sent", "paid", "void"].includes(b && b.status) ? b.status : null;
        if (!id || !status) return json({ error: "Missing id or status." }, 400, request, env);
        const patch = { status };
        if (status === "paid") patch.paid_date = (b && b.paid_date) || new Date().toISOString().slice(0, 10);
        await fetch(`${env.SUPABASE_URL}/rest/v1/invoices?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        });
        // When marked paid, re-render the saved PDF so the stored copy (and the
        // client's future hub view) shows the "Paid · <date>" stamp.
        if (status === "paid") {
          try {
            const inv = (await sbGet(env, "invoices", `id=eq.${encodeURIComponent(id)}&select=*`))?.[0];
            if (inv) {
              const st = (await sbGet(env, "invoice_settings", "id=eq.1&select=*"))?.[0] || {};
              const pdf = await renderInvoicePdf(env, { ...st, template: inv.template || st.template }, inv);
              await env.BUCKET.put(`invoices/${inv.number || inv.id}.pdf`, pdf, { httpMetadata: { contentType: "application/pdf" } });
            }
          } catch (_) { /* stamp refresh is best-effort */ }
        }
        return json({ ok: true }, 200, request, env);
      }
      // ---- Admin: delete an invoice (hard delete + its PDF) ------------------
      if (path.endsWith("/invoicing/invoices") && request.method === "DELETE") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const id = String(url.searchParams.get("id") || "").trim();
        if (!id) return json({ error: "Missing id." }, 400, request, env);
        const inv = (await sbGet(env, "invoices", `id=eq.${encodeURIComponent(id)}&select=id,number`))?.[0];
        await fetch(`${env.SUPABASE_URL}/rest/v1/invoices?id=eq.${encodeURIComponent(id)}`, {
          method: "DELETE", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}` },
        });
        if (inv && inv.number) { try { await env.BUCKET.delete(`invoices/${inv.number}.pdf`); } catch (_) {} }
        return json({ ok: true }, 200, request, env);
      }
      // ---- Admin: void an invoice (email accounts + admin, then delete) ------
      if (path.endsWith("/invoicing/invoices/void") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const id = String((b && b.id) || "").trim();
        const reason = String((b && b.reason) || "").trim();
        if (!id) return json({ error: "Missing id." }, 400, request, env);
        const inv = (await sbGet(env, "invoices", `id=eq.${encodeURIComponent(id)}&select=*`))?.[0];
        if (!inv) return json({ error: "Invoice not found." }, 404, request, env);
        const st = (await sbGet(env, "invoice_settings", "id=eq.1&select=*"))?.[0] || {};
        const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#2a1b22;font-size:15px;line-height:1.6;max-width:560px">
          <p style="margin:0 0 14px"><strong>Invoice ${esc(inv.number)} has been voided</strong> and removed from the system — please disregard it.</p>
          <table style="border-collapse:collapse;margin:0 0 14px;font-size:15px">
            <tr><td style="padding:2px 18px 2px 0;color:#7a6b70">Client</td><td style="padding:2px 0"><strong>${esc(inv.bill_to_name || "")}</strong></td></tr>
            <tr><td style="padding:2px 18px 2px 0;color:#7a6b70">Amount</td><td style="padding:2px 0">${money(inv.total_pence)}</td></tr>
            ${inv.billing_month ? `<tr><td style="padding:2px 18px 2px 0;color:#7a6b70">Period</td><td style="padding:2px 0">${esc(inv.billing_month)}</td></tr>` : ""}
            <tr><td style="padding:2px 18px 2px 0;color:#7a6b70">Voided by</td><td style="padding:2px 0">${esc(user.email || "an admin")}</td></tr>
          </table>
          <p style="margin:0 0 6px;color:#7a6b70">Reason</p>
          <p style="margin:0;padding:11px 14px;background:#f4f2f1;border-left:3px solid #371e28;border-radius:4px">${esc(reason || "—")}</p>
        </div>`;
        const voidMail = invoiceMailTo(st.accounts_cc_email || DD_DEFAULT_RECIPIENT, user.email || null);
        await sendEmail(env, {
          to: voidMail.to,
          cc: voidMail.cc,
          subject: `Invoice ${inv.number} voided — ${inv.bill_to_name || ""}`,
          html,
        });
        await fetch(`${env.SUPABASE_URL}/rest/v1/invoices?id=eq.${encodeURIComponent(id)}`, {
          method: "DELETE", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}` },
        });
        if (inv.number) { try { await env.BUCKET.delete(`invoices/${inv.number}.pdf`); } catch (_) {} }
        return json({ ok: true }, 200, request, env);
      }

      // ---- Admin: set an SMM client's status (active / paused / ended) --------
      // Persists on the lead and swaps the SMM-Status tag on their CRM contact.
      // Active also lifts their lifecycle to Customer (per the tagging framework).
      // ---- Admin: delete an SMM lead/card (cascade: invoices, thread, docs) --
      // Mostly for clearing test cards before go-live.
      if (path.endsWith("/smm/lead") && request.method === "DELETE") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const id = String(url.searchParams.get("id") || "").trim();
        if (!id) return json({ error: "Missing id." }, 400, request, env);
        const hdr = { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}` };
        // Delete any invoices + their PDFs first.
        try {
          const invs = (await sbGet(env, "invoices", `booking_id=eq.${encodeURIComponent(id)}&select=number`)) || [];
          for (const iv of invs) { if (iv.number) { try { await env.BUCKET.delete(`invoices/${iv.number}.pdf`); } catch (_) {} } }
        } catch (_) {}
        for (const t of ["invoices", "booking_documents", "booking_messages"]) {
          try { await fetch(`${env.SUPABASE_URL}/rest/v1/${t}?booking_id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: hdr }); } catch (_) {}
        }
        await fetch(`${env.SUPABASE_URL}/rest/v1/smm_leads?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: hdr });
        return json({ ok: true }, 200, request, env);
      }
      if (path.endsWith("/smm/status") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const leadId = b && b.lead_id;
        const status = ["active", "paused", "ended"].includes(b && b.status) ? b.status : null;
        if (!leadId || !status) return json({ error: "Missing lead or status." }, 400, request, env);
        const rows = await sbGet(env, "smm_leads", `id=eq.${encodeURIComponent(leadId)}&select=id,email,full_name,first_name,last_name,business,account_user_id`);
        const lead = rows && rows[0];
        if (!lead) return json({ error: "Lead not found." }, 404, request, env);
        // Persist the status on the lead.
        await fetch(`${env.SUPABASE_URL}/rest/v1/smm_leads?id=eq.${encodeURIComponent(leadId)}`, {
          method: "PATCH", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ client_status: status }),
        });
        // Reflect on the CRM contact: one SMM-Status tag at a time.
        const statusTag = `SMM-Status: ${{ active: "Active", paused: "Paused", ended: "Ended" }[status]}`;
        if (lead.email) {
          const cRows = await sbGet(env, "contacts", `email=eq.${encodeURIComponent(lead.email)}&select=id,tags,lifecycle`);
          const c = cRows && cRows[0];
          if (c) {
            const tags = normalizeTags([...(c.tags || []).filter((t) => !/^SMM-Status:/.test(t)), statusTag]);
            const patch = { tags };
            if (status === "active") patch.lifecycle = "customer";
            await fetch(`${env.SUPABASE_URL}/rest/v1/contacts?id=eq.${c.id}`, {
              method: "PATCH", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
              body: JSON.stringify(patch),
            });
          } else {
            await sbRpc(env, "upsert_contact", {
              p_email: lead.email, p_first_name: lead.first_name || lead.full_name || null, p_last_name: lead.last_name || null,
              p_company: lead.business || null, p_source: "smm", p_lifecycle: status === "active" ? "customer" : "lead",
              p_tags: normalizeTags([statusTag, networkTag(lead.email)].filter(Boolean)), p_user_id: lead.account_user_id || null,
            });
          }
        }
        return json({ ok: true }, 200, request, env);
      }

      // ---- Admin: book a sales meeting for an SMM lead --------------------
      // Saves meeting_at + moves the lead to Meeting set; optionally sends the
      // client a diary invite (calendar event on the SMM manager's diary + ICS).
      if (path.endsWith("/smm/meeting") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const leadId = b && b.lead_id;
        const date = b && b.date, start = b && b.start;
        if (!leadId || !date || !start) return json({ error: "Missing lead, date or time." }, 400, request, env);
        const rows = await sbGet(env, "smm_leads", `id=eq.${encodeURIComponent(leadId)}&select=id,email,full_name,first_name,account_user_id`);
        const lead = rows && rows[0];
        if (!lead) return json({ error: "Lead not found." }, 404, request, env);
        const meetingAt = `${date}T${start}:00`;
        // Advance to Meeting set only when asked (a booking for a later-stage
        // client just records the meeting without moving them back).
        const meetingPatch = { meeting_at: meetingAt };
        if (b.set_stage !== false) meetingPatch.pipeline_stage = "meeting_set";
        await fetch(`${env.SUPABASE_URL}/rest/v1/smm_leads?id=eq.${encodeURIComponent(leadId)}`, {
          method: "PATCH", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(meetingPatch),
        });
        const cal = env.SMM_MANAGER_UPN;
        const dur = parseInt(b.duration || "30", 10);
        const endHm = minToHm(hmToMin(start) + dur);
        const dateNice = (() => { try { return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch (_) { return date; } })();
        let invited = false;
        if (b.send_invite && cal && lead.email) {
          try {
            await graph(env, "POST", `/users/${encodeURIComponent(cal)}/events`, {
              subject: `TMKE Social Media — Meeting with ${lead.full_name || lead.email}`,
              start: { dateTime: `${date}T${start}:00`, timeZone: "Europe/London" },
              end: { dateTime: `${date}T${endHm}:00`, timeZone: "Europe/London" },
              attendees: [
                { emailAddress: { address: lead.email, name: lead.full_name || "" }, type: "required" },
                ...(env.SMM_NOTIFY && env.SMM_NOTIFY.toLowerCase() !== cal.toLowerCase()
                  ? [{ emailAddress: { address: env.SMM_NOTIFY, name: "TMKE Social Media" }, type: "required" }] : []),
              ],
              isOnlineMeeting: true,
            });
            const ics = buildICS({ uid: `smm-${leadId}-${date}-${start}@tmke.co.uk`, date, start, endHm, summary: "TMKE Social Media — Meeting", description: "A meeting with the TMKE social media team.", location: "Online / phone", organizer: cal, attendeeEmail: lead.email, attendeeName: lead.full_name || "" });
            const icsB64 = bufToBase64(new TextEncoder().encode(ics).buffer);
            const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            await sendEmail(env, {
              to: lead.email, subject: `Your meeting with TMKE — ${dateNice}`,
              html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1d22"><p style="color:#555;font-size:14px;margin:0 0 12px">Hi ${esc(lead.first_name || "")},</p><p style="font-size:15px;line-height:1.6">Your meeting with the TMKE social media team is booked for <strong>${esc(dateNice)} at ${esc(start)}</strong>. A calendar invite is attached.</p></div>`,
              attachments: [{ filename: "meeting.ics", content: icsB64, contentType: "text/calendar" }],
              from: env.SMM_MAIL_SENDER || undefined, fromName: env.SMM_MAIL_SENDER ? (env.SMM_MAIL_FROM_NAME || "TMKE Social Media") : undefined,
            });
            invited = true;
          } catch (_) {}
        }
        await logBookingMessage(env, {
          booking_id: leadId, booking_source: "smm", account_user_id: lead.account_user_id, client_email: lead.email,
          kind: "meeting", subject: "Meeting booked", is_automated: false, created_by: user.email || "admin",
          body: `Meeting booked for ${dateNice} at ${start}.${invited ? " Diary invite sent to the client." : ""}`,
        });
        return json({ ok: true, invited }, 200, request, env);
      }

      // ---- Admin: add a lead manually (other channels / existing clients) ----
      if (path.endsWith("/smm/lead") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const email = String((b && b.email) || "").trim();
        const first = String((b && b.first_name) || "").trim();
        const last = String((b && b.last_name) || "").trim();
        const full = (String((b && b.full_name) || "").trim()) || `${first} ${last}`.trim();
        if (!full && !email) return json({ error: "Add a name or email." }, 400, request, env);
        const stage = ["inquiry", "meeting_set", "proposal_sent", "contract_signed", "active_client"].includes(b && b.pipeline_stage) ? b.pipeline_stage : "inquiry";
        const ins = await sbPost(env, "smm_leads", {
          kind: "manual", tag: "Manual", stage: "manual", pipeline_stage: stage,
          first_name: first || null, last_name: last || null, full_name: full || email,
          email: email || null, phone: (b && b.phone) || null, business: (b && b.business) || null,
          client_status: stage === "active_client" ? "active" : null,
        }, "return=representation");
        if (!ins.ok) { const detail = await ins.text().catch(() => ""); console.error("smm manual lead insert failed", ins.status, detail); return json({ error: "Couldn't save the lead." }, 502, request, env); }
        let row = null; try { const arr = await ins.json(); row = Array.isArray(arr) && arr[0] ? arr[0] : null; } catch (_) {}
        return json({ ok: true, lead: row }, 200, request, env);
      }

      // ---- Admin: link an SMM card to a member's hub account ------------------
      // Binds smm_leads.account_user_id to the auth user of the given email (the
      // card's own email by default), so their reports pull through on
      // /account/social even if the card was created before they signed up.
      // Safety: the account's name must share the card's first OR last name, so
      // we don't attach the wrong person on a shared/typo'd email. Pass
      // { force: true } to override after the admin confirms. Returns
      // { noAccount } when no hub account exists (so the UI can offer an invite).
      if (path.endsWith("/smm/link") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const leadId = String((b && b.lead_id) || "").trim();
        if (!leadId) return json({ error: "Missing lead id." }, 400, request, env);
        const rows = await sbGet(env, "smm_leads", `id=eq.${encodeURIComponent(leadId)}&select=id,email,first_name,last_name,full_name`);
        const lead = rows && rows[0];
        if (!lead) return json({ error: "That card no longer exists." }, 404, request, env);
        const targetEmail = String((b && b.email) || lead.email || "").trim();
        if (!targetEmail) return json({ error: "This card has no email — add one first, then link." }, 400, request, env);
        const u = await findUserByEmail(env, targetEmail);
        if (!u) return json({ ok: false, noAccount: true, email: targetEmail }, 200, request, env);
        // Identity check — does the account's name share a name with the card?
        const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z\s-]/g, "").split(/[\s-]+/).filter(Boolean);
        const cardTokens = new Set([...norm(lead.first_name), ...norm(lead.last_name), ...norm(lead.full_name)]);
        const acctName = (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || "";
        const acctTokens = norm(acctName);
        const nameKnown = cardTokens.size > 0 && acctTokens.length > 0;
        const matches = !nameKnown || acctTokens.some((t) => cardTokens.has(t));
        if (!matches && !(b && b.force === true)) {
          return json({ ok: false, nameMismatch: true, email: targetEmail,
            account_name: acctName, card_name: lead.full_name || `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "(no name on card)" }, 200, request, env);
        }
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/smm_leads?id=eq.${encodeURIComponent(leadId)}`, {
          method: "PATCH",
          headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ account_user_id: u.id }),
        });
        if (!res.ok) { const t = await res.text().catch(() => ""); return json({ error: "Couldn't link the account. " + t.slice(0, 200) }, 502, request, env); }
        return json({ ok: true, linked_email: targetEmail, user_id: u.id }, 200, request, env);
      }

      // ---- Admin: invite an SMM client to create their member hub account -----
      // For a manually-added client with no hub account yet: create the account,
      // link the card to it, and email a branded invite with a "set your
      // password" link (→ /reset-password) so they can finish creating it.
      if (path.endsWith("/smm/invite") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const b = await request.json().catch(() => ({}));
        const leadId = String((b && b.lead_id) || "").trim();
        if (!leadId) return json({ error: "Missing lead id." }, 400, request, env);
        const rows = await sbGet(env, "smm_leads", `id=eq.${encodeURIComponent(leadId)}&select=id,email,first_name,last_name,full_name,business`);
        const lead = rows && rows[0];
        if (!lead) return json({ error: "That card no longer exists." }, 404, request, env);
        const email = String(lead.email || "").trim();
        if (!email) return json({ error: "This card has no email — add one first." }, 400, request, env);
        const fullName = String(lead.full_name || `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "").trim();
        const first = String(lead.first_name || fullName.split(/\s+/)[0] || "there").trim();
        // If they already have an account, just link it — no duplicate.
        let u = await findUserByEmail(env, email);
        let created = false;
        if (!u) {
          const cr = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
            method: "POST",
            headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: genTempPassword(), email_confirm: true, user_metadata: { full_name: fullName || null } }),
          });
          if (cr.ok) { try { u = await cr.json(); } catch (_) {} created = true; }
          if (!u || !u.id) u = await findUserByEmail(env, email);
          if (!u || !u.id) { const t = await cr.text().catch(() => ""); return json({ error: "Couldn't create their account. " + t.slice(0, 160) }, 502, request, env); }
        }
        // Link the card to the account.
        await fetch(`${env.SUPABASE_URL}/rest/v1/smm_leads?id=eq.${encodeURIComponent(leadId)}`, {
          method: "PATCH",
          headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ account_user_id: u.id, account_created: created || undefined }),
        });
        // Generate a "set your password" link → /reset-password.
        const site = String(env.SITE_URL || "https://tmke.co.uk").replace(/\/+$/, "");
        let actionLink = `${site}/forgot-password`;
        try {
          const gl = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
            method: "POST",
            headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json" },
            body: JSON.stringify({ type: "recovery", email, options: { redirect_to: `${site}/reset-password` } }),
          });
          if (gl.ok) { const gj = await gl.json().catch(() => ({})); actionLink = (gj && (gj.action_link || (gj.properties && gj.properties.action_link))) || actionLink; }
        } catch (_) {}
        const content = `
          <h1 style="font-family:Georgia,serif;font-size:24px;color:#371e28;margin:0 0 14px;">Welcome to your TMKE member hub</h1>
          <p style="font-size:15px;line-height:1.6;color:#40353a;margin:0 0 14px;">Hi ${esc(first)},</p>
          <p style="font-size:15px;line-height:1.6;color:#40353a;margin:0 0 14px;">As one of our social media management clients, you can manage and oversee your account through our member hub — your plan, your monthly performance reports and everything in one place.</p>
          <p style="font-size:15px;line-height:1.6;color:#40353a;margin:0 0 22px;">Click below to set your password and open your account.</p>
          <p style="margin:0 0 24px;"><a href="${esc(actionLink)}" style="display:inline-block;background:#371e28;color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:700;padding:13px 26px;border-radius:8px;">Create your account</a></p>
          <p style="font-size:13px;line-height:1.6;color:#8a8796;margin:0;">If the button doesn't work, paste this into your browser:<br><span style="color:#371e28;">${esc(actionLink)}</span></p>`;
        const html = await wrapInBrandedBase(env, content);
        const sent = await sendEmail(env, { to: email, subject: "Create your TMKE member hub account", html });
        if (!sent.ok) return json({ ok: false, linked: true, emailFailed: true, error: sent.error || "The account is linked, but the invite email didn't send." }, 200, request, env);
        return json({ ok: true, invited: email, user_id: u.id }, 200, request, env);
      }

      // ---- Admin: set an invoice document's paid date -------------------------
      if (path.endsWith("/booking/document/paid") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const id = b && b.id;
        if (!id) return json({ error: "Missing id" }, 400, request, env);
        const paid = /^\d{4}-\d{2}-\d{2}$/.test((b && b.paid_date) || "") ? b.paid_date : null;
        await fetch(`${env.SUPABASE_URL}/rest/v1/booking_documents?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ paid_date: paid }),
        });
        return json({ ok: true }, 200, request, env);
      }

      // ---- Admin: save/upsert a monthly performance report -------------------
      if (path.endsWith("/smm/report") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const leadId = b && b.lead_id;
        const month = Number(b && b.month), year = Number(b && b.year);
        const platform = (b && b.platform) || "Instagram";
        const data = (b && b.data && typeof b.data === "object") ? b.data : null;
        if (!leadId || !(month >= 0 && month <= 11) || !year || !data) return json({ error: "Need lead, a valid month/year and the report JSON." }, 400, request, env);
        // Link the client's account for member reads.
        let accountUserId = b && b.account_user_id;
        if (!accountUserId) { const r = await sbGet(env, "smm_leads", `id=eq.${encodeURIComponent(leadId)}&select=account_user_id`); accountUserId = (r && r[0] && r[0].account_user_id) || null; }
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/smm_reports?on_conflict=lead_id,platform,month,year`, {
          method: "POST",
          headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
          body: JSON.stringify({ lead_id: leadId, account_user_id: accountUserId, platform, month, year, data, uploaded_by: user.email || "admin" }),
        });
        if (!res.ok) { const t = await res.text().catch(() => ""); console.error("smm report upsert failed", res.status, t); return json({ error: "Couldn't save the report. If this is the first run, apply smm_reports.sql.", detail: t }, 502, request, env); }
        let row = null; try { const arr = await res.json(); row = Array.isArray(arr) && arr[0] ? arr[0] : null; } catch (_) {}
        return json({ ok: true, report: row }, 200, request, env);
      }

      // ---- Admin: parse a SocialPilot PDF into report JSON (via Claude) ------
      // So team members who don't use Claude can just upload the PDF here.
      if (path.endsWith("/smm/report/parse") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        if (!env.ANTHROPIC_API_KEY) return json({ error: "AI isn't configured — set the ANTHROPIC_API_KEY secret on the Worker." }, 503, request, env);
        const b = await request.json().catch(() => ({}));
        const raw = String((b && b.pdf) || "");
        const mm = /^data:application\/pdf;base64,(.+)$/i.exec(raw);
        const b64 = mm ? mm[1] : raw;
        if (!b64) return json({ error: "Missing PDF." }, 400, request, env);
        const prompt =
          "The attached PDF is a SocialPilot monthly social-media analytics report. Its charts are images — read the values visually. " +
          "Extract the figures into ONE JSON object with this exact shape, and reply with ONLY that JSON (no prose, no markdown fences):\n" +
          '{ "summary": string (1-2 sentence plain-English summary), ' +
          '"profile": { "followers": number, "newFollowers": number, "reach": number, "reachChange": number (percent vs prior month), "views": number, "interactions": number, "interactionRate": number (percent), "linkTaps": number, "ukFollowers": number (optional) }, ' +
          '"reach": { "reels": number, "posts": number, "stories": number, "ads": number (only if paid ran), "nonFollower": number, "follower": number, "organicReach": number (=reels+posts+stories when ads ran), "paidReach": number (only if ads ran) }, ' +
          '"reels": { "published": number, "reach": number, "views": number, "interactions": number, "likes": number, "comments": number, "saves": number, "shares": number, "interactionRate": "x.x%" }, ' +
          '"posts": { same fields as reels }, ' +
          '"ads": { "reach": number, "views": number, "interactions": number, "clicks": number, "cpc": number (GBP), "spend": number (GBP), "impressions": number } (OMIT this whole object if there were no paid ads), ' +
          '"topContent": [ { "title": string, "type": "Reel"|"Post"|"Ad"|"Story", "reach": number, "interactions": number } ], ' +
          '"hashtags": [ { "name": "#tag", "reach": number, "interactions": number } ], ' +
          '"peakTimes": { "slots": ["8am","10am","12pm","2pm","4pm","6pm","8pm"], "grid": seven rows (Mon..Sun), each a row of N cells matching slots, each cell 0-3 (0 low, 1 moderate, 2 good, 3 peak) }, ' +
          '"timing": string, "bestDays": string, "morningWindow": string, "eveningWindow": string, ' +
          '"demographics": { "gender": [ { "label": "Women"|"Men", "pct": number, "count": number } ], "topCities": [ { "city": string, "count": number } ], "topCountries": [ { "country": string, "count": number } ] }, ' +
          '"priorities": [ { "type": "go"|"caution"|"action", "text": string } ] (go = do more, caution = improve, action = fix now — infer 2-4 sensible ones from the data), ' +
          '"comingSoon": [ string ] (optional; omit if unknown) }\n' +
          "Only include fields you can determine; omit anything not present (especially the ads object when there were no paid ads). Numbers must be plain (no commas or units) except cpc/spend which are numeric GBP amounts. Reply with ONLY the JSON object.";
        let aiRes;
        try {
          aiRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "pdfs-2024-09-25", "content-type": "application/json" },
            body: JSON.stringify({
              model: env.AI_MODEL || "claude-sonnet-4-6",
              max_tokens: 4000,
              messages: [{ role: "user", content: [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
                { type: "text", text: prompt },
              ] }],
            }),
          });
        } catch (e) { return json({ error: "Couldn't reach the AI service." }, 502, request, env); }
        if (!aiRes.ok) { const t = await aiRes.text().catch(() => ""); return json({ error: "AI request failed (" + aiRes.status + ").", detail: t.slice(0, 300) }, 502, request, env); }
        const dataRes = await aiRes.json();
        const text = (dataRes.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
        let parsed;
        try { const s = text.indexOf("{"), e = text.lastIndexOf("}"); parsed = JSON.parse(text.slice(s, e + 1)); }
        catch (_) { return json({ error: "Couldn't read the AI output — try again, or paste the JSON manually.", raw: text.slice(0, 200) }, 502, request, env); }
        const out = parsed && parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
        return json({ ok: true, data: out, usage: dataRes.usage || null }, 200, request, env);
      }

      // ---- Admin: list reports (optionally for one account) ------------------
      if (path.endsWith("/smm/reports") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const leadId = (url.searchParams.get("lead_id") || "").trim();
        const q = leadId ? `lead_id=eq.${encodeURIComponent(leadId)}&` : "";
        const reports = (await sbGet(env, "smm_reports", `${q}select=id,lead_id,account_user_id,platform,month,year,data,created_at&order=year.desc,month.desc`)) || [];
        return json({ reports }, 200, request, env);
      }

      // ---- Admin: ask Claude about an account's reports (admin-only) ----------
      if (path.endsWith("/smm/report/ask") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        if (!env.ANTHROPIC_API_KEY) return json({ error: "AI isn't configured — set the ANTHROPIC_API_KEY secret on the Worker." }, 503, request, env);
        const b = await request.json().catch(() => ({}));
        const leadId = b && b.lead_id;
        const question = String((b && b.question) || "").trim().slice(0, 500);
        if (!leadId || !question) return json({ error: "Missing account or question." }, 400, request, env);
        const leadRows = await sbGet(env, "smm_leads", `id=eq.${encodeURIComponent(leadId)}&select=full_name,business`);
        const lead = (leadRows && leadRows[0]) || {};
        const reps = (await sbGet(env, "smm_reports", `lead_id=eq.${encodeURIComponent(leadId)}&select=platform,month,year,data&order=year.asc,month.asc`)) || [];
        if (!reps.length) return json({ error: "No reports for this account yet — upload one first." }, 400, request, env);
        const MN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const accName = lead.business || lead.full_name || "this account";
        const platform = reps[reps.length - 1].platform || "Instagram";
        let dataText = "";
        for (const r of reps) {
          const d = r.data || {}, p = d.profile || {}, rc = d.reach || {};
          dataText += `=== ${MN[r.month]} ${r.year} ===\n`;
          dataText += `Followers: ${p.followers ?? "?"} | New followers: ${p.newFollowers ?? "?"} | Reach: ${p.reach ?? "?"} | Views: ${p.views ?? "?"}\n`;
          dataText += `Interactions: ${p.interactions ?? "?"} | Engagement rate: ${p.interactionRate ?? "?"}% | Link taps: ${p.linkTaps ?? "?"}\n`;
          if (rc.organicReach != null || rc.paidReach != null) dataText += `Organic reach: ${rc.organicReach ?? "?"} | Paid reach: ${rc.paidReach ?? "?"}\n`;
          if (d.ads) dataText += `Paid ads — reach: ${d.ads.reach ?? "?"} | interactions: ${d.ads.interactions ?? "?"} | spend: £${d.ads.spend ?? "?"} | clicks: ${d.ads.clicks ?? "?"} | CPC: £${d.ads.cpc ?? "?"}\n`;
          if (d.bestDays) dataText += `Best days: ${d.bestDays} | Morning window: ${d.morningWindow || "?"} | Evening window: ${d.eveningWindow || "?"}\n`;
          if (d.hashtags && d.hashtags.length) dataText += `Hashtags: ${d.hashtags.map((h) => `${h.name} (reach:${h.reach}, inter:${h.interactions})`).join(", ")}\n`;
          if (d.topContent && d.topContent.length) dataText += `Top content: ${d.topContent.map((t) => `${t.title} [${t.type}]`).join("; ")}\n`;
          if (d.priorities && d.priorities.length) dataText += `Priorities: ${d.priorities.map((pr) => pr.text).join("; ")}\n`;
          dataText += "\n";
        }
        const prompt = `You are a social media analyst reviewing ${reps.length} month(s) of data for ${accName} on ${platform}.\n\nData:\n${dataText}\nQuestion: ${question}\n\nAnswer directly and practically, referencing the actual figures above. Be concise (a few short sentences or bullet points). If the data doesn't cover it, say so.`;
        let aiRes;
        try {
          aiRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
            body: JSON.stringify({ model: env.AI_MODEL || "claude-sonnet-4-6", max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
          });
        } catch (e) { return json({ error: "Couldn't reach the AI service." }, 502, request, env); }
        if (!aiRes.ok) { const t = await aiRes.text().catch(() => ""); return json({ error: "AI request failed (" + aiRes.status + ").", detail: t.slice(0, 300) }, 502, request, env); }
        const dataRes = await aiRes.json();
        const answer = (dataRes.content || []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
        return json({ ok: true, answer: answer || "(no answer)" }, 200, request, env);
      }

      // ---- Admin: delete a report --------------------------------------------
      if (path.endsWith("/smm/report") && request.method === "DELETE") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const id = (url.searchParams.get("id") || "").trim();
        if (!id) return json({ error: "Missing id" }, 400, request, env);
        await fetch(`${env.SUPABASE_URL}/rest/v1/smm_reports?id=eq.${encodeURIComponent(id)}`, {
          method: "DELETE", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}` },
        });
        return json({ ok: true }, 200, request, env);
      }

      // ---- Admin: manually run the inbound-email capture (also on the cron) ---
      if (path.endsWith("/smm/inbox/poll") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const result = await pollSmmInbox(env);
        return json(result || { ok: false }, 200, request, env);
      }

      // ---- Member: my whole correspondence + documents (service role) --------
      // Reads through the verified member session, matching by account OR email,
      // so the portal never misses a row to an RLS/email-casing edge case.
      if (path.endsWith("/booking/mine") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user) return json({ error: "Sign in." }, 401, request, env);
        const ids = await memberBookingIds(env, user);
        if (!ids.length) return json({ messages: [], documents: [] }, 200, request, env);
        const inList = `in.(${ids.join(",")})`;
        const messages = (await sbGet(env, "booking_messages", `booking_id=${inList}&select=id,booking_id,booking_source,direction,channel,kind,subject,body,is_automated,created_by,created_at&order=created_at.asc`)) || [];
        const documents = (await sbGet(env, "booking_documents", `booking_id=${inList}&select=id,booking_id,booking_source,category,title,file_name,size_bytes,content_type,created_at&order=created_at.asc`)) || [];
        return json({ messages, documents }, 200, request, env);
      }

      // ---- Member: my managed-social service (client record + monthly insights)
      if (path.endsWith("/smm/mine") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user) return json({ error: "Sign in." }, 401, request, env);
        const email = String(user.email || "").toLowerCase();
        const leads = (await sbGet(env, "smm_leads", `or=(account_user_id.eq.${user.id},email.ilike.${encodeURIComponent(email)})&select=id,kind,pipeline_stage,client_status,package_name,price,platforms,start_date,instagram_url,facebook_url,linkedin_url,youtube_url,tiktok_url,full_name,business&order=created_at.desc`)) || [];
        // A member may match more than one card (a manual "test client" card that
        // holds the reports, plus a stray enquiry/brochure card from the same
        // email). Fetch reports across ALL matched cards, then pick the primary:
        // an active client first, else whichever card actually owns reports (so a
        // newer empty card can't hide them), else the most recent.
        let allReports = [];
        if (leads.length) {
          const ids = leads.map((l) => l.id).join(",");
          allReports = (await sbGet(env, "smm_reports", `lead_id=in.(${ids})&select=id,platform,month,year,data,lead_id&order=year.desc,month.desc&limit=96`)) || [];
        }
        const lead = leads.find((l) => l.pipeline_stage === "active_client")
          || (allReports.length ? leads.find((l) => l.id === allReports[0].lead_id) : null)
          || leads[0] || null;
        const isClient = !!lead && lead.pipeline_stage === "active_client";
        const reports = lead ? allReports.filter((r) => r.lead_id === lead.id).map(({ lead_id, ...r }) => r) : [];
        // Super-admin visibility map (what fields clients may see). The page
        // merges this over the code defaults (report-fields.js) before rendering.
        const vrows = await sbGet(env, "report_settings", "id=eq.1&select=visibility");
        const visibility = (vrows && vrows[0] && vrows[0].visibility) || {};
        return json({ ok: true, isClient, client: lead, reports, visibility }, 200, request, env);
      }

      // ---- Admin: list a booking's messages + documents ----
      if (path.endsWith("/booking/thread") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const id = (url.searchParams.get("booking_id") || "").trim();
        if (!id) return json({ error: "Missing booking_id" }, 400, request, env);
        const messages = (await sbGet(env, "booking_messages", `booking_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.asc`)) || [];
        // Full select includes the invoice date columns; fall back to the base
        // columns if they haven't been added yet (so documents still load).
        let documents = await sbGet(env, "booking_documents", `booking_id=eq.${encodeURIComponent(id)}&select=id,category,title,file_name,size_bytes,content_type,uploaded_by,invoice_date,paid_date,created_at&order=created_at.asc`);
        if (documents == null) documents = (await sbGet(env, "booking_documents", `booking_id=eq.${encodeURIComponent(id)}&select=id,category,title,file_name,size_bytes,content_type,uploaded_by,created_at&order=created_at.asc`)) || [];
        return json({ messages, documents }, 200, request, env);
      }

      // ---- Admin: attach a document (raw body → R2 + row) ----
      if (path.endsWith("/booking/document") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const q = url.searchParams;
        const bookingId = (q.get("booking_id") || "").trim();
        const source = q.get("source") === "smm" ? "smm" : "videography";
        const category = ["agreement", "prep", "invoice", "delivery", "content_plan", "insights_report", "other"].includes(q.get("category")) ? q.get("category") : "other";
        const fileName = (q.get("file_name") || "document").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
        const title = q.get("title") || null;
        const invoiceDate = /^\d{4}-\d{2}-\d{2}$/.test(q.get("invoice_date") || "") ? q.get("invoice_date") : null;
        const contentType = q.get("content_type") || request.headers.get("Content-Type") || "application/octet-stream";
        if (!bookingId) return json({ error: "Missing booking_id" }, 400, request, env);
        const bk = await lookupBooking(env, source, bookingId);
        if (!bk) return json({ error: "Booking not found." }, 404, request, env);
        const idSafe = bookingId.replace(/[^a-zA-Z0-9_-]/g, "");
        const key = `booking-docs/${idSafe}/${Date.now()}-${fileName}`;
        const body = await request.arrayBuffer();
        await env.BUCKET.put(key, body, { httpMetadata: { contentType } });
        // Only reference invoice_date when it's set, so ordinary uploads still
        // work even if that column hasn't been added yet.
        const docRow = {
          booking_id: bookingId, booking_source: source, account_user_id: bk.account_user_id, client_email: bk.email,
          category, title, file_name: fileName, r2_key: key, content_type: contentType, size_bytes: body.byteLength,
          uploaded_by: user.email || "admin",
        };
        if (invoiceDate) docRow.invoice_date = invoiceDate;
        let row = null, insErr = null;
        try {
          const ins = await sbPost(env, "booking_documents", docRow, "return=representation");
          if (!ins.ok) insErr = (await ins.text().catch(() => "")) || `insert ${ins.status}`;
          else { const arr = await ins.json(); row = Array.isArray(arr) && arr[0] ? arr[0] : null; }
        } catch (e) { insErr = (e && e.message) || "insert failed"; }
        if (!row) {
          // Don't leave an orphaned R2 object when the DB row didn't save.
          try { await env.BUCKET.delete(key); } catch (_) {}
          console.error("booking_document insert failed", insErr);
          return json({ error: "Couldn't save the record. If this is an invoice, re-run smm_crm.sql (adds invoice_date / paid_date).", detail: insErr }, 502, request, env);
        }
        return json({ ok: true, document: row }, 200, request, env);
      }

      // ---- Admin: remove a document (R2 object + row) ----
      if (path.endsWith("/booking/document") && request.method === "DELETE") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const id = (url.searchParams.get("id") || "").trim();
        if (!id) return json({ error: "Missing id" }, 400, request, env);
        const rows = await sbGet(env, "booking_documents", `id=eq.${encodeURIComponent(id)}&select=r2_key`);
        const doc = rows && rows[0];
        if (doc && doc.r2_key) { try { await env.BUCKET.delete(doc.r2_key); } catch (_) {} }
        await fetch(`${env.SUPABASE_URL}/rest/v1/booking_documents?id=eq.${encodeURIComponent(id)}`, {
          method: "DELETE", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}` },
        });
        return json({ ok: true }, 200, request, env);
      }

      // ---- Member (or admin): download a booking document (ownership-checked) ----
      if (path.endsWith("/booking/document") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user) return json({ error: "Sign in to download." }, 401, request, env);
        const id = (url.searchParams.get("id") || "").trim();
        if (!id) return json({ error: "Missing id" }, 400, request, env);
        const rows = await sbGet(env, "booking_documents", `id=eq.${encodeURIComponent(id)}&select=*`);
        const doc = rows && rows[0];
        if (!doc) return json({ error: "Not found" }, 404, request, env);
        const owns = (doc.account_user_id && doc.account_user_id === user.id) ||
          (doc.client_email && String(doc.client_email).toLowerCase() === String(user.email || "").toLowerCase());
        if (!owns && !isAdminEmail(user)) return json({ error: "Forbidden" }, 403, request, env);
        const obj = await env.BUCKET.get(doc.r2_key);
        if (!obj) return json({ error: "File missing" }, 404, request, env);
        const headers = new Headers(corsHeaders(request, env));
        obj.writeHttpMetadata(headers);
        headers.set("etag", obj.httpEtag);
        headers.set("Content-Disposition", `attachment; filename="${String(doc.file_name || "document").replace(/"/g, "")}"`);
        return new Response(obj.body, { headers });
      }

      // ---- Admin: bulk-import contacts (one chunk of rows per request) --------
      // ---- Admin: a member's last hub login (from Supabase Auth) -----------
      // The contact record only tracks last_seen_at (any touchpoint); the real
      // "last logged into the members hub" is auth.users.last_sign_in_at, which
      // only the service role can read — so it comes through here.
      if (path.endsWith("/contacts/member-login") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const uid = new URL(request.url).searchParams.get("user_id");
        if (!uid) return json({ error: "Missing user_id." }, 400, request, env);
        const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(uid)}`, {
          headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}` },
        });
        if (!res.ok) return json({ last_sign_in_at: null }, 200, request, env);
        const u = await res.json().catch(() => ({}));
        return json({ last_sign_in_at: (u && u.last_sign_in_at) || null }, 200, request, env);
      }

      if (path.endsWith("/contacts/import") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const rows = Array.isArray(b.rows) ? b.rows : [];
        const batchTags = Array.isArray(b.batch_tags) ? b.batch_tags : [];
        const optIn = b.marketing_opt_in === true;
        const source = (typeof b.source === "string" && b.source.trim()) ? b.source.trim() : "import";
        if (!rows.length) return json({ error: "No rows." }, 400, request, env);
        if (rows.length > 500) return json({ error: "Send at most 500 rows per request." }, 400, request, env);
        let imported = 0, skipped = 0;
        for (const r of rows) {
          const email = String((r && r.email) || "").trim().toLowerCase();
          if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { skipped++; continue; }
          const rowTags = Array.isArray(r.tags) ? r.tags : (r.tags ? String(r.tags).split(/[;,]/).map((s) => s.trim()) : []);
          const tags = Array.from(new Set([...rowTags, ...batchTags, optIn ? "Newsletter-Subscriber" : null, networkTag(email)].filter(Boolean)));
          try {
            await sbRpc(env, "upsert_contact", {
              p_email: email,
              p_first_name: r.first_name || null,
              p_last_name: r.last_name || null,
              p_phone: r.phone || null,
              p_company: r.company || null,
              p_source: source,
              p_lifecycle: "lead",
              p_marketing_opt_in: optIn ? true : null,
              p_tags: tags,
            });
            imported++;
          } catch (_) { skipped++; }
        }
        return json({ ok: true, imported, skipped }, 200, request, env);
      }

      return json({ error: "Not found" }, 404, request, env);
    } catch (err) {
      return json({ error: String(err && err.message ? err.message : err) }, 500, request, env);
    }
  },
};
