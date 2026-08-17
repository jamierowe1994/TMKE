# Deploying the Worker

The site and the Worker do not deploy together. There is no CI in this repo.

- **The Astro site** — Railway watches `main`. Push, and it goes.
- **The Cloudflare Worker** (`worker/`) — manual, always. Nothing you push
  updates it. It changes only when someone runs wrangler.

So a commit touching `worker/src/index.js` is live on nobody's machine until
the command below is run.

## The command

From the repo root, on a machine logged into the TMKE Cloudflare account:

```bash
cd worker && npm install && npx wrangler deploy
```

`npm install` is only needed the first time on a given machine, or after
`worker/package.json` changes.

If wrangler says *"You are not authenticated"*, run `npx wrangler login` first —
it opens a browser and asks you to authorise Cloudflare. That writes a
credential to `~/.wrangler` on that machine and leaves it there, so on a laptop
that is not yours, run `npx wrangler logout` when you are done.

Check it worked:

```bash
cd worker && npx wrangler deployments list
```

## What is currently waiting to go out

As of 17 August 2026, two commits are sitting in the gap between `main` and the
deployed Worker:

**1 · `7bcd684` — internal booking notes were reaching members**

`booking_messages` stores our emails to a client as `channel: 'email'` and our
internal notes about them as `channel: 'note'`. The table's RLS policy restricts
members to `'email'`, and that policy is correct.

But `/booking/mine` reads the table through `sbGet`, which authenticates as the
**service role — and the service role bypasses RLS**. The query had no channel
filter, so the endpoint returned every internal note about a booking to the
member it concerned. Both consumers rendered them: the bookings thread, and the
notification bell, which runs on every hub page.

The fix filters at the query (`channel=eq.email`) and again at both consumers.
**The consumer half is already live** via Railway, so nothing shows on screen
today — this deploy stops the endpoint sending them at all.

**2 · `b1f4c04` — the `smm_package` payment route**

Shoots covered by a social media package never get a `paid_at`, and everything
that releases work to a client tested `paid_at`. Those clients would sit behind
a paywall for a shoot they had already paid for.

`payment_route` gains `smm_package`, and every release gate now asks one
predicate, `isSettled()`, instead: the gallery send, the amends page, and the
hub's `/videography/my-pin` and `/videography/my-tour`. The day-after invoice
chase excludes the route so package clients are never chased for money that
already arrived.

Until this deploys, a package shoot behaves exactly as it does today — no
gallery, tour or PIN release. Nothing regresses; the new route simply has no
effect. The admin form's new "Social Media Marketing" option **is** already
live, so a booking can be marked with it now and will start working the moment
the Worker goes up.

`supabase/videography_smm_route.sql` has already been run.

## Nothing else is outstanding

No environment variables, secrets or bindings changed. `wrangler.toml` is
untouched. It is a code-only deploy.
