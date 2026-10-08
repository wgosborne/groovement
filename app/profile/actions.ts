'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';
import { deauthorizeStravaApp } from '@/lib/strava';

export async function disconnectStrava(): Promise<void> {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  const oauthToken = await prisma.oAuthToken.findUnique({
    where: { userId_service: { userId: user.id, service: 'strava' } },
  });

  // Revoke on Strava's side first so webhooks and API access stop. If this fails
  // (network error, already revoked), still remove the local connection.
  if (oauthToken) {
    try {
      await deauthorizeStravaApp(user.id, oauthToken.refreshToken);
    } catch (error) {
      console.error('Strava deauthorize failed; removing local connection anyway:', error);
    }
  }

  await prisma.$transaction([
    prisma.oAuthToken.deleteMany({ where: { userId: user.id, service: 'strava' } }),
    // Clearing the athlete ID means any stray Strava event resolves to "No User found"
    // (non-retryable) instead of retrying against a missing token.
    prisma.user.update({ where: { id: user.id }, data: { stravaAthleteId: null } }),
  ]);

  redirect('/profile?disconnected=strava');
}

export async function disconnectSpotify(): Promise<void> {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  // Spotify has no API endpoint to revoke a grant, so the user removes access on
  // Spotify's Apps page. We only drop the local token here.
  await prisma.oAuthToken.deleteMany({ where: { userId: user.id, service: 'spotify' } });

  redirect('/profile?disconnected=spotify');
}
