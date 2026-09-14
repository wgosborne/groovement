import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

const SPEED_CEILING_MS = 8.94; // m/s — reject anything faster (likely GPS glitch)
const TOP_SPLITS_COUNT = 4;

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
  [key: string]: unknown;
}

export interface FetchedSplit {
  splitNumber: number;
  distance: number;
  averageSpeed: number;
  startOffsetSeconds: number;
  elapsedTime: number;
  startDate: Date;
  endDate: Date;
}

export interface FetchActivityResult {
  activityId: string;
  stravaId: bigint;
  name: string;
  startDate: Date;
  splits: FetchedSplit[];
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

  console.log(`[DEBUG] Fetching Strava activity`);
  console.log(`[DEBUG] URL: ${url}`);
  console.log(`[DEBUG] Token: ${accessToken}`);

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

export async function fetchActivityWithTopSplits(
  userId: string,
  stravaActivityId: bigint
): Promise<FetchActivityResult> {
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

  console.log(`[DEBUG] Refreshing access token for user ${userId}`);
  const accessToken = await refreshAccessToken(userId, oauthToken.refreshToken);
  console.log(`[DEBUG] Access token refreshed successfully`);

  console.log(`[DEBUG] Calling fetchStravaActivity with ID: ${stravaActivityId}`);
  const activity = await fetchStravaActivity(accessToken, stravaActivityId);
  console.log(`[DEBUG] Activity fetched successfully`);

  const activityStartDate = new Date(activity.start_date);

  const rankedSplits = (activity.splits_metric || [])
    .filter((split) => split.average_speed <= SPEED_CEILING_MS)
    .sort((a, b) => b.average_speed - a.average_speed)
    .slice(0, TOP_SPLITS_COUNT)
    .map((split, index) => {
      const cumulativeElapsedSeconds = activity.splits_metric
        .slice(0, activity.splits_metric.indexOf(split))
        .reduce((sum, s) => sum + s.elapsed_time, 0);

      return {
        splitNumber: index + 1,
        distance: split.distance,
        averageSpeed: split.average_speed,
        startOffsetSeconds: cumulativeElapsedSeconds,
        elapsedTime: split.elapsed_time,
      };
    });

  let dbActivity = await prisma.activity.findUnique({
    where: { stravaId: stravaActivityId },
  });

  if (!dbActivity) {
    dbActivity = await prisma.activity.create({
      data: {
        userId,
        stravaId: stravaActivityId,
        name: activity.name,
        startDate: activityStartDate,
        elapsedTime: activity.elapsed_time,
        songMatched: false,
      },
    });
  }

  for (const split of rankedSplits) {
    await prisma.split.create({
      data: {
        activityId: dbActivity.id,
        splitNumber: split.splitNumber,
        distance: split.distance,
        averageSpeed: split.averageSpeed,
        startOffsetSeconds: split.startOffsetSeconds,
        elapsedTime: split.elapsedTime,
      },
    });
  }

  const result: FetchActivityResult = {
    activityId: dbActivity.id,
    stravaId: stravaActivityId,
    name: activity.name,
    startDate: activityStartDate,
    splits: rankedSplits.map((split) => ({
      ...split,
      startDate: new Date(activityStartDate.getTime() + split.startOffsetSeconds * 1000),
      endDate: new Date(
        activityStartDate.getTime() +
          (split.startOffsetSeconds + split.elapsedTime) * 1000
      ),
    })),
  };

  return result;
}
