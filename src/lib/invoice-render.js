// Renders a TMKE invoice to a standalone HTML document from (settings + invoice).
// A full A4 page: logo + company name up top, line items, totals + how-to-pay,
// and the company address / reg / VAT as small print pinned to the bottom.
// One markup structure + three distinct CSS skins (classic | modern | minimal)
// driven by an --accent variable, an Outlook-safe font, a logo image (URL, else
// a text wordmark) and an optional bank block. Shared by the admin Template
// preview now and the Worker's invoice-send later.

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
  const font = s.font_family || "Arial, Helvetica, sans-serif";
  const fs = Number(s.font_size) || 13;
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

  const bank = showBank && (s.account_name || s.account_number) ? `
    <div class="inv-pay">
      <div class="lbl">How to pay</div>
      <div>By bank transfer within <strong>${esc(s.payment_terms_days ?? 7)} days</strong>${inv.number ? `, quoting <strong>${esc(inv.number)}</strong>` : ""}.</div>
      <div class="bank">${[s.account_name && `Account: ${esc(s.account_name)}`, s.sort_code && `Sort code: ${esc(s.sort_code)}`, s.account_number && `Account no: ${esc(s.account_number)}`].filter(Boolean).join(" &nbsp;·&nbsp; ")}</div>
    </div>` : "";

  const smallprint = [
    s.company_address && esc(s.company_address).replace(/\n/g, ", "),
    s.company_reg_no && `Registered in England &amp; Wales, company no. ${esc(s.company_reg_no)}`,
    s.vat_number && `VAT registration no. ${esc(s.vat_number)}`,
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");

  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #d9d7d4; font-family: ${font}; color: #1c1d22; -webkit-font-smoothing: antialiased; }
  /* A4 page (794 x 1123 @96dpi) so the preview reads like a real sheet. */
  .inv { --accent: ${esc(accent)}; width: 794px; min-height: 1123px; max-width: 100%; margin: 24px auto; background: #fff; box-shadow: 0 8px 30px rgba(20,18,26,0.18); display: flex; flex-direction: column; padding: 52px 56px 40px; font-size: ${fs}px; }

  .logo { max-height: 60px; max-width: 240px; display: block; }
  .wordmark { font-family: Georgia, 'Times New Roman', serif; font-size: 30px; font-weight: 700; letter-spacing: 0.14em; color: var(--accent); }
  .inv-company { font-size: 12px; color: #6b6b70; margin-top: 8px; letter-spacing: 0.02em; }
  .inv-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .inv-title { text-align: right; }
  .inv-title h1 { margin: 0; font-size: 30px; letter-spacing: 0.16em; color: var(--accent); font-weight: 700; }
  .inv-meta { font-size: 12.5px; line-height: 1.8; color: #555; margin-top: 10px; }
  .inv-meta b { color: #1c1d22; }
  .inv-meta .k { color: #9a9aa0; display: inline-block; min-width: 58px; }

  .inv-billto { margin: 40px 0 22px; }
  .lbl { font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); margin-bottom: 6px; }
  .who { line-height: 1.6; }

  table.inv-table { width: 100%; border-collapse: collapse; }
  .inv-table th { text-align: left; font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #6b6b70; padding: 10px 12px; border-bottom: 2px solid var(--accent); }
  .inv-table td { padding: 12px; border-bottom: 1px solid #eee; vertical-align: top; }
  .inv-table .num, .inv-table th.num { text-align: right; white-space: nowrap; }

  .inv-totals { margin: 18px 0 0 auto; width: 300px; }
  .inv-totals > div { display: flex; justify-content: space-between; padding: 8px 12px; }
  .inv-totals .grand { margin-top: 6px; background: var(--accent); color: #fff; border-radius: 6px; font-weight: 700; font-size: 1.15em; }

  .inv-pay { margin-top: 34px; line-height: 1.7; color: #444; font-size: 0.92em; }
  .inv-pay .bank { margin-top: 6px; }
  .inv-note { margin-top: 18px; color: #6b6b70; font-style: italic; font-size: 0.9em; }

  /* Small print pinned to the very bottom of the page. */
  .inv-smallprint { margin-top: auto; padding-top: 24px; border-top: 1px solid #eee; font-size: 10px; line-height: 1.6; color: #9a9aa0; text-align: center; }

  /* ---- CLASSIC: a thin accent rule across the top, serif title ---- */
  .tpl-classic { border-top: 5px solid var(--accent); }
  .tpl-classic .inv-title h1 { font-family: Georgia, 'Times New Roman', serif; letter-spacing: 0.1em; }

  /* ---- MODERN: full accent header band (everything readable on it) ---- */
  .tpl-modern { padding: 0 0 40px; }
  .tpl-modern .inv-head { background: var(--accent); color: #fff; padding: 44px 56px; align-items: center; }
  .tpl-modern .wordmark, .tpl-modern .inv-title h1 { color: #fff; }
  .tpl-modern .inv-company { color: rgba(255,255,255,0.85); }
  .tpl-modern .inv-meta { color: rgba(255,255,255,0.92); }
  .tpl-modern .inv-meta b { color: #fff; }
  .tpl-modern .inv-meta .k { color: rgba(255,255,255,0.6); }
  .tpl-modern .inv-billto, .tpl-modern .inv-table, .tpl-modern .inv-pay { margin-left: 56px; margin-right: 56px; }
  .tpl-modern .inv-totals { margin-right: 56px; }
  .tpl-modern .inv-billto { margin-top: 34px; }
  .tpl-modern .inv-smallprint { margin-left: 56px; margin-right: 56px; }
  .tpl-modern .inv-table th { background: rgba(0,0,0,0.02); border-bottom: 1px solid #eee; color: var(--accent); }
  .tpl-modern .inv-totals .grand { border-radius: 100px; }

  /* ---- MINIMAL: airy, hairlines, colour only on the title rule + total ---- */
  .tpl-minimal { padding: 64px 60px 44px; }
  .tpl-minimal .inv-title h1 { color: #1c1d22; font-weight: 500; letter-spacing: 0.28em; padding-bottom: 8px; border-bottom: 2px solid var(--accent); }
  .tpl-minimal .lbl { color: #9a9aa0; }
  .tpl-minimal .inv-table th { border-bottom: 1px solid #e6e6e6; color: #9a9aa0; }
  .tpl-minimal .inv-table td { border-bottom: 1px solid #f2f2f2; }
  .tpl-minimal .inv-totals .grand { background: none; color: var(--accent); border-top: 2px solid var(--accent); border-radius: 0; }
</style></head>
<body>
  <div class="inv tpl-${tpl}">
    <div class="inv-head">
      <div class="inv-brand">
        ${logo}
        ${s.company_name ? `<div class="inv-company">${esc(s.company_name)}</div>` : ""}
      </div>
      <div class="inv-title">
        <h1>INVOICE</h1>
        <div class="inv-meta">
          ${inv.number ? `<div><span class="k">Invoice</span> <b>${esc(inv.number)}</b></div>` : ""}
          ${inv.issued_date ? `<div><span class="k">Issued</span> ${fmtDate(inv.issued_date)}</div>` : ""}
          ${inv.due_date ? `<div><span class="k">Due</span> ${fmtDate(inv.due_date)}</div>` : ""}
        </div>
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

    ${bank}
    ${s.footer_note ? `<div class="inv-note">${nl2br(s.footer_note)}</div>` : ""}

    ${smallprint ? `<div class="inv-smallprint">${smallprint}</div>` : ""}
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
