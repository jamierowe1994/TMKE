-- Ties each email event to the automation that sent it, so the funnel
-- insights can count sent/delivered/opened/clicked per automation.
-- Additive and safe to re-run. Run in the Supabase SQL editor.

alter table public.email_events
  add column if not exists automation_id uuid references public.automations(id) on delete set null,
  add column if not exists enrollment_id uuid;

create index if not exists email_events_automation_idx
  on public.email_events (automation_id, occurred_at desc)
  where automation_id is not null;
