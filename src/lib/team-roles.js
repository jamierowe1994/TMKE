// Who runs what, beyond management (Dani, 9 Nov 2026).
//
// Management (Danielle and Sam; admins.is_management) do everything with money.
// Videography is run by Danielle, Sam and Jack: Jack raises, edits drafts of and
// sends a shoot's invoices, and can release a shoot before payment. Marking paid,
// voiding, reissuing, Invoicing and Revenue stay with management. Social media is
// Danielle, Sam and Abbie, and works through its own pages.
//
// Read by the Videography page and by the Worker, which enforces it.
export const VIDEOGRAPHY_INVOICERS = ["jack@tmke.co.uk"];

export const isVideographyInvoicer = (email) => VIDEOGRAPHY_INVOICERS.includes(String(email || "").trim().toLowerCase());
