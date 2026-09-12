# Groovement — Requirements

## What it is
A hosted, multi-user version of the personal Strava+Spotify song-matching project.
Public-facing (linked from videos, and from a signup link embedded in Strava
descriptions), but gated — every user must request access and be manually approved.
Not marketed as a business.

## Stack
- **Frontend + backend:** Next.js (TypeScript, App Router), hosted on Vercel
- **Database:** Neon (Postgres), separate project from the personal repo
- **ORM:** Prisma
- **Domain:** groovement.dev (purchased + hosted through Vercel)
- **Strava/Spotify apps:** shared with the personal project's existing Strava app
  (renamed to "Groovement" in Strava's dashboard); separate Spotify app registered
  for this project

## Core flow
1. User requests access on the landing page (name + email) → `User` row created,
   `status = pending`
2. Admin (you) approves or denies via an admin view
3. On approval, user gets an email with a link to connect Strava + Spotify (OAuth)
4. Once connected, Strava webhook fires whenever that user finishes an activity
5. Webhook handler writes a `WebhookEvent` row (status `pending`), acks 200 immediately
6. A processor (cron or queue) picks up pending events:
   - Fetches the activity + splits from Strava
   - Polls Spotify's recently-played, windowed to the activity's actual
     `start_date` → `start_date + elapsed_time`, **with a 2-minute buffer on
     both sides**
   - Runs matching logic: top 4 fastest splits, song + artist for each,
     fastest one called out specifically (same SOTD/AOTD format as the
     personal project)
   - PUTs the updated description back to Strava (appended to existing
     description, never overwritten)
   - Marks `Activity.songMatched = true`, `WebhookEvent.status = completed`

## Why webhooks (not polling)
- Strava supports webhooks (one subscription per app) — event-driven, scales with
  actual activity volume instead of user count × polling frequency
- Spotify has no webhook equivalent — stays poll-based, but polling is **reactive**
  (only fires when a Strava webhook lands for that user), not on a fixed schedule
- Long runs may exceed Spotify's 50-track-per-call limit — needs pagination handling

## Data model (high level)
- `User` — status (pending/approved/denied), Strava athlete ID, Spotify user ID.
  Also doubles as the access request — no separate request table.
- `OAuthToken` — one row per user per service (strava/spotify), refresh token
  **encrypted at rest**. Access tokens are never persisted (short-lived, regenerated
  on demand).
- `Activity` — Strava activity metadata + `songMatched` flag. Kept indefinitely
  (lightweight, mirrors what's already public on the user's own Strava page).
- `Split` — per-split pace/distance data, tied to an Activity.
- `Play` — Spotify listening history, tied to a user.
- `WebhookEvent` — async processing queue. Deduplicated on Strava's event ID
  (Strava can send duplicate events). Nullable `userId` since the raw webhook only
  gives an athlete ID, which has to be resolved.

## Data retention
- `Split` and `Play` rows are deleted after **30 days** (scheduled cleanup job,
  Vercel Cron, daily). Balances having enough of a window to debug a reported
  issue against not holding onto sensitive data (especially listening history)
  indefinitely.
- `Activity` rows are kept indefinitely.
- Rationale: full statelessness (discard everything immediately, never store
  tokens) was considered and rejected — it breaks automation entirely, since
  acting on a user's behalf without them present requires a persisted credential.
  Persisting Activity/Split/Play (rather than discarding immediately after
  matching) was chosen over a fully-stateless pipeline because it preserves
  retry-ability, dedup, and debuggability — priorities: speed, accuracy,
  reliability.

## Security
- Refresh tokens encrypted at rest (pgcrypto or equivalent) — the one thing that
  must be stored for automation to work, so it's the one thing protected most
  carefully.
- Activity/split/play data not encrypted at the column level (would block easy
  debugging); mitigated instead by the 30-day retention window.

## Growth / Strava limits
- Standard Tier, self-upgraded to 10-athlete capacity (done, no review required)
- Beyond 10 athletes requires Strava review (still Standard Tier, up to 9,999) —
  approval-gate naturally produces the demand evidence for that review later
- Shared Strava app with the personal project means shared athlete capacity and
  shared rate limits between the two — accepted tradeoff for avoiding a second
  Strava subscription cost

## Legal
- Simple privacy policy required once real users' data is involved (Strava's API
  terms require this for any app requesting user auth)

## Explicitly out of scope (for now)
- Generating/attaching an image or graphic to activities (Strava's API doesn't
  support third-party image uploads to activities at all — not a build choice,
  a hard platform limitation)
- Fully open self-service signup (deliberately gated/approved instead)
- Sharing the same codebase as the personal (soon-to-be open-sourced) project —
  built as a separate repo from scratch, accepting some logic duplication for now