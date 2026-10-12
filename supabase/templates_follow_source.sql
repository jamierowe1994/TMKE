-- TMKE — Demo pack templates follow their originals
--
-- "Add to demo pack" used to COPY a template into the Demo pack: a new row
-- holding the original's design as it was at that moment, linked to nothing.
-- Change the original afterwards and the Demo pack never heard about it. On
-- 12 Oct 2026 Testimonial 3's quotation mark was redrawn as a colourable shape
-- in The Proof Is in the Posts, and the Demo pack went on showing the old
-- picture, because its Testimonial 3 was a separate copy made on 10 Oct.
--
-- Now a Demo pack template records the original it FOLLOWS (source_id), and
-- whenever an original is saved -- publishing, Regenerate previews, any route
-- at all -- every template that follows it takes the same design, thumbnail
-- and name. In the database, so no page that writes a template can forget.
--
-- Run in the Supabase SQL editor, after template_versions.sql. Safe to
-- re-run. The last statement is a check: it is the result the editor shows.

alter table public.templates add column if not exists source_id text;
create index if not exists templates_source_id_idx on public.templates (source_id);

create or replace function public.templates_follow_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A follower being brought up to date is itself an update; do not let it
  -- go looking for followers of its own.
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  -- Nothing a follower shows has changed (a reorder, a status flip): leave
  -- the followers alone.
  if old.canvas is not distinct from new.canvas
     and old.elements is not distinct from new.elements
     and old.pages is not distinct from new.pages
     and old.name is not distinct from new.name
     and old.thumb_url is not distinct from new.thumb_url
     and old.render_url is not distinct from new.render_url
     and old.size_variants is not distinct from new.size_variants then
    return new;
  end if;
  update public.templates t
     set name          = new.name,
         category      = new.category,
         kind          = new.kind,
         canvas        = new.canvas,
         elements      = new.elements,
         pages         = new.pages,
         size_variants = new.size_variants,
         thumb_url     = new.thumb_url,
         render_url    = new.render_url,
         block_box     = new.block_box,
         block_variant = new.block_variant,
         updated_at    = now()
   where t.source_id = new.id
     and t.id <> new.id;
  return new;
end;
$$;

drop trigger if exists templates_follow_source on public.templates;
create trigger templates_follow_source
  after update on public.templates
  for each row execute function public.templates_follow_source();

-- ============================================================
-- The three Demo pack templates that exist today, linked to their originals.
-- Matched by id AND name, so a wrong id cannot link the wrong design.
-- ============================================================
update public.templates d
   set source_id = o.id
  from public.templates o
 where (d.id, o.id) in (
         ('tmpl-h5bddk', 'tmpl-50bdg0'),   -- Testimonial 3 - Service - Static      <- The Proof Is in the Posts
         ('tmpl-6k5m05', 'tmpl-hi69m6'),   -- New to Market 1 - Property - Static   <- The Property Pack
         ('tmpl-geg1ru', 'tmpl-b9lg8p')    -- Plans for a Rainy Sunday - Autumn     <- The Autumn Edit
       )
   and lower(trim(d.name)) = lower(trim(o.name));

-- And brought up to date now, rather than at the original's next save.
update public.templates d
   set name          = o.name,
       category      = o.category,
       kind          = o.kind,
       canvas        = o.canvas,
       elements      = o.elements,
       pages         = o.pages,
       size_variants = o.size_variants,
       thumb_url     = o.thumb_url,
       render_url    = o.render_url,
       block_box     = o.block_box,
       block_variant = o.block_variant,
       updated_at    = now()
  from public.templates o
 where d.source_id = o.id;

-- ============================================================
-- The check. One row per Demo pack template: what it follows, and whether it
-- now matches its original. Plus whether version history is switched on.
-- Every row should say linked = true and in_step = true.
-- ============================================================
select d.name,
       d.id                                   as demo_template,
       d.source_id                            as follows,
       op.title                               as original_pack,
       d.source_id is not null                as linked,
       (d.elements is not distinct from o.elements
        and d.pages is not distinct from o.pages
        and d.canvas is not distinct from o.canvas) as in_step,
       exists (select 1 from pg_trigger where tgname = 'templates_snapshot_version') as version_history_on,
       exists (select 1 from pg_trigger where tgname = 'templates_follow_source')    as follow_trigger_on
  from public.templates d
  join public.packs dp on dp.id = d.pack_id and dp.demo = true
  left join public.templates o on o.id = d.source_id
  left join public.packs op on op.id = o.pack_id
 order by d.sort_order;
