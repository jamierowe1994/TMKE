// ============================================================================
// TMKE Marketing Automations — shared catalogue (single source of truth)
// Used by the builder UI (/admin/automations) and the Worker engine so the set
// of triggers and node types never drifts between front-end and back-end.
// ============================================================================

// What can ENROL a contact into an automation. `group` is just for the picker.
export const TRIGGERS = [
  // Audience — the send-to-a-group starting point: everyone already carrying
  // any of the chosen tags is enrolled on activation (Worker
  // /automations/enroll-audience), and anyone gaining one later joins too.
  { key: "audience", label: "A group — everyone with chosen tags", group: "Audience" },
  // Contact lifecycle
  { key: "contact_created", label: "Contact created", group: "Contact" },
  { key: "account_created", label: "Account created", group: "Contact" },
  { key: "order_placed",    label: "Order placed / pack purchased", group: "Contact" },
  { key: "tag_added",       label: "Tag added", group: "Contact" },
  { key: "tag_removed",     label: "Tag removed", group: "Contact" },
  { key: "note_added",      label: "Note added", group: "Contact" },
  { key: "task_completed",  label: "Task completed", group: "Contact" },
  { key: "dnd_set",         label: "Marked do-not-contact", group: "Contact" },
  { key: "custom_date",     label: "Custom date reminder", group: "Contact" },
  // Engagement / events
  { key: "form_submitted",  label: "Form submitted", group: "Engagement" },
  { key: "link_clicked",    label: "Trigger link clicked", group: "Engagement" },
  { key: "page_visited",    label: "Visited a page", group: "Engagement" },
  { key: "inbound_email",   label: "Inbound email received", group: "Engagement" },
  // Videography onboarding — fires when a new starter on an Academy/Pro package is
  // flagged (their free-videography code is generated). Enrols them into the funnel.
  { key: "new_starter_videography", label: "New starter — Academy/Pro (free videography)", group: "Videography" },
];

export const TRIGGER_LABELS = Object.fromEntries(TRIGGERS.map((t) => [t.key, t.label]));

// Canvas node types. `trigger` is the fixed entry node; the rest are actions /
// flow-control the marketing team drops onto the canvas. `out` declares how many
// outgoing branches a node has ("next" = 1; "yesno" = a true/false split).
export const NODE_TYPES = [
  { type: "send_email",  label: "Send email",        group: "Send",  out: "next", desc: "Send a saved Email Studio template." },
  { type: "wait",        label: "Wait / delay",      group: "Flow",  out: "next", desc: "Pause for a set time before the next step." },
  { type: "if_else",     label: "If / else",         group: "Flow",  out: "yesno", desc: "Branch on a condition (tag, opt-in, field…)." },
  { type: "add_tag",     label: "Add tag",           group: "Contact", out: "next", desc: "Tag the contact." },
  { type: "remove_tag",  label: "Remove tag",        group: "Contact", out: "next", desc: "Remove a tag from the contact." },
  { type: "add_note",    label: "Add note",          group: "Contact", out: "next", desc: "Write a note on the contact." },
  { type: "create_task", label: "Create task",       group: "Contact", out: "next", desc: "Create a task for the team (e.g. send a LinkedIn message)." },
  { type: "set_dnd",     label: "Set do-not-contact", group: "Contact", out: "next", desc: "Stop further marketing to this contact." },
  { type: "set_field",   label: "Update field",      group: "Contact", out: "next", desc: "Set a field on the contact (e.g. lifecycle)." },
  { type: "notify_team", label: "Notify the team",   group: "Send",  out: "next", desc: "Email an internal address that something happened." },
  { type: "goal",        label: "Goal / exit",       group: "Flow",  out: "next", desc: "End the journey (optionally on a goal met)." },
];

export const NODE_LABELS = Object.fromEntries(NODE_TYPES.map((n) => [n.type, n.label]));

// A fresh, empty graph: just the trigger entry node.
export function emptyGraph() {
  return { nodes: [{ id: "trigger", type: "trigger", x: 360, y: 40, config: {} }], edges: [] };
}
