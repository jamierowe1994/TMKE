-- Videography notes on a social media client (Danielle, 27 Oct 2026).
--
-- A note thread in the client file's Videography tab, under the shoots, for
-- Jack and Abbie. Every shoot booked for the client shows the notes that
-- aren't done in its own Notes tab, so the brief travels with each shoot.
-- Marking a note done takes it off the shoots from then on; it stays in the
-- client file, greyed, and can be reopened.
--
-- Staff only. Safe to re-run.

create table if not exists public.smm_video_notes (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.smm_leads(id) on delete cascade,
  body        text not null,
  created_by  text,
  created_at  timestamptz not null default now(),
  done_at     timestamptz,
  done_by     text
);
create index if not exists smm_video_notes_lead on public.smm_video_notes (lead_id, created_at desc);

alter table public.smm_video_notes enable row level security;
drop policy if exists "smm_video_notes admin" on public.smm_video_notes;
create policy "smm_video_notes admin" on public.smm_video_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
