/* The covering email that goes with an invoice, and the "due today"
 * reminder: written once here and used everywhere, so the automatic
 * invoicing (the Worker) and the send screens in the admin say the same
 * thing. Wording: Danielle's "TMKE invoicing emails" doc, signed off 22 Oct
 * 2026 (https://claude.ai/artifact/W7vPF33Un5NDCahGHYDrMw).
 *
 * Which email an invoice gets:
 *   videography by card / bank transfer     5   (booking.payment_route agent_card)
 *   videography for a TEG brand             6   (brand_invoice_teg; induction variant)
 *   videography for Fine & Country          7   (brand_invoice)
 *   social media, to the client             1
 *   social media, to Newman accounts        2   (a brand pays: Hi Paula)
 *   TPE Marketing Hub                       4   (a recurring invoice with a monthly number)
 *   agent assets                            3   (any other recurring invoice)
 *   anything else                           a plain version of the same
 *
 * Greetings: a client gets "Hi <first name>,"; a brand email, which Paula
 * handles, gets "Hi Paula,". Brand emails don't ask for a bank transfer
 * (the brands move the money between them) and ask Paula to say when it's
 * applied.
 *
 * ctx (all optional): booking (videography_bookings row), recurring
 * (recurring_invoices row), lead (smm_leads row).
 */

