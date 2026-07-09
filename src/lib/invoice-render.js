// Renders a TMKE invoice to a standalone HTML document from (settings + invoice).
// Two brand-led styles matched to the client's Canva mockups:
//   • editorial — warm paper, big bold wordmark, oversized TOTAL, thick rule (temp1)
//   • banded    — wine header band + paper body + beige footer band (temp2)
//   • minimal   — an extra airy/hairline variant
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
  const tpl = ["editorial", "banded", "minimal", "classic", "modern"].includes(s.template) ? s.template : "editorial";
  // Back-compat with the old keys.
  const style = tpl === "classic" ? "editorial" : tpl === "modern" ? "banded" : tpl;
  const font = s.font_family || "Arial, Helvetica, sans-serif";
  const fs = Number(s.font_size) || 13;
  const showBank = s.show_bank !== false;
  const items = Array.isArray(inv.line_items) ? inv.line_items : [];
  const vatRate = s.vat_rate != null ? s.vat_rate : 20;
  const company = (s.company_name || "The Marketing Experts").toUpperCase();

  const wordmark = s.logo_url
    ? `<img class="logo" src="${esc(s.logo_url)}" alt="${esc(s.company_name || "")}" />`
    : `<div class="wordmark">TMKE</div>`;

  const rows = items.length ? items.map((it) => {
    const qty = it.qty == null ? 1 : it.qty;
    return `<tr><td class="desc">${nl2br(it.description)}</td><td class="num">${money((it.unit_pence || 0) * qty)}</td></tr>`;
  }).join("") : `<tr><td class="desc" style="color:#a99">Description</td><td class="num">£0.00</td></tr>`;

  const dateBlock = `
    <div class="d"><span class="k">Invoice date</span><b>${fmtDate(inv.issued_date) || "—"}</b></div>
    <div class="d"><span class="k">Due date</span><b>${fmtDate(inv.due_date) || "—"}</b></div>`;

  // Header — banded is a wine block; editorial/minimal are on the paper.
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
        <div class="hl"><span class="company">${esc(company)}</span><span class="no">INVOICE NO. <b>${esc(inv.number || "")}</b></span></div>
        <div class="dates">${dateBlock}</div>
      </div>
    </header>`;

  const billto = inv.bill_to_name ? `
    <div class="billto"><span class="lbl">Bill to</span> <span class="who">${esc(inv.bill_to_name)}${inv.bill_to_email ? ` · ${esc(inv.bill_to_email)}` : ""}</span></div>` : "";

  const bank = showBank && (s.account_name || s.account_number) ? `
    <div class="pay">
      <div class="lbl">How to pay</div>
      <div class="pl">By bank transfer within <strong>${esc(s.payment_terms_days ?? 7)} days</strong>${inv.number ? `, quoting <strong>${esc(inv.number)}</strong>` : ""}.</div>
      <div class="bank">${[s.account_name && `Account: ${esc(s.account_name)}`, s.sort_code && `Sort code: ${esc(s.sort_code)}`, s.account_number && `Account no: ${esc(s.account_number)}`].filter(Boolean).join("<br>")}</div>
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
  body { margin: 0; background: #cfccc8; font-family: ${font}; color: #2a1b22; -webkit-font-smoothing: antialiased; }
  .inv { --accent:${esc(accent)}; --paper:#f1efec; --beige:#d6cdc7; width:794px; min-height:1123px; max-width:100%; margin:24px auto; background:var(--paper); box-shadow:0 10px 34px rgba(20,18,26,0.18); display:flex; flex-direction:column; font-size:${fs}px; color:var(--accent); }
  .body { padding:0 64px; flex:1; display:flex; flex-direction:column; }
  .logo { max-height:70px; max-width:280px; display:block; }
  .lbl { font-weight:700; letter-spacing:0.1em; text-transform:uppercase; }

  /* Line-item table */
  table.tbl { width:100%; border-collapse:collapse; margin-top:8px; }
  .tbl thead th { text-align:left; font-size:14px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; padding:0 0 10px; border-bottom:2.5px solid var(--accent); }
  .tbl thead th.num { text-align:right; }
  .tbl td { padding:12px 0; font-size:15px; }
  .tbl td.num { text-align:right; white-space:nowrap; }

  /* Totals */
  .totals { margin-top:40px; }
  .totals .r { display:flex; justify-content:space-between; font-size:18px; padding:6px 0; }
  .totals .grand { margin-top:6px; display:flex; justify-content:space-between; align-items:baseline; font-size:40px; font-weight:800; letter-spacing:-0.01em; }

  .pay { margin-top:46px; font-size:14px; line-height:1.7; }
  .pay .lbl { font-size:13px; margin-bottom:8px; }
  .pay .bank { margin-top:10px; }
  .note { margin-top:16px; font-style:italic; opacity:0.7; font-size:13px; }
  .billto { margin:34px 0 4px; font-size:13px; }
  .billto .lbl { color:var(--accent); }

  .smallprint { margin-top:auto; font-size:11px; letter-spacing:0.02em; opacity:0.75; text-align:center; padding:40px 64px 40px; }

  /* ---- EDITORIAL (temp1): paper, big bold wordmark, oversized total ---- */
  .plain { padding:64px 64px 0; }
  .wordmark { font-weight:800; font-size:64px; letter-spacing:-0.01em; line-height:0.9; color:var(--accent); }
  .plain .headrow { display:flex; justify-content:space-between; align-items:flex-start; margin-top:26px; }
  .plain .hl { display:flex; gap:48px; align-items:baseline; }
  .plain .company, .plain .no { font-size:14px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; }
  .plain .dates { text-align:right; display:flex; flex-direction:column; gap:12px; }
  .plain .dates .k { display:block; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; }
  .plain .dates b { font-size:14px; }
  .plain + .body { padding-top:64px; }

  /* ---- BANDED (temp2): wine header band + beige footer band ---- */
  .band { background:var(--accent); color:var(--paper); padding:48px 64px 44px; display:flex; justify-content:space-between; align-items:flex-start; gap:24px; }
  .band .wordmark { font-family:Georgia,'Times New Roman',serif; font-weight:500; letter-spacing:0.1em; color:var(--paper); }
  .band .company { margin-top:12px; font-size:14px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; }
  .band .meta-r { text-align:right; align-self:center; line-height:1.9; }
  .band .meta-r .no { font-size:16px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; margin-bottom:4px; }
  .band .meta-r .d { font-size:13.5px; }
  .band .meta-r .k { text-transform:uppercase; letter-spacing:0.04em; }
  .band + .body { padding-top:52px; }
  .smallprint.band { margin-top:auto; text-align:left; opacity:1; background:var(--beige); color:var(--accent); font-weight:700; font-size:11.5px; line-height:1.7; padding:26px 64px; }

  /* ---- MINIMAL: airier, hairlines ---- */
  .tpl-minimal .plain .wordmark, .tpl-minimal .wordmark { font-weight:500; letter-spacing:0.2em; font-size:40px; }
  .tpl-minimal .tbl thead th { border-bottom:1px solid var(--accent); }
  .tpl-minimal .totals .grand { font-weight:600; }
</style></head>
<body>
  <div class="inv tpl-${style}">
    ${header}
    <div class="body">
      ${billto}
      <table class="tbl">
        <thead><tr><th class="desc">Description</th><th class="num">Price</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div class="r"><span>Sub-total</span><span>${money(inv.subtotal_pence)}</span></div>
        <div class="r"><span>VAT (${esc(vatRate)}%)</span><span>${money(inv.vat_pence)}</span></div>
        <div class="grand"><span>TOTAL</span><span>${money(inv.total_pence)}</span></div>
      </div>
      ${bank}
      ${s.footer_note ? `<div class="note">${nl2br(s.footer_note)}</div>` : ""}
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
    bill_to_email: "accounts@fineandcountry-example.com",
    line_items: [
      { description: "Property Videography — Half Day", qty: 1, unit_pence: 32500 },
      { description: "Local area video tour", qty: 1, unit_pence: 10000 },
    ],
    subtotal_pence: 42500, vat_pence: 8500, total_pence: 51000,
  };
}
