import { config } from 'dotenv';

config({ path: '.env.local' });

/**
 * Test script for fetchActivityWithTopSplits().
 * Run with: npx tsx scripts/test-strava-fetch.ts
 *
 * Before running, fill in the userId and stravaActivityId below.
 * Get the stravaActivityId from a Strava activity URL: strava.com/activities/123456789
 * Get the userId from the database or from your User model.
 */

async function main() {
  // Fill these in before running
  const userId = 'cmtyr06vo0000tuh83z93fqsp';
  const stravaActivityId = BigInt('16246055651');

  if (
    // @ts-expect-error Its okay that the types are different, It's incase I send the example
    userId === 'YOUR_USER_ID_HERE' ||
    stravaActivityId === BigInt('0')
  ) {
    console.error(
      '[XX] Please set userId and stravaActivityId in scripts/test-strava-fetch.ts before running'
    );
    process.exit(1);
  }

  console.log('[*] Testing fetchActivityWithTopSplits()');
  console.log(`[->] userId: ${userId}`);
  console.log(`[->] stravaActivityId: ${stravaActivityId}\n`);

  try {
    const { fetchActivityWithTopSplits } = await import('../lib/strava');

    console.log('[*] Fetching activity with top splits...\n');
    const result = await fetchActivityWithTopSplits(userId, stravaActivityId);

    console.log('[OK] Activity fetched successfully!\n');
    console.log(`[*] Activity Details:`);
    console.log(`    Name: ${result.name}`);
    console.log(`    Strava ID: ${result.stravaId}`);
    console.log(`    DB Activity ID: ${result.activityId}`);
    console.log(`    Start Date: ${result.startDate.toISOString()}`);
    console.log(`    Splits Found: ${result.splits.length}\n`);

    console.log('[*] Top Splits (ranked by speed):\n');
    result.splits.forEach((split, index) => {
      console.log(
        `    Split ${split.splitNumber}: ${split.distance.toFixed(0)}m @ ${split.averageSpeed.toFixed(2)} m/s`
      );
      console.log(
        `        Duration: ${split.elapsedTime}s | Offset: +${split.startOffsetSeconds}s`
      );
      console.log(
        `        Time Range: ${split.startDate.toISOString()} → ${split.endDate.toISOString()}`
      );
      console.log('');
    });

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
