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
import { EMAIL_STYLE_DEFAULTS, emailStyleStrings, styleEmailContent } from "../../src/lib/email-styles.js";
import { OFF_LOCATION_SERVICES, OFF_LOCATION_BUFFER_DAYS } from "../../src/lib/videography-config.js";
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
function defaultInvoiceEmailText(settings, inv, bk) {
  const company = settings.company_name || "The Marketing Experts (Nationwide) Ltd";
  const due = invoiceDueNice(inv);
  // A brand invoice - Fine & Country or a TEG sister brand - goes to someone
  // settling somebody else's shoot, so the agent's name rides along with the
  // invoice number everywhere it appears - otherwise the recipient cannot
  // tell one shoot from another.
  const isFC = bk && bk.payment_route === "brand_invoice";
  const isTeg = bk && bk.payment_route === "brand_invoice_teg";
  const brand = isFC || isTeg;
  const agent = (bk && bk.client_name) || "";
  const ref = brand && agent ? `${inv.number} - ${agent}` : inv.number;
  // TEG's invoice goes to Paula's inbox regardless of which brand is settling
  // it, so the greeting addresses her - the brand name still appears on the
  // invoice itself (bill_to_name), just not in "Dear ...".
  const greeting = isTeg ? "Paula" : (inv.bill_to_name || "Sir or Madam");
  const lines = [
    `Dear ${greeting},`, "",
    `Please find attached invoice ${ref} from ${company}.`, "",
    `Amount due: ${money(inv.total_pence)}`,
  ];
  if (due) lines.push(`Due date: ${due}`);
  if (isFC) {
    const where = (bk.property_address || bk.location || "").replace(/\s*\n\s*/g, ", ").trim();
    lines.push("", `This invoice is in relation to the ${(bk.service || "property videography").toLowerCase()} shoot with ${agent || "the agent"}${where ? ` at ${where}` : ""}. You are receiving it because we have been informed you are holding the client's marketing fee.`);
  } else if (isTeg) {
    if (bk.teg_reason === "induction") {
      lines.push("", `This invoice is in relation to ${agent || "the new starter"}'s induction shoot. You are receiving it because the shoot cost was included in their joining fee.`);
    } else {
      const reasonName = bk.teg_reason === "other" ? (bk.teg_reason_other || "an internal brand arrangement") : (TEG_REASON_LABELS[bk.teg_reason] || "an internal brand arrangement");
      lines.push("", `This invoice is in relation to ${reasonName.toLowerCase()}${agent ? ` for ${agent}` : ""}. You are receiving it as the settling brand rather than the client.`);
    }
  }
  // When the invoice carries a pay link, say so - telling someone to pay by
  // bank transfer while a card button sits above it just reads as contradictory.
  lines.push("", inv.pay_by_card ? `Payment is due${due ? ` by ${due}` : ""}. You can pay by card using the button in this email, or by bank transfer using the account details on the invoice, quoting ${inv.number} as the reference. If you have any questions, just reply to this email.`
    : `Payment is due${due ? ` by ${due}` : ""} by bank transfer - the account details are on the invoice, please quote ${inv.number} as the reference. If you have any questions, just reply to this email.`, "", "Kind regards,", company);
  // Shoots only. An SMM invoice must not promise anything about content.
  if (inv.release_on_payment && !brand) {
    lines.splice(lines.length - 2, 0, "Payment isn't required until your shoot has taken place. Your content stays watermarked and locked until payment reaches us - once it does we'll email your PIN, which unlocks downloading from your gallery.", "");
  }
  return lines.join("\n");
}
// The invoice covering email: a body (the sender's edited text if provided, else
// the default) followed by the optional footer image. PDF attached separately.
function invoiceEmailHtml(settings, inv, customBodyText, payUrl, bk) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const br = (s) => esc(s).replace(/\n/g, "<br>");
  const bodyText = (customBodyText != null && String(customBodyText).trim()) ? customBodyText : defaultInvoiceEmailText(settings, inv, bk);
  const footer = settings.email_footer_image_url
    ? `<div style="margin-top:26px"><img src="${esc(settings.email_footer_image_url)}" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0" /></div>`
    : "";
  // Only when the sender ticked card payment. Bank details stay on the PDF
  // either way, so this adds an option rather than replacing one.
  const pay = payUrl
    ? `<p style="${EM_P}"><a href="${esc(payUrl)}" style="${EM_BTN}">Pay ${gbpW(inv.total_pence || 0)} by card</a></p>
       <p style="${EM_SMALL}">Card payments are handled by Stripe - we never see your card details. You can still pay by bank transfer using the details on the invoice.</p>`
    : "";
  return `<div style="${EM_WRAP}"><p style="${EM_P}">${br(bodyText)}</p>${pay}${footer}</div>`;
}

// ---- Direct Debit "ghost" invoices --------------------------------------
const DD_DEFAULT_RECIPIENT = "danielle@tmke.co.uk";
// TESTING SWITCH: while true, EVERY invoice email (client send, DD ghost, void)
// is redirected to Danielle only — no real clients, no Paula.
//
// LIVE since 5 Aug 2026, on James's say-so, so that SMM invoices can actually
// go out. Three sends are affected, but only one of them reaches a client:
//   - /invoicing/invoices/send  → the client's bill_to_email, plus the CC
//   - the DD ghost invoice      → dd_invoice_email or Danielle (internal)
//   - the void notice           → the accounts address (internal)
//
// The machinery is kept rather than deleted: flip this back to true and every
// invoice email lands on Danielle again, which is the fastest way to test a
// change to invoice mail without involving a client.
const INVOICE_TEST_MODE = false;
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
  return `<div style="${EM_WRAP}">
    <p style="margin:0 0 14px">This is an automated reminder for the books - <strong>no action needed with the client</strong> (they pay by Direct Debit through QuickBooks).</p>
    <table style="border-collapse:collapse;margin:0 0 14px;font-size:12px">
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
      subject: `Direct Debit invoice ${inv.number} - ${billName} (${monthLabel})`,
      html: await wrapInBrandedBase(env, ddReminderHtml(billName, monthLabel, inv)),
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
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
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
    const label = `New-starter free videography - ${[contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email}`;
    const gen = await generateAgentCode(env, { pkg, firstName: contact.first_name, lastName: contact.last_name, inductionMonth, label });
    if (gen) { promoCode = gen.code; promoCodeId = gen.id; }
  }

  const coalesce = (a, b) => (a != null && a !== "" ? a : (b != null ? b : null));
  const brand = coalesce(input.brand, existing && existing.brand);
  const tr = trainerForBrand(brand);
  const row = {
    contact_id: contactId,
    brand,
    date_joined: coalesce(input.date_joined, existing && existing.date_joined),
    postcode: coalesce(input.postcode, existing && existing.postcode),
    // Don't demote an existing new-starter when re-touched by a non-new-starter
    // path (e.g. an internal-agent import of someone already flagged).
    is_new_starter: isNewStarter || !!(existing && existing.is_new_starter),
    induction_month: inductionMonth || (existing && existing.induction_month) || null,
    package: pkg || (existing && existing.package) || null,
    promo_code: promoCode,
    promo_code_id: promoCodeId,
    trainer_name: coalesce(input.trainer_name, (existing && existing.trainer_name)) || tr.name,
    trainer_email: coalesce(input.trainer_email, (existing && existing.trainer_email)) || tr.email,
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
// Whoever fills the TEG sheet types this by hand (there's no date picker), so be
// generous: "July 2026", "July, 2026", "Jul 26", "2026-07", "01/07/2026" and a
// bare "July" all resolve. A bare month has no year, so we take the next one
// coming up (this month counts). Returns "YYYY-MM" or null.
function parseShootMonth(s) {
  s = String(s || "").trim().replace(/,/g, " ").replace(/\s+/g, " ");
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/](\d{1,2})/); if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}`;
  const mn = s.match(/([A-Za-z]{3,})[\s\-/]*(\d{2,4})/);
  if (mn) { const mi = MONTHS_FULL.findIndex((x) => x.toLowerCase().startsWith(mn[1].slice(0, 3).toLowerCase())); if (mi >= 0) { let y = mn[2]; if (y.length === 2) y = "20" + y; return `${y}-${String(mi + 1).padStart(2, "0")}`; } }
  const d = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/); if (d) { let y = d[3]; if (y.length === 2) y = "20" + y; return `${y}-${String(d[2]).padStart(2, "0")}`; }
  // Bare month name, no year ("July") → the next occurrence, current month included.
  const bare = s.match(/^([A-Za-z]{3,})$/);
  if (bare) {
    const mi = MONTHS_FULL.findIndex((x) => x.toLowerCase().startsWith(bare[1].slice(0, 3).toLowerCase()));
    if (mi >= 0) {
      const now = new Date();
      const y = now.getUTCFullYear() + (mi < now.getUTCMonth() ? 1 : 0);
      return `${y}-${String(mi + 1).padStart(2, "0")}`;
    }
  }
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
  try { await sbPost(env, "contact_notes", { contact_id: contactId, body: "Induction cancelled (TEG sheet) - free-videography code voided and marked do-not-contact.", author: "Sheet sync" }); } catch (_) {}
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
  // Columns are found by HEADER NAME, never by letter — inserting a column in
  // the sheet shifts nothing here. colAny() takes the likely wordings so a
  // header tweak doesn't silently drop a field.
  const headers = (rows[0] || []).map((h) => String(h || "").trim().toLowerCase());
  const col = (name) => headers.indexOf(name.toLowerCase());
  const colAny = (...names) => { for (const n of names) { const i = col(n); if (i >= 0) return i; } return -1; };
  const idx = {
    name: col("Agent Name"), brand: col("Brand"), phone: col("Phone Number"), email: col("Email"),
    // Personal address, so the onboarding funnel reaches a new starter who
    // can't read their work inbox until day one.
    email2: colAny("Second Email", "Secondary Email", "Personal Email", "2nd Email", "Second email address"),
    postcode: col("Post Code"), package: col("Package"), induction: col("Induction Date"),
    month: col("Preferred Shoot Month"), cancelled: col("Cancelled"),
  };
  let processed = 0, enrolled = 0, cancelled = 0, skipped = 0;
  // Per-row trace so "added to the sheet but never enrolled" is diagnosable —
  // it's returned by POST /agent/sync (admin only). Enrolment needs a promo
  // code, which needs a parseable Preferred Shoot Month, so that's the usual
  // culprit and now it's visible rather than silent.
  const details = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const cell = (c) => (c >= 0 ? String(r[c] || "").trim() : "");
    const email = cell(idx.email).toLowerCase();
    const pkg = cell(idx.package).toLowerCase();
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email) || !["pro", "academy"].includes(pkg)) {
      skipped++;
      details.push({ row: i + 2, email: email || null, skipped: !email ? "no email" : (!/^[^@]+@[^@]+\.[^@]+$/.test(email) ? "bad email" : "package not pro/academy") });
      continue;
    }
    const parts = cell(idx.name).split(/\s+/).filter(Boolean);
    const first = parts.shift() || null, last = parts.join(" ") || null;
    const brand = cell(idx.brand) || null;
    const isCancelled = /^(y|yes|true|1|cancelled)$/i.test(cell(idx.cancelled));
    try {
      // NB don't pass p_lifecycle here: upsert_contact does
      // `lifecycle = coalesce(p_lifecycle, existing)`, so forcing "teg" every
      // 15-minute re-sync would clobber a manual "Past" (and any later state).
      // The CRM derives TEG from the new-starter tag + source instead.
      const cid = await sbRpc(env, "upsert_contact", { p_email: email, p_first_name: first, p_last_name: last, p_phone: cell(idx.phone) || null, p_company: brand, p_source: "agent_sheet_sync", p_tags: crmTags(email, [], {}) });
      const contactId = Array.isArray(cid) ? cid[0] : cid;
      if (!contactId) { skipped++; continue; }
      // Secondary (personal) email — a delivery address only; identity stays the
      // work email. Only written when the sheet has one, so it never wipes an
      // address added by hand on the contact card.
      const sec = cell(idx.email2).toLowerCase();
      if (sec && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sec) && sec !== email) {
        try { await sbPatch(env, "contacts", `id=eq.${encodeURIComponent(contactId)}`, { secondary_email: sec }); } catch (_) {}
      }
      if (isCancelled) {
        const acted = await cancelAgentStarter(env, contactId);
        if (acted) cancelled++; else skipped++;
        continue;
      }
      const monthRaw = cell(idx.month);
      const month = parseShootMonth(monthRaw);
      const res = await ensureAgentProfile(env, contactId, { first_name: first, last_name: last, email }, {
        brand, date_joined: parseISODate(cell(idx.induction)), postcode: cell(idx.postcode) || null,
        is_new_starter: true, induction_month: month, package: pkg,
      });
      processed++; if (res._enrolled) enrolled++;
      details.push({
        row: i + 2, email, package: pkg,
        month_raw: monthRaw || null, month, code: res.promo_code || null, enrolled: !!res._enrolled,
        note: res._enrolled ? null : (!month
          ? ('couldn\'t read Preferred Shoot Month: "' + (monthRaw || "") + '" - no code, so no funnel')
          : "no promo code"),
      });
    } catch (e) {
      skipped++;
      details.push({ row: i + 2, email, skipped: String((e && e.message) || e).slice(0, 120) });
    }
  }

  // Starters whose row was DELETED from the sheet rather than marked Cancelled.
  // Deleting is the intuitive-but-wrong action: it leaves them enrolled in the
  // funnel with a live code, and the sync can't see a row that isn't there. No
  // auto-cancel — a fat-fingered deletion must never DND anyone — instead flag
  // it to a human, once per person (deduped via the note on their card).
  let missing = 0;
  try {
    const seen = new Set();
    for (let i = 1; i < rows.length; i++) {
      const e = idx.email >= 0 ? String((rows[i] || [])[idx.email] || "").trim().toLowerCase() : "";
      if (e) seen.add(e);
    }
    const profs = (await sbGet(env, "agent_profiles", `is_new_starter=eq.true&select=contact_id,status,promo_code`)) || [];
    const live = profs.filter((p) => p.status !== "cancelled");
    const vanished = [];
    if (live.length) {
      const cs = (await sbGet(env, "contacts", `id=in.(${live.map((p) => p.contact_id).join(",")})&select=id,email,first_name,last_name,source`)) || [];
      for (const c of cs) {
        if (c.source !== "agent_sheet_sync") continue;               // only sheet-managed starters
        if (seen.has(String(c.email || "").toLowerCase())) continue; // still on the sheet
        const already = (await sbGet(env, "contact_notes", `contact_id=eq.${encodeURIComponent(c.id)}&author=eq.Sheet%20sync&body=ilike.*vanished%20from%20the%20TEG%20sheet*&select=id&limit=1`)) || [];
        if (already.length) continue;                                // flagged before
        await sbPost(env, "contact_notes", { contact_id: c.id, body: "Vanished from the TEG sheet without being marked Cancelled - flagged to Danielle. Their funnel and free-videography code are still live until someone decides.", author: "Sheet sync" });
        const prof = live.find((p) => p.contact_id === c.id) || {};
        vanished.push({ name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email, email: c.email, code: prof.promo_code || null });
      }
    }
    if (vanished.length) {
      missing = vanished.length;
      const escH = (s) => String(s || "").replace(/</g, "&lt;");
      const items = vanished.map((v) => `<li style="margin:4px 0"><strong>${escH(v.name)}</strong> (${escH(v.email)})${v.code ? ` - free-videography code <code>${escH(v.code)}</code> still live` : ""}</li>`).join("");
      await sendEmail(env, {
        to: "danielle@themarketingexperts.co.uk",
        subject: `TEG sheet: ${vanished.length} new starter${vanished.length === 1 ? " has" : "s have"} vanished without being cancelled`,
        html: `<div style="${EM_WRAP}">
          <p>These new starters are still active in the system, but their row has disappeared from the Agent Videography New Starters sheet - usually someone deleting the row instead of marking the <strong>Cancelled</strong> column:</p>
          <ul>${items}</ul>
          <p><strong>Nothing has been stopped automatically</strong> - they're still in the onboarding funnel and their code still works, in case the deletion was an accident.</p>
          <p>If they're genuinely not joining: re-add their row to the sheet with <strong>Cancelled = yes</strong> and the next sync will void the code, stop the emails and note their card. (Or tick Do-not-contact on their contact card to stop emails immediately.)</p>
          <p style="${EM_SMALL}">Sent automatically by the sheet sync. You'll only be told once per person.</p>
        </div>`,
      });
    }
  } catch (_) { /* the flag is a bonus - never break the sync */ }

  return { ok: true, rows: rows.length - 1, processed, enrolled, cancelled, skipped, missing, details };
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
// `onError` is optional and receives (status, bodyText) when the call fails.
// Without it a failed RPC is indistinguishable from one that legitimately
// returned null, which is exactly how a broken contact write stayed invisible.
async function sbRpc(env, fn, args, onError) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args || {}),
  });
  if (!res.ok) {
    if (onError) {
      const body = await res.text().catch(() => "");
      console.error(`sbRpc ${fn} failed`, res.status, body);
      try { onError(res.status, body); } catch (_) {}
    }
    return null;
  }
  try { return await res.json(); } catch (_) { return null; }
}
const hmToMin = (hm) => { const [h, m] = String(hm).split(":").map(Number); return h * 60 + m; };
const minToHm = (min) => String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");

// A link straight to the folder in the Cloudflare dashboard. Needs the account
// id, which only appears in the dashboard URL - so it is a var rather than
// something we can work out. Without it we simply don't offer a link, rather
// than offering one that 404s.
// Straight to the folder inside the bucket. Confirmed against the dashboard's
// own address bar (12 Aug 2026) - no /objects segment, prefix directly on the
// bucket path, encoded the way URLSearchParams does it (+ for spaces, %2F for
// slashes) rather than encodeURIComponent's %20. An earlier ?prefix= attempt
// used the S3 LIST API's encoding instead and landed on a "Failed to find
// Object" page - this is the actual dashboard route, not a guess.
function r2DashUrl(env, folder) {
  const acct = env.CF_ACCOUNT_ID;
  if (!acct || !folder) return null;
  const bucket = env.R2_BUCKET_NAME || "tmke-deliverables";
  const prefix = `${PART_PREFIX}/${folder}/`;
  const qs = new URLSearchParams({ prefix }).toString();
  return `https://dash.cloudflare.com/${acct}/r2/default/buckets/${bucket}?${qs}`;
}

// Build a readable object key: <prefix>/<folder>/<category>/<file>. Slashes are
// stripped from each part first - one inside a name would silently create an
// extra level of folder, which is how a tidy scheme quietly stops being tidy.
function safeFolderKey(folder, category, fileName) {
  const part = (v, max) => String(v || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^a-zA-Z0-9._&()' -]/g, "")
    .slice(0, max || 120);
  const f = part(folder, 140) || "unfiled";
  const c = part(category, 40);
  const name = String(fileName || "file").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120);
  return [PART_PREFIX, f, c, name].filter(Boolean).join("/");
}

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
// Is this company one of The Experts Group brands? Used to auto-flag imported
// internal agents even when they're on a personal email (brand in a column).
function isTegBrand(company) {
  const c = String(company || "").toLowerCase();
  if (!c) return false;
  return /\b(property|lettings|recruitment|marketing|mortgage)\s+experts\b/.test(c)
    || /prestige\s+property\s+experts/.test(c)
    || /fine\s*(?:&|and)\s*country/.test(c);
}
// The videography trainer only applies to The Property Experts family — other TEG
// brands (Lettings/Recruitment/etc.) don't get the same training, so their
// trainer is N/A rather than a misleading "Kelly".
function trainerForBrand(brand) {
  return /property\s+experts/i.test(String(brand || ""))
    ? { name: "Kelly Bailey", email: "kelly@theexpertsgroup.co.uk" }
    : { name: "N/A", email: "N/A" };
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
// Legacy names (CSV imports pass Tags/Type column values through verbatim)
// heal to their framework equivalents first.
const TAG_ALIASES = {
  "TEG": "Network: TEG",
  "Estate Agent": "Type: Estate-Agent",
  "Lettings": "Type: Lettings",
  "Financial Services": "Type: Financial-Services",
  "Fine & Country": "Network: Fine-and-Country",
  "Fine and Country": "Network: Fine-and-Country",
};
function normalizeTags(tags) {
  let t = Array.from(new Set((tags || []).map((x) => String(x || "").trim()).filter(Boolean).map((x) => TAG_ALIASES[x] || x)));
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

// stripeApi() only does POST. Stripe's list endpoints are GET, so reporting
// needs its own door.
async function stripeGet(env, path, query) {
  const qs = new URLSearchParams();
  Object.entries(query || {}).forEach(([k, v]) => { if (v !== undefined && v !== null) qs.append(k, String(v)); });
  const res = await fetch(`https://api.stripe.com/v1/${path}?${qs}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data && data.error && data.error.message) || ("Stripe " + res.status));
  return data;
}

// Walks `has_more`, because a busy month past 100 rows would otherwise be
// silently truncated - and a payments list that quietly drops payments is
// worse than no list at all. Hard-capped so a runaway can't hold the request
// open forever; the caller is told when the cap bites.
async function stripeList(env, path, query, cap = 1000) {
  const out = [];
  let startingAfter = null, truncated = false;
  for (let page = 0; page < 25; page++) {
    const q = { ...(query || {}), limit: 100 };
    if (startingAfter) q.starting_after = startingAfter;
    const res = await stripeGet(env, path, q);
    const rows = Array.isArray(res.data) ? res.data : [];
    out.push(...rows);
    if (!res.has_more || !rows.length) break;
    if (out.length >= cap) { truncated = true; break; }
    startingAfter = rows[rows.length - 1].id;
  }
  return { rows: out, truncated };
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
// ---- Unsubscribe links -----------------------------------------------------
// A marketing email carries a link with a signed token, so one click can
// unsubscribe that exact person without them signing in — and nobody can
// unsubscribe a colleague by editing the address in the URL.
//
// Format: <base64url(email)>.<hmac>. Deliberately stateless and with no expiry:
// an email can sit in an inbox for a year and its unsubscribe link must still
// work on the day they finally get fed up.
//
// Uses UNSUBSCRIBE_SECRET when set. Falls back to the service-role key so this
// works without another secret having to be added in Cloudflare — but a
// dedicated UNSUBSCRIBE_SECRET is better, so that leaking one isn't leaking both.
function unsubSecret(env) {
  return env.UNSUBSCRIBE_SECRET || env.SUPABASE_SERVICE_ROLE || "";
}

async function unsubSign(env, email) {
  const secret = unsubSecret(env);
  const addr = String(email || "").trim().toLowerCase();
  if (!secret || !addr) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`unsub:${addr}`));
  return `${_b64urlStr(addr)}.${_b64url(mac)}`;
}

// Returns the address a token vouches for, or null if it's been tampered with.
async function unsubVerify(env, token) {
  try {
    const raw = String(token || "");
    const dot = raw.indexOf(".");
    if (dot < 1) return null;
    const addr = atob(raw.slice(0, dot).replace(/-/g, "+").replace(/_/g, "/"));
    const expect = await unsubSign(env, addr);
    if (!expect) return null;
    // Constant-time compare, same as stripeVerify above.
    if (raw.length !== expect.length) return null;
    let diff = 0;
    for (let i = 0; i < raw.length; i++) diff |= raw.charCodeAt(i) ^ expect.charCodeAt(i);
    return diff === 0 ? addr : null;
  } catch (_) { return null; }
}

// Mirrors FC_OFFICES in src/lib/videography-config.js. Duplicated because the
// Worker doesn't import from the site bundle; keep the two in step.
const FC_OFFICE_LABELS = {
  fc_midlands: "Fine & Country Midlands",
  fc_stratford: "Fine & Country Stratford",
};

// Mirrors TEG_REASONS in src/lib/videography-config.js. Same duplication, same
// reason - keep the two in step.
const TEG_REASON_LABELS = {
  induction: "New Starter Induction Shoot - Pro / Academy",
  event: "Brand Event Coverage",
  marketing: "Brand Marketing Content",
};

// Mirrors the "faux-twilight" addOn and EXTRA_IMAGES_BUNDLE in
// src/lib/videography-config.js. Same duplication, same reason. Prices are
// re-derived from THESE constants at request time - the public edit-request
// page never gets to say what anything costs.
// Everything a customer buys direct is quoted EX-VAT — the pack pages say
// "£24 +VAT", the videography rate card says "£25 +VAT per image" — so the
// figure that reaches Stripe has to be grossed up first. Packs and the edit
// upsells were both charging the bare net figure, so no VAT was collected on
// either.
//
// The rate comes from invoice_settings, the same place the admin centre's
// invoices read it, so there is one number to change rather than several.
async function vatBreakdown(env, netPence) {
  let rate = 20;
  try {
    const st = (await sbGet(env, "invoice_settings", "id=eq.1&select=vat_rate"))?.[0];
    if (st && st.vat_rate != null) rate = Number(st.vat_rate);
  } catch (_) { /* fall back to the statutory rate rather than under-charging */ }
  const net = Math.round(Number(netPence) || 0);
  const vat = Math.round(net * rate / 100);
  return { net, vat, gross: net + vat, rate };
}

// email -> last reset-link send (ms). See /auth/reset-link for why this is only
// a speed bump.
const RESET_COOLDOWN = new Map();

const FAUX_TWILIGHT_PRICE_PENCE = 2500;
const EXTRA_IMAGES_BUNDLE = { qty: 5, price_pence: 2400 };

// ---- Invoice pay links ---------------------------------------------------
//
// The link we email points HERE, not at Stripe. A Stripe Checkout Session
// expires after 24 hours, which is no use on an invoice with 30-day terms, so
// the client's click mints a fresh session each time.
//
// The token is an HMAC over the invoice id, so the URL cannot be guessed or
// edited to point at somebody else's invoice.
async function invoicePaySign(env, invoiceId) {
  const secret = unsubSecret(env);
  const id = String(invoiceId || "").trim();
  if (!secret || !id) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`invoicepay:${id}`));
  return `${_b64urlStr(id)}.${_b64url(mac)}`;
}

// Returns the invoice id a token vouches for, or null if it has been tampered with.
async function invoicePayVerify(env, token) {
  try {
    const raw = String(token || "");
    const dot = raw.indexOf(".");
    if (dot < 1) return null;
    const id = atob(raw.slice(0, dot).replace(/-/g, "+").replace(/_/g, "/"));
    const expect = await invoicePaySign(env, id);
    if (!expect) return null;
    if (raw.length !== expect.length) return null;   // constant-time compare
    let diff = 0;
    for (let i = 0; i < raw.length; i++) diff |= raw.charCodeAt(i) ^ expect.charCodeAt(i);
    return diff === 0 ? id : null;
  } catch (_) { return null; }
}

// Same base as the unsubscribe link, and the same caveat: this must point at
// the Worker, not the website. A *.workers.dev payment link reads as phishing,
// which matters more here than anywhere else on the site - we are asking
// someone to type card details. Worth a real route before this goes to clients.
// The one question the gallery, the tour, the PIN and the amends page all ask.
//
// A shoot covered by a social media package has no invoice and never gets a
// paid_at, but it is as paid as anything here gets — the money arrived with
// the monthly package. Testing paid_at alone locks those clients out of work
// they have already paid for, so every release check goes through here.
function isSettled(bk) {
  return !!bk && (!!bk.paid_at || bk.payment_route === "smm_package");
}

async function invoicePayUrl(env, invoiceId) {
  const t = await invoicePaySign(env, invoiceId);
  return t ? `${unsubBase(env)}/invoicing/pay?t=${encodeURIComponent(t)}` : null;
}

// A plain page for the states where there is nothing to pay. Deliberately not
// a JSON error - the person reading this is a client, not a developer.
function invoicePayPage(title, message) {
  return `<!doctype html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title></head>
    <body style="margin:0;background:#f4f2f1;font-family:Verdana,Geneva,sans-serif;color:#371e28">
      <div style="max-width:520px;margin:14vh auto;padding:0 24px;text-align:center">
        <h1 style="font-size:24px;font-weight:400;line-height:1.6;margin:0 0 14px">${title}</h1>
        <p style="font-size:12px;line-height:1.6;margin:0">${message}</p>
      </div>
    </body></html>`;
}

// The public unsubscribe URL for a given address.
//
// IMPORTANT: this must point at wherever the WORKER is reachable, not at the
// website. /unsubscribe is served by this Worker; the Astro site knows nothing
// about it, so https://tmke.co.uk/unsubscribe would 404 unless a Cloudflare
// route maps that path to the Worker.
//
// Preferred: add a route so the link sits on tmke.co.uk — an unsubscribe link
// pointing at a *.workers.dev address looks like phishing to both recipients
// and spam filters, which is the opposite of what we want on marketing mail.
// Set UNSUB_BASE_URL once that route exists.
//
// Until then it falls back to the Worker's own origin, which at least works.
function unsubBase(env) {
  const explicit = env.UNSUB_BASE_URL || env.WORKER_PUBLIC_URL;
  if (explicit) return String(explicit).replace(/\/+$/, "");
  // Back on the workers.dev address: the tmke.co.uk/unsubscribe route had to be
  // removed because declaring it disabled this Worker's workers.dev subdomain,
  // which the whole site depends on. See the note in wrangler.toml.
  // Moving the link onto tmke.co.uk is still wanted - a *.workers.dev
  // unsubscribe link reads as phishing - but it needs the subdomain sorted first.
  return "https://tmke-deliverables-api.tmke.workers.dev";
}

async function unsubUrlFor(env, email) {
  const token = await unsubSign(env, email);
  if (!token) return null;
  return `${unsubBase(env)}/unsubscribe?t=${encodeURIComponent(token)}`;
}

// The confirmation page. Branded rather than plain, but the unsubscribe has
// ALREADY happened by the time this renders — see the route for why.
function unsubPage({ email, state, resubToken }) {
  const gone = state === "done";
  const title = gone ? "Sorry to see you go" : state === "resubscribed" ? "Welcome back" : "Something went wrong";
  // `email` is the RECIPIENT's own address, not ours. The wording keeps it that
  // way round: "...emails from us at <address>" read as though the mail came
  // FROM that address, which is the opposite of what it means.
  const body = gone
    ? `<p class="u-lede">We've taken <strong>${email || "your address"}</strong> off our marketing list.</p>
       <p class="u-note">You'll still get anything you've actually asked us for - booking confirmations, receipts and the like. Those aren't marketing, and we won't stop them.</p>`
    : state === "resubscribed"
      ? `<p class="u-lede"><strong>${email || "Your address"}</strong> is back on the list. Good to have you.</p>`
      : `<p class="u-lede">That link doesn't look right - it may have been cut in half by your email app.</p>
         <p class="u-note">Email <a href="mailto:hello@tmke.co.uk">hello@tmke.co.uk</a> and we'll take care of it by hand.</p>`;
  const undo = gone && resubToken
    ? `<form method="POST" action="/unsubscribe/resubscribe?t=${encodeURIComponent(resubToken)}">
         <button type="submit" class="u-btn">Actually, that was a mistake - resubscribe me</button>
       </form>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} - TMKE</title>
<style>
  /* Brand colours, kept in step with src/styles/global.css:
     --english-violet #371e28 (the wine) · --accent #B9826A · --paper #f4f2f1
     Deliberately NOT theme-aware. Every other page follows the reader's
     light/dark setting, but this one is a single branded moment that arrives
     from an email - so it should look the same to everyone, rather than
     changing depending on how their phone happens to be set. A fixed dark
     background also can't be inverted into something unreadable. */
  :root { --wine:#371e28; --wine-lift:#50303d; --paper:#f4f2f1;
          --ink:#1c1d22; --muted:#6b6c75; --accent:#B9826A; }
  * { box-sizing:border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px;
         background:var(--wine); color:var(--ink);
         font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
         -webkit-font-smoothing:antialiased; }
  .u-card { width:100%; max-width:520px; background:var(--paper); border-radius:18px;
            padding:44px 40px; box-shadow:0 18px 50px rgba(0,0,0,.28); }
  /* The tan accent (#B9826A) only reaches 2.9:1 on paper - too low for 13px
     text - so the mark uses the wine instead. The accent stays as the rule
     beneath it, where it's decoration rather than something to be read. */
  .u-mark { font-size:13px; letter-spacing:.14em; text-transform:uppercase; font-weight:700;
            color:var(--wine); margin:0 0 16px; padding-bottom:14px;
            border-bottom:2px solid var(--accent); display:inline-block; }
  h1 { font-size:27px; line-height:1.2; margin:0 0 14px; letter-spacing:-.01em; color:var(--wine); }
  .u-lede { font-size:15px; line-height:1.6; margin:0 0 14px; }
  .u-note { font-size:14px; line-height:1.6; color:var(--muted); margin:0; }
  .u-btn { margin-top:26px; width:100%; padding:13px 18px; font:inherit; font-size:14px; font-weight:600;
           color:var(--paper); background:var(--wine); border:1px solid var(--wine);
           border-radius:11px; cursor:pointer; }
  .u-btn:hover { background:var(--wine-lift); border-color:var(--wine-lift); }
  a { color:var(--wine); }
</style></head><body>
  <main class="u-card">
    <p class="u-mark">TMKE</p>
    <h1>${title}</h1>
    ${body}
    ${undo}
  </main>
</body></html>`;
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
  return `<div style="${EM_WRAP}">
    <h1 style="${EM_H1}">Your post is ready to go out</h1>
    <p style="${EM_P}">Here's your planned <strong>${esc(platform)}</strong> post${item.title ? ` - &ldquo;${esc(item.title)}&rdquo;` : ""}. The image is attached, and there's a download button below - copy your caption and you're set.</p>
    ${cap ? `<div style="${EM_QUOTE_TEXT}">${cap}</div>` : `<p style="${EM_P}">No caption saved for this post.</p>`}
    ${asset ? `<p style="margin:20px 0 0"><a href="${asset}" style="${EM_BTN}">Download the image &darr;</a></p><p style="${EM_SMALL}">Tip: open this on your phone and tap Download to save it to your camera roll.</p>` : `<p style="${EM_P}">&#128206; Your post image is attached to this email.</p>`}
    <p style="${EM_SMALL}">Sent by TMKE &middot; <a href="https://tmke.co.uk/account/schedule" style="color:#371e28">View your calendar</a></p>
  </div>`;
}
function waitlistHtml({ name, service, pkg, date, time }) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let niceDate = esc(date);
  try { niceDate = new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch (_) {}
  return `<div style="${EM_WRAP}">
    <h1 style="${EM_H1}">You're on the cancellation list</h1>
    <p style="${EM_P}">Hi ${esc(name)}, thanks for registering your interest in <strong>${esc(service)}</strong>. We're fully booked right now, but you're on the list - we'll message you the moment a slot opens that matches what you're after.</p>
    <div style="${EM_QUOTE}">
      ${pkg ? `<div><strong>Package:</strong> ${esc(pkg)}</div>` : ""}
      <div><strong>Preferred date:</strong> ${niceDate}</div>
      <div><strong>Preferred time:</strong> ${esc(time)}</div>
    </div>
    <p style="${EM_P}">No need to do anything - we'll be in touch. If your plans change, just reply to this email.</p>
    <p style="${EM_SMALL}">Sent by TMKE &middot; <a href="https://tmke.co.uk/videography" style="color:#371e28">tmke.co.uk</a></p>
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
  const intro = isCall
    ? `Hi ${esc(name || "there")}, looking forward to chatting. Here's when - we've attached a calendar invite so it's in your diary.`
    : `Hi ${esc(name || "there")}, you're all set - here are the details. We've attached a calendar invite so you can drop it straight into your diary.`;
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
  const rowsHtml = rowsArr.filter(Boolean).map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`).join("");
  const totalHtml = (!isCall && totalPence != null)
    ? `<div><strong>Total:</strong> ${gbpW(totalPence)} inc. VAT</div>`
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
    ? `<p style="${EM_P}"><strong>${prepTitle}</strong></p>${prep.map(([h, t]) => `<p style="${EM_P}"><strong>${h}</strong> ${t}</p>`).join("")}`
    : "";

  const policy = isCall
    ? "Can't make it? You can rearrange any time from your account."
    : (kind === "property" || kind === "agent")
    ? "Travel is included in your total, calculated from the postcode above; if the location changes we'll re-quote before the shoot. Reschedule with 2 days' notice or cancel with 3 days' notice from your account."
    : "Need to change something? Reschedule with 2 days' notice or cancel with 3 days' notice from your account. Cancellations inside 72 hours are chargeable in full.";

  // A plain content block, like every other client email, so the branded base
  // supplies the card, header and footer. It used to carry its own complete
  // chrome - band, card, wordmark lockup, footer - because it was sent WITHOUT
  // the base, which is why it looked like a different product to everything
  // else and why the style controls had so little purchase on it.
  return `<div style="${EM_WRAP}">
    <h1 style="${EM_H1}">${heading}</h1>
    <p style="${EM_P}">${intro}</p>
    <div style="${EM_QUOTE}">${rowsHtml}${totalHtml}</div>
    ${manageUrl ? `<p style="${EM_P}"><a href="${esc(manageUrl)}" style="${EM_BTN}">${cta} &rarr;</a></p>` : ""}
    ${prepHtml ? `<hr style="${EM_RULE}" />` : ""}
    ${prepHtml}
    <p style="${EM_SMALL}">${policy}</p>
  </div>`;
}
function jackNotifyHtml({ name, company, email, phone, service, packageLabel, addOns, postcode, distanceMiles, surchargePence, dateNice, time, totalPence, signedName, marketingOptIn }) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const row = (k, v) => v ? `<div><span style="color:#888">${k}:</span> ${esc(v)}</div>` : "";
  return `<div style="${EM_WRAP}">
    <h1 style="${EM_H1}">New booking - ${esc(service)}</h1>
    <div style="${EM_QUOTE}">
      ${row("Client", name)}${row("Company", company)}${row("Email", email)}${row("Phone", phone)}
      ${row("Package", packageLabel)}${addOns && addOns.length ? row("Add-ons", addOns.map((a) => a.name).join(", ")) : ""}
      ${row("Location", postcode)}${distanceMiles != null ? row("Distance", Math.round(distanceMiles) + " mi") : ""}
      ${surchargePence ? row("Travel surcharge", gbpW(surchargePence) + " + VAT") : ""}
      ${row("Date", dateNice)}${row("Time", time)}
      ${totalPence != null ? row("Total", gbpW(totalPence) + " inc. VAT") : ""}
      ${row("Signed", signedName)}${row("Marketing opt-in", marketingOptIn ? "Yes" : "No")}
    </div>
    <p style="${EM_SMALL}">It's in your calendar and the CRM pipeline (stage: booked).</p>
  </div>`;
}
// Transactional email via Microsoft 365 (Graph `sendMail`), sent from the TMKE
// mailbox — so it genuinely comes from info@tmke.co.uk, replies land in the
// real inbox, and a copy sits in Sent Items. Reuses the same app-only token as
// the calendar integration (needs the `Mail.Send` application permission).
// Best-effort: never throws — the caller's record is already saved.
// Marketing email goes out via Resend, not Microsoft 365 — Resend reports
// bounces and complaints back to us, and Microsoft doesn't. See
// docs/email-suppression-plan.md.
//
// Carries the two headers Gmail, Outlook and Yahoo look for on bulk mail. They
// render their own unsubscribe control next to the sender name, which is both
// expected of bulk senders now and a good deal safer for us than someone
// reaching for the spam button instead.
//
//   List-Unsubscribe:      <https://tmke.co.uk/unsubscribe?t=…>
//   List-Unsubscribe-Post: List-Unsubscribe=One-Click
//
// The POST target must unsubscribe with no further interaction (RFC 8058) —
// that's why the page has no "are you sure?" step.
async function sendMarketingEmail(env, { to, subject, html, unsubUrl, replyTo }) {
  if (!env.RESEND_API_KEY) return { ok: false, error: "Resend isn't configured on the Worker (RESEND_API_KEY)." };
  if (!to) return { ok: false, error: "No recipient." };
  const headers = {};
  if (unsubUrl) {
    headers["List-Unsubscribe"] = `<${unsubUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Marketing comes from an address a human reads, not the posts@ mailbox
        // used for the scheduled-post reminders.
        from: env.MARKETING_MAIL_FROM || "TMKE <hello@tmke.co.uk>",
        reply_to: replyTo || env.MAIL_REPLY_TO || "hello@tmke.co.uk",
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        headers: Object.keys(headers).length ? headers : undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.message || `Resend returned ${res.status}` };
    // Resend's id ties this send to the bounce/open/click events that come back
    // on the webhook, so it has to be kept.
    return { ok: true, id: body.id || null };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e).slice(0, 200) };
  }
}

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
        // MAIL_FROM is posts@tmke.co.uk, which sends fine (the domain is
        // verified) but isn't a mailbox anyone reads. Point replies at a real
        // one so "please stop emailing me" reaches a human.
        reply_to: env.MAIL_REPLY_TO || "hello@tmke.co.uk",
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
// "Deliver at" on a send step — ms until the next occurrence of HH:MM UK time
// (0 = inside the window, send now). The 20-min grace after the target means a
// 5-min cron tick can never straddle the slot and push the send to tomorrow.
function msUntilSendWindow(hhmm) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || "").trim());
  if (!m) return 0;
  const lonNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/London" }));
  const target = new Date(lonNow); target.setHours(Number(m[1]), Number(m[2]), 0, 0);
  const diff = target - lonNow;
  if (diff > 0) return diff;              // later today
  if (diff > -20 * 60e3) return 0;        // inside the grace window
  return diff + 24 * 3600e3;              // same time tomorrow
}
// "Send on" (a date, optionally with a time) — ms until that moment, UK time.
// A date without a time means 9am that day. A date in the past sends now
// (funnels built in advance shouldn't wedge if activated late). No date falls
// back to the daily time window above.
function msUntilSendMoment(sendOn, hhmm) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(sendOn || "").trim());
  if (!d) return msUntilSendWindow(hhmm);
  const t = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || "").trim());
  const lonNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/London" }));
  const target = new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), t ? Number(t[1]) : 9, t ? Number(t[2]) : 0, 0, 0);
  const diff = target - lonNow;
  return diff > 0 ? diff : 0;
}

