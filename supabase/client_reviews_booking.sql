-- TMKE — client reviews: the table, the shoot it belongs to, and sane policies
-- ---------------------------------------------------------------------------
-- Self-contained. It creates client_reviews if it is not there yet (it was
-- written for the public /leave-a-review page but the table was never actually
-- created, so that page has never been able to save anything), adds the link to
-- a booking, and replaces the read/delete policies.
--
-- Why the booking link: a member whose shoot has been delivered gets invited to
-- review it from their own bookings page, and the invitation has to disappear
-- once they have taken it. Nullable, because a review left by a stranger
-- through the public page has no booking - and that is most of them.
--
-- Why the policies change:
--   * select was `to authenticated using (true)`. Written when the only people
--     signed in were admins; since members got accounts it has meant any of
--     them could read every review on file.
--   * delete was the same, which is worse - any signed-in member could delete
--     anyone's review. Admins only now.
--   * insert is unchanged: the public page has to work for people who are not
--     signed in, and it still only accepts rows with all three fields filled.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

create table if not exists public.client_reviews (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  service       text not null,
  review_text   text not null,
  created_at    timestamptz not null default now()
);

create index if not exists client_reviews_created_at_idx
  on public.client_reviews (created_at desc);

-- ---- The shoot it is about ----------------------------------------------
alter table public.client_reviews
  add column if not exists booking_id uuid references public.videography_bookings(id) on delete set null;

create index if not exists client_reviews_booking_idx
  on public.client_reviews (booking_id);

comment on column public.client_reviews.booking_id is
  'The shoot this review is about, when it was left from the member hub. Null for reviews left through the public page.';

-- ---- RLS ----------------------------------------------------------------
alter table public.client_reviews enable row level security;

drop policy if exists "client_reviews insert anon"   on public.client_reviews;
drop policy if exists "client_reviews read authed"   on public.client_reviews;
drop policy if exists "client_reviews delete authed" on public.client_reviews;
drop policy if exists "client_reviews read own"      on public.client_reviews;
drop policy if exists "client_reviews admin write"   on public.client_reviews;

-- Anyone may leave one, signed in or not, as long as it is actually filled in.
create policy "client_reviews insert anon"
  on public.client_reviews for insert
  to anon, authenticated
  with check (
    length(coalesce(name, '')) > 0
    and length(coalesce(service, '')) > 0
    and length(coalesce(review_text, '')) > 0
  );

-- Admins read everything. A member reads only the reviews on their own
-- bookings, which is the one fact their bookings page needs: has this been
-- reviewed yet.
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

-- Editing and removing reviews is an admin job.
create policy "client_reviews admin write"
  on public.client_reviews for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- Check it worked:
--   select count(*) from public.client_reviews;              -- table exists
--   select column_name from information_schema.columns
--   where table_name = 'client_reviews';                     -- includes booking_id
-- ============================================================
