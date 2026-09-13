import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { connectToken: token },
    });

    if (!user || user.status !== 'approved') {
      return NextResponse.json(
        { error: 'This link is invalid or has expired' },
        { status: 401 }
      );
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    if (!clientId) {
      console.error('STRAVA_CLIENT_ID is not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const host = req.headers.get('host') || 'groovement.dev';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const redirectUri = `${protocol}://${host}/connect/strava/callback`;

    const stravaAuthUrl = new URL('https://www.strava.com/oauth/authorize');
    stravaAuthUrl.searchParams.set('client_id', clientId);
    stravaAuthUrl.searchParams.set('redirect_uri', redirectUri);
    stravaAuthUrl.searchParams.set('response_type', 'code');
    stravaAuthUrl.searchParams.set('scope', 'activity:read_all,activity:write');
    stravaAuthUrl.searchParams.set('state', user.id);

    return NextResponse.redirect(stravaAuthUrl.toString());
  } catch (error) {
    console.error('Strava redirect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Strava connection' },
      { status: 500 }
    );
  }
}
