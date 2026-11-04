-- Videography: every booking's service from one list (Dani, 4 Nov 2026).
-- The admin form now chooses the service instead of typing it
-- (src/data/videography-services.js). This renames the bookings made before,
-- by the same matching as guessService() there, and shows what changed.
--   · Only real bookings: not discovery calls, brochures or interest forms.
--   · A name that changes more than its capitals is kept in the notes
--     ("Service was typed as: …"), so nothing anyone wrote is lost.
--   · A booking with no service type gets the one its service implies.
--   · No confident match (e.g. "Shoot", "TPE"): left exactly as typed.
-- Safe to run twice: the second run finds nothing to change.
with src as (
  select id, service as was, service_type as type_was, notes,
    case
      when service ~* '(new.?starter|induction)' and service ~* 'location' then 'New-starter on location'
      when service ~* '(new.?starter|induction)'                           then 'New-starter Studio Day'
      when service ~* '(shot\s*[&*+]?\s*(and\s*)?scheduled|s\s*&\s*s\M)'    then 'Shot & Scheduled shoot'
      when service ~* '(event coverage|bootcamp|implementer day|success day)' then 'Event coverage'
      when service ~* '^\s*photography'                                    then 'Photography'
      when service ~* '(^(the )?studio\M|content studio|studio day|studio, filming)' then 'Content Studio Day'
      when service ~* '(\mprop(erty)?\M.*(video|videography|package|shoot)|^plat prop|^property videography$)' then 'Property video'
      when service ~* '^agent\s*/\s*location shoots?$'                     then 'Agent shoot on location'
    end as now
  from public.videography_bookings
  where coalesce(kind, 'booking') = 'booking'
    and coalesce(service_type, '') <> 'discovery'
    and service is not null
),
todo as (
  select * from src where now is not null and now <> was
),
done as (
  update public.videography_bookings b
     set service = t.now,
         service_type = coalesce(b.service_type, case t.now
           when 'New-starter Studio Day'  then 'content-studio'
           when 'New-starter on location' then 'agent'
           when 'Content Studio Day'      then 'content-studio'
           when 'Property video'          then 'property'
           when 'Agent shoot on location' then 'agent'
           when 'Photography'             then 'photography' end),
         notes = case when lower(t.was) = lower(t.now) then b.notes
                      else concat_ws(E'\n', nullif(btrim(b.notes), ''), 'Service was typed as: ' || t.was) end
    from todo t
   where b.id = t.id
  returning b.client_name, t.was, b.service as now, b.shoot_date
)
select client_name as "Client", was as "Was", now as "Now", to_char(shoot_date, 'DD Mon YYYY') as "Shoot"
  from done order by now, shoot_date;
