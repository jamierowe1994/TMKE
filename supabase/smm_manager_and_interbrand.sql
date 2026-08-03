-- ============================================================
-- Two fields on a social media client: who manages them, and whether the
-- work is invoiced between brands rather than billed to the client.
--
-- Run in the Supabase SQL editor. Additive and safe to re-run.
-- ============================================================

alter table public.smm_leads
  -- Who at TMKE runs this client's social. Free text rather than a link to
  -- the admins table: managers change, people leave, and a name on a card
  -- should not break because an account was removed.
  add column if not exists social_media_manager text,

  -- Inter-brand invoice: the work is billed to another TEG brand rather than
  -- to the client. Defaults to false, which is how every existing client is
  -- billed today, so nothing changes for anyone already on the system.
  add column if not exists inter_brand_invoice boolean not null default false;

comment on column public.smm_leads.social_media_manager is
  'Who at TMKE runs this client''s social media.';
comment on column public.smm_leads.inter_brand_invoice is
  'True when this client is invoiced to another TEG brand rather than billed directly.';

-- ============================================================
-- Notes can now be edited by whoever wrote them, so record when.
-- Shown on the note as "edited", which matters in a shared thread: a colleague
-- reading it later should know the wording changed after it was written.
-- ============================================================

alter table public.booking_messages
  add column if not exists edited_at timestamptz;
