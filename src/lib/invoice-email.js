/* The covering email that goes with an invoice.
 *
 * Written once, used twice: the Invoicing tab has always shown it in a dialog
 * before sending, and Videography sent the same invoice with no dialog at all
 * — so the two could say different things about the same bill, and nobody
 * could amend the videography one to explain what it was for.
 *
 * The Worker keeps its own copy as the last resort, for a send that arrives
 * with no subject or body (a cron chase, an older client). This is what a
 * person sees and edits.
 */

const dLong = (x) =>
  x ? new Date(x + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;

const gbp = (pence) => {
  const v = (pence || 0) / 100;
  return "£" + v.toLocaleString("en-GB", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
};

export function companyName(settings) {
  return (settings && settings.company_name) || "The Marketing Experts (Nationwide) Ltd";
}

export function defaultEmailSubject(inv, settings) {
  return `Invoice ${inv.number} from ${companyName(settings)}`;
}

export function defaultEmailBody(inv, settings) {
  const company = companyName(settings);
  const due = dLong(inv.due_date);
  const lines = [
    `Dear ${inv.bill_to_name || "Sir or Madam"},`, "",
    `Please find attached invoice ${inv.number} from ${company}.`, "",
    `Amount due: ${gbp(inv.total_pence || 0)}`,
  ];
  if (due) lines.push(`Due date: ${due}`);
  /* When the invoice carries a pay link, say so — telling someone to pay by
     bank transfer while a card button sits above it just reads as
     contradictory. */
  lines.push("", inv.pay_by_card
    ? `Payment is due${due ? ` by ${due}` : ""}. You can pay by card using the button in this email, or by bank transfer using the account details on the invoice, quoting ${inv.number} as the reference. If you have any questions, just reply to this email.`
    : `Payment is due${due ? ` by ${due}` : ""} by bank transfer — the account details are on the invoice, and please quote ${inv.number} as the reference. If you have any questions, just reply to this email.`,
    "", "Kind regards,", company);
  // Shoots only. An SMM invoice must not promise anything about content.
  if (inv.release_on_payment) {
    lines.splice(lines.length - 2, 0, "",
      "Payment isn't required until your shoot has taken place. Your content stays watermarked and locked until payment reaches us — once it does we'll email your PIN, which unlocks downloading from your gallery.");
  }
  return lines.join("\n");
}

/* What is about to go out, in words, because you cannot tell from a subject
   line whether an email carries a payment button. */
export function payLine(inv) {
  return inv && inv.pay_by_card
    ? "This email includes a Pay by card button (Stripe)."
    : "No payment link — bank transfer only, using the details on the invoice.";
}
