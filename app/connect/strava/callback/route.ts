import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/encryption';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    const error = req.nextUrl.searchParams.get('error');

    if (error) {
      return NextResponse.json(
        {
          error: 'Access denied',
          message: 'You denied access to your Strava account. Please try again if you\'d like to connect.',
        },
        { status: 400 }
      );
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing code or state from Strava' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: state },
    });

    if (!user || user.status !== 'approved') {
      return NextResponse.json(
        { error: 'User not found or not approved' },
        { status: 401 }
      );
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET is not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const host = req.headers.get('host') || 'groovement.dev';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const redirectUri = `${protocol}://${host}/connect/strava/callback`;

    const tokenResponse = await fetch('https://www.strava.com/api/v3/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Strava token exchange failed:', errorData);
      return NextResponse.json(
        {
          error: 'Failed to exchange code for tokens',
          details: errorData.message || 'Strava API error',
        },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    const { refresh_token: refreshToken, athlete } = tokenData;

    if (!refreshToken || !athlete || !athlete.id) {
      console.error('Missing refresh_token or athlete data from Strava');
      return NextResponse.json(
        { error: 'Invalid response from Strava' },
        { status: 500 }
      );
    }

    const encryptedRefreshToken = encrypt(refreshToken);

    await prisma.oAuthToken.upsert({
      where: {
        userId_service: {
          userId: user.id,
          service: 'strava',
        },
      },
      create: {
        userId: user.id,
        service: 'strava',
        refreshToken: encryptedRefreshToken,
      },
      update: {
        refreshToken: encryptedRefreshToken,
      },
    });

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stravaAthleteId: BigInt(athlete.id),
        },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        error.meta?.target?.includes('stravaAthleteId')
      ) {
        console.warn('Duplicate Strava athlete ID connection attempt', {
          userId: user.id,
          stravaAthleteId: athlete.id,
        });
        const connectUrl = new URL('/connect', `${protocol}://${host}`);
        connectUrl.searchParams.set('token', user.connectToken!);
        connectUrl.searchParams.set('error', 'duplicate_strava');
        return NextResponse.redirect(connectUrl.toString());
      }
      throw error;
    }

    const connectUrl = new URL('/connect', `${protocol}://${host}`);
    connectUrl.searchParams.set('token', user.connectToken!);

    return NextResponse.redirect(connectUrl.toString());
  } catch (error) {
    console.error('Strava callback error:', error);
    return NextResponse.json(
      {
        error: 'Failed to complete Strava connection',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
