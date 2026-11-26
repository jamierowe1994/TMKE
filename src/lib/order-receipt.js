/* One purchase, as a receipt and as an invoice (Danielle, 26 Nov 2026).
 *
 * A purchase used to be one order for one pack. With the basket it can be
 * several orders paid for together (they share a checkout_id), and a pack can
 * be bought for less than its usual price. The thank-you page, the member's
 * receipt and the admin's Pack orders all built the same invoice by hand; they
 * build it here now, so a basket and a discount read the same on all three.
 *
 * `rows` is every order of the one purchase, the first one first: a single
 * order for a pack bought on its own, or all of a basket's.
 */
import { gbpFromPence } from './supabase.js';

/* An invoice has to match the money that moved. Orders placed since VAT was
   wired up carry their own split. Older ones carry only amount_pence, which IS
   what the card was charged, so the split is worked backwards out of it rather
   than adding VAT that was never taken. */
export function vatSplit(o) {
  if (o.total_pence != null && o.vat_pence != null) return { net: o.amount_pence || 0, vat: o.vat_pence, gross: o.total_pence };
  const gross = o.amount_pence || 0, net = Math.round(gross / 1.2);
  return { net, vat: gross - net, gross };
}

export function receiptOf(rows) {
  const list = (rows || []).filter(Boolean);
  const lines = list.map((o) => {
    const s = vatSplit(o), was = o.list_price_pence != null && o.list_price_pence > s.net ? o.list_price_pence : null;
    return { id: o.id, pack_id: o.pack_id, title: o.pack_title || 'TMKE pack', net: s.net, vat: s.vat, gross: s.gross, was, label: was ? (o.discount_label || 'Offer price') : null };
  });
  const sum = (k) => lines.reduce((n, l) => n + l[k], 0);
  const usual = lines.reduce((n, l) => n + (l.was != null ? l.was : l.net), 0);
  return { number: (list[0] && list[0].invoice_number) || '', lines, net: sum('net'), vat: sum('vat'), gross: sum('gross'), usual, saving: usual - sum('net') };
}

// The same purchase for src/lib/invoice-render.js. `head` is the order the buyer's details come from.
export function invoiceFor(rows, head) {
  const r = receiptOf(rows), o = head || rows[0] || {};
  const ymd = (iso) => { try { return new Date(iso).toISOString().slice(0, 10); } catch (_) { return ''; } };
  const issued = ymd(o.created_at);
  return {
    number: r.number,
    issued_date: issued,
    paid_date: o.status === 'paid' ? issued : null,
    status: o.status,
    payment_method: o.payment_method,
    bill_to_name: o.buyer_name || '',
    bill_to_email: o.buyer_email || '',
    bill_to_address: o.buyer_company || '',
    // A pack bought on offer says so, with its usual price, on its own line of the invoice.
    line_items: r.lines.map((l) => ({ description: l.was != null ? `${l.title} (${l.label}; usually ${gbpFromPence(l.was)})` : l.title, qty: 1, unit_pence: l.net })),
    subtotal_pence: r.net,
    vat_pence: r.vat,
    total_pence: r.gross,
  };
}
