-- Client portals: email someone when a folder is added (Dani, 4 Nov 2026).
-- First for the TEG new-starter portal: Michelle gets an email each time a new
-- starter's folder goes in, and the TEG sheet gets the link.
--   notify_email      who is emailed; empty = nobody
--   notified_folders  folders they've already been told about
-- Safe to run more than once.
alter table public.client_portals add column if not exists notify_email text;
alter table public.client_portals add column if not exists notified_folders text[] not null default '{}';
-- Portals that existed before this count everything they hold as told.
update public.client_portals set notified_folders = folders
 where notify_email is null and notified_folders = '{}' and folders <> '{}';

-- A passcode you choose (Dani, 4 Nov: "TEG" for the TEG portal): 3 to 12
-- capital letters or numbers. Made ones are still six.
alter table public.client_portals drop constraint if exists client_portals_passcode_check;
alter table public.client_portals add constraint client_portals_passcode_check check (passcode ~ '^[A-Z0-9]{3,12}$');
