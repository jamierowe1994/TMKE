// ============================================================================
// The Email section's shared rules (Danielle, 25 Nov 2026; agreed on the
// "TMKE OS Email" mock-up). One table, `automations`, feeds two pages:
//
//   Campaigns   (/admin/email/campaigns)  marketing funnels: more than one
//               email, planned and sent to a group.
//   One-off sends (/admin/email/sends)    one email to one group, now or at a
//               set time (graph.meta.single, or an older marketing funnel
//               that is nothing but one send to a group or chosen people).
//   Automations (/admin/automations)      system workflows: emails that send
//               themselves when something happens. Nobody presses send.
//
// Which page a row is on is the builder's own Marketing / Service answer
// (graph.meta.kind). The area of the business a campaign is about is
// graph.meta.area. Nothing here writes to the database.
// ============================================================================

// Danielle's list, 25 Nov 2026. Change it here and every picker follows.
export const AREAS = ["The Edit", "The Studio", "Content Calendar", "Videography", "Social media management", "TMKE news"];

// Marketing vs system: the funnel-level answer from the builder, falling back
// to "any send step flagged marketing" for funnels saved before the setup
// questions existed.
export function kindOf(a) {
  const meta = a && a.graph && a.graph.meta;
  if (meta && meta.kind === "marketing") return "marketing";
  const nodes = (a && a.graph && a.graph.nodes) || [];
  return nodes.some((n) => n.type === "send_email" && n.config && n.config.send_kind === "marketing") ? "marketing" : "system";
}

// One email, one group: made by New send (graph.meta.single), or an older
// marketing funnel that is only a trigger and one send, started from a group
// of tags or from chosen contacts.
export function isSingle(a) {
  const g = (a && a.graph) || {};
  if (g.meta && g.meta.single === true) return true;
  if (g.meta && g.meta.campaign === true) return false;   // planned as a campaign, however many emails
  if (kindOf(a) !== "marketing") return false;
  const nodes = (g.nodes || []).filter((n) => n.type !== "trigger");
  return nodes.length === 1 && nodes[0].type === "send_email" && (a.trigger_type === "manual" || a.trigger_type === "audience");
}

// A campaign: planned as one on the campaign page (graph.meta.campaign, which
// can be a service message too), or any marketing funnel that isn't a one-off.
export function isCampaign(a) {
  const m = a && a.graph && a.graph.meta;
  if (m && m.single === true) return false;
  return !!(m && m.campaign === true) || (kindOf(a) === "marketing" && !isSingle(a));
}

export function areaOf(a) {
  const v = a && a.graph && a.graph.meta && a.graph.meta.area;
  return AREAS.includes(v) ? v : "";
}

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
export const todayLondon = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

// The send steps in the order people meet them: walk the graph from the
// trigger (the "next"/yes branch before the no branch), then anything the walk
// missed. Dated emails are put in date order, since that is the order they go.
export function sendSteps(a) {
  const g = (a && a.graph) || {};
  const nodes = g.nodes || [];
  const edges = g.edges || [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set();
  const out = [];
  const walk = (id) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const n = byId.get(id);
    if (!n) return;
    if (n.type === "send_email") out.push(n);
    edges.filter((e) => e.from === id)
      .sort((x, y) => (((x.branch || "next") === "no") ? 1 : 0) - (((y.branch || "next") === "no") ? 1 : 0))
      .forEach((e) => walk(e.to));
  };
  walk("trigger");
  nodes.forEach((n) => { if (n.type === "send_email" && !seen.has(n.id)) out.push(n); });
  const dated = out.length > 0 && out.every((n) => isDate(n.config && n.config.send_on));
  if (dated) out.sort((x, y) => `${x.config.send_on} ${x.config.send_at || ""}`.localeCompare(`${y.config.send_on} ${y.config.send_at || ""}`));
  return out;
}

// Has this step got an email to send? A template step with no template chosen
// is "not written yet".
export function isWritten(n) {
  const c = (n && n.config) || {};
  if (c.body_mode === "template") return !!c.template_id;
  return !!(c.template_id || String(c.note || "").trim() || String(c.subject || "").trim());
}

// The campaign has dated emails and every one of those dates has passed. An
// undated first email (sent the moment the campaign started, as The Autumn
// Edit's was) doesn't keep it open: the dated ones are what make it a run with
// an end.
export function allDatesPassed(a) {
  const dated = sendSteps(a).filter((n) => isDate(n.config && n.config.send_on));
  if (!dated.length) return false;
  const today = todayLondon();
  return dated.every((n) => n.config.send_on < today);
}

// A campaign is "previous" once it is archived, or once it is live with every
// dated email behind it and nobody left inside. A funnel with no dates at all
// (wait three days, then send) stays active for as long as it is switched on,
// because the next person to join still gets it.
export function isPrevious(a, liveCount) {
  if (a.status === "archived") return true;
  return a.status === "active" && !liveCount && allDatesPassed(a);
}

// "Thu 26 Nov, 07:00" for a dated step.
export function stepWhen(n) {
  const c = (n && n.config) || {};
  if (!isDate(c.send_on)) return "";
  const d = new Date(`${c.send_on}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return c.send_at ? `${d}, ${c.send_at}` : d;
}

// Who a funnel goes to, in a few words, from its trigger.
export function audienceLine(a, triggerLabels) {
  const t = a.trigger_type;
  const cfg = a.trigger_config || {};
  const tags = Array.isArray(cfg.tags) ? cfg.tags.filter(Boolean) : (cfg.tag ? [cfg.tag] : []);
  if (t === "audience") return tags.length ? `Everyone tagged ${tags.join(" or ")}` : "A group, by tag (no tags chosen yet)";
  if (t === "manual") { const n = Array.isArray(cfg.contacts) ? cfg.contacts.length : 0; return n ? `${n} chosen ${n === 1 ? "contact" : "contacts"}` : "Chosen contacts"; }
  if (t === "tag_added" || t === "tag_removed") return `${t === "tag_added" ? "Anyone given the tag" : "Anyone who loses the tag"}${tags.length ? " " + tags.join(" or ") : ""}`;
  return (triggerLabels && triggerLabels[t]) || "Not set up yet";
}

// Who a one-off send goes to. New send keeps the tags it was aimed at in
// graph.meta.to, because the people themselves are enrolled by hand (so nobody
// who gains the tag afterwards is sent an old email).
export function sentToLine(a, triggerLabels) {
  const to = a && a.graph && a.graph.meta && a.graph.meta.to;
  if (to && to.mode === "tags" && Array.isArray(to.tags) && to.tags.length) return `Everyone tagged ${to.tags.join(" or ")}`;
  if (to && to.mode === "contacts") return "Chosen contacts";
  return audienceLine(a, triggerLabels);
}