// `consentSource` names the form for the consent audit trail, for the cases
// where contactInput.source / payload.form aren't specific enough to be honest
// about it (the newsletter endpoint serves both the footer box and signup).
async function fireTrigger(env, triggerType, contactInput, payload, consentSource) {
  if (!triggerType || !contactInput || !contactInput.email) return { ok: false, error: "missing trigger or email" };
  if (!env.SUPABASE_SERVICE_ROLE) return { ok: false, error: "SUPABASE_SERVICE_ROLE not set" };
  // Checked before the upsert, because the upsert is what changes it.
  const priorOptIn = contactInput.marketing_opt_in === true ? await wasOptedIn(env, contactInput.email) : null;
  let rpcError = null;
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
  }, (status, body) => { rpcError = `upsert_contact ${status}: ${String(body || "").slice(0, 300)}`; });
  const contactId = Array.isArray(cid) ? cid[0] : cid;   // scalar uuid from the RPC
  if (!contactId) return { ok: false, error: rpcError || "upsert_contact returned no id" };

  // A genuine act of consent: they ticked a box or subscribed. Logged only on
  // the transition, so a second form doesn't produce a second "opted in".
  if (contactInput.marketing_opt_in === true && priorOptIn === false) {
    await logConsent(env, {
      contactId, email: contactInput.email, action: "opted_in", basis: "consent",
      source: consentSource || contactInput.source || (payload && payload.form) || triggerType,
      detail: "Opted in on a form on the website.",
      raw: payload || null,
    });
  }

  let autos = (await sbGet(env, "automations", `status=eq.active&trigger_type=eq.${encodeURIComponent(triggerType)}&select=id,graph,trigger_config`)) || [];
  // A tag landing also feeds "audience" funnels (everyone with these tags) —
  // someone who gains a qualifying tag after activation joins the group late.
  if (triggerType === "tag_added" && payload && payload.tag) {
    const aud = (await sbGet(env, "automations", `status=eq.active&trigger_type=eq.audience&select=id,graph,trigger_config`)) || [];
    autos = autos.concat(aud.filter((a) => Array.isArray((a.trigger_config || {}).tags) && a.trigger_config.tags.includes(payload.tag)));
  }
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
// Copy styles for emails that go through the branded base. The base supplies
// all the chrome (card, logo, divider, footer with contact + socials), so the
// content passed in is JUST the words — no wrapper div, no max-width, and no
// hand-rolled "Sent by TMKE" footer (the base already has one).
// House style for every automated email's body copy, to James's spec (31 Jul):
// Verdana throughout, body/button/quote 11px, headings 24px, line-height 1.6,
// dark #371e28 on light #f4f2f1, 10px radius on the quote box.
//
// Previously headings were Georgia and buttons Arial — two typefaces, neither
// of them the brand's, in the same email. That mismatch is what made these look
// subtly wrong without being nameable.
//
// These are fixed rather than read from the branded base on purpose: the base
// styles its OWN blocks, while this copy arrives as pre-built HTML, so the two
// have to be kept in step by hand. If that drifts, the fix is to make the base
// drive these (see the note on the content slot below).
// ---- The editable house style -------------------------------------------
//
// Defaults, the four shared style strings and the rewrite pass all live in
// src/lib/email-styles.js, so the Worker (which sends) and the admin editor
// (which previews) cannot drift apart.
//
// Every email is BUILT against the defaults and restyled once, on the way out,
// by styleEmailContent(). Nothing here is mutable: an admin previewing unsaved
// settings passes them in per call, so a preview can never bleed into a send
// happening at the same moment.
const EM_STR = emailStyleStrings(EMAIL_STYLE_DEFAULTS);
const EM_FONT = EM_STR.font, EM_DARK = EM_STR.dark, EM_LIGHT = EM_STR.light;
const EM_H1 = EM_STR.h1, EM_P = EM_STR.p, EM_QUOTE = EM_STR.quote, EM_BTN = EM_STR.btn, EM_SMALL = EM_STR.small, EM_WRAP = EM_STR.wrap, EM_QUOTE_TEXT = EM_STR.quoteText, EM_BTN_BARE = EM_STR.btnBare, EM_RULE = EM_STR.rule;

// The admin's saved settings, cached across requests in the same isolate. A
// minute is short enough that a change shows up almost at once, long enough
// that a busy send isn't querying per email.
let EMS = { ...EMAIL_STYLE_DEFAULTS };
let _emsAt = 0;
async function loadEmailStyles(env) {
  try {
    if (Date.now() - _emsAt < 60000) return;
    const rows = await sbGet(env, "email_styles", "id=eq.1&select=styles");
    EMS = { ...EMAIL_STYLE_DEFAULTS, ...((rows && rows[0] && rows[0].styles) || {}) };
    _emsAt = Date.now();
  } catch (_) { /* keep whatever we have; never block a send */ }
}

// Sample renders of the automated emails, so the admin Automated-emails page can
// show what one actually looks like — and send that exact render as a test.
// Shared by GET /email/preview and POST /email/preview/send so the preview and
// the test email can never drift apart. Returns { subject, html } or null.
function emailPreviewSample(id) {
  const SAMPLES = {
    post_reminder: () => ({ subject: "Your Instagram post is planned for today", html: reminderHtml({ title: "Spring launch teaser", asset_url: "https://assets.tmke.co.uk/white-1.webp" }, "Instagram", "New season, new listings ✨\n\nSwipe to see what's just come to market - book a viewing before they're gone.") }),
    setup_reminder: () => ({ subject: "Set your password to unlock your TMKE pack", html: setupReminderHtml({ name: "Alex Morgan", pack: "The Spring Collection", link: "https://tmke.co.uk/set-password?token=sample" }) }),
    waitlist_register: () => ({ subject: "You're on the cancellation list - The Studio", html: waitlistHtml({ name: "Alex Morgan", service: "The Studio", pkg: "Half day", date: "2026-08-25", time: "10:00" }) }),
    vid_booking_client: () => ({ subject: "Booking confirmed - Property Videography", html: bookingConfirmHtml({ name: "Alex Morgan", service: "Property Videography", serviceType: "property", packageLabel: "Premium", dateNice: "Tuesday, 25 August 2026", time: "10:00", addOns: ["Drone footage"], postcode: "NN14 1AA", surchargePence: 0, totalPence: 60000, manageUrl: "https://tmke.co.uk/manage?token=sample" }) }),
    vid_booking_team: () => ({ subject: "New booking - Property Videography - Alex Morgan", html: jackNotifyHtml({ name: "Alex Morgan", company: "Acme Estates", email: "alex@example.com", phone: "07700 900123", service: "Property Videography", packageLabel: "Premium", addOns: ["Drone footage"], postcode: "NN14 1AA", distanceMiles: 12, surchargePence: 0, dateNice: "Tuesday, 25 August 2026", time: "10:00", totalPence: 60000, signedName: "Jack", marketingOptIn: true }) }),
    invoice_sent: () => ({ subject: "Invoice TMKE1001 from The Marketing Experts (Nationwide) Ltd", html: invoiceEmailHtml({ company_name: "The Marketing Experts (Nationwide) Ltd", email_footer_image_url: null }, { number: "TMKE1001", bill_to_name: "Fine & Country", total_pence: 75000, due_date: "2026-08-31" }, null) }),
    invoice_dd_reminder: () => ({ subject: "Direct Debit invoice TMKE1002 - Acme Estates (August 2026)", html: ddReminderHtml("Acme Estates", "August 2026", { number: "TMKE1002", total_pence: 90000, due_date: "2026-08-15" }) }),
  };
  const fn = SAMPLES[id];
  return fn ? fn() : null;
}

// Where the email's own content is injected into the base. Carries that
// block's spacing so the message keeps the base's margins (vertical) and
// padding (horizontal inset) rather than losing tuned spacing.
function baseContentSlot(blk, contentHtml) {
  const p = (blk && blk.pad) || {};
  const wrap = [];
  if (p.t || p.r || p.b || p.l) wrap.push(`padding:${p.t || 0}px ${p.r || 0}px ${p.b || 0}px ${p.l || 0}px`);
  // Alignment DOES come from the base. The slot used to carry only padding and
  // margin, so a centred base still produced left-aligned content — the body
  // copy sets no text-align of its own, and had nothing to inherit from.
  if (['left', 'center', 'right'].includes(blk && blk.align)) wrap.push(`text-align:${blk.align}`);
  const inner = wrap.length ? `<div style="${wrap.join(';')};">${contentHtml}</div>` : contentHtml;
  const slot = { type: "code", id: "txc", html: inner };
  if (blk && blk.margin) slot.margin = blk.margin;
  return slot;
}
const BASE_SLOT_TOKEN = /\{\{\s*content\s*\}\}/i;
const isBaseSlot = (b) => BASE_SLOT_TOKEN.test(String((b && (b.html || b.text)) || ""));

