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

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

    if (!clientId) {
      console.error('SPOTIFY_CLIENT_ID is not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (!redirectUri) {
      console.error('SPOTIFY_REDIRECT_URI is not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const spotifyAuthUrl = new URL('https://accounts.spotify.com/authorize');
    spotifyAuthUrl.searchParams.set('client_id', clientId);
    spotifyAuthUrl.searchParams.set('response_type', 'code');
    spotifyAuthUrl.searchParams.set('redirect_uri', redirectUri);
    spotifyAuthUrl.searchParams.set('scope', 'user-read-recently-played');
    spotifyAuthUrl.searchParams.set('state', user.id);

    return NextResponse.redirect(spotifyAuthUrl.toString());
  } catch (error) {
    console.error('Spotify redirect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Spotify connection' },
      { status: 500 }
    );
  }
}
