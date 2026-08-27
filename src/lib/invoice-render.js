// Renders a TMKE invoice to a standalone HTML document from (settings + invoice).
// Two brand-led styles matched to the client's Canva mockups:
//   • minimal — warm paper, big bold wordmark, oversized TOTAL, thick rule (style 1)
//   • banded  — wine header band + paper body + beige footer band (style 2)
// (Legacy keys map on: editorial/classic → minimal, modern → banded.)
// Colour (accent), logo image and Outlook-safe font stay editable. Shared by the
// admin Template preview now and the Worker's invoice-send later.

export function money(pence) {
  return "£" + (Number(pence || 0) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const esc = (x) => String(x == null ? "" : x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const nl2br = (x) => esc(x).replace(/\n/g, "<br>");
function fmtDate(d) { if (!d) return ""; try { return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch (_) { return d; } }

export function renderInvoiceHtml({ settings = {}, invoice = {} } = {}) {
  const s = settings, inv = invoice;
  const accent = s.accent_color || "#371e28";
  // Two styles only: "minimal" (the clean wordmark layout, formerly "editorial")
  // and "banded". Every legacy/aliased key maps onto one of the two.
  const style = (s.template === "banded" || s.template === "modern") ? "banded" : "minimal";
  const font = s.font_family || "Arial, Helvetica, sans-serif";
  const fs = Number(s.font_size) || 13;
  const showBank = s.show_bank !== false;
  const items = Array.isArray(inv.line_items) ? inv.line_items : [];
  const vatRate = s.vat_rate != null ? s.vat_rate : 20;
  const company = (s.company_name || "The Marketing Experts").toUpperCase();
  const paidDate = (String(inv.status) === "paid" && inv.paid_date) ? fmtDate(inv.paid_date) : null;

  const wordmark = s.logo_url
    ? `<img class="logo" src="${esc(s.logo_url)}" alt="${esc(s.company_name || "")}" />`
    : `<div class="wordmark">TMKE</div>`;

  const rows = items.length ? items.map((it) => {
    const qty = it.qty == null ? 1 : it.qty;
    return `<tr><td class="desc">${nl2br(it.description)}</td><td class="num">${money((it.unit_pence || 0) * qty)}</td></tr>`;
  }).join("") : `<tr><td class="desc" style="color:#a99">Description</td><td class="num">£0.00</td></tr>`;

  // Header — banded is a wine block (dates in the band); minimal puts the dates
  // just above Bill to (see datesRow in the body).
  const header = style === "banded" ? `
    <header class="inv-head band">
      <div class="brand">${wordmark}<div class="company">${esc(company)}</div></div>
      <div class="meta-r">
        <div class="no">INVOICE NO. <b>${esc(inv.number || "")}</b></div>
        <div class="d"><span class="k">Invoice date</span> ${fmtDate(inv.issued_date) || "—"}</div>
        <div class="d"><span class="k">Due date</span> ${fmtDate(inv.due_date) || "—"}</div>
      </div>
    </header>` : `
    <header class="inv-head plain">
      <div class="brand">${wordmark}</div>
      <div class="headrow">
        <span class="company">${esc(company)}</span>
        <span class="no">INVOICE NO. <b>${esc(inv.number || "")}</b></span>
      </div>
    </header>`;
  const datesRow = style === "banded" ? "" : `<div class="dates-row"><span class="k">Invoice date</span> <b>${fmtDate(inv.issued_date) || "—"}</b> &nbsp;&nbsp;&nbsp; <span class="k">Due date</span> <b>${fmtDate(inv.due_date) || "—"}</b></div>`;

  // Only "Bill to" is bold. The name sits next to it; the email and/or the
  // address then follow underneath — either one, or both, one after the other.
  const billExtra = [
    inv.bill_to_email ? esc(inv.bill_to_email) : "",
    inv.bill_to_address ? nl2br(inv.bill_to_address) : "",
  ].filter(Boolean).join("<br>");
  // "For" sits under "Bill to" because on inter-brand work they are different
  // people: the payer is a finance department settling for several clients, and
  // without naming the client their accounts team cannot tell these apart
  // either. Omitted entirely when there is no client, so ordinary invoices are
  // unchanged.
  const forLine = inv.client_name
    ? `<div class="billfor"><span class="lbl">For</span> <span class="who">${esc(inv.client_name)}</span></div>`
    : "";
  const billto = inv.bill_to_name ? `
    <div class="billto"><span class="lbl">Bill to</span> <span class="who">${esc(inv.bill_to_name)}</span>${billExtra ? `<div class="bill-extra">${billExtra}</div>` : ""}</div>${forLine}` : "";

  // Payment block. Direct Debit invoices show a "collected by Direct Debit" flag
  // (no bank details — nothing to pay); everyone else gets the bank-transfer
  // "How to pay". A full-width rule (Description weight) sits under the label; any
  // per-invoice note sits beneath, under its own line.
  const isDD = inv.payment_method === "direct_debit";
  const showBankBlock = !isDD && showBank && (s.account_name || s.account_number);
  const payInner = [];
  if (isDD) {
    payInner.push(`<div class="pl">To be collected by Direct Debit${inv.due_date ? ` on <strong>${fmtDate(inv.due_date)}</strong>` : ""} — nothing to pay.</div>`);
  } else if (showBankBlock) {
    // A card option is offered per invoice, so it is listed first when it
    // applies. The PDF carries no link of its own - the signed pay URL lives in
    // the covering email and cannot be reproduced safely here - so it points
    // back at the email rather than pretending to be clickable.
    // terms_days is a per-invoice override; null falls back to the global.
    const days = inv.terms_days ?? s.payment_terms_days ?? 7;
    const quoting = inv.number ? `, quoting <strong>${esc(inv.number)}</strong>` : "";
    if (inv.pay_by_card) {
      payInner.push(`<div class="pl">By card, using the payment button in your invoice email.</div>`);
      payInner.push(`<div class="pl">Or by bank transfer within <strong>${esc(days)} days</strong>${quoting}.</div>`);
    } else {
      payInner.push(`<div class="pl">By bank transfer within <strong>${esc(days)} days</strong>${quoting}.</div>`);
    }
    payInner.push(`<div class="bank">${[s.account_name && `Account: ${esc(s.account_name)}`, s.sort_code && `Sort code: ${esc(s.sort_code)}`, s.account_number && `Account no: ${esc(s.account_number)}`].filter(Boolean).join("<br>")}</div>`);
  }
  // Shoots only. Both statements matter to the client: one tells them they are
  // not paying for something they have not had, the other tells them why paying
  // promptly is in their interest.
  if (inv.release_on_payment) {
    payInner.push(`<div class="paynote-rule"></div><div class="paynote"><strong>Payment is not required until your shoot has taken place.</strong><br>Your content is watermarked and locked until payment has been received. Once it clears we email your PIN, which unlocks downloading from your gallery.</div>`);
  }
  if (inv.notes) payInner.push(`<div class="paynote-rule"></div><div class="paynote">${nl2br(inv.notes)}</div>`);
  const bank = payInner.length ? `
    <div class="pay">
      <div class="lbl">${isDD ? "Payment" : "How to pay"}</div>
      <div class="payrule"></div>
      ${payInner.join("\n      ")}
    </div>` : "";

  const smallprint = [
    s.company_address && esc(s.company_address).replace(/\n/g, " "),
    s.company_reg_no && `Company Number: ${esc(s.company_reg_no)}`,
    s.vat_number && `VAT Registration Number: ${esc(s.vat_number)}`,
  ].filter(Boolean);
  const foot = style === "banded"
    ? `<div class="smallprint band">${smallprint.map((x) => `<div>${x}</div>`).join("")}</div>`
    : `<div class="smallprint">· ${smallprint.join(" · ") || "&nbsp;"} ·</div>`;

  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { box-sizing: border-box; }
  /* A4 = 210×297mm. Sizing the page in mm keeps the on-screen scale and the
     printed/PDF output identical, so 13px really is 13px on the sheet. */
  @page { size: A4; margin: 0; }
  html, body { margin: 0; }
  body { background: #cfccc8; font-family: ${font}; color: #2a1b22; -webkit-font-smoothing: antialiased; }
  .inv { --accent:${esc(accent)}; --paper:#f1efec; --beige:#d6cdc7; width:210mm; min-height:297mm; margin:0 auto; background:var(--paper); box-shadow:0 10px 34px rgba(20,18,26,0.18); display:flex; flex-direction:column; font-size:${fs}px; color:var(--accent); }
  @media print { body { background:#fff; } .inv { box-shadow:none; margin:0; } }
  .body { padding:0 64px 121px; flex:1; display:flex; flex-direction:column; }
  .pay-block { margin-top:auto; }   /* pushes How to pay towards the lower third */
  .logo { max-height:70px; max-width:280px; display:block; }
  .lbl { font-weight:700; letter-spacing:0.1em; text-transform:uppercase; }

  /* Dates row — sits just above Bill to (editorial/minimal), same size. */
  .dates-row { margin:0 0 12px; font-size:11.5px; }
  .dates-row .k { font-weight:700; letter-spacing:0.06em; text-transform:uppercase; }
  .dates-row b { font-weight:400; }

  .billto { margin:0; font-size:11.5px; }
  .billfor { margin:5px 0 0; font-size:11.5px; }
  .billfor .lbl { color:var(--accent); }
  .billfor .who { line-height:1.55; }
  .billto .lbl { color:var(--accent); }
  .billto .who { line-height:1.55; }
  .bill-extra { margin-top:4px; font-size:11.5px; line-height:1.5; }

  /* Line-item table — descriptions at the Bill-to size. Bigger gap under the
     header rule; tighter spacing between items. */
  table.tbl { width:100%; border-collapse:collapse; margin-top:46px; }
  .tbl thead th { text-align:left; font-size:11.5px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; padding:0 0 10px; border-bottom:1.5px solid var(--accent); }
  .tbl thead th.num { text-align:right; }
  .tbl td { padding:9px 0; font-size:11.5px; }
  .tbl tbody tr:first-child td { padding-top:16px; }
  .tbl td.num { text-align:right; white-space:nowrap; }

  /* Totals — sub-total/VAT at the shared body size (11.5px, unbold); big total. */
  .totals { margin-top:34px; }
  .totals .r { display:flex; justify-content:space-between; font-size:11.5px; padding:5px 0; }
  .totals .grand { margin-top:8px; display:flex; justify-content:space-between; align-items:baseline; font-size:30px; font-weight:800; letter-spacing:-0.01em; }
  /* Paid stamp — shown once the invoice is marked paid. */
  .paid-stamp { margin-top:14px; display:inline-block; padding:6px 16px; border:1.5px solid #2e6b40; color:#2e6b40; border-radius:6px; font-size:13px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; }

  .pay { font-size:11.5px; line-height:1.4; }
  .pay .lbl { font-size:11.5px; margin-bottom:8px; }
  /* Full-width rule under the label — same weight as the Description rule. */
  .payrule { width:100%; height:1.5px; background:var(--accent); margin:0 0 12px; }
  .pay .pl { margin-bottom:10px; }
  .pay .bank { line-height:1.5; }
  .paynote-rule { width:100%; height:1px; background:rgba(55,30,40,0.2); margin:14px 0 10px; }
  .paynote { font-size:11.5px; line-height:1.5; opacity:0.85; }
  .note { margin-top:16px; font-style:italic; opacity:0.7; font-size:12px; }

  .smallprint { font-size:9.5px; letter-spacing:0.02em; opacity:0.8; text-align:center; padding:0 64px 40px; }

  /* ---- MINIMAL (style 1): paper, big bold wordmark, oversized total ---- */
  .plain { padding:64px 64px 0; }
  .wordmark { font-weight:800; font-size:64px; letter-spacing:-0.01em; line-height:0.9; color:var(--accent); }
  .plain .headrow { display:flex; justify-content:space-between; align-items:baseline; margin-top:26px; }
  .plain .company, .plain .no { font-size:14px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; }
  .plain + .body { padding-top:64px; }

  /* ---- BANDED (temp2): wine header band + beige footer band ---- */
  /* ~1cm of page (paper) colour above the band, then a taller band. */
  .band { margin-top:10mm; background:var(--accent); color:var(--paper); padding:56px 64px 52px; display:flex; justify-content:space-between; align-items:flex-start; gap:24px; }
  .band .wordmark { font-family:Georgia,'Times New Roman',serif; font-weight:500; letter-spacing:0.1em; color:var(--paper); }
  .band .company { margin-top:12px; font-size:14px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; }
  .band .meta-r { text-align:right; align-self:flex-start; line-height:1.5; }
  .band .meta-r .no { font-size:16px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; margin-bottom:4px; }
  .band .meta-r .d { font-size:13.5px; }
  .band .meta-r .k { text-transform:uppercase; letter-spacing:0.04em; }
  .band + .body { padding-top:56px; }
  .tpl-banded .tbl { margin-top:58px; }
  .smallprint.band { margin-top:auto; text-align:left; opacity:1; background:var(--beige); color:var(--accent); font-weight:400; font-size:10.5px; line-height:1.2; padding:22px 64px; }
</style></head>
<body>
  <div class="inv tpl-${style}">
    ${header}
    <div class="body">
      ${datesRow}
      ${billto}
      <table class="tbl">
        <thead><tr><th class="desc">Description</th><th class="num">Price</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div class="r"><span>Sub-total</span><span>${money(inv.subtotal_pence)}</span></div>
        <div class="r"><span>VAT (${esc(vatRate)}%)</span><span>${money(inv.vat_pence)}</span></div>
        <div class="grand"><span>TOTAL</span><span>${money(inv.total_pence)}</span></div>
        ${paidDate ? `<div class="paid-stamp">Paid · ${esc(paidDate)}</div>` : ""}
      </div>
      <div class="pay-block">
        ${bank}
        ${s.footer_note ? `<div class="note">${nl2br(s.footer_note)}</div>` : ""}
      </div>
    </div>
    ${foot}
  </div>
</body></html>`;
}

// A representative sample invoice for the template preview.
export function sampleInvoice(settings = {}) {
  const prefix = settings.invoice_prefix || "TMKE";
  return {
    number: `${prefix}${settings.next_number || 1001}`,
    issued_date: "2026-08-03", due_date: "2026-08-10",
    bill_to_name: "Fine & Country — Rugby",
    client_name: "Prestige — Rugby branch",
    bill_to_email: "accounts@fineandcountry-example.com",
    bill_to_address: "12 High Street, Rugby, CV21 3BZ",
    notes: "Thank you for your business.",
    line_items: [
      { description: "Property Videography — Half Day", qty: 1, unit_pence: 32500 },
      { description: "Local area video tour", qty: 1, unit_pence: 10000 },
    ],
    subtotal_pence: 42500, vat_pence: 8500, total_pence: 51000,
  };
}
