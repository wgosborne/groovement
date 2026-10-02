import { config } from 'dotenv';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

config({ path: '.env.local' });

/**
 * Debug script to fetch raw Strava splits data without any filtering.
 * Shows EXACTLY what Strava returns in splits_metric array.
 * Run with: npx tsx scripts/debug-strava-splits.ts
 */

interface StravaTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

interface StravaSplit {
  split: number;
  distance: number;
  elapsed_time: number;
  elevation_difference: number;
  moving_time: number;
  average_speed: number;
  average_grade_adjusted_speed: number;
  average_cadence: number;
  average_watts: number;
  average_heartrate: number;
  max_heartrate: number;
}

interface StravaActivityDetail {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  timezone: string;
  utc_offset: number;
  splits_metric: StravaSplit[];
  description?: string;
  [key: string]: unknown;
}

async function refreshAccessToken(
  userId: string,
  encryptedRefreshToken: string
): Promise<string> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET is not set');
  }

  let refreshToken: string;
  try {
    refreshToken = decrypt(encryptedRefreshToken);
  } catch (error) {
    throw new Error(
      `Failed to decrypt refresh token for user ${userId}: ${error instanceof Error ? error.message : String(error)}`
    );
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

  const tokenData = (await tokenResponse.json()) as StravaTokenResponse;

  if (!tokenData.access_token) {
    throw new Error('No access token in Strava response');
  }

  return tokenData.access_token;
}

async function fetchStravaActivity(
  accessToken: string,
  activityId: bigint
): Promise<StravaActivityDetail> {
  const url = `https://www.strava.com/api/v3/activities/${activityId}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Unknown error';
    throw new Error(`Failed to fetch activity from Strava: ${response.status} ${errorMsg}`);
  }

  return (await response.json()) as StravaActivityDetail;
}

async function main() {
  const activityId = BigInt('20396520270');
  const userId = 'cmtyr06vo0000tuh83z93fqsp';

  console.log('\n' + '='.repeat(80));
  console.log('STRAVA RAW SPLITS DEBUG');
  console.log('='.repeat(80) + '\n');
  console.log(`[*] Activity ID: ${activityId}`);
  console.log(`[*] User ID: ${userId}\n`);

  try {
    // Get OAuth token for user
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

    console.log('[*] Found OAuth token, refreshing access token...');
    const accessToken = await refreshAccessToken(userId, oauthToken.refreshToken);
    console.log('[OK] Access token refreshed\n');

    console.log('[*] Fetching activity from Strava...');
    const activity = await fetchStravaActivity(accessToken, activityId);
    console.log('[OK] Activity fetched\n');

    console.log('[*] Activity Info:');
    console.log(`    Name: ${activity.name}`);
    console.log(`    Type: ${activity.sport_type}`);
    console.log(`    Total Distance: ${(activity.distance / 1000).toFixed(2)} km`);
    console.log(`    Total Elapsed Time: ${activity.elapsed_time}s`);
    console.log(`    Start Date: ${activity.start_date}\n`);

    // Print ALL raw splits from Strava
    const splits = activity.splits_metric || [];
    console.log(`[*] RAW SPLITS FROM STRAVA (${splits.length} total):\n`);
    console.log('Split #  | Distance (m) | Elapsed (s) | Avg Speed (m/s) | Notes');
    console.log('-'.repeat(80));

    for (const split of splits) {
      const notes = split.elapsed_time === 17 ? '← 17-SECOND SPLIT' : '';
      console.log(
        `${String(split.split).padStart(7)} | ${String(split.distance.toFixed(1)).padStart(11)} | ${String(split.elapsed_time).padStart(10)} | ${String(split.average_speed.toFixed(3)).padStart(14)} | ${notes}`
      );
    }

    console.log('\n' + '='.repeat(80));
    console.log('DETAILED SPLITS DATA (JSON)');
    console.log('='.repeat(80) + '\n');

    // Also print detailed JSON for each split
    splits.forEach((split) => {
      console.log(`Split #${split.split}:`);
      console.log(JSON.stringify({
        split_number: split.split,
        distance: split.distance,
        elapsed_time: split.elapsed_time,
        average_speed: split.average_speed,
        moving_time: split.moving_time,
        elevation_difference: split.elevation_difference,
      }, null, 2));
      console.log('');
    });

    console.log('='.repeat(80));
    console.log(`\n[OK] Debug complete! Total splits returned by Strava: ${splits.length}`);

    // Check if there's a 17-second split
    const has17SecSplit = splits.some(s => s.elapsed_time === 17);
    if (has17SecSplit) {
      console.log('[!!!] FOUND 17-SECOND SPLIT(S) IN STRAVA RESPONSE!');
    } else {
      console.log('[INFO] No 17-second split found in Strava response.');
    }

  } catch (error) {
    console.error('\n[XX] Debug failed:');
    if (error instanceof Error) {
      console.error(`    ${error.message}`);
      console.error(`    ${error.stack}`);
    } else {
      console.error(`    ${String(error)}`);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
