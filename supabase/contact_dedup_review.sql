-- ============================================================================
-- Contact de-dup precaution.
-- Previously one contact per email (email unique) and the name was overwritten
-- by whatever arrived last. Now: the same email with a NON-matching name lands
-- as a SEPARATE contact, and both sides are flagged for review — a human can
-- then Merge them (nothing is lost) or dismiss the flag if they're genuinely
-- different people who share an inbox.
--
-- Names "match" if the first names OR the surnames overlap (prefix, case-
-- insensitive) — so "Danielle Law" and "Dani Law" still merge onto one contact.
-- If either side has no name at all, we can't tell → treat as the same (merge).
--
-- Run AFTER supabase/contact_tag_rules.sql. Safe to re-run.
-- ============================================================================

-- 1) Review columns ----------------------------------------------------------
alter table public.contacts add column if not exists needs_review  boolean not null default false;
alter table public.contacts add column if not exists review_reason text;

-- 2) Relax the one-per-email rule; keep a fast (non-unique) lookup index ------
-- Drop ANY unique constraint that covers the email column (name may vary).
do $$
declare r record;
begin
  for r in
    select con.conname
      from pg_constraint con
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any(con.conkey)
     where con.conrelid = 'public.contacts'::regclass and con.contype = 'u' and a.attname = 'email'
  loop execute format('alter table public.contacts drop constraint %I', r.conname); end loop;
end $$;
-- Drop any remaining UNIQUE index on email (not the primary key).
do $$
declare r record;
begin
  for r in
    select c.relname as iname
      from pg_index i
      join pg_class c on c.oid = i.indexrelid
     where i.indrelid = 'public.contacts'::regclass and i.indisunique and not i.indisprimary
       and pg_get_indexdef(i.indexrelid) ilike '%(email%'
  loop execute format('drop index if exists public.%I', r.iname); end loop;
end $$;
create index if not exists contacts_email_idx on public.contacts (lower(email));

-- 3) Name-overlap test -------------------------------------------------------
create or replace function public.name_overlap(a_first text, a_last text, b_first text, b_last text)
returns boolean language plpgsql immutable as $$
declare
  af text := lower(btrim(coalesce(a_first, '')));
  al text := lower(btrim(coalesce(a_last,  '')));
  bf text := lower(btrim(coalesce(b_first, '')));
  bl text := lower(btrim(coalesce(b_last,  '')));
  first_ov boolean := false;
  last_ov  boolean := false;
begin
  -- Can't compare (one side unnamed) → don't split.
  if not ((af <> '' or al <> '') and (bf <> '' or bl <> '')) then return true; end if;
  if af <> '' and bf <> '' then first_ov := starts_with(af, bf) or starts_with(bf, af); end if;
  if al <> '' and bl <> '' then last_ov  := starts_with(al, bl) or starts_with(bl, al); end if;
  return first_ov or last_ov;
end; $$;

-- 4) Name-aware upsert -------------------------------------------------------
create or replace function public.upsert_contact(
  p_email            text,
  p_first_name       text default null,
  p_last_name        text default null,
  p_phone            text default null,
  p_company          text default null,
  p_source           text default null,
  p_lifecycle        text default null,
  p_marketing_opt_in boolean default null,
  p_tags             text[] default null,
  p_user_id          uuid default null
) returns uuid
language plpgsql security definer as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
  v_match uuid;
  v_email_exists boolean;
  v_reason text := 'Same email as another contact with a different name — review';
