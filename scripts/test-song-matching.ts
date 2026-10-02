import { config } from 'dotenv';
import { prisma } from '@/lib/prisma';
import { fetchActivityWithTopSplits } from '@/lib/strava';
import { fetchPlaysForActivity } from '@/lib/spotify';

config({ path: '.env.local' });

/**
 * Test script to see what the new song matching logic would produce.
 * Run with: npx tsx scripts/test-song-matching.ts
 */

function formatPace(speedMs: number): string {
  const secondsPerMile = 1609.34 / speedMs;
  const minutes = Math.floor(secondsPerMile / 60);
  const seconds = Math.round(secondsPerMile % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

async function main() {
  const userId = 'cmtyr06vo0000tuh83z93fqsp';
  const stravaActivityId = BigInt('20396520270');
  const SONG_TIMEOUT_MS = 6 * 60 * 1000;

  console.log('\n' + '='.repeat(100));
  console.log('SONG MATCHING TEST (NEW LOGIC)');
  console.log('='.repeat(100) + '\n');
  console.log(`Activity: ${stravaActivityId}`);
  console.log(`User: ${userId}\n`);

  try {
    // Fetch activity with splits (includes the distance filter fix)
    console.log('[*] Fetching activity with splits (distance >= 950m)...');
    const activity = await fetchActivityWithTopSplits(userId, stravaActivityId);
    console.log(`[OK] Fetched ${activity.splits.length} splits\n`);

    // Fetch plays
    const activityEndDate = new Date(
      activity.startDate.getTime() + (activity.elapsedTime * 1000)
    );
    console.log('[*] Fetching plays...');
    const plays = await fetchPlaysForActivity(userId, activity.startDate, activityEndDate);
    console.log(`[OK] Found ${plays.length} plays\n`);

    // Log all plays for reference
    console.log('[*] ALL PLAYS IN THIS TIME WINDOW:');
    console.log('-'.repeat(100));
    console.log('playedAt                 | Track                                          | Artist');
    console.log('-'.repeat(100));
    plays.forEach((play) => {
      console.log(
        `${play.playedAt.toISOString()} | ${play.trackName.substring(0, 45).padEnd(45)} | ${play.artist}`
      );
    });
    console.log('-'.repeat(100) + '\n');

    // Now apply the new matching logic for each split
    console.log('[*] SPLIT MATCHING RESULTS (NEW LOGIC):\n');

    for (const split of activity.splits) {
      const paceString = formatPace(split.averageSpeed);

      console.log(`Split ${split.splitNumber}:`);
      console.log(`  Time window: ${split.startDate.toISOString()} → ${split.endDate.toISOString()}`);
      console.log(`  Pace: ${paceString}/mi`);

      // Find the most recent play where playedAt <= split's end time
      const candidatePlays = plays.filter((play) => play.playedAt <= split.endDate);
      console.log(`  Candidates (playedAt <= split end): ${candidatePlays.length}`);

      if (candidatePlays.length > 0) {
        const mostRecentPlay = candidatePlays.sort(
          (a, b) => b.playedAt.getTime() - a.playedAt.getTime()
        )[0];

        const timeSincePlayedAtMs = split.endDate.getTime() - mostRecentPlay.playedAt.getTime();
        const timeSincePlayedAtMin = Math.round(timeSincePlayedAtMs / 1000 / 60);

        console.log(`    Most recent: "${mostRecentPlay.trackName}" by ${mostRecentPlay.artist}`);
        console.log(`    Played at: ${mostRecentPlay.playedAt.toISOString()}`);
        console.log(`    Time since playedAt: ${timeSincePlayedAtMin}min (threshold: 6min)`);

        if (timeSincePlayedAtMs <= SONG_TIMEOUT_MS) {
          console.log(`  ✅ MATCHED: "${mostRecentPlay.trackName}" by ${mostRecentPlay.artist}`);
        } else {
          console.log(`  ❌ NOT MATCHED (song timeout exceeded)`);
        }
      } else {
        console.log(`  ❌ NOT MATCHED (no plays before split end)`);
      }

      console.log('');
    }

    console.log('='.repeat(100) + '\n');
  } catch (error) {
    console.error('[XX] Test failed:');
    if (error instanceof Error) {
      console.error(`    ${error.message}`);
      console.error(error.stack);
    } else {
      console.error(`    ${String(error)}`);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
