import { config } from 'dotenv';

config({ path: '.env.local' });

/**
 * Test script for fetchPlaysForActivity().
 * Run with: npx tsx scripts/test-spotify-fetch.ts
 *
 * Before running, fill in the userId, activityStart, and activityEnd below.
 * Get the userId from the database or from your User model.
 * Set activityStart and activityEnd to a time range when you know you were listening to Spotify.
 */

async function main() {
  // Fill these in before running
  const userId = 'cmtyr06vo0000tuh83z93fqsp';
  const activityStart = new Date('2026-09-14T03:30:00Z');
  const activityEnd = new Date('2026-09-14T10:30:00Z');

  // @ts-expect-error Its okay that the types are different, It's incase I send the example
  if (userId === 'YOUR_USER_ID_HERE') {
    console.error(
      '[XX] Please set userId, activityStart, and activityEnd in scripts/test-spotify-fetch.ts before running'
    );
    process.exit(1);
  }

  console.log('[*] Testing fetchPlaysForActivity()');
  console.log(`[->] userId: ${userId}`);
  console.log(`[->] activityStart: ${activityStart.toISOString()}`);
  console.log(`[->] activityEnd: ${activityEnd.toISOString()}\n`);

  try {
    const { fetchPlaysForActivity } = await import('../lib/spotify');

    console.log('[*] Fetching Spotify plays for activity...\n');
    const plays = await fetchPlaysForActivity(userId, activityStart, activityEnd);

    console.log('[OK] Plays fetched successfully!\n');
    console.log(`[*] Total Plays Found: ${plays.length}\n`);

    if (plays.length === 0) {
      console.log('[*] No plays found in the activity window.');
    } else {
      console.log('[*] Plays (in chronological order):\n');
      plays.forEach((play, index) => {
        console.log(`    ${index + 1}. "${play.trackName}" by ${play.artist}`);
        console.log(`       Spotify ID: ${play.spotifyTrackId}`);
        console.log(`       Played At: ${play.playedAt.toISOString()}`);
        console.log('');
      });
    }

    console.log('[***] Test completed successfully!\n');
  } catch (error) {
    console.error('[XX] Test failed:');
    if (error instanceof Error) {
      console.error(`    ${error.message}`);
    } else {
      console.error(`    ${String(error)}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
