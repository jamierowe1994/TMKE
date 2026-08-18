-- TMKE — tie a review to the shoot it is about
-- ---------------------------------------------------------------------------
-- client_reviews was written for the public /leave-a-review page: anyone can
-- fill it in, and nothing connects a review to a job. That is still true - the
-- column below is nullable and a review left by a stranger simply has none.
--
-- What it adds is the ability to ask. A member whose shoot has been delivered
-- can be invited to review it from their own bookings page, and the invitation
-- has to disappear once they have taken it - otherwise it nags people who have
-- already done the thing, which is worse than never asking.
--
-- The member needs to read one fact: has this booking of mine been reviewed.
-- The select policy gives them exactly the rows hanging off a booking they can
-- already see, and nothing else. Admins keep the full read they had.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.client_reviews
  add column if not exists booking_id uuid references public.videography_bookings(id) on delete set null;

create index if not exists client_reviews_booking_idx
  on public.client_reviews (booking_id);

comment on column public.client_reviews.booking_id is
  'The shoot this review is about, when it was left from the member hub. Null for reviews left through the public page, which is most of them.';

-- ---- Reads --------------------------------------------------------------
-- The old policy was `to authenticated` with no test, which since members got
-- accounts has meant any signed-in member could read every review on file.
drop policy if exists "client_reviews read authed" on public.client_reviews;
drop policy if exists "client_reviews read own"    on public.client_reviews;

create policy "client_reviews read own"
  on public.client_reviews for select
  to authenticated
  using (
    public.is_admin()
    or (
      booking_id is not null
      and exists (
        select 1 from public.videography_bookings b
        where b.id = client_reviews.booking_id
          and (
            b.account_user_id = auth.uid()
            or lower(b.client_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          )
      )
    )
  );

-- ============================================================
-- Check it worked:
--   select column_name from information_schema.columns
--   where table_name = 'client_reviews' and column_name = 'booking_id';
-- ============================================================
