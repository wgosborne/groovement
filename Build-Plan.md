Encryption setup — pgcrypto (or app-level encryption) wired up before any real token ever gets written to OAuthToken

OAuth connect routes — /connect/strava and /connect/spotify, storing encrypted tokens against a User row

Landing page + request access flow — public page, request form, creates User (status: pending)

Admin approval view — see pending requests, approve/deny, triggers approval email + user's "connect now" email

Strava webhook receiver — GET verification challenge + POST handler that writes WebhookEvent rows and acks fast

Webhook subscription registration — actually subscribe your app to Strava's webhook events (one-time setup call)

Event processor — picks up pending WebhookEvent rows (cron or queue), resolves athleteId → User

Strava data fetch — pull activity + splits for the triggering event, write to Activity/Split

Spotify reactive poll — windowed to the activity's duration + 2-min buffer, with pagination handling for long runs, write to Play

Matching logic (TS rewrite) — port the pace conversion + top-4-splits + SOTD/AOTD logic from the Python version, with DRY_RUN and single-activity-override equivalents built in from the start

Strava description write-back — PUT the matched description, mark Activity.songMatched + WebhookEvent.status = completed

Retention/cleanup job — Vercel Cron deleting Split/Play rows older than 30 days

End-to-end test with yourself — your own account only, full pipeline, real run, real webhook, real write

Onboard first real friend — one at a time, watch closely, then repeat