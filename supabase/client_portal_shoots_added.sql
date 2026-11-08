-- Last updated on the Creative Studio portal cards (Danielle, 8 Nov 2026): the
-- last time a shoot was added to a portal, whoever or whatever added it (a
-- person ticking a folder, a shoot's picker, or the 8am new-starter job).
-- Taking a shoot out doesn't count. Safe to run twice.

alter table public.client_portals add column if not exists shoots_added_at timestamptz;

create or replace function public.client_portals_stamp_shoots_added()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(array_length(new.folders, 1), 0) > 0 then new.shoots_added_at := now(); end if;
  elsif exists (select 1 from unnest(new.folders) f where not (f = any(coalesce(old.folders, '{}')))) then
    new.shoots_added_at := now();
  end if;
  return new;
end $$;

drop trigger if exists client_portals_shoots_added on public.client_portals;
create trigger client_portals_shoots_added
  before insert or update of folders on public.client_portals
  for each row execute function public.client_portals_stamp_shoots_added();
