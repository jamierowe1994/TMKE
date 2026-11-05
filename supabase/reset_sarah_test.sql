-- One-off (Danielle, 5 Nov 2026): put the Sarah Test social media card back to
-- a fresh enquiry, for walking the team through the process. Keeps who she is
-- and how she came in (name, email, phone, business, source, what she said, the
-- original "Enquiry received" note). Removes everything after that: notes,
-- emails, files, invoices (including TMKE1098 and TMKE1099), her monthly
-- invoice, stage history, package, proposal, quote, onboarding, manager,
-- meeting, platforms and channel links.
-- Only touches the card called Sarah Test with Danielle's email. Run once.

do $$
declare
  lid uuid;
  rid uuid;
  col text;
begin
  select id into lid from public.smm_leads
   where full_name ilike 'Sarah Test' and email ilike 'danielle@themarketingexperts.co.uk'
   order by created_at desc limit 1;
  if lid is null then raise exception 'Sarah Test not found'; end if;

  -- Her monthly invoice and everything hanging off it.
  for rid in select id from public.recurring_invoices where lead_id::text = lid::text loop
    delete from public.invoice_automation_log where key like 'recurring:' || rid::text || ':%';
    delete from public.invoices where recurring_id = rid;
    delete from public.recurring_invoices where id = rid;   -- ticks and monthly numbers cascade
  end loop;

  -- Every invoice raised on her file.
  delete from public.invoices where booking_id::text = lid::text;

  -- Files, notes and emails, except the original Enquiry received note.
  delete from public.booking_documents where booking_id::text = lid::text;
  delete from public.booking_messages
   where booking_id::text = lid::text
     and id not in (select id from public.booking_messages
                     where booking_id::text = lid::text and body ilike 'Enquiry received%'
                     order by created_at asc limit 1);

  -- When she reached each stage.
  delete from public.smm_stage_events where lead_id = lid;

  -- Back to a fresh enquiry. Each field is cleared only if the column exists.
  update public.smm_leads set pipeline_stage = 'inquiry' where id = lid;
  foreach col in array array[
    'meeting_at','ms_event_id','meeting_how','meeting_link',
    'package_name','price','package_details','onboarding','start_date','contracted_hours_per_month',
    'follow_up_on','follow_up_how','follow_up_by','follow_up_note',
    'lost_reason','lost_at','lost_from_stage','leaving_on','leaving_as',
    'billed_brand','social_media_manager','next_shoot_due','dd_invoice_email','direct_debit_day',
    'account_user_id','platforms',
    'instagram_url','facebook_url','linkedin_url','youtube_url','tiktok_url'
  ] loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'smm_leads' and column_name = col) then
      begin
        execute format('update public.smm_leads set %I = null where id = $1', col) using lid;
      exception when others then null;   -- a column that can't be empty keeps its value
      end;
    end if;
  end loop;
  begin update public.smm_leads set client_status = 'active' where id = lid; exception when others then null; end;
  begin update public.smm_leads set inter_brand_invoice = false where id = lid; exception when others then null; end;
  begin update public.smm_leads set direct_debit = false where id = lid; exception when others then null; end;
end $$;

-- What's left (the one result the editor shows).
select l.full_name, l.email, l.pipeline_stage, l.social_media_manager, l.package_name,
       (select count(*) from public.booking_messages m where m.booking_id::text = l.id::text) as notes_left,
       (select count(*) from public.booking_documents d where d.booking_id::text = l.id::text) as files_left,
       (select count(*) from public.invoices i where i.booking_id::text = l.id::text) as invoices_left,
       (select count(*) from public.recurring_invoices r where r.lead_id::text = l.id::text) as monthly_left
  from public.smm_leads l
 where l.full_name ilike 'Sarah Test' and l.email ilike 'danielle@themarketingexperts.co.uk';
