// ============================================================================
// Email › Templates: emails and the templates kept from them (Danielle, 25 Nov
// 2026; agreed on the "TMKE OS Email" mock-up).
//
// Everything lives in `email_templates`. A row with is_template = true is a
// TEMPLATE: something saved on purpose for reuse, with a title (its name), an
// area of the business and a description. Every other row is an EMAIL: one
// that a campaign or a one-off send uses.
//
// Nothing becomes a template by itself. An email only goes into Templates
// when someone says so, and it goes in as a copy, so the email carries on
// unchanged. Using a template makes a copy too, so the template never changes
// under an email that has been sent.
//
// The three fields arrive with supabase/email_templates_library.sql. Until it
// has run, reads fall back to the old columns and `ready` comes back false.
// ============================================================================

const BASE = "id, name, subject, preheader, trigger_key, mode, blocks, custom_html, branding, status, updated_at";
const LIGHT = "id, name, subject, status, updated_at";
const missing = (error, col) => !!error && new RegExp(`column .*${col}`, "i").test(error.message || "");

// Every email and template, newest edit first. `light` leaves out the email's
// content, for pickers. Returns { rows, ready, folders, error }.
export async function loadEmails(supabase, { light = false } = {}) {
  const cols = light ? LIGHT : BASE;
  let ready = true, folders = true;
  let res = await supabase.from("email_templates").select(`${cols}, folder, is_template, area, description`).order("updated_at", { ascending: false });
  if (missing(res.error, "is_template|area|description")) {
    ready = false;
    res = await supabase.from("email_templates").select(`${cols}, folder`).order("updated_at", { ascending: false });
  }
  if (missing(res.error, "folder")) {
    folders = false;
    res = await supabase.from("email_templates").select(cols + (ready ? ", is_template, area, description" : "")).order("updated_at", { ascending: false });
  }
  return { rows: res.data || [], ready, folders, error: res.error || null };
}

// What an email is made of, without the things that belong to one row only.
function content(row) {
  return { subject: row.subject || "", preheader: row.preheader || null, mode: row.mode || "blocks", blocks: row.blocks || [], custom_html: row.custom_html || null, branding: row.branding || {} };
}

// Keep a copy as a template. `source` is a saved row or the editor's own
// state (the same field names). Returns { data, error, needsSql }.
export async function saveAsTemplate(supabase, source, { title, area, description }) {
  const { data, error } = await supabase.from("email_templates").insert({
    ...content(source), name: String(title || "").trim() || source.name || "Untitled template",
    trigger_key: null, status: "active", is_template: true, area: area || null, description: String(description || "").trim() || null,
  }).select().single();
  return { data, error, needsSql: missing(error, "is_template|area|description") };
}

// Change a template's title, area and description.
export async function updateTemplateDetails(supabase, id, { title, area, description }) {
  const { data, error } = await supabase.from("email_templates").update({
    name: String(title || "").trim() || "Untitled template", area: area || null, description: String(description || "").trim() || null,
  }).eq("id", id).select().single();
  return { data, error, needsSql: missing(error, "is_template|area|description") };
}

// A fresh email made from a template or from another email: a copy to work on
// or send. `status` is "active" when it is about to be sent as it is, "draft"
// when it is going to the editor first.
export async function copyAsEmail(supabase, source, { name, status = "draft" } = {}) {
  let row = source;
  if (!Array.isArray(row.blocks) && row.custom_html == null) {
    // Came from a light read: fetch the content first.
    const full = await supabase.from("email_templates").select("*").eq("id", source.id).single();
    if (full.error) return { data: null, error: full.error };
    row = full.data;
  }
  const { data, error } = await supabase.from("email_templates").insert({
    ...content(row), name: name || row.name || "Untitled email", trigger_key: null, status,
  }).select().single();
  return { data, error };
}

// Which campaigns, sends and automations use each email: Map(email id -> [names]).
export function usedIn(automations) {
  const out = new Map();
  (automations || []).forEach((a) => {
    ((a.graph && a.graph.nodes) || []).forEach((n) => {
      const id = n.type === "send_email" && n.config && n.config.template_id;
      if (!id) return;
      const list = out.get(id) || [];
      if (!list.includes(a.name)) list.push(a.name);
      out.set(id, list);
    });
  });
  return out;
}
