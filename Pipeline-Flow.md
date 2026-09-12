1. Strava webhook fires (new activity)
   ↓
2. Webhook handler writes a WebhookEvent row (pending), acks 200 immediately
   ↓
3. Processor (cron or queue) picks up the pending event
   ↓
4. Fetch that activity's full detail + splits from Strava
   → write to Activity + Split tables
   ↓
5. Poll Spotify recently-played for that user, windowed to 
   activity.startDate - 2min → (startDate + elapsedTime) + 2min
   → write to Play table
   ↓
6. Run matching logic (top splits + overlapping plays → SOTD/AOTD)
   ↓
7. PUT updated description back to Strava
   ↓
8. Mark Activity.songMatched = true, WebhookEvent.status = completed