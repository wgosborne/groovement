import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/encryption';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    const error = req.nextUrl.searchParams.get('error');

    if (error) {
      return NextResponse.json(
        {
          error: 'Access denied',
          message: 'You denied access to your Spotify account. Please try again if you\'d like to connect.',
        },
        { status: 400 }
      );
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing code or state from Spotify' },
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

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const host = req.headers.get('host') || 'groovement.dev';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const redirectUri = `${protocol}://${host}/connect/spotify/callback`;

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Spotify token exchange failed:', errorData);
      return NextResponse.json(
        {
          error: 'Failed to exchange code for tokens',
          details: errorData.error_description || 'Spotify API error',
        },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    const { refresh_token: refreshToken, access_token: accessToken } = tokenData;

    if (!refreshToken || !accessToken) {
      console.error('Missing refresh_token or access_token from Spotify');
      return NextResponse.json(
        { error: 'Invalid response from Spotify' },
        { status: 500 }
      );
    }

    const meResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!meResponse.ok) {
      const errorData = await meResponse.json().catch(() => ({}));
      console.error('Spotify /me endpoint failed:', errorData);
      return NextResponse.json(
        {
          error: 'Failed to fetch Spotify user data',
          details: errorData.error?.message || 'Spotify API error',
        },
        { status: 500 }
      );
    }

    const userData = await meResponse.json();
    const spotifyUserId = userData.id;

    if (!spotifyUserId) {
      console.error('Missing user id in Spotify /me response');
      return NextResponse.json(
        { error: 'Invalid Spotify user data' },
        { status: 500 }
      );
    }

    const encryptedRefreshToken = encrypt(refreshToken);

    await prisma.oAuthToken.upsert({
      where: {
        userId_service: {
          userId: user.id,
          service: 'spotify',
        },
      },
      create: {
        userId: user.id,
        service: 'spotify',
        refreshToken: encryptedRefreshToken,
      },
      update: {
        refreshToken: encryptedRefreshToken,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        spotifyUserId,
      },
    });

    const connectUrl = new URL('/connect', `${protocol}://${host}`);
    connectUrl.searchParams.set('token', user.connectToken!);

    return NextResponse.redirect(connectUrl.toString());
  } catch (error) {
    console.error('Spotify callback error:', error);
    return NextResponse.json(
      {
        error: 'Failed to complete Spotify connection',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