begin
  if v_email = '' then return null; end if;

  -- Prefer an existing same-email contact whose name overlaps the incoming one.
  select id into v_match from public.contacts
   where lower(email) = v_email
     and public.name_overlap(first_name, last_name, p_first_name, p_last_name)
   order by created_at asc
   limit 1;

  if v_match is not null then
    update public.contacts set
      first_name       = coalesce(p_first_name, first_name),
      last_name        = coalesce(p_last_name,  last_name),
      phone            = coalesce(p_phone,      phone),
      company          = coalesce(p_company,    company),
      user_id          = coalesce(p_user_id,    user_id),
      lifecycle        = coalesce(p_lifecycle,  lifecycle),
      marketing_opt_in = marketing_opt_in or coalesce(p_marketing_opt_in, false),
      tags             = public.normalize_contact_tags(tags || coalesce(p_tags, '{}')),
      last_seen_at     = now()
     where id = v_match
     returning id into v_id;
    return v_id;
  end if;

  -- No name match. Is the email already used (by a different name)?
  select exists(select 1 from public.contacts where lower(email) = v_email) into v_email_exists;

  insert into public.contacts (email, first_name, last_name, phone, company, source, user_id,
    lifecycle, marketing_opt_in, tags, needs_review, review_reason, last_seen_at)
  values (v_email, p_first_name, p_last_name, p_phone, p_company, p_source, p_user_id,
    coalesce(p_lifecycle, 'lead'), coalesce(p_marketing_opt_in, false),
    public.normalize_contact_tags(coalesce(p_tags, '{}')),
    v_email_exists, case when v_email_exists then v_reason else null end, now())
  returning id into v_id;

  -- Flag the other same-email contact(s) too, so both sides surface for review.
  if v_email_exists then
    update public.contacts set needs_review = true, review_reason = coalesce(review_reason, v_reason)
     where lower(email) = v_email and id <> v_id;
  end if;

  return v_id;
end; $$;

-- 5) Merge two contacts (reviewer action) ------------------------------------
-- Repoints child records onto the survivor, unions tags, fills blank fields,
-- then deletes the other. Admin-only.
create or replace function public.merge_contacts(p_keep uuid, p_drop uuid)
returns void language plpgsql security definer as $$
declare k_email text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_keep is null or p_drop is null or p_keep = p_drop then return; end if;

  update public.contact_notes set contact_id = p_keep where contact_id = p_drop;
  update public.contact_tasks set contact_id = p_keep where contact_id = p_drop;

  begin update public.automation_runs set contact_id = p_keep where contact_id = p_drop; exception when undefined_table then null; end;

  -- Enrolments: drop any of the survivor-conflicting live ones, then repoint the rest.
  begin
    delete from public.automation_enrollments e
     where e.contact_id = p_drop and e.status in ('active','waiting')
       and exists (select 1 from public.automation_enrollments k
                    where k.contact_id = p_keep and k.automation_id = e.automation_id and k.status in ('active','waiting'));
    update public.automation_enrollments set contact_id = p_keep where contact_id = p_drop;
  exception when undefined_table then null; end;

  -- agent_profiles: one row per contact (PK contact_id). Move only if the survivor has none.
  begin
    if not exists (select 1 from public.agent_profiles where contact_id = p_keep) then
      update public.agent_profiles set contact_id = p_keep where contact_id = p_drop;
    else
      delete from public.agent_profiles where contact_id = p_drop;
    end if;
  exception when undefined_table then null; end;

  -- Fold the dropped contact's data into the survivor (fill blanks, union tags).
  update public.contacts k set
    first_name       = coalesce(k.first_name, d.first_name),
    last_name        = coalesce(k.last_name,  d.last_name),
    phone            = coalesce(k.phone,      d.phone),
    company          = coalesce(k.company,    d.company),
    user_id          = coalesce(k.user_id,    d.user_id),
    marketing_opt_in = k.marketing_opt_in or d.marketing_opt_in,
    tags             = public.normalize_contact_tags(k.tags || d.tags),
    last_seen_at     = greatest(k.last_seen_at, d.last_seen_at)
  from public.contacts d
  where k.id = p_keep and d.id = p_drop;

  select lower(email) into k_email from public.contacts where id = p_keep;
  delete from public.contacts where id = p_drop;

  -- Clear the review flag on the survivor only if no other same-email dup remains.
  if exists (select 1 from public.contacts where lower(email) = k_email and id <> p_keep) then
    update public.contacts set needs_review = true where id = p_keep;
  else
    update public.contacts set needs_review = false, review_reason = null where id = p_keep;
  end if;
end; $$;

grant execute on function public.merge_contacts(uuid, uuid) to authenticated;
grant execute on function public.name_overlap(text, text, text, text) to authenticated;
