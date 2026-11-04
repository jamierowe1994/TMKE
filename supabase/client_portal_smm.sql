-- Client portals for social media clients (Dani, 4 Nov 2026).
-- A shoot booked for a social media client goes into that client's portal
-- from the start; the portal is made automatically if they haven't got one,
-- emails their social media manager, and shows the folder once Jack presses
-- "Content ready". This column ties a portal to its client.
-- (Not "smm_lead_id": client_portal.sql treats that name as an old layout to
-- migrate away from, so re-running it would undo this.)
-- Safe to run more than once.
alter table public.client_portals
  add column if not exists smm_client_id uuid references public.smm_leads (id) on delete set null;
create unique index if not exists client_portals_smm_client_idx
  on public.client_portals (smm_client_id) where smm_client_id is not null;
