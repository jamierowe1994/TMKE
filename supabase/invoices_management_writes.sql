-- ============================================================================
-- Invoices: every admin can read them, only management can change them
-- (Danielle, 28 Oct 2026).
--
-- Abbie, Jack and Angel see the invoices for their own social media clients
-- and shoots, open them and resend a sent one, but don't raise, edit, void or
-- mark them paid, and the Invoicing and Payments pages are hidden from them.
-- The Worker enforces that for every invoice route; this closes the database
-- itself, so nobody signed in as an ordinary admin can write to an invoice
-- directly either. The Worker uses the service role, so it isn't affected.
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- ============================================================================

drop policy if exists "invoices admin" on public.invoices;
drop policy if exists "invoices admin read" on public.invoices;
drop policy if exists "invoices management write" on public.invoices;

create policy "invoices admin read"
  on public.invoices for select to authenticated
  using (public.is_admin());

create policy "invoices management write"
  on public.invoices for all to authenticated
  using (public.is_management()) with check (public.is_management());
