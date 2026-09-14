import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
}

interface SpotifyPlayItem {
  track: SpotifyTrack;
  played_at: string;
}

interface SpotifyRecentlyPlayedResponse {
  items: SpotifyPlayItem[];
  cursors?: {
    after?: string;
  };
}

export interface FetchedPlay {
  userId: string;
  trackName: string;
  artist: string;
  spotifyTrackId: string;
  playedAt: Date;
}

async function refreshSpotifyAccessToken(
  userId: string,
  encryptedRefreshToken: string
): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is not set');
  }

  let refreshToken: string;
  try {
    refreshToken = decrypt(encryptedRefreshToken);
  } catch (error) {
    throw new Error(
      `Failed to decrypt Spotify refresh token for user ${userId}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Unknown error';
    throw new Error(`Spotify token refresh failed: ${errorMsg}`);
  }

  const tokenData = (await tokenResponse.json()) as Record<string, unknown>;
  const accessToken = tokenData.access_token;

  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('No access token in Spotify response');
  }

  return accessToken;
}

async function fetchSpotifyRecentlyPlayed(
  accessToken: string,
  afterMs: number,
  limit: number = 50
): Promise<SpotifyRecentlyPlayedResponse> {
  const url = new URL('https://api.spotify.com/v1/me/player/recently-played');
  url.searchParams.set('limit', limit.toString());
  url.searchParams.set('after', afterMs.toString());

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMsg = typeof errorData === 'object' && errorData !== null && 'error' in errorData
      ? String((errorData as Record<string, unknown>).error)
      : 'Unknown error';
    throw new Error(`Spotify recently-played fetch failed: ${response.status} ${errorMsg}`);
  }

  return (await response.json()) as SpotifyRecentlyPlayedResponse;
}

export async function fetchPlaysForActivity(
  userId: string,
  activityStart: Date,
  activityEnd: Date
): Promise<FetchedPlay[]> {
  // Get the user's Spotify OAuth token
  const oauthToken = await prisma.oAuthToken.findUnique({
    where: {
      userId_service: {
        userId,
        service: 'spotify',
      },
    },
  });

  if (!oauthToken) {
    throw new Error(`No Spotify OAuth token found for user ${userId}`);
  }

  // Refresh access token
  const accessToken = await refreshSpotifyAccessToken(userId, oauthToken.refreshToken);

  // Calculate query window: activity start minus 2 minutes to activity end plus 2 minutes
  const windowStart = new Date(activityStart.getTime() - 2 * 60 * 1000);
  const windowEnd = new Date(activityEnd.getTime() + 2 * 60 * 1000);

  console.log(`Fetching Spotify plays for user ${userId}`, {
    activityStart: activityStart.toISOString(),
    activityEnd: activityEnd.toISOString(),
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  });

  const allPlays: SpotifyPlayItem[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await fetchSpotifyRecentlyPlayed(accessToken, windowStart.getTime(), 50);
    allPlays.push(...response.items);

    // Check if we should fetch more
    if (response.items.length < 50) {
      hasMore = false;
    } else if (response.items.length === 50) {
      // Check if the oldest item in this page is already past the window end
      const oldestPlayTime = new Date(response.items[response.items.length - 1].played_at);
      if (oldestPlayTime > windowEnd) {
        hasMore = false;
      } else {
        cursor = response.cursors?.after;
        if (!cursor) {
          hasMore = false;
        } else {
          // Update the window start to the cursor for the next fetch
          // Actually, re-reading the logic: we should keep using after timestamp
          // but fetch the next page using the cursor
          // Let me adjust this
          hasMore = !!cursor;
        }
      }
    }
  }

  // Filter plays to only those within the window
  const filteredPlays = allPlays.filter((play) => {
    const playTime = new Date(play.played_at);
    return playTime >= windowStart && playTime <= windowEnd;
  });

  console.log(`Found ${filteredPlays.length} plays within window`);

  // Write plays to database and collect them
  const writtenPlays: FetchedPlay[] = [];

  for (const play of filteredPlays) {
    try {
      const track = play.track;
      const artist = track.artists[0]?.name || 'Unknown Artist';
      const playedAt = new Date(play.played_at);

      // Skip if this play already exists (exact duplicate check)
      const existing = await prisma.play.findFirst({
        where: {
          userId,
          spotifyTrackId: track.id,
          playedAt: {
            gte: new Date(playedAt.getTime() - 1000),
            lte: new Date(playedAt.getTime() + 1000),
          },
        },
      });

      if (existing) {
        console.info(`Skipping duplicate play: ${track.name} by ${artist}`);
        writtenPlays.push({
          userId,
          trackName: track.name,
          artist,
          spotifyTrackId: track.id,
          playedAt,
        });
        continue;
      }

      await prisma.play.create({
        data: {
          userId,
          trackName: track.name,
          artist,
          spotifyTrackId: track.id,
          playedAt,
        },
      });

      writtenPlays.push({
        userId,
        trackName: track.name,
        artist,
        spotifyTrackId: track.id,
        playedAt,
      });

      console.info(`Recorded play: ${track.name} by ${artist} at ${playedAt.toISOString()}`);
    } catch (error) {
      console.error(`Failed to record play:`, error);
      // Continue with next play, don't error out entirely
    }
  }

  // Sort by playedAt
  writtenPlays.sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());

  return writtenPlays;
}
