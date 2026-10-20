-- File types a booking or client file can hold (Danielle, 20 Oct 2026).
--
-- booking_documents was created allowing only agreement, prep, invoice,
-- delivery and other. The social media reports since added "content_plan"
-- (the PDF behind Content coming up) and "insights_report", and the database
-- refused them: the upload failed with "Couldn't save the record". This
-- allows both. Safe to re-run.

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
  check (category in ('agreement', 'prep', 'invoice', 'delivery', 'content_plan', 'insights_report', 'other')) not valid;

notify pgrst, 'reload schema';