async function wrapInBrandedBase(env, contentHtml, stylesOverride) {
  try {
    // stylesOverride lets the style editor preview unsaved settings through the
    // real send pipeline, without touching what a concurrent send uses.
    contentHtml = styleEmailContent(contentHtml, stylesOverride || EMS);
    // Named, not flagged: the base is whichever ACTIVE template has "base" in
    // its name, most recently updated. Fetch a few so a second one can be
    // warned about rather than silently winning.
    const rows = await sbGet(env, "email_templates", "name=ilike.*base*&status=eq.active&select=name,branding,blocks&order=updated_at.desc&limit=5");
    const base = rows && rows[0];
    if (!base || !Array.isArray(base.blocks) || !base.blocks.length) {
      // Silence here meant automated email went out completely unbranded with
      // nothing to show for it. Say so.
      console.error("branded base missing or empty - sending unbranded", rows ? rows.length : 0);
      return contentHtml;
    }
    if (rows.length > 1) {
      console.warn(`${rows.length} active templates match "base"; using "${base.name}"`, rows.map((r) => r.name).join(" | "));
    }

    // Two ways to say where the content goes.
    //
    // Preferred: a block containing {{content}} marks the slot, and EVERYTHING
    // else in the base survives — so the base can carry a tagline, a footer
    // with real wording, a CTA, whatever.
    //
    // Legacy: with no marker, the first text/button block is the slot and all
    // other text/button blocks are treated as sample copy and dropped. That
    // silently binned any wording in a base's header or footer, which is why
    // the marker exists — but it stays the fallback so an unmarked base
    // behaves exactly as it did before.
    const marked = base.blocks.some(isBaseSlot);
    const out = []; let injected = false;
    for (const blk of base.blocks) {
      if (marked) {
        if (isBaseSlot(blk)) {
          if (!injected) { out.push(baseContentSlot(blk, contentHtml)); injected = true; }
          continue;  // a second marker is ignored rather than duplicating the email
        }
        out.push(blk);
        continue;
      }
      if (blk.type === "text" || blk.type === "button") {
        if (!injected) { out.push(baseContentSlot(blk, contentHtml)); injected = true; }
        continue;
      }
      out.push(blk);
    }
    if (!injected) out.push({ type: "code", id: "txc", html: contentHtml });
    const brand = { ...defaultBrand(), ...(base.branding || {}), ...(await brandMasterSocials(env)) };
    const { html } = renderTemplate({ mode: "blocks", blocks: out, branding: base.branding }, { brand });
    return html || contentHtml;
  } catch (e) {
    console.error("wrapInBrandedBase failed - sending unbranded", String((e && e.message) || e));
    return contentHtml;
  }
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

// ---- Email consent gate ----------------------------------------------------
// Every send should pass through here, so there is ONE place that decides who
// may be emailed. See docs/email-suppression-plan.md.
//
// Consecutive soft bounces before an address is suppressed. Reset by any
// successful delivery.
const SOFT_BOUNCE_LIMIT = 3;

// Record what happened to an email. Best-effort: logging must never be the
// reason a send fails, so every path swallows its errors.
async function logEmailEvent(env, {
  contact = null, email = null, event, provider = "resend",
  messageId = null, subject = null, url = null, detail = null,
  raw = null, occurredAt = null, automationId = null, enrollmentId = null,
} = {}) {
  try {
    const addr = String(email || (contact && contact.email) || "").toLowerCase();
    if (!addr) return;
    const row = {
      contact_id: (contact && contact.id) || null,
      email: addr,
      event, provider,
      message_id: messageId, subject, url, detail, raw,
      occurred_at: occurredAt || new Date().toISOString(),
    };
    if (automationId) row.automation_id = automationId;
    if (enrollmentId) row.enrollment_id = enrollmentId;
    const res = await sbPost(env, "email_events", row);
    // If the automation columns don't exist yet (migration not run), don't
    // lose the event — record it without the attribution.
    if (res && !res.ok && res.status !== 409 && (row.automation_id || row.enrollment_id)) {
      delete row.automation_id; delete row.enrollment_id;
      await sbPost(env, "email_events", row);
    }
  } catch (_) { /* never blocks a send */ }
}

// Record a change of marketing consent — when, how, and on what footing.
//
// `basis` is deliberately kept apart from `source`:
//   consent             — they did something that constitutes agreement
//   legitimate_interest — we decided for them (TEG network members)
//   withdrawn           — they asked us to stop
//
// Recording the second as the first would make the log worthless as evidence,
// which is the only reason it exists. See supabase/contact_consent_events.sql.
//
// Best-effort, exactly like logEmailEvent: an audit write must never be the
// reason someone's signup fails.
async function logConsent(env, {
  contact = null, contactId = null, email = null,
  action, basis = "consent", source, detail = null, actor = "System", raw = null,
} = {}) {
  try {
    const addr = String(email || (contact && contact.email) || "").trim().toLowerCase();
    const cid = contactId || (contact && contact.id) || null;
    if (!addr || !action || !source) return;
    await sbPost(env, "contact_consent_events", {
      contact_id: cid, email: addr, action, basis, source, detail, actor, raw,
      occurred_at: new Date().toISOString(),
    });
  } catch (_) { /* never blocks a signup */ }
}

// Was this address already opted in? upsert_contact only ever turns the flag ON
// (it ORs it), so without checking first the audit trail would gain a duplicate
// "opted in" row every time someone filled in a second form. Only the
// transition is worth recording.
async function wasOptedIn(env, email) {
  try {
    const addr = String(email || "").trim().toLowerCase();
    if (!addr) return null;
    const rows = await sbGet(env, "contacts", `email=ilike.${encodeURIComponent(addr)}&select=marketing_opt_in&limit=1`);
    return !!(rows && rows[0] && rows[0].marketing_opt_in);
  } catch (_) { return null; }
}

// May we send this contact this kind of mail?
//
//   "transactional" — they did something and this is the reply (booking
//                     confirmation, receipt, password reset). A marketing
//                     opt-out must NEVER stop one of these.
//   "marketing"     — we chose to send it. Needs opt-in, and is stopped by an
//                     unsubscribe.
//
// Both are stopped by suppression, because a hard-bounced address is simply
// undeliverable — there is no point trying either way.
function mayEmail(contact, kind = "marketing") {
  if (!contact || !contact.email) return { ok: false, reason: "no email address" };
  if (contact.suppressed_at) {
    return { ok: false, reason: `suppressed: ${contact.suppression_reason || "unknown"}` };
  }
  // do-not-contact has always stopped automation email, transactional included.
  // Kept that way deliberately — an unsubscribe sets dnd_email, so this is what
  // makes an unsubscribe bite immediately.
  if (contact.dnd || contact.dnd_email) return { ok: false, reason: "do-not-contact" };
  if (kind === "transactional") return { ok: true };
  if (contact.unsubscribed_at) return { ok: false, reason: "unsubscribed from marketing" };
  if (!contact.marketing_opt_in) return { ok: false, reason: "no marketing opt-in" };
  return { ok: true };
}

// mayEmail + an audit trail, so "why did this campaign only reach 340 people?"
// has an answer instead of a shrug.
async function gateEmail(env, contact, kind, subject, ctx) {
  const verdict = mayEmail(contact, kind);
  if (!verdict.ok) {
    await logEmailEvent(env, {
      contact, email: contact && contact.email, event: "blocked",
      provider: "internal", subject, detail: verdict.reason,
      automationId: ctx && ctx.automationId, enrollmentId: ctx && ctx.enrollmentId,
    });
  }
  return verdict;
}

// Mark an address undeliverable. Leaves any unsubscribe choice untouched —
// the two are separate states and clearing one must not clear the other.
async function suppressContact(env, contact, reason, detail) {
  if (!contact || !contact.id) return;
  try {
    await sbPatch(env, "contacts", `id=eq.${encodeURIComponent(contact.id)}`, {
      suppressed_at: new Date().toISOString(),
      suppression_reason: reason,
      last_email_event: { event: "suppressed", reason, detail: detail || null, at: new Date().toISOString() },
    });
  } catch (_) { /* best-effort */ }
}

// Record that someone asked to stop receiving marketing. Also sets dnd_email,
// per the brief: an unsubscribe is both an unsubscribe and a do-not-contact.
async function unsubscribeContact(env, contact, source) {
  if (!contact || !contact.id) return;
  try {
    await sbPatch(env, "contacts", `id=eq.${encodeURIComponent(contact.id)}`, {
      unsubscribed_at: new Date().toISOString(),
      unsubscribe_source: source || "footer_link",
      dnd_email: true,
      marketing_opt_in: false,
    });
    await logConsent(env, {
      contact, action: "opted_out", basis: "withdrawn", source: source || "footer_link",
      detail: "Asked to stop receiving marketing.",
    });
  } catch (_) { /* best-effort */ }
}

// ---- First-party open/click tracking (for Microsoft-sent funnel email) -----
// Resend reports opens/clicks for its own sends; Microsoft 365 reports
// nothing. So transactional funnel email carries our own: an invisible pixel
// (open) and links routed through the Worker (click). Both are HMAC-signed so
// events can't be forged and the click redirect can't be abused as an open
// relay. p = b64url JSON {e,a,n,m}; the click sig also covers the raw URL.
async function trackSig(env, data) {
  const secret = unsubSecret(env);
  if (!secret) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`track:${data}`));
  return _b64url(mac);
}
async function injectTracking(env, html, meta) {
  const base = unsubBase(env);
  if (!base) return html;
  const p = _b64urlStr(JSON.stringify({ e: meta.email, a: meta.automationId || null, n: meta.enrollmentId || null, m: meta.messageId || null }));
  const openSig = await trackSig(env, p);
  if (!openSig) return html;
  let out = html;
  const hrefs = [...new Set(out.match(/href="https?:\/\/[^"]+"/g) || [])];
  for (const h of hrefs) {
    const target = h.slice(6, -1).replace(/&amp;/g, "&");
    if (target.startsWith(base)) continue;   // never wrap our own endpoints (unsubscribe, galleries…)
    const s = await trackSig(env, `${p}|${target}`);
    out = out.split(h).join(`href="${base}/t/c?p=${p}&amp;s=${s}&amp;u=${encodeURIComponent(target)}"`);
  }
  const pixel = `<img src="${base}/t/o?p=${p}&amp;s=${openSig}" width="1" height="1" style="display:none" alt="" />`;
  return out.includes("</body>") ? out.replace("</body>", pixel + "</body>") : out + pixel;
}

async function autoExecAction(env, node, contact, ctx) {
  const c = node.config || {};
  try {
    if (node.type === "send_email") {
      // Marketing vs transactional is set per STEP, not per template — the same
      // template can legitimately be used both ways, so the intent belongs to
      // the sending. Steps built before this existed have no setting and default
      // to "transactional", which preserves exactly how they behaved before:
      // defaulting them to marketing would have started demanding opt-in for
      // booking confirmations overnight.
      const sendKind = c.send_kind === "marketing" ? "marketing" : "transactional";
      const gate = await gateEmail(env, contact, sendKind, null, ctx);
      if (!gate.ok) return { outcome: "skipped", detail: gate.reason };
      if (!c.template_id) return { outcome: "skipped", detail: "no template chosen on this step" };
      const tRows = await sbGet(env, "email_templates", `id=eq.${c.template_id}&select=*`);
      const t = tRows && tRows[0];
      if (!t) return { outcome: "error", detail: "that email template no longer exists" };
      const brand = { ...defaultBrand(), ...(t.branding || {}), ...(await brandMasterSocials(env)) };
      const recipient = { name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email, first_name: contact.first_name || "", email: contact.email, company: contact.company || "" };
      // Hydrate the videography funnel tokens ({{bookingLink}}, {{code}}, …) when
      // this contact is a new starter with a generated code.
      Object.assign(recipient, await agentFunnelContext(env, contact));
      // Marketing gets a real, per-recipient unsubscribe link. Without this the
      // {{unsubscribe}} token in a template falls back to a mailto:, which
      // nobody actions. Transactional mail deliberately gets none — an
      // unsubscribe footer on a booking confirmation is just confusing.
      const unsubUrl = sendKind === "marketing" ? await unsubUrlFor(env, contact.email) : null;
      if (unsubUrl) { recipient.unsubscribeUrl = unsubUrl; recipient.unsubscribe_url = unsubUrl; }
      const { subject, html } = renderTemplate(
        // The step can override the template's subject — one template, four
        // sends with different subject lines, no duplicate templates.
        { subject: (c.subject && String(c.subject).trim()) || t.subject, preheader: t.preheader, mode: t.mode, blocks: t.blocks, customHtml: t.custom_html, branding: t.branding },
        { brand, mergeCtx: mergeContextFor(recipient, brand) }
      );
      // Deliver to the secondary address too when there is one — a TEG new
      // starter is on file under a work email they often can't read until their
      // first day. Funnel/automation email only: marketing keeps to `email`.
      // Marketing goes to the one address they consented at. The secondary
      // address exists for TEG new starters who can't read their work email
      // until day one — a funnel/transactional concern, not a marketing one.
      const to = sendKind === "marketing"
        ? [contact.email]
        : [contact.email, String(contact.secondary_email || "").trim()].filter(Boolean);
      // Microsoft reports nothing back, so transactional funnel email carries
      // our own open pixel + click-through links. (Resend sends are tracked by
      // Resend — wrapping them too would double-count.) The generated message
      // id ties the pixel/click events back to this send in the insights.
      let htmlOut = html, m365Id = null;
      if (sendKind !== "marketing") {
        m365Id = "m365-" + crypto.randomUUID();
        try {
          htmlOut = await injectTracking(env, html, { email: contact.email, automationId: ctx && ctx.automationId, enrollmentId: ctx && ctx.enrollmentId, messageId: m365Id });
        } catch (_) { htmlOut = html; }
      }
      // Record what actually went out (and whether it did) — this is what the
      // funnel audit shows, and the only way to answer "did they get it?".
      const sent = sendKind === "marketing"
        ? await sendMarketingEmail(env, { to, subject, html, unsubUrl })
        : await sendEmail(env, { to, subject, html: htmlOut });
      await logEmailEvent(env, {
        contact, email: contact.email,
        event: (sent && sent.ok) ? "sent" : "blocked",
        provider: sendKind === "marketing" ? "resend" : "m365",
        messageId: (sent && sent.id) || m365Id,
        subject,
        detail: (sent && sent.ok) ? null : String((sent && sent.error) || "send failed").slice(0, 200),
        automationId: ctx && ctx.automationId, enrollmentId: ctx && ctx.enrollmentId,
      });
      return (sent && sent.ok)
        ? { outcome: "ok", detail: `“${subject}” → ${to.join(", ")}` }
        : { outcome: "error", detail: `“${subject}” → ${to.join(", ")} - ${String((sent && sent.error) || "send failed").slice(0, 200)}` };
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
        await sendEmail(env, { to, subject: `Automation - ${c.note || "update"}`, html: await wrapInBrandedBase(env, `<div style="${EM_WRAP}"><p>${String(c.note || "An automation step fired").replace(/</g, "&lt;")}</p><p style="${EM_SMALL}">Contact: ${String(contact.email).replace(/</g, "&lt;")}</p></div>`) });
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
    // A send step with a "deliver at" time holds here until the next occurrence
    // of that time (UK) — the wait steps got the contact to the right day, this
    // gets them to the right hour.
    if (node.type === "send_email" && node.config && (node.config.send_at || node.config.send_on)) {
      const hold = msUntilSendMoment(node.config.send_on, node.config.send_at);
      if (hold > 0) {
        return sbPatch(env, "automation_enrollments", `id=eq.${enr.id}`, {
          current_node_id: cur, next_run_at: new Date(Date.now() + hold).toISOString(),
        });
      }
    }
    let branch = "next";
    let acted = null;
    if (node.type === "if_else") {
      const yes = await autoEvalCondition(env, node.config || {}, contact);
      branch = yes ? "yes" : "no";
      acted = { outcome: "ok", detail: yes ? "condition met → yes" : "condition not met → no" };
    } else {
      acted = await autoExecAction(env, node, contact, { automationId: auto.id, enrollmentId: enr.id });
    }
    await sbPost(env, "automation_runs", {
      enrollment_id: enr.id, automation_id: auto.id, contact_id: contact.id,
      node_id: cur, node_type: node.type,
      outcome: (acted && acted.outcome) || "ok",
      detail: (acted && acted.detail) || null,
    });
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
  return `<div style="${EM_WRAP}">
    <h1 style="${EM_H1}">Your pack is waiting${pack ? ` - ${esc(pack)}` : ""}</h1>
    <p style="${EM_P}">Hi ${first}, thanks for your purchase! You haven't set a password yet, so your library is still locked. Set one now and your pack unlocks straight away.</p>
    <p style="margin:0 0 26px"><a href="${esc(link)}" style="${EM_BTN}">Set my password &amp; open my library &rarr;</a></p>
    <p style="${EM_SMALL}">If the button doesn't work, paste this into your browser:<br><span style="color:#777">${esc(link)}</span></p>
    <p style="${EM_SMALL}">Sent by TMKE &middot; <a href="https://tmke.co.uk" style="color:#371e28">tmke.co.uk</a></p>
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
        html: await wrapInBrandedBase(env, setupReminderHtml({ name: o.buyer_name, pack: o.pack_title, link })),
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
    if (event && (event.cron === "0 7 * * *" || event.cron === "0 8 * * *")) {
      ctx.waitUntil(runReminders(env));
      ctx.waitUntil(runDdMonthly(env));
      // Only on the 08:00 run, so the day-after reminder and the expiry warning
      // go out once a day rather than twice.
      if (event.cron === "0 8 * * *") {
        ctx.waitUntil(runVideographyChasers(env));
        ctx.waitUntil(runInvoiceChasers(env));
        ctx.waitUntil(runStallCheck(env));
        ctx.waitUntil(runInvoicePrompt(env));
      }
    }
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

    // Refresh the house style before anything can build an email. Cached for a
    // minute, so this is a no-op on all but the first request in that window.
    await loadEmailStyles(env);

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
          return json({ ok: false, error: "Auto-deploy isn't configured - set RAILWAY_API_TOKEN (secret), plus RAILWAY_SERVICE_ID and RAILWAY_ENVIRONMENT_ID, on the Worker." }, 503, request, env);
        }
        const now = Date.now();
        // A rebuild already in flight picks up the latest content, so coalesce
        // bursts (e.g. publish then a quick edit) into one deploy.
        if (now - _lastDeployAt < 45000) {
          return json({ ok: true, queued: false, message: "A site update is already in progress - your changes will be included." }, 200, request, env);
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
        return json({ ok: true, queued: true, message: "Site is updating - your post will be live in a minute or two." }, 200, request, env);
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
          return json({ error: "Upload failed - try again." }, 502, request, env);
        }
        const fileUrl = "https://assets.tmke.co.uk/" + key.split("/").map(encodeURIComponent).join("/");
        return json({ ok: true, url: fileUrl }, 200, request, env);
      }

      // ---- Stripe: create a hosted Checkout Session ---------------------------
      // The browser posts the pack id + buyer details; we re-read the pack price
      // from Supabase (never trust the client), create a `pending` order with the
      // service role, then hand back Stripe's hosted payment URL to redirect to.
      if (path.endsWith("/stripe/checkout") && request.method === "POST") {
        if (!env.STRIPE_SECRET_KEY) return json({ error: "Payments aren't set up yet - add the STRIPE_SECRET_KEY secret to the Worker." }, 503, request, env);
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
        // price_pence is the advertised EX-VAT figure; the customer is charged gross.
        const { net: amountNet, vat: amountVat, gross: amount } = await vatBreakdown(env, pack.price_pence || 0);

        // Only redirect back to a known-good origin.
        const origin = request.headers.get("Origin") || "";
        const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
        const base = allowed.includes(origin) ? origin : (env.SITE_URL || "https://tmke.co.uk");

        // Create the order up-front as `pending` (or `paid` for free packs).
        const ins = await sbPost(env, "orders", {
          pack_id: pack.id, pack_slug: pack.slug, pack_title: pack.title,
          amount_pence: amountNet, vat_pence: amountVat, total_pence: amount,
          buyer_name: name, buyer_email: email, buyer_phone: phone || null, buyer_company: company || null,
          payment_method: "card", status: amount === 0 ? "paid" : "pending",
        }, "return=representation");
        const created = await ins.json().catch(() => null);
        const order = Array.isArray(created) ? created[0] : created;
        if (!order || !order.id) {
          // Same lesson as the edit-request insert: "please try again" about a
          // permanent failure wastes everyone's time. The buyer still gets a
          // sentence they can act on; the reason goes to `wrangler tail`.
          console.log("order insert failed", ins.status, JSON.stringify(created));
          return json({ error: "Couldn't start your order. Please try again." }, 500, request, env);
        }

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
      // ---- Unsubscribe --------------------------------------------------------
      // Three entry points, all keyed on the same signed token:
      //   GET  /unsubscribe?t=…              the link in the email footer
      //   POST /unsubscribe?t=…              Gmail/Outlook's own button (RFC 8058)
      //   POST /unsubscribe/resubscribe?t=…  the "that was a mistake" undo
      //
      // The GET unsubscribes IMMEDIATELY and then says so, rather than asking
      // "are you sure?" first. Deliberate: an extra step loses people who then
      // press the spam button instead, and one spam complaint does far more
      // damage to whether the rest of our email arrives than one unsubscribe.
      // They get a one-click undo on the page, which covers the misclick.
      if (path.endsWith("/unsubscribe/resubscribe") && request.method === "POST") {
        const addr = await unsubVerify(env, url.searchParams.get("t"));
        if (!addr) return new Response(unsubPage({ state: "error" }), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
        const rows = await sbGet(env, "contacts", `email=eq.${encodeURIComponent(addr)}&select=*`);
        const contact = rows && rows[0];
        if (contact) {
          await sbPatch(env, "contacts", `id=eq.${encodeURIComponent(contact.id)}`, {
            unsubscribed_at: null, unsubscribe_source: null, dnd_email: false, marketing_opt_in: true,
          });
          await logEmailEvent(env, { contact, email: addr, event: "unsubscribed", provider: "internal", detail: "resubscribed by the recipient" });
          await logConsent(env, {
            contact, email: addr, action: "opted_in", basis: "consent", source: "resubscribe",
            detail: "Changed their mind and resubscribed from the unsubscribe page.",
          });
        }
        return new Response(unsubPage({ email: addr, state: "resubscribed" }), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
      }

      if (path.endsWith("/unsubscribe") && (request.method === "GET" || request.method === "POST")) {
        const token = url.searchParams.get("t");
        const addr = await unsubVerify(env, token);
        const oneClick = request.method === "POST";   // the mailbox provider's button

        if (!addr) {
          // A provider POSTing gets a plain response; a person gets the page.
          if (oneClick) return new Response("invalid token", { status: 400 });
          return new Response(unsubPage({ state: "error" }), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
        }

        const rows = await sbGet(env, "contacts", `email=eq.${encodeURIComponent(addr)}&select=*`);
        const contact = rows && rows[0];
        if (contact) {
          await unsubscribeContact(env, contact, oneClick ? "list_unsubscribe" : "footer_link");
          await logEmailEvent(env, {
            contact, email: addr, event: "unsubscribed", provider: "internal",
            detail: oneClick ? "one-click via the mailbox provider" : "footer link",
          });
        }
        // Unknown address: still report success. Confirming whether an address is
        // on the list would leak it, and there's nothing for them to fix anyway.

        // RFC 8058 wants a bare 200 for the one-click POST — no page, no redirect.
        if (oneClick) return new Response("unsubscribed", { status: 200 });
        return new Response(unsubPage({ email: addr, state: "done", resubToken: token }), {
          status: 200, headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // ---- Public: pay an invoice by card ---------------------------------
      // The client clicks this from their invoice email. No auth: the HMAC in
      // the token is the credential. Mints a fresh Checkout Session per click,
      // because Stripe sessions expire in 24 hours and invoices do not.
      if (path.endsWith("/invoicing/pay") && request.method === "GET") {
        const htmlPage = (title, msg, status) => new Response(invoicePayPage(title, msg), {
          status: status || 200, headers: { "Content-Type": "text/html; charset=utf-8" },
        });
        const invId = await invoicePayVerify(env, url.searchParams.get("t"));
        if (!invId) return htmlPage("That payment link isn't valid", "Please use the link in your most recent invoice email, or reply to that email and we'll sort it out.", 400);

        const rows = await sbGet(env, "invoices", `id=eq.${encodeURIComponent(invId)}&select=*`);
        const inv = rows && rows[0];
        if (!inv) return htmlPage("We couldn't find that invoice", "Please reply to your invoice email and we'll look into it.", 404);
        if (inv.status === "paid") return htmlPage("This invoice is already paid", `Invoice ${inv.number} has been settled - there's nothing more to do. Thank you.`);
        if (inv.status === "void") return htmlPage("This invoice has been cancelled", `Invoice ${inv.number} was voided, so there's nothing to pay.`);
        if (!env.STRIPE_SECRET_KEY) return htmlPage("Card payment isn't available yet", "Please pay by bank transfer using the details on your invoice, or reply to the email and we'll help.", 503);
        const amount = Math.round(Number(inv.total_pence) || 0);
        if (amount <= 0) return htmlPage("There's nothing to pay on this invoice", "Please reply to your invoice email if you think that's wrong.");

        const st = (await sbGet(env, "invoice_settings", "id=eq.1&select=*"))?.[0] || {};
        try {
          const session = await stripeApi(env, "checkout/sessions", {
            mode: "payment",
            "payment_method_types[0]": "card",
            success_url: `${unsubBase(env)}/invoicing/paid?t=${encodeURIComponent(url.searchParams.get("t") || "")}`,
            cancel_url: await invoicePayUrl(env, inv.id),
            customer_email: inv.bill_to_email || undefined,
            client_reference_id: inv.id,
            "metadata[invoice_id]": inv.id,
            "metadata[invoice_number]": inv.number || "",
            "line_items[0][quantity]": 1,
            "line_items[0][price_data][currency]": "gbp",
            "line_items[0][price_data][unit_amount]": amount,
            "line_items[0][price_data][product_data][name]": `Invoice ${inv.number}${st.company_name ? " - " + st.company_name : ""}`,
          });
          // Stored for tracing a payment back, not for reuse - it expires.
          await sbPatch(env, "invoices", `id=eq.${encodeURIComponent(inv.id)}`, { stripe_session_id: session.id });
          return Response.redirect(session.url, 302);
        } catch (e) {
          return htmlPage("We couldn't open the payment page", "Please try again in a moment, or reply to your invoice email and we'll take payment another way.", 502);
        }
      }

      // Where Stripe sends the client back. The webhook is what actually marks
      // the invoice paid; this page only reports, and says so honestly if the
      // webhook hasn't landed yet rather than claiming success it can't see.
      if (path.endsWith("/invoicing/paid") && request.method === "GET") {
        const invId = await invoicePayVerify(env, url.searchParams.get("t"));
        const inv = invId ? ((await sbGet(env, "invoices", `id=eq.${encodeURIComponent(invId)}&select=number,status`)) || [])[0] : null;
        const paid = inv && inv.status === "paid";
        return new Response(invoicePayPage(
          "Thank you - your payment went through",
          paid
            ? `Invoice ${inv.number} is now marked as paid. A receipt is on its way from Stripe.`
            : "Your receipt is on its way from Stripe. Our records can take a moment to catch up, so the invoice may still show as unpaid for a minute or two.",
        ), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
      }

      if (path.endsWith("/stripe/webhook") && request.method === "POST") {
        const raw = await request.text();
        const ok = await stripeVerify(raw, request.headers.get("Stripe-Signature") || "", env.STRIPE_WEBHOOK_SECRET);
        if (!ok) return json({ error: "Bad signature" }, 400, request, env);
        let event;
        try { event = JSON.parse(raw); } catch (_) { return json({ error: "Bad JSON" }, 400, request, env); }
        if (event.type === "checkout.session.completed") {
          const s = event.data && event.data.object;
          const pi = s && (typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent && s.payment_intent.id));

          // Invoices and orders both come through here, so tell them apart by
          // which metadata key is set rather than assuming everything is an
          // order. client_reference_id is NOT a safe fallback any more - both
          // paths set it.
          const invoiceId = s && s.metadata && s.metadata.invoice_id;
          if (invoiceId) {
            // status=neq.paid keeps this idempotent across Stripe's retries.
            const sel = `id=eq.${encodeURIComponent(invoiceId)}&status=neq.paid`;
            const paidAt = new Date().toISOString().slice(0, 10);
            let pr = await sbPatch(env, "invoices", sel, {
              status: "paid", paid_date: paidAt, payment_method: "card", payment_ref: pi || null,
            });
            // payment_ref only exists once supabase/invoicing_stripe.sql has run,
            // and PostgREST rejects the WHOLE patch for one unknown column. The
            // money has already left the client's account at this point, so fall
            // back to the columns that certainly exist rather than leaving the
            // invoice silently unpaid.
            if (!pr.ok) {
              pr = await sbPatch(env, "invoices", sel, { status: "paid", paid_date: paidAt, payment_method: "card" });
              if (!pr.ok) pr = await sbPatch(env, "invoices", sel, { status: "paid" });
              if (!pr.ok) {
                console.error("PAID BUT NOT RECORDED - invoice", invoiceId, "payment", pi,
                  "- run supabase/invoicing_stripe.sql and mark it paid by hand:",
                  await pr.text().catch(() => ""));
              }
            }
            // Invoices raised from a booking carry booking_id. Mark the shoot
            // paid too, so PIN release keys off something that actually
            // happened rather than someone remembering to tick a box.
            try {
              const irows = await sbGet(env, "invoices", `id=eq.${encodeURIComponent(invoiceId)}&select=booking_id,booking_source`);
              const iv = irows && irows[0];
              if (iv && iv.booking_id && iv.booking_source === "videography") {
                await sbPatch(env, "videography_bookings", `id=eq.${encodeURIComponent(iv.booking_id)}&paid_at=is.null`, {
                  paid_at: new Date().toISOString(),
                });
                // They may already have the gallery without the PIN. Close that
                // loop now rather than leaving it to someone noticing.
                await sendGalleryPinEmail(env, iv.booking_id);
              }
            } catch (_) { /* the invoice is paid either way; don't fail the webhook */ }
            return json({ received: true }, 200, request, env);
          }

          const editRequestId = s && s.metadata && s.metadata.edit_request_id;
          if (editRequestId) {
            // status=neq.paid keeps this idempotent across Stripe's retries.
            await sbPatch(env, "videography_edit_requests", `id=eq.${encodeURIComponent(editRequestId)}&status=neq.paid`, {
              status: "paid", paid_at: new Date().toISOString(), stripe_session_id: s.id || null,
            });
            await notifyEditRequest(env, editRequestId);
            return json({ received: true }, 200, request, env);
          }

          const orderId = (s && s.metadata && s.metadata.order_id) || (s && s.client_reference_id);
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

      // ---- Public: sign up, with a confirmation link that survives a scanner --
      //
      // Same reasoning as /auth/reset-link below. supabase.auth.signUp() sends
      // Supabase's own confirmation email, whose link a Microsoft mail scanner
      // consumes before the recipient sees it - so new members could not confirm
      // their account at all. generate_link creates the user AND hands back the
      // hashed_token, so we send our own branded email pointing at
      // /auth/callback, which verifies only once a human clicks.
      if (path.endsWith("/auth/signup") && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const email = String((b && b.email) || "").trim().toLowerCase();
        const password = String((b && b.password) || "");
        const fullName = String((b && b.full_name) || "").trim().slice(0, 120);

        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Please enter a valid email address." }, 400, request, env);
        if (password.length < 8) return json({ error: "Choose a password of at least 8 characters." }, 400, request, env);

        // Said plainly rather than hidden. The sign-up form already tells people
        // when an address is taken - it has to, or they cannot act on it - so
        // pretending otherwise here would only make the form lie.
        const existing = await findUserByEmail(env, email);
        if (existing && existing.id) return json({ existing: true }, 200, request, env);

        const now = Date.now();
        const last = RESET_COOLDOWN.get("signup:" + email) || 0;
        if (now - last < 60_000) return json({ ok: true, needsConfirm: true }, 200, request, env);
        RESET_COOLDOWN.set("signup:" + email, now);

        try {
          const site = String(env.SITE_URL || "https://tmke.co.uk").replace(/\/+$/, "");
          const gl = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
            method: "POST",
            headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "signup", email, password,
              options: { data: { full_name: fullName || null }, redirect_to: `${site}/account` },
            }),
          });
          if (!gl.ok) {
            const t = await gl.text().catch(() => "");
            if (/already|registered|exists/i.test(t)) return json({ existing: true }, 200, request, env);
            console.error("signup generate_link", gl.status, t.slice(0, 200));
            return json({ error: "Something went wrong creating your account. Please try again." }, 502, request, env);
          }
          const gj = await gl.json().catch(() => ({}));
          const hashed = (gj && (gj.hashed_token || (gj.properties && gj.properties.hashed_token))) || "";
          if (!hashed) {
            console.error("signup: no hashed_token in generate_link reply");
            return json({ error: "Something went wrong creating your account. Please try again." }, 502, request, env);
          }

          const link = `${site}/auth/callback?token_hash=${encodeURIComponent(hashed)}&type=signup`;
          const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
          const first = (fullName.split(/\s+/)[0] || "there").trim();
          const content = `
            <h1 style="${EM_H1}">Confirm your email</h1>
            <p style="${EM_P}">Hi ${esc(first)},</p>
            <p style="${EM_P}">Thanks for creating a TMKE account. Click below to confirm your email and open your member hub.</p>
            <p style="margin:0 0 24px;"><a href="${esc(link)}" style="${EM_BTN}">Confirm my email</a></p>
            <p style="${EM_P}">If the button doesn't work, paste this into your browser:<br><span style="color:#371e28;word-break:break-all;">${esc(link)}</span></p>
            <p style="${EM_SMALL}">Didn't sign up? Ignore this email &mdash; the account stays unconfirmed and can't be used.</p>`;
          const html = await wrapInBrandedBase(env, content);
          const sent = await sendEmail(env, { to: email, subject: "Confirm your email - TMKE", html });
          if (!sent.ok) {
            // The account exists now, so saying "try again" would be a lie - a
            // second attempt hits "already registered". Say what is true.
            console.error("signup send failed", sent.error);
            return json({ ok: true, needsConfirm: true, emailFailed: true }, 200, request, env);
          }
          return json({ ok: true, needsConfirm: true }, 200, request, env);
        } catch (e) {
          console.error("signup", String((e && e.message) || e).slice(0, 200));
          return json({ error: "Something went wrong creating your account. Please try again." }, 502, request, env);
        }
      }

      // ---- Public: send a password-reset link that survives a mail scanner ---
      //
      // Not supabase.auth.resetPasswordForEmail(). That sends Supabase's own
      // template, whose link is .../auth/v1/verify?token=... - a plain GET that
      // verifies and BURNS the token the moment anything requests it. Microsoft
      // Safe Links requests it, to scan it, before the human ever clicks. So the
      // customer opens a link that is genuinely already used and is told it has
      // expired. Outlook recipients could not reset their password at all.
      //
      // generate_link hands back the hashed_token as well as that doomed URL, so
      // we build our own: /auth/callback?token_hash=... That page is static HTML
      // and does the verification in JavaScript, in a real browser, after load.
      // A scanner fetching it gets markup and leaves the token untouched.
      //
      // It also means the wording and the branding are ours, and nothing depends
      // on a dashboard template propagating.
      if (path.endsWith("/auth/reset-link") && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const email = String((b && b.email) || "").trim().toLowerCase();

        // One reply for every outcome, always 200: no account, rate-limited,
        // send failed, sent. This endpoint is public, so any difference between
        // those is a way of asking us which addresses have accounts.
        const same = () => json({ ok: true }, 200, request, env);
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return same();

        // Per-isolate, so it is a speed bump rather than a guarantee - Workers
        // spin up many isolates and this map dies with each one. It is enough to
        // stop a form being leant on, and the mail only ever goes to the account
        // holder, so the worst case is one person's inbox. A real limiter wants
        // KV, which this Worker has no binding for yet.
        const now = Date.now();
        const last = RESET_COOLDOWN.get(email) || 0;
        if (now - last < 60_000) return same();
        RESET_COOLDOWN.set(email, now);
        if (RESET_COOLDOWN.size > 5000) RESET_COOLDOWN.clear();   // crude, but unbounded is worse

        try {
          const u = await findUserByEmail(env, email);
          if (!u || !u.id) return same();

          const site = String(env.SITE_URL || "https://tmke.co.uk").replace(/\/+$/, "");
          const gl = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
            method: "POST",
            headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json" },
            body: JSON.stringify({ type: "recovery", email, options: { redirect_to: `${site}/reset-password` } }),
          });
          if (!gl.ok) { console.error("reset-link generate_link", gl.status, (await gl.text().catch(() => "")).slice(0, 200)); return same(); }
          const gj = await gl.json().catch(() => ({}));
          const hashed = (gj && (gj.hashed_token || (gj.properties && gj.properties.hashed_token))) || "";
          if (!hashed) { console.error("reset-link: no hashed_token in generate_link reply"); return same(); }

          const link = `${site}/auth/callback?token_hash=${encodeURIComponent(hashed)}&type=recovery`;
          const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
          const content = `
            <h1 style="${EM_H1}">Set a new password</h1>
            <p style="${EM_P}">Someone asked to reset the password on your TMKE account. Click below to choose a new one.</p>
            <p style="margin:0 0 24px;"><a href="${esc(link)}" style="${EM_BTN}">Set a new password</a></p>
            <p style="${EM_P}">If the button doesn't work, paste this into your browser:<br><span style="color:#371e28;word-break:break-all;">${esc(link)}</span></p>
            <p style="${EM_SMALL}">The link works once and expires after an hour. If you didn't ask for this, ignore this email &mdash; your password stays exactly as it is.</p>`;
          const html = await wrapInBrandedBase(env, content);
          const sent = await sendEmail(env, { to: email, subject: "Set a new password - TMKE", html });
          // Logged, not returned: the caller is told the same thing either way.
          if (!sent.ok) console.error("reset-link send failed", sent.error);
        } catch (e) {
          console.error("reset-link", String((e && e.message) || e).slice(0, 200));
        }
        return same();
      }

      // ---- Admin: a receipt for one payment, as a PDF -----------------------
      //
      // Downloaded or emailed to accounts, not printed. The browser's print
      // dialog was losing the top of the document and produced something nobody
      // would want to send anyone.
      //
      // Stripe is asked again for the money. The label and the VAT split come
      // from the caller (that context is ours, and was computed by
      // /admin/payments moments earlier), but the amount, the fee and the date
      // are re-read from the charge so the figures on a document that reaches
      // an accounts team cannot be whatever a page happened to be holding.
      if (path.endsWith("/admin/payments/receipt") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        if (!env.STRIPE_SECRET_KEY) return json({ error: "Stripe isn't configured on the Worker." }, 503, request, env);

        const b = await request.json().catch(() => ({}));
        const rowId = String((b && b.id) || "").trim();
        const action = (b && b.action) === "email" ? "email" : "download";
        // Two kinds of payment reach this page, so two sources of truth. A
        // Stripe charge is re-read from Stripe; an invoice settled by bank
        // transfer or direct debit never touched Stripe, so its own row is the
        // authority. Either way the money is re-read rather than trusted from
        // the browser.
        const offStripe = /^inv_[0-9a-f-]{36}$/i.test(rowId);
        if (!offStripe && !/^ch_[A-Za-z0-9]+$/.test(rowId)) return json({ error: "Missing or malformed payment id." }, 400, request, env);

        try {
          let gross, fee, refunded, paidAt, reference;
          if (offStripe) {
            const invId = rowId.slice(4);
            const inv = (await sbGet(env, "invoices", `id=eq.${encodeURIComponent(invId)}&select=id,number,total_pence,paid_date,payment_method&limit=1`))?.[0];
            if (!inv) return json({ error: "No such invoice." }, 404, request, env);
            gross = Number(inv.total_pence) || 0;
            fee = 0;                       // never went through Stripe
            refunded = 0;
            paidAt = new Date(`${inv.paid_date || new Date().toISOString().slice(0, 10)}T12:00:00Z`);
            reference = `${inv.number || invId}${inv.payment_method ? " · " + String(inv.payment_method).replace(/_/g, " ") : ""}`;
          } else {
            const charge = await stripeGet(env, `charges/${encodeURIComponent(rowId)}`, { "expand[]": "balance_transaction" });
            if (!charge || !charge.id) return json({ error: "No such payment." }, 404, request, env);
            const bt = charge.balance_transaction && typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;
            gross = Number(charge.amount) || 0;
            fee = bt ? Number(bt.fee) || 0 : null;
            refunded = Number(charge.amount_refunded) || 0;
            paidAt = new Date((Number(charge.created) || 0) * 1000);
            reference = charge.id;
          }

          // Context from the caller, clamped: never wider than the money.
          const label    = String((b && b.label) || "Payment").slice(0, 160);
          const customer = String((b && b.customer) || "").slice(0, 160);
          const source   = String((b && b.source) || "").slice(0, 40);
          const derived  = !!(b && b.vat_derived);
          let vat = Number(b && b.vat_pence);
          if (!Number.isFinite(vat) || vat < 0 || vat > gross) vat = 0;
          const net = gross - vat;

          const st = (await sbGet(env, "invoice_settings", "id=eq.1&select=*"))?.[0] || {};
          const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
          const money = (p) => (p == null ? "&mdash;" : "£" + (p / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          const when = paidAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
          const est = derived ? ' <span style="font-size:9pt;color:#8a6a3c;">est</span>' : "";
          const row = (k, v, strong) => `<tr>
            <td style="padding:7px 0;color:#6b5c61;font-size:10pt;">${esc(k)}</td>
            <td style="padding:7px 0;text-align:right;font-size:${strong ? "13pt;font-weight:700" : "10pt"};color:#241419;">${v}</td></tr>`;

          const html = `<!doctype html><html><head><meta charset="utf-8">
            <style>
              @page { size: A4; margin: 20mm; }
              body { font-family: Verdana, Geneva, sans-serif; color:#241419; margin:0; }
              .eyebrow { font-size:9pt; letter-spacing:0.18em; text-transform:uppercase; color:#8a8796; margin:0 0 6px; }
              h1 { font-size:20pt; font-weight:400; margin:0 0 4px; }
              .sub { font-size:10pt; color:#6b5c61; margin:0 0 26px; }
              table { width:100%; border-collapse:collapse; }
              .rule td { border-top:1px solid #e4dedf; }
              .total td { border-top:2px solid #371e28; padding-top:12px; }
              .foot { margin-top:28px; font-size:8.5pt; line-height:1.6; color:#8a8796; border-top:1px solid #e4dedf; padding-top:14px; }
            </style></head><body>
            <p class="eyebrow">${esc((st.company_name || "The Marketing Experts").toUpperCase())} &middot; Payment received</p>
            <h1>${esc(label)}</h1>
            <p class="sub">${esc(when)}${source ? " &middot; " + esc(source) : ""}</p>
            <table>
              ${row("Received from", esc(customer || "&mdash;"))}
              ${row("Date", esc(when))}
              ${source ? row("Source", esc(source)) : ""}
              <tr class="rule"><td colspan="2" style="height:8px;"></td></tr>
              ${row("Net", money(net) + est)}
              ${row("VAT", money(vat) + est)}
              <tr class="total">${`<td style="padding:12px 0 0;font-size:13pt;font-weight:700;">Gross paid</td><td style="padding:12px 0 0;text-align:right;font-size:13pt;font-weight:700;">${money(gross)}</td>`}</tr>
              <tr class="rule"><td colspan="2" style="height:8px;"></td></tr>
              ${offStripe ? "" : row("Stripe fee", money(fee))}
              ${row("Received in bank", money(fee == null ? null : gross - fee))}
              ${refunded ? row("Refunded", money(refunded)) : ""}
              ${row(offStripe ? "Reference" : "Stripe reference", esc(reference))}
            </table>
            <p class="foot">
              ${derived
                ? "The VAT shown was worked back from the total at the standard rate. This payment was taken outside the Hub, so no split was recorded at the time &mdash; confirm against the source before relying on it for a return."
                : "The VAT split shown is the one recorded when the payment was taken."}
              <br>A record of a payment received, not a VAT invoice.
              ${st.vat_number ? "<br>VAT number " + esc(st.vat_number) : ""}
            </p></body></html>`;

          const browser = await puppeteer.launch(env.BROWSER);
          let pdf;
          try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: "networkidle0" });
            pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
          } finally { await browser.close(); }

          const stamp = paidAt.toISOString().slice(0, 10);
          const filename = `TMKE-receipt-${stamp}-${rowId}.pdf`;

          if (action === "email") {
            const to = String((b && b.to) || env.ACCOUNTS_PAYABLE_EMAIL || env.ACCOUNTS_NOTIFY || "").trim();
            if (!to) return json({ error: "No accounts address configured (ACCOUNTS_NOTIFY)." }, 503, request, env);
            const sent = await sendEmail(env, {
              to,
              subject: `Payment received - ${label} - ${money(gross).replace("&mdash;", "-")}`,
              html: await wrapInBrandedBase(env, `
                <h1 style="${EM_H1}">Payment received</h1>
                <p style="${EM_P}">${esc(label)}${customer ? " &mdash; " + esc(customer) : ""}, ${esc(when)}.</p>
                <p style="${EM_P}">Gross ${money(gross)}, of which VAT ${money(vat)}${derived ? " (estimated)" : ""}. ${offStripe ? "Settled outside Stripe, so the full amount reached the bank." : `Stripe fee ${money(fee)}, so ${money(fee == null ? null : gross - fee)} reached the bank.`}</p>
                <p style="${EM_P}">The receipt is attached, and the reference is <strong>${esc(reference)}</strong>.</p>`),
              attachments: [{ filename, content: bufToBase64(pdf), contentType: "application/pdf" }],
            });
            if (!sent.ok) return json({ error: sent.error || "The receipt didn't send." }, 502, request, env);
            return json({ ok: true, sent_to: to }, 200, request, env);
          }

          return new Response(pdf, {
            status: 200,
            headers: {
              ...corsHeaders(request, env),
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${filename}"`,
            },
          });
        } catch (e) {
          console.error("payments/receipt", String((e && e.message) || e).slice(0, 300));
          return json({ error: "Couldn't build that receipt." }, 502, request, env);
        }
      }

      // ---- Admin: every payment, read from Stripe ---------------------------
      //
      // The one place that sees all of it. Packs, invoices and videography
      // upsells are already in our own tables - but Pixieset sells straight
      // into this same Stripe account and never touches the Hub, so our tables
      // can never be the complete list and Stripe always is.
      //
      // READ-ONLY on purpose. Nothing here writes back. There is exactly one
      // record of each payment (Stripe's), annotated with whatever context we
      // already hold, so nothing on this page can duplicate an order we
      // recorded ourselves.
      if (path.endsWith("/admin/payments") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        if (!env.STRIPE_SECRET_KEY) return json({ error: "Stripe isn't configured on the Worker." }, 503, request, env);

        const u = new URL(request.url);
        const days = Math.min(Math.max(parseInt(u.searchParams.get("days") || "90", 10) || 90, 1), 3650);
        const since = Math.floor(Date.now() / 1000) - days * 86400;

        try {
          // Charges are the complete set (Pixieset's included). The balance
          // transaction is expanded so every row carries the fee Stripe
          // actually took, rather than a percentage we guessed at.
          const { rows: charges, truncated } = await stripeList(env, "charges", {
            "created[gte]": since, "expand[]": "data.balance_transaction",
          });

          // Our metadata rides on the Checkout Session, not the charge - Stripe
          // does not copy session metadata onto the PaymentIntent. Joining on
          // the payment intent is what tells us which of these charges were
          // ours and what they were for. Anything with no session is external.
          const { rows: sessions } = await stripeList(env, "checkout/sessions", { "created[gte]": since });
          const byPaymentIntent = new Map();
          for (const sess of sessions) {
            if (sess && sess.payment_intent) byPaymentIntent.set(String(sess.payment_intent), sess);
          }

          const paid = charges.filter((c) => c && c.status === "succeeded");

          // Classify first, then fetch the splits we hold in one query per kind
          // rather than one per row.
          const classify = (c) => {
            const sess = c.payment_intent ? byPaymentIntent.get(String(c.payment_intent)) : null;
            const md = (sess && sess.metadata) || {};
            if (md.edit_request_id) return { source: "videography", ref: String(md.edit_request_id), kind: md.upsell_type || null };
            if (md.invoice_id)      return { source: "invoice",     ref: String(md.invoice_id),     number: md.invoice_number || null };
            if (md.order_id)        return { source: "pack",        ref: String(md.order_id) };
            return { source: "external", ref: null };
          };
          const tagged = paid.map((c) => ({ charge: c, ...classify(c) }));

          const idsFor = (src) => [...new Set(tagged.filter((t) => t.source === src && t.ref).map((t) => t.ref))];
          const inList = (ids) => `(${ids.map((i) => `"${i}"`).join(",")})`;
          const fetchSplits = async (src, table, select) => {
            const ids = idsFor(src);
            if (!ids.length) return new Map();
            try {
              const rows = await sbGet(env, table, `id=in.${inList(ids)}&select=${select}`);
              return new Map((rows || []).map((r) => [String(r.id), r]));
            } catch (_) { return new Map(); }   // a missing split is worth less than a missing page
          };
          const [orderById, invoiceById, editById] = await Promise.all([
            fetchSplits("pack", "orders", "id,pack_title,buyer_name,buyer_email,amount_pence,vat_pence,total_pence"),
            fetchSplits("invoice", "invoices", "id,number,subtotal_pence,vat_pence,total_pence"),
            fetchSplits("videography", "videography_edit_requests", "id,booking_id,twilight_items,extra_images_qty,vat_pence,total_pence"),
          ]);

          // The rate only matters for payments we hold no split for - Pixieset
          // quotes tax-inclusive, so its gross is worked backwards at the same
          // rate the invoices use. Flagged as derived so nobody files a VAT
          // return off a number we inferred.
          let vatRate = 20;
          try {
            const st = (await sbGet(env, "invoice_settings", "id=eq.1&select=vat_rate"))?.[0];
            if (st && st.vat_rate != null) vatRate = Number(st.vat_rate);
          } catch (_) {}

          const out = tagged.map(({ charge: c, source, ref, kind, number }) => {
            const bt = c.balance_transaction && typeof c.balance_transaction === "object" ? c.balance_transaction : null;
            const gross = Number(c.amount) || 0;
            const refunded = Number(c.amount_refunded) || 0;
            const fee = bt ? Number(bt.fee) || 0 : null;

            let net = null, vat = null, derived = true, label = c.description || "Payment", customer = null;
            if (source === "pack") {
              const r = orderById.get(ref);
              if (r) {
                label = r.pack_title || "Pack";
                customer = r.buyer_name || r.buyer_email || null;
                if (r.vat_pence != null) { net = Number(r.amount_pence) || 0; vat = Number(r.vat_pence) || 0; derived = false; }
              }
            } else if (source === "invoice") {
              const r = invoiceById.get(ref);
              label = `Invoice ${(r && r.number) || number || ""}`.trim();
              if (r && r.vat_pence != null) { net = Number(r.subtotal_pence) || 0; vat = Number(r.vat_pence) || 0; derived = false; }
            } else if (source === "videography") {
              const r = editById.get(ref);
              if (r) {
                const tw = Array.isArray(r.twilight_items) ? r.twilight_items.length : 0;
                label = tw ? `Faux twilight - ${tw} image${tw === 1 ? "" : "s"}`
                     : r.extra_images_qty ? `${r.extra_images_qty} extra images` : "Videography upsell";
                if (r.vat_pence != null) { vat = Number(r.vat_pence) || 0; net = (Number(r.total_pence) || gross) - vat; derived = false; }
              } else if (kind) {
                label = kind === "twilight" ? "Faux twilight" : "Extra images";
              }
            }
            // No split of our own: treat what was charged as tax-inclusive.
            if (net == null || vat == null) {
              net = Math.round(gross / (1 + vatRate / 100));
              vat = gross - net;
              derived = true;
            }

            return {
              id: c.id,
              paid_at: new Date((Number(c.created) || 0) * 1000).toISOString(),
              source, ref, label,
              customer: customer || (c.billing_details && c.billing_details.name) || (c.billing_details && c.billing_details.email) || null,
              gross_pence: gross,
              net_pence: net,
              vat_pence: vat,
              vat_derived: derived,
              fee_pence: fee,
              received_pence: fee == null ? null : gross - fee,
              refunded_pence: refunded,
              receipt_url: c.receipt_url || null,
            };
          });

          // ---- Money that never went through Stripe ------------------------
          // An invoice settled by bank transfer or direct debit is real income
          // that Stripe has never heard of, so a page reading Stripe alone is
          // not "all the money in" - which is the only thing this page is for.
          //
          // Invoices PAID BY CARD are already above, as charges carrying
          // metadata.invoice_id. Those are matched by id and skipped, so a card
          // invoice appears once, not twice.
          try {
            const sinceDate = new Date(since * 1000).toISOString().slice(0, 10);
            const seenInvoices = new Set(out.filter((r) => r.source === "invoice" && r.ref).map((r) => String(r.ref)));
            const paidInvoices = await sbGet(env, "invoices",
              `status=eq.paid&paid_date=gte.${sinceDate}`
              + "&select=id,number,bill_to_name,subtotal_pence,vat_pence,total_pence,paid_date,payment_method&limit=1000");
            for (const inv of paidInvoices || []) {
              if (seenInvoices.has(String(inv.id))) continue;
              const gross = Number(inv.total_pence) || 0;
              if (!gross) continue;
              const vat = Number(inv.vat_pence);
              const hasSplit = Number.isFinite(vat);
              const method = String(inv.payment_method || "").replace(/_/g, " ").trim();
              out.push({
                id: `inv_${inv.id}`,
                paid_at: new Date(`${inv.paid_date}T12:00:00Z`).toISOString(),
                source: "invoice", ref: String(inv.id),
                label: `Invoice ${inv.number || ""}`.trim() + (method && method !== "card" ? ` (${method})` : ""),
                customer: inv.bill_to_name || null,
                gross_pence: gross,
                net_pence: hasSplit ? (Number(inv.subtotal_pence) || gross - vat) : Math.round(gross / (1 + vatRate / 100)),
                vat_pence: hasSplit ? vat : gross - Math.round(gross / (1 + vatRate / 100)),
                vat_derived: !hasSplit,
                // No Stripe, so no Stripe fee, and the whole amount arrived.
                fee_pence: 0,
                received_pence: gross,
                refunded_pence: 0,
                off_stripe: true,
                receipt_url: null,
              });
            }
          } catch (e) {
            // Better a Stripe-only list than none - but say so, loudly, because
            // a payments page quietly missing payments is the worst outcome here.
            console.error("payments: off-Stripe invoices", String((e && e.message) || e).slice(0, 200));
          }

          out.sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1));

          return json({ ok: true, days, vat_rate: vatRate, truncated, payments: out }, 200, request, env);
        } catch (e) {
          return json({ error: String((e && e.message) || e).slice(0, 300) }, 502, request, env);
        }
      }

      // ---- AI: generate a social caption (+ hashtags) for a member's post ----
      // Two routes: a structured PROPERTY post, or a free-form "what's it about".
      // The voice rules live in CAPTION_RULES so the client's own captioning
      // guidelines can be dropped in later without touching the wiring.
      if (path.endsWith("/ai/caption") && request.method === "POST") {
        if (!cheapValid(request)) return json({ error: "Sign in to use AI." }, 401, request, env);
        if (!env.ANTHROPIC_API_KEY) return json({ error: "AI isn't configured - set the ANTHROPIC_API_KEY secret on the Worker." }, 503, request, env);
        let body; try { body = await request.json(); } catch (_) { return json({ error: "Bad JSON" }, 400, request, env); }
        const mode = body.mode === "property" ? "property" : "general";
        const clean = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n || 200);

        // Universal caption rules for estate-agent social media (client-supplied).
        // Edit this list to tune the house style; nothing else needs to change.
        const CAPTION_RULES = [
          "You are writing a social-media caption (Instagram/Facebook) AS a knowledgeable LOCAL UK estate agent - not a marketer, not an AI. The reader should feel they're hearing from a real agent with genuine experience and knowledge of their area. Build familiarity, trust and engagement.",
          "LENGTH: aim for 80 to 180 words. Go longer only for educational or advice content where extra explanation genuinely adds value; keep announcements, property launches and market updates shorter. Never pad to hit a word count - every sentence must earn its place.",
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
          "VARIETY: write the caption as its own original piece - vary the opening, sentence structure and closing rather than following a template.",
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
        const toneBlock = tone ? `\n\nThis client's own brand voice - match it closely for tone and personality (while still following every rule above, especially the one-emoji limit):\n${tone}` : "";
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
        if (!caption) return json({ error: "Couldn't generate a caption - please try again." }, 502, request, env);
        return json({ ok: true, caption, hashtags }, 200, request, env);
      }

      // ---- AI: read text + positions from a finished design image ----
      // Powers the studio's "Read text with AI" (Canva import). Holds the
      // Anthropic key as a Worker secret so it never reaches the browser.
      if (path.endsWith("/ai/parse") && request.method === "POST") {
        if (!cheapValid(request)) return json({ error: "Sign in to use AI." }, 401, request, env);
        if (!env.ANTHROPIC_API_KEY) return json({ error: "AI isn't configured - set the ANTHROPIC_API_KEY secret on the Worker (wrangler secret put ANTHROPIC_API_KEY)." }, 503, request, env);
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
          "Only include real text - ignore logos drawn as images, photographic content, and decorative graphics. " +
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
        const ok = await sendPostEmail(env, { email: user.email, item, subject: `Your ${item.platform_hint} post - ready to go` });
        if (!ok) return json({ error: "Couldn't send the email - try again." }, 502, request, env);
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
      /* The photos behind the review page. Public on purpose: the page itself is
         public, and everything it returns is already readable by anyone at
         assets.tmke.co.uk - listing them adds no access, it only saves hard-
         coding two dozen filenames into the site.

         The prefix is fixed here rather than taken from the query, so this
         cannot be turned into a way to enumerate the rest of the bucket. */
      if (path.endsWith("/assets/review-grid") && request.method === "GET") {
        if (!env.ASSETS) return json({ images: [] }, 200, request, env);
        const listed = await env.ASSETS.list({ prefix: "TMKE Review Grid Images/" });
        const images = (listed.objects || [])
          .filter((o) => !o.key.endsWith("/"))
          .filter((o) => /\.(jpe?g|png|webp|avif)$/i.test(o.key))
          .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
          .map((o) => "https://assets.tmke.co.uk/" + o.key.split("/").map(encodeURIComponent).join("/"));
        return json({ images }, 200, request, env);
      }

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
        const service = url.searchParams.get("service") || "";
        if (!date) return json({ error: "Missing date" }, 400, request, env);

        // One off-location shoot a day. Property and Agent shoots are at the
        // client's location, so a morning one in one town and an afternoon one
        // in another isn't a scheduling problem, it's a travel one. Content
        // Studio is exempt on purpose: those run back to back at our studio.
        //
        // Checked here rather than trusting the calendar, because Jack's diary
        // can't tell an off-location shoot from anything else in it.
        if (OFF_LOCATION_SERVICES.includes(service)) {
          // Look back over the buffer as well as the day itself: an on-location
          // shoot needs clear days after it for editing and amendments, so one
          // on the 5th takes the 6th and 7th too.
          const from = new Date(`${date}T00:00:00Z`);
          from.setUTCDate(from.getUTCDate() - OFF_LOCATION_BUFFER_DAYS);
          const window = (await sbGet(env, "videography_bookings",
            `shoot_date=gte.${from.toISOString().slice(0, 10)}T00:00:00&shoot_date=lte.${date}T23:59:59&select=shoot_date,service_type,stage`)) || [];
          const clash = window.find((r) => OFF_LOCATION_SERVICES.includes(r.service_type) && r.stage !== "cancelled");
          if (clash) {
            const sameDay = String(clash.shoot_date || "").slice(0, 10) === date;
            return json({ slots: [], duration, reason: sameDay ? "off_location_taken" : "off_location_buffer" }, 200, request, env);
          }
        }
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
        if (view && /[^0]/.test(view)) return json({ error: "That time was just taken - please choose another." }, 409, request, env);
        const ev = await graph(env, "POST", `/users/${encodeURIComponent(env.JACK_UPN)}/events`, {
          subject: `${service || "Shoot"} - ${name}`,
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
          add_ons, postcode, distance_miles, surcharge_pence, property_address,
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
        if (view && /[^0]/.test(view)) return json({ error: "That time was just taken - please choose another." }, 409, request, env);

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
          subject: `${service || "Shoot"} - ${name}`,
          body: { contentType: "text", content: [notes && `Notes: ${notes}`, phone && `Phone: ${phone}`, email && `Email: ${email}`, postcode && `Postcode: ${postcode}`].filter(Boolean).join("\n") },
          start: { dateTime: `${date}T${start}:00`, timeZone: "Europe/London" },
          end: { dateTime: `${date}T${endHm}:00`, timeZone: "Europe/London" },
          // A postcode is enough to find a town, not a house. Property shoots
          // now collect the full address, so put that on the event Jack reads
          // on the morning rather than throwing it away.
          location: (property_address || postcode) ? { displayName: (property_address || postcode).replace(/\s*\n\s*/g, ", ") } : undefined,
          attendees: [{ emailAddress: { address: email, name }, type: "required" }],
        });

        // 4) Write the full pipeline row (capture the id so we can thread the
        //    confirmation into the member's booking correspondence).
        const rescheduleToken = (crypto.randomUUID && crypto.randomUUID()) || `${date}-${Math.abs(hmToMin(start))}-${ev.id || ""}`;
        let newBookingId = null;
        try {
          // The invoice route belongs to Fine & Country property bookings only.
          // Decided here from the address, not taken from the request: the
          // browser could claim anything, and this one decides who gets billed.
          const fcProperty = service_type === "property"
            && String(email || "").toLowerCase().split("@")[1] === "fineandcountry.com";
          const bookingRow = {
            kind: "booking", service_type: service_type || null, audience: audience || null, brand: brand || null,
            package: pkg || null, add_ons: Array.isArray(add_ons) ? add_ons : [], postcode: postcode || null,
            // The address of the property itself, as opposed to the postcode we
            // took to work out travel. Property shoots only.
            property_address: property_address || null,
            distance_miles: distance_miles ?? null, surcharge_pence: surcharge_pence || 0,
            client_name: name, client_email: email, client_phone: phone || null, company: company || null,
            service: service || null, shoot_date: `${date}T${start}:00`, stage: "booked", notes: notes || null,
            signed_name: signed_name || null, signed_at: signed_at || null, marketing_opt_in: !!marketing_opt_in,
            promo_code: promo_code || null, discount_pence: discount_pence || 0,
            account_user_id: accountUserId, reschedule_token: rescheduleToken, total_pence: total_pence ?? null,
            ms_event_id: ev.id || null, duration_min: dur,
            // Who settles this booking. Validated rather than trusted.
            payment_route: fcProperty && b.payment_route === "brand_invoice" ? "brand_invoice" : "agent_card",
            marketing_fee_claimed: fcProperty ? (b.marketing_fee_claimed === true) : null,
            fc_office: fcProperty && b.payment_route === "brand_invoice" ? (b.fc_office || null) : null,
          };
          let insRes = await sbPost(env, "videography_bookings", bookingRow, "return=representation");
          // PostgREST rejects the whole insert for one unknown column, and this
          // block sits inside a swallowing catch - so a booking made against a
          // database missing a column used to vanish silently while the client
          // still got their confirmation. Retry without it rather than lose it.
          if (!insRes.ok) {
            const errText = await insRes.clone().text().catch(() => "");
            if (/property_address/.test(errText)) {
              const { property_address: _pa, ...rowNoAddr } = bookingRow;
              insRes = await sbPost(env, "videography_bookings", rowNoAddr, "return=representation");
            }
            if (!insRes.ok) console.error("BOOKING NOT SAVED - calendar and emails went out anyway:", errText.slice(0, 400));
          }
          const arr = await insRes.json();
          newBookingId = Array.isArray(arr) && arr[0] ? arr[0].id : null;
        } catch (err) {
          console.error("BOOKING NOT SAVED - calendar and emails went out anyway:", err && err.message);
        }

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
          to: email, subject: `Booking confirmed - ${service || "TMKE"}`,
          html: await wrapInBrandedBase(env, bookingConfirmHtml({ name, service, serviceType: service_type, packageLabel, dateNice, time: start, addOns: add_ons, postcode, surchargePence: surcharge_pence, totalPence: total_pence, manageUrl: `${siteUrl}/manage?token=${encodeURIComponent(rescheduleToken)}` })),
          attachments: [{ filename: "booking.ics", content: icsB64, contentType: "text/calendar" }],
        });
        await sendEmail(env, {
          to: env.JACK_NOTIFY || env.JACK_UPN, subject: `New booking - ${service || "Shoot"} - ${name}`,
          html: jackNotifyHtml({ name, company, email, phone, service, packageLabel, addOns: add_ons, postcode, distanceMiles: distance_miles, surchargePence: surcharge_pence, dateNice, time: start, totalPence: total_pence, signedName: signed_name, marketingOptIn: marketing_opt_in }),
        });

        // Thread the confirmation into the member's booking correspondence.
        await logBookingMessage(env, {
          booking_id: newBookingId, booking_source: "videography",
          account_user_id: accountUserId, client_email: email,
          kind: "confirmation", subject: `Booking confirmed - ${service || "TMKE"}`,
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
        if (!code) return json({ error: "A booking code is required - please use the personalised link from your email." }, 400, request, env);
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
          if (view && /[^0]/.test(view)) return json({ error: "That slot was just taken - please choose another." }, 409, request, env);
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
          if (!ok) return json({ error: "That email already has a TMKE account - the password didn't match. Use your existing password, or reset it on the sign-in page." }, 401, request, env);
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
            subject: `Studio Day (new starter) - ${name}`,
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
            // Every new-starter Studio Day is paid for out of The Property
            // Experts' induction package, not by the starter themselves - so
            // this books straight into the TEG invoicing route rather than
            // defaulting to card payment. bill_to is kept alongside for
            // continuity, but this is what actually drives the invoice now.
            payment_route: "brand_invoice_teg", teg_brand: "property_experts", teg_reason: "induction",
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
        const cHtml = `<div style="${EM_WRAP}">
          <div style="font-size:24px;font-weight:800;letter-spacing:0.14em;color:#371e28;margin:0 0 18px;">TMKE</div>
          <p style="${EM_P}">Hi ${first},</p>
          <p style="${EM_P}">Your <strong>Studio Day</strong> is booked. Here are the details:</p>
          <p style="${EM_P}"><strong>${dateNice}</strong> at <strong>${start}</strong> (about 3 hours)</p>
          <p style="${EM_P}">at the <strong>TMKE Content Studio</strong>. We'll confirm the full address and how to prepare in a reminder before the day.</p>
          <p style="${EM_P}">There's nothing for you to pay - your session is part of your induction package.</p>
          <p style="${EM_SMALL}">Need to change it? Just reply to this email.</p>
        </div>`;
        try { await sendEmail(env, { to: em, subject: "Your Studio Day is booked - TMKE", html: await wrapInBrandedBase(env, cHtml) }); } catch (_) {}
        try { await sendEmail(env, { to: env.JACK_NOTIFY || env.JACK_UPN, subject: `New Studio Day booking - ${name}`, html: `<p>New-starter Studio Day booked.</p><p><strong>${name}</strong> - ${dateNice} at ${start} (3 hrs), TMKE Content Studio.</p><p>${em}${phone ? " · " + phone : ""}</p><p>Bill to <strong>TPE</strong> - £295 + VAT.</p>` }); } catch (_) {}

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
        const lastName = nameParts.join(" ") || "-";
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
          return json({ error: "We couldn't save your enquiry just then - please try again, or email hello@tmke.co.uk." }, 502, request, env);
        }
        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        await sendEmail(env, {
          to: email, subject: `Thanks for your enquiry - ${service || "TMKE"}`,
          html: await wrapInBrandedBase(env, `
            <h1 style="${EM_H1}">Thanks - we'll be in touch</h1>
            <p style="${EM_P}">Hi ${esc(name)}, thanks for your interest in ${esc(service || "our videography")}. Jack will be in touch shortly to talk through what you need and put a quote together.</p>
            ${message ? `<div style="${EM_QUOTE_TEXT}">${esc(message)}</div>` : ""}`),
        });
        await sendEmail(env, {
          to: env.JACK_NOTIFY || env.JACK_UPN, subject: `New enquiry - ${service || "Videography"} - ${name}`,
          html: `<div style="${EM_WRAP}">
            <h1 style="${EM_H1}">New enquiry - ${esc(service || "Videography")}</h1>
            <div style="${EM_QUOTE}">
              <div><span style="color:#888">Client:</span> ${esc(name)}</div>
              ${company ? `<div><span style="color:#888">Company:</span> ${esc(company)}</div>` : ""}
              <div><span style="color:#888">Email:</span> ${esc(email)}</div>
              ${phone ? `<div><span style="color:#888">Phone:</span> ${esc(phone)}</div>` : ""}
              ${postcode ? `<div><span style="color:#888">Location:</span> ${esc(postcode)}</div>` : ""}
              ${message ? `<div><span style="color:#888">Message:</span> ${esc(message)}</div>` : ""}
            </div>
            <p style="${EM_SMALL}">Saved to the Enquiries inbox (/admin/enquiries).</p></div>`,
        });
        // CRM + automations: this is a form submission — upsert the lead and fire
        // any "form submitted" automation.
        try {
          await fireTrigger(env, "form_submitted", {
            email, first_name: firstName, last_name: lastName === "-" ? null : lastName,
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
        if (!(await verifyTurnstile(env, turnstile_token, ip))) return json({ error: "Spam check failed - please try again." }, 400, request, env);
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
          return json({ error: "We couldn't save your message just then - please try again, or email hello@tmke.co.uk." }, 502, request, env);
        }
        const smmEnquiryId = up.id;
        await logBookingMessage(env, { booking_id: smmEnquiryId, booking_source: "smm", account_user_id: accountUserId, client_email: email, channel: "note", kind: "note", body: `Submitted a general enquiry${message ? `: ${message}` : "."}` });

        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Auto-acknowledgement to the sender — ALWAYS (per brief).
        await sendEmail(env, {
          to: email, subject: "Thanks - we've got your message",
          html: await wrapInBrandedBase(env, `
            <h1 style="${EM_H1}">Thanks, ${esc(first_name)} - message received</h1>
            <p style="${EM_P}">We've received your enquiry and a member of the TMKE team will be in touch within one working day.</p>
            ${message ? `<div style="${EM_QUOTE_TEXT}">${esc(message)}</div>` : ""}
            ${accountCreated ? `<p style="${EM_P}">We've also created your TMKE account - sign in any time at <a href="https://tmke.co.uk/login" style="color:#371e28">tmke.co.uk/login</a>.</p>` : ""}`),
        });
        await logBookingMessage(env, {
          booking_id: smmEnquiryId, booking_source: "smm",
          account_user_id: accountUserId, client_email: email,
          kind: "confirmation", subject: "Thanks - we've got your message",
          body: `Auto-acknowledgement sent: we've received ${first_name}'s enquiry and will be in touch within one working day.`,
        });

        // Notify the SMM team.
        await sendEmail(env, {
          to: env.SMM_NOTIFY || env.MAIL_SENDER || env.JACK_NOTIFY, subject: `New enquiry - Social Media - ${fullName}`,
          html: `<div style="${EM_WRAP}">
            <h1 style="${EM_H1}">New Social Media enquiry</h1>
            <div style="${EM_QUOTE}">
              <div><span style="color:#888">Name:</span> ${esc(fullName)}</div>
              <div><span style="color:#888">Business:</span> ${esc(business)}</div>
              <div><span style="color:#888">Email:</span> ${esc(email)}</div>
              ${phone ? `<div><span style="color:#888">Phone:</span> ${esc(phone)}</div>` : ""}
              <div><span style="color:#888">Message:</span> ${esc(message)}</div>
              <div><span style="color:#888">Marketing:</span> ${marketing_opt_in ? "Opted in" : "No"}</div>
              <div><span style="color:#888">Account:</span> ${accountCreated ? "Created" : (accountUserId ? "Existing" : "None")}</div>
            </div>
            <p style="${EM_SMALL}">In the SMM pipeline as a lead (general_enquiry).</p></div>`,
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
        if (!(await verifyTurnstile(env, turnstile_token, ip))) return json({ error: "Spam check failed - please try again." }, 400, request, env);
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
          return json({ error: "We couldn't process that just then - please try again, or email hello@tmke.co.uk." }, 502, request, env);
        }
        const smmBrochureId = up.id;
        await logBookingMessage(env, { booking_id: smmBrochureId, booking_source: "smm", account_user_id: accountUserId, client_email: email, channel: "note", kind: "note", body: "Downloaded the social media brochure." });

        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const brochureUrl = env.SMM_BROCHURE_URL || "https://assets.tmke.co.uk/tmke-smm-brochure.pdf";
        const firstName = String(full_name).trim().split(/\s+/)[0] || "there";

        // Email the brochure (a link — works the moment the PDF is uploaded).
        await sendEmail(env, {
          to: email, subject: "Your TMKE social media brochure",
          html: await wrapInBrandedBase(env, `
            <h1 style="${EM_H1}">Here's your brochure, ${esc(firstName)}</h1>
            <p style="${EM_P}">Thanks for your interest in TMKE social media management. Everything's in the brochure below - what's included, how it works, and what it costs.</p>
            <p style="margin:0 0 22px"><a href="${esc(brochureUrl)}" style="${EM_BTN}">Download the brochure &rarr;</a></p>
            ${accountCreated ? `<p style="${EM_P}">We've also created your TMKE account so you can manage your downloads and bookings in one place - sign in any time at <a href="https://tmke.co.uk/login" style="color:#371e28">tmke.co.uk/login</a>.</p>` : ""}`),
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
        if (!cal) return json({ error: "Discovery call booking is being set up - please check back shortly." }, 503, request, env);
        const b = await request.json().catch(() => ({}));
        const { first_name, last_name, business, email, phone, password, marketing_opt_in, date, start, duration, turnstile_token, hp } = b || {};
        if (hp) return json({ ok: true }, 200, request, env);
        const ip = request.headers.get("CF-Connecting-IP") || "";
        if (!(await verifyTurnstile(env, turnstile_token, ip))) return json({ error: "Spam check failed - please try again." }, 400, request, env);
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
        if (view && /[^0]/.test(view)) return json({ error: "That time was just taken - please choose another." }, 409, request, env);

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
          subject: `Discovery Call - ${fullName}`,
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
        if (!smmDiscoveryId) console.error("smm discovery upsert failed", up.error || "");  // calendar event still created - don't fake failure

        const dateNice = (() => { try { return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch (_) { return date; } })();
        const ics = buildICS({ uid: `${ev.id || token}@tmke.co.uk`, date, start, endHm, summary: "Discovery Call - TMKE Social Media", description: "A call with TMKE to talk through your social media.", location: "Online / phone", organizer: cal, attendeeEmail: email, attendeeName: fullName });
        const icsB64 = bufToBase64(new TextEncoder().encode(ics).buffer);
        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        await sendEmail(env, {
          to: email, subject: `Your call is booked - ${dateNice}`,
          html: await wrapInBrandedBase(env, `
            <h1 style="${EM_H1}">Your call is booked</h1>
            <p style="${EM_P}">Hi ${esc(first_name)}, your call with the TMKE team is confirmed for <strong>${esc(dateNice)} at ${esc(start)}</strong>. We've attached a calendar invite - no prep needed, just bring your questions.</p>
            ${accountCreated ? `<p style="${EM_P}">We've created your TMKE account so your call details, documents, and future bookings live in one place - sign in any time at <a href="https://tmke.co.uk/login" style="color:#371e28">tmke.co.uk/login</a>.</p>` : ""}
            <p style="${EM_P}">Need to change it? Just reply to this email or contact <a href="mailto:hello@tmke.co.uk" style="color:#371e28">hello@tmke.co.uk</a>.</p>`),
          attachments: [{ filename: "discovery-call.ics", content: icsB64, contentType: "text/calendar" }],
        });
        await logBookingMessage(env, {
          booking_id: smmDiscoveryId, booking_source: "smm",
          account_user_id: accountUserId, client_email: email,
          kind: "confirmation", subject: `Your call is booked - ${dateNice}`,
          body: `Your social media discovery call is booked for ${dateNice} at ${start}. It's an online/phone call - no prep needed, just bring your questions.`,
        });
        await sendEmail(env, {
          to: env.SMM_NOTIFY || env.MAIL_SENDER || env.JACK_NOTIFY, subject: `New discovery call - Social Media - ${fullName} - ${dateNice} ${start}`,
          html: `<div style="${EM_WRAP}">
            <h1 style="${EM_H1}">Discovery call booked (Social Media)</h1>
            <div style="${EM_QUOTE}">
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
          html: await wrapInBrandedBase(env, `
            <h1 style="${EM_H1}">Here's your brochure, ${esc(firstName)}</h1>
            <p style="${EM_P}">Thanks for your interest in TMKE videography. Everything's in the brochure below - what's included, how it works, and what it costs.</p>
            <p style="margin:0 0 22px"><a href="${esc(brochureUrl)}" style="${EM_BTN}">Download the brochure &rarr;</a></p>
            ${accountCreated ? `<p style="${EM_P}">We've also created your TMKE account so you can manage your downloads and bookings in one place - sign in any time at <a href="https://tmke.co.uk/login" style="color:#371e28">tmke.co.uk/login</a>.</p>` : ""}`),
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

      // ---- First-party tracking: open pixel + click-through -----------------
      // Unauthenticated by nature (recipients hit these), but every request
      // must carry a valid HMAC from injectTracking or it records nothing —
      // and the click redirect only forwards to a URL the signature vouches
      // for, so it can't be used as an open redirect.
      if (path.endsWith("/t/o") && request.method === "GET") {
        const p = url.searchParams.get("p") || "", s = url.searchParams.get("s") || "";
        if (p && s && s === await trackSig(env, p)) {
          try {
            const meta = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
            const addr = String(meta.e || "").toLowerCase();
            const cs = addr ? await sbGet(env, "contacts", `email=eq.${encodeURIComponent(addr)}&select=id,email&limit=1`) : null;
            await logEmailEvent(env, { contact: cs && cs[0], email: addr, event: "opened", provider: "m365", messageId: meta.m || null, automationId: meta.a || null, enrollmentId: meta.n || null });
          } catch (_) {}
        }
        const gif = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (ch) => ch.charCodeAt(0));
        return new Response(gif, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, private" } });
      }
      if (path.endsWith("/t/c") && request.method === "GET") {
        const p = url.searchParams.get("p") || "", s = url.searchParams.get("s") || "", u = url.searchParams.get("u") || "";
        let dest = "https://tmke.co.uk";
        if (p && s && u && s === await trackSig(env, `${p}|${u}`)) {
          dest = u;
          try {
            const meta = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
            const addr = String(meta.e || "").toLowerCase();
            const cs = addr ? await sbGet(env, "contacts", `email=eq.${encodeURIComponent(addr)}&select=id,email&limit=1`) : null;
            await logEmailEvent(env, { contact: cs && cs[0], email: addr, event: "clicked", provider: "m365", messageId: meta.m || null, url: u, automationId: meta.a || null, enrollmentId: meta.n || null });
          } catch (_) {}
        }
        return Response.redirect(dest, 302);
      }

      // ---- Automations: AI insights summary ---------------------------------
      // A plain-English read on how a funnel is performing, plus anything that
      // needs doing before the next email goes out. Regenerated on each request
      // from the live numbers, so it keeps up as sends happen.
      if (path.endsWith("/automations/insights") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        if (!env.ANTHROPIC_API_KEY) return json({ error: "AI isn't configured - set the ANTHROPIC_API_KEY secret on the Worker." }, 503, request, env);
        const b = await request.json().catch(() => ({}));
        if (!b.automation_id) return json({ error: "No automation id." }, 400, request, env);
        const aid = encodeURIComponent(b.automation_id);
        const [aRows, enr, events] = await Promise.all([
          sbGet(env, "automations", `id=eq.${aid}&select=name,status,trigger_type,trigger_config,graph`),
          sbGet(env, "automation_enrollments", `automation_id=eq.${aid}&select=status,next_run_at`),
          sbGet(env, "email_events", `automation_id=eq.${aid}&select=event,detail,subject,occurred_at&order=occurred_at.desc&limit=2000`),
        ]);
        const auto = aRows && aRows[0];
        if (!auto) return json({ error: "Automation not found." }, 404, request, env);
        const ev = events || [], en = enr || [];
        const n = (e) => ev.filter((x) => x.event === e).length;
        const byStatus = {}; en.forEach((x) => { byStatus[x.status] = (byStatus[x.status] || 0) + 1; });
        const nextRun = en.filter((x) => x.status === "active" && x.next_run_at).map((x) => x.next_run_at).sort()[0] || null;
        const problems = ev.filter((x) => x.event === "bounced" || x.event === "complained" || x.event === "blocked").slice(0, 12)
          .map((x) => `${x.event}${x.detail ? ` (${String(x.detail).slice(0, 80)})` : ""}`);
        const sendSteps = (((auto.graph || {}).nodes) || []).filter((x) => x.type === "send_email");
        const facts = {
          funnel: auto.name, status: auto.status,
          kind: ((auto.graph || {}).meta || {}).kind || "service",
          trigger: auto.trigger_type, chosen_tags: (auto.trigger_config || {}).tags || (auto.trigger_config || {}).tag || null,
          emails_in_funnel: sendSteps.length,
          scheduled_dates: sendSteps.map((x) => (x.config || {}).send_on).filter(Boolean),
          enrolments: byStatus, next_step_due: nextRun,
          sent: n("sent"), delivered: n("delivered"), opened_events: n("opened"), clicked_events: n("clicked"),
          bounced: n("bounced"), spam_complaints: n("complained"), not_sent_blocked: n("blocked"),
          recent_problems: problems,
          now: new Date().toISOString(),
        };
        const prompt = `You are the email-marketing analyst for TMKE, a UK marketing agency. Below are the live numbers for one email funnel. Write a short plain-English summary for a non-technical marketer: first ONE paragraph (3-5 sentences, British English, no jargon, no bullet lists in this paragraph) on how the funnel is performing - be honest, specific and use the actual numbers, mention open/click rates only if delivery numbers exist, and don't invent anything not in the data. Then a line "Actions:" followed by either "none needed." or 1-3 short bullet points of things to do BEFORE the next email goes out (e.g. bounces to investigate, spam complaints, many contacts blocked for missing opt-in, nothing scheduled). If very little has happened yet, say so simply. Total under 160 words.\n\nDATA:\n${JSON.stringify(facts, null, 2)}`;
        let text = "";
        try {
          const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
            body: JSON.stringify({ model: env.AI_MODEL || "claude-sonnet-4-6", max_tokens: 500, messages: [{ role: "user", content: prompt }] }),
          });
          const j = await aiRes.json().catch(() => ({}));
          if (!aiRes.ok) return json({ error: (j.error && j.error.message) || "AI request failed." }, 502, request, env);
          text = ((j.content || []).find((p) => p.type === "text") || {}).text || "";
        } catch (_) { return json({ error: "AI request failed." }, 502, request, env); }
        return json({ ok: true, summary: text.trim() }, 200, request, env);
      }

      // ---- Resend webhook: delivery events feed the CRM ---------------------
      // Resend calls this when an email is delivered / opened / clicked /
      // bounces / is reported as spam. Signature-verified (Svix scheme): without
      // the check, anyone who knew the URL could suppress the whole contact list.
      // Setup: Resend dashboard → Webhooks → add <worker>/resend/webhook, then
      // wrangler secret put RESEND_WEBHOOK_SECRET (the whsec_… signing secret).
      if (path.endsWith("/resend/webhook") && request.method === "POST") {
        if (!env.RESEND_WEBHOOK_SECRET) return json({ error: "Webhook secret not configured." }, 503, request, env);
        const bodyText = await request.text();
        const svixId = request.headers.get("svix-id"), svixTs = request.headers.get("svix-timestamp"), svixSig = request.headers.get("svix-signature");
        const fresh = svixTs && Math.abs(Date.now() / 1000 - Number(svixTs)) < 300;
        let verified = false;
        if (svixId && fresh && svixSig) {
          try {
            const keyBytes = Uint8Array.from(atob(env.RESEND_WEBHOOK_SECRET.replace(/^whsec_/, "")), (ch) => ch.charCodeAt(0));
            const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
            const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${svixId}.${svixTs}.${bodyText}`));
            const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
            verified = svixSig.split(" ").some((s) => s.split(",")[1] === expected);
          } catch (_) { verified = false; }
        }
        if (!verified) return json({ error: "Bad signature." }, 401, request, env);

        let evt = {}; try { evt = JSON.parse(bodyText); } catch (_) {}
        const map = {
          "email.sent": "sent", "email.delivered": "delivered", "email.delivery_delayed": "delivery_delayed",
          "email.opened": "opened", "email.clicked": "clicked", "email.bounced": "bounced",
          "email.complained": "complained", "email.suppressed": "suppressed",
        };
        const event = map[String(evt.type || "")];
        if (!event) return json({ ok: true, ignored: evt.type || "unknown" }, 200, request, env);
        const d = evt.data || {};
        const msgId = d.email_id || null;
        // Our own "sent" row carries the automation attribution — inherit it so
        // opens/bounces count against the right funnel in the insights.
        let sentRow = null;
        if (msgId) {
          const rows = await sbGet(env, "email_events", `message_id=eq.${encodeURIComponent(msgId)}&event=eq.sent&select=automation_id,enrollment_id,subject,email&limit=1`);
          sentRow = rows && rows[0];
        }
        const addr = String((Array.isArray(d.to) ? d.to[0] : d.to) || (sentRow && sentRow.email) || "").toLowerCase();
        let contact = null;
        if (addr) {
          const cs = await sbGet(env, "contacts", `email=eq.${encodeURIComponent(addr)}&select=*&limit=1`);
          contact = cs && cs[0];
        }
        await logEmailEvent(env, {
          contact, email: addr, event, provider: "resend",
          messageId: msgId, subject: (sentRow && sentRow.subject) || d.subject || null,
          url: (d.click && d.click.link) || null,
          detail: (d.bounce && (d.bounce.message || d.bounce.subType || d.bounce.type)) || null,
          raw: evt, occurredAt: evt.created_at || null,
          automationId: (sentRow && sentRow.automation_id) || null,
          enrollmentId: (sentRow && sentRow.enrollment_id) || null,
        });
        // CRM actions, per the suppression plan.
        if (contact) {
          const stamp = { event, subject: (sentRow && sentRow.subject) || null, at: new Date().toISOString() };
          if (event === "delivered") {
            await sbPatch(env, "contacts", `id=eq.${encodeURIComponent(contact.id)}`, { soft_bounce_count: 0, last_email_event: stamp });
          } else if (event === "bounced") {
            const kind = String((d.bounce && d.bounce.type) || "").toLowerCase();
            if (kind === "transient") {
              const n = (Number(contact.soft_bounce_count) || 0) + 1;
              if (n >= SOFT_BOUNCE_LIMIT) await suppressContact(env, contact, "repeated_soft_bounce", `${n} consecutive soft bounces`);
              else await sbPatch(env, "contacts", `id=eq.${encodeURIComponent(contact.id)}`, { soft_bounce_count: n, last_email_event: stamp });
            } else {
              await suppressContact(env, contact, "hard_bounce", (d.bounce && d.bounce.message) || null);
            }
          } else if (event === "complained") {
            await suppressContact(env, contact, "spam_complaint", null);
            await unsubscribeContact(env, contact, "spam_complaint");
            // A spam complaint deserves a human, not just a database row.
            try {
              const who = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || addr;
              const subj = (sentRow && sentRow.subject) || null;
              await sendEmail(env, {
                to: ["danielle@themarketingexperts.co.uk", "hello@tmke.co.uk"],
                subject: `Spam complaint from ${who}`,
                html: `<div style="${EM_WRAP}">
                  <p><strong>${String(who).replace(/</g, "&lt;")}</strong> (${String(addr).replace(/</g, "&lt;")}) reported ${subj ? `“${String(subj).replace(/</g, "&lt;")}”` : "one of our emails"} as spam.</p>
                  <p>Handled automatically: they've been unsubscribed from marketing and their address suppressed, so nothing further will be sent to them.</p>
                  <p>Worth a moment's thought on why - repeated complaints damage tmke.co.uk's sending reputation. Their history is on their contact card in the admin.</p>
                  <p style="${EM_SMALL}">Sent automatically by the email webhook.</p>
                </div>`,
              });
            } catch (_) { /* the alert is a bonus - the suppression already happened */ }
          } else if (event === "suppressed") {
            await suppressContact(env, contact, "resend_suppressed", null);
          } else if (event === "opened" || event === "clicked") {
            await sbPatch(env, "contacts", `id=eq.${encodeURIComponent(contact.id)}`, { last_email_event: stamp });
          }
        }
        return json({ ok: true }, 200, request, env);
      }

      // ---- Automations: enrol an audience (send-to-a-group) ------------------
      // For "audience" automations: enrols every contact currently carrying any
      // of the chosen tags. Late joiners (tag added afterwards) are picked up by
      // fireTrigger's tag_added path. The unique index makes this idempotent —
      // re-running only enrols people not already live in the funnel.
      if (path.endsWith("/automations/enroll-audience") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const aRows = b.automation_id ? await sbGet(env, "automations", `id=eq.${encodeURIComponent(b.automation_id)}&select=id,status,graph,trigger_type,trigger_config`) : null;
        const auto = aRows && aRows[0];
        if (!auto) return json({ error: "Automation not found." }, 404, request, env);
        if (auto.trigger_type !== "audience") return json({ error: "This automation doesn't start from a group of tags." }, 400, request, env);
        if (auto.status !== "active") return json({ error: "Set the automation to Active first - a draft can't enrol anyone." }, 400, request, env);
        const tags = Array.isArray((auto.trigger_config || {}).tags) ? auto.trigger_config.tags.filter(Boolean) : [];
        if (!tags.length) return json({ error: "Choose at least one tag first." }, 400, request, env);
        const firstId = autoEdgeTo(auto.graph, "trigger", "next");
        if (!firstId) return json({ error: "Add a first step to the funnel before enrolling anyone." }, 400, request, env);
        const list = `{${tags.map((t) => `"${String(t).replace(/"/g, "")}"`).join(",")}}`;
        const matched = (await sbGet(env, "contacts", `tags=ov.${encodeURIComponent(list)}&select=id`)) || [];
        let enrolled = 0;
        for (const ct of matched) {
          const res = await sbPost(env, "automation_enrollments", {
            automation_id: auto.id, contact_id: ct.id, status: "active",
            current_node_id: firstId, next_run_at: nowISO(), context: { audience: tags },
          });
          if (res && res.ok) enrolled++;
        }
        return json({ ok: true, matched: matched.length, enrolled, already: matched.length - enrolled }, 200, request, env);
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
        if (view && /[^0]/.test(view)) return json({ error: "That time was just taken - please choose another." }, 409, request, env);
        const interestList = Array.isArray(interests) ? interests : [];
        const ev = await graph(env, "POST", `/users/${encodeURIComponent(env.JACK_UPN)}/events`, {
          subject: `Discovery Call - ${name}`,
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
        const ics = buildICS({ uid: `${ev.id || token}@tmke.co.uk`, date, start, endHm, summary: "Discovery Call - TMKE", description: ["A quick call with Jack to talk through your videography.", interestList.length && `Interested in: ${interestList.join(", ")}`].filter(Boolean).join("\n"), location: "Online / phone", organizer: env.JACK_UPN, attendeeEmail: email, attendeeName: name });
        const icsB64 = bufToBase64(new TextEncoder().encode(ics).buffer);
        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        await sendEmail(env, {
          to: email, subject: `Your discovery call is booked - ${dateNice}`,
          html: await wrapInBrandedBase(env, `
            <h1 style="${EM_H1}">Your call is booked</h1>
            <p style="${EM_P}">Hi ${esc(name)}, your discovery call with Jack is confirmed for <strong>${esc(dateNice)} at ${esc(start)}</strong>. We've attached a calendar invite - no prep needed, just bring your questions.</p>
            <p style="${EM_P}">Need to change it? <a href="${(env.SITE_URL || "https://tmke.co.uk").replace(/\/+$/, "")}/manage?token=${encodeURIComponent(token)}" style="color:#371e28">Reschedule or cancel your call</a>.</p>`),
          attachments: [{ filename: "discovery-call.ics", content: icsB64, contentType: "text/calendar" }],
        });
        await logBookingMessage(env, {
          booking_id: discoveryId, booking_source: "videography",
          account_user_id: accountUserId, client_email: email,
          kind: "confirmation", subject: `Your discovery call is booked - ${dateNice}`,
          body: `Your discovery call with Jack is confirmed for ${dateNice} at ${start}. It's an online/phone call - no prep needed, just bring your questions.`,
        });
        await sendEmail(env, {
          to: env.JACK_NOTIFY || env.JACK_UPN, subject: `New discovery call - ${name} - ${dateNice} ${start}`,
          html: `<div style="${EM_WRAP}">
            <h1 style="${EM_H1}">Discovery call booked</h1>
            <div style="${EM_QUOTE}">
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
        if (days < 3) return json({ error: "Cancellations within 3 days can't be made online - please email jack@tmke.co.uk. Note: cancellations within 48 hours are chargeable in full." }, 422, request, env);
        if (bk.ms_event_id) { try { await graph(env, "DELETE", `/users/${encodeURIComponent(env.JACK_UPN)}/events/${bk.ms_event_id}`); } catch (_) {} }
        // Checked, because it used to fail silently: 'cancelled' was missing from
        // the stage constraint, so the write was rejected while the client was
        // told it had worked and the booking stayed live in the pipeline.
        const cancelRes = await sbPatch(env, "videography_bookings", `id=eq.${bk.id}`, { stage: "cancelled" });
        if (cancelRes && !cancelRes.ok) {
          const detail = await cancelRes.text().catch(() => "");
          console.error("cancel failed to save", cancelRes.status, detail);
          return json({ error: "We couldn't cancel that just then - please email jack@tmke.co.uk." }, 502, request, env);
        }
        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        await sendEmail(env, {
          to: bk.client_email, subject: `Booking cancelled - ${bk.service || "TMKE"}`,
          html: await wrapInBrandedBase(env, `
            <h1 style="${EM_H1}">Your booking is cancelled</h1>
            <p style="${EM_P}">Hi ${esc(bk.client_name || "")}, we've cancelled your ${esc(bk.service || "booking")}. If this was a mistake or you'd like to rebook, just head back to <a href="https://tmke.co.uk/videography" style="color:#371e28">tmke.co.uk/videography</a>.</p>`),
        });
        await sendEmail(env, { to: env.JACK_NOTIFY || env.JACK_UPN, subject: `Cancelled - ${bk.service || "Booking"} - ${bk.client_name || ""}`, html: `<div style="${EM_WRAP}"><p>${esc(bk.client_name || "")} cancelled their ${esc(bk.service || "booking")} (was ${esc(bk.shoot_date || "")}).</p></div>` });
        await logBookingMessage(env, {
          booking_id: bk.id, booking_source: "videography", account_user_id: bk.account_user_id, client_email: bk.client_email,
          kind: "cancellation", subject: `Booking cancelled - ${bk.service || "TMKE"}`,
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
        if (days < 2) return json({ error: "Rescheduling within 2 days can't be done online - please email jack@tmke.co.uk." }, 422, request, env);
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
        if (view && /[^0]/.test(view)) return json({ error: "That time isn't free - please pick another." }, 409, request, env);
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
          to: bk.client_email, subject: `Booking rescheduled - ${dateNice}`,
          html: await wrapInBrandedBase(env, `
            <h1 style="${EM_H1}">Your booking has moved</h1>
            <p style="${EM_P}">Hi ${esc(bk.client_name || "")}, your ${esc(bk.service || "booking")} is now <strong>${esc(dateNice)} at ${esc(start)}</strong>. An updated calendar invite is attached.</p>`),
          attachments: [{ filename: "booking.ics", content: icsB64, contentType: "text/calendar" }],
        });
        await sendEmail(env, { to: env.JACK_NOTIFY || env.JACK_UPN, subject: `Rescheduled - ${bk.service || "Booking"} - ${bk.client_name || ""}`, html: `<div style="${EM_WRAP}"><p>${esc(bk.client_name || "")} moved their ${esc(bk.service || "booking")} to ${esc(dateNice)} at ${esc(start)}.</p></div>` });
        await logBookingMessage(env, {
          booking_id: bk.id, booking_source: "videography", account_user_id: bk.account_user_id, client_email: bk.client_email,
          kind: "reschedule", subject: `Booking rescheduled - ${dateNice}`,
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
        // MAIL_FROM is posts@tmke.co.uk, which sends fine (the domain is
        // verified) but isn't a mailbox anyone reads. Point replies at a real
        // one so "please stop emailing me" reaches a human.
        reply_to: env.MAIL_REPLY_TO || "hello@tmke.co.uk",
                to: email,
                subject: `You're on the cancellation list - ${service || section || "The Studio"}`,
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
          // This endpoint serves two different acts of consent: the footer
          // subscribe box, and ticking "marketing" during member signup
          // (member-signup.js posts source:"signup"). The contact's own source
          // stays "newsletter" as it always has — only the audit trail draws
          // the distinction, because "they subscribed" and "they ticked a box
          // while joining" are not the same evidence.
          const joined = String((b && b.source) || "").trim() === "signup";
          await fireTrigger(env, "form_submitted", {
            email, first_name: parts.shift() || null, last_name: parts.join(" ") || null,
            source: "newsletter", lifecycle: "lead", marketing_opt_in: true,
            tags: crmTags(email, [], { optIn: true }),
          }, { form: "newsletter" }, joined ? "join_signup" : "newsletter_footer");
        } catch (_) {}
        return json({ ok: true }, 200, request, env);
      }

      // ---- Public: contact-form enquirer into the CRM (NO auth) -------------
      // /contact wrote the enquiry straight to Supabase from the browser and
      // stopped there, so an enquirer never became a contact at all and the
      // marketing tickbox was stored on the enquiry row and read by nothing —
      // ticking it opted nobody in. This adds the missing half.
      //
      // Fires its own `contact_form_submitted` trigger rather than sharing
      // `form_submitted`. Automations are both the funnel builder and the
      // register of every automated email the site sends, so an acknowledgement
      // belongs there and not hard-coded here — but on a dedicated trigger, so
      // building one reaches contact-form enquirers only and can't widen an
      // existing funnel by accident. Nothing listens to it yet, so today this
      // creates the contact and records consent and sends nobody anything.
      //
      // The form still does its own enquiries insert, which is left untouched —
      // this is called afterwards, and failing here must never cost the enquiry.
      if (path.endsWith("/contact/enquirer") && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        if (b && b.hp) return json({ ok: true }, 200, request, env); // honeypot
        const email = String((b && b.email) || "").trim().toLowerCase();
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Please add a valid email." }, 400, request, env);
        const consent = b.marketing_consent === true;
        // RFC 2606 reserved domains cannot receive mail, so there is nothing to
        // send and nobody to disturb. Skipping them lets this endpoint be
        // exercised end to end — CRM write included — without emailing a real
        // person or the team, which is what it took to find the fault below.
        const reserved = /@(example\.(com|net|org)|[^@]*\.(test|invalid|example|localhost))$/i.test(email);
        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const firstName = String(b.first_name || "").trim();
        const fullName = [b.first_name, b.last_name].map((s) => String(s || "").trim()).filter(Boolean).join(" ") || email;
        const message = String(b.message || "").trim();
        const company = String(b.business_name || "").trim();

        // 1. The CRM write goes FIRST. It ran last to begin with, behind two
        //    sendEmail calls, which meant anything slow or broken in the mail
        //    path — a Graph token, a subrequest ceiling, a hang rather than a
        //    throw — cost the contact entirely. The record matters more than
        //    the courtesy email, so it is no longer downstream of it.
        let crm = null, crmError = null;
        try {
          crm = await fireTrigger(env, "contact_form_submitted", {
            email,
            first_name: b.first_name || null,
            last_name: b.last_name || null,
            phone: b.phone || null,
            company: b.business_name || null,
            source: "contact_form",
            lifecycle: "lead",
            // null, not false: an enquiry from someone who already opted in
            // elsewhere must not quietly withdraw their consent.
            marketing_opt_in: consent ? true : null,
            tags: crmTags(email, [], { optIn: consent }),
          }, { form: "contact_form", industry: b.industry || null }, "contact_form");
        } catch (e) {
          crmError = String((e && e.message) || e);
        }
        // Swallowing this silently is what made the first failure undiagnosable.
        if (crmError || !crm || !crm.ok) console.error("contact enquirer CRM write failed", crmError, JSON.stringify(crm));

        // 2. Acknowledgement to the enquirer. Transactional — a reply to
        //    something they did — so it reaches them whether or not they ticked
        //    the marketing box. Same shape as the videography auto-ack.
        let ackError = null;
        try {
          if (!reserved) await sendEmail(env, {
            to: email,
            subject: "Thanks for getting in touch - TMKE",
            html: await wrapInBrandedBase(env, `
              <h1 style="${EM_H1}">Thanks - we've got your message</h1>
              <p style="${EM_P}">Hi ${esc(firstName || "there")}, thanks for getting in touch with TMKE. Your message has reached the team and someone will come back to you shortly.</p>
              ${message ? `<p style="${EM_P}">Here's what you sent us, for your records:</p><div style="${EM_QUOTE_TEXT}">${esc(message)}</div>` : ""}
              <p style="${EM_P}">If anything's changed in the meantime, just reply to this email and it'll come straight to us.</p>`),
          });
        } catch (e) { ackError = String((e && e.message) || e); console.error("contact enquirer ack email failed", ackError); }

        // 3. Alert to the team. An internal admin email, so it goes via the
        //    Worker rather than an automation, same as Jack's booking alert.
        let notifyError = null;
        try {
          if (!reserved) await sendEmail(env, {
            to: env.ENQUIRY_NOTIFY || env.SMM_MANAGER_UPN || "hello@tmke.co.uk",
            subject: `New contact enquiry - ${fullName}`,
            html: `<div style="${EM_WRAP}">
              <h1 style="${EM_H1}">New contact enquiry</h1>
              <div style="${EM_QUOTE}">
                <div><span style="color:#888">Name:</span> ${esc(fullName)}</div>
                ${company ? `<div><span style="color:#888">Business:</span> ${esc(company)}</div>` : ""}
                <div><span style="color:#888">Email:</span> ${esc(email)}</div>
                ${b.phone ? `<div><span style="color:#888">Phone:</span> ${esc(b.phone)}</div>` : ""}
                ${b.industry ? `<div><span style="color:#888">Industry:</span> ${esc(b.industry)}</div>` : ""}
                ${message ? `<div><span style="color:#888">Message:</span> ${esc(message)}</div>` : ""}
                <div><span style="color:#888">Marketing opt-in:</span> ${consent ? "Yes" : "No"}</div>
              </div>
              <p style="${EM_SMALL}">Saved to the Enquiries inbox (/admin/enquiries). They've had an automatic acknowledgement.</p></div>`,
          });
        } catch (e) { notifyError = String((e && e.message) || e); console.error("contact enquirer team alert failed", notifyError); }

        // Reports what actually happened. The browser ignores it — the enquiry
        // is already saved and the sender must never see an error for something
        // that worked — but it makes the endpoint testable from outside, which
        // the first version was not.
        return json({
          ok: true,
          contact_id: (crm && crm.contact_id) || null,
          enrolled: (crm && crm.enrolled) || 0,
          errors: { crm: crmError || (crm && crm.error) || null, ack: ackError, notify: notifyError },
        }, 200, request, env);
      }
    } catch (err) {
      return json({ error: String(err && err.message ? err.message : err) }, 500, request, env);
    }

    // Auth. Hot upload path (part/complete/abort) uses a fast local expiry check
    // — it already requires an unguessable uploadId minted by the fully-authed
    // /create. Everything else does full Supabase validation.
    //
    // This has no path scoping of its own, so it silently gates EVERY route
    // defined below it in the file, not just the upload cluster it was
    // written for - which broke the edit-request page (genuinely public: an
    // F&C agent or TEG new starter clicking an email link has no TMKE
    // account to sign in with) the moment those routes landed after this
    // point. Explicit bypass here rather than reordering the file, so the
    // next route added below doesn't fall into the same trap silently.
    const publicNoAuth = path.endsWith("/videography/edit-request/context")
      || path.endsWith("/videography/edit-request")
      || path.endsWith("/assets/review-grid");
    if (!publicNoAuth) {
      const hot = path.endsWith("/part") || path.endsWith("/complete") || path.endsWith("/abort");
      if (hot) {
        if (!cheapValid(request)) return json({ error: "Unauthorised" }, 401, request, env);
      } else {
        const user = await getUser(request, env);
        if (!user) return json({ error: "Unauthorised" }, 401, request, env);
      }
    }

    try {
      // ---- Send an email via Resend (admin only) ----
      // Powers the admin email-template builder's "Send test", and is the relay
      // ---- Admin: preview an automated email (renders the REAL builder with
      // sample data — read-only, changes nothing that sends). ------------------
      // Preview an automated email with sample data — and (POST) send that exact
      // preview to yourself as a test, so what you check is what goes out.
      if (path.endsWith("/email/preview/send") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const id = String((b && b.id) || "");
        const to = String((b && b.to) || "").trim();
        if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ ok: false, error: "Enter a valid email address." }, 200, request, env);
        const built = emailPreviewSample(id);
        if (!built) return json({ ok: false, error: "There's no preview for that email yet." }, 200, request, env);
        let html = built.html;
        if (b && b.branded) html = await wrapInBrandedBase(env, html);
        const sent = await sendEmail(env, { to, subject: `[Test] ${built.subject}`, html });
        return sent && sent.ok
          ? json({ ok: true, to }, 200, request, env)
          : json({ ok: false, error: (sent && sent.error) || "Couldn't send it." }, 200, request, env);
      }

      if (path.endsWith("/email/preview") && (request.method === "GET" || request.method === "POST")) {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        // POST carries unsaved style settings from the style editor, so it can
        // preview a change through the real pipeline before committing to it.
        const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
        const id = body.id || url.searchParams.get("id") || "";
        const branded = body.branded === true || url.searchParams.get("branded") === "1";
        const override = body.styles && typeof body.styles === "object" ? body.styles : null;
        const built = emailPreviewSample(id);
        if (!built) return json({ ok: true, supported: false }, 200, request, env);
        try {
          let html = built.html;
          if (branded) html = await wrapInBrandedBase(env, html, override);
          else html = styleEmailContent(html, override || EMS);
          return json({ ok: true, supported: true, subject: built.subject, html }, 200, request, env);
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
        const { bookingId, fileName, contentType, folder, category } = await request.json();
        // A booking id is unique but tells you nothing when you're looking
        // through storage months later. When the admin centre supplies a folder
        // name, files land under it - and under their category, so exteriors and
        // interiors are separate without anyone renaming a thing.
        const key = folder
          ? safeFolderKey(folder, category, `${Date.now()}-${fileName}`)
          : safeKey(bookingId, `${Date.now()}-${fileName}`);
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
          channel: b.notify ? "email" : "note",
          kind: b.kind === "audit" ? "audit" : "manual",
          subject: b.subject || null,
          body: bodyText, is_automated: b.kind === "audit", created_by: user.email || "admin",
        });

        // Anyone @-tagged in an internal note gets told, or the tag is decoration.
        if (!b.notify && Array.isArray(b.mentions) && b.mentions.length) {
          const escapeHtmlW = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const known = new Set(((await sbGet(env, "admins", "select=email")) || []).map((r) => String(r.email || "").toLowerCase()));
          const to = [...new Set(b.mentions.map((m) => String(m || "").toLowerCase()))]
            .filter((m) => known.has(m) && m !== String(user.email || "").toLowerCase());
          for (const addr of to) {
            await sendEmail(env, {
              to: addr,
              subject: `${user.email || "Someone"} tagged you on ${bk.client_name || "a booking"}`,
              html: await wrapInBrandedBase(env, `<div style="${EM_WRAP}">
                <p style="${EM_P}">${escapeHtmlW(user.email || "A colleague")} tagged you in a note on <strong>${escapeHtmlW(bk.client_name || "a booking")}</strong>.</p>
                <p style="${EM_QUOTE}"><span style="${EM_QUOTE_TEXT}">${escapeHtmlW(bodyText)}</span></p>
                <p style="${EM_SMALL}">Open the booking in the admin centre to reply.</p>
              </div>`),
            });
          }
        }
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
              html: await wrapInBrandedBase(env, `
                <p style="${EM_P}">Hi ${esc(bk.name || "")},</p>
                <div style="font-size:12px;line-height:1.6;color:#40353a;white-space:pre-wrap;margin:0 0 14px;">${esc(bodyText)}</div>
                ${attachments ? `<p style="${EM_P}">📎 A document is attached to this email.</p>` : ""}
                <p style="${EM_P}">You can view this and manage your booking in your TMKE workspace.</p>`),
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
      // A note belongs to whoever wrote it. Being an admin gets you into the
      // thread; it does not entitle you to rewrite or remove a colleague's note.
      // Checked here rather than by hiding buttons - the endpoint is the lock,
      // the UI is only the sign on the door.
      if (path.endsWith("/booking/message") && (request.method === "DELETE" || request.method === "PATCH")) {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const body = request.method === "PATCH" ? await request.json().catch(() => ({})) : {};
        const id = (url.searchParams.get("id") || body.id || "").trim();
        if (!id) return json({ error: "Missing id" }, 400, request, env);

        const rows = await sbGet(env, "booking_messages", `id=eq.${encodeURIComponent(id)}&select=id,created_by,channel`);
        const msg = rows && rows[0];
        if (!msg) return json({ error: "Not found." }, 404, request, env);

        const mine = String(msg.created_by || "").toLowerCase() === String(user.email || "").toLowerCase();
        if (!mine) return json({ error: "You can only edit or delete your own notes." }, 403, request, env);
        // Only notes. An emailed message is a record of something that was
        // actually sent, and editing it would make the thread a lie.
        if (msg.channel !== "note") return json({ error: "Only notes can be edited or deleted." }, 422, request, env);

        if (request.method === "DELETE") {
          await fetch(`${env.SUPABASE_URL}/rest/v1/booking_messages?id=eq.${encodeURIComponent(id)}`, {
            method: "DELETE", headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}` },
          });
          return json({ ok: true }, 200, request, env);
        }

        const text = String(body.body || "").trim();
        if (!text) return json({ error: "A note can't be empty." }, 400, request, env);
        const res = await sbPatch(env, "booking_messages", `id=eq.${encodeURIComponent(id)}`, { body: text, edited_at: new Date().toISOString() });
        if (res && !res.ok) {
          const detail = await res.text().catch(() => "");
          console.error("note edit failed", res.status, detail);
          // The edited_at column not existing is much the likeliest cause, and
          // the raw Postgres message doesn't say what to do about it.
          // Admin-only endpoint, so the real reason is safe to show - and a
          // bare "couldn't save" leaves nothing to act on.
          return json({ error: /edited_at/i.test(detail)
            ? "Needs a one-off database step: run supabase/smm_manager_and_interbrand.sql."
            : `Couldn't save that edit (${res.status}). ${String(detail).slice(0, 200)}` }, 502, request, env);
        }
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
            tempPassword = null; // it existed after all - don't claim a new password
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
          ? `<p style="${EM_P}">Sign in with your email and this temporary password:</p>
             <p style="margin:0 0 18px;"><span style="display:inline-block;font-family:ui-monospace,Menlo,monospace;font-size:12px;font-weight:700;letter-spacing:0.04em;background:#f4f2f1;border:1px solid #e4ded9;border-radius:8px;padding:9px 14px;color:#371e28;">${tempPassword}</span></p>
             <p style="${EM_P}">Please change it once you're in (Forgot password on the sign-in screen).</p>`
          : `<p style="${EM_P}">Sign in with your existing email and password.</p>`;
        const html = `<div style="${EM_WRAP}">
          <div style="font-size:24px;font-weight:800;letter-spacing:0.14em;color:#371e28;margin:0 0 18px;">TMKE</div>
          <p style="${EM_P}">Hi ${who},</p>
          <p style="${EM_P}">You've been given access to the <strong>TMKE admin centre</strong>.</p>
          ${credLine}
          <p style="margin:0 0 22px;"><a href="${loginUrl}" style="${EM_BTN}">Open the admin centre</a></p>
          <p style="${EM_SMALL}">If you weren't expecting this, you can ignore this email.</p>
        </div>`;
        try { await sendEmail(env, { to: email, subject: "Your TMKE admin access", html: await wrapInBrandedBase(env, html) }); } catch (_) {}

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
        const html = `<div style="${EM_WRAP}">
          <div style="font-size:24px;font-weight:800;letter-spacing:0.14em;color:#371e28;margin:0 0 18px;">TMKE</div>
          <p style="${EM_P}">Hi ${who},</p>
          <p style="${EM_P}">Your <strong>TMKE admin</strong> password has been reset. Your previous password no longer works.</p>
          <p style="${EM_P}">Sign in with your email and this temporary password:</p>
          <p style="margin:0 0 18px;"><span style="display:inline-block;font-family:ui-monospace,Menlo,monospace;font-size:12px;font-weight:700;letter-spacing:0.04em;background:#f4f2f1;border:1px solid #e4ded9;border-radius:8px;padding:9px 14px;color:#371e28;">${tempPassword}</span></p>
          <p style="${EM_P}">Please change it once you're in (Forgot password on the sign-in screen).</p>
          <p style="margin:0 0 22px;"><a href="${loginUrl}" style="${EM_BTN}">Open the admin centre</a></p>
          <p style="${EM_SMALL}">If you didn't expect this, contact hello@tmke.co.uk.</p>
        </div>`;
        try { await sendEmail(env, { to: email, subject: "Your TMKE admin password has been reset", html: await wrapInBrandedBase(env, html) }); } catch (_) {}

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
        if (!inv.bill_to_email) return json({ error: "This invoice has no recipient email - add one first." }, 400, request, env);
        const st = (await sbGet(env, "invoice_settings", "id=eq.1&select=*"))?.[0] || {};
        // The person raising the invoice can pick the style; fall back to the saved default.
        const stForPdf = { ...st, template: inv.template || st.template };

        // Videography invoices carry booking_id, so the covering email can say
        // whose shoot it was and where - which a Fine & Country office needs,
        // because it is settling somebody else's bill.
        let bk = null;
        if (inv.booking_id && (inv.booking_source || "videography") === "videography") {
          const brows = await sbGet(env, "videography_bookings",
            `id=eq.${encodeURIComponent(inv.booking_id)}&select=client_name,service,payment_route,property_address,location,teg_reason,teg_reason_other`);
          bk = (brows && brows[0]) || null;
        }
        const forBrand = bk && (bk.payment_route === "brand_invoice" || bk.payment_route === "brand_invoice_teg");
        const agentName = (bk && bk.client_name) || "";

        let pdf;
        try { pdf = await renderInvoicePdf(env, stForPdf, inv); }
        catch (err) { return json({ error: "Couldn't render the PDF: " + (err && err.message ? err.message : err) }, 502, request, env); }

        // Keep a copy in R2 (deterministic key by number).
        const pdfKey = `invoices/${(inv.number || inv.id)}.pdf`;
        try { await env.BUCKET.put(pdfKey, pdf, { httpMetadata: { contentType: "application/pdf" } }); } catch (_) {}

        // The sender can edit the subject, body and CC on the review step before
        // sending; fall back to the invoice's stored values / defaults otherwise.
        const coName = st.company_name || "The Marketing Experts (Nationwide) Ltd";
        // "Property videography invoice TMKE1022 - Jane Smith from ..." so the
        // office can tell at a glance which shoot it is being billed for.
        const autoSubject = forBrand
          ? `${bk.service || "Videography"} invoice ${inv.number}${agentName ? ` - ${agentName}` : ""} from ${coName}`
          : `Invoice ${inv.number} from ${coName}`;
        const subject = (b && typeof b.email_subject === "string" && b.email_subject.trim()) ? b.email_subject.trim() : autoSubject;
        const cc = (b && b.cc !== undefined) ? (String(b.cc || "").trim() || null) : (inv.cc_email || null);

        // Covering email with the PDF attached; accounts dept CC'd. If the email
        // doesn't actually go, don't mark it sent — tell the caller so they retry.
        // A pay link only if this invoice opted in AND Stripe is actually
        // configured - emailing a button that 503s would be worse than no button.
        const wantsCard = !!inv.pay_by_card && inv.status !== "paid";
        const payUrl = (wantsCard && env.STRIPE_SECRET_KEY) ? await invoicePayUrl(env, inv.id) : null;

        const mail = invoiceMailTo(inv.bill_to_email, cc);
        const emailed = await sendEmail(env, {
          to: mail.to,
          cc: mail.cc,
          subject,
          html: await wrapInBrandedBase(env, invoiceEmailHtml(st, inv, b && b.email_body, payUrl, bk)),
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

      // One invoice, in full. The list select is lean and carries no line items,
      // and reading the table straight from the browser depends on the admin's
      // own RLS row - which is one more thing to be wrong when an editor won't
      // populate. The service role has no such doubt.
      if (path.endsWith("/invoicing/invoice") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const id = (url.searchParams.get("id") || "").trim();
        if (!id) return json({ error: "Missing id" }, 400, request, env);
        const rows = await sbGet(env, "invoices", `id=eq.${encodeURIComponent(id)}&select=*`);
        const inv = rows && rows[0];
        if (!inv) return json({ error: "Invoice not found." }, 404, request, env);
        return json({ ok: true, invoice: inv }, 200, request, env);
      }

      // ---- Admin: invoices (create draft / list / mark paid) -----------------
      // ---- Admin: the month-end chase list ----------------------------------
      //
      // What accounts has to confirm at the end of a month, in one table:
      // everything raised this month, plus anything still unpaid from any
      // month. Two questions get asked of it, so the rows carry which one they
      // are - has an inter-brand transfer actually been done, or has an
      // ordinary invoice landed in the bank.
      //
      // Inter-brand isn't on the invoice. It lives on the booking, as
      // payment_route brand_invoice (Fine & Country) or brand_invoice_teg (a
      // TEG sister brand), so the bookings are fetched and matched back. An
      // invoice with no booking is treated as ordinary, which is what a
      // manually raised one is.
      if (path.endsWith("/invoicing/report") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);

        // Default to the month we are in. YYYY-MM.
        const now = new Date();
        const raw = String(url.searchParams.get("month") || "").trim();
        const month = /^\d{4}-\d{2}$/.test(raw)
          ? raw
          : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
        const [yy, mm] = month.split("-").map(Number);
        const monthStart = `${month}-01`;
        const nextMonth = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;

        try {
          const rows = await sbGet(env, "invoices",
            "select=id,number,booking_id,booking_source,bill_to_name,bill_to_email,total_pence,status,issued_date,due_date,paid_date,payment_method"
            + "&status=neq.void&order=issued_date.desc&limit=1000");

          const inMonth  = (v) => !!v.issued_date && v.issued_date >= monthStart && v.issued_date < nextMonth;
          const unpaid   = (v) => v.status !== "paid";
          const relevant = (rows || []).filter((v) => inMonth(v) || unpaid(v));

          // One query for every booking referenced, rather than one per row.
          const bookingIds = [...new Set(relevant.map((v) => v.booking_id).filter(Boolean))];
          const routeById = new Map();
          if (bookingIds.length) {
            try {
              const bks = await sbGet(env, "videography_bookings",
                `id=in.(${bookingIds.map((i) => `"${i}"`).join(",")})&select=id,payment_route,fc_office,teg_brand,client_name`);
              for (const b of bks || []) routeById.set(String(b.id), b);
            } catch (_) { /* no route means "ordinary", which is the safe reading */ }
          }

          const today = new Date().toISOString().slice(0, 10);
          const out = relevant.map((v) => {
            const bk = v.booking_id ? routeById.get(String(v.booking_id)) : null;
            const route = bk && bk.payment_route;
            const interBrand = route === "brand_invoice" || route === "brand_invoice_teg";
            const brand = route === "brand_invoice"
              ? ("Fine & Country" + (bk && bk.fc_office ? ` — ${bk.fc_office}` : ""))
              : route === "brand_invoice_teg"
                ? ("TEG" + (bk && bk.teg_brand ? ` — ${String(bk.teg_brand).replace(/_/g, " ")}` : ""))
                : null;
            const overdue = v.status !== "paid" && v.due_date && v.due_date < today
              ? Math.floor((Date.parse(today) - Date.parse(v.due_date)) / 86400000)
              : 0;
            return {
              id: v.id, number: v.number || "—",
              bill_to: v.bill_to_name || (bk && bk.client_name) || "—",
              total_pence: Number(v.total_pence) || 0,
              status: v.status, issued_date: v.issued_date, due_date: v.due_date, paid_date: v.paid_date,
              inter_brand: interBrand, brand,
              raised_this_month: inMonth(v),
              outstanding: unpaid(v),
              days_overdue: overdue,
            };
          });

          const sum = (f) => out.filter(f).reduce((t, r) => t + r.total_pence, 0);
          return json({
            ok: true, month,
            payments: out,
            totals: {
              raised: sum((r) => r.raised_this_month),
              outstanding: sum((r) => r.outstanding),
              outstanding_inter_brand: sum((r) => r.outstanding && r.inter_brand),
              outstanding_other: sum((r) => r.outstanding && !r.inter_brand),
            },
          }, 200, request, env);
        } catch (e) {
          console.error("invoicing/report", String((e && e.message) || e).slice(0, 200));
          return json({ error: "Couldn't build the report." }, 502, request, env);
        }
      }

      if (path.endsWith("/invoicing/invoices") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const extra = url.searchParams.get("booking_id") ? `&booking_id=eq.${encodeURIComponent(url.searchParams.get("booking_id"))}` : "";
        const tail = `${extra}&order=created_at.desc&limit=300`;
        const BASE = "id,number,bill_to_name,bill_to_email,cc_email,total_pence,status,issued_date,due_date,paid_date,payment_method,billing_month,created_at";
        // PostgREST rejects the whole query for one unknown column, so if
        // supabase/invoicing_stripe.sql hasn't run yet, asking for pay_by_card
        // would blank the entire invoice list rather than just omitting a badge.
        let rows = await sbGet(env, "invoices", `select=${BASE},payment_ref,pay_by_card,terms_days,release_on_payment${tail}`);
        if (!rows) rows = (await sbGet(env, "invoices", `select=${BASE}${tail}`)) || [];
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
          pay_by_card: !!(b && b.pay_by_card),
          // Per-invoice override; null means fall back to the global setting.
          terms_days: (b && b.terms_days != null && b.terms_days !== "") ? Math.max(0, Math.round(Number(b.terms_days))) : null,
          release_on_payment: !!(b && b.release_on_payment),
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
          // Same tolerance for the card-payment column
          // (supabase/invoicing_stripe.sql). Save the invoice rather than lose it.
          if (!res.ok && /pay_by_card/.test(errText)) {
            const { pay_by_card: _p, ...rowNoPay } = row;
            res = await sbPost(env, "invoices", rowNoPay, "return=representation");
          }
          // Same tolerance for supabase/invoicing_terms.sql.
          if (!res.ok && /terms_days|release_on_payment/.test(errText)) {
            const { terms_days: _t2, release_on_payment: _r, ...rowNoTerms } = row;
            res = await sbPost(env, "invoices", rowNoTerms, "return=representation");
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

        // Editing the CONTENT of an invoice, as opposed to its status. Only
        // allowed while it is still a draft: once an invoice has been sent the
        // client holds a numbered document, and quietly changing ours would
        // leave two different papers claiming to be the same invoice. A sent
        // invoice is reissued instead.
        if (!status && b && Array.isArray(b.line_items)) {
          const cur = (await sbGet(env, "invoices", `id=eq.${encodeURIComponent(id)}&select=status`))?.[0];
          if (!cur) return json({ error: "Invoice not found." }, 404, request, env);
          if (cur.status !== "draft") return json({ error: "Only a draft can be edited. Reissue a sent invoice instead." }, 409, request, env);

          const items = b.line_items
            .map((it) => ({ description: String((it && it.description) || "").trim(), qty: it && it.qty != null ? Number(it.qty) : 1, unit_pence: Math.round(Number((it && it.unit_pence) || 0)) }))
            .filter((it) => it.description || it.unit_pence);
          if (!items.length) return json({ error: "Add at least one line item." }, 400, request, env);

          const st2 = (await sbGet(env, "invoice_settings", "id=eq.1&select=vat_rate"))?.[0] || {};
          const vatRate2 = st2.vat_rate != null ? Number(st2.vat_rate) : 20;
          const subtotal2 = items.reduce((sum, it) => sum + it.unit_pence * (it.qty || 1), 0);
          const vat2 = Math.round(subtotal2 * vatRate2 / 100);
          const patch2 = {
            line_items: items, subtotal_pence: subtotal2, vat_pence: vat2, total_pence: subtotal2 + vat2,
            bill_to_name: (b.bill_to_name || "").trim() || null,
            bill_to_email: b.bill_to_email || null,
            bill_to_address: b.bill_to_address || null,
            cc_email: b.cc_email !== undefined ? (String(b.cc_email || "").trim() || null) : undefined,
            issued_date: b.issued_date || null, due_date: b.due_date || null,
            notes: b.notes || null,
            pay_by_card: !!b.pay_by_card,
            release_on_payment: !!b.release_on_payment,
            terms_days: (b.terms_days != null && b.terms_days !== "") ? Math.max(0, Math.round(Number(b.terms_days))) : null,
          };
          Object.keys(patch2).forEach((k) => patch2[k] === undefined && delete patch2[k]);
          let pr2 = await sbPatch(env, "invoices", `id=eq.${encodeURIComponent(id)}`, patch2);
          if (!pr2.ok) {
            // The optional columns again - save the edit rather than lose it.
            const { terms_days: _t, release_on_payment: _r, pay_by_card: _p, ...lean } = patch2;
            pr2 = await sbPatch(env, "invoices", `id=eq.${encodeURIComponent(id)}`, lean);
            if (!pr2.ok) return json({ error: "Couldn't save the changes." }, 502, request, env);
          }
          const updated = (await sbGet(env, "invoices", `id=eq.${encodeURIComponent(id)}&select=*`))?.[0] || null;
          return json({ ok: true, invoice: updated }, 200, request, env);
        }

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
        const html = `<div style="${EM_WRAP}">
          <p style="margin:0 0 14px"><strong>Invoice ${esc(inv.number)} has been voided</strong> and removed from the system - please disregard it.</p>
          <table style="border-collapse:collapse;margin:0 0 14px;font-size:12px">
            <tr><td style="padding:2px 18px 2px 0;color:#7a6b70">Client</td><td style="padding:2px 0"><strong>${esc(inv.bill_to_name || "")}</strong></td></tr>
            <tr><td style="padding:2px 18px 2px 0;color:#7a6b70">Amount</td><td style="padding:2px 0">${money(inv.total_pence)}</td></tr>
            ${inv.billing_month ? `<tr><td style="padding:2px 18px 2px 0;color:#7a6b70">Period</td><td style="padding:2px 0">${esc(inv.billing_month)}</td></tr>` : ""}
            <tr><td style="padding:2px 18px 2px 0;color:#7a6b70">Voided by</td><td style="padding:2px 0">${esc(user.email || "an admin")}</td></tr>
          </table>
          <p style="margin:0 0 6px;color:#7a6b70">Reason</p>
          <p style="margin:0;padding:11px 14px;background:#f4f2f1;border-left:3px solid #371e28;border-radius:4px">${esc(reason || "-")}</p>
        </div>`;
        const voidMail = invoiceMailTo(st.accounts_cc_email || DD_DEFAULT_RECIPIENT, user.email || null);
        await sendEmail(env, {
          to: voidMail.to,
          cc: voidMail.cc,
          subject: `Invoice ${inv.number} voided - ${inv.bill_to_name || ""}`,
          html: await wrapInBrandedBase(env, html),
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
              subject: `TMKE Social Media - Meeting with ${lead.full_name || lead.email}`,
              start: { dateTime: `${date}T${start}:00`, timeZone: "Europe/London" },
              end: { dateTime: `${date}T${endHm}:00`, timeZone: "Europe/London" },
              attendees: [
                { emailAddress: { address: lead.email, name: lead.full_name || "" }, type: "required" },
                ...(env.SMM_NOTIFY && env.SMM_NOTIFY.toLowerCase() !== cal.toLowerCase()
                  ? [{ emailAddress: { address: env.SMM_NOTIFY, name: "TMKE Social Media" }, type: "required" }] : []),
              ],
              isOnlineMeeting: true,
            });
            const ics = buildICS({ uid: `smm-${leadId}-${date}-${start}@tmke.co.uk`, date, start, endHm, summary: "TMKE Social Media - Meeting", description: "A meeting with the TMKE social media team.", location: "Online / phone", organizer: cal, attendeeEmail: lead.email, attendeeName: lead.full_name || "" });
            const icsB64 = bufToBase64(new TextEncoder().encode(ics).buffer);
            const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            await sendEmail(env, {
              to: lead.email, subject: `Your meeting with TMKE - ${dateNice}`,
              html: await wrapInBrandedBase(env, `<div style="${EM_WRAP}"><p style="${EM_P}">Hi ${esc(lead.first_name || "")},</p><p style="${EM_P}">Your meeting with the TMKE social media team is booked for <strong>${esc(dateNice)} at ${esc(start)}</strong>. A calendar invite is attached.</p></div>`),
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
        if (!targetEmail) return json({ error: "This card has no email - add one first, then link." }, 400, request, env);
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
        if (!email) return json({ error: "This card has no email - add one first." }, 400, request, env);
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
          <h1 style="${EM_H1}">Welcome to your TMKE member hub</h1>
          <p style="${EM_P}">Hi ${esc(first)},</p>
          <p style="${EM_P}">As one of our social media management clients, you can manage and oversee your account through our member hub - your plan, your monthly performance reports and everything in one place.</p>
          <p style="${EM_P}">Click below to set your password and open your account.</p>
          <p style="margin:0 0 24px;"><a href="${esc(actionLink)}" style="${EM_BTN}">Create your account</a></p>
          <p style="${EM_P}">If the button doesn't work, paste this into your browser:<br><span style="color:#371e28;">${esc(actionLink)}</span></p>`;
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
        if (!env.ANTHROPIC_API_KEY) return json({ error: "AI isn't configured - set the ANTHROPIC_API_KEY secret on the Worker." }, 503, request, env);
        const b = await request.json().catch(() => ({}));
        const raw = String((b && b.pdf) || "");
        const mm = /^data:application\/pdf;base64,(.+)$/i.exec(raw);
        const b64 = mm ? mm[1] : raw;
        if (!b64) return json({ error: "Missing PDF." }, 400, request, env);
        const prompt =
          "The attached PDF is a SocialPilot monthly social-media analytics report. Its charts are images - read the values visually. " +
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
          '"priorities": [ { "type": "go"|"caution"|"action", "text": string } ] (go = do more, caution = improve, action = fix now - infer 2-4 sensible ones from the data), ' +
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
        catch (_) { return json({ error: "Couldn't read the AI output - try again, or paste the JSON manually.", raw: text.slice(0, 200) }, 502, request, env); }
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
        if (!env.ANTHROPIC_API_KEY) return json({ error: "AI isn't configured - set the ANTHROPIC_API_KEY secret on the Worker." }, 503, request, env);
        const b = await request.json().catch(() => ({}));
        const leadId = b && b.lead_id;
        const question = String((b && b.question) || "").trim().slice(0, 500);
        if (!leadId || !question) return json({ error: "Missing account or question." }, 400, request, env);
        const leadRows = await sbGet(env, "smm_leads", `id=eq.${encodeURIComponent(leadId)}&select=full_name,business`);
        const lead = (leadRows && leadRows[0]) || {};
        const reps = (await sbGet(env, "smm_reports", `lead_id=eq.${encodeURIComponent(leadId)}&select=platform,month,year,data&order=year.asc,month.asc`)) || [];
        if (!reps.length) return json({ error: "No reports for this account yet - upload one first." }, 400, request, env);
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
          if (d.ads) dataText += `Paid ads - reach: ${d.ads.reach ?? "?"} | interactions: ${d.ads.interactions ?? "?"} | spend: £${d.ads.spend ?? "?"} | clicks: ${d.ads.clicks ?? "?"} | CPC: £${d.ads.cpc ?? "?"}\n`;
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
        // channel=eq.email is NOT optional. booking_messages carries internal
        // notes as channel='note', and its RLS policy exists precisely to keep
        // those from members — but sbGet runs as the service role, which
        // bypasses RLS entirely. Without this filter the Worker hands a member
        // every internal note written about them.
        const messages = (await sbGet(env, "booking_messages", `booking_id=${inList}&channel=eq.email&select=id,booking_id,booking_source,direction,channel,kind,subject,body,is_automated,created_by,created_at&order=created_at.asc`)) || [];
        const documents = (await sbGet(env, "booking_documents", `booking_id=${inList}&select=id,booking_id,booking_source,category,title,file_name,size_bytes,content_type,created_at&order=created_at.asc`)) || [];
        return json({ messages, documents }, 200, request, env);
      }

      // ---- Member: the invoices I am actually being asked to pay ------------
      //
      // Deliberately a Worker route rather than an RLS policy, unlike messages
      // and documents: the pay link is a signed token, and signing needs a
      // secret the browser must never hold. Since a round trip is unavoidable,
      // the filtering happens here too.
      //
      // The route decides visibility, not the billing address. A booking billed
      // to a brand has no invoice as far as the client is concerned — someone
      // else is settling it — and showing them a bill they do not owe is worse
      // than showing them nothing. A package-covered shoot has nothing to bill
      // at all.
      if (path.endsWith("/booking/invoices/mine") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user) return json({ error: "Sign in." }, 401, request, env);

        const email = String(user.email || "").toLowerCase();
        const mine = (await sbGet(env, "videography_bookings",
          `or=(account_user_id.eq.${user.id},client_email.ilike.${encodeURIComponent(email)})`
          + `&select=id,payment_route`)) || [];
        // Only bookings the client settles themselves.
        const payable = mine.filter((b) => (b.payment_route || "agent_card") === "agent_card");
        if (!payable.length) return json({ invoices: [] }, 200, request, env);

        const ids = payable.map((b) => b.id).join(",");
        // Drafts are ours until they are sent, and a void invoice is not a bill.
        const rows = (await sbGet(env, "invoices",
          `booking_id=in.(${ids})&status=in.(sent,paid)`
          + `&select=id,number,booking_id,line_items,subtotal_pence,vat_pence,total_pence,status,issued_date,due_date,paid_date,pay_by_card`
          + `&order=created_at.desc`)) || [];

        const invoices = [];
        for (const iv of rows) {
          // Minted per invoice, and only where there is something to pay.
          let pay_url = null;
          if (iv.pay_by_card && iv.status !== "paid" && env.STRIPE_SECRET_KEY) {
            try { pay_url = await invoicePayUrl(env, iv.id); } catch (_) { pay_url = null; }
          }
          invoices.push({ ...iv, pay_url });
        }
        return json({ invoices }, 200, request, env);
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
      // Admin directory, for tagging colleagues in a note. Emails only - the
      // admins table's own RLS deliberately lets a user read just their own
      // row, so the list has to come from here, where the service role runs.
      if (path.endsWith("/admins/list") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const rows = (await sbGet(env, "admins", "select=email&order=email.asc")) || [];
        const emails = rows.map((r) => r.email).filter(Boolean);
        return json({ admins: emails }, 200, request, env);
      }

      // Create a shoot's archive folders. R2 has no folders - keys just contain
      // slashes and the dashboard renders them as a tree - so "creating" one
      // means writing a placeholder object inside it. Without that there is
      // nowhere to put anything until the first file lands, which is the
      // opposite of what Jack needs when he is about to drag files in.
      if (path.endsWith("/videography/archive-create") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const id = String((b && b.booking_id) || "").trim();
        const folder = String((b && b.folder) || "").trim();
        const folders = Array.isArray(b && b.folders) ? b.folders : [];
        if (!id || !folder) return json({ error: "Missing booking or folder name." }, 400, request, env);
        if (!folders.length) return json({ error: "No subfolders to create." }, 400, request, env);

        const made = [];
        for (const sub of folders) {
          const key = safeFolderKey(folder, sub, ".keep");
          try {
            await env.BUCKET.put(key, new Uint8Array(0), { httpMetadata: { contentType: "text/plain" } });
            made.push(key.replace(/\/\.keep$/, ""));
          } catch (err) {
            return json({ error: `Couldn't create ${sub}: ${err && err.message ? err.message : err}` }, 502, request, env);
          }
        }
        // Record the name only once the folders actually exist, so the booking
        // never claims a folder that was never made.
        const dash = r2DashUrl(env, folder);
        await sbPatch(env, "videography_bookings", `id=eq.${encodeURIComponent(id)}`, {
          archive_folder: folder, archive_url: dash || null,
        });
        return json({ ok: true, created: made, url: dash }, 200, request, env);
      }

      // Update the calendar event's location after the booking was made. For
      // agent shoots the meeting point is agreed with the client afterwards -
      // a coffee shop, a studio, somewhere that isn't their office - and it is
      // no use to Jack sitting in the admin centre if his diary still says a
      // postcode.
      if (path.endsWith("/booking/location") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const id = String((b && b.booking_id) || "").trim();
        if (!id) return json({ error: "Missing booking_id" }, 400, request, env);
        const rows = await sbGet(env, "videography_bookings", `id=eq.${encodeURIComponent(id)}&select=ms_event_id,location,property_address,postcode`);
        const bk = rows && rows[0];
        if (!bk) return json({ error: "Booking not found." }, 404, request, env);
        if (!bk.ms_event_id) return json({ ok: true, updated: false, reason: "no calendar event" }, 200, request, env);
        const where = (bk.property_address || bk.location || bk.postcode || "").replace(/\s*\n\s*/g, ", ").trim();
        if (!where) return json({ ok: true, updated: false, reason: "nothing to set" }, 200, request, env);
        try {
          await graph(env, "PATCH", `/users/${encodeURIComponent(env.JACK_UPN)}/events/${bk.ms_event_id}`, {
            location: { displayName: where },
          });
        } catch (err) {
          return json({ error: "Couldn't update the calendar: " + (err && err.message ? err.message : err) }, 502, request, env);
        }
        return json({ ok: true, updated: true, location: where }, 200, request, env);
      }

      // Sync a booking's client into the CRM. The public booking flow has always
      // done this; a booking added by hand in the admin centre never did, so
      // those clients existed as bookings with no contact card. Same RPC and
      // the same tag rules, so a manual booking lands identically to a
      // self-served one - and upsert_contact merges rather than duplicates when
      // the person is already there.
      if (path.endsWith("/booking/contact") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const id = String((b && b.booking_id) || "").trim();
        if (!id) return json({ error: "Missing booking_id" }, 400, request, env);
        const rows = await sbGet(env, "videography_bookings",
          `id=eq.${encodeURIComponent(id)}&select=client_name,client_email,client_phone,client_company,company,service_type,account_user_id,marketing_opt_in`);
        const bk = rows && rows[0];
        if (!bk) return json({ error: "Booking not found." }, 404, request, env);
        if (!bk.client_email) return json({ ok: true, synced: false, reason: "no email on the booking" }, 200, request, env);

        const fn = String(bk.client_name || "").trim().split(/\s+/);
        const tags = crmTags(bk.client_email, ["Videography-Client", videographyProductTag(bk.service_type)], {
          optIn: !!bk.marketing_opt_in, member: !!bk.account_user_id,
        });
        // sbRpc returns null on failure and stays silent unless you ask - which
        // is how the site-wide contact write once failed unnoticed for days.
        let rpcError = null;
        const res = await sbRpc(env, "upsert_contact", {
          p_email: bk.client_email,
          p_first_name: fn.shift() || bk.client_name || null,
          p_last_name: fn.join(" ") || null,
          p_phone: bk.client_phone || null,
          p_company: bk.client_company || bk.company || null,
          p_source: "videography_" + (bk.service_type || "manual"),
          p_lifecycle: "customer",
          p_marketing_opt_in: !!bk.marketing_opt_in,
          p_tags: tags,
          p_user_id: bk.account_user_id || null,
        }, (status, body) => { rpcError = `${status} ${String(body || "").slice(0, 200)}`; });
        if (rpcError) return json({ error: "Couldn't sync the contact: " + rpcError }, 502, request, env);
        return json({ ok: true, synced: true, email: bk.client_email, tags }, 200, request, env);
      }

/* ---- "Raise this invoice" ------------------------------------------------
   Two days before a shoot, if nothing has been invoiced yet, tell Jack and
   Danielle. This is the one step in the process that starts the money, and
   until now it was the only one that depended on somebody remembering.

   Deliberately looks for an actual invoice rather than trusting the stage: a
   booking can be nudged along by hand, and the question here is "has anyone
   billed for this?", which only the invoices table can answer.
--------------------------------------------------------------------------- */
async function runInvoicePrompt(env) {
  const inTwoDays = new Date();
  inTwoDays.setDate(inTwoDays.getDate() + 2);
  const day = inTwoDays.toISOString().slice(0, 10);

  const shoots = (await sbGet(env, "videography_bookings",
    `shoot_date=gte.${day}T00:00:00&shoot_date=lte.${day}T23:59:59`
    + `&stage=neq.cancelled&invoice_prompt_sent_at=is.null&kind=eq.booking&select=*`)) || [];
  if (!shoots.length) return;

  const needing = [];
  for (const bk of shoots) {
    const invs = (await sbGet(env, "invoices",
      `booking_id=eq.${encodeURIComponent(bk.id)}&select=id,status`)) || [];
    // A voided invoice is not an invoice. If the only one was cancelled, this
    // shoot still needs billing.
    if (invs.some((iv) => iv.status !== "void")) continue;
    needing.push(bk);
  }
  if (!needing.length) return;

  const team = [...new Set([env.ACCOUNTS_NOTIFY, env.JACK_NOTIFY || env.JACK_UPN]
    .flatMap((v) => String(v || "").split(","))
    .map((v) => v.trim()).filter(Boolean))];
  if (!team.length) return;

  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rowsHtml = needing.map((bk) => {
    const brand = bk.payment_route === "brand_invoice" || bk.payment_route === "brand_invoice_teg";
    // Only an F&C invoice needs the office to confirm the fee first - TEG has
    // no such step, so this must never fire for it.
    const blocked = bk.payment_route === "brand_invoice" && !bk.brand_fee_confirmed;
    const where = (bk.property_address || bk.location || "").replace(/\s*\n\s*/g, ", ").trim();
    return `<tr>
      <td style="padding:7px 12px 7px 0;font-size:12px">${esc(bk.client_name || "-")}</td>
      <td style="padding:7px 12px 7px 0;font-size:12px">${esc(bk.service || "-")}${where ? `<br><span style="color:#8a8796">${esc(where)}</span>` : ""}</td>
      <td style="padding:7px 12px 7px 0;font-size:12px">${brand ? "Brand" : "Client"}</td>
      <td style="padding:7px 0;font-size:12px">${bk.total_pence != null ? esc(gbpW(bk.total_pence)) : "-"}${
        blocked ? `<br><span style="color:#8a5a2b">Fee not confirmed yet</span>` : ""}</td>
    </tr>`;
  }).join("");

  const niceDay = inTwoDays.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const sent = await sendEmail(env, {
    to: team,
    subject: `Invoices to raise — ${needing.length} shoot${needing.length === 1 ? "" : "s"} on ${niceDay}`,
    html: await wrapInBrandedBase(env, `<div style="${EM_WRAP}">
      <p style="${EM_P}">These shoots are on <strong>${esc(niceDay)}</strong> and haven't been invoiced yet.</p>
      <table style="border-collapse:collapse;margin:0 0 14px">
        <tr>
          <th style="text-align:left;padding:0 12px 6px 0;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8a8796">Client</th>
          <th style="text-align:left;padding:0 12px 6px 0;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8a8796">Shoot</th>
          <th style="text-align:left;padding:0 12px 6px 0;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8a8796">Billed to</th>
          <th style="text-align:left;padding:0 0 6px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8a8796">Amount</th>
        </tr>
        ${rowsHtml}
      </table>
      <p style="${EM_P}">Raise each from its booking in the admin centre - that links the invoice to the shoot, which is what lets payment release the client's PIN on its own.</p>
      <p style="${EM_SMALL}">Anything marked "fee not confirmed yet" is a Fine &amp; Country shoot where the office hasn't confirmed they hold the marketing fee. That has to be settled before the invoice can go.</p>
    </div>`),
  });
  if (!sent.ok) return;

  const stamp = new Date().toISOString();
  for (const bk of needing) {
    await sbPatch(env, "videography_bookings", `id=eq.${encodeURIComponent(bk.id)}`, { invoice_prompt_sent_at: stamp });
  }
}

/* ---- Stalled shoots -------------------------------------------------------
   A shoot left in one stage too long looks exactly like one that moved
   yesterday, so nothing surfaces it. This does.

   Thresholds are per stage because "too long" means different things: a day in
   Shoot day is normal, a fortnight in Editing is not. They are deliberately
   generous - an alert that fires early is one people learn to ignore.

   Reported once when it stalls, then weekly while it stays stuck. Recording
   which STAGE was alerted means a shoot that moves on and stalls somewhere
   else is reported afresh rather than staying quiet.
--------------------------------------------------------------------------- */
const STALL_DAYS = {
  // Only the stages where a shoot genuinely sits waiting on us. Booked,
  // Invoiced and Shoot day all move themselves - on the shoot date, and again
  // the morning after - so a shoot cannot quietly rot in any of them.
  editing: 10,       // 1.5 days editing + the amendments buffer, generously
  gallery_ready: 5,  // gallery built but never sent
  sent: 10,          // with the client, still unpaid or edits unsettled
};

async function runStallCheck(env) {
  const now = Date.now();
  const days = (ms) => Math.floor((now - ms) / 86400000);
  const rows = (await sbGet(env, "videography_bookings",
    `stage=in.(editing,gallery_ready,sent)&select=*`)) || [];

  const stalled = [];
  for (const bk of rows) {
    const limit = STALL_DAYS[bk.stage];
    if (!limit) continue;
    // updated_at is when the row last changed, which for a stage move is the
    // move itself - so this measures time sitting in the current stage.
    const since = Date.parse(bk.updated_at || bk.created_at || "");
    if (!since) continue;
    const stuckFor = days(since);
    if (stuckFor < limit) continue;

    // Once per stall, then weekly.
    const alerted = bk.stalled_alerted_at ? Date.parse(bk.stalled_alerted_at) : 0;
    const sameStage = bk.stalled_alerted_stage === bk.stage;
    if (sameStage && alerted && days(alerted) < 7) continue;

    stalled.push({ bk, stuckFor });
  }
  if (!stalled.length) return;

  const team = [...new Set([env.ACCOUNTS_NOTIFY, env.JACK_NOTIFY || env.JACK_UPN]
    .flatMap((v) => String(v || "").split(","))
    .map((v) => v.trim()).filter(Boolean))];
  if (!team.length) return;

  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const STAGE_NAME = { editing: "Editing", gallery_ready: "Gallery ready", sent: "Sent" };

  const rowsHtml = stalled.map(({ bk, stuckFor }) => `
    <tr>
      <td style="padding:7px 12px 7px 0;font-size:12px">${esc(bk.client_name || "-")}</td>
      <td style="padding:7px 12px 7px 0;font-size:12px">${esc(bk.service || "-")}</td>
      <td style="padding:7px 12px 7px 0;font-size:12px"><strong>${esc(STAGE_NAME[bk.stage] || bk.stage)}</strong></td>
      <td style="padding:7px 0;font-size:12px">${stuckFor} days</td>
    </tr>`).join("");

  const sent = await sendEmail(env, {
    to: team,
    subject: `${stalled.length} videography shoot${stalled.length === 1 ? "" : "s"} sitting still`,
    html: await wrapInBrandedBase(env, `<div style="${EM_WRAP}">
      <p style="${EM_P}">These shoots haven't moved in a while. Most likely the work has happened and the system hasn't been told - worth a quick check, and a note on anything that is genuinely held up.</p>
      <table style="border-collapse:collapse;margin:0 0 14px">
        <tr>
          <th style="text-align:left;padding:0 12px 6px 0;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8a8796">Client</th>
          <th style="text-align:left;padding:0 12px 6px 0;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8a8796">Service</th>
          <th style="text-align:left;padding:0 12px 6px 0;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8a8796">Stuck at</th>
          <th style="text-align:left;padding:0 0 6px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8a8796">For</th>
        </tr>
        ${rowsHtml}
      </table>
      <p style="${EM_SMALL}">You'll get this once when a shoot stalls, then weekly while it stays put. Moving it on stops it.</p>
    </div>`),
  });
  if (!sent.ok) return;

  const stamp = new Date().toISOString();
  for (const { bk } of stalled) {
    await sbPatch(env, "videography_bookings", `id=eq.${encodeURIComponent(bk.id)}`,
      { stalled_alerted_at: stamp, stalled_alerted_stage: bk.stage });
  }
}

/* ---- Invoice chasing ------------------------------------------------------
   Two emails on the same daily run:

     on the due date        -> a reminder to the client
     the day after          -> an alert to Danielle and Jack, who chase it
                               however the situation deserves

   Deliberately keyed on the INVOICE rather than the booking, so social media
   management invoices are covered by the same code rather than a second copy
   of it that drifts.

   Direct Debit invoices are skipped entirely. Those are reminders to our own
   accounts team about money that collects itself; chasing the client for it
   would be worse than not chasing at all.
--------------------------------------------------------------------------- */
/* Every chaser leaves a trace in two places: the contact's email history, and -
   when the invoice belongs to a shoot - the booking's own record, so the
   invoice panel can show what was sent and when without anyone going hunting
   through a mailbox. An automatic email nobody can see having been sent is
   indistinguishable from one that never went. */
async function logInvoiceChase(env, inv, subject, to, internal) {
  try {
    await logEmailEvent(env, {
      email: to, event: "sent", provider: "microsoft", subject,
      detail: internal ? `Overdue alert for invoice ${inv.number}` : `Due-date reminder for invoice ${inv.number}`,
    });
  } catch (_) {}
  if (!inv.booking_id) return;
  try {
    await logBookingMessage(env, {
      booking_id: inv.booking_id,
      booking_source: inv.booking_source || "videography",
      client_email: internal ? null : inv.bill_to_email,
      // Internal alerts are notes, not correspondence - a client must never see
      // us discussing chasing them.
      channel: internal ? "note" : "email",
      kind: internal ? "invoice_overdue_alert" : "invoice_chase",
      subject,
      body: internal
        ? `Overdue alert sent to ${to}.`
        : `Due-date reminder sent to ${to}.`,
      is_automated: true, created_by: "system",
    });
  } catch (_) {}
}

async function runInvoiceChasers(env) {
  const iso = (d) => d.toISOString().slice(0, 10);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const st = (await sbGet(env, "invoice_settings", "id=eq.1&select=*"))?.[0] || {};
  const niceDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  // ---- 1. Due today: remind the client -----------------------------------
  const dueToday = (await sbGet(env, "invoices",
    `status=eq.sent&due_date=eq.${iso(today)}&due_reminder_sent_at=is.null&select=*`)) || [];

  for (const inv of dueToday) {
    if (inv.payment_method === "direct_debit") continue;
    if (!inv.bill_to_email) continue;

    let payUrl = null;
    if (inv.pay_by_card && env.STRIPE_SECRET_KEY) payUrl = await invoicePayUrl(env, inv.id);
    let attachments;
    try {
      const obj = await env.BUCKET.get(`invoices/${inv.number}.pdf`);
      if (obj) attachments = [{ filename: `Invoice-${inv.number}.pdf`, content: bufToBase64(await obj.arrayBuffer()), contentType: "application/pdf" }];
    } catch (_) {}

    const mail = invoiceMailTo(inv.bill_to_email, null);
    const sent = await sendEmail(env, {
      to: mail.to,
      subject: `Invoice ${inv.number} is due today`,
      attachments,
      html: await wrapInBrandedBase(env, `<div style="${EM_WRAP}">
        <p style="${EM_P}">Hi ${esc(firstName(inv.bill_to_name))},</p>
        <p style="${EM_P}">A friendly reminder that invoice ${esc(inv.number)} for ${esc(gbpW(inv.total_pence))} is due today.</p>
        ${payUrl ? `<p style="${EM_P}"><a href="${esc(payUrl)}" style="${EM_BTN}">Pay invoice</a></p>` : ""}
        <p style="${EM_P}">You can pay by card using the link above, or by bank transfer using the details on your invoice. We've attached another copy so you've got it to hand.</p>
        <p style="${EM_P}">Until payment has been received you won't be able to download any of your content or request your edits, so getting this settled means everything is ready when you are.</p>
        <p style="${EM_SMALL}">If you've already paid in the last day or two, thank you - please ignore this.</p>
        <p style="${EM_P}">Many thanks,<br>TMKE</p>
      </div>`),
    });
    if (!sent.ok) continue;
    await sbPatch(env, "invoices", `id=eq.${encodeURIComponent(inv.id)}`, { due_reminder_sent_at: new Date().toISOString() });
    await logInvoiceChase(env, inv, `Invoice ${inv.number} is due today`, inv.bill_to_email, false);
  }

  // ---- 2. A day past due: tell Danielle and Jack --------------------------
  const overdue = (await sbGet(env, "invoices",
    `status=eq.sent&due_date=eq.${iso(yesterday)}&overdue_alerted_at=is.null&select=*`)) || [];

  const team = [...new Set([env.ACCOUNTS_NOTIFY || st.accounts_cc_email, env.JACK_NOTIFY || env.JACK_UPN]
    .flatMap((v) => String(v || "").split(","))
    .map((v) => v.trim())
    .filter(Boolean))];

  for (const inv of overdue) {
    if (inv.payment_method === "direct_debit") continue;
    if (!team.length) break;

    const sent = await sendEmail(env, {
      to: team,
      subject: `Overdue: invoice ${inv.number} - ${inv.bill_to_name || "client"}`,
      html: await wrapInBrandedBase(env, `<div style="${EM_WRAP}">
        <p style="${EM_P}">Invoice <strong>${esc(inv.number)}</strong> passed its due date yesterday and is still unpaid.</p>
        <p style="${EM_QUOTE}">Billed to: ${esc(inv.bill_to_name || "-")}<br>Amount: ${esc(gbpW(inv.total_pence))}<br>Due: ${esc(niceDate(inv.due_date))}<br>Sent to: ${esc(noAutoLink(inv.bill_to_email || "-"))}</p>
        <p style="${EM_P}">The client had a reminder on the due date. Worth deciding how to chase this one.</p>
        <p style="${EM_SMALL}">If it has been paid and we simply haven't recorded it, mark it paid in the admin centre - that releases the client's PIN and stops any further chasers.</p>
      </div>`),
    });
    if (!sent.ok) continue;
    await sbPatch(env, "invoices", `id=eq.${encodeURIComponent(inv.id)}`, { overdue_alerted_at: new Date().toISOString() });
    await logInvoiceChase(env, inv, `Overdue: invoice ${inv.number}`, team.join(", "), true);
  }
}

/* ---- Daily videography chasers ------------------------------------------
   Two jobs that ride the existing 08:00 cron, because both are "look for rows
   matching a date, send once, stamp a column so it never repeats".

   Everything else in this process happens because a person pressed something.
   These two cannot: a reminder that arrives when someone remembers is not a
   reminder, and a gallery that expires without warning is just a gallery that
   disappeared.
--------------------------------------------------------------------------- */
// "Hi ," is worse than no greeting, and a client whose name we only hold as a
// company should not be addressed as that company.
function firstName(full) {
  const first = String(full || "").trim().split(/\s+/)[0];
  return first || "there";
}

// Most email clients auto-detect anything shaped like an email address and
// turn it into their own mailto: link, styled however that client styles
// links - regardless of the HTML we actually sent. That's wrong wherever
// we're just telling someone what to type (into Pixieset, say), not asking
// them to click. A zero-width space right after the @ breaks the pattern
// match without changing how the address looks, copies, or reads to a
// screen reader. Never use this on an address that's meant to be a real,
// clickable mailto: link.
function noAutoLink(v) {
  const s = String(v ?? "");
  const at = s.indexOf("@");
  return at === -1 ? s : s.slice(0, at + 1) + "​" + s.slice(at + 1);
}

// A field like the 360 tour link is typed by hand, and "google.co.uk" is a
// far more natural thing to type than "https://google.co.uk". Used as an
// href exactly as typed, the missing scheme makes the browser treat it as a
// path relative to wherever the link is opened, not an external site - which
// looks and behaves like a dead button, not an obviously wrong one. Fixed at
// render time rather than requiring the address always be entered in full.
function normalizeUrl(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

async function runVideographyChasers(env) {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // ---- 1. Payment reminder, the day after the shoot ----------------------
  // Deliberately a nudge: it lands on day three of a ten-day term, so they are
  // not late and should not be told they are.
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const due = (await sbGet(env, "videography_bookings",
    `shoot_date=gte.${iso(yesterday)}T00:00:00&shoot_date=lte.${iso(yesterday)}T23:59:59`
    // A package shoot has no invoice to chase — reminding those clients to pay
    // for something their package already covers is worse than staying quiet.
    + `&paid_at=is.null&payment_route=neq.smm_package`
    + `&reminder_sent_at=is.null&stage=neq.cancelled&select=*`)) || [];

  for (const bk of due) {
    const to = bk.client_email;
    if (!to) continue;
    const invs = (await sbGet(env, "invoices",
      `booking_id=eq.${encodeURIComponent(bk.id)}&select=id,number,status,pay_by_card,total_pence&order=created_at.desc`)) || [];
    const live = invs.find((iv) => iv.status !== "void" && iv.status !== "paid");
    if (!live) continue;   // nothing outstanding to chase

    let attachments, payUrl = null;
    if (live.pay_by_card && env.STRIPE_SECRET_KEY) payUrl = await invoicePayUrl(env, live.id);
    try {
      const obj = await env.BUCKET.get(`invoices/${live.number}.pdf`);
      if (obj) attachments = [{ filename: `Invoice-${live.number}.pdf`, content: bufToBase64(await obj.arrayBuffer()), contentType: "application/pdf" }];
    } catch (_) {}

    const sent = await sendEmail(env, {
      to,
      subject: "Great to see you yesterday - here's what happens next",
      attachments,
      html: await wrapInBrandedBase(env, `<div style="${EM_WRAP}">
        <p style="${EM_P}">Hi ${esc(firstName(bk.client_name))},</p>
        <p style="${EM_P}">It was great shooting with you yesterday. We hope you enjoyed the session!</p>
        <p style="${EM_P}">Now that your shoot is wrapped, Jack will get to work on your edits. This usually takes a few days, and as soon as everything is ready, we'll send you a link to your gallery where you can view your finished content.</p>
        <p style="${EM_P}">In the meantime, a quick reminder that invoice ${esc(live.number)} for ${esc(gbpW(live.total_pence))} is awaiting payment. We've attached another copy here so you've got it to hand.</p>
        <p style="${EM_P}">You can pay by card using the link below, or by bank transfer using the details on your invoice.</p>
        ${payUrl ? `<p style="${EM_P}"><a href="${esc(payUrl)}" style="${EM_BTN}">Pay invoice</a></p>` : ""}
        <p style="${EM_P}">You'll still be able to view your gallery when your edits are ready, but downloads will unlock once payment has been received.</p>
        <p style="${EM_P}">We'll be back in touch as soon as your content is ready. We can't wait for you to see it!</p>
        <p style="${EM_P}">The TMKE Team</p>
      </div>`),
    });
    if (!sent.ok) continue;

    await sbPatch(env, "videography_bookings", `id=eq.${encodeURIComponent(bk.id)}`, { reminder_sent_at: new Date().toISOString() });
    await logBookingMessage(env, {
      booking_id: bk.id, booking_source: "videography",
      account_user_id: bk.account_user_id, client_email: to,
      channel: "email", kind: "payment_reminder", subject: "Great to see you yesterday - here's what happens next",
      body: "Day-after-shoot reminder sent with the invoice.", is_automated: true, created_by: "system",
    });
  }

  // ---- 2. Gallery expiry warning, a week out -----------------------------
  const weekOut = new Date(today); weekOut.setDate(weekOut.getDate() + 7);
  const expiring = (await sbGet(env, "videography_bookings",
    `gallery_expires_on=eq.${iso(weekOut)}&expiry_warned_at=is.null&select=*`)) || [];

  for (const bk of expiring) {
    const to = bk.gallery_email || bk.client_email;
    if (!to || !bk.gallery_url) continue;
    const when = new Date(bk.gallery_expires_on + "T12:00:00")
      .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const shotOn = bk.shoot_date
      ? new Date(bk.shoot_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "";
    const sent = await sendEmail(env, {
      to,
      subject: "Your gallery expires in one week",
      html: await wrapInBrandedBase(env, `<div style="${EM_WRAP}">
        <p style="${EM_P}">Hi ${esc(firstName(bk.client_name))},</p>
        <p style="${EM_P}">Just a quick heads up that the gallery from your ${esc((bk.service || "shoot").toLowerCase())}${shotOn ? ` on ${esc(shotOn)}` : ""} is due to expire on ${esc(when)}.</p>
        <p style="${EM_P}"><a href="${esc(bk.gallery_url)}" style="${EM_BTN}">Open your gallery</a></p>
        <p style="${EM_P}">You can also find the gallery by heading to Previous Bookings in TMKE Studio.</p>
        <p style="${EM_P}">Once the gallery expires, your content will no longer be available to view or download, so we recommend having a quick check that you've got everything you need.</p>
        <p style="${EM_P}">The TMKE Team</p>
      </div>`),
    });
    if (!sent.ok) continue;

    await sbPatch(env, "videography_bookings", `id=eq.${encodeURIComponent(bk.id)}`, { expiry_warned_at: new Date().toISOString() });
    await logBookingMessage(env, {
      booking_id: bk.id, booking_source: "videography",
      account_user_id: bk.account_user_id, client_email: to,
      channel: "email", kind: "gallery_expiring", subject: "Your gallery expires in one week",
      body: `Expiry warning sent - gallery closes ${bk.gallery_expires_on}.`, is_automated: true, created_by: "system",
    });
  }
}

// Mints the edit-request page's capability token the first time it's needed
// (i.e. the first time a paid-path gallery email goes out), so the link
// always has something to point at. A plain random id, not HMAC - same style
// as videography_deliveries.token, and it never expires.
async function ensureEditsToken(env, bk) {
  if (bk.edits_token) return bk.edits_token;
  const token = crypto.randomUUID().replace(/-/g, "");
  await sbPatch(env, "videography_bookings", `id=eq.${encodeURIComponent(bk.id)}&edits_token=is.null`, { edits_token: token });
  bk.edits_token = token;
  return token;
}

// The edits invitation, added only into the two paid-path gallery emails -
// never the not-yet-paid one, which keeps its wording as-is until that flow
// is revisited on purpose. Doesn't mention twilight/extra images by name -
// the /edits page itself surfaces those, conditionally, once they're there.
function editRequestPromptHtml(env, token) {
  const siteUrl = (env.SITE_URL || "https://tmke.co.uk").replace(/\/+$/, "");
  // EM_P's own top margin is 0 - fine between two body paragraphs, but this
  // sits right after the small-print amendments clause (0 bottom margin on
  // that one too), so without an explicit gap here the two collide with no
  // breathing room and the size/colour jump reads as a formatting mistake.
  return `<p style="${EM_P}margin-top:18px;">Once you've had a chance to look through everything, your package includes one round of edits if there's anything you'd like us to change. Just send us all of your requests using the link below and we'll take care of the rest.</p>
    <p style="${EM_P}"><a href="${siteUrl}/edits?token=${encodeURIComponent(token)}" style="${EM_BTN}">Request Edits</a></p>`;
}

// Emails Jack when a client submits an edit request - a free-text-only one
// straight away, a paid one once the Stripe webhook confirms it. Idempotent
// via notified_at, so a Stripe retry (or a resend) can never double-send.
async function notifyEditRequest(env, requestId) {
  const rows = await sbGet(env, "videography_edit_requests", `id=eq.${encodeURIComponent(requestId)}&select=*`);
  const req = rows && rows[0];
  if (!req) return { ok: false, reason: "no request" };
  if (req.notified_at) return { ok: false, reason: "already notified" };

  const brows = await sbGet(env, "videography_bookings", `id=eq.${encodeURIComponent(req.booking_id)}&select=*`);
  const bk = brows && brows[0];
  if (!bk) return { ok: false, reason: "no booking" };

  const team = [...new Set([env.JACK_NOTIFY || env.JACK_UPN]
    .flatMap((v) => String(v || "").split(","))
    .map((v) => v.trim()).filter(Boolean))];
  if (!team.length) return { ok: false, reason: "no recipient configured" };

  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const siteUrl = (env.SITE_URL || "https://tmke.co.uk").replace(/\/+$/, "");
  const bookingLink = `${siteUrl}/admin/videography?booking=${encodeURIComponent(bk.id)}`;

  const twilightRows = Array.isArray(req.twilight_items) ? req.twilight_items : [];
  const twilightTotal = twilightRows.reduce((s, it) => s + (it.price_pence || 0), 0);
  const paidExtras = twilightRows.length > 0 || !!req.extra_images_qty;

  const parts = [];
  parts.push(`<p style="${EM_P}"><strong>${esc(bk.client_name || "A client")}</strong> has asked for edits on their ${esc((bk.service || "shoot").toLowerCase())}.</p>`);
  if (req.notes) parts.push(`<p style="${EM_P}"><strong>What they asked for:</strong><br>${esc(req.notes).replace(/\n/g, "<br>")}</p>`);
  if (twilightRows.length) {
    parts.push(`<p style="${EM_P}"><strong>Twilight requested</strong> — ${twilightRows.length} image${twilightRows.length === 1 ? "" : "s"}, paid (${esc(gbpW(twilightTotal))}):</p>
      <ul style="${EM_P}">${twilightRows.map((it) => `<li>${esc(it.filename || "unnamed")}</li>`).join("")}</ul>`);
  }
  if (req.extra_images_qty) {
    parts.push(`<p style="${EM_P}"><strong>Extra images bought</strong> — ${req.extra_images_qty} more, paid (${esc(gbpW(req.extra_images_price_pence || 0))}). Increase their download cap on the booking.</p>`);
  }
  parts.push(`<p style="${EM_P}"><a href="${esc(bookingLink)}" style="${EM_BTN}">Open their booking</a></p>`);

  const sent = await sendEmail(env, {
    to: team,
    subject: `Edit request — ${bk.client_name || "a client"}`,
    html: await wrapInBrandedBase(env, `<div style="${EM_WRAP}">${parts.join("")}</div>`),
  });
  if (!sent.ok) return { ok: false, reason: sent.error || "send failed" };

  await sbPatch(env, "videography_edit_requests", `id=eq.${encodeURIComponent(requestId)}&notified_at=is.null`, {
    status: "notified", notified_at: new Date().toISOString(),
  });
  await logBookingMessage(env, {
    booking_id: bk.id, booking_source: "videography",
    channel: "note", kind: "edit_request",
    subject: `Edit request${paidExtras ? " (paid add-on)" : ""}`,
    body: req.notes || "(no notes - paid add-on only)",
    is_automated: true, created_by: "system",
  });
  return { ok: true };
}

// Closes the loop from the client's side: Jack has done the edits (and any
// paid extras) and settled up with them directly, so this just confirms it's
// all done from our end, points them back to their account for the booking
// details, and asks for a review. Idempotent via edits_complete_email_sent_at
// so re-ticking "edits settled" on the client file can never double-send.
async function sendEditsCompleteEmail(env, bookingId) {
  const rows = await sbGet(env, "videography_bookings", `id=eq.${encodeURIComponent(bookingId)}&select=*`);
  const bk = rows && rows[0];
  if (!bk) return { ok: false, reason: "no booking" };
  if (bk.edits_complete_email_sent_at) return { ok: false, reason: "already sent" };

  const to = bk.gallery_email || bk.client_email;
  if (!to) return { ok: false, reason: "no recipient" };

  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const siteUrl = (env.SITE_URL || "https://tmke.co.uk").replace(/\/+$/, "");
  const firstName = String(bk.client_name || "").trim().split(/\s+/)[0] || "there";

  // Say back what was actually done. A close-out email that only says "all
  // done" makes the reader go and look up which shoot it means.
  const when = bk.shoot_date
    ? new Date(bk.shoot_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "";
  const where = (bk.location || bk.postcode || "").trim();
  const facts = [
    ["Shoot", bk.service || "Videography"],
    when ? ["Filmed", when] : null,
    where ? ["Where", where] : null,
  ].filter(Boolean);
  const factsHtml = facts
    .map(([k, v]) => `<p style="${EM_P}margin:0 0 4px;"><strong>${esc(k)}</strong> &nbsp;${esc(v)}</p>`)
    .join("");

  // Only claim the amends are done if they actually asked for some.
  let amendsLine = "";
  try {
    const reqs = await sbGet(env, "videography_edit_requests",
      `booking_id=eq.${encodeURIComponent(bk.id)}&select=id`);
    if (reqs && reqs.length) {
      amendsLine = `<p style="${EM_P}">The changes you asked for have now been made and you&rsquo;ll find the updated content in your gallery.</p>`;
    }
  } catch (_) { /* the rest of the email is still worth sending */ }

  /* Do they already have somewhere to log in to?

     Two ways to have an account, and both count: the booking may be attached
     to one directly (which is what linking a contact in the admin centre now
     does), or the CRM contact on their email may carry a user. Only when
     neither is true is there anything worth inviting them to. Asking someone
     to create an account they already have is the fastest way to be ignored. */
  let hasAccount = !!bk.account_user_id;
  if (!hasAccount) {
    const addr = String(bk.client_email || "").trim().toLowerCase();
    if (addr) {
      try {
        const cs = await sbGet(env, "contacts",
          `email=eq.${encodeURIComponent(addr)}&select=user_id&limit=1`);
        hasAccount = !!(cs && cs[0] && cs[0].user_id);
      } catch (_) { /* can't tell — say nothing rather than nag */ hasAccount = true; }
    }
  }
  const accountLine = hasAccount ? "" : `
    <p style="${EM_P}">One more thing. You don&rsquo;t have a TMKE Member Account yet. It&rsquo;s the easiest way to keep track of your bookings, galleries and invoices all in one place, and it only takes a minute to set up using this email address.</p>
    <p style="${EM_P}">You&rsquo;ll also get access to our exclusive Design Studio, plus marketing insights, resources and training created specifically for the property industry.</p>
    <p style="${EM_P}"><a href="${siteUrl}/join?email=${encodeURIComponent(bk.client_email || "")}" style="${EM_BTN}">Create Your Account</a></p>`;

  const galleryLine = bk.gallery_url
    ? `<p style="${EM_P}"><a href="${esc(bk.gallery_url)}" style="${EM_BTN}">Open Your Gallery</a></p>`
    : "";

  /* The review link carries the booking, the name and the service. Without
     them the client retypes what we already know - and, more importantly, the
     review comes back with nothing tying it to the shoot, so their bookings
     page goes on asking for a review they have already left. */
  const reviewUrl = `${siteUrl}/leave-a-review`
    + `?booking=${encodeURIComponent(bk.id)}`
    + `&service=${encodeURIComponent(bk.service || "")}`
    + `&name=${encodeURIComponent(bk.client_name || "")}`;

  const html = `<div style="${EM_WRAP}">
    <h1 style="${EM_H1}">That&rsquo;s a wrap, ${esc(firstName)}</h1>
    <p style="${EM_P}">Your videography booking is now complete and everything is finished from our end.</p>
    ${factsHtml}
    ${amendsLine}
    ${galleryLine}
    ${hasAccount ? `<p style="${EM_P}">You can find all the details for this booking, along with your other TMKE bookings, under <strong>Previously</strong> in your account.</p>
    <p style="${EM_P}"><a href="${siteUrl}/account/bookings" style="${EM_BTN}">View Your Booking</a></p>` : ""}
    <p style="${EM_P}">Now that everything&rsquo;s complete, if you have a spare minute, we&rsquo;d really appreciate a review. It makes a big difference to us.</p>
    <p style="${EM_P}"><a href="${reviewUrl}" style="${EM_BTN}">Leave a Review</a></p>
    ${accountLine}
    <p style="${EM_P}">Thanks again for working with us. We hope you love the finished content, and hopefully we&rsquo;ll see you again soon!</p>
    <p style="${EM_P}">The TMKE Team</p>
  </div>`;

  const sent = await sendEmail(env, {
    to, subject: `Your ${bk.service || "shoot"} is all done`,
    html: await wrapInBrandedBase(env, html),
  });
  if (!sent.ok) return { ok: false, reason: sent.error || "send failed" };

  await sbPatch(env, "videography_bookings", `id=eq.${encodeURIComponent(bookingId)}&edits_complete_email_sent_at=is.null`, {
    edits_complete_email_sent_at: new Date().toISOString(),
  });
  await logBookingMessage(env, {
    booking_id: bk.id, booking_source: "videography",
    channel: "email", kind: "edits_complete",
    subject: "All done — close-out email", body: `Sent to ${to}.`,
    is_automated: true, created_by: "system",
  });
  return { ok: true };
}

// The second email: they were sent their gallery before paying, so they have
// the links but not the PIN. This is what closes that loop when the money
// lands - without it, someone who pays after delivery waits for a human to
// notice. Returns quietly when it does not apply.
async function sendGalleryPinEmail(env, bookingId) {
  const rows = await sbGet(env, "videography_bookings", `id=eq.${encodeURIComponent(bookingId)}&select=*`);
  const bk = rows && rows[0];
  if (!bk) return { ok: false, reason: "no booking" };
  // Only if they have already had the gallery: otherwise the normal
  // gallery-ready email will carry the PIN itself, and two emails would be
  // confusing rather than helpful.
  if (!bk.gallery_sent_at) return { ok: false, reason: "gallery not sent yet" };
  if (bk.pin_released_at) return { ok: false, reason: "already released" };
  const prow = await sbGet(env, "videography_gallery_pins", `booking_id=eq.${encodeURIComponent(bookingId)}&select=pin`);
  const pin = (prow && prow[0] && prow[0].pin) || "";
  if (!pin) return { ok: false, reason: "no pin saved" };
  const to = bk.gallery_email || bk.client_email;
  if (!to) return { ok: false, reason: "no address" };
  // Same release moment as the PIN - if a 360 tour is set, this is the first
  // time the client is allowed to see it.
  const trow = await sbGet(env, "videography_tour_links", `booking_id=eq.${encodeURIComponent(bookingId)}&select=url`);
  const tourUrl = normalizeUrl((trow && trow[0] && trow[0].url) || "");

  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const siteUrl = (env.SITE_URL || "https://tmke.co.uk").replace(/\/+$/, "");
  const editsToken = await ensureEditsToken(env, bk);
  const html = await wrapInBrandedBase(env, `<div style="${EM_WRAP}">
    <p style="${EM_P}">Hi ${esc(firstName(bk.client_name))},</p>
    <p style="${EM_P}">Thank you for your payment. Your gallery is now unlocked and your content is ready to download!</p>
    <p style="${EM_QUOTE}"><span style="${EM_QUOTE_TEXT}">Your download PIN is <strong>${esc(pin)}</strong>.</span></p>
    <p style="${EM_P}">When you download your content, Pixieset will ask for your email address and PIN. Simply use <strong>${esc(noAutoLink(to))}</strong> and the PIN above.</p>
    ${bk.gallery_url ? `<p style="${EM_P}"><a href="${esc(bk.gallery_url)}" style="${EM_BTN}">Open your gallery</a></p>` : ""}
    ${tourUrl ? `<p style="${EM_P}">Your 360 tour: <a href="${esc(tourUrl)}">${esc(tourUrl)}</a></p>` : ""}
    <p style="${EM_P}">Your gallery will remain available for three months. Don't worry, we'll send you a reminder before it's due to expire, so you have plenty of time to make sure you've downloaded everything you need.</p>
    <p style="${EM_P}">You can also find this shoot, your gallery and all of your booking details anytime under Previous Bookings in the <a href="${esc(siteUrl)}/account/bookings">TMKE Studio</a>.</p>
    ${editRequestPromptHtml(env, editsToken)}
    <p style="${EM_P}">We hope you love your content!</p>
    <p style="${EM_P}">The TMKE Team</p>
  </div>`);

  const sent = await sendEmail(env, { to, subject: "Your gallery is unlocked", html });
  if (!sent.ok) return { ok: false, reason: sent.error || "send failed" };

  await sbPatch(env, "videography_bookings", `id=eq.${encodeURIComponent(bookingId)}`, { pin_released_at: new Date().toISOString() });
  await logBookingMessage(env, {
    booking_id: bookingId, booking_source: "videography",
    account_user_id: bk.account_user_id, client_email: to,
    channel: "email", kind: "pin_released", subject: "Your gallery is unlocked",
    body: "Payment received - PIN sent.", is_automated: true, created_by: "system",
  });
  return { ok: true, sent_to: to };
}

      // "Your gallery is ready". Two versions of the same email, decided by
      // whether the shoot has been paid for - because the PIN is what unlocks
      // downloading, and it is the only thing being withheld.
      // Ask a Fine & Country office to confirm they hold the seller's marketing
      // fee. Jack sends this himself once he has checked the booking details,
      // which is why it is a button rather than something automatic - the whole
      // point is that a person has looked before we ask.
      if (path.endsWith("/videography/fc-confirm") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const id = String((b && b.booking_id) || "").trim();
        const to = String((b && b.to) || "").trim();
        if (!id || !to) return json({ error: "Missing booking or recipient." }, 400, request, env);

        const rows = await sbGet(env, "videography_bookings", `id=eq.${encodeURIComponent(id)}&select=*`);
        const bk = rows && rows[0];
        if (!bk) return json({ error: "Booking not found." }, 404, request, env);

        const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const office = (FC_OFFICE_LABELS[bk.fc_office] || "your office");
        const where = (bk.property_address || bk.location || "").replace(/\s*\n\s*/g, ", ").trim();
        const when = bk.shoot_date
          ? new Date(bk.shoot_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
          : "a date to be confirmed";
        const amount = bk.total_pence != null ? gbpW(bk.total_pence) : null;

        const sent = await sendEmail(env, {
          to,
          cc: (b && b.cc) || null,
          subject: `Marketing fee confirmation - ${bk.client_name || "agent"}${where ? ` - ${where}` : ""}`,
          html: await wrapInBrandedBase(env, `<div style="${EM_WRAP}">
            <p style="${EM_P}">Hello,</p>
            <p style="${EM_P}">${esc(bk.client_name || "The agent")} has booked a ${esc((bk.service || "videography").toLowerCase())} shoot with us${where ? ` at ${esc(where)}` : ""}, scheduled for ${esc(when)}.</p>
            <p style="${EM_P}">${esc(firstName(bk.client_name))} has advised that the seller's marketing fee for this property is held by ${esc(office)}, and that the shoot should therefore be invoiced to you rather than to the agent directly.</p>
            <p style="${EM_P}">Before we raise the invoice${amount ? ` for ${esc(amount)}` : ""}, could you please confirm that this is correct?</p>
            <p style="${EM_P}">If the marketing fee isn't held by you, just let us know and we'll invoice the agent directly instead.</p>
            <p style="${EM_P}">Many thanks,<br>TMKE</p>
          </div>`),
        });
        if (!sent.ok) return json({ error: "The email didn't send: " + (sent.error || "unknown") }, 502, request, env);

        await sbPatch(env, "videography_bookings", `id=eq.${encodeURIComponent(id)}`, {
          fc_confirm_email: to, fc_confirm_sent_at: new Date().toISOString(),
        });
        await logBookingMessage(env, {
          booking_id: id, booking_source: "videography",
          account_user_id: bk.account_user_id, client_email: to,
          channel: "email", kind: "fc_fee_confirm",
          subject: `Marketing fee confirmation - ${bk.client_name || "agent"}`,
          body: `Asked ${to} to confirm the marketing fee is held.`,
          is_automated: false, created_by: user.email || "admin",
        });
        return json({ ok: true, sent_to: to }, 200, request, env);
      }

      // Release the PIN by hand - the same email the webhook sends, for payments
      // that arrive by bank transfer rather than card.
      if (path.endsWith("/videography/release-pin") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const id = String((b && b.booking_id) || "").trim();
        if (!id) return json({ error: "Missing booking_id" }, 400, request, env);
        const res = await sendGalleryPinEmail(env, id);
        if (!res.ok) return json({ error: "Not sent: " + res.reason }, 400, request, env);
        return json({ ok: true, sent_to: res.sent_to }, 200, request, env);
      }

      if (path.endsWith("/videography/gallery-email") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const id = String((b && b.booking_id) || "").trim();
        if (!id) return json({ error: "Missing booking_id" }, 400, request, env);

        const rows = await sbGet(env, "videography_bookings", `id=eq.${encodeURIComponent(id)}&select=*`);
        const bk = rows && rows[0];
        if (!bk) return json({ error: "Booking not found." }, 404, request, env);
        if (!bk.gallery_url) return json({ error: "Add the gallery link before sending." }, 400, request, env);
        const to = bk.gallery_email || bk.client_email;
        if (!to) return json({ error: "No email address to send to." }, 400, request, env);

        // THE RULE, in one place: a PIN only ever leaves this building when
        // paid_at is set. Everything else - which template, what the admin card
        // says, the toggle on screen - is presentation. This is the check that
        // actually stops it, and it reads from the database rather than from
        // anything the sender could have changed on screen.
        const paid = isSettled(bk);
        let pin = "", tourUrl = "";
        if (paid) {
          const prow = await sbGet(env, "videography_gallery_pins", `booking_id=eq.${encodeURIComponent(id)}&select=pin`);
          pin = (prow && prow[0] && prow[0].pin) || "";
          if (!pin) return json({ error: "This shoot is paid but has no PIN saved - add it before sending." }, 400, request, env);
          // Same rule as the PIN: only ever fetched, and only ever mentioned in
          // the email, once paid is confirmed here from the database.
          const trow = await sbGet(env, "videography_tour_links", `booking_id=eq.${encodeURIComponent(id)}&select=url`);
          tourUrl = (trow && trow[0] && trow[0].url) || "";
        }

        // Unpaid: attach the invoice and give them a way to pay it.
        let attachments, payUrl = null, invNumber = null;
        if (!paid) {
          const invs = (await sbGet(env, "invoices", `booking_id=eq.${encodeURIComponent(id)}&select=id,number,status,pay_by_card&order=created_at.desc`)) || [];
          const live = invs.find((iv) => iv.status !== "void" && iv.status !== "paid");
          if (live) {
            invNumber = live.number;
            if (live.pay_by_card && env.STRIPE_SECRET_KEY) payUrl = await invoicePayUrl(env, live.id);
            try {
              const obj = await env.BUCKET.get(`invoices/${live.number}.pdf`);
              if (obj) attachments = [{ filename: `Invoice-${live.number}.pdf`, content: bufToBase64(await obj.arrayBuffer()), contentType: "application/pdf" }];
            } catch (_) {}
          }
        }

        const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        // Paid: the tour rides alongside the gallery as a second button, not a
        // bare pasted URL underneath everything else - same visual weight,
        // since it's just as much "your delivered content" as the gallery is.
        const links = [
          paid
            ? `<p style="${EM_P}"><a href="${esc(bk.gallery_url)}" style="${EM_BTN}">View Gallery</a>${tourUrl ? ` <a href="${esc(tourUrl)}" style="${EM_BTN}">View 360 Tour</a>` : ""}</p>`
            : `<p style="${EM_P}"><a href="${esc(bk.gallery_url)}" style="${EM_BTN}">View your gallery</a></p>`,
          bk.extra_link_url ? `<p style="${EM_P}">${esc(bk.extra_link_label || "Also for you")}: <a href="${esc(bk.extra_link_url)}">${esc(bk.extra_link_url)}</a></p>` : "",
        ].filter(Boolean).join("");

        const unlock = paid
          ? `<p style="${EM_QUOTE}margin-bottom:0;">Your download PIN is <strong>${esc(pin)}</strong>.</p>
             <p style="${EM_P}">When you download your content, Pixieset will ask for your email address and PIN. Simply use <strong>${esc(noAutoLink(to))}</strong> and the PIN above.</p>`
          : `<p style="${EM_P}">Your gallery will remain watermarked and downloads will stay locked until payment has been received${invNumber ? ` for invoice ${esc(invNumber)}` : ""}.</p>
             <p style="${EM_P}">As soon as payment comes through, we'll unlock your gallery and send over your download PIN, along with your 360 tour if one is included with your booking.</p>
             ${payUrl ? `<p style="${EM_P}"><a href="${esc(payUrl)}" style="${EM_BTN}">Pay by card</a></p>` : ""}
             ${attachments ? `<p style="${EM_P}">We've attached another copy of your invoice to this email. You can also pay by bank transfer using the details on it.</p>` : ""}`;

        // Paid: dropped per Danielle's revised copy (12 Aug 2026) - the edits
        // paragraph right below now covers the same ground in plainer language
        // with a working link, so the two read as one redundant idea back to
        // back rather than two separate ones. Flagging because the old wording
        // was lifted verbatim from the signed agreement's amendments clause,
        // not paraphrased - if that clause still needs to appear somewhere
        // contractually, it isn't this email any more.
        // Unpaid: softer, forward-looking wording - there's no live link yet,
        // since edits only unlock once they've paid.
        const amends = paid
          ? ""
          : `<p style="${EM_P}">Once everything is unlocked, have a look through your finished content. Your package includes one round of edits, so if there's anything you'd like us to change, you can send all of your requests through together using the link we'll provide.</p>`;

        // Only on the already-paid send: the unpaid email describes what's
        // coming (above) rather than linking anywhere, since the /edits page
        // requires payment to have already landed.
        const editsPrompt = paid ? editRequestPromptHtml(env, await ensureEditsToken(env, bk)) : "";

        const openingLine = paid
          ? `Great news, your ${esc((bk.service || "shoot").toLowerCase())} gallery is now ready to view.`
          : `Your content is ready! You can now view everything from your ${esc((bk.service || "shoot").toLowerCase())} in your gallery using the link below.`;

        const closingLine = paid
          ? `<p style="${EM_SMALL}">Your gallery will stay available for three months, and we'll send you a reminder before it's due to expire so you have plenty of time to make sure everything is downloaded.</p>`
          : `<p style="${EM_P}">Your gallery will stay available for three months. Don't worry, we'll send you a reminder before it's due to expire, so you have plenty of time to make sure you've downloaded everything you need.</p>
             <p style="${EM_P}">We hope you love your content!</p>
             <p style="${EM_P}">The TMKE Team</p>`;

        const html = await wrapInBrandedBase(env, `<div style="${EM_WRAP}">
          <p style="${EM_P}">Hi ${esc((bk.client_name || "").split(" ")[0] || "there")},</p>
          <p style="${EM_P}">${openingLine}</p>
          ${links}
          ${unlock}
          ${amends}
          ${editsPrompt}
          ${closingLine}
        </div>`);

        const sent = await sendEmail(env, {
          to,
          subject: paid ? `Your gallery is ready` : `Your gallery is ready to view`,
          html, attachments,
        });
        if (!sent.ok) return json({ error: "The email didn't send: " + (sent.error || "unknown") }, 502, request, env);

        await sbPatch(env, "videography_bookings", `id=eq.${encodeURIComponent(id)}`, { gallery_sent_at: new Date().toISOString() });
        await logBookingMessage(env, {
          booking_id: id, booking_source: "videography",
          account_user_id: bk.account_user_id, client_email: to,
          channel: "email", kind: "gallery_ready",
          subject: paid ? "Your gallery is ready" : "Your gallery is ready to view",
          body: paid ? "Gallery link sent with the PIN." : "Gallery link sent; PIN withheld pending payment.",
          is_automated: false, created_by: user.email || "admin",
        });
        return json({ ok: true, sent_to: to, included_pin: paid }, 200, request, env);
      }

      // ---- Public: the edit-request page (no login) --------------------------
      // Reached from a link in the paid-path gallery emails. Token-gated, same
      // style as the /deliver gallery - the credential IS the (unguessable)
      // token, checked against edits_token, no session needed.
      //
      // Which upsell (if any) the page offers is decided HERE from the
      // booking's service, not trusted from the client - property shoots get
      // faux twilight, agent/induction shoots get the extra-images bundle,
      // everything else (Content Studio) gets the free-text box only.
      function editRequestUpsellKind(bk) {
        const hay = `${bk.service_type || ""} ${bk.service || ""}`.toLowerCase();
        if (/property/.test(hay)) return "twilight";
        // Agent shoots proper, and the new-starter induction Studio Day
        // (service "New-Starter Studio Day", service_type "content-studio" -
        // it's an agent-family shoot with a limited image count, same as any
        // other agent booking, just booked through a different flow).
        if (/agent/.test(hay) || /induction|new-starter/.test(hay)) return "extra_images";
        return null;
      }

      if (path.endsWith("/videography/edit-request/context") && request.method === "GET") {
        const token = (url.searchParams.get("token") || "").trim();
        if (!token) return json({ error: "Missing token" }, 400, request, env);
        const rows = await sbGet(env, "videography_bookings",
          `edits_token=eq.${encodeURIComponent(token)}&select=id,client_name,service,service_type,paid_at,payment_route`);
        const bk = rows && rows[0];
        if (!bk) return json({ error: "That link isn't valid." }, 404, request, env);
        // The rule, same as the PIN: read from the database, not from anything
        // the page itself could claim.
        if (!isSettled(bk)) return json({ error: "This booking hasn't been paid for yet." }, 403, request, env);
        return json({
          ok: true,
          client_name: bk.client_name || "",
          upsell: editRequestUpsellKind(bk),
          twilight_price_pence: FAUX_TWILIGHT_PRICE_PENCE,
          extra_images: EXTRA_IMAGES_BUNDLE,
        }, 200, request, env);
      }

      if (path.endsWith("/videography/edit-request") && request.method === "POST") {
        const b = await request.json().catch(() => ({}));
        const token = String((b && b.token) || "").trim();
        if (!token) return json({ error: "Missing token" }, 400, request, env);
        const rows = await sbGet(env, "videography_bookings", `edits_token=eq.${encodeURIComponent(token)}&select=*`);
        const bk = rows && rows[0];
        if (!bk) return json({ error: "That link isn't valid." }, 404, request, env);
        if (!isSettled(bk)) return json({ error: "This booking hasn't been paid for yet." }, 403, request, env);

        const notes = String((b && b.notes) || "").trim().slice(0, 4000);
        const upsell = editRequestUpsellKind(bk);

        // Filenames and a yes/no are all the client gets to say - the price is
        // always ours, re-derived from the constants above.
        let twilightItems = [];
        if (upsell === "twilight" && Array.isArray(b.twilight_filenames)) {
          twilightItems = b.twilight_filenames
            .map((f) => String(f || "").trim()).filter(Boolean).slice(0, 100)
            .map((filename) => ({ filename, price_pence: FAUX_TWILIGHT_PRICE_PENCE }));
        }
        const wantsExtraImages = upsell === "extra_images" && !!b.extra_images;
        const extraQty = wantsExtraImages ? EXTRA_IMAGES_BUNDLE.qty : null;
        const extraPrice = wantsExtraImages ? EXTRA_IMAGES_BUNDLE.price_pence : null;

        if (!notes && !twilightItems.length && !wantsExtraImages) {
          return json({ error: "Add a note, or choose something to buy, before sending." }, 400, request, env);
        }

        // Line items are held net (that is how they are quoted); the charge is gross.
        const netPence = twilightItems.reduce((s, it) => s + it.price_pence, 0) + (extraPrice || 0);
        const { vat: upsellVat, gross: totalPence } = await vatBreakdown(env, netPence);

        const ins = await sbPost(env, "videography_edit_requests", {
          booking_id: bk.id, notes: notes || null,
          twilight_items: twilightItems, extra_images_qty: extraQty, extra_images_price_pence: extraPrice,
          vat_pence: upsellVat, total_pence: totalPence,
        }, "return=representation");
        const created = await ins.json().catch(() => null);
        const reqRow = Array.isArray(created) ? created[0] : created;
        if (!reqRow || !reqRow.id) {
          // The client gets the same sentence either way - there is nothing
          // useful it could do with a Postgres error code. But it goes to the
          // Worker log, because the one time this fired it was a column the
          // table never had, and the reply said "please try again" about a
          // failure that was never going to stop happening. `wrangler tail`
          // now says which column.
          console.log("edit-request insert failed", ins.status, JSON.stringify(created));
          return json({ error: "Couldn't save your request. Please try again." }, 500, request, env);
        }

        // Free-text only, nothing to pay - tell Jack straight away rather than
        // waiting on a payment that was never coming.
        if (totalPence <= 0) {
          await notifyEditRequest(env, reqRow.id);
          return json({ ok: true }, 200, request, env);
        }

        if (!env.STRIPE_SECRET_KEY) return json({ error: "Card payment isn't available yet - please reply to one of our emails and we'll sort it out." }, 503, request, env);

        const origin = request.headers.get("Origin") || "";
        const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
        const base = allowed.includes(origin) ? origin : (env.SITE_URL || "https://tmke.co.uk");
        const productName = twilightItems.length
          ? `Faux twilight - ${twilightItems.length} image${twilightItems.length === 1 ? "" : "s"}`
          : `${EXTRA_IMAGES_BUNDLE.qty} extra images`;

        try {
          const session = await stripeApi(env, "checkout/sessions", {
            mode: "payment",
            "payment_method_types[0]": "card",
            success_url: `${base}/edits?token=${encodeURIComponent(token)}&paid=1`,
            cancel_url: `${base}/edits?token=${encodeURIComponent(token)}`,
            "metadata[edit_request_id]": reqRow.id,
            "metadata[upsell_type]": twilightItems.length ? "twilight" : "extra_images",
            "line_items[0][quantity]": 1,
            "line_items[0][price_data][currency]": "gbp",
            "line_items[0][price_data][unit_amount]": totalPence,
            "line_items[0][price_data][product_data][name]": productName,
          });
          await sbPatch(env, "videography_edit_requests", `id=eq.${encodeURIComponent(reqRow.id)}`, { stripe_session_id: session.id });
          return json({ ok: true, checkout_url: session.url }, 200, request, env);
        } catch (e) {
          return json({ error: "Couldn't reach the payment provider. Please try again." }, 502, request, env);
        }
      }

      // Admin-triggered: fires from the "edits settled" tickbox on the client
      // file once Jack's confirmed everything's done and settled with the
      // client directly. Not automatic on the tick itself — the admin calls
      // this explicitly so a re-tick (untick/retick) never re-sends.
      // A shoot booked from the social media side rather than by Jack. The
      // social manager usually hears about it first, so they can enter it —
      // but Jack has to be told, or it sits on a board nobody has looked at.
      if (path.endsWith("/videography/notify-new-booking") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const id = String((b && b.booking_id) || "").trim();
        if (!id) return json({ error: "Missing booking_id" }, 400, request, env);

        const rows = await sbGet(env, "videography_bookings", `id=eq.${encodeURIComponent(id)}&select=*`);
        const bk = rows && rows[0];
        if (!bk) return json({ error: "No such booking." }, 404, request, env);

        // JACK_NOTIFY overrides JACK_UPN rather than adding to it, matching
        // every other booking notification in this file.
        const team = env.JACK_NOTIFY || env.JACK_UPN;
        if (!team) return json({ error: "No recipient configured." }, 503, request, env);

        const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const siteUrl = (env.SITE_URL || "https://tmke.co.uk").replace(/\/+$/, "");
        const link = `${siteUrl}/admin/videography?booking=${encodeURIComponent(bk.id)}`;
        const when = bk.shoot_date
          ? new Date(bk.shoot_date).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })
          : "No date yet — needs arranging";
        const bookedBy = String((b && b.booked_by) || "").trim();
        const where = bk.property_address || bk.location || "";

        const row = (k, v) => v ? `<p style="${EM_P}"><strong>${esc(k)}</strong> ${esc(v)}</p>` : "";
        const body = `
          <p style="${EM_P}">A shoot has been booked from the social media side${bookedBy ? ` by ${esc(bookedBy)}` : ""}. It is already on your board — nothing to accept, this is just so you know it is there.</p>
          ${row("Client", bk.client_name)}
          ${row("What", bk.service)}
          ${row("When", when)}
          ${row("Where", where)}
          ${row("Notes", bk.notes)}
          <p style="${EM_P}">Covered by their social media package, so there is nothing to invoice.</p>
          <p style="${EM_P}"><a href="${link}" style="${EM_BTN}">Open the booking</a></p>`;

        try {
          await sendEmail(env, {
            to: team,
            subject: `New shoot booked - ${bk.client_name || "SMM client"}${bk.shoot_date ? " - " + when : ""}`,
            html: await wrapInBrandedBase(env, body),
          });
        } catch (e) {
          return json({ error: "Couldn't send that email." }, 502, request, env);
        }
        return json({ ok: true }, 200, request, env);
      }

      if (path.endsWith("/videography/edits-complete-email") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const id = String((b && b.booking_id) || "").trim();
        if (!id) return json({ error: "Missing booking_id" }, 400, request, env);
        const result = await sendEditsCompleteEmail(env, id);
        if (!result.ok) return json({ error: result.reason === "already sent" ? "Already sent." : "Couldn't send that email." }, 400, request, env);
        return json({ ok: true }, 200, request, env);
      }

      // A member's own PIN. Sits behind three checks, because this is the one
      // secret in the whole flow: signed in, the booking is theirs, and it has
      // been paid for. The PIN lives in a table members cannot read at all, so
      // this endpoint is the only way it can reach them - which is the point.
      if (path.endsWith("/videography/my-pin") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user) return json({ error: "Sign in first." }, 401, request, env);
        const id = (url.searchParams.get("booking_id") || "").trim();
        if (!id) return json({ error: "Missing booking_id" }, 400, request, env);

        const rows = await sbGet(env, "videography_bookings",
          `id=eq.${encodeURIComponent(id)}&select=account_user_id,client_email,paid_at,payment_route`);
        const bk = rows && rows[0];
        if (!bk) return json({ error: "Not found." }, 404, request, env);

        const mine = (bk.account_user_id && bk.account_user_id === user.id)
          || (bk.client_email && String(bk.client_email).toLowerCase() === String(user.email || "").toLowerCase());
        // Deliberately the same answer as "no such booking": telling someone
        // a booking exists but isn't theirs is information they don't need.
        if (!mine) return json({ error: "Not found." }, 404, request, env);
        if (!isSettled(bk)) return json({ ok: true, paid: false }, 200, request, env);

        const prow = await sbGet(env, "videography_gallery_pins", `booking_id=eq.${encodeURIComponent(id)}&select=pin`);
        const pin = (prow && prow[0] && prow[0].pin) || "";
        return json({ ok: true, paid: true, pin }, 200, request, env);
      }

      // A member's own 360 tour link. Exactly the same three checks as the
      // PIN above, for exactly the same reason - it lives in its own table
      // no member can read, so this endpoint is the only way it can reach
      // them, and only once paid_at is actually set.
      if (path.endsWith("/videography/my-tour") && request.method === "GET") {
        const user = await getUser(request, env);
        if (!user) return json({ error: "Sign in first." }, 401, request, env);
        const id = (url.searchParams.get("booking_id") || "").trim();
        if (!id) return json({ error: "Missing booking_id" }, 400, request, env);

        const rows = await sbGet(env, "videography_bookings",
          `id=eq.${encodeURIComponent(id)}&select=account_user_id,client_email,paid_at,payment_route`);
        const bk = rows && rows[0];
        if (!bk) return json({ error: "Not found." }, 404, request, env);

        const mine = (bk.account_user_id && bk.account_user_id === user.id)
          || (bk.client_email && String(bk.client_email).toLowerCase() === String(user.email || "").toLowerCase());
        if (!mine) return json({ error: "Not found." }, 404, request, env);
        if (!isSettled(bk)) return json({ ok: true, paid: false }, 200, request, env);

        const trow = await sbGet(env, "videography_tour_links", `booking_id=eq.${encodeURIComponent(id)}&select=url`);
        const tourUrl = normalizeUrl((trow && trow[0] && trow[0].url) || "");
        return json({ ok: true, paid: true, url: tourUrl }, 200, request, env);
      }

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

      // ---- Admin: link a contact card to a member's hub account --------------
      // Given a contact, look up the auth user for its email. If one exists and
      // its name shares the contact's first OR last name, bind contacts.user_id
      // to it (so the card shows as a member). Returns { noAccount } when no hub
      // account exists (UI then offers an invite), or { nameMismatch } when an
      // account exists under a different name (admin can force with { force }).
      // Mirrors the SMM /smm/link flow.
      if (path.endsWith("/contacts/link") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const cid = String((b && b.contact_id) || "").trim();
        if (!cid) return json({ error: "Missing contact id." }, 400, request, env);
        const rows = await sbGet(env, "contacts", `id=eq.${encodeURIComponent(cid)}&select=id,email,first_name,last_name,user_id`);
        const contact = rows && rows[0];
        if (!contact) return json({ error: "That contact no longer exists." }, 404, request, env);
        const email = String(contact.email || "").trim();
        if (!email) return json({ error: "This contact has no email - add one first." }, 400, request, env);
        const u = await findUserByEmail(env, email);
        if (!u) return json({ ok: false, noAccount: true, email }, 200, request, env);
        // Identity check — does the account's name share a name with the card?
        const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z\s-]/g, "").split(/[\s-]+/).filter(Boolean);
        const cardTokens = new Set([...norm(contact.first_name), ...norm(contact.last_name)]);
        const acctName = (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || "";
        const acctTokens = norm(acctName);
        const nameKnown = cardTokens.size > 0 && acctTokens.length > 0;
        const matches = !nameKnown || acctTokens.some((t) => cardTokens.has(t));
        if (!matches && !(b && b.force === true)) {
          return json({ ok: false, nameMismatch: true, email,
            account_name: acctName, card_name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "(no name on card)" }, 200, request, env);
        }
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/contacts?id=eq.${encodeURIComponent(cid)}`, {
          method: "PATCH",
          headers: { apikey: env.SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ user_id: u.id }),
        });
        if (!res.ok) { const t = await res.text().catch(() => ""); return json({ error: "Couldn't link the account. " + t.slice(0, 200) }, 502, request, env); }
        return json({ ok: true, linked: true, user_id: u.id, account_name: acctName }, 200, request, env);
      }

      // ---- Admin: invite a contact to create their member hub account ---------
      // For a contact with no hub account yet: send a branded invite whose button
      // opens the join page (email pre-filled) so they self-serve their account.
      // Double-checks no account already exists before sending, and logs the
      // invite as a note on the card. Unlike /smm/invite this does NOT create the
      // auth user — the join page owns sign-up.
      if (path.endsWith("/contacts/invite") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const b = await request.json().catch(() => ({}));
        const cid = String((b && b.contact_id) || "").trim();
        if (!cid) return json({ error: "Missing contact id." }, 400, request, env);
        const rows = await sbGet(env, "contacts", `id=eq.${encodeURIComponent(cid)}&select=id,email,first_name,last_name,user_id`);
        const contact = rows && rows[0];
        if (!contact) return json({ error: "That contact no longer exists." }, 404, request, env);
        const email = String(contact.email || "").trim();
        if (!email) return json({ error: "This contact has no email - add one first." }, 400, request, env);
        // Guard: never invite someone who already has an account.
        const existing = await findUserByEmail(env, email);
        if (existing) return json({ ok: false, alreadyHasAccount: true, email }, 200, request, env);
        const first = String(contact.first_name || "there").trim();
        const fullName = `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
        const site = String(env.SITE_URL || "https://tmke.co.uk").replace(/\/+$/, "");
        const joinLink = `${site}/join?email=${encodeURIComponent(email)}${fullName ? `&name=${encodeURIComponent(fullName)}` : ""}`;
        const content = `
          <h1 style="${EM_H1}">Create your TMKE account</h1>
          <p style="${EM_P}">Hi ${esc(first)},</p>
          <p style="${EM_P}">We'd love to set you up with a TMKE member account - your own space to design content, plan your marketing, browse The Edit, book shoots and keep everything in one place.</p>
          <p style="${EM_P}">It only takes a minute. Click below to get started.</p>
          <p style="margin:0 0 24px;"><a href="${esc(joinLink)}" style="${EM_BTN}">Create your account</a></p>
          <p style="${EM_P}">If the button doesn't work, paste this into your browser:<br><span style="color:#371e28;">${esc(joinLink)}</span></p>`;
        const html = await wrapInBrandedBase(env, content);
        const sent = await sendEmail(env, { to: email, subject: "Create your TMKE account", html });
        if (!sent.ok) return json({ ok: false, emailFailed: true, error: sent.error || "The invite email didn't send." }, 200, request, env);
        // Log the invite on the contact card so it shows in Notes/Activity.
        try { await sbPost(env, "contact_notes", { contact_id: cid, body: `Invitation to create a member account sent to ${email}.`, author: "System" }); } catch (_) {}
        return json({ ok: true, invited: email }, 200, request, env);
      }

      if (path.endsWith("/contacts/import") && request.method === "POST") {
        const user = await getUser(request, env);
        if (!user || !isAdminEmail(user)) return json({ error: "Admins only." }, 403, request, env);
        const b = await request.json().catch(() => ({}));
        const rows = Array.isArray(b.rows) ? b.rows : [];
        const batchTags = Array.isArray(b.batch_tags) ? b.batch_tags : [];
        const optIn = b.marketing_opt_in === true;
        // "These are internal (Experts Group) agents" — forces them TEG + marketing
        // YES, and fills the TEG tab (brand/postcode/date-joined) from the columns.
        const internal = b.internal === true;
        const source = (typeof b.source === "string" && b.source.trim()) ? b.source.trim() : "import";
        if (!rows.length) return json({ error: "No rows." }, 400, request, env);
        if (rows.length > 500) return json({ error: "Send at most 500 rows per request." }, 400, request, env);
        let imported = 0, skipped = 0, teg = 0;
        for (const r of rows) {
          const email = String((r && r.email) || "").trim().toLowerCase();
          if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { skipped++; continue; }
          const company = r.company || null;
          // A row is TEG if flagged internal, or its email/brand says so.
          const isTeg = internal || networkTag(email) === "Network: TEG" || isTegBrand(company);
          const rowOptIn = optIn || isTeg;   // TEG is always marketing YES
          const rowTags = Array.isArray(r.tags) ? r.tags : (r.tags ? String(r.tags).split(/[;,]/).map((s) => s.trim()) : []);
          const netTag = isTeg ? "Network: TEG" : networkTag(email);
          const tags = Array.from(new Set([...rowTags, ...batchTags, rowOptIn ? "Newsletter-Subscriber" : null, netTag].filter(Boolean)));
          // Checked before the upsert, so a re-import doesn't log everyone a
          // second time. One indexed lookup per opted-in row: imports are an
          // occasional admin action, not a hot path.
          const rowPrior = rowOptIn ? await wasOptedIn(env, email) : null;
          try {
            const cid = await sbRpc(env, "upsert_contact", {
              p_email: email,
              p_first_name: r.first_name || null,
              p_last_name: r.last_name || null,
              p_phone: r.phone || null,
              p_company: company,
              p_source: source,
              // Don't touch lifecycle on import — it's derived from the Network:TEG
              // tag, and forcing a value would clobber a manual "Past". (null →
              // new contacts still default to 'lead' inside upsert_contact.)
              p_lifecycle: null,
              p_marketing_opt_in: rowOptIn ? true : null,
              p_tags: tags,
            });
            imported++;
            // Record HOW they came to be opted in, and be honest about it. A
            // TEG agent is opted in because `rowOptIn = optIn || isTeg` decided
            // it, not because they agreed — that's legitimate interest, and
            // logging it as consent would make this trail useless as evidence
            // the day someone asks.
            if (rowOptIn && rowPrior === false) {
              const byTeg = isTeg && !optIn;
              await logConsent(env, {
                contactId: Array.isArray(cid) ? cid[0] : cid, email,
                action: "opted_in",
                basis: byTeg ? "legitimate_interest" : "consent",
                source: byTeg ? "teg_auto" : "csv_import",
                detail: byTeg
                  ? "TEG network member - opted in automatically on import as part of The Experts Group, not by an act of consent."
                  : "Imported with the marketing opt-in box ticked.",
                actor: "Import",
                raw: { source, internal },
              });
            }
            // TEG contact → register as an internal agent (fills the TEG tab).
            // NOT a videography new-starter, so no code/funnel — those need a package.
            const contactId = Array.isArray(cid) ? cid[0] : cid;
            if (contactId && isTeg) {
              try {
                await ensureAgentProfile(env, contactId, { first_name: r.first_name, last_name: r.last_name, email }, {
                  brand: company, postcode: r.postcode || null, date_joined: parseISODate(r.date_joined) || (r.date_joined || null), is_new_starter: false,
                });
                teg++;
              } catch (_) {}
            }
          } catch (_) { skipped++; }
        }
        return json({ ok: true, imported, skipped, teg }, 200, request, env);
      }

      return json({ error: "Not found" }, 404, request, env);
    } catch (err) {
      return json({ error: String(err && err.message ? err.message : err) }, 500, request, env);
    }
  },
};
