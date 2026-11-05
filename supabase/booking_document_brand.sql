-- A social media client's brand assets (Danielle, 5 Nov 2026): logos, fonts,
-- colours, photos, uploaded together from Onboarding and kept as one Brand
-- assets folder in Paperwork. Adds "brand" to the file types booking_documents
-- accepts. Safe to re-run.

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
  check (category in ('agreement', 'prep', 'strategy', 'brand', 'invoice', 'delivery', 'content_plan', 'insights_report', 'other')) not valid;

notify pgrst, 'reload schema';
