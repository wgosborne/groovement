import { config } from 'dotenv';

config({ path: '.env.local' });

/**
 * Test script for matchSongsToActivity().
 * Run with: npx tsx scripts/test-match-songs.ts
 *
 * Before running, fill in the userId and stravaActivityId below.
 * Get the userId from the database.
 * Get the stravaActivityId from a Strava activity URL: strava.com/activities/123456789
 */

async function main() {
  // Fill these in before running
  const userId = 'cmtyr06vo0000tuh83z93fqsp';
  const stravaActivityId = BigInt('20174007916');

  if (
    // @ts-expect-error Its okay that the types are different, It's incase I send the example
    userId === 'YOUR_USER_ID_HERE' ||
    stravaActivityId === BigInt('0')
  ) {
    console.error(
      '[XX] Please set userId and stravaActivityId in scripts/test-match-songs.ts before running'
    );
    process.exit(1);
  }

  console.log('[*] Testing matchSongsToActivity()');
  console.log(`[->] userId: ${userId}`);
  console.log(`[->] stravaActivityId: ${stravaActivityId}\n`);

  try {
    const { matchSongsToActivity } = await import('../lib/match-songs');

    console.log('[*] Matching songs to activity...\n');
    const result = await matchSongsToActivity(userId, stravaActivityId);

    console.log('[OK] Songs matched successfully!\n');
    console.log(`[*] Matched Count: ${result.matchedCount} / 4 splits\n`);

    console.log('[*] Generated Description:\n');
    console.log('---START---');
    console.log(result.description);
    console.log('---END---\n');

    console.log('[***] Test completed successfully!\n');
  } catch (error) {
    console.error('[XX] Test failed:');
    if (error instanceof Error) {
      console.error(`    ${error.message}`);
      console.error(`    Stack: ${error.stack}`);
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
