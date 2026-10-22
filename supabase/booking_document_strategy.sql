-- A social media client's strategy document (Danielle, 22 Oct 2026): the
-- presentation or document behind the onboarding Strategy, uploaded from
-- the client file's onboarding checklist. Adds "strategy" to the file types
-- booking_documents accepts. Safe to re-run.

do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.booking_documents'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table public.booking_documents drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.booking_documents add constraint booking_documents_category_check
  check (category in ('agreement', 'prep', 'strategy', 'invoice', 'delivery', 'content_plan', 'insights_report', 'other')) not valid;

notify pgrst, 'reload schema';
