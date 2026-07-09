// Renders a TMKE invoice to a standalone HTML document from (settings + invoice).
// One markup structure + three CSS "skins" (classic | modern | minimal) driven by
// an --accent variable, so the client picks a style and tweaks colour/logo.
// Shared by the admin Template preview now, and the Worker's invoice-send later.

export function money(pence) {
  return "£" + (Number(pence || 0) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const esc = (x) => String(x == null ? "" : x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const nl2br = (x) => esc(x).replace(/\n/g, "<br>");
function fmtDate(d) { if (!d) return ""; try { return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); } catch (_) { return d; } }

// Full standalone HTML document (used as iframe srcdoc + later email/PDF body).
export function renderInvoiceHtml({ settings = {}, invoice = {} } = {}) {
  const s = settings, inv = invoice;
  const accent = s.accent_color || "#371e28";
  const tpl = ["classic", "modern", "minimal"].includes(s.template) ? s.template : "classic";
  const showBank = s.show_bank !== false;
  const items = Array.isArray(inv.line_items) ? inv.line_items : [];
  const vatRate = s.vat_rate != null ? s.vat_rate : 20;

  const logo = s.logo_url
    ? `<img class="logo" src="${esc(s.logo_url)}" alt="${esc(s.company_name || "")}" />`
    : `<div class="wordmark">${esc((s.company_name || "TMKE").split(/\s+/)[0])}</div>`;

  const rows = items.length ? items.map((it) => {
    const qty = it.qty == null ? 1 : it.qty;
    return `<tr>
      <td class="desc">${nl2br(it.description)}</td>
      <td class="num">${esc(qty)}</td>
      <td class="num">${money(it.unit_pence)}</td>
      <td class="num">${money((it.unit_pence || 0) * qty)}</td>
    </tr>`;
  }).join("") : `<tr><td class="desc" colspan="4" style="color:#9a9aa0">No items yet.</td></tr>`;

  const companyMeta = [s.company_reg_no && `Company no. ${esc(s.company_reg_no)}`, s.vat_number && `VAT ${esc(s.vat_number)}`].filter(Boolean).join(" · ");
  const bank = showBank && (s.account_name || s.account_number) ? `
    <div class="pay">
      <div class="lbl">How to pay</div>
      <div>By bank transfer within <strong>${esc(s.payment_terms_days ?? 7)} days</strong>${inv.number ? `, quoting <strong>${esc(inv.number)}</strong>` : ""}.</div>
      <div class="bank">${[s.account_name && `Account: ${esc(s.account_name)}`, s.sort_code && `Sort code: ${esc(s.sort_code)}`, s.account_number && `Account no: ${esc(s.account_number)}`].filter(Boolean).join(" &nbsp;·&nbsp; ")}</div>
    </div>` : "";

  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #eceae7; font-family: Arial, Helvetica, sans-serif; color: #1c1d22; -webkit-font-smoothing: antialiased; }
  .inv { --accent: ${esc(accent)}; width: 794px; max-width: 100%; margin: 20px auto; background: #fff; padding: 48px 52px 40px; }
  .logo { max-height: 56px; max-width: 220px; display: block; }
  .wordmark { font-size: 26px; font-weight: 800; letter-spacing: 0.16em; color: var(--accent); }
  .inv-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .inv-from { font-size: 12px; line-height: 1.6; color: #6b6b70; margin-top: 12px; }
  .inv-title { text-align: right; }
  .inv-title h1 { margin: 0; font-size: 30px; letter-spacing: 0.16em; color: var(--accent); }
  .inv-meta { font-size: 12.5px; line-height: 1.8; color: #444; margin-top: 8px; }
  .inv-meta b { color: #1c1d22; }
  .inv-billto { margin: 34px 0 22px; }
  .lbl { font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); margin-bottom: 6px; }
  .who { font-size: 13.5px; line-height: 1.6; }
  table.inv-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .inv-table th { text-align: left; font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #6b6b70; padding: 10px 12px; border-bottom: 2px solid var(--accent); }
  .inv-table td { padding: 12px; border-bottom: 1px solid #eee; vertical-align: top; }
  .inv-table .num { text-align: right; white-space: nowrap; }
  .inv-table th.num { text-align: right; }
  .inv-totals { margin: 18px 0 0; margin-left: auto; width: 300px; font-size: 13.5px; }
  .inv-totals > div { display: flex; justify-content: space-between; padding: 8px 12px; }
  .inv-totals .grand { margin-top: 6px; background: var(--accent); color: #fff; border-radius: 6px; font-weight: 700; font-size: 15px; }
  .inv-foot { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; display: flex; justify-content: space-between; gap: 30px; font-size: 12px; color: #555; line-height: 1.7; }
  .bank { margin-top: 6px; }
  .note { max-width: 40%; color: #6b6b70; font-style: italic; }
  .inv-thanks { margin-top: 6px; font-size: 12px; color: #9a9aa0; }

  /* ---- MODERN: accent header band, coloured table head ---- */
  .tpl-modern { padding: 0 0 40px; }
  .tpl-modern .inv-head { background: var(--accent); color: #fff; padding: 40px 52px; align-items: center; }
  .tpl-modern .inv-from { color: rgba(255,255,255,0.85); }
  .tpl-modern .wordmark, .tpl-modern .inv-title h1 { color: #fff; }
  .tpl-modern .inv-billto, .tpl-modern .inv-table, .tpl-modern .inv-totals, .tpl-modern .inv-foot { margin-left: 52px; margin-right: 52px; width: auto; }
  .tpl-modern .inv-totals { margin-left: auto; margin-right: 52px; width: 300px; }
  .tpl-modern .inv-billto { margin-top: 30px; }
  .tpl-modern .inv-table th { background: color-mix(in srgb, var(--accent) 10%, #fff); border-bottom: 1px solid #eee; color: var(--accent); }

  /* ---- MINIMAL: whitespace, hairlines, colour only on the total ---- */
  .tpl-minimal .inv-title h1 { color: #1c1d22; font-weight: 500; letter-spacing: 0.24em; }
  .tpl-minimal .lbl { color: #9a9aa0; }
  .tpl-minimal .inv-table th { border-bottom: 1px solid #ddd; color: #9a9aa0; }
  .tpl-minimal .inv-totals .grand { background: none; color: var(--accent); border-top: 2px solid var(--accent); border-radius: 0; }
</style></head>
<body>
  <div class="inv tpl-${tpl}">
    <div class="inv-head">
      <div class="inv-brand">
        ${logo}
        <div class="inv-from"><strong>${esc(s.company_name || "")}</strong><br>${nl2br(s.company_address || "")}${companyMeta ? `<br>${companyMeta}` : ""}</div>
      </div>
      <div class="inv-title">
        <h1>INVOICE</h1>
        <div class="inv-meta">${inv.number ? `<b>${esc(inv.number)}</b><br>` : ""}${inv.issued_date ? `Issued: ${fmtDate(inv.issued_date)}<br>` : ""}${inv.due_date ? `Due: ${fmtDate(inv.due_date)}` : ""}</div>
      </div>
    </div>

    <div class="inv-billto">
      <div class="lbl">Bill to</div>
      <div class="who"><strong>${esc(inv.bill_to_name || "")}</strong>${inv.bill_to_address ? `<br>${nl2br(inv.bill_to_address)}` : ""}${inv.bill_to_email ? `<br>${esc(inv.bill_to_email)}` : ""}</div>
    </div>

    <table class="inv-table">
      <thead><tr><th class="desc">Description</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="inv-totals">
      <div><span>Subtotal</span><span>${money(inv.subtotal_pence)}</span></div>
      <div><span>VAT (${esc(vatRate)}%)</span><span>${money(inv.vat_pence)}</span></div>
      <div class="grand"><span>Total due</span><span>${money(inv.total_pence)}</span></div>
    </div>

    <div class="inv-foot">
      ${bank}
      ${s.footer_note ? `<div class="note">${nl2br(s.footer_note)}</div>` : `<div class="inv-thanks">Thank you.</div>`}
    </div>
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
    bill_to_address: "1 High Street, Rugby, CV21 3BZ",
    bill_to_email: "accounts@fineandcountry-example.com",
    line_items: [
      { description: "Property Videography — Half Day", qty: 1, unit_pence: 32500 },
      { description: "Local area video tour", qty: 1, unit_pence: 10000 },
    ],
    subtotal_pence: 42500, vat_pence: 8500, total_pence: 51000,
  };
}
