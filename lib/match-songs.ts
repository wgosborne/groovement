import { fetchActivityWithTopSplits, getActivityDescription } from '@/lib/strava';
import { fetchPlaysForActivity } from '@/lib/spotify';

export interface MatchResult {
  description: string;
  matchedCount: number;
}

function formatPace(speedMs: number): string {
  // Convert m/s to seconds per mile
  // 1 mile = 1609.34 meters
  const secondsPerMile = 1609.34 / speedMs;
  const minutes = Math.floor(secondsPerMile / 60);
  const seconds = Math.round(secondsPerMile % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export async function matchSongsToActivity(
  userId: string,
  stravaActivityId: bigint
): Promise<MatchResult> {
  // 1. Fetch activity with top splits
  const activity = await fetchActivityWithTopSplits(userId, stravaActivityId);

  console.log(`Matching songs for activity ${stravaActivityId}`, {
    activityId: activity.activityId,
    splitsCount: activity.splits.length,
  });

  // 2. If zero splits, return early
  if (!activity.splits || activity.splits.length === 0) {
    console.info('No splits found for activity');
    return {
      description: '',
      matchedCount: 0,
    };
  }

  // 3. Calculate activity end date and fetch plays
  const activityEndDate = new Date(
    activity.startDate.getTime() + (activity.splits[activity.splits.length - 1].startDate.getTime() - activity.startDate.getTime()) +
    (activity.splits[activity.splits.length - 1].elapsedTime * 1000)
  );

  const plays = await fetchPlaysForActivity(userId, activity.startDate, activityEndDate);
  console.log(`Found ${plays.length} plays during activity`);

  // 4. Match plays to splits
  interface MatchedSplit {
    splitNumber: number;
    pace: string;
    track: string;
    artist: string;
  }

  const matchedSongs: MatchedSplit[] = [];
  let matchedCount = 0;

  for (const split of activity.splits) {
    // Convert m/s to pace string
    const paceString = formatPace(split.averageSpeed);

    // Find plays within this split's window (use first chronologically if multiple)
    const matchedPlay = plays.find(
      (play) => play.playedAt >= split.startDate && play.playedAt <= split.endDate
    );

    if (matchedPlay) {
      matchedSongs.push({
        splitNumber: split.splitNumber,
        pace: paceString,
        track: matchedPlay.trackName,
        artist: matchedPlay.artist,
      });
      matchedCount++;
      console.info(`Split ${split.splitNumber} matched: "${matchedPlay.trackName}" by ${matchedPlay.artist} @ ${paceString}/mi`);
    } else {
      // Track that this split has no match, but still keep the pace
      matchedSongs.push({
        splitNumber: split.splitNumber,
        pace: paceString,
        track: '',
        artist: '',
      });
      console.info(`Split ${split.splitNumber} unmatched @ ${paceString}/mi`);
    }
  }

  // 5. Build description block with specific format
  const fastestSplit = matchedSongs[0];
  const secondaryMatches = matchedSongs.slice(1).filter((m) => m.track);

  let descriptionBlock = '';

  // Fastest split line
  if (fastestSplit.track) {
    descriptionBlock = `Fastest split (${fastestSplit.pace}/mi): "${fastestSplit.track}" by ${fastestSplit.artist}`;
  } else {
    descriptionBlock = `Fastest split (${fastestSplit.pace}/mi): [no song playing]`;
  }

  // SOTD/AOTD lines (only if we have secondary matches)
  if (secondaryMatches.length > 0) {
    const sotdList = secondaryMatches.map((m) => `"${m.track}"`).join(', ');
    const aotdList = secondaryMatches.map((m) => m.artist).join(', ');
    descriptionBlock += `\nSOTD: ${sotdList}\nAOTD: ${aotdList}`;
  }

  console.log('Description block built:', {
    matchedCount,
    blockLength: descriptionBlock.length,
  });

  // 6. Fetch current activity description from Strava
  let currentDescription: string | null = null;
  try {
    currentDescription = await getActivityDescription(userId, stravaActivityId);
  } catch (error) {
    console.warn('Failed to fetch current activity description:', error);
    // Continue anyway - we'll just use empty current description
  }

  // 7. Build final description
  let updatedDescription: string;
  if (currentDescription && currentDescription.trim()) {
    updatedDescription = `${currentDescription}\n\n${descriptionBlock}`;
  } else {
    updatedDescription = descriptionBlock;
  }

  // 8. Return result
  return {
    description: updatedDescription,
    matchedCount,
  };
}
