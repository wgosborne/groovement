import { prisma } from '@/lib/prisma';
import { fetchActivityWithTopSplits, getActivityDescription } from '@/lib/strava';
import { fetchPlaysForActivity } from '@/lib/spotify';

export interface MatchResult {
  description: string;
  matchedCount: number;
  success: boolean;
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

  // 2. If zero splits, mark activity as matched and return early (not a failure)
  if (!activity.splits || activity.splits.length === 0) {
    console.info('No splits found for activity — marking as matched with nothing to do');

    await prisma.activity.update({
      where: { stravaId: stravaActivityId },
      data: { songMatched: true },
    });

    return {
      description: '',
      matchedCount: 0,
      success: true,
    };
  }

  // 3. Calculate activity end date and fetch plays
  const activityEndDate = new Date(
    activity.startDate.getTime() + (activity.elapsedTime * 1000)
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

    // Debug: log split time window
    console.debug(`Split ${split.splitNumber} time window:`, {
      startDate: split.startDate.toISOString(),
      endDate: split.endDate.toISOString(),
      durationMs: split.endDate.getTime() - split.startDate.getTime(),
    });

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

  // Add footer attribution
  descriptionBlock += '\n\nCalculated with https://groovement.dev';

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

  // 8. PUT description to Strava and update Activity record
  try {
    const oauthToken = await prisma.oAuthToken.findUnique({
      where: {
        userId_service: {
          userId,
          service: 'strava',
        },
      },
    });

    if (!oauthToken) {
      throw new Error(`No Strava OAuth token found for user ${userId}`);
    }

    // Refresh access token
    const { decrypt } = await import('@/lib/encryption');
    let refreshToken: string;
    try {
      refreshToken = decrypt(oauthToken.refreshToken);
    } catch (error) {
      throw new Error(
        `Failed to decrypt refresh token for user ${userId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET is not set');
    }

    const tokenResponse = await fetch('https://www.strava.com/api/v3/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({ error: 'Unknown error' }));
      const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
        ? String((errorData as Record<string, unknown>).error)
        : 'Unknown error';
      throw new Error(`Strava token refresh failed: ${errorMsg}`);
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };

    if (!tokenData.access_token) {
      throw new Error('No access token in Strava response');
    }

    const accessToken = tokenData.access_token;

    // PUT description to Strava
    const putResponse = await fetch(
      `https://www.strava.com/api/v3/activities/${stravaActivityId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: updatedDescription }),
      }
    );

    if (!putResponse.ok) {
      const errorData = await putResponse.json().catch(() => ({ error: 'Unknown error' }));
      const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
        ? String((errorData as Record<string, unknown>).error)
        : 'Unknown error';
      throw new Error(
        `Strava PUT failed: ${putResponse.status} ${errorMsg}`
      );
    }

    // Mark Activity as successfully matched
    await prisma.activity.update({
      where: { stravaId: stravaActivityId },
      data: { songMatched: true },
    });

    console.info(`Successfully updated Strava activity ${stravaActivityId} with matched songs`);

    return {
      description: updatedDescription,
      matchedCount,
      success: true,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to update Strava activity ${stravaActivityId}:`, errorMsg);
    throw error;
  }
}
