-- A picture of every page of a design (Dani, 25 Oct). A template kept one
-- picture, page one's (thumb_url / render_url), and print kept page two's
-- (back_thumb_url). A design with four mockups on four pages could only offer
-- its first to a pack's gallery. Regenerate previews in the Studio now draws
-- every page of a design with two or more and keeps them here, in order:
--   [{ "thumb": "<url>", "render": "<url>" }, ...]
-- The pack gallery and cover pickers, and the Studio's Your templates, offer
-- each page. Ready for carousels too. Safe to run more than once.

alter table public.templates
  add column if not exists page_images jsonb not null default '[]'::jsonb;

comment on column public.templates.page_images is
  'One picture per page, in page order, from Regenerate previews: [{thumb, render}]. Empty for a one-page design.';

select count(*) as templates, count(*) filter (where jsonb_array_length(page_images) > 0) as with_page_images
  from public.templates;
