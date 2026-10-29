# Instagram publishing

Real server-side Meta Graph API integration for connecting an
Instagram Business/Creator account and publishing images from the
asset library. **Code-complete, but unusable without your own Meta
developer app and credentials** — nothing here fakes a successful
connection or publish.

## What you need to set up before this works at all

1. A [Meta for Developers](https://developers.facebook.com/) account
   and a new app (type: **Business**).
2. Add the **Instagram Graph API** / **Facebook Login for Business**
   product to the app.
3. A Facebook **Page** connected to an **Instagram Business or
   Creator account** (not a personal Instagram account — the Content
   Publishing API does not support personal accounts).
4. In the app's settings, add a valid OAuth redirect URI matching
   `META_REDIRECT_URI` below exactly (including protocol and path).
5. Set these three environment variables in `apps/api/.env`:
   - `META_APP_ID` — the app's App ID.
   - `META_APP_SECRET` — the app's App Secret (server-side only,
     never sent to the frontend).
   - `META_REDIRECT_URI` — e.g.
     `http://localhost:4000/api/instagram/callback` in development.

If any of the three is missing, every `/api/instagram/*` endpoint
that would otherwise call Meta fails immediately with a clear
"not configured" error (503) — it never attempts a call that could
not succeed.

## App Review — the part that's easy to miss

While your app is in **Development Mode**, the OAuth flow and
publishing calls only work for Meta accounts you've explicitly added
as testers/developers on the app (Meta's dashboard → Roles). **For
any other user to connect and publish, Meta requires your app to pass
App Review** for the `instagram_basic`, `instagram_content_publish`,
and `pages_read_engagement` permissions used here. App Review requires
a working privacy policy URL, a screencast demonstrating the exact
use case, and Meta's approval — this can take days and is not
something this codebase can do for you. Until it's approved, treat
this feature as usable only by the app's own registered
testers/developers.

## OAuth flow implemented here

1. `GET /api/instagram/connect` (authenticated) returns Meta's
   authorization dialog URL; the frontend navigates the browser to it
   directly (this has to be a real top-level navigation, not a
   fetch, so Meta's own login/consent screen can render).
2. Meta redirects back to `GET /api/instagram/callback` with a `code`
   and `state`. The `state` value (minted per-connect-attempt, kept in
   an in-memory map with a 10-minute TTL — see the "known limitations"
   note below) is matched back to the user/workspace that started the
   flow; there's no `requireAuth` on this route because Meta's redirect
   carries no Bearer token.
3. The authorization code is exchanged for a short-lived token, then
   immediately exchanged again for a long-lived token (~60 days,
   verified against Meta's own docs as of 2026-10-29 — re-check if
   building against a different API version).
4. The connected Facebook Pages are queried for the first one with a
   linked Instagram Business/Creator account (`/me/accounts` with the
   `instagram_business_account` field). If the user manages several
   Pages with different connected Instagram accounts, the first match
   wins — there's no account picker here.
5. The Page access token (not the short-lived user token) and the
   discovered Instagram Business Account ID are stored server-side in
   `public.instagram_connections`, one row per workspace. The access
   token is never returned to the client by any endpoint — only
   connection status (`connected`/`expired`/`revoked`) and the
   Instagram username.

## Publishing

`POST /api/instagram/publish` creates a media container (Meta fetches
the image itself from the asset's signed Supabase Storage URL — valid
for 10 minutes, comfortably enough for one publish call) and then
publishes it. JPEG is the only image format the Content Publishing
API accepts for image posts, which matches what the generation
pipeline already produces.

## "Schedule for Later" — honestly, not full automation

This codebase has **no background job runner, cron, or worker
process**. `POST /api/instagram/schedule` durably persists a row in
`public.scheduled_posts` with status `pending` — nothing
automatically publishes it when `scheduled_for` arrives. A pending
(or previously failed) scheduled post has to be triggered manually via
`POST /api/instagram/scheduled/:id/publish`, which the frontend
exposes as a "Publish Now" action in the Scheduled Posts list once a
post is due.

Real automation would require one of:
- A Supabase `pg_cron` job (if enabled on the project's plan) calling
  a Postgres function via `pg_net` that hits
  `/api/instagram/scheduled/:id/publish` for due posts.
- An external scheduler (e.g. a separate worker process, a Vercel
  Cron Job if this backend is deployed there) polling
  `GET /api/instagram/scheduled` and calling the same publish endpoint
  for anything past its `scheduled_for` time.

Neither is wired up. Do not represent "Schedule for Later" to end
users as fully automatic until one of these is actually built and
verified.

## Known limitations

- The OAuth `state` store is in-memory and single-process (same
  documented tradeoff as `generationRateLimiter.ts`) — it does not
  survive a server restart or work across multiple backend instances.
  A connection attempt interrupted by a redeploy mid-flow will need to
  be retried from the start.
- No Page picker: if a user's Meta account manages multiple Facebook
  Pages with different linked Instagram accounts, only the first one
  found gets connected.
- No automatic token refresh job — a long-lived token expiring (~60
  days) surfaces as a clear "your connection has expired, please
  reconnect" error on the next publish attempt, not a silent failure.