const dLong = (x) =>
  x ? new Date(String(x).slice(0, 10) + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
const dShoot = (x) =>
  x ? new Date(x).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }) : "the shoot date";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthOf = (inv) => {
  const ym = /^\d{4}-\d{2}/.test(String(inv.billing_month || "")) ? inv.billing_month : String(inv.issued_date || new Date().toISOString()).slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
const gbp = (pence) => {
  const v = (pence || 0) / 100;
  return "£" + v.toLocaleString("en-GB", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
};
const first = (s) => String(s || "").trim().split(/\s+/)[0] || "";
const where = (b) => String((b && (b.property_address || b.location)) || "").replace(/\s*\n\s*/g, ", ").trim();

// Where the card payment button goes in the email. The admin's send screen
// shows this line as it is; the email swaps it for the button.
export const PAY_TOKEN = "[Pay by card button]";

const FC_OFFICE_LABELS = { fc_midlands: "Fine & Country Midlands", fc_stratford: "Fine & Country Stratford" };
const TEG_REASON_LABELS = { induction: "New Starter Induction Shoot - Pro / Academy", event: "Brand Event Coverage", marketing: "Brand Marketing Content" };

export function companyName(settings) {
  return (settings && settings.company_name) || "The Marketing Experts (Nationwide) Ltd";
}

/* Is this invoice for a brand (Paula handles it) rather than a client? */
export function isBrandInvoice(inv, ctx = {}) {
  const route = ctx.booking && ctx.booking.payment_route;
  if (route === "brand_invoice" || route === "brand_invoice_teg") return true;
  return /@newman\.uk\.com\b/i.test(String(inv.bill_to_email || ""));
}

export function invoiceEmail(inv, settings, ctx = {}) {
  const bk = ctx.booking || null, rec = ctx.recurring || null, lead = ctx.lead || null;
  const n = inv.number;
  const brand = isBrandInvoice(inv, ctx);
  const clientName = (bk && bk.client_name) || (rec && rec.contact_name) || (lead && (lead.full_name || lead.business)) || inv.client_name || inv.bill_to_name || "";
  const hi = brand ? "Hi Paula," : `Hi ${first((bk && bk.client_name) || (rec && rec.contact_name) || (lead && lead.full_name) || inv.bill_to_name) || "there"},`;
  const due = dLong(inv.due_date);
  const amt = [`Amount due: ${gbp(inv.total_pence)}`, ...(due ? [`Due date: ${due}`] : [])];
  const bank = `Please pay by bank transfer${due ? ` by ${due}` : ""}, using the account details on the invoice and quoting ${n} as the reference.`;
  const card = [`You can pay by card using the button below, or by bank transfer using the account details on the invoice. If you pay by bank transfer, please quote ${n} as the reference.`, "", PAY_TOKEN];
  const howToPay = brand
    ? ["When the payment has been applied, please reply to let us know, so we can record it on our system."]
    : inv.pay_by_card ? card : [bank];
  const end = ["", "If you have any questions, just reply to this email.", "", "Kind regards,", "The TMKE team"];
  const out = (subject, middle) => ({ subject, body: [hi, "", ...middle, "", ...howToPay, ...end].join("\n") });

  // Videography
  if (bk) {
    const date = dShoot(bk.shoot_date), loc = where(bk), service = bk.service || "videography";
    const at = loc ? ` at ${loc}` : "";
    if (bk.payment_route === "brand_invoice_teg") {
      const reason = bk.teg_reason === "other" ? (bk.teg_reason_other || "Other") : (TEG_REASON_LABELS[bk.teg_reason] || "");
      const why = bk.teg_reason === "induction"
        ? `This was ${clientName}'s induction shoot. The cost of the shoot was included in their joining fee, so it's billed to ${inv.bill_to_name} rather than to ${clientName}.`
        : `It's billed to ${inv.bill_to_name} as the settling brand, rather than to ${clientName}.`;
      return out(`Invoice ${n}: ${clientName}'s shoot on ${date}.`,
        [`Please find attached invoice ${n} for ${clientName}'s ${service} shoot on ${date}${at}.`, "", ...amt, ...(reason ? [`Reason: ${reason}`] : []), "", why]);
    }
    if (bk.payment_route === "brand_invoice") {
      const office = FC_OFFICE_LABELS[bk.fc_office] || inv.bill_to_name || "Fine & Country";
      return out(`Invoice ${n}: ${clientName}, ${office}, shoot on ${date}.`,
        [`Please find attached invoice ${n} for ${clientName} at ${office}. It's for their ${service} shoot on ${date}${at}.`, "", ...amt, "",
         `The shoot is paid from the marketing fee charged to ${clientName}'s client, which Fine & Country have confirmed they hold.`]);
    }
    return out(`Invoice ${n} for your shoot on ${date}.`,
      [`Please find attached invoice ${n} for your ${service} shoot on ${date}${at}.`, "", ...amt, "",
       "Payment isn't required until your shoot has taken place. Your content stays watermarked and locked until payment reaches us. Once it does, we'll email your PIN, which unlocks downloading from your gallery."]);
  }

  const month = monthOf(inv);
  // Social media
  if ((rec && rec.kind === "social") || inv.booking_source === "smm") {
    return brand
      ? out(`Invoice ${n}: social media management for ${clientName}, ${month}.`,
          [`Please find attached invoice ${n} for ${clientName}'s social media management in ${month}. It's billed to ${inv.bill_to_name}.`, "", ...amt])
      : out(`Invoice ${n}: Social media management for ${month}.`,
          [`Please find attached invoice ${n} for your social media management in ${month}.`, "", ...amt]);
  }
  // TPE Marketing Hub: a recurring invoice with a monthly number of agents
  if (rec && rec.quantity_label) {
    const line = (inv.line_items || [])[0] || {};
    return out(`Invoice ${n}: TPE Marketing Hub for ${month}.`,
      [`Please find attached invoice ${n} for the TPE Marketing Hub in ${month}. It's charged at ${gbp(line.unit_pence)} per agent, for ${line.qty || 0} agents.`, "", ...amt]);
  }
  // Agent assets (the other recurring invoices)
  if (rec) {
    return out(`Invoice ${n}: monthly agent assets for ${inv.bill_to_name}, ${month}.`,
      [`Please find attached invoice ${n} for ${inv.bill_to_name}'s monthly agent assets for ${month}.`, "", ...amt]);
  }
  // Anything else
  return out(`Invoice ${n} from ${companyName(settings)}.`, [`Please find attached invoice ${n}.`, "", ...amt]);
}

/* The "due today" reminder (email 8): to the payer, on the due date. */
export function invoiceReminderEmail(inv, ctx = {}) {
  const n = inv.number, bk = ctx.booking || null, rec = ctx.recurring || null, lead = ctx.lead || null;
  const hi = isBrandInvoice(inv, ctx) ? "Hi Paula," : `Hi ${first((bk && bk.client_name) || (rec && rec.contact_name) || (lead && lead.full_name) || inv.bill_to_name) || "there"},`;
  const pay = inv.pay_by_card
    ? [`You can pay by card using the button below, or by bank transfer using the account details on the invoice, quoting ${n} as the reference.`, "", PAY_TOKEN, "", "If you've already paid, thank you, and please ignore this email."]
    : [`You can pay by bank transfer using the account details on the invoice, quoting ${n} as the reference. If you've already paid, thank you, and please ignore this email.`];
  return {
    subject: `Invoice ${n} is due today.`,
    body: [hi, "", `Just a reminder that invoice ${n} for ${gbp(inv.total_pence)} is due today.`, "", ...pay, "", "Kind regards,", "The TMKE team"].join("\n"),
  };
}

// Kept for anything still calling the old names: the email without context.
export function defaultEmailSubject(inv, settings) { return invoiceEmail(inv, settings).subject; }
export function defaultEmailBody(inv, settings) { return invoiceEmail(inv, settings).body; }

/* What is about to go out, in words, because you cannot tell from a subject
   line whether an email carries a payment button. */
export function payLine(inv) {
  return inv && inv.pay_by_card
    ? "This email includes a Pay by card button (Stripe)."
    : "No payment link: bank transfer only, using the details on the invoice.";
}
