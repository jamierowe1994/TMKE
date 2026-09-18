-- Which email in a funnel an event belongs to.
--
-- email_events already knows the funnel (automation_id). A funnel sends several
-- emails, and the campaign insights report each one separately - sent,
-- delivered, opened, clicked, unsubscribed - so each event also records the
-- send step (the node id in the funnel's graph) it came from.
--
-- Safe to run more than once. Until it has run, the Worker records events
-- without the step and the insights fall back to grouping by subject line.

alter table public.email_events add column if not exists node_id text;

create index if not exists email_events_automation_node_idx
  on public.email_events (automation_id, node_id);
